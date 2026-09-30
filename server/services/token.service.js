import crypto from "crypto";
/**
 * @file token.service.js
 * @description Manages authentication tokens, JWT signing/verifying, and cookie operations.
 * Uses Redis for token grace period to prevent 401 cascade during refresh.
 */
import jwt from "jsonwebtoken";

import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import "../utils/loadServerEnv.js";

// Configuration Constants
const REFRESH_COOKIE_NAME =
  String(process.env.REFRESH_TOKEN_COOKIE_NAME || "").trim() ||
  "omnisuite_refresh_token";
const ACCESS_TOKEN_EXPIRES_IN =
  String(process.env.ACCESS_TOKEN_EXPIRES_IN || "").trim() || "15m";
const SESSION_REFRESH_HOURS = Math.max(
  1,
  Number(process.env.SESSION_REFRESH_HOURS || 24 * 7),
);
const REMEMBER_REFRESH_HOURS = Math.max(
  SESSION_REFRESH_HOURS,
  Number(process.env.REFRESH_TOKEN_REMEMBER_DAYS || 30),
);
const LOGIN_FAILURE_LIMIT = Math.max(
  1,
  Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5),
);
const LOGIN_FAILURE_COOLDOWN_MINUTES = Math.max(
  1,
  Number(process.env.FAILED_LOGIN_COOLDOWN_MINUTES || 15),
);

// Utility Function: Checks if a specific column exists in a given table
async function hasColumn(tableName, columnName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
      AND column_name = :columnName
    `,
    { tableName, columnName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

// Utility Function: Retrieves the JWT secret, throwing an error if missing
function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) {
    throw httpError(500, "SERVER_ERROR", "JWT_SECRET is not configured");
  }
  return secret;
}

// Utility Function: Converts binary profile picture data into a base64 Data URL
function profilePictureToDataUrl(blob) {
  if (!blob) return null;
  try {
    const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
    let mime = "image/jpeg";
    if (
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
  } catch {
    return null;
  }
}

// Utility Function: Checks if environment is production
function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

/**
 * Gets the refresh token cookie name.
 * @returns {string} The configured refresh token cookie name.
 */
export function getRefreshTokenCookieName() {
  return REFRESH_COOKIE_NAME;
}

// Utility Function: Parses raw cookie header string into an object
export function parseCookieHeader(cookieHeader = "") {
  const cookies = {};
  const parts = String(cookieHeader || "").split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    if (cookies[key] === undefined) {
      cookies[key] = decodeURIComponent(value);
    }
  }
  return cookies;
}

// Utility Function: Extracts refresh token from request cookies
export function readRefreshTokenFromRequest(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie || "");
  return cookies[REFRESH_COOKIE_NAME] || null;
}

// Utility Function: Builds cookie settings based on environment and rememberMe status
function buildRefreshCookieOptions(
  req,
  { rememberMe = false, expiresAt = null } = {},
) {
  // SameSite=None requires Secure=true (HTTPS). On HTTP (dev), use lax.
  const options = {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    path: "/api",
  };
  if (isProduction() && req) {
    const origin = req.headers?.origin || "";
    if (origin.includes("omnisuite-erp.com")) {
      options.domain = ".omnisuite-erp.com";
    }
  }
  if (rememberMe && expiresAt instanceof Date) {
    options.expires = expiresAt;
    options.maxAge = Math.max(0, expiresAt.getTime() - Date.now());
  }
  return options;
}

// Utility Function: Assigns the refresh token to the response cookie
export function setRefreshTokenCookie(req, res, refreshToken, options = {}) {
  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    buildRefreshCookieOptions(req, options),
  );
}

// Utility Function: Clears the refresh token cookie upon logout
export function clearRefreshTokenCookie(req, res) {
  res.clearCookie(
    REFRESH_COOKIE_NAME,
    buildRefreshCookieOptions(req, { rememberMe: false }),
  );
}

// Utility Function: Hashes refresh token for secure database storage
export function hashRefreshToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

// Utility Function: Generates a cryptographically strong random token
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

// Utility Function: Hashes access token for Redis grace period key
function hashAccessToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex")
    .slice(0, 32);
}

const GRACE_PERIOD_SECONDS = 120; // 2 minutes grace period

/**
 * Store the old access token in Redis during refresh to prevent 401 cascade.
 * The old token is valid for 15 minutes; we keep it for 2 minutes after refresh
 * so in-flight requests can still be authenticated.
 * @param {string} oldAccessToken - The expired/expiring access token.
 * @param {Object} newPayload - The decoded payload of the NEW access token.
 */
export async function storeGraceToken(oldAccessToken, newPayload) {
  try {
    const { cacheSet } = await import("../utils/redis.js");
    const key = `auth:grace:${hashAccessToken(oldAccessToken)}`;
    await cacheSet(key, { newPayload }, GRACE_PERIOD_SECONDS);
  } catch {}
}

/**
 * Look up a recently-refreshed token from Redis grace period.
 * @param {string} oldAccessToken - The expired access token.
 * @returns {Object|null} The new payload if found, null otherwise.
 */
export async function lookupGraceToken(oldAccessToken) {
  try {
    const { cacheGet } = await import("../utils/redis.js");
    const key = `auth:grace:${hashAccessToken(oldAccessToken)}`;
    const data = await cacheGet(key);
    return data?.newPayload || null;
  } catch {
    return null;
  }
}

/**
 * Verifies the signature of an access token.
 * @param {string} token - The JWT string to verify.
 * @returns {Object|null} The decoded token payload if valid, otherwise null.
 */
export function verifyAccessToken(token) {
  // SECURITY: Explicitly restrict to HS256 to prevent algorithm confusion attacks
  const payload = jwt.verify(String(token || ""), getJwtSecret(), {
    algorithms: ["HS256"],
  });
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.token_type !== "access"
  ) {
    throw httpError(401, "INVALID_TOKEN", "Invalid access token");
  }
  return payload;
}

// Utility Function: Creates and signs a new JWT access token without bloated picture data
export function signAccessToken(payload) {
  const tokenPayload = { ...payload };
  delete tokenPayload.profile_picture_url;
  delete tokenPayload.permissions; // PREVENT NGINX 400 BAD REQUEST HEADER TOO LARGE
  return jwt.sign(
    {
      ...tokenPayload,
      token_type: "access",
    },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
  );
}

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

let _authTablesEnsured = false;
/**
 * Ensures necessary authentication tables exist in the database (schema migration).
 * @returns {Promise<void>}
 */
export async function ensureAuthTables() {
  if (_authTablesEnsured) return;
  _authTablesEnsured = true;
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      refresh_token VARCHAR(255) NOT NULL,
      expiry_date DATETIME NOT NULL,
      remember_me TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_refresh_token_hash (refresh_token),
      KEY idx_refresh_user (user_id),
      KEY idx_refresh_expiry (expiry_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  if (!(await hasColumn("adm_users", "failed_attempts"))) {
    await query(
      `ALTER TABLE adm_users
        ADD COLUMN failed_attempts INT NOT NULL DEFAULT 0`,
    ).catch(() => {});
  }
  if (!(await hasColumn("adm_users", "last_failed_attempt"))) {
    await query(
      `ALTER TABLE adm_users
        ADD COLUMN last_failed_attempt DATETIME NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("adm_users", "status"))) {
    await query(
      `ALTER TABLE adm_users
        ADD COLUMN status CHAR(1) NOT NULL DEFAULT 'N'`,
    ).catch(() => {});
  }
  if (!(await hasColumn("adm_users", "valid_to"))) {
    await query(
      `ALTER TABLE adm_users
        ADD COLUMN valid_to DATE NULL`,
    ).catch(() => {});
  }

  try {
    const trigRows = await query(
      `SELECT TRIGGER_NAME FROM information_schema.triggers
        WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'trg_adm_users_pw_status'`,
    ).catch(() => []);
    if (!trigRows || trigRows.length === 0) {
      await query(
        `CREATE TRIGGER trg_adm_users_pw_status
         BEFORE UPDATE ON adm_users
         FOR EACH ROW
         BEGIN
           IF OLD.password_hash <> NEW.password_hash THEN
             SET NEW.status = 'Y';
           END IF;
         END`,
      ).catch((e) => {
        if (e?.code !== "ER_TRG_ALREADY_EXISTS") {
          console.warn("[ensureAuthTables] Notice: Trigger creation skipped:", e?.message);
        }
      });
    }
  } catch (e) {
    console.warn("[ensureAuthTables] Trigger check error:", e?.message);
  }

  try {
    await query(
      `CREATE EVENT IF NOT EXISTS evt_adm_users_expire
       ON SCHEDULE EVERY 1 DAY
       STARTS CURRENT_DATE + INTERVAL 1 DAY
       DO
         UPDATE adm_users
         SET status = 'N', is_active = 0
         WHERE DATE(valid_to) = CURDATE() AND is_active = 1 AND id != 1`,
    ).catch((e) => {
      console.warn("[ensureAuthTables] Notice: Event scheduler skipped (lacks EVENT privilege):", e?.message);
    });
  } catch {}
}

// Major Logic: Fetches all granted permissions across assigned roles and legacy settings
export async function getUserPermissions(userId) {
  const userRows = await query(
    "SELECT role_id FROM adm_users WHERE id = :userId LIMIT 1",
    { userId },
  ).catch(() => []);
  let roleId = Number(userRows?.[0]?.role_id || 0) || 0;
  if (!roleId) {
    const mappedRoles = await query(
      `SELECT ur.role_id
         FROM adm_user_roles ur
         JOIN adm_roles r ON r.id = ur.role_id
        WHERE ur.user_id = :userId
          AND COALESCE(r.is_active, 1) = 1
        ORDER BY ur.created_at DESC, ur.role_id DESC
        LIMIT 1`,
      { userId },
    ).catch(() => []);
    roleId = Number(mappedRoles?.[0]?.role_id || 0) || 0;
  }

  if (!roleId) return [];

  const [permRows, legacyRows, exclusiveRows] = await Promise.all([
    query(
      `
      SELECT DISTINCT feature_key as code, module_key
      FROM adm_role_permissions rp
      WHERE rp.role_id = :roleId AND rp.can_view = 1
      `,
      { roleId },
    ).catch(() => []),
    query(
      `
      SELECT DISTINCT p.code, p.feature_key, p.module
      FROM adm_users u
      JOIN adm_user_permissions up ON up.user_id = u.id
      JOIN adm_pages p ON p.id = up.page_id
      WHERE u.id = :userId AND up.can_view = 1
      `,
      { userId },
    ).catch(() => []),
    query(
      `
      SELECT feature_key as code
      FROM adm_admin_page_permissions
      WHERE user_id = :userId
      `,
      { userId },
    ).catch(() => []),
  ]);

  const allPerms = [];
  for (const row of permRows) {
    if (row.code) {
      allPerms.push(row.code);
      if (row.module_key && !String(row.code).includes(":")) {
        allPerms.push(`${row.module_key}:${row.code}`);
      }
    }
  }
  for (const row of legacyRows) {
    if (row.code) allPerms.push(row.code);
    if (row.feature_key) {
      allPerms.push(row.feature_key);
      if (row.module && !String(row.feature_key).includes(":")) {
        allPerms.push(`${row.module}:${row.feature_key}`);
      }
    }
  }
  for (const row of exclusiveRows) {
    if (row.code) allPerms.push(row.code);
  }

  return Array.from(new Set(allPerms.filter(Boolean)));
}

// Major Logic: Retrieves user data needed to build the authentication payload
export async function getUserForAuth(userId) {
  const rows = await query(
    `
    SELECT
      u.id,
      u.company_id,
      u.branch_id,
      u.username,
      u.email,
      u.full_name,
      u.profile_picture,
      u.is_active,
      u.status,
      u.failed_attempts,
      u.last_failed_attempt,
      c.name AS company_name,
      b.name AS branch_name
    FROM adm_users u
    LEFT JOIN adm_companies c ON u.company_id = c.id
    LEFT JOIN adm_branches b ON u.branch_id = b.id
    WHERE u.id = :userId
    LIMIT 1
    `,
    { userId },
  );
  return rows[0] || null;
}

// Major Logic: Constructs the JWT payload incorporating branch assignments and permissions
export async function buildAuthUserPayload(user, permissions = []) {
  // Fetch ALL branches this user is assigned to from adm_user_branches
  let allBranchIds = [];
  let allCompanyIds = [];
  try {
    const branchRows = await query(
      `SELECT branch_id, company_id FROM adm_user_branches WHERE user_id = :userId`,
      { userId: Number(user.id) },
    );
    if (branchRows && branchRows.length > 0) {
      allBranchIds = [
        ...new Set(branchRows.map((r) => Number(r.branch_id)).filter(Boolean)),
      ];
      allCompanyIds = [
        ...new Set(branchRows.map((r) => Number(r.company_id)).filter(Boolean)),
      ];
    }
  } catch {
    // fallback to default branch_id if query fails
  }

  // Fallback to user's default branch_id / company_id if no rows found in adm_user_branches
  if (allBranchIds.length === 0 && user.branch_id) {
    allBranchIds = [Number(user.branch_id)];
  }
  if (allCompanyIds.length === 0 && user.company_id) {
    allCompanyIds = [Number(user.company_id)];
  }

  const payload = {
    sub: Number(user.id),
    id: Number(user.id),
    username: user.username,
    email: user.email,
    full_name: user.full_name || "",
    permissions: (Array.isArray(permissions) && permissions.includes("*")) ? ["*"] : (Array.isArray(permissions) ? permissions : []),
    companyIds: allCompanyIds,
    branchIds: allBranchIds,
    companyId: Number(user.company_id) || (allCompanyIds[0] ?? null),
    branchId: Number(user.branch_id) || (allBranchIds[0] ?? null),
    companyName: user.company_name || "",
    branchName: user.branch_name || "",
    profile_picture_url: profilePictureToDataUrl(user.profile_picture),
    status: user.status || "N",
    licenseExpired: Boolean(user.licenseExpired),
  };

  return payload;
}

/**
 * Generates and saves a new session with access and refresh tokens for a user.
 * @param {Object} params - Session parameters.
 * @param {Object} params.user - The user object.
 * @param {boolean} [params.rememberMe=false] - Whether the session is long-lived.
 * @param {Array} [params.permissions=[]] - List of permissions.
 * @returns {Promise<{accessToken: string, refreshToken: string, userPayload: Object}>}
 */
export async function createSessionTokens({
  user,
  rememberMe = false,
  permissions = [],
}) {
  await ensureAuthTables();
  const authUser = await buildAuthUserPayload(user, permissions);
  const accessToken = signAccessToken(authUser);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const addHours = (h) => new Date(Date.now() + h * 60 * 60 * 1000);
  const expiresAt = addHours(
    rememberMe ? REMEMBER_REFRESH_HOURS : SESSION_REFRESH_HOURS,
  );

  await query(
    `
    INSERT INTO refresh_tokens (user_id, refresh_token, expiry_date, remember_me)
    VALUES (:userId, :refreshToken, :expiryDate, :rememberMe)
    `,
    {
      userId: Number(user.id),
      refreshToken: refreshTokenHash,
      expiryDate: expiresAt,
      rememberMe: rememberMe ? 1 : 0,
    },
  );

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
    rememberMe: Boolean(rememberMe),
    user: authUser,
  };
}

// Major Logic: Invalidates a specific refresh token in the database
export async function revokeRefreshToken(rawToken) {
  const tokenHash = hashRefreshToken(rawToken);
  await query(`DELETE FROM refresh_tokens WHERE refresh_token = :tokenHash`, {
    tokenHash,
  });
}

// Major Logic: Expires a refresh token in 30 seconds instead of immediate deletion.
// This allows concurrent requests to succeed even if Redis is completely down.
export async function expireRefreshTokenGracefully(rawToken) {
  const tokenHash = hashRefreshToken(rawToken);
  const expiryDate = new Date(Date.now() + 30000);
  await query(
    `UPDATE refresh_tokens 
     SET expiry_date = :expiryDate 
     WHERE refresh_token = :tokenHash AND expiry_date > :expiryDate`,
    { tokenHash, expiryDate }
  );
}

// Major Logic: Logs user out everywhere by revoking all their refresh tokens
export async function revokeUserRefreshTokens(userId) {
  await query(`DELETE FROM refresh_tokens WHERE user_id = :userId`, {
    userId: Number(userId),
  });
}

// Major Logic: Validates a raw refresh token and checks expiration before use
export async function consumeRefreshToken(rawToken) {
  await ensureAuthTables();
  const tokenHash = hashRefreshToken(rawToken);
  const rows = await query(
    `
    SELECT id, user_id, refresh_token, expiry_date, remember_me, created_at
    FROM refresh_tokens
    WHERE refresh_token = :tokenHash
    LIMIT 1
    `,
    { tokenHash },
  );
  const record = rows[0] || null;
  if (!record) {
    throw httpError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid");
  }
  if (new Date(record.expiry_date).getTime() <= Date.now()) {
    await revokeRefreshToken(rawToken);
    throw httpError(401, "INVALID_REFRESH_TOKEN", "Refresh token has expired");
  }
  return {
    id: Number(record.id),
    user_id: Number(record.user_id),
    remember_me: Number(record.remember_me) === 1,
  };
}

const recentlyRotatedTokens = new Map();

// Endpoint / Major Logic: Refreshes access tokens and rotates refresh tokens, supporting slight concurrency delay
export async function rotateRefreshSession(rawToken, oldAccessToken = null) {
  const tokenHash = hashRefreshToken(rawToken);
  const { cacheGet, cacheSet } = await import("../utils/redis.js");

  // 1. Check in-memory map (fast path for single process)
  if (recentlyRotatedTokens.has(tokenHash)) {
    const cached = recentlyRotatedTokens.get(tokenHash);
    if (Date.now() < cached.expiresAt) {
      if (cached.promise) return await cached.promise;
      return cached.newTokens;
    }
  }

  // 2. Check Redis (fast path for multi-process)
  const redisKey = `auth:rotated_refresh:${tokenHash}`;
  const redisCached = await cacheGet(redisKey);
  if (redisCached) {
    return redisCached;
  }

  const promise = (async () => {
    let refreshRecord;
    try {
      refreshRecord = await consumeRefreshToken(rawToken);
    } catch (err) {
      if (err.message === "Refresh token is invalid") {
        // Race condition mitigation: Another process might have JUST rotated it and deleted it from DB.
        // If they deleted it, they must have saved the new tokens to Redis right before deleting.
        // Let's check Redis one more time.
        const secondCheck = await cacheGet(redisKey);
        if (secondCheck) return secondCheck;
      }
      throw err;
    }

    const user = await getUserForAuth(refreshRecord.user_id);
    if (!user || !Number(user.is_active)) {
      await revokeRefreshToken(rawToken);
      throw httpError(401, "USER_INACTIVE", "User is inactive");
    }

    const permissions = await getUserPermissions(user.id);
    
    // Generate new tokens
    const newTokens = await createSessionTokens({
      user,
      rememberMe: refreshRecord.remember_me,
      permissions,
    });

    // 3. Save to Redis BEFORE revoking from DB.
    // This ensures that concurrent processes will either find the old token in the DB,
    // or the new tokens in Redis. There's no gap where both are missing.
    await cacheSet(redisKey, newTokens, 60);

    // 4. Set a short grace period on the token instead of immediate deletion.
    // This allows concurrent requests to succeed even if Redis is completely down
    // (e.g. Upstash quota exceeded).
    await expireRefreshTokenGracefully(rawToken);

    return newTokens;
  })();

  recentlyRotatedTokens.set(tokenHash, {
    promise,
    expiresAt: Date.now() + 30000,
  });

  try {
    const newTokens = await promise;
    recentlyRotatedTokens.set(tokenHash, {
      newTokens,
      expiresAt: Date.now() + 30000,
    });

    // Store old access token in Redis grace period to prevent 401 cascade
    if (oldAccessToken && newTokens.user) {
      await storeGraceToken(oldAccessToken, newTokens.user);
    }

    // Clean up expired cache entries
    for (const [k, v] of recentlyRotatedTokens.entries()) {
      if (Date.now() >= v.expiresAt) recentlyRotatedTokens.delete(k);
    }

    return newTokens;
  } catch (error) {
    recentlyRotatedTokens.delete(tokenHash);
    throw error;
  }
}

// Major Logic: Clears failed attempt counters on successful authentication
export async function resetFailedLoginAttempts(userId) {
  await ensureAuthTables();
  await query(
    `
    UPDATE adm_users
    SET failed_attempts = 0,
        last_failed_attempt = NULL
    WHERE id = :userId
    `,
    { userId: Number(userId) },
  );
}

// Major Logic: Increments failed attempt counter upon invalid login
export async function registerFailedLoginAttempt(userId) {
  await ensureAuthTables();
  await query(
    `
    UPDATE adm_users
    SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
        last_failed_attempt = NOW()
    WHERE id = :userId
    `,
    { userId: Number(userId) },
  );

  const user = await getUserForAuth(userId);
  return Number(user?.failed_attempts || 0);
}

// Major Logic: Determines if the user account is locked out from too many failures
export function requiresPasswordReset(user) {
  const attempts = Number(user?.failed_attempts || 0);
  if (attempts < LOGIN_FAILURE_LIMIT) return false;

  const lastFailed = user?.last_failed_attempt
    ? new Date(user.last_failed_attempt).getTime()
    : 0;
  if (!lastFailed) return true;

  return Date.now() - lastFailed <= LOGIN_FAILURE_COOLDOWN_MINUTES * 60 * 1000;
}
