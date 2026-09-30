/**
 * @fileoverview Utility script to check columns for the pur_order_details table.
 * @module check_pur_order_details_cols
 */

import { query } from "./db/pool.js";

/**
 * Logs the columns of the pur_order_details table.
 *
 * @async
 * @returns {Promise<void>}
 */
// Utility function to print all columns and their types for pur_order_details
async function check() {
  try {
    console.log("Columns for pur_order_details:");
    // Query database for column schema info
    const rows = await query("SHOW COLUMNS FROM pur_order_details");
    // Loop through the schema definition and print field name alongside its data type
    rows.forEach(r => {
      console.log(`${r.Field}: ${r.Type}`);
    });
  } catch (e) {
    // Catch and log execution errors
    console.error("Error:", e.message);
  } finally {
    // Exit script process
    process.exit(0);
  }
}

// Start execution
check();
