/**
 * @fileoverview Scratch script for checking POS tables.
 * Connects to the database and displays tables matching 'pos_%'.
 */
import { query } from "./db/pool.js";

// Utility function to check for POS-related tables
async function check() {
  try {
    // Execute a query to find tables starting with 'pos_'
    const rows = await query("SHOW TABLES LIKE 'pos_%'");
    // Format the resulting list as JSON for easy reading
    console.log(JSON.stringify(rows, null, 2));
    // Terminate process with success code
    process.exit(0);
  } catch (e) {
    // Print out any errors caught during the process
    console.error(e);
    // Exit with a failure status code
    process.exit(1);
  }
}
// Run check
check();
