import { query } from "../db/pool.js";

/**
 * Extracts IP address and user-agent from request.
 * @param {import("express").Request} req
 * @returns {{ ip: string | null, userAgent: string | null }}
 */
export function getClientMeta(req) {
  if (!req) return { ip: null, userAgent: null };
  const forwarded = req.headers?.["x-forwarded-for"];
  const ip =
    (forwarded && String(forwarded).split(",")[0].trim()) ||
    req.ip ||
    req.socket?.remoteAddress ||
    null;
  const userAgent = req.headers?.["user-agent"] || null;
  return { ip, userAgent };
}

/**
 * Resolves a human-friendly location string from request headers, branch, company, or IP.
 * @param {import("express").Request} req
 * @param {{ branchId?: number | string, companyId?: number | string, userId?: number | string }} options
 * @returns {Promise<string>}
 */
export async function resolveUserLocation(req, options = {}) {
  try {
    const { branchId, companyId } = options || {};

    // 1. Explicit request headers if sent by frontend / proxy
    const headerLoc =
      req?.headers?.["x-user-location"] ||
      req?.headers?.["x-client-location"] ||
      req?.headers?.["cf-ipcity"] ||
      null;
    if (headerLoc && typeof headerLoc === "string" && headerLoc.trim()) {
      return headerLoc.trim().slice(0, 150);
    }

    // 2. Branch location from database if branchId is provided
    if (branchId) {
      try {
        const rows = await query(
          "SELECT branch_name, location, city, country FROM adm_branches WHERE id = :id LIMIT 1",
          { id: branchId }
        );
        if (rows?.[0]) {
          const b = rows[0];
          const parts = [b.branch_name, b.city || b.location, b.country].filter(Boolean);
          if (parts.length > 0) {
            return parts.join(" - ").slice(0, 150);
          }
        }
      } catch {}
    }

    // 3. Company location from database if companyId is provided
    if (companyId) {
      try {
        const rows = await query(
          "SELECT company_name, city, country FROM adm_companies WHERE id = :id LIMIT 1",
          { id: companyId }
        );
        if (rows?.[0]) {
          const c = rows[0];
          const parts = [c.company_name, c.city, c.country].filter(Boolean);
          if (parts.length > 0) {
            return parts.join(", ").slice(0, 150);
          }
        }
      } catch {}
    }

    // 4. IP-based fallback
    const { ip } = getClientMeta(req);
    if (!ip) return "Unknown";
    if (
      ip === "::1" ||
      ip === "127.0.0.1" ||
      ip === "localhost" ||
      (typeof ip === "string" && (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")))
    ) {
      return "Local Network";
    }

    return String(ip).slice(0, 150);
  } catch {
    return "Unknown";
  }
}
