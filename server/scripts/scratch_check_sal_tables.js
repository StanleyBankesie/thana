/**
 * @fileoverview Scratch script for checking sales tables.
 * Connects to the database and displays tables matching 'sal_%'.
 */
import { query } from "./db/pool.js";

// Utility function to list all sales-related tables
async function check() {
  try {
    // Execute a query to find tables starting with 'sal_'
    const rows = await query("SHOW TABLES LIKE 'sal_%'");
    // Output the resulting list of tables formatted as JSON
    console.log(JSON.stringify(rows, null, 2));
    // Terminate the process cleanly upon success
    process.exit(0);
  } catch (e) {
    // Output the error if one occurs during database interaction
    console.error(e);
    // Terminate the process with an error code
    process.exit(1);
  }
}
// Execute function
check();
