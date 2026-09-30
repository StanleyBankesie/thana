/**
 * @file notFound.js
 * @description Catch-all middleware for 404 Not Found routes.
 */

/**
 * Returns a standard 404 JSON response.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 */
export function notFound(req, res) {
  // Respond with a 404 Not Found JSON object
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
}
