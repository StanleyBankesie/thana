import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { query } from "../db/pool.js";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { httpError } from "../utils/httpError.js";
import { io as ioInstance } from "../index.js";
import { isUserOnline } from "../utils/socket.js";
import { sendPushToUser } from "./push.routes.js";

const router = express.Router();

async function ensureChatTables() {
  // Phase 1: Clean rebuild if legacy schema detected
  try {
    const legacyCol = await query(`
      SELECT COUNT(*) AS c
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'chat_messages'
        AND column_name = 'sender_user_id'
      `).catch(() => []);
    const isLegacy =
      Array.isArray(legacyCol) && Number(legacyCol[0]?.c || 0) > 0;
    if (isLegacy) {
      try {
        await query("DROP TABLE IF EXISTS chat_message_status");
      } catch {}
      try {
        await query("DROP TABLE IF EXISTS chat_deleted_messages");
      } catch {}
      try {
        await query("DROP TABLE IF EXISTS chat_attachments");
      } catch {}
      try {
        await query("DROP TABLE IF EXISTS chat_participants");
      } catch {}
      try {
        await query("DROP TABLE IF EXISTS chat_messages");
      } catch {}
      try {
        await query("DROP TABLE IF EXISTS chat_conversations");
      } catch {}
    }
  } catch {}
  await query(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(255) NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_conversation_participants (
      conversation_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      last_read_message_id BIGINT UNSIGNED NULL,
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id),
      KEY idx_user (user_id),
      CONSTRAINT fk_ccp_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      conversation_id BIGINT UNSIGNED NOT NULL,
      sender_id BIGINT UNSIGNED NOT NULL,
      message_type ENUM('text','image','video','audio','document','contact','location') NOT NULL DEFAULT 'text',
      content LONGTEXT NULL,
      status ENUM('sent','delivered','read') NOT NULL DEFAULT 'sent',
      sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivered_at DATETIME NULL,
      read_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_conv (conversation_id),
      KEY idx_conv_sent (conversation_id, sent_at),
      CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  // Upgrade columns/enums to support media and receiver
  try {
    const cols = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'chat_messages'
      `);
    const names = new Set(cols.map((r) => r.column_name));
    if (!names.has("receiver_id")) {
      await query(
        "ALTER TABLE chat_messages ADD COLUMN receiver_id BIGINT UNSIGNED NULL AFTER sender_id",
      ).catch(() => null);
    }
    if (!names.has("file_name")) {
      await query(
        "ALTER TABLE chat_messages ADD COLUMN file_name VARCHAR(255) NULL AFTER content",
      ).catch(() => null);
    }
    if (!names.has("file_size")) {
      await query(
        "ALTER TABLE chat_messages ADD COLUMN file_size BIGINT UNSIGNED NULL AFTER file_name",
      ).catch(() => null);
    }
    await query(
      "ALTER TABLE chat_messages MODIFY COLUMN message_type ENUM('text','image','video','audio','document','contact','location') NOT NULL DEFAULT 'text'",
    ).catch(() => null);
  } catch {}
}

async function ensurePresenceTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS chat_presence (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      is_online TINYINT(1) NOT NULL DEFAULT 0,
      last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
}

function inRoom(io, room) {
  try {
    const s = io?.sockets?.adapter?.rooms?.get?.(room);
    return (s && s.size > 0) || false;
  } catch {
    return false;
  }
}

router.use(requireAuth, requireCompanyScope, requireBranchScope);

// ===== USERS FOR RECIPIENT SELECTION =====
// GET /users - Fetch available users to start a chat with, includes online presence
router.get("/users", async (req, res, next) => {
  try {
    await ensurePresenceTable();
    const me = Number(req.user?.sub || req.user?.id);
    const q = String(req.query?.q || "").trim();
    const params = { me };
    let where = "id <> :me";
    if (q) {
      where += " AND (username LIKE :q OR full_name LIKE :q)";
      params.q = `%${q}%`;
    }
    const users =
      (await query(
        `
        SELECT adm_users.id, adm_users.username, adm_users.full_name,
          IF(adm_users.profile_picture IS NULL, NULL, IF(LEFT(adm_users.profile_picture, 4) = 'http' OR LEFT(adm_users.profile_picture, 5) = 'data:', CONVERT(adm_users.profile_picture USING utf8), CONCAT('data:image/jpeg;base64,', REPLACE(TO_BASE64(adm_users.profile_picture), '\\n', '')))) AS profile_picture_url,
          adm_users.created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = adm_users.created_by
         WHERE ${where}
        ORDER BY adm_users.username ASC
        `,
        params,
      ).catch(() => [])) || [];
    const ids = users
      .map((u) => Number(u.id))
      .filter((n) => Number.isFinite(n));
    let pres = [];
    if (ids.length) {
      const placeholders = ids.map((_, i) => `:p${i}`).join(",");
      const p = {};
      ids.forEach((v, i) => (p[`p${i}`] = v));
      pres =
        (await query(
          `SELECT user_id, is_online, last_seen,
          created_at,
          u.username AS created_by_name
         FROM chat_presence
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id IN (${placeholders})`,
          p,
        ).catch(() => [])) || [];
    }
    const map = new Map(pres.map((r) => [Number(r.user_id), r]));
    res.json({
      items: users.map((u) => {
        const pr = map.get(Number(u.id));
        return {
          id: u.id,
          username: u.username,
          full_name: u.full_name,
          is_online: pr ? Number(pr.is_online) === 1 : false,
          last_seen: pr?.last_seen || null,
          profile_picture_url: u.profile_picture_url || null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// ===== CONVERSATION MANAGEMENT =====
// GET /conversations - Fetch a list of active conversations for the current user
router.get("/conversations", async (req, res, next) => {
  try {
    await ensureChatTables();
    const me = Number(req.user?.sub || req.user?.id);
    const companyId = req.scope.companyId;
    const rows = await query(
      `
      SELECT c.id,
             c.title,
             (SELECT m.content,
          m.created_at,
          u.username AS created_by_name
         FROM chat_messages m
        LEFT JOIN adm_users u ON u.id = m.created_by
         WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_preview,
             (SELECT m.sent_at FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_time,
             (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id AND m.id > COALESCE(p.last_read_message_id,0)) AS unread_count
      FROM chat_conversations c
      JOIN chat_conversation_participants p
        ON p.conversation_id = c.id AND p.user_id = :me
      WHERE c.company_id = :companyId
      ORDER BY (CASE WHEN last_time IS NULL THEN 1 ELSE 0 END), last_time DESC, c.id DESC
      `,
      { me, companyId },
    );
    res.json({ items: rows || [] });
  } catch (err) {
    next(err);
  }
});

// POST /conversations/direct - Create or retrieve an existing direct conversation with another user
router.post("/conversations/direct", async (req, res, next) => {
  try {
    await ensureChatTables();
    const me = Number(req.user?.sub || req.user?.id);
    const companyId = req.scope.companyId;
    const otherId = Number(req.body?.user_id);
    if (!Number.isFinite(otherId) || otherId <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid user_id");
    // Reuse existing direct conversation if exists
    const existing = await query(
      `
      SELECT c.id,
          c.created_at,
          u.username AS created_by_name
         FROM chat_conversations c
      JOIN chat_conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = :me
      JOIN chat_conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = :otherId
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId
      LIMIT 1
      `,
      { companyId, me, otherId },
    );
    if (existing.length) return res.json({ id: existing[0].id });
    const ins = await query(
      `
      INSERT INTO chat_conversations (company_id, title, created_by)
      VALUES (:companyId, NULL, :me)
      `,
      { companyId, me },
    );
    const cid = ins.insertId;
    await query(
      `INSERT INTO chat_conversation_participants (conversation_id, user_id) VALUES (:cid, :me), (:cid, :other)`,
      { cid, me, other: otherId },
    );
    res.status(201).json({ id: cid });
  } catch (err) {
    next(err);
  }
});

// ===== MESSAGE MANAGEMENT =====
// GET /conversations/:id/messages - Fetch all messages within a specific conversation
router.get("/conversations/:id/messages", async (req, res, next) => {
  try {
    await ensureChatTables();
    const me = Number(req.user?.sub || req.user?.id);
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const isParticipant = await query(
      `SELECT 1,
          created_at,
          u.username AS created_by_name
         FROM chat_conversation_participants
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE conversation_id = :id AND user_id = :me LIMIT 1`,
      { id, me },
    );
    if (!isParticipant.length)
      throw httpError(403, "FORBIDDEN", "Not a participant");
    const rows = await query(
      `
      SELECT m.*,
          m.created_at,
          u.username AS created_by_name
         FROM chat_messages m
        LEFT JOIN adm_users u ON u.id = m.created_by
         WHERE m.conversation_id = :id
      ORDER BY m.id ASC
      `,
      { id },
    );
    res.json({ items: rows || [] });
  } catch (err) {
    next(err);
  }
});

// POST /messages - Send a text or media message to a conversation
router.post("/messages", async (req, res, next) => {
  try {
    await ensureChatTables();
    const me = Number(req.user?.sub || req.user?.id);
    const {
      conversation_id,
      content,
      message_type = "text",
      file_name = null,
      file_size = null,
    } = req.body || {};
    const cid = Number(conversation_id);
    const type = String(message_type || "text").toLowerCase();
    const isMedia = type !== "text";
    if (!Number.isFinite(cid))
      throw httpError(400, "VALIDATION_ERROR", "Invalid conversation_id");
    if (!isMedia && !String(content || "").trim())
      throw httpError(400, "VALIDATION_ERROR", "content required for text");
    const auth = await query(
      `SELECT 1,
          created_at,
          u.username AS created_by_name
         FROM chat_conversation_participants
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE conversation_id = :cid AND user_id = :me LIMIT 1`,
      { cid, me },
    );
    if (!auth.length) throw httpError(403, "FORBIDDEN", "Not a participant");
    // Resolve receiver for direct chat
    const others =
      (await query(
        `SELECT user_id,
          created_at,
          u.username AS created_by_name
         FROM chat_conversation_participants
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE conversation_id = :cid AND user_id <> :me LIMIT 2`,
        { cid, me },
      ).catch(() => [])) || [];
    const receiverId = Number(others?.[0]?.user_id || 0) || null;
    const ins = await query(
      `
      INSERT INTO chat_messages (conversation_id, sender_id, receiver_id, message_type, content, file_name, file_size, status, sent_at)
      VALUES (:cid, :me, :receiverId, :type, :content, :file_name, :file_size, 'sent', NOW())
      `,
      {
        cid,
        me,
        receiverId,
        type,
        content: isMedia ? String(content || "") : String(content).trim(),
        file_name: file_name || null,
        file_size: file_size == null ? null : Number(file_size),
      },
    );
    const mid = ins.insertId;
    const io = ioInstance;
    if (io) {
      io.to(`conv_${cid}`).emit("receive_message", {
        id: mid,
        conversation_id: cid,
        sender_id: me,
        receiver_id: receiverId,
        message_type: type,
        content: String(content || ""),
        file_name: file_name || null,
        file_size: file_size == null ? null : Number(file_size),
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    }
    // Resolve participants (excluding sender)
    const participants = await query(
      `SELECT user_id,
          created_at,
          u.username AS created_by_name
         FROM chat_conversation_participants
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE conversation_id = :cid AND user_id <> :me`,
      { cid, me },
    );
    const otherIds = participants
      .map((r) => Number(r.user_id))
      .filter((n) => Number.isFinite(n));
    // If receiver not in room, set delivered later when they connect and send push
    let delivered = false;
    if (receiverId && isUserOnline && await isUserOnline(receiverId)) {
      await query(
        `UPDATE chat_messages SET status = 'delivered', delivered_at = NOW() WHERE id = :id`,
        { id: mid },
      ).catch(() => null);
      delivered = true;
      if (io)
        io.to(`conv_${cid}`).emit("message_delivered", { message_id: mid });
    }
    if (!delivered) {
      // Trigger existing push + notification row
      const senderNameRows = await query(
        `SELECT full_name AS name, username,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id LIMIT 1`,
        { id: me },
      ).catch(() => []);
      const title =
        senderNameRows?.[0]?.name ||
        senderNameRows?.[0]?.username ||
        "New message";
      const preview = String(content || "").slice(0, 140);
      for (const uid of otherIds) {
        try {
          await query(
            `
            INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
            VALUES (:companyId, :userId, :title, :message, :link, 0)
            `,
            {
              companyId: req.scope.companyId,
              userId: uid,
              title: `${title}`,
              message: preview,
              link: `/chat?cid=${cid}`,
            },
          ).catch(() => null);
          await sendPushToUser(uid, {
            title: `${title}`,
            body: preview || "New message",
            icon: "/logo.png",
            badge: "/badge.png",
            tag: "chat-message",
            data: { url: `/chat?cid=${cid}`, type: "chat", cid },
          });
        } catch {}
      }
    }
    res.status(201).json({ id: mid });
  } catch (err) {
    next(err);
  }
});

// ===== MESSAGE STATUS UPDATES =====
// POST /messages/:id/delivered - Mark a specific message as delivered
router.post("/messages/:id/delivered", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw httpError(400, "VALIDATION_ERROR");
    await query(
      `UPDATE chat_messages SET status = 'delivered', delivered_at = NOW() WHERE id = :id AND status = 'sent'`,
      { id },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /conversations/:id/read - Mark all unread messages in a conversation as read
router.post("/conversations/:id/read", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw httpError(400, "VALIDATION_ERROR");
    // Find last message id in conversation
    const rows = await query(
      `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM chat_messages
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE conversation_id = :id ORDER BY id DESC LIMIT 1`,
      { id },
    );
    const lastId = Number(rows?.[0]?.id || 0) || null;
    if (lastId) {
      await query(
        `UPDATE chat_conversation_participants SET last_read_message_id = :lastId WHERE conversation_id = :id AND user_id = :me`,
        { lastId, id, me },
      );
      await query(
        `UPDATE chat_messages 
         SET status = 'read', read_at = NOW() 
         WHERE conversation_id = :id 
           AND id <= :lastId
           AND receiver_id = :me
           AND status <> 'read'`,
        { id, lastId, me },
      );
      const io = ioInstance;
      if (io)
        io.to(`conv_${id}`).emit("message_read", {
          conversation_id: id,
          user_id: me,
          last_read_id: lastId,
        });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ===== UNREAD COUNTS =====
// GET /unread-count - Get total aggregate unread message count for current user
router.get("/unread-count", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const rows = await query(
      `SELECT SUM(unread) AS total FROM (
        SELECT COUNT(*) AS unread
        FROM chat_conversations c
        JOIN chat_conversation_participants p
          ON p.conversation_id = c.id AND p.user_id = :me
        JOIN chat_messages m
          ON m.conversation_id = c.id
        WHERE m.id > COALESCE(p.last_read_message_id, 0)
          AND m.sender_id <> :me
      ) t`,
      { me },
    );
    res.json({ unread: Number(rows?.[0]?.total || 0) });
  } catch (err) {
    next(err);
  }
});

// GET /unread-by-user - Get unread message breakdown grouped by sender user id
router.get("/unread-by-user", async (req, res, next) => {
  try {
    const me = Number(req.user?.sub || req.user?.id);
    const rows = await query(
      `
      SELECT m.sender_id AS user_id, COUNT(*) AS unread,
          c.created_at,
          u.username AS created_by_name
         FROM chat_conversations c
      JOIN chat_conversation_participants p
        ON p.conversation_id = c.id AND p.user_id = :me
      JOIN chat_messages m
        ON m.conversation_id = c.id
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE m.id > COALESCE(p.last_read_message_id, 0)
        AND m.sender_id <> :me
      GROUP BY m.sender_id
      `,
      { me },
    );
    res.json({
      items: rows.map((r) => ({
        user_id: Number(r.user_id),
        unread: Number(r.unread || 0),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ===== MEDIA UPLOAD =====
// Setup media upload directory and storage for chat attachments
const chatUploadDir = path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(chatUploadDir))
    fs.mkdirSync(chatUploadDir, { recursive: true });
} catch {}
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, chatUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `chat-${unique}${ext}`);
  },
});
const allowedMimes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
]);
function chatFileFilter(req, file, cb) {
  if (
    allowedMimes.has(file.mimetype) ||
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/") ||
    file.mimetype.startsWith("audio/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
}
const chatUpload = multer({
  storage: chatStorage,
  fileFilter: chatFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});
// POST /upload - Upload a media file for chat attachment
router.post("/upload", chatUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const filePath = `/uploads/${req.file.filename}`;
    const origin = `${req.protocol}://${req.get("host")}`;
    res.json({
      path: filePath,
      url: `${origin}${filePath}`,
      file_name: req.file.originalname || req.file.filename,
      file_size: req.file.size,
      mime: req.file.mimetype,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
