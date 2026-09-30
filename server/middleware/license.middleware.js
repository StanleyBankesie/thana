import { validateCompanyLicense, checkModuleAccess } from "../services/license.service.js";

/**
 * Middleware to check if the company has a valid active license.
 * Blocks API access if the license is expired (past grace period) or suspended.
 */
export async function requireLicense(req, res, next) {
  try {
    // Bypass license verification for auth, login, license endpoints, or user ID = 1 (Super Admin)
    if (req.user && Number(req.user.id) === 1) {
      return next();
    }
    const url = req.originalUrl || req.url || "";
    if (
      url.includes("/api/licenses") ||
      url.includes("/api/auth") ||
      url.includes("/api/login") ||
      url.includes("/public") ||
      url.includes("/settings/login-") ||
      url.includes("/ping") ||
      url.includes("/health")
    ) {
      return next();
    }

    // If user is not authenticated or lacks companyId, let auth middleware handle it or pass.
    if (!req.user || !req.user.companyIds || req.user.companyIds.length === 0) {
      return next();
    }

    const companyId = req.user.companyIds[0]; // Assuming user belongs to one primary company context
    
    // Validate license
    const licenseCheck = await validateCompanyLicense(companyId);
    
    if (!licenseCheck.valid) {
      return res.status(403).json({
        error: "LICENSE_INVALID",
        message: licenseCheck.reason || "Your company license is invalid or expired."
      });
    }

    // Attach license info to request for downstream use
    req.license = licenseCheck;
    
    next();
  } catch (error) {
    console.error("[License Middleware] Error validating license:", error);
    // On internal error, allow request to proceed so we don't break production on cache failure
    next();
  }
}

/**
 * Middleware factory to check if the company has access to a specific module.
 * Requires requireLicense to be run first.
 */
export function requireModule(moduleCode) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.companyIds || req.user.companyIds.length === 0 || Number(req.user.id) === 1) {
        return next();
      }

      const companyId = req.user.companyIds[0];
      const hasAccess = await checkModuleAccess(companyId, moduleCode);

      if (!hasAccess) {
        return res.status(403).json({
          error: "MODULE_NOT_LICENSED",
          message: `This module (${moduleCode}) is not included in your subscription.`
        });
      }

      next();
    } catch (error) {
      console.error(`[License Middleware] Error validating module ${moduleCode}:`, error);
      next();
    }
  };
}
