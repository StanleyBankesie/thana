import { pool } from "../db/pool.js";
import { getIO } from "../utils/socket.js";
import { sendPushToUser } from "../routes/push.routes.js";

/**
 * Social Feed Controller
 * Handles posts, comments, likes with visibility filtering
 */

// ============================================
// 📌 GET POSTS WITH VISIBILITY FILTERING
// ============================================

/**
 * Retrieves a paginated list of social feed posts visible to the current user.
 * Filters posts based on company or warehouse visibility.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const getPosts = async (req, res) => {
  try {
    // Resolve userId from session/JWT or x-user-id header
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Look up user's company_id and branch_id fresh from DB
    const [[userRow]] = await pool.query(
      `SELECT id, company_id, branch_id FROM adm_users WHERE id = ? LIMIT 1`,
      [userId]
    );

    const companyId = Number(userRow?.company_id) || null;
    const branchId = Number(userRow?.branch_id) || null;

    // Get all branch assignments
    const [branchRows] = await pool.query(
      `SELECT DISTINCT branch_id FROM adm_user_branches WHERE user_id = ?`,
      [userId]
    );
    const allBranchIds = [...new Set([
      ...(branchId ? [branchId] : []),
      ...branchRows.map(r => Number(r.branch_id)).filter(Boolean)
    ])];

    // Build visibility query for this user:
    // 1) Own posts always visible
    // 2) Company posts: post author shares same company as viewer
    // 3) Branch/warehouse posts: post branch matches viewer's branches
    // Fallback: if user has no company association, show ALL posts (safety net)
    const branchPh = allBranchIds.length > 0 ? allBranchIds.map(() => "?").join(",") : "0";

    let queryStr, queryParams;
    if (!companyId) {
      // No company info - show all posts as safety fallback
      queryStr = `
        SELECT DISTINCT
          p.id, p.user_id, p.content, p.image_url, p.visibility_type,
          COALESCE(p.branch_id, p.warehouse_id) AS branch_id,
          (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
          (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count,
          p.created_at,
          COALESCE(u.full_name, u.username, 'User') AS full_name,
          u.profile_picture AS profile_picture,
          (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS user_liked
        FROM posts p
        LEFT JOIN adm_users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?`;
      queryParams = [userId, limit, offset];
    } else {
      queryStr = `
        SELECT DISTINCT
          p.id, p.user_id, p.content, p.image_url, p.visibility_type,
          COALESCE(p.branch_id, p.warehouse_id) AS branch_id,
          (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
          (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count,
          p.created_at,
          COALESCE(u.full_name, u.username, 'User') AS full_name,
          u.profile_picture AS profile_picture,
          (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS user_liked
        FROM posts p
        LEFT JOIN adm_users u ON p.user_id = u.id
        WHERE
          (p.user_id = ?)
          OR (p.visibility_type = 'company' AND u.company_id = ?)
          OR (p.visibility_type IN ('branch', 'warehouse') AND COALESCE(p.branch_id, p.warehouse_id) IN (${branchPh}))
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?`;
      queryParams = [userId, userId, companyId, ...allBranchIds, limit, offset];
    }

    const [posts] = await pool.query(queryStr, queryParams);

    const origin = `${req.protocol}://${req.get("host")}`;
    const toAbsoluteImageUrl = (s) => {
      try {
        if (!s) return null;
        const str = String(s);
        if (/^https?:\/\//i.test(str)) {
          try {
            const u = new URL(str);
            if (
              u.hostname === "localhost" &&
              (u.port === "5173" || u.port === "5174" || u.port === "")
            ) {
              return `${origin}${u.pathname}`;
            }
            return str;
          } catch {
            return str;
          }
        }
        if (str.startsWith("/uploads")) return `${origin}${str}`;
        if (str.startsWith("uploads")) return `${origin}/${str}`;
        return str;
      } catch {
        return s;
      }
    };

    const postsWithComments = [];
    for (const post of posts) {
      const [comments] = await pool.query(
        `
        SELECT 
          pc.id,
          pc.user_id,
          pc.comment_text,
          pc.created_at,
          COALESCE(u.full_name, u.username, 'User') AS full_name
        FROM post_comments pc
        LEFT JOIN adm_users u ON pc.user_id = u.id
        WHERE pc.post_id = ?
        ORDER BY pc.created_at DESC
        LIMIT 3
        `,
        [post.id],
      );
      const mappedComments = comments.reverse().map((c) => {
        return {
          ...c,
          profile_picture_url: c.user_id ? `/api/social-feed/avatar/${c.user_id}` : "/default-avatar.png",
        };
      });
      const { profile_picture: postPic, ...cleanPost } = post;
      postsWithComments.push({
        ...cleanPost,
        like_count: Number(post.like_count) || 0,
        comment_count: Number(post.comment_count) || 0,
        image_url: toAbsoluteImageUrl(post.image_url),
        profile_picture_url: post.user_id ? `/api/social-feed/avatar/${post.user_id}` : "/default-avatar.png",
        comments: mappedComments,
        user_liked: Number(post.user_liked) > 0,
      });
    }

    res.json({
      success: true,
      data: postsWithComments,
      pagination: { offset, limit, total: postsWithComments.length },
    });
  } catch (error) {
    console.error("Error in getPosts:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 📌 GET SINGLE POST WITH ALL COMMENTS
// ============================================

/**
 * Retrieves a single post by its ID, including all associated comments.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const getPostById = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const { postId } = req.params;
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `
        SELECT 
          p.id,
          p.user_id,
          p.content,
          p.image_url,
          p.visibility_type,
          COALESCE(p.branch_id, p.warehouse_id) AS branch_id,
          p.like_count,
          p.comment_count,
          p.created_at,
          COALESCE(u.full_name, u.username, 'User') AS full_name,
          u.profile_picture AS profile_picture,
          (SELECT COUNT(*)
         FROM post_likes pl
         WHERE pl.post_id = p.id AND pl.user_id = ?) AS user_liked
        FROM posts p
        LEFT JOIN adm_users u ON p.user_id = u.id
        WHERE p.id = ?
        `,
        [userId, postId],
      );
      if (!rows.length) {
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }
      const post = rows[0];
      const [comments] = await connection.query(
        `
        SELECT 
          pc.id,
          pc.user_id,
          pc.comment_text,
          pc.created_at,
          u.full_name,
          u.profile_picture AS profile_picture,
          pc.created_at,
          u2.username AS created_by_name
         FROM post_comments pc
        JOIN adm_users u ON pc.user_id = u.id
        LEFT JOIN adm_users u2 ON u2.id = pc.created_by
         WHERE pc.post_id = ?
        ORDER BY pc.created_at ASC
        `,
        [postId],
      );
      const toUrl = (blob) => {
        if (!blob) return null;
        const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
        const str = b.toString("utf8");
        if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:")) return str;
        let mime = "image/jpeg";
        if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
          mime = "image/jpeg";
        } else if (
          b.length >= 8 &&
          b[0] === 0x89 &&
          b[1] === 0x50 &&
          b[2] === 0x4e &&
          b[3] === 0x47 &&
          b[4] === 0x0d &&
          b[5] === 0x0a &&
          b[6] === 0x1a &&
          b[7] === 0x0a
        ) {
          mime = "image/png";
        } else if (
          b.length >= 12 &&
          b[0] === 0x52 &&
          b[1] === 0x49 &&
          b[2] === 0x46 &&
          b[3] === 0x46 &&
          b[8] === 0x57 &&
          b[9] === 0x45 &&
          b[10] === 0x42 &&
          b[11] === 0x50
        ) {
          mime = "image/webp";
        }
        return `data:${mime};base64,${b.toString("base64")}`;
      };
      const mappedComments = comments.map((c) => {
        const { profile_picture: pic, ...cleanC } = c;
        return {
          ...cleanC,
          profile_picture_url: toUrl(pic),
        };
      });
      const origin = `${req.protocol}://${req.get("host")}`;
      const toAbsoluteImageUrl = (s) => {
        try {
          if (!s) return null;
          const str = String(s);
          if (/^https?:\/\//i.test(str)) {
            try {
              const u = new URL(str);
              if (
                u.hostname === "localhost" &&
                (u.port === "5173" || u.port === "5174" || u.port === "")
              ) {
                return `${origin}${u.pathname}`;
              }
              return str;
            } catch {
              return str;
            }
          }
          if (str.startsWith("/uploads")) return `${origin}${str}`;
          if (str.startsWith("uploads")) return `${origin}/${str}`;
          return str;
        } catch {
          return s;
        }
      };
      const { profile_picture: postPic, ...cleanPost } = post;
      res.json({
        success: true,
        data: {
          ...cleanPost,
          image_url: toAbsoluteImageUrl(post.image_url),
          profile_picture_url: toUrl(postPic),
          comments: mappedComments,
          user_liked: post.user_liked === 1,
        },
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ============================================
// 📝 CREATE POST
// ============================================

/**
 * Creates a new social feed post with visibility constraints.
 * Broadcasts the new post and triggers notifications.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const createPost = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const branchId =
      Number(req.user?.branch_id) ||
      Number(req.scope?.branchId) ||
      Number(req.body?.branch_id) ||
      null;
    const companyId = Number(req.scope?.companyId) || 1;
    const { content, image_url, visibility_type } = req.body;

    // Validation
    if (!content || content.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Content is required" });
    }

    if (!["company", "branch"].includes(visibility_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid visibility type",
      });
    }
    if (visibility_type === "branch" && !Number.isFinite(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Warehouse ID required for warehouse visibility",
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Create post
      const [postResult] = await connection.query(
        `
        INSERT INTO posts (user_id, content, image_url, visibility_type, branch_id)
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          userId,
          content,
          image_url || null,
          visibility_type,
          visibility_type === "branch" ? branchId : null,
        ],
      );

      const postId = postResult.insertId;

      await connection.commit();

      // Fetch created post with user info
      const [post] = await connection.query(
        `
        SELECT 
          p.*,
          u.full_name,
          u.profile_picture AS profile_picture,
          p.created_at,
          u2.username AS created_by_name
         FROM posts p
        JOIN adm_users u ON p.user_id = u.id
        LEFT JOIN adm_users u2 ON u2.id = p.created_by
         WHERE p.id = ?
        `,
        [postId],
      );

      const toUrl = (blob) => {
        if (!blob) return null;
        const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
        const str = b.toString("utf8");
        if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:")) return str;
        let mime = "image/jpeg";
        if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
          mime = "image/jpeg";
        } else if (
          b.length >= 8 &&
          b[0] === 0x89 &&
          b[1] === 0x50 &&
          b[2] === 0x4e &&
          b[3] === 0x47 &&
          b[4] === 0x0d &&
          b[5] === 0x0a &&
          b[6] === 0x1a &&
          b[7] === 0x0a
        ) {
          mime = "image/png";
        } else if (
          b.length >= 12 &&
          b[0] === 0x52 &&
          b[1] === 0x49 &&
          b[2] === 0x46 &&
          b[3] === 0x46 &&
          b[8] === 0x57 &&
          b[9] === 0x45 &&
          b[10] === 0x42 &&
          b[11] === 0x50
        ) {
          mime = "image/webp";
        }
        return `data:${mime};base64,${b.toString("base64")}`;
      };
      const { profile_picture: postPic, ...cleanPost0 } = post[0] || {};
      const createdPost = {
        ...cleanPost0,
        profile_picture_url: toUrl(postPic),
      };

      try {
        broadcastNewPost(createdPost, visibility_type, branchId);
      } catch {}

      // Trigger notifications asynchronously in background
      triggerPostNotifications(
        postId,
        userId,
        "post_created",
        visibility_type,
        branchId,
        companyId,
      ).catch((err) => {
        console.error("Background notification error:", err?.message);
      });

      res.status(201).json({
        success: true,
        message: "Post created successfully",
        data: { ...createdPost, comments: [], user_liked: false },
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Retrieves a paginated list of comments for a specific post.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const connection = await pool.getConnection();
    try {
      const [comments] = await connection.query(
        `
        SELECT 
          pc.id,
          pc.user_id,
          pc.comment_text,
          pc.created_at,
          COALESCE(u.full_name, u.username, 'User') AS full_name,
          u.profile_picture AS profile_picture,
          u2.username AS created_by_name
         FROM post_comments pc
        LEFT JOIN adm_users u ON pc.user_id = u.id
        LEFT JOIN adm_users u2 ON u2.id = pc.created_by
         WHERE pc.post_id = ?
        ORDER BY pc.created_at ASC
        LIMIT ? OFFSET ?
        `,
        [postId, limit, offset],
      );
      const toUrl2 = (blob) => {
        if (!blob) return null;
        const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
        const str = b.toString("utf8");
        if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:")) return str;
        let mime = "image/jpeg";
        if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
          mime = "image/jpeg";
        } else if (
          b.length >= 8 &&
          b[0] === 0x89 &&
          b[1] === 0x50 &&
          b[2] === 0x4e &&
          b[3] === 0x47 &&
          b[4] === 0x0d &&
          b[5] === 0x0a &&
          b[6] === 0x1a &&
          b[7] === 0x0a
        ) {
          mime = "image/png";
        } else if (
          b.length >= 12 &&
          b[0] === 0x52 &&
          b[1] === 0x49 &&
          b[2] === 0x46 &&
          b[3] === 0x46 &&
          b[8] === 0x57 &&
          b[9] === 0x45 &&
          b[10] === 0x42 &&
          b[11] === 0x50
        ) {
          mime = "image/webp";
        }
        return `data:${mime};base64,${b.toString("base64")}`;
      };
      const mapped = comments.map((c) => {
        const { profile_picture: pic, ...cleanC } = c;
        return {
          ...cleanC,
          profile_picture_url: toUrl2(pic),
        };
      });
      res.json({
        success: true,
        data: mapped,
        pagination: { offset, limit, total: mapped.length },
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 🖼️ UPDATE POST IMAGE
// ============================================

/**
 * Updates the image URL for an existing post. Only the post owner can perform this.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const updatePostImage = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const { postId } = req.params;
    const image_url = String(req.body?.image_url || "").trim();
    if (!image_url) {
      return res
        .status(400)
        .json({ success: false, message: "image_url is required" });
    }
    const connection = await pool.getConnection();
    try {
      // Only the owner can update the image
      const [rows] = await connection.query(
        `SELECT id, user_id,
          created_at,
          u.username AS created_by_name
         FROM posts
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = ? LIMIT 1`,
        [postId],
      );
      if (!rows.length) {
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }
      const ownerId = Number(rows[0].user_id);
      if (!userId || userId !== ownerId) {
        return res.status(403).json({ success: false, message: "Not allowed" });
      }
      await connection.query(`UPDATE posts SET image_url = ? WHERE id = ?`, [
        image_url,
        postId,
      ]);
      res.json({ success: true, message: "Image updated", image_url });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error("Error updating post image:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Retrieves a paginated list of users who liked a specific post.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const getPostLikes = async (req, res) => {
  try {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const [likes] = await pool.query(
      `
      SELECT 
        pl.user_id,
        COALESCE(u.full_name, u.username, 'User') AS full_name,
        u.username,
        pl.created_at
      FROM post_likes pl
      JOIN adm_users u ON pl.user_id = u.id
      WHERE pl.post_id = ?
      ORDER BY pl.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [postId, limit, offset],
    );

    const mapped = likes.map((l) => ({
      ...l,
      profile_picture_url: l.user_id ? `/api/social-feed/avatar/${l.user_id}` : "/default-avatar.png",
    }));

    res.json({
      success: true,
      data: mapped,
      pagination: { offset, limit, total: mapped.length },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ============================================
// ❤️ LIKE POST
// ============================================

/**
 * Adds a like to a post for the current user.
 * Broadcasts the like event and triggers a notification to the post owner.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const likePost = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const { postId } = req.params;
    const companyId = Number(req.scope?.companyId) || 1;

    // Check if user already liked
    const [existingLike] = await pool.query(
      `SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?`,
      [postId, userId],
    );

    if (existingLike.length === 0) {
      // Add like
      await pool.query(
        `INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)`,
        [postId, userId],
      );

      // Get post info for notifications
      try {
        const [postRows] = await pool.query(
          `SELECT user_id, visibility_type, branch_id FROM posts WHERE id = ?`,
          [postId],
        );
        const postOwnerId = postRows[0]?.user_id;

        if (postOwnerId) {
          try { broadcastLike(postId, userId, postOwnerId); } catch {}
          if (postOwnerId !== userId) {
            try { await triggerLikeNotification(postId, userId, postOwnerId, companyId); } catch {}
          }
        }
      } catch {}
    }

    // Always get true count from post_likes
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM post_likes WHERE post_id = ?`,
      [postId],
    );
    const totalLikes = Number(countRow?.total) || 0;

    // Update posts table cache
    await pool.query(`UPDATE posts SET like_count = ? WHERE id = ?`, [totalLikes, postId]);

    res.json({
      success: true,
      message: "Post liked",
      user_liked: true,
      like_count: totalLikes,
    });
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 💔 UNLIKE POST
// ============================================

/**
 * Removes a like from a post for the current user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const unlikePost = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const { postId } = req.params;

    // Remove like if exists
    await pool.query(
      `DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`,
      [postId, userId],
    );

    // Always get true count from post_likes
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM post_likes WHERE post_id = ?`,
      [postId],
    );
    const totalLikes = Number(countRow?.total) || 0;

    // Update posts table cache
    await pool.query(`UPDATE posts SET like_count = ? WHERE id = ?`, [totalLikes, postId]);

    res.json({
      success: true,
      message: "Post unliked",
      user_liked: false,
      like_count: totalLikes,
    });
  } catch (error) {
    console.error("Error unliking post:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 💬 ADD COMMENT
// ============================================

/**
 * Adds a comment to a post.
 * Broadcasts the comment event and triggers a notification to the post owner.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const addComment = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const { postId } = req.params;
    const { comment_text } = req.body;
    const companyId = Number(req.scope?.companyId) || 1;

    if (!comment_text || comment_text.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Comment text is required" });
    }

    const connection = await pool.getConnection();

    try {
      // Add comment
      const [result] = await connection.query(
        `INSERT INTO post_comments (post_id, user_id, comment_text) VALUES (?, ?, ?)`,
        [postId, userId, comment_text],
      );

      // Increment comment count
      await connection.query(
        `UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?`,
        [postId],
      );

      // Get comment with user info
      const [comment] = await connection.query(
        `
        SELECT 
          pc.*,
          u.full_name,
          u.profile_picture AS profile_picture,
          pc.created_at,
          u.username AS created_by_name
         FROM post_comments pc
        JOIN adm_users u ON pc.user_id = u.id
         WHERE pc.id = ?
        `,
        [result.insertId],
      );

      // Get post info for notifications
      const [postRows] = await connection.query(
        `SELECT p.user_id,
          p.created_at,
          u.username AS created_by_name
         FROM posts p
        LEFT JOIN adm_users u ON u.id = p.user_id
         WHERE p.id = ?`,
        [postId],
      );

      const postOwnerId = postRows[0]?.user_id;

      // 🔔 BROADCAST COMMENT VIA SOCKET.IO
      try {
        const c0 = comment[0] || {};
        const b = c0.profile_picture || null;
        let url = null;
        if (b) {
          const buf = Buffer.isBuffer(b) ? b : Buffer.from(b);
          let mime = "image/jpeg";
          if (
            buf.length >= 3 &&
            buf[0] === 0xff &&
            buf[1] === 0xd8 &&
            buf[2] === 0xff
          ) {
            mime = "image/jpeg";
          } else if (
            buf.length >= 8 &&
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47 &&
            buf[4] === 0x0d &&
            buf[5] === 0x0a &&
            buf[6] === 0x1a &&
            buf[7] === 0x0a
          ) {
            mime = "image/png";
          } else if (
            buf.length >= 12 &&
            buf[0] === 0x52 &&
            buf[1] === 0x49 &&
            buf[2] === 0x46 &&
            buf[3] === 0x46 &&
            buf[8] === 0x57 &&
            buf[9] === 0x45 &&
            buf[10] === 0x42 &&
            buf[11] === 0x50
          ) {
            mime = "image/webp";
          }
          url = `data:${mime};base64,${buf.toString("base64")}`;
        }
        broadcastComment(postId, { ...c0, profile_picture_url: url });
      } catch {}

      // 📧 TRIGGER COMMENT NOTIFICATION
      if (postOwnerId !== userId) {
        try {
          await triggerCommentNotification(
            postId,
            userId,
            postOwnerId,
            companyId,
          );
        } catch {}
      }

      const c0 = comment[0] || {};
      let url = null;
      if (c0.profile_picture) {
        const buf = Buffer.isBuffer(c0.profile_picture)
          ? c0.profile_picture
          : Buffer.from(c0.profile_picture);
        let mime = "image/jpeg";
        if (
          buf.length >= 3 &&
          buf[0] === 0xff &&
          buf[1] === 0xd8 &&
          buf[2] === 0xff
        ) {
          mime = "image/jpeg";
        } else if (
          buf.length >= 8 &&
          buf[0] === 0x89 &&
          buf[1] === 0x50 &&
          buf[2] === 0x4e &&
          buf[3] === 0x47 &&
          buf[4] === 0x0d &&
          buf[5] === 0x0a &&
          buf[6] === 0x1a &&
          buf[7] === 0x0a
        ) {
          mime = "image/png";
        } else if (
          buf.length >= 12 &&
          buf[0] === 0x52 &&
          buf[1] === 0x49 &&
          buf[2] === 0x46 &&
          buf[3] === 0x46 &&
          buf[8] === 0x57 &&
          buf[9] === 0x45 &&
          buf[10] === 0x42 &&
          buf[11] === 0x50
        ) {
          mime = "image/webp";
        }
        url = `data:${mime};base64,${buf.toString("base64")}`;
      }
      const { profile_picture: cPic, ...cleanC0 } = c0;
      res.status(201).json({
        success: true,
        message: "Comment added",
        data: { ...cleanC0, profile_picture_url: url },
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 🔔 SOCKET.IO BROADCAST FUNCTIONS
// ============================================

/**
 * Broadcasts a new post event to connected clients in the appropriate room (company or warehouse).
 *
 * @param {object} post - The newly created post object.
 * @param {string} visibility_type - The visibility scope ('company' or 'branch').
 * @param {number|null} branchId - The warehouse ID if visibility is 'branch'.
 */
const broadcastNewPost = (post, visibility_type, branchId) => {
  try {
    const io = getIO();

    if (visibility_type === "company") {
      io.to("company").emit("new_post", post);
    } else if (visibility_type === "branch") {
      io.to(`warehouse_${branchId}`).emit("new_post", post);
    }
  } catch (error) {
    console.error("Error broadcasting new post:", error);
  }
};

/**
 * Broadcasts a like event to the post owner.
 *
 * @param {number|string} postId - The ID of the liked post.
 * @param {number} userId - The ID of the user who liked the post.
 * @param {number} postOwnerId - The ID of the post owner.
 */
const broadcastLike = (postId, userId, postOwnerId) => {
  try {
    const io = getIO();
    io.to(`user_${postOwnerId}`).emit("post_liked", {
      postId,
      likedBy: userId,
    });
  } catch (error) {
    console.error("Error broadcasting like:", error);
  }
};

/**
 * Broadcasts a comment event to the post's room.
 *
 * @param {number|string} postId - The ID of the commented post.
 * @param {object} comment - The new comment object.
 */
const broadcastComment = (postId, comment) => {
  try {
    const io = getIO();
    io.to(`post_${postId}`).emit("post_commented", {
      postId,
      comment,
    });
  } catch (error) {
    console.error("Error broadcasting comment:", error);
  }
};

// ============================================
// 📧 NOTIFICATION FUNCTIONS
// ============================================

/**
 * Triggers in-app and push notifications for a new post, targeting the appropriate audience.
 *
 * @param {number|string} postId - The ID of the new post.
 * @param {number} userId - The ID of the user who created the post.
 * @param {string} type - The type of notification (e.g., 'post_created').
 * @param {string} visibility_type - The visibility scope ('company' or 'branch').
 * @param {number|null} branchId - The warehouse ID if visibility is 'branch'.
 * @param {number} companyId - The company ID.
 */
const triggerPostNotifications = async (
  postId,
  userId,
  type,
  visibility_type,
  branchId,
  companyId = 1,
) => {
  const connection = await pool.getConnection();

  try {
    const [userRows] = await connection.query(
      `SELECT adm_users.full_name,
          adm_users.created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = adm_users.created_by
         WHERE adm_users.id = ?`,
      [userId],
    );
    const userName = userRows[0]?.full_name || "User";

    let targetUsers = [];

    if (visibility_type === "company") {
      // Notify all users except poster
      const [allUsers] = await connection.query(
        `SELECT adm_users.id,
          adm_users.created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = adm_users.created_by
         WHERE adm_users.id != ?`,
        [userId],
      );
      targetUsers = allUsers.map((u) => u.id);
    } else if (visibility_type === "branch") {
      // Notify warehouse users except poster
      const [warehouseUsers] = await connection.query(
        `SELECT adm_users.id,
          adm_users.created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = adm_users.created_by
         WHERE adm_users.branch_id = ? AND adm_users.id != ?`,
        [branchId, userId],
      );
      targetUsers = warehouseUsers.map((u) => u.id);
    }

    // Insert notifications and send push notifications
    for (const targetUserId of targetUsers) {
      try {
        await connection.query(
          `
          INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
          VALUES (?, ?, ?, ?, ?, 0)
          `,
          [
            companyId,
            targetUserId,
            `New post from ${userName}`,
            `${userName} posted a new update`,
            `/social-feed/${postId}`,
          ],
        );
      } catch {}

      // Send push notification
      try {
        await sendPushToUser(targetUserId, {
          title: `New post from ${userName}`,
          body: `${userName} posted a new update`,
          icon: "/logo.png",
          badge: "/badge.png",
          tag: "social-post",
          data: {
            url: `/social-feed/${postId}`,
            type: "post",
            postId,
          },
        });
      } catch (pushError) {
        console.error(
          `Failed to send push notification to user ${targetUserId}:`,
          pushError,
        );
      }
    }
  } catch (error) {
    console.error("Error triggering post notifications:", error);
  } finally {
    await connection.release();
  }
};

/**
 * Triggers an in-app and push notification to the post owner when their post is liked.
 *
 * @param {number|string} postId - The ID of the liked post.
 * @param {number} userId - The ID of the user who liked the post.
 * @param {number} postOwnerId - The ID of the post owner.
 * @param {number} companyId - The company ID.
 */
const triggerLikeNotification = async (
  postId,
  userId,
  postOwnerId,
  companyId = 1,
) => {
  const connection = await pool.getConnection();

  try {
    const [userRows] = await connection.query(
      `SELECT full_name,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = ?`,
      [userId],
    );
    const userName = userRows[0]?.full_name || "User";

    try {
      await connection.query(
        `
        INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
        VALUES (?, ?, ?, ?, ?, 0)
        `,
        [
          companyId,
          postOwnerId,
          `${userName} liked your post`,
          `${userName} liked your post`,
          `/social-feed/${postId}`,
        ],
      );
    } catch {}

    // Send push notification to post owner
    try {
      await sendPushToUser(postOwnerId, {
        title: `${userName} liked your post`,
        body: "Your post received a like",
        icon: "/logo.png",
        badge: "/badge.png",
        tag: "post-like",
        data: {
          url: `/social-feed/${postId}`,
          type: "like",
          postId,
        },
      });
    } catch (pushError) {
      console.error(
        `Failed to send push notification to user ${postOwnerId}:`,
        pushError,
      );
    }
  } catch (error) {
    console.error("Error triggering like notification:", error);
  } finally {
    await connection.release();
  }
};

/**
 * Triggers an in-app and push notification to the post owner when their post is commented on.
 *
 * @param {number|string} postId - The ID of the commented post.
 * @param {number} userId - The ID of the user who commented on the post.
 * @param {number} postOwnerId - The ID of the post owner.
 * @param {number} companyId - The company ID.
 */
const triggerCommentNotification = async (
  postId,
  userId,
  postOwnerId,
  companyId = 1,
) => {
  const connection = await pool.getConnection();

  try {
    const [userRows] = await connection.query(
      `SELECT full_name,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = ?`,
      [userId],
    );
    const userName = userRows[0]?.full_name || "User";

    try {
      await connection.query(
        `
        INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
        VALUES (?, ?, ?, ?, ?, 0)
        `,
        [
          companyId,
          postOwnerId,
          `${userName} commented on your post`,
          `${userName} commented on your post`,
          `/social-feed/${postId}`,
        ],
      );
    } catch {}

    // Send push notification to post owner
    try {
      await sendPushToUser(postOwnerId, {
        title: `${userName} commented on your post`,
        body: "Your post received a new comment",
        icon: "/logo.png",
        badge: "/badge.png",
        tag: "post-comment",
        data: {
          url: `/social-feed/${postId}`,
          type: "comment",
          postId,
        },
      });
    } catch (pushError) {
      console.error(
        `Failed to send push notification to user ${postOwnerId}:`,
        pushError,
      );
    }
  } catch (error) {
    console.error("Error triggering comment notification:", error);
  } finally {
    await connection.release();
  }
};

// ============================================
// 🗑️ DELETE POST
// ============================================

/**
 * Deletes a post created by the current user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const deletePost = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const connection = await pool.getConnection();

    try {
      // Check if post exists and belongs to user
      const [postRows] = await connection.query(
        `SELECT id, user_id FROM posts WHERE id = ?`,
        [postId],
      );

      if (postRows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }

      // Delete related records (post_likes, post_comments)
      await connection.query(`DELETE FROM post_likes WHERE post_id = ?`, [postId]);
      await connection.query(`DELETE FROM post_comments WHERE post_id = ?`, [postId]);

      // Delete the post
      await connection.query(`DELETE FROM posts WHERE id = ?`, [postId]);

      res.json({ success: true, message: "Post deleted successfully" });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Serves the user avatar as a binary image response with HTTP caching.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const getAvatar = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) return res.redirect("/default-avatar.png");
    const [rows] = await pool.query("SELECT profile_picture FROM adm_users WHERE id = ?", [userId]);
    const blob = rows?.[0]?.profile_picture;
    if (!blob) return res.redirect("/default-avatar.png");
    const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
    if (!b.length) return res.redirect("/default-avatar.png");

    let mime = "image/jpeg";
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
      mime = "image/jpeg";
    } else if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      mime = "image/png";
    } else if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
      mime = "image/webp";
    }
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type(mime).send(b);
  } catch {
    res.redirect("/default-avatar.png");
  }
};

