/**
 * @file redis.js
 * @description Redis client singleton with connection management, caching helpers, and graceful shutdown.
 *
 * KEY DESIGN DECISIONS:
 * - lazyConnect is NOT used. ioredis connects immediately on client creation.
 * - enableOfflineQueue is NOT disabled. ioredis will queue commands issued before
 *   the connection is ready and flush them once connected. This prevents the
 *   startup split-brain where login writes to MySQL but auth middleware reads from
 *   Redis (now connected), finding nothing.
 * - The MySQL sys_sessions fallback is used ONLY when REDIS_URL is not configured,
 *   not when Redis is transiently connecting.
 */
import Redis from "ioredis";
import "../utils/loadServerEnv.js";

const REDIS_URL = String(process.env.REDIS_URL || "").trim();
const REDIS_TLS = String(process.env.REDIS_TLS || "").toLowerCase() === "true";
const REDIS_KEY_PREFIX = String(process.env.REDIS_KEY_PREFIX || "sm:").trim();

import { query } from "../db/pool.js";

let client = null;
let rawClient = null;
let connectionFailed = false;

function createClient() {
  if (!REDIS_URL) {
    console.warn("[Redis] REDIS_URL not set — Redis features disabled, falling back to DB session store");
    return null;
  }

  const opts = {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) {
        console.error("[Redis] Max reconnection attempts reached — Redis unavailable");
        connectionFailed = true;
        return null; // stop retrying
      }
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    keyPrefix: REDIS_KEY_PREFIX,
    // NOTE: lazyConnect is intentionally omitted (defaults to false).
    // ioredis will connect immediately when the client is created.
    // NOTE: enableOfflineQueue is intentionally omitted (defaults to true).
    // Commands issued before the connection is ready will be queued and
    // replayed once the connection is established. This eliminates the
    // startup race condition where a cacheSet during login falls back to
    // MySQL while the subsequent cacheGet reads from Redis (now connected).
    commandTimeout: 5000,
  };

  if (REDIS_TLS) {
    opts.tls = {};
  }

  const c = new Redis(REDIS_URL, opts);

  c.on("connect", () => {
    connectionFailed = false;
    console.log("[Redis] TCP connection established, waiting for ready...");
  });

  c.on("ready", () => {
    connectionFailed = false;
    console.log("[Redis] Connected and ready — key prefix:", REDIS_KEY_PREFIX);
  });

  c.on("error", (err) => {
    if (!connectionFailed) {
      console.error("[Redis] Connection error:", err.message);
      connectionFailed = true;
    }
  });

  c.on("reconnecting", (delay) => {
    console.warn(`[Redis] Reconnecting in ${delay}ms...`);
  });

  c.on("close", () => {
    // ioredis auto-reconnects unless we explicitly call disconnect
  });

  c.on("end", () => {
    console.warn("[Redis] Connection ended permanently");
    connectionFailed = true;
  });

  return c;
}

export function getRedis() {
  if (!REDIS_URL) return null;
  if (!client) {
    client = createClient();
  }
  return client;
}

/**
 * Returns a prefix-free ioredis client suitable for BullMQ.
 * BullMQ manages its own key namespacing and does not tolerate ioredis keyPrefix.
 */
export function getRawRedis() {
  if (!REDIS_URL) return null;
  if (!rawClient) {
    const opts = {
      maxRetriesPerRequest: null, // BullMQ requires null here
      retryStrategy(times) {
        if (times > 10) return null;
        return Math.min(times * 200, 5000);
      },
    };
    if (REDIS_TLS) opts.tls = {};
    rawClient = new Redis(REDIS_URL, opts);
    rawClient.on("error", (err) => {
      console.error("[Redis/BullMQ] Connection error:", err.message);
    });
    rawClient.on("ready", () => {
      console.log("[Redis/BullMQ] Connected and ready");
    });
  }
  return rawClient;
}

export async function closeRedis() {
  if (client) {
    try { await client.quit(); } catch {}
    client = null;
  }
  if (rawClient) {
    try { await rawClient.quit(); } catch {}
    rawClient = null;
  }
}

// ─── Cache Helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if Redis is configured (REDIS_URL is set).
 * Does NOT check connection status — see design note at top of file.
 */
function isRedisConfigured() {
  return Boolean(REDIS_URL);
}

/**
 * Get a cached value by key. Returns parsed JSON or null.
 *
 * Falls back to MySQL sys_sessions ONLY when Redis is not configured.
 * When Redis is configured but transiently connecting, the ioredis offline
 * queue will buffer the command until the connection is ready.
 */
export async function cacheGet(key) {
  const r = getRedis();

  if (!r) {
    // Redis not configured at all — use MySQL fallback
    try {
      const rows = await query(`SELECT data, expires_at FROM sys_sessions WHERE id = ?`, [key]);
      if (!rows || rows.length === 0) return null;
      const entry = rows[0];
      if (entry.expires_at && Date.now() > Number(entry.expires_at)) {
        await query(`DELETE FROM sys_sessions WHERE id = ?`, [key]);
        return null;
      }
      return typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data;
    } catch (err) {
      console.error("[Cache Fallback] Error reading from DB:", err.message);
      return null;
    }
  }

  try {
    if (r.status !== 'ready') {
      return null;
    }
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('Redis timeout')), 1000);
    });
    
    // Add a catch to the timeoutPromise itself so it doesn't trigger UnhandledPromiseRejection if r.get wins
    timeoutPromise.catch(() => {});
    
    const val = await Promise.race([r.get(key), timeoutPromise]).finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    });
    if (val === null || val === undefined) return null;
    return JSON.parse(val);
  } catch (err) {
    console.error("[Redis] cacheGet error for key", key, ":", err.message);
    return null;
  }
}

/**
 * Set a cache value with optional TTL in seconds.
 *
 * Falls back to MySQL sys_sessions ONLY when Redis is not configured.
 */
export async function cacheSet(key, value, ttlSeconds = 300) {
  const r = getRedis();

  if (!r) {
    // Redis not configured at all — use MySQL fallback
    try {
      const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0;
      const dataStr = JSON.stringify(value);
      await query(
        `INSERT INTO sys_sessions (id, data, expires_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at)`,
        [key, dataStr, expiresAt]
      );
    } catch (err) {
      console.error("[Cache Fallback] Error writing to DB:", err.message);
    }
    return;
  }

  try {
    if (r.status !== 'ready') return;
    const serialized = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await r.setex(key, ttlSeconds, serialized);
    } else {
      await r.set(key, serialized);
    }
  } catch (err) {
    console.error("[Redis] cacheSet error for key", key, ":", err.message);
  }
}

/**
 * Delete one or more cache keys.
 */
export async function cacheDel(...keys) {
  const r = getRedis();

  if (!r) {
    // MySQL fallback
    try {
      if (keys.length > 0) {
        const placeholders = keys.map(() => "?").join(",");
        await query(`DELETE FROM sys_sessions WHERE id IN (${placeholders})`, keys);
      }
    } catch {}
    return;
  }

  if (!keys.length) return;

  try {
    await r.del(...keys);
  } catch (err) {
    console.error("[Redis] cacheDel error:", err.message);
  }
}

/**
 * Delete all keys matching a pattern (use sparingly).
 *
 * BUG FIX: ioredis keyPrefix is automatically prepended to every command key.
 * When r.keys() returns results, those results already contain the prefix
 * (e.g., "sm:omnisuite_session:abc"). Passing them directly to r.del() causes
 * ioredis to prepend the prefix AGAIN, attempting to delete "sm:sm:..." which
 * doesn't exist. We strip the prefix from KEYS results before calling del().
 */
export async function cacheDelPattern(pattern) {
  const r = getRedis();
  if (!r) {
    // MySQL fallback
    try {
      const sqlPattern = pattern.replace(/\*/g, '%');
      await query(`DELETE FROM sys_sessions WHERE id LIKE ?`, [sqlPattern]);
    } catch (err) {
      console.error("[Cache Fallback] Error deleting pattern from DB:", err.message);
    }
    return;
  }
  try {
    // r.keys() with keyPrefix set: ioredis prepends the prefix to the pattern
    // but the RETURNED keys from Redis already have the raw prefix baked in.
    // We need to strip REDIS_KEY_PREFIX from each returned key before calling del.
    const keys = await r.keys(pattern);
    if (keys.length === 0) return;

    // Strip the keyPrefix from each key so ioredis doesn't double-apply it
    const strippedKeys = keys.map((k) =>
      REDIS_KEY_PREFIX && k.startsWith(REDIS_KEY_PREFIX)
        ? k.slice(REDIS_KEY_PREFIX.length)
        : k
    );

    await r.del(...strippedKeys);
  } catch (err) {
    console.error("[Redis] cacheDelPattern error:", err.message);
  }
}

/**
 * Increment a counter key. Returns the new value.
 */
export async function cacheIncr(key, ttlSeconds = 3600) {
  const r = getRedis();
  if (!r) return null;
  try {
    const val = await r.incr(key);
    if (val === 1 && ttlSeconds > 0) {
      await r.expire(key, ttlSeconds);
    }
    return val;
  } catch {
    return null;
  }
}

/**
 * Check if Redis is connected and responsive.
 */
export async function redisHealth() {
  const r = getRedis();
  if (!r) return { status: "disabled", message: "REDIS_URL not configured" };
  try {
    const pong = await r.ping();
    return {
      status: pong === "PONG" ? "ok" : "degraded",
      message: pong,
      keyPrefix: REDIS_KEY_PREFIX,
      clientStatus: r.status,
    };
  } catch (err) {
    return { status: "error", message: err.message, clientStatus: r.status };
  }
}

/**
 * Waits for the Redis client to reach "ready" state.
 * Resolves immediately if already ready; resolves on "ready" event;
 * rejects after timeoutMs if not ready.
 * Used during server startup to ensure Redis is available before accepting requests.
 */
export function waitForRedis(timeoutMs = 10000) {
  const r = getRedis();
  if (!r) return Promise.resolve(false); // Redis not configured — no-op
  if (r.status === "ready") return Promise.resolve(true);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn("[Redis] waitForRedis timed out — proceeding without confirmed Redis connection");
      resolve(false);
    }, timeoutMs);

    r.once("ready", () => {
      clearTimeout(timer);
      resolve(true);
    });

    r.once("error", () => {
      // Don't reject — let the app start and handle Redis unavailability gracefully
      clearTimeout(timer);
      resolve(false);
    });
  });
}

export default getRedis;
