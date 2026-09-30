/**
 * @file pos.controller.js
 * @description Handles Point of Sale (POS) operations, specifically managing payment modes.
 * Includes utilities for schema validation and dynamic table creation.
 */

// Database Dependencies
import { query } from "../db/pool.js";

/**
 * Checks if a specific column exists in a given table within the current database schema.
 * 
 * @param {string} tableName - The name of the table to check.
 * @param {string} columnName - The name of the column to look for.
 * @returns {Promise<boolean>} True if the column exists, false otherwise.
 */
async function hasColumn(tableName, columnName) {
  // Query information schema to check if the specified column exists in the table
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
      AND column_name = :columnName
    `,
    { tableName, columnName },
  );
  // Return true if count is greater than 0
  return Number(rows?.[0]?.c || 0) > 0;
}

/**
 * Ensures that the required tables for POS payment modes exist in the database.
 * If the tables do not exist, it creates them. It also performs schema updates
 * such as modifying column types and adding missing columns to maintain schema integrity.
 * 
 * @returns {Promise<void>}
 */

/**
 * Retrieves a list of POS payment modes associated with the current company and branch context.
 * Automatically ensures the required database tables exist before querying.
 *
 * @param {import('express').Request} req - Express request object, containing scope.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response with the list of payment modes.
 */
export const listPaymentModes = async (req, res, next) => {
  try {
    const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
    
    // Ensure the table schema is up to date before querying to prevent missing table/column errors
    await ensurePosTables();
    
    // Fetch payment modes for the current company and allowed branches
    const items = await query(`
      SELECT
        id,
        name,
        type,
        account,
        require_reference,
        is_active,
        created_at
      FROM pos_payment_modes
      WHERE company_id = :companyId
        AND (:branchIdsStr = '' OR FIND_IN_SET(pos_payment_modes.branch_id, :branchIdsStr))
      ORDER BY name
      `,
      { companyId, branchId, branchIdsStr },
    );
    // Return payment modes to the client
    res.json({ items });
  } catch (err) {
    // Pass errors to the error handler middleware
    next(err);
  }
};
