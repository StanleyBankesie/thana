/**
 * @fileoverview Utility script to describe payroll related tables and save the output.
 * @module check_schema
 */

import { query } from "./db/pool.js";
import fs from "fs";

/**
 * Describes hr_payslips and hr_payroll_items, writing the schemas to a file.
 *
 * @async
 * @returns {Promise<void>}
 */
// Utility function to fetch schema details of payroll tables and write to file
async function check() {
  // Variable to accumulate string output for both queries
  let output = "";
  try {
    // Get schema definition for hr_payslips table
    const tppRaw = await query("DESCRIBE hr_payslips");
    // Append formatted hr_payslips schema to output
    output += "DESCRIBE hr_payslips:\n" + JSON.stringify(tppRaw, null, 2) + "\n\n";
    // Get schema definition for hr_payroll_items table
    const piRaw = await query("DESCRIBE hr_payroll_items");
    // Append formatted hr_payroll_items schema to output
    output += "DESCRIBE hr_payroll_items:\n" + JSON.stringify(piRaw, null, 2) + "\n\n";
  } catch (e) {
    // Catch errors and add them to the output string
    output += `FAILED: ${e.message}\n`;
  } finally {
    // Write accumulated output data to text file synchronously
    fs.writeFileSync("db_check_schema.txt", output);
    // Process exit to prevent hanging
    process.exit(0);
  }
}

// Trigger schema check
check();
