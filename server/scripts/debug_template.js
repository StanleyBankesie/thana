/**
 * @file debug_template.js
 * @description Debug script for checking specific document templates in the DB.
 */
import { query } from "./pool.js";

// Utility function to verify if the 'Default payment-voucher' template exists
async function checkTemplate() {
  try {
    // Query the database for the specific template by name
    const rows = await query("SELECT id, name, document_type FROM document_templates WHERE name = 'Default payment-voucher'");
    // Output the query results
    console.log("Templates found:", rows);
  } catch (err) {
    // Catch and log execution errors
    console.error("Error:", err);
  } finally {
    // Gracefully exit the script
    process.exit(0);
  }
}

// Start template check
checkTemplate();
