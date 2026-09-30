/**
 * @fileoverview Utility script to check columns for the pur_orders table.
 * @module check_pur_orders_cols
 */

import { query } from "./db/pool.js";

/**
 * Logs the columns of the pur_orders table.
 *
 * @async
 * @returns {Promise<void>}
 */
// Utility function to review schema of pur_orders table
async function check() {
  try {
    // Retrieve column properties for pur_orders table
    const rows = await query("SHOW COLUMNS FROM pur_orders");
    // Log each field name and its corresponding data type
    rows.forEach(r => {
      console.log(`${r.Field}: ${r.Type}`);
    });
  } catch (e) {
    // Log error if query fails
    console.error("Error:", e.message);
  } finally {
    // Terminate the process
    process.exit(0);
  }
}

// Start schema check execution
check();
