/**
 * @file debug_invoice.js
 * @description Debug script for extracting and exporting invoice data.
 */
import { query } from "./db/pool.js";
import { loadData } from "./routes/documents.routes.js";
import fs from 'fs';

// Utility function to fetch an invoice and its complete data structure for debugging
async function debugInvoice() {
  try {
    // Attempt to fetch a single invoice record to act as our test subject
    const [inv] = await query('SELECT id, company_id, branch_id FROM sal_invoices LIMIT 1').catch(() => []);
    if (inv) {
        // Log the details of the selected invoice
        console.log(`Checking Invoice ID: ${inv.id}, Company: ${inv.company_id}, Branch: ${inv.branch_id}`);
        // Use the loadData function to gather all related data for the document
        const data = await loadData('invoice', inv.id, inv.company_id, inv.branch_id);
        // Write the complex JSON data to a file for easy manual inspection
        fs.writeFileSync('invoice_debug_full.json', JSON.stringify(data, null, 2));
        // Confirm successful export
        console.log('Full data exported to invoice_debug_full.json');
    } else {
        // Report if no invoice could be found to debug
        console.error('No invoices found in DB.');
    }
  } catch (err) {
    // Log unexpected errors encountered during the debug process
    console.error("Debug Error:", err);
  } finally {
    // Ensure the process exits cleanly
    process.exit(0);
  }
}

// Execute the debug function
debugInvoice();
