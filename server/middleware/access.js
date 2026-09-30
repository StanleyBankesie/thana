/**
 * @file access.js
 * @description Middleware for checking module and feature access permissions.
 */
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { toNumber } from "../utils/dbUtils.js";

// Utility function to fetch user's role ID from the database
export async function getUserRoleId(userId) {
  const rows = await query(
    "SELECT role_id FROM adm_users WHERE id = :id LIMIT 1",
    { id: userId },
  );
  const directRoleId = toNumber(rows?.[0]?.role_id);
  if (directRoleId) return directRoleId;

  // Backward compatibility: some deployments still map roles in adm_user_roles.
  // Fallback to fetching role ID from adm_user_roles if not found on adm_users
  const fallbackRows = await query(
    `SELECT ur.role_id
       FROM adm_user_roles ur
       JOIN adm_roles r ON r.id = ur.role_id
      WHERE ur.user_id = :id
        AND COALESCE(r.is_active, 1) = 1
      ORDER BY ur.created_at DESC, ur.role_id DESC
      LIMIT 1`,
    { id: userId },
  ).catch(() => []);
  return toNumber(fallbackRows?.[0]?.role_id) || null;
}

/**
 * Middleware to verify if a user's role has access to a specific module.
 * 
 * @param {string} moduleKey - The unique key of the module.
 * @returns {Function} Express middleware function.
 */
export function checkModuleAccess(moduleKey) {
  return async function (req, res, next) {
    try {
      const url = String(req.originalUrl || req.baseUrl || "");
      // Allow workflow submit for Sales Orders to proceed to permission checks downstream
      // This endpoint also has its own permission gate; skip module gate here to avoid false negatives
      if (url.includes("/api/sales/orders/") && url.includes("/submit")) {
        return next();
      }
      // Get user ID from request object; deny access if not authenticated
      const userId = toNumber(req.user?.sub || req.user?.id);
      if (!userId)
        return next(httpError(401, "UNAUTHORIZED", "Login required"));
      // Grant full access if user has a wildcard permission
      if (
        Array.isArray(req.user?.permissions) &&
        req.user.permissions.includes("*")
      ) {
        return next();
      }
      // Fetch user role; deny if no role assigned
      const roleId = await getUserRoleId(userId);
      if (!roleId) {
        return next(httpError(403, "FORBIDDEN", "No role assigned"));
      }
      // Check for module-level access or wildcard access in adm_role_modules
      const rows = await query(
        `SELECT 1 
         FROM adm_role_modules 
         WHERE role_id = :roleId
           AND (LOWER(module_key) = LOWER(:moduleKey) OR module_key = '*')
         LIMIT 1`,
        { roleId, moduleKey },
      );
      if (!rows.length) {
        // Fallback: Check if there is view permission for this module in adm_role_permissions
        const permRows = await query(
          `SELECT 1
           FROM adm_role_permissions
           WHERE role_id = :roleId
             AND (LOWER(module_key) = LOWER(:moduleKey) OR module_key = '*')
             AND can_view = 1
           LIMIT 1`,
          { roleId, moduleKey },
        );
        if (permRows.length) {
          return next();
        }
        // Fallback: Check if there is any feature-level access for this module in adm_role_features
        const featureRows = await query(
          `SELECT 1
           FROM adm_role_features
           WHERE role_id = :roleId
             AND LOWER(feature_key) LIKE CONCAT(LOWER(:moduleKey), ':%')
           LIMIT 1`,
          { roleId, moduleKey },
        ).catch(() => []);
        if (featureRows && featureRows.length) {
          return next();
        }
        console.warn(
          "[RBAC] 403 Module access denied",
          JSON.stringify({ userId, roleId, moduleKey, path: req.originalUrl }),
        );
        return next(httpError(403, "FORBIDDEN", "Module access denied"));
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// Middleware to verify if a user has access to a specific feature
export function checkFeatureAccess(featureKey) {
  return async function (req, res, next) {
    try {
      // Get user ID from request object; deny access if not authenticated
      const userId = toNumber(req.user?.sub || req.user?.id);
      if (!userId)
        return next(httpError(401, "UNAUTHORIZED", "Login required"));
      if (
        Array.isArray(req.user?.permissions) &&
        req.user.permissions.includes("*")
      ) {
        req.userPermissions = null;
        const [moduleKey] = String(featureKey || "").split(":");
        req.featureKey = featureKey;
        req.moduleKey = moduleKey;
        return next();
      }

      // Fetch user role; deny if no role assigned
      const roleId = await getUserRoleId(userId);
      if (!roleId) {
        return next(httpError(403, "FORBIDDEN", "No role assigned"));
      }

      // Check if user has module access
      const [moduleKey] = String(featureKey || "").split(":");
      if (!moduleKey) {
        return next(httpError(403, "FORBIDDEN", "Invalid feature key"));
      }

      const moduleAccess = await query(
        `SELECT 1 FROM adm_role_modules 
         WHERE role_id = :roleId
           AND (LOWER(module_key) = LOWER(:moduleKey) OR module_key = '*')
         LIMIT 1`,
        { roleId, moduleKey },
      );

      if (!moduleAccess.length) {
        return next(httpError(403, "FORBIDDEN", "Module access denied"));
      }

      // Deprecated: feature-level permission and user feature overrides

      // Feature allowlist removed: any feature under an enabled module is allowed

      // Attach basic info to request for later use
      req.userPermissions = null;
      req.featureKey = featureKey;
      req.moduleKey = moduleKey;

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// Middleware to verify if a user can perform a specific action (e.g., create, edit) on a feature
export function checkFeatureAction(featureKey, action) {
  return async function (req, res, next) {
    try {
      // First check basic feature access
      const basicCheck = checkFeatureAccess(featureKey);
      await basicCheck(req, res, async (err) => {
        if (err) return next(err);

        // Then check specific action at module level
        const userId = toNumber(req.user?.sub || req.user?.id);
        const roleId = await getUserRoleId(userId);
        const moduleKey = req.moduleKey;
        const actionKey = String(action || "view").toLowerCase();
        // Check for specific action permission (view, create, edit, delete) on the feature
        const row = await query(
          `SELECT can_view, can_create, can_edit, can_delete
           FROM adm_role_permissions 
           WHERE role_id = :roleId
             AND feature_key = :featureKey
           LIMIT 1`,
          { roleId, featureKey },
        );
        // Fallback: Check if the action is allowed at the module level
        const fallbackRow = row.length
          ? row
          : await query(
              `SELECT
               MAX(COALESCE(can_view, 0)) AS can_view,
               MAX(COALESCE(can_create, 0)) AS can_create,
               MAX(COALESCE(can_edit, 0)) AS can_edit,
               MAX(COALESCE(can_delete, 0)) AS can_delete
             FROM adm_role_permissions
             WHERE role_id = :roleId
               AND (LOWER(module_key) = LOWER(:moduleKey) OR module_key = '*')
           LIMIT 1`,
              { roleId, moduleKey },
            );
        const col =
          actionKey === "create"
            ? "can_create"
            : actionKey === "edit"
              ? "can_edit"
              : actionKey === "delete"
                ? "can_delete"
                : "can_view";
        const allowed = !!fallbackRow?.[0]?.[col];
        if (!allowed) {
          return next(httpError(403, "FORBIDDEN", "Action not allowed"));
        }

        return next();
      });
    } catch (err) {
      return next(err);
    }
  };
}

// Middleware to verify if a user can perform a specific action on a module
export function checkModuleAction(moduleKey, action) {
  return async function (req, res, next) {
    try {
      // Grant full access if user has a wildcard permission
      if (
        Array.isArray(req.user?.permissions) &&
        req.user.permissions.includes("*")
      ) {
        return next();
      }
      // Execute basic module access check first
      const m1 = checkModuleAccess(moduleKey);
      await m1(req, res, async (err) => {
        if (err) return next(err);
        // Retrieve user and role ID for permission check
        const userId = toNumber(req.user?.sub || req.user?.id);
        const roleId = await getUserRoleId(userId);
        const actionKey = String(action || "view").toLowerCase();
        // Check if the specific action is allowed at the module level based on adm_role_permissions
        const row = await query(
          `SELECT
             MAX(COALESCE(can_view, 0)) AS can_view,
             MAX(COALESCE(can_create, 0)) AS can_create,
             MAX(COALESCE(can_edit, 0)) AS can_edit,
             MAX(COALESCE(can_delete, 0)) AS can_delete
           FROM adm_role_permissions
           WHERE role_id = :roleId
             AND (LOWER(module_key) = LOWER(:moduleKey) OR module_key = '*')
           LIMIT 1`,
          { roleId, moduleKey },
        );
        const col =
          actionKey === "create"
            ? "can_create"
            : actionKey === "edit"
              ? "can_edit"
              : actionKey === "delete"
                ? "can_delete"
                : "can_view";
        const allowed = !!row?.[0]?.[col];
        if (!allowed) {
          return next(httpError(403, "FORBIDDEN", "Action not allowed"));
        }
        return next();
      });
    } catch (err) {
      return next(err);
    }
  };
}
