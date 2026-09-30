import { cacheGet, cacheSet } from "../utils/redis.js";

/**
 * Middleware to cache list responses (GET requests only).
 * Intended to be placed after authentication and scope middlewares.
 * 
 * @param {number} ttlSeconds - Time-To-Live for the cache in seconds.
 */
export function cacheListResponse(ttlSeconds = 60) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const companyId = req.scope?.companyId || "global";
    const branchId = req.scope?.branchId || "global";
    
    // Create a deterministic cache key including all query params
    const queryStr = new URLSearchParams(req.query).toString();
    const key = `cache:GET:${companyId}:${branchId}:${req.originalUrl.split('?')[0]}:${queryStr}`;

    try {
      const cached = await cacheGet(key);
      if (cached) {
        return res.json(cached);
      }

      // Intercept res.json
      const originalJson = res.json;
      res.json = function (body) {
        // Only cache if it's a successful response
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheSet(key, body, ttlSeconds).catch(err => {
            console.error("[Cache Middleware] Failed to set cache:", err);
          });
        }
        return originalJson.call(this, body);
      };
      
      next();
    } catch (e) {
      console.error("[Cache Middleware] Error:", e);
      next();
    }
  };
}
