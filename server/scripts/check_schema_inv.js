/**
 * @fileoverview Utility script to check columns of the sal_invoices table.
 * @module check_schema_inv
 */

import { query } from "./pool.js";

/**
 * Checks and logs the columns of the sal_invoices table.
 * Attempts a direct query and falls back to a SQLite PRAGMA if needed.
 *
 * @async
 * @returns {Promise<void>}
 */
// Utility function to determine column names for sal_invoices, handling SQLite/MySQL fallback
async function checkSchema() {
  try {
    // Attempt to select a single record to inspect the object keys
    const [row] = await query("SELECT * FROM sal_invoices LIMIT 1");
    if (row) {
        // If a row is returned, simply extract the object keys as column names
        console.log("Invoice columns:", Object.keys(row));
    } else {
        // Fallback for SQLite to query table metadata if no rows exist
        const columns = await query("PRAGMA table_info(sal_invoices)");
        // Extract and map column names from PRAGMA output
        console.log("Columns from PRAGMA:", columns.map(c => c.name));
    }
  } catch (err) {
    // Log failure in reading columns
    console.error("Error:", err);
  } finally {
    // Close the process execution
    process.exit(0);
  }
}

// Start schema checking
checkSchema();
