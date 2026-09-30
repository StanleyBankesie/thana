import { checkModuleAccess, checkModuleAction } from "./access.js";
import { httpError } from "../utils/httpError.js";

// Utility function to map a raw permission key (e.g., 'SALES.CREATE') to its corresponding module and action
function mapPermissionKeyToModuleAndAction(key) {
  const raw = String(key || "").toUpperCase();
  const prefix = raw.split(".")[0];
  // Dictionary mapping permission prefixes to their standard module keys
  const moduleMap = {
    ADMIN: "administration",
    SALES: "sales",
    SAL: "sales",
    INVENTORY: "inventory",
    INV: "inventory",
    PURCHASE: "purchase",
    PUR: "purchase",
    FIN: "finance",
    HR: "human-resources",
    POS: "pos",
    BI: "business-intelligence",
    MAINT: "maintenance",
    PROD: "production",
    PROJ: "project-management",
    SERVICE: "service-management",
    SVC: "service-management",
    TRANSPORT: "transport",
  };
  const moduleKey = moduleMap[prefix] || "";
  let action = "view";
  // Determine the appropriate action (create, delete, edit, view) based on the permission key
  if (raw.includes("CREATE")) action = "create";
  else if (raw.includes("DELETE")) action = "delete";
  else if (raw.includes("EDIT") || raw.includes("MANAGE")) action = "edit";
  else action = "view";
  return { moduleKey, action };
}

// Middleware to verify if a user has access to a specific module
export function requireModule(moduleKey) {
  return function composedModule(req, res, next) {
    const rawId = process.env.LICENSE_SUPER_ADMIN_ID;
    const superAdminId = rawId ? parseInt(String(rawId).trim(), 10) : 1;
    const userId = req.user?.sub || req.user?.id;
    if (userId && Number(userId) === Number(superAdminId)) {
      return next();
    }

    const mk = String(moduleKey || "");
    // Fallback to next middleware if module key is missing
    if (!mk) return next();
    // Use the underlying checkModuleAccess logic to verify access
    const m = checkModuleAccess(mk);
    m(req, res, next);
  };
}

/**
 * Middleware that checks if the authenticated user has a specific permission.
 *
 * @param {string} permissionKey - The permission code required.
 * @returns {Function} Express middleware function.
 */
export function requirePermission(permissionKey) {
  return function composedMiddleware(req, res, next) {
    const rawId = process.env.LICENSE_SUPER_ADMIN_ID;
    const superAdminId = rawId ? parseInt(String(rawId).trim(), 10) : 1;
    const userId = req.user?.sub || req.user?.id;
    if (userId && Number(userId) === Number(superAdminId)) {
      return next();
    }

    const url = String(req.baseUrl || req.originalUrl || "");
    // Map the required permission key to a module and action
    const { moduleKey, action } =
      mapPermissionKeyToModuleAndAction(permissionKey);
    if (!moduleKey) return next();
    // Sequentially check module access, then specific module action
    const m1 = checkModuleAccess(moduleKey);
    const m2 = checkModuleAction(moduleKey, action);
    m1(req, res, (err) => {
      if (err) return next(err);
      m2(req, res, next);
    });
  };
}

// Middleware to check if a user has AT LEAST ONE of the provided permissions
export function requireAnyPermission(permissionKeys) {
  const keys = Array.isArray(permissionKeys)
    ? permissionKeys.filter(Boolean)
    : [permissionKeys].filter(Boolean);
  return async function composedAnyMiddleware(req, res, next) {
    const rawId = process.env.LICENSE_SUPER_ADMIN_ID;
    const superAdminId = rawId ? parseInt(String(rawId).trim(), 10) : 1;
    const userId = req.user?.sub || req.user?.id;
    if (userId && Number(userId) === Number(superAdminId)) {
      return next();
    }

    const url = String(req.baseUrl || req.originalUrl || "");
    if (!keys.length) return next();
    try {
      // Iterate over each permission key to find at least one valid access
      for (const k of keys) {
        const { moduleKey } = mapPermissionKeyToModuleAndAction(k);
        if (!moduleKey) continue;
        let allowed = false;
        const m1 = checkModuleAccess(moduleKey);
        await new Promise((resolve) => {
          m1(req, res, (err) => {
            if (!err) {
              allowed = true;
            }
            resolve(null);
          });
        });
        // If access is granted for the current key, proceed to the next middleware
        if (allowed) {
          return next();
        }
      }
      return next(httpError(403, "FORBIDDEN", "Module access denied"));
    } catch (err) {
      return next(err);
    }
  };
}
