/**
 * @fileoverview Scratch script for checking sales orders schema.
 * Describes the 'sal_orders' table.
 */
import { query } from "./db/pool.js";

// Utility function to inspect the schema of sal_orders
async function check() {
  try {
    // Query database to describe the columns of sal_orders
    const rows = await query("DESC sal_orders");
    // Print the schema details formatted as a JSON string
    console.log(JSON.stringify(rows, null, 2));
    // Exit cleanly
    process.exit(0);
  } catch (e) {
    // Print database query errors
    console.error(e);
    // Return an error status code
    process.exit(1);
  }
}
// Call function to execute the query
check();
