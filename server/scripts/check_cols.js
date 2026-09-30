/**
 * @fileoverview Utility script to retrieve and save the CREATE TABLE statement for fin_pdc_postings.
 * @module check_cols
 */

import { query } from "./db/pool.js";
import fs from "fs";

/**
 * Checks the schema of fin_pdc_postings and writes it to a file.
 *
 * @async
 * @returns {Promise<void>}
 */
// Utility function to fetch the CREATE TABLE statement for fin_pdc_postings and save it to a file
async function check() {
  // Accumulate the schema output text
  let output = "";
  try {
    // Add header text for the CREATE TABLE output
    output += "SHOW CREATE TABLE fin_pdc_postings:\n";
    // Execute the SHOW CREATE TABLE query
    const rows = await query("SHOW CREATE TABLE fin_pdc_postings");
    // Append the resulting SQL definition to the output string
    output += rows[0]["Create Table"];
  } catch (e) {
    // Handle query failures by adding the error message to the output
    output += `FAILED: ${e.message}\n`;
  } finally {
    // Save the output to a text file for review
    fs.writeFileSync("db_check_create.txt", output);
    // Ensure the script terminates after writing the file
    process.exit(0);
  }
}

// Execute the check routine
check();
