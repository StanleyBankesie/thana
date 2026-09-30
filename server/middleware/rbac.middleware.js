import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { permissionCache } from "../utils/permissionCache.js";

// Get user role ID (with Redis cache)
async function getUserRoleId(userId) {
  // Check Redis cache first
  const cached = await permissionCache.getRoleId(userId);
  if (cached !== null) return cached;

  // Fallback to DB
  const result = await query(
    `SELECT role_id FROM adm_users WHERE id = :userId`,
    { userId }
  );
  const roleId = result.length > 0 ? result[0].role_id : null;

  // Cache for next time
  if (roleId !== null) {
    await permissionCache.setRoleId(userId, roleId);
  }

  return roleId;
}

// Check module access
export async function checkModuleAccess(moduleKey) {
  return async function (req, res, next) {
    try {
      // Verify if a user is authenticated before checking module access
      const userId = Number(req.user?.sub || req.user?.id);
      if (!userId) {
        return next(httpError(401, "Authentication required"));
      }

      // Fetch the role ID assigned to the user
      const roleId = await getUserRoleId(userId);
      if (!roleId) {
        return next(httpError(403, "No role assigned to user"));
      }

      // Query the database to check if the role has access to the requested module
      const moduleAccess = await query(
        `SELECT 1 FROM adm_role_modules 
         WHERE role_id = :roleId AND module_key = :moduleKey 
         LIMIT 1`,
        { roleId, moduleKey }
      );

      if (moduleAccess.length === 0) {
        return next(httpError(403, `Access denied to module: ${moduleKey}`));
      }

      // Attach the verified role information to the request for subsequent use
      req.userRole = { id: roleId, moduleKey };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// Check feature access with action
export async function checkFeatureAccess(featureKey, action = "view") {
  return async function (req, res, next) {
    try {
      // Verify user authentication and retrieve role ID
      const userId = Number(req.user?.sub || req.user?.id);
      if (!userId) {
        return next(httpError(401, "Authentication required"));
      }

      // Fetch the role ID assigned to the user
      const roleId = await getUserRoleId(userId);
      if (!roleId) {
        return next(httpError(403, "No role assigned to user"));
      }

      // Extract module key from feature key (expected format: 'module:feature')
      const [moduleKey] = String(featureKey || "").split(":");
      if (!moduleKey) {
        return next(httpError(400, "Invalid feature key format"));
      }

      // Query to ensure the user has access to the module first
      const moduleAccess = await query(
        `SELECT 1 FROM adm_role_modules 
         WHERE role_id = :roleId AND module_key = :moduleKey 
         LIMIT 1`,
        { roleId, moduleKey }
      );

      if (moduleAccess.length === 0) {
        return next(httpError(403, `Access denied to module: ${moduleKey}`));
      }

      // Check feature permission
      const permission = await query(
        `SELECT can_view, can_create, can_edit, can_delete 
         FROM adm_role_permissions 
         WHERE role_id = :roleId AND feature_key = :featureKey 
         LIMIT 1`,
        { roleId, featureKey }
      );

      if (permission.length === 0) {
        return next(httpError(403, `Feature not assigned: ${featureKey}`));
      }

      // Determine which action column to check based on the requested action
      const actionColumn = action === "create" ? "can_create" : 
                          action === "edit" ? "can_edit" : 
                          action === "delete" ? "can_delete" : "can_view";

      // Ensure the user has the required action permission for the feature
      if (!permission[0][actionColumn]) {
        return next(httpError(403, `Action '${action}' not allowed for feature: ${featureKey}`));
      }

      // Attach detailed permission information to the request
      req.userPermissions = permission[0];
      req.featureKey = featureKey;
      req.moduleKey = moduleKey;

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// Helper middleware to get user permissions for frontend
/**
 * Middleware that fetches and attaches a user's full permission set to the request.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export async function getUserPermissions(req, res, next) {
  try {
    // Verify authentication and retrieve role ID
    const userId = Number(req.user?.sub || req.user?.id);
    if (!userId) {
      return next(httpError(401, "Authentication required"));
    }

    // Check Redis cache for modules and features
    const cachedModules = await permissionCache.getModules(userId);
    const cachedFeatures = await permissionCache.getFeatures(userId);

    if (cachedModules !== null && cachedFeatures !== null) {
      return res.json({ modules: cachedModules, permissions: cachedFeatures });
    }

    const roleId = await getUserRoleId(userId);
    if (!roleId) {
      return res.json({ modules: [], permissions: [] });
    }

    // Query to fetch all modules the user's role has access to
    const modules = await query(
      `SELECT module_key FROM adm_role_modules WHERE role_id = :roleId`,
      { roleId }
    );

    // Get user's permissions
    const permissions = await query(
      `SELECT module_key, feature_key, can_view, can_create, can_edit, can_delete 
       FROM adm_role_permissions WHERE role_id = :roleId`,
      { roleId }
    );

    const moduleKeys = modules.map(m => m.module_key);
    const permissionList = permissions;

    // Cache in Redis
    await permissionCache.setModules(userId, moduleKeys);
    await permissionCache.setFeatures(userId, permissionList);

    // Return the collected modules and permissions in the response
    res.json({ modules: moduleKeys, permissions: permissionList });
  } catch (err) {
    next(err);
  }
}
