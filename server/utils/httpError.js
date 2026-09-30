/**
 * @file httpError.js
 * @description Utility for creating standardized HTTP error objects.
 */

/**
 * Creates an error object with HTTP status and application-specific error code.
 *
 * @param {number} status - HTTP status code (e.g., 400, 404, 500).
 * @param {string} code - Application-specific error code (e.g., "NOT_FOUND").
 * @param {string} message - Human-readable error message.
 * @returns {Error} The constructed Error object with status and code properties.
 */
export function httpError(status, code, message) {
  // Instantiate standard Error object and attach custom HTTP status and application code
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}
