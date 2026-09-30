import { Router } from "express";
import {
  getPosts,
  createPost,
  deletePost,
  likePost,
  unlikePost,
  addComment,
  getPostById,
  getPostComments,
  getPostLikes,
  updatePostImage,
  getAvatar,
} from "../controllers/social-feed.controller.js";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

// Public avatar streaming route for <img> tags with browser caching
router.get("/avatar/:userId", getAvatar);

// All other feed routes require authentication and scope
router.use(requireAuth, requireCompanyScope, requireBranchScope);

// ============================================
// 📌 POSTS
// ============================================

// Get posts with visibility filtering
// Retrieves a list of posts suitable for the current user's feed.
router.get("/", getPosts);

// Get single post by id (with all comments)
// Fetches the full content of a specific post including author details and comments.
router.get("/:postId", getPostById);

router.get("/:postId/comments", getPostComments);
router.get("/:postId/likes", getPostLikes);

// Create post
// Adds a new post to the social feed.
router.post("/", createPost);

// Delete post
router.delete("/:postId", deletePost);

// Update post image
// Modifies or adds an image to an existing post.
router.put("/:postId/image", updatePostImage);

// ============================================
// ❤️ LIKES
// ============================================

// Like post
// Increments the like count and logs the user's like action for a post.
router.post("/:postId/like", likePost);

// Unlike post
// Removes the user's like from a post.
router.delete("/:postId/like", unlikePost);

// ============================================
// 💬 COMMENTS
// ============================================

// Add comment to post
// Submits a new comment on a specific post.
router.post("/:postId/comments", addComment);

export default router;
