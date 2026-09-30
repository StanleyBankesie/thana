/**
 * @fileoverview Controller for database configuration retrieval.
 * @module db.controller
 */

// Database Dependencies
import { getDbConfig } from "../db/pool.js";

/**
 * Retrieves the database configuration and sends it in the response.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 */
// Database Configuration Endpoint
export const dbConfig = async (req, res) => {
  try {
    // Fetch configuration from pool
    const cfg = getDbConfig();
    res.json({ ok: true, config: cfg });
  } catch {
    // Handle error gracefully
    res.status(500).json({ ok: false });
  }
};
