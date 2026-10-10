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
  try {
    if (!req.user) {
      return next(httpError(401, "UNAUTHORIZED", "Authentication required"));
    }

    req.scope = req.scope || {};

    const rawId = process.env.LICENSE_SUPER_ADMIN_ID;
    const superAdminId = rawId ? parseInt(String(rawId).trim(), 10) : 1;
    const userId = Number(req.user.id || req.user.sub || 0);
    const userRole = String(req.user.role || req.user.role_name || "").toLowerCase();

    const isSuper =
      userId === superAdminId ||
      userId === 1 ||
      Boolean(req.user?.isSuperAdmin) ||
      Boolean(req.user?.is_super_admin) ||
      Number(req.user?.roleId || req.user?.role_id) === 1 ||
      (Array.isArray(req.user?.permissions) && req.user.permissions.includes("*")) ||
      ["admin", "superadmin", "super_admin"].includes(userRole);

    // Super user can access any requested company
    if (isSuper) {
      const companyId = Number(
        req.headers["x-company-id"] ||
        req.query.companyId ||
        req.user?.companyId ||
        req.user?.company_id ||
        1,
      );
      req.scope.companyId = companyId;
      return next();
    }

    // Determine allowed company IDs for non-admin user
    const allowedCompanies = Array.isArray(req.user?.companyIds) && req.user.companyIds.length > 0
      ? req.user.companyIds.map(Number)
      : (req.user?.companyId || req.user?.company_id)
        ? [Number(req.user.companyId || req.user.company_id)]
        : [];

    // Default company ID fallback
    const defaultCompanyId =
      allowedCompanies[0] ||
      Number(req.user?.companyId || req.user?.company_id) ||
      1;

    const requestedCompanyId = Number(
      req.headers["x-company-id"] || req.query.companyId || defaultCompanyId,
    );

    // If allowedCompanies contains requestedCompanyId, grant access immediately
    if (allowedCompanies.length > 0 && allowedCompanies.includes(requestedCompanyId)) {
      req.scope.companyId = requestedCompanyId;
      return next();
    }

    // Dynamic database check in case token payload is missing/stale
    try {
      const rows = await query(
        `SELECT 1 FROM adm_user_branches WHERE user_id = :userId AND company_id = :companyId
         UNION
         SELECT 1 FROM adm_users WHERE id = :userId AND company_id = :companyId
         LIMIT 1`,
        { userId, companyId: requestedCompanyId },
      );
      if (rows && rows.length > 0) {
        req.scope.companyId = requestedCompanyId;
        return next();
      }

      // Check if user has an admin role in the DB
      const roleRows = await query(
        `SELECT u.role_id, r.code, r.name 
         FROM adm_users u 
         LEFT JOIN adm_roles r ON u.role_id = r.id 
         WHERE u.id = :userId LIMIT 1`,
        { userId },
      ).catch(() => []);
      const rId = Number(roleRows?.[0]?.role_id || 0);
      const rCode = String(roleRows?.[0]?.code || "").toUpperCase();
      const rName = String(roleRows?.[0]?.name || "").toLowerCase();
      if (rId === 1 || rCode === "SUPER_ADMIN" || rCode === "ADMIN" || rName.includes("admin")) {
        req.scope.companyId = requestedCompanyId;
        return next();
      }

      // If user has no company assignments configured, allow default company 1
      if (allowedCompanies.length === 0 && requestedCompanyId === 1) {
        req.scope.companyId = 1;
        return next();
      }

      return next(httpError(403, "FORBIDDEN", "Company access denied"));
    } catch (err) {
      if (err?.status === 403) return next(err);
      console.error("[requireCompanyScope] Error checking company scope:", err);
      if (requestedCompanyId === defaultCompanyId) {
        req.scope.companyId = requestedCompanyId;
        return next();
      }
      return next(httpError(403, "FORBIDDEN", "Company access denied"));
    }
  } catch (err) {
    return next(err);
  }
}

export async function requireBranchScope(req, res, next) {
  try {
    if (!req.user) {
      return next(httpError(401, "UNAUTHORIZED", "Authentication required"));
    }

    const rawBranchId = req.headers["x-branch-id"] || req.query.branchId;
    req.scope = req.scope || {};

    const rawId = process.env.LICENSE_SUPER_ADMIN_ID;
    const superAdminId = rawId ? parseInt(String(rawId).trim(), 10) : 1;
    const userId = Number(req.user.id || req.user.sub || 0);
    const userRole = String(req.user.role || req.user.role_name || "").toLowerCase();

    const isSuper =
      userId === superAdminId ||
      userId === 1 ||
      Boolean(req.user?.isSuperAdmin) ||
      Boolean(req.user?.is_super_admin) ||
      Number(req.user?.roleId || req.user?.role_id) === 1 ||
      (Array.isArray(req.user?.permissions) && req.user.permissions.includes("*")) ||
      ["admin", "superadmin", "super_admin"].includes(userRole);

    // If 'all' branches requested
    if (rawBranchId === "all") {
      req.scope.branchId = "all";
      if (isSuper) {
        req.scope.branchIdsStr = "";
      } else {
        const allowed = Array.isArray(req.user?.branchIds) && req.user.branchIds.length > 0
          ? req.user.branchIds.map(Number)
          : (req.user?.branchId || req.user?.branch_id)
            ? [Number(req.user.branchId || req.user.branch_id)]
            : [];
        req.scope.branchIdsStr = allowed.join(",");
      }
      return next();
    }

    const allowedBranches = Array.isArray(req.user?.branchIds) && req.user.branchIds.length > 0
      ? req.user.branchIds.map(Number)
      : (req.user?.branchId || req.user?.branch_id)
        ? [Number(req.user.branchId || req.user.branch_id)]
        : [];

    const defaultBranchId =
      allowedBranches[0] ||
      Number(req.user?.branchId || req.user?.branch_id) ||
      1;

    const branchId = Number(
      (rawBranchId && rawBranchId !== "all") ? rawBranchId : defaultBranchId,
    );
    req.scope.branchId = branchId;

    // Super user bypass
    if (isSuper) {
      req.scope.branchIdsStr = String(branchId);
      try {
        const branchRows = await query(
          "SELECT is_superbranch FROM adm_branches WHERE id = :branchId",
          { branchId },
        );
        if (branchRows?.[0]?.is_superbranch) {
          const childBranches = await query(
            "SELECT id FROM adm_branches WHERE parent_branch_id = :branchId",
            { branchId },
          );
          const allRelated = [branchId, ...childBranches.map((x) => x.id)];
          req.scope.branchIdsStr = allRelated.join(",");
        }
      } catch (err) {
        req.scope.branchIdsStr = String(branchId);
      }
      return next();
    }

    // Non-super user validation
    let branchAccessGranted = false;
    if (allowedBranches.length > 0 && allowedBranches.includes(branchId)) {
      branchAccessGranted = true;
    } else {
      try {
        const rows = await query(
          `SELECT 1 FROM adm_user_branches WHERE user_id = :userId AND branch_id = :branchId
           UNION
           SELECT 1 FROM adm_users WHERE id = :userId AND branch_id = :branchId
           LIMIT 1`,
          { userId, branchId },
        );
        if (rows && rows.length > 0) {
          branchAccessGranted = true;
        } else {
          const roleRows = await query(
            `SELECT u.role_id, r.code, r.name 
             FROM adm_users u 
             LEFT JOIN adm_roles r ON u.role_id = r.id 
             WHERE u.id = :userId LIMIT 1`,
            { userId },
          ).catch(() => []);
          const rId = Number(roleRows?.[0]?.role_id || 0);
          const rCode = String(roleRows?.[0]?.code || "").toUpperCase();
          const rName = String(roleRows?.[0]?.name || "").toLowerCase();
          if (rId === 1 || rCode === "SUPER_ADMIN" || rCode === "ADMIN" || rName.includes("admin")) {
            branchAccessGranted = true;
          }
        }
      } catch (err) {
        console.error("[requireBranchScope] Error checking branch scope:", err);
      }
    }

    if (!branchAccessGranted) {
      if (allowedBranches.length === 0 && branchId === 1) {
        branchAccessGranted = true;
      } else {
        return next(httpError(403, "FORBIDDEN", "Branch access denied"));
      }
    }

    req.scope.branchIdsStr = String(branchId);

    // Superbranch logic for non-super user
    try {
      const branchRows = await query(
        "SELECT is_superbranch FROM adm_branches WHERE id = :branchId",
        { branchId },
      );
      if (branchRows?.[0]?.is_superbranch) {
        const childBranches = await query(
          "SELECT id FROM adm_branches WHERE parent_branch_id = :branchId",
          { branchId },
        );
        const childIds = childBranches.map((x) => Number(x.id));
        const validIds = [branchId, ...childIds].filter((id) =>
          allowedBranches.length === 0 || allowedBranches.includes(id),
        );
        req.scope.branchIdsStr = validIds.join(",");
      }
    } catch (err) {
      req.scope.branchIdsStr = String(branchId);
    }

    return next();
  } catch (err) {
    return next(err);
  }
}
