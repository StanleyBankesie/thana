/**
 * @file query_db2.js
 * @description Script for executing a quick query to show columns of fin_tax_components.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { query } from "./db/pool.js";

// Quick utility function to execute a query to show columns of fin_tax_components
async function run() {
  try {
    // Query database for schema info of fin_tax_components
    const compCols = await query("SHOW COLUMNS FROM fin_tax_components");
    // Log the first column detail from the results
    console.log("fin_tax_components cols:", compCols[0]);
  } catch (e) {
    // Log any errors that occur
    console.error(e);
  } finally {
    // Terminate script execution successfully
    process.exit(0);
  }
}
// Execute the query
run();
