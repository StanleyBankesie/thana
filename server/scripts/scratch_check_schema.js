/**
 * @fileoverview Scratch script for checking sales deliveries schema.
 * Describes the 'sal_deliveries' table.
 */
import { query } from "./db/pool.js";

// Utility function to fetch schema details of sal_deliveries
async function check() {
  try {
    // Execute describe query on the sal_deliveries table
    const rows = await query("DESC sal_deliveries");
    // Log the resulting schema rows as formatted JSON
    console.log(JSON.stringify(rows, null, 2));
    // Exit the script successfully
    process.exit(0);
  } catch (e) {
    // Display error message to console
    console.error(e);
    // Exit with an error code
    process.exit(1);
  }
}
// Execute function
check();
