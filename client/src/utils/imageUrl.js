/**
 * @fileoverview Universal utility for resolving image URLs across local development and production.
 * Ensures relative paths like "/uploads/..." are correctly directed to the backend API origin
 * (e.g. https://thanaserver.omnisuite-erp.com in production) rather than the frontend static host.
 */

import { api } from "../api/client.js";

/**
 * Resolves an image URL so relative paths point to the backend server origin.
 *
 * @param {string|null|undefined} url - The image URL or relative path.
 * @returns {string} The resolved URL or empty string.
 */
export function resolveImageUrl(url) {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";

  // If already absolute, data URI, blob, or protocol-relative
  if (/^(data:|blob:|https?:|\/\/)/i.test(s)) {
    return s;
  }

  // Determine backend origin from api client baseURL
  const apiBase = String(api?.defaults?.baseURL || "");
  let backendOrigin = "";

  if (/^https?:\/\//i.test(apiBase)) {
    try {
      const parsed = new URL(apiBase);
      backendOrigin = `${parsed.protocol}//${parsed.host}`;
    } catch {}
  }

  // Production fallback if api.defaults.baseURL was relative or not configured
  if (!backendOrigin && typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname || "";
    if (
      hostname.includes("thana") ||
      hostname === "thana.omnisuite-erp.com" ||
      hostname === "thanaserver.omnisuite-erp.com"
    ) {
      backendOrigin = "https://thanaserver.omnisuite-erp.com";
    } else if (hostname.endsWith(".omnisuite-erp.com")) {
      const prefix = hostname.split(".")[0];
      if (!prefix.endsWith("server")) {
        backendOrigin = `https://${prefix}server.omnisuite-erp.com`;
      }
    }
  }

  const cleanPath = s.startsWith("/") ? s : `/${s}`;

  if (backendOrigin) {
    return `${backendOrigin}${cleanPath}`;
  }

  return cleanPath;
}

export default resolveImageUrl;
