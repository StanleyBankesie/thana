/**
 * @fileoverview Bootstraps the server environment and handles unhandled process errors.
 * @module bootstrap
 */

// Pre-load environment variables
import "./utils/loadServerEnv.js";

/**
 * Logs a process-level error with consistent formatting.
 *
 * @param {string} label - A label indicating the error context (e.g., "unhandledRejection").
 * @param {Error|any} err - The error object or reason.
 */
function logProcessError(label, err) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(`[Process] ${label}`);
  console.error(
    `[Process] code=${error.code || "n/a"} errno=${error.errno ?? "n/a"} sqlMessage=${error.sqlMessage || "n/a"}`,
  );
  console.error(`[Process] message=${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
}

// Global Unhandled Promise Rejection Handler
process.on("unhandledRejection", (reason) => {
  logProcessError("unhandledRejection", reason);
});

// Global Uncaught Exception Handler

process.on("uncaughtException", (error) => {
  logProcessError("uncaughtException", error);
});

// Start application by importing main entry point (index.js)
// Catches and logs any top-level initialization errors
import("./index.js").catch((error) => {
  logProcessError("bootstrap import failure", error);
});
