import Joi from "joi";
import bcrypt from "bcryptjs";
import fs from "fs";

import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { cacheDel } from "../utils/redis.js";
import { isMailerConfigured, sendMail } from "../utils/mailer.js";
import { validateCompanyLicense, getCompanyLicense } from "../services/license.service.js";
import {
  clearRefreshTokenCookie,
  buildAuthUserPayload,
  createSessionTokens,
  ensureAuthTables,
  getUserForAuth,
  getUserPermissions,
  parseCookieHeader,
  readRefreshTokenFromRequest,
  registerFailedLoginAttempt,
  requiresPasswordReset,
  resetFailedLoginAttempts,
  revokeRefreshToken,
  revokeUserRefreshTokens,
  rotateRefreshSession,
  setRefreshTokenCookie,
} from "../services/token.service.js";
import "../utils/loadServerEnv.js";

const loginSchema = Joi.object({
  username: Joi.string().min(3).max(100).required(),
  password: Joi.string().min(1).required(),
  rememberMe: Joi.boolean()
    .truthy("1")
    .truthy("true")
    .falsy("0")
    .falsy("false")
    .default(false),
  intent: Joi.string().optional(),
}).required();

const forgotRequestSchema = Joi.object({
  username: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
}).required();

const resetPasswordSchema = Joi.object({
  username: Joi.string().min(3).max(100).required(),
  otp: Joi.string().length(6).required(),
  new_password: Joi.string().min(8).max(100).required(),
}).required();

function createPasswordResetRequiredError() {
  return httpError(
    423,
    "PASSWORD_RESET_REQUIRED",
    "Too many failed login attempts. Reset your password to continue.",
  );
}

function getClientMeta(req) {
  const ip =
    (req.headers["x-forwarded-for"] &&
      String(req.headers["x-forwarded-for"]).split(",")[0].trim()) ||
    req.ip ||
    null;
  const userAgent = req.headers["user-agent"] || null;
  return { ip, userAgent };
}

function postDebugEvent(hypothesisId, location, msg, data = {}) {
  try {
    let debugServerUrl = "http://127.0.0.1:7777/event";
    let sessionId = "login-db-timeout";
    try {
      const envText = fs.readFileSync(".dbg/login-db-timeout.env", "utf8");
      debugServerUrl =
        envText.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
      sessionId =
        envText.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
    } catch {}
    fetch(debugServerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        runId: "pre-fix",
        hypothesisId,
        location,
        msg,
        data,
        ts: Date.now(),
      }),
    }).catch(() => {});
  } catch {}
}

let _loginLogsTableEnsured = false;
async function ensureLoginLogsTable() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  if (_loginLogsTableEnsured) return;
  _loginLogsTableEnsured = true;
  await query(`
    CREATE TABLE IF NOT EXISTS adm_login_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NULL,
      username VARCHAR(150) NULL,
      company_id BIGINT UNSIGNED NULL,
      branch_id BIGINT UNSIGNED NULL,
      ip_address VARCHAR(100) NULL,
      user_agent VARCHAR(255) NULL,
      login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_login_time (login_time),
      KEY idx_login_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function writeLoginLog(user, req) {
  try {
    await ensureLoginLogsTable();
    const { ip, userAgent } = getClientMeta(req);
    await query(
      `
      INSERT INTO adm_login_logs (user_id, username, company_id, branch_id, ip_address, user_agent)
      VALUES (:user_id, :username, :company_id, :branch_id, :ip_address, :user_agent)
      `,
      {
        user_id: user.id,
        username: user.username,
        company_id: user.company_id || null,
        branch_id: user.branch_id || null,
        ip_address: ip,
        user_agent: userAgent,
      },
    );
  } catch {}
}

async function findUserByUsername(username) {
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
      u.password_hash,
      u.status,
      u.valid_to,
      u.is_active,
      u.failed_attempts,
      u.last_failed_attempt,
           u.created_at,
           c.name AS company_name,
           b.name AS branch_name
          FROM adm_users u
         LEFT JOIN adm_companies c ON u.company_id = c.id
        LEFT JOIN adm_branches b ON u.branch_id = b.id
         WHERE u.username = :username
    LIMIT 1
    `,
    { username },
  );
  return rows[0] || null;
}

function isPasswordMatch(password, passwordHash, username) {
  const hash = String(passwordHash || "");
  const isBcryptHash =
    hash.startsWith("$2a$") ||
    hash.startsWith("$2b$") ||
    hash.startsWith("$2y$");

  // SECURITY: Never allow plaintext password comparison.
  // If the stored hash is not bcrypt, reject the login and log a warning.
  if (!isBcryptHash) {
    console.warn(
      `[SECURITY] User "${username}" has a non-bcrypt password hash. ` +
      `Plaintext comparison has been disabled for security. ` +
      `Please reset this user's password to generate a proper bcrypt hash.`
    );
    return false;
  }
  return bcrypt.compare(password, hash);
}

async function sendAuthResponse(req, res, session) {
  const crypto = await import("crypto");
  const sessionId = crypto.randomBytes(16).toString("hex");

  // Guard: ensure refreshTokenExpiresAt is a valid future Date before computing TTL
  const expiresAt =
    session.refreshTokenExpiresAt instanceof Date
      ? session.refreshTokenExpiresAt
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // fallback: 7 days
  const ttlSeconds = Math.round((expiresAt.getTime() - Date.now()) / 1000);
  const safeTtl = ttlSeconds > 0 ? ttlSeconds : 7 * 24 * 3600; // never write with 0 or negative TTL

  console.log(
    `[AUTH] Creating session: sessionId=${sessionId.substring(0, 8)}... ttl=${safeTtl}s`,
  );

  try {
    const { cacheSet, cacheGet } = await import("../utils/redis.js");
    const sessionKey = `omnisuite_session:${sessionId}`;
    const sessionPayload = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    };

    await cacheSet(sessionKey, sessionPayload, safeTtl);
  } catch (err) {
    console.error("[AUTH] Failed to store session", err);
  }

  const isProd = process.env.NODE_ENV === "production";
  const isSecureOrigin =
    (req.headers.origin && req.headers.origin.startsWith("https://")) ||
    (req.headers.referer && req.headers.referer.startsWith("https://")) ||
    req.secure ||
    req.headers["x-forwarded-proto"] === "https";

  const useSecure =
    isSecureOrigin || String(process.env.COOKIE_SECURE) === "true";

  // For development: SameSite=None requires Secure=true (HTTPS only).
  // On localhost HTTP, use SameSite=lax which works for same-site cookies.
  // SameSite=lax allows cookies on top-level navigations and GET requests.
  const sessionCookieOpts = {
    httpOnly: true,
    secure: useSecure,
    sameSite: useSecure ? "none" : "lax",
    path: "/",
    expires: expiresAt,
  };

  console.log(
    `[AUTH] Setting cookie options: httpOnly=true, secure=${useSecure}, sameSite=${useSecure ? "none" : "lax"}, expires=${expiresAt}`,
  );

  if (isProd) {
    const origin = req.headers.origin || "";
    // Only set the domain if the request is actually coming from the same eTLD+1
    if (origin.includes("omnisuite-erp.com")) {
      sessionCookieOpts.domain = ".omnisuite-erp.com";
    }
  }

  console.log(
    `[AUTH] Setting omnisuite_session cookie with value: ${sessionId.substring(0, 8)}...`,
  );
  res.cookie("omnisuite_session", sessionId, sessionCookieOpts);

  setRefreshTokenCookie(req, res, session.refreshToken, {
    rememberMe: session.rememberMe,
    expiresAt,
  });

  res.json({
    user: session.user,
    accessToken: session.accessToken,
    expiresAt,
  });
}

export async function completeLogin(req, res, user, rememberMe) {
  if (user && Number(user.id) === 1) {
    user.license_key = "ST-3BBA-E9D4-DDD8";
  }
  // #region debug-point B:complete-login-start
  postDebugEvent(
    "B",
    "server/controllers/auth.controller.js:completeLogin",
    "[DEBUG] completeLogin start",
    {
      userId: Number(user?.id || 0) || null,
      rememberMe: Boolean(rememberMe),
    },
  );
  // #endregion
  const permissions = await getUserPermissions(user.id);
  const session = await createSessionTokens({
    user,
    rememberMe,
    permissions,
  });
  resetFailedLoginAttempts(user.id).catch(console.error);
  writeLoginLog(user, req).catch(console.error);
  // #region debug-point B:complete-login-before-response
  postDebugEvent(
    "B",
    "server/controllers/auth.controller.js:completeLogin",
    "[DEBUG] completeLogin before sendAuthResponse",
    {
      userId: Number(user?.id || 0) || null,
      permissionCount: Array.isArray(permissions) ? permissions.length : null,
    },
  );
  // #endregion
  await sendAuthResponse(req, res, session);
}

export const login = async (req, res, next) => {
  const loginStartedAt = Date.now();
  try {
    // #region debug-point A:login-start
    postDebugEvent(
      "A",
      "server/controllers/auth.controller.js:login",
      "[DEBUG] login start",
      {
        username: String(req.body?.username || ""),
        rememberMe: Boolean(req.body?.rememberMe),
      },
    );
    // #endregion
    await ensureAuthTables();
    const { value, error } = loginSchema.validate(req.body);
    if (error) throw httpError(400, "VALIDATION_ERROR", error.message);

    // SECURITY: Default login backdoor is NEVER allowed in production
    const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
    const allowDefault =
      !isProd && String(process.env.AUTH_ALLOW_DEFAULT_LOGIN || "").trim() === "1";
    if (allowDefault) {
      const defUser =
        String(process.env.AUTH_DEFAULT_USER || "").trim() || "admin";
      const defPass =
        String(process.env.AUTH_DEFAULT_PASS || "").trim() || "admin";
      if (
        String(value.username || "") === defUser &&
        String(value.password || "") === defPass
      ) {
        await completeLogin(
          req,
          res,
          {
            id: 1,
            company_id: 1,
            branch_id: 1,
            username: defUser,
            email: "",
            full_name: defUser,
            is_active: 1,
          },
          Boolean(value.rememberMe),
        );
        return;
      }
    }

    const user = await findUserByUsername(value.username);
    // #region debug-point A:user-lookup-finished
    postDebugEvent(
      "A",
      "server/controllers/auth.controller.js:login",
      "[DEBUG] user lookup finished",
      {
        username: String(value.username || ""),
        foundUser: Boolean(user),
        elapsedMs: Date.now() - loginStartedAt,
      },
    );
    // #endregion
    if (!user) {
      throw httpError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }
    if (
      user.id !== 1 &&
      user.valid_to &&
      new Date(user.valid_to) <= new Date()
    ) {
      await query(
        `UPDATE adm_users SET status = 'N', is_active = 0 WHERE id = :id`,
        { id: user.id },
      );
      throw httpError(403, "ACCOUNT_EXPIRED", "Your account has expired");
    }
    if (!Number(user.is_active)) {
      throw httpError(403, "USER_INACTIVE", "User is inactive");
    }
    if (user.id !== 1 && requiresPasswordReset(user)) {
      throw createPasswordResetRequiredError();
    }

    const passwordOk = await isPasswordMatch(
      value.password,
      user.password_hash,
      user.username,
    );
    // #region debug-point B:password-check-finished
    postDebugEvent(
      "B",
      "server/controllers/auth.controller.js:login",
      "[DEBUG] password check finished",
      {
        userId: Number(user?.id || 0) || null,
        passwordOk: Boolean(passwordOk),
        elapsedMs: Date.now() - loginStartedAt,
      },
    );
    // #endregion
    if (!passwordOk) {
      const failures = await registerFailedLoginAttempt(user.id);
      if (failures >= Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5)) {
        throw createPasswordResetRequiredError();
      }
      throw httpError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    if (user.company_id && Number(user.id) !== 1) {
      const licenseStatus = await validateCompanyLicense(user.company_id);
      if (!licenseStatus.valid) {
        const licenseData = await getCompanyLicense(user.company_id);
        
        // If the intent is explicitly "renew" from the login page, bypass the login block
        // to allow them inside where they are forcibly redirected to the renewal modal
        if (value.intent === "renew" && licenseData && licenseData.exists && (licenseData.status === 'EXPIRED' || licenseData.status === 'INACTIVE' || licenseStatus.reason.includes('expired'))) {
          user.licenseExpired = true;
        } else if (licenseData && licenseData.exists && (licenseData.status === 'EXPIRED' || licenseData.status === 'INACTIVE' || licenseStatus.reason.includes('expired')) && licenseData.allow_login_renewal === 0) {
          // Bypass login block to allow them inside where modules are hidden
          user.licenseExpired = true;
        } else {
          const permCheck = await query(
            "SELECT 1 FROM adm_admin_page_permissions WHERE user_id = ? AND feature_key = 'system:license-renewal'", 
            [user.id]
          );
          const superRes = await query("SELECT value FROM app_settings WHERE `key` = 'super_admin_id'").catch(()=>({rows:[]}));
          const superIdVal = superRes[0]?.value || (superRes.rows && superRes.rows[0]?.value);
          const superId = superIdVal ? parseInt(superIdVal, 10) : 1;
          
          const canRenew = (user.id === superId) || (permCheck && permCheck.length > 0);

          const error = httpError(403, "LICENSE_EXPIRED", licenseStatus.reason || "Your company license has expired. Please contact your administrator to renew.");
          error.companyId = user.company_id;
          error.canRenew = canRenew;
          throw error;
        }
      }
    }

    await completeLogin(req, res, user, Boolean(value.rememberMe));
    // #region debug-point A:login-success
    postDebugEvent(
      "A",
      "server/controllers/auth.controller.js:login",
      "[DEBUG] login success",
      {
        userId: Number(user?.id || 0) || null,
        elapsedMs: Date.now() - loginStartedAt,
      },
    );
    // #endregion
  } catch (err) {
    // #region debug-point D:login-error
    postDebugEvent(
      "D",
      "server/controllers/auth.controller.js:login",
      "[DEBUG] login error",
      {
        elapsedMs: Date.now() - loginStartedAt,
        errorCode: err?.code || null,
        companyId: err?.companyId || null,
        errorMessage: err?.message || String(err),
        sqlMessage: err?.sqlMessage || null,
      },
    );
    // #endregion
    console.error("Login Error:", err);
    next(err);
  }
};

export const refreshAccessToken = async (req, res, next) => {
  try {
    const refreshToken = readRefreshTokenFromRequest(req);
    if (!refreshToken) {
      throw httpError(401, "INVALID_REFRESH_TOKEN", "Refresh token is missing");
    }

    const session = await rotateRefreshSession(refreshToken);
    await sendAuthResponse(req, res, session);
  } catch (err) {
    clearRefreshTokenCookie(req, res);
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const refreshToken = readRefreshTokenFromRequest(req);
    if (refreshToken) {
      await revokeRefreshToken(refreshToken).catch(() => {});
    }

    const cookies = parseCookieHeader(req.headers.cookie || "");
    const sessionId = cookies.omnisuite_session;
    if (sessionId) {
      await cacheDel(`omnisuite_session:${sessionId}`).catch(() => {});
    }

    const isProd = process.env.NODE_ENV === "production";
    const origin = req.headers.origin || "";
    const useDomain = isProd && origin.includes("omnisuite-erp.com");

    res.clearCookie("omnisuite_session", {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      ...(useDomain ? { domain: ".omnisuite-erp.com" } : {}),
    });
    clearRefreshTokenCookie(req, res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const requestPasswordResetOtp = async (req, res, next) => {
  try {
    await ensureAuthTables();
    const { value, error } = forgotRequestSchema.validate(req.body);
    if (error) throw httpError(400, "VALIDATION_ERROR", error.message);
    const users = await query(
      `
      SELECT id, username, email, is_active,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE username = :username
      LIMIT 1
      `,
      { username: value.username },
    );
    if (!users.length) throw httpError(404, "NOT_FOUND", "User not found");
    const user = users[0];
    if (!user.is_active)
      throw httpError(403, "USER_INACTIVE", "User is inactive");
    if (!user.email)
      throw httpError(400, "VALIDATION_ERROR", "User has no registered email");
    if (
      String(user.email).toLowerCase() !== String(value.email).toLowerCase()
    ) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "Email does not match registered address",
      );
    }
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS adm_password_resets (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          username VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL,
          otp_code VARCHAR(10) NOT NULL,
          expires_at DATETIME NOT NULL,
          used TINYINT(1) NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          INDEX idx_user (user_id),
          INDEX idx_username (username),
          INDEX idx_otp (otp_code),
          INDEX idx_expires_used (expires_at, used)
        )
      `);
    } catch (e) {
      console.error("Failed to ensure adm_password_resets table:", e);
      throw httpError(
        500,
        "SERVER_ERROR",
        "Could not initialize password reset store",
      );
    }
    await query(
      `UPDATE adm_password_resets SET used = 1 WHERE user_id = :userId AND used = 0`,
      { userId: user.id },
    );
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await query(
      `
      INSERT INTO adm_password_resets (user_id, username, email, otp_code, expires_at)
      VALUES (:user_id, :username, :email, :otp_code, DATE_ADD(NOW(), INTERVAL 30 MINUTE))
      `,
      {
        user_id: user.id,
        username: user.username,
        email: user.email,
        otp_code: otp,
      },
    );
    const subject = "Omnisuite ERP Password Reset OTP";
    const text = `Your OTP is ${otp}. It expires in 30 minutes.`;
    const html = `<p>Your OTP is <strong>${otp}</strong>. It expires in 30 minutes.</p>`;
    const mailed = await sendMail({
      to: user.email,
      subject,
      text,
      html,
      meta: {
        moduleName: "Authentication",
        action: "EMAIL_SENT",
        userId: user.id,
        companyId: null,
        branchId,
        branchIdsStr: null,
        message: `Password reset OTP sent to ${user.email}`,
        urlPath: "/api/forgot-password/request-otp",
      },
    });
    if (!mailed || !isMailerConfigured()) {
      console.log(
        `[MOCK EMAIL] To: ${user.email} | Subject: ${subject} | Body: ${text}`,
      );
    }
    res.json({ message: "OTP sent to registered email" });
  } catch (err) {
    console.error("Forgot Password Request Error:", err);
    next(err);
  }
};

export const resetPasswordWithOtp = async (req, res, next) => {
  try {
    await ensureAuthTables();
    const { value, error } = resetPasswordSchema.validate(req.body);
    if (error) throw httpError(400, "VALIDATION_ERROR", error.message);
    const users = await query(
      `
      SELECT id, username, email, is_active,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE username = :username
      LIMIT 1
      `,
      { username: value.username },
    );
    if (!users.length) throw httpError(404, "NOT_FOUND", "User not found");
    const user = users[0];
    if (!user.is_active)
      throw httpError(403, "USER_INACTIVE", "User is inactive");
    let otpRows = [];
    try {
      otpRows = await query(
        `
        SELECT id, otp_code, expires_at, used,
          created_at,
          u.username AS created_by_name
         FROM adm_password_resets
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :userId AND username = :username AND otp_code = :otp AND used = 0 AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        `,
        { userId: user.id, username: user.username, otp: value.otp },
      );
    } catch (e) {
      console.error("Password reset select error:", e);
      otpRows = [];
    }
    if (!otpRows.length)
      throw httpError(400, "VALIDATION_ERROR", "Invalid or expired OTP");
    const resetRow = otpRows[0];
    if (resetRow.used)
      throw httpError(400, "VALIDATION_ERROR", "OTP already used");
    const saltRounds = 10;
    const hash = await bcrypt.hash(value.new_password, saltRounds);
    await query(
      `UPDATE adm_users SET password_hash = :hash WHERE id = :userId`,
      { hash, userId: user.id },
    );
    await query(`UPDATE adm_password_resets SET used = 1 WHERE id = :id`, {
      id: resetRow.id,
    });
    await resetFailedLoginAttempts(user.id);
    await revokeUserRefreshTokens(user.id);
    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Forgot Password Reset Error:", err);
    next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub || req.user?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { currentPassword, newPassword, confirmNewPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "All password fields are required",
      );
    }
    if (newPassword.length < 8) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "New password must be at least 8 characters",
      );
    }
    if (newPassword !== confirmNewPassword) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "New password and confirm password do not match",
      );
    }

    const [user] = await query(
      `SELECT id, username, password_hash FROM adm_users WHERE id = :userId LIMIT 1`,
      { userId },
    );
    if (!user) {
      throw httpError(404, "NOT_FOUND", "User not found");
    }

    const passwordOk = await isPasswordMatch(
      currentPassword,
      user.password_hash,
      user.username,
    );
    if (!passwordOk) {
      throw httpError(400, "VALIDATION_ERROR", "Current password is incorrect");
    }

    const saltRounds = 10;
    const hash = await bcrypt.hash(newPassword, saltRounds);
    await query(
      `UPDATE adm_users SET password_hash = ?, status = 'Y' WHERE id = ?`,
      [hash, user.id],
    );
    await revokeUserRefreshTokens(user.id);

    res.json({ message: "Password changed successfully", status: "Y" });
  } catch (err) {
    next(err);
  }
};

export const updateCurrentUserPhoto = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub || req.user?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { profile_picture } = req.body;
    let buffer = null;
    if (profile_picture && typeof profile_picture === "string") {
      buffer = Buffer.from(
        String(profile_picture).replace(/^data:[^;]+;base64,/, ""),
        "base64",
      );
    }

    await query(
      "UPDATE adm_users SET profile_picture = :profile_picture WHERE id = :userId",
      { profile_picture: buffer, userId },
    );

    const [user] = await query(
      `SELECT u.id, u.username, u.email, u.full_name,
         u.role_id, r.name AS role_name,
         IF(u.profile_picture IS NULL, NULL, IF(LEFT(u.profile_picture, 4) = 'http' OR LEFT(u.profile_picture, 5) = 'data:', CONVERT(u.profile_picture USING utf8), CONCAT('data:image/jpeg;base64,', REPLACE(TO_BASE64(u.profile_picture), '\\n', '')))) AS profile_picture_url
         FROM adm_users u
         LEFT JOIN adm_roles r ON r.id = u.role_id
         WHERE u.id = :userId`,
      { userId },
    );

    res.json({ user: user || null, message: "Photo updated" });
  } catch (err) {
    next(err);
  }
};
export const getCurrentUser = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub || req.user?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const baseUser = await getUserForAuth(userId);
    if (!baseUser) return res.status(404).json({ message: "User not found" });
    const permissions = await getUserPermissions(userId).catch(() => []);
    const authUser = await buildAuthUserPayload(baseUser, permissions);
    const [userMeta] = await query(
      `SELECT u.id, u.username, u.email, u.full_name,
         u.role_id, r.name AS role_name,
         IF(u.profile_picture IS NULL, NULL, IF(LEFT(u.profile_picture, 4) = 'http' OR LEFT(u.profile_picture, 5) = 'data:', CONVERT(u.profile_picture USING utf8), CONCAT('data:image/jpeg;base64,', REPLACE(TO_BASE64(u.profile_picture), '\\n', '')))) AS profile_picture_url
         FROM adm_users u
         LEFT JOIN adm_roles r ON r.id = u.role_id
         WHERE u.id = :userId`,
      { userId },
    );
    res.json({
      user: {
        ...authUser,
        company_id: Number(baseUser.company_id || 0) || null,
        branch_id: Number(baseUser.branch_id || 0) || null,
        role_id: Number(userMeta?.role_id || 0) || null,
        role_name: userMeta?.role_name || null,
        profile_picture_url:
          userMeta?.profile_picture_url || authUser.profile_picture_url || null,
      },
      scope: {
        companyId:
          Number(baseUser.company_id || authUser?.companyIds?.[0] || 0) || null,
        branchId:
          Number(baseUser.branch_id || authUser?.branchIds?.[0] || 0) || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getMyBranches = async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub || req.user?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { ensureUserBranchMapping } = await import("../utils/dbUtils.js");
    await ensureUserBranchMapping();
    const items = await query(
      `
      SELECT b.id, b.company_id, b.name, b.code, c.name AS company_name
        FROM adm_user_branches ub
       JOIN adm_branches b ON b.id = ub.branch_id
       JOIN adm_companies c ON c.id = b.company_id
       WHERE ub.user_id = :userId
    ORDER BY c.name ASC, b.name ASC
    `,
      { userId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};
