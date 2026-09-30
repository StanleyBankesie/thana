const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Extract templates from seed-defaults.js content
const seedDefaultsPath = path.join(__dirname, 'services', 'seed-defaults.js');
const content = fs.readFileSync(seedDefaultsPath, 'utf8');

function extractTemplate(varName) {
  const startMarker = `const ${varName} = \``;
  const endMarker = '`;';
  const start = content.indexOf(startMarker) + startMarker.length;
  const end = content.indexOf(endMarker, start);
  return content.substring(start, end);
}

const invoiceHtml = extractTemplate('DEFAULT_INVOICE_TEMPLATE');
const salesOrderHtml = extractTemplate('DEFAULT_SALES_ORDER_TEMPLATE');

const db = new sqlite3.Database('./db/omni.db');

async function sync() {
  console.log("Starting force synchronization of Document Templates...");

  // Update ALL Invoice templates
  db.run(`
    UPDATE document_templates 
    SET html_content = ? 
    WHERE document_type LIKE '%invoice%'
  `, [invoiceHtml], function(err) {
    if (err) console.error("Error updating Invoices:", err);
    else console.log(`Updated ${this.changes} Invoice templates.`);
  });

  // Update ALL Sales Order templates
  db.run(`
    UPDATE document_templates 
    SET html_content = ? 
    WHERE document_type LIKE '%sales-order%'
  `, [salesOrderHtml], function(err) {
    if (err) console.error("Error updating Sales Orders:", err);
    else console.log(`Updated ${this.changes} Sales Order templates.`);
  });

  setTimeout(() => {
    db.close();
    console.log("Force synchronization complete.");
    process.exit(0);
  }, 2000);
}

sync();
