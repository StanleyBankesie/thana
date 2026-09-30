/**
 * @file socket.js
 * @description Configures and manages Socket.IO for real-time bidirectional event-based communication.
 * Uses Redis adapter for multi-instance support when available.
 */
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { query } from "../db/pool.js";
import {
  lookupGraceToken,
  verifyAccessToken,
} from "../services/token.service.js";
import { getRedis } from "./redis.js";

// Maintain a global singleton instance of the Socket server
let ioInstance = null;
// Track active online users — use Redis when available, fallback to in-memory
let onlineUsers = new Set();
let useRedisPresence = false;

/**
 * Initializes the Socket.IO server and binds it to the provided HTTP server.
 * Uses Redis adapter when available for multi-instance support.
 *
 * @param {import('http').Server} server - The Node.js HTTP server instance.
 * @returns {import('socket.io').Server} The initialized Socket.IO server.
 */
export const initializeSocket = (server) => {
  // Boot and configure Socket.IO on top of the HTTP server
  ioInstance = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    maxHttpBufferSize: 1e6,
    transports: ["websocket", "polling"],
  });

  // Attach Redis adapter if available
  (async () => {
    try {
      const redis = getRedis();
      if (!redis) return;
      const subClient = redis.duplicate();
      const pubClient = redis.duplicate();
      await Promise.all([
        new Promise((resolve, reject) => {
          subClient.on("connect", resolve);
          subClient.on("error", reject);
        }),
        new Promise((resolve, reject) => {
          pubClient.on("connect", resolve);
          pubClient.on("error", reject);
        }),
      ]);
      ioInstance.adapter(createAdapter(pubClient, subClient));
      useRedisPresence = true;
      console.log("[Socket] Redis adapter attached — multi-instance mode enabled");
    } catch (err) {
      useRedisPresence = false;
      console.log("[Socket] Redis adapter unavailable, using in-memory presence:", err?.message || err);
    }
  })();

  ioInstance.use(async (socket, next) => {
    try {
      const { parseCookieHeader } = await import("../services/token.service.js");
      const cookies = parseCookieHeader(socket.handshake.headers.cookie || "");
      const sessionId = cookies.omnisuite_session;

      if (sessionId) {
        try {
          const { cacheGet } = await import("./redis.js");
          const sessionData = await cacheGet(`omnisuite_session:${sessionId}`);
          if (sessionData?.user) {
            socket.user = sessionData.user;
            return next();
          }
        } catch (e) {}
      }

      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.auth?.accessToken ||
        socket.handshake.query?.accessToken ||
        socket.handshake.headers?.authorization ||
        "";
      const bearerToken = String(rawToken || "").startsWith("Bearer ")
        ? String(rawToken).slice(7).trim()
        : String(rawToken || "").trim();

      if (bearerToken) {
        try {
          socket.user = verifyAccessToken(bearerToken);
          return next();
        } catch {
          const gracePayload = await lookupGraceToken(bearerToken);
          if (gracePayload) {
            socket.user = gracePayload;
            return next();
          }
        }
      }

      // Fallback: If query userId is present, allow connection as user
      const queryUserId = socket.handshake.query?.userId;
      if (queryUserId) {
        socket.user = { id: Number(queryUserId), sub: Number(queryUserId) };
        return next();
      }

      next();
    } catch (error) {
      console.error("Socket.io auth error:", error);
      next();
    }
  });

  ioInstance.on("connection", (socket) => {
    const userId = socket.user?.sub || socket.user?.id || socket.handshake.query.userId;
    const warehouseId = socket.handshake.query.warehouseId;

    console.log(`✅ User ${userId} connected to socket`);
    if (userId) {
      // Add to presence set (Redis or in-memory)
      if (useRedisPresence) {
        try {
          getRedis()?.sadd("sm:online_users", String(userId)).catch(() => {});
        } catch {}
      } else {
        onlineUsers.add(String(userId));
      }
      ioInstance.to(`user_${userId}`).emit("presence:update", { online: true });
      (async () => {
        try {
          await query(
            `INSERT INTO chat_presence (user_id, is_online, last_seen)
             VALUES (:uid, 1, NOW())
             ON DUPLICATE KEY UPDATE is_online = 1, last_seen = NOW()`,
            { uid: Number(userId) },
          );
          ioInstance.emit("chat2:presence", {
            user_id: Number(userId),
            is_online: true,
            last_seen: new Date().toISOString(),
          });
        } catch {}
      })();
    }

    socket.join(`user_${userId}`);
    if (warehouseId) {
      socket.join(`warehouse_${warehouseId}`);
    }
    socket.join("company");

    socket.on("viewing_post", (postId) => {
      socket.join(`post_${postId}`);
    });

    socket.on("stop_viewing_post", (postId) => {
      socket.leave(`post_${postId}`);
    });

    // Tracking Events
    socket.on("tracking:location_updated", (data) => {
      ioInstance.emit("tracking:location_updated", data);
    });
    socket.on("tracking:trip_started", (data) => {
      ioInstance.emit("tracking:trip_started", data);
    });
    socket.on("tracking:trip_paused", (data) => {
      ioInstance.emit("tracking:trip_paused", data);
    });
    socket.on("tracking:trip_resumed", (data) => {
      ioInstance.emit("tracking:trip_resumed", data);
    });
    socket.on("tracking:trip_completed", (data) => {
      ioInstance.emit("tracking:trip_completed", data);
    });
    socket.on("tracking:emergency", (data) => {
      ioInstance.emit("tracking:emergency", data);
    });

    socket.on("error", (error) => {
      console.error(`⚠️ Socket error for User ${userId}:`, error);
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ User ${userId} disconnected - Reason: ${reason}`);
      if (userId) {
        if (useRedisPresence) {
          try {
            getRedis()?.srem("sm:online_users", String(userId)).catch(() => {});
          } catch {}
        } else {
          onlineUsers.delete(String(userId));
        }
        ioInstance.to(`user_${userId}`).emit("presence:update", {
          online: false,
        });
        (async () => {
          try {
            await query(
              `UPDATE chat_presence
                  SET is_online = 0, last_seen = NOW()
                WHERE user_id = :uid`,
              { uid: Number(userId) },
            );
            ioInstance.emit("chat2:presence", {
              user_id: Number(userId),
              is_online: false,
              last_seen: new Date().toISOString(),
            });
          } catch {}
        })();
      }
    });
  });

  return ioInstance;
};

/**
 * Returns the current Socket.IO server instance.
 * @returns {import('socket.io').Server|null}
 */
export const getIO = () => {
  if (!ioInstance) {
    console.warn("⚠️ Warning: Attempted to access Socket.IO before initialization.");
  }
  return ioInstance;
};

export const getOnlineUsers = () => {
  return Array.from(onlineUsers);
};

export const isUserOnline = (userId) => {
  if (!userId) return false;
  return onlineUsers.has(String(userId));
};
