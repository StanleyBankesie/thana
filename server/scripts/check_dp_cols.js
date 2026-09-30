/**
 * @fileoverview Utility script to check column schemas for direct purchase tables.
 * @module check_dp_cols
 */

import { query } from "./db/pool.js";

/**
 * Logs the column definitions for pur_direct_purchase_hdr and pur_direct_purchase_dtl.
 *
 * @async
 * @returns {Promise<void>}
 */
// Utility function to inspect columns of direct purchase header and detail tables
async function check() {
  try {
    console.log("Columns for pur_direct_purchase_hdr:");
    // Attempt to fetch columns for the header table, default to empty array on failure
    const hdrRows = await query("SHOW COLUMNS FROM pur_direct_purchase_hdr").catch(() => []);
    // Print each column's name and type for the header
    hdrRows.forEach(r => console.log(`${r.Field}: ${r.Type}`));
    
    console.log("\nColumns for pur_direct_purchase_dtl:");
    // Attempt to fetch columns for the detail table, default to empty array on failure
    const dtlRows = await query("SHOW COLUMNS FROM pur_direct_purchase_dtl").catch(() => []);
    // Print each column's name and type for the detail
    dtlRows.forEach(r => console.log(`${r.Field}: ${r.Type}`));
  } catch (e) {
    // Log unexpected errors
    console.error("Error:", e.message);
  } finally {
    // Terminate script execution successfully
    process.exit(0);
  }
}

// Execute the schema inspection
check();
