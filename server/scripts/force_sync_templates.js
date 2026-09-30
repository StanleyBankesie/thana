import { query } from "./db/pool.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extract templates from seed-defaults.js content
const seedDefaultsPath = path.join(__dirname, 'services', 'seed-defaults.js');
const content = fs.readFileSync(seedDefaultsPath, 'utf8');

// Utility function to extract string literal template content by variable name
function extractTemplate(varName) {
  const startMarker = `const ${varName} = \``;
  const endMarker = '`;';
  const start = content.indexOf(startMarker) + startMarker.length;
  const end = content.indexOf(endMarker, start);
  return content.substring(start, end);
}

const invoiceHtml = extractTemplate('DEFAULT_INVOICE_TEMPLATE');
const salesOrderHtml = extractTemplate('DEFAULT_SALES_ORDER_TEMPLATE');

// Main function to synchronize database templates with file-based templates
async function sync() {
  try {
    console.log("Starting force synchronization of Document Templates (MySQL)...");

    // Update ALL Invoice templates
    const invRes = await query(`
      UPDATE document_templates 
      SET html_content = :html 
      WHERE document_type LIKE '%invoice%'
    `, { html: invoiceHtml });
    console.log(`Updated Invoice templates. Affected rows: ${invRes.affectedRows || 'unknown'}`);

    // Update ALL Sales Order templates
    const soRes = await query(`
      UPDATE document_templates 
      SET html_content = :html 
      WHERE document_type LIKE '%sales-order%'
    `, { html: salesOrderHtml });
    console.log(`Updated Sales Order templates. Affected rows: ${soRes.affectedRows || 'unknown'}`);

    console.log("Force synchronization complete.");
  } catch (err) {
    // Log unexpected synchronization errors
    console.error("Synchronization failed:", err);
  } finally {
    // Ensure process exit when done
    process.exit(0);
  }
}

// Execute sync routine
sync();
