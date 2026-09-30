/**
 * @fileoverview Utility script to check the fin_currencies table schema and data.
 * @module check_currencies
 */

import { query } from "./db/pool.js";

/**
 * Retrieves the columns and a sample of rows from fin_currencies.
 *
 * @async
 * @returns {Promise<void>}
 */
// Utility function to inspect the schema and data of fin_currencies
async function check() {
  try {
    console.log("Columns for fin_currencies:");
    // Fetch schema details for fin_currencies table
    const cols = await query("SHOW COLUMNS FROM fin_currencies");
    // Iterate over columns to log field names and types
    cols.forEach(r => console.log(`${r.Field}: ${r.Type}`));
    
    console.log("\nSample data from fin_currencies:");
    // Fetch a small subset of records to verify table content
    const rows = await query("SELECT * FROM fin_currencies LIMIT 10");
    // Display the records in a formatted table
    console.table(rows);
  } catch (e) {
    // Log any errors that occur during the queries
    console.error("Error:", e.message);
  } finally {
    // Exit process upon completion
    process.exit(0);
  }
}

// Execute the check routine
check();
