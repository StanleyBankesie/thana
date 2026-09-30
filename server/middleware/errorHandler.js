/**
 * @file errorHandler.js
 * @description Global Express error handling middleware.
 */

import { logToCrashReport } from "../utils/crashLogger.js";

function sanitizeBody(value) {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeBody(v));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (/(password|passwd|token|authorization|cookie|secret|refresh)/i.test(String(k))) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = sanitizeBody(v);
    }
  }
  return out;
}

/**
 * Formats and sends error responses.
/**
 * Formats and sends error responses.
 *
 * @param {Error} err - The error object.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export function errorHandler(err, req, res, next) {
  // Prevent sending headers multiple times if they have already been sent
  if (res.headersSent) {
    return next(err);
  }

  // Ensure CORS headers are preserved even on 500 / error responses
  const origin = req.headers?.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Build the error response payload with status and message
  const status = err.status || 500;
  
  const type = `HTTP_${Number(status) || 500}`;
  res.locals.__crashLogged = true;
  logToCrashReport(type, err, {
    status,
    code: err?.code || null,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip,
    origin: req.headers?.origin || "",
    userAgent: req.headers?.["user-agent"] || "",
    userId: Number(req.user?.sub || req.user?.id) || null,
    companyId: req.scope?.companyId ?? null,
    branchId: req.scope?.branchId ?? null,
    body: sanitizeBody(req.body),
    query: sanitizeBody(req.query),
  });

  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const payload = {
    error: err.code || "INTERNAL_ERROR",
    message: isProd && status === 500 ? "Internal server error" : (err.message || "Internal server error"),
    companyId: err.companyId,
    canRenew: err.canRenew,
    // SECURITY: Never expose stack traces or SQL errors to clients in production
    ...(isProd ? {} : { stack: err.stack, sqlMessage: err.sqlMessage }),
  };
  res.status(status).json(payload);
}
