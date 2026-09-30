import { httpError } from "../utils/httpError.js";
import {
  verifyAccessToken,
  lookupGraceToken,
} from "../services/token.service.js";
import { query } from "../db/pool.js";
import { parseCookieHeader } from "../services/token.service.js";
import { cacheGet, cacheSet } from "../utils/redis.js";
import "../utils/loadServerEnv.js";

// Utility function to check if authentication bypass is allowed in development environment
function allowDevBypass() {
  return (
    process.env.NODE_ENV !== "production" &&
    String(process.env.AUTH_ALLOW_DEV_BYPASS || "").trim() === "1"
  );
}

// Utility function to attach a mock developer user to the request for development bypassing
function attachDevUser(req) {
  req.user = {
    sub: 1,
    id: 1,
    username: "dev",
    email: "dev@local",
    permissions: ["*"],
    companyIds: [1],
    branchIds: [1],
  };
}

/**
 * Middleware to require a valid access token.
 * Sets req.user and req.permissions if successful.
 * Uses Redis grace period to accept recently-refreshed tokens during transition.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export async function requireAuth(req, res, next) {
  try {
    const cookies = parseCookieHeader(req.headers.cookie || "");
    const sessionId = cookies.omnisuite_session;
    const authHeader = String(req.headers.authorization || "");
    const customHeader = String(req.headers["x-access-token"] || "");
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : customHeader.trim();

    const debugAuth = String(process.env.DEBUG_AUTH || "").trim() === "1";
    if (debugAuth) {
      console.log(
        `[AUTH-MIDDLEWARE] Cookie header: ${req.headers.cookie ? req.headers.cookie.substring(0, 50) + "..." : "empty"}, sessionId: ${sessionId ? sessionId.substring(0, 8) + "..." : "none"}`,
      );
    }

    if (sessionId) {
      const sessionData = await cacheGet(`omnisuite_session:${sessionId}`);
      if (debugAuth) {
        console.log(
          `[AUTH-MIDDLEWARE] Looking up omnisuite_session:${sessionId.substring(0, 8)}... found: ${sessionData ? "YES" : "NO"}`,
        );
      }

      if (sessionData && sessionData.user) {
        // Slide session TTL
        const ttlSeconds =
          Number(process.env.SESSION_REFRESH_HOURS || 7 * 24) * 60 * 60;
        await cacheSet(
          `omnisuite_session:${sessionId}`,
          sessionData,
          ttlSeconds,
        ).catch(() => {});
        if (debugAuth) {
          console.log(
            `[AUTH-MIDDLEWARE] Session authenticated for user: ${sessionData.user.username}`,
          );
        }

        req.user = {
          ...(req.user || {}),
          ...sessionData.user,
        };
        req.scope = req.scope || {};
        req.scope.userId =
          Number(sessionData.user.sub || sessionData.user.id) || null;
        return next();
      }
    }

    if (bearerToken) {
      try {
        const payload = verifyAccessToken(bearerToken);
        req.user = {
          ...(req.user || {}),
          ...payload,
        };
        req.scope = req.scope || {};
        req.scope.userId = Number(payload.sub || payload.id) || null;
        if (debugAuth) {
          console.log(
            `[AUTH-MIDDLEWARE] Bearer token authenticated for user: ${payload.username || payload.sub || payload.id}`,
          );
        }
        return next();
      } catch (tokenErr) {
        const gracePayload = await lookupGraceToken(bearerToken);
        if (gracePayload) {
          req.user = {
            ...(req.user || {}),
            ...gracePayload,
          };
          req.scope = req.scope || {};
          req.scope.userId =
            Number(gracePayload.sub || gracePayload.id) || null;
          if (debugAuth) {
            console.log(
              `[AUTH-MIDDLEWARE] Grace token authenticated for user: ${gracePayload.username || gracePayload.sub || gracePayload.id}`,
            );
          }
          return next();
        }
        if (debugAuth) {
          console.warn(
            `[AUTH-MIDDLEWARE] Bearer token rejected: ${tokenErr?.message || tokenErr}`,
          );
        }
      }
    }

    if (debugAuth) {
      console.log(`[AUTH-MIDDLEWARE] No valid session found, returning 401`);
    }

    // If token is missing but dev bypass is allowed, attach dev user
    if (allowDevBypass()) {
      attachDevUser(req);
      req.scope = req.scope || {};
      req.scope.userId = 1;
      return next();
    }

    return next(httpError(401, "UNAUTHORIZED", "Authentication required"));
  } catch (err) {
    if (allowDevBypass()) {
      attachDevUser(req);
      req.scope = req.scope || {};
      req.scope.userId = 1;
      return next();
    }
    return next(httpError(401, "INVALID_TOKEN", "Invalid or expired session"));
  }
}

/**
 * Middleware to enforce company scope based on headers.
 * Ensures the user has access to the requested company.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export async function requireCompanyScope(req, res, next) {
  if (!req.user) {
    return next(httpError(401, "UNAUTHORIZED", "Authentication required"));
  }

  req.scope = req.scope || {};

  const rawId = process.env.LICENSE_SUPER_ADMIN_ID;
  const superAdminId = rawId ? parseInt(String(rawId).trim(), 10) : 1;

  // Admin (ID 1 or Super Admin ID) can access any requested company
  if (Number(req.user.id) === superAdminId) {
    const companyId = Number(
      req.headers["x-company-id"] || req.query.companyId || req.user?.company_id || 1,
    );
    req.scope.companyId = companyId;
    return next();
  }

  // Determine allowed company IDs for non-admin user
  const allowedCompanies = Array.isArray(req.user?.companyIds) && req.user.companyIds.length > 0
    ? req.user.companyIds.map(Number)
    : req.user?.company_id ? [Number(req.user.company_id)] : [];

  // Default company ID fallback
  const defaultCompanyId = allowedCompanies[0] || 1;
  const requestedCompanyId = Number(
    req.headers["x-company-id"] || req.query.companyId || defaultCompanyId
  );

  // Validate that user has access to the requested company
  if (allowedCompanies.length > 0 && !allowedCompanies.includes(requestedCompanyId)) {
    // Fallback: Check database dynamically in case the JWT payload is stale
    const [rows] = await query(
      "SELECT 1 FROM adm_user_branches WHERE user_id = :userId AND company_id = :companyId LIMIT 1",
      { userId: req.user.id || req.user.sub, companyId: requestedCompanyId }
    );
    if (!rows || !rows.length) {
      return next(httpError(403, "FORBIDDEN", "Company access denied"));
    }
  }

  req.scope.companyId = requestedCompanyId;
  return next();
}

export async function requireBranchScope(req, res, next) {
  try {
    if (!req.user) {
      return next(httpError(401, "UNAUTHORIZED", "Authentication required"));
    }

    // Get branch ID from headers, query, or user's allowed branches
    const rawBranchId = req.headers["x-branch-id"] || req.query.branchId;
    req.scope = req.scope || {};

    const branchId = Number(rawBranchId || req.user?.branchIds?.[0] || 1);
    req.scope.branchId = branchId;

    const rawId = process.env.LICENSE_SUPER_ADMIN_ID;
    const superAdminId = rawId ? parseInt(String(rawId).trim(), 10) : 1;

    // Admin bypass: allow 'all' branches or fetch superbranch hierarchy dynamically
    if (Number(req.user.id) === superAdminId) {
      if (rawBranchId === "all") {
        req.scope.branchId = "all";
        req.scope.branchIdsStr = "";
        return next();
      }
      req.scope.branchIdsStr = String(branchId);

      // Let's also support superbranch for admin dynamically!
      const [b] = await query(
        "SELECT is_superbranch FROM adm_branches WHERE id = :branchId",
        { branchId },
      );
      if (b?.is_superbranch) {
        const childBranches = await query(
          "SELECT id FROM adm_branches WHERE parent_branch_id = :branchId",
          { branchId },
        );
        const allRelated = [branchId, ...childBranches.map((x) => x.id)];
        req.scope.branchIdsStr = allRelated.join(",");
      }
      return next();
    }

    // Validate that the user's allowed branches include the requested branch ID
    const allowedBranches = Array.isArray(req.user?.branchIds)
      ? req.user.branchIds.map(Number)
      : [];

    if (allowedBranches.length && !allowedBranches.includes(Number(branchId))) {
      // Fallback: Check database dynamically in case the JWT payload is stale
      const [rows] = await query(
        "SELECT 1 FROM adm_user_branches WHERE user_id = :userId AND branch_id = :branchId LIMIT 1",
        { userId: req.user.id || req.user.sub, branchId: Number(branchId) }
      );
      if (!rows || !rows.length) {
        return next(httpError(403, "FORBIDDEN", "Branch access denied"));
      }
    }

    req.scope.branchIdsStr = String(branchId);

    // Superbranch logic: if requested branch is a superbranch, allow access to its children
    const [b] = await query(
      "SELECT is_superbranch FROM adm_branches WHERE id = :branchId",
      { branchId },
    );
    if (b?.is_superbranch) {
      const childBranches = await query(
        "SELECT id FROM adm_branches WHERE parent_branch_id = :branchId",
        { branchId },
      );
      const childIds = childBranches.map((x) => Number(x.id));
      // Intersection: user's allowed branches that are either the superbranch or its children
      const validIds = [branchId, ...childIds].filter((id) =>
        allowedBranches.includes(id),
      );
      req.scope.branchIdsStr = validIds.join(",");
    }

    return next();
  } catch (err) {
    return next(err);
  }
}
