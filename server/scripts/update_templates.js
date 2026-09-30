const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/omni.db');

async function updateInvoiceTemplates() {
  db.all("SELECT id, name, html_content FROM document_templates WHERE document_type LIKE '%invoice%'", (err, rows) => {
    if (err) {
      console.error("Error fetching templates:", err);
      return;
    }

    console.log(`Found ${rows.length} invoice templates to check.`);

    rows.forEach(row => {
      let html = row.html_content;
      let updated = false;

      // 1. Ensure Table Headers
      if (!html.includes('Discount') && !html.includes('Tax') && !html.includes('Value')) {
        console.log(`Updating headers for template: ${row.name}`);
        html = html.replace('<th>Price</th>', '<th>Price</th>\n        <th>Discount</th>\n        <th>Tax</th>\n        <th>Value</th>');
        updated = true;
      }

      // 2. Ensure Table Data Rows
      if (!html.includes('{{discount}}') && !html.includes('{{tax}}') && !html.includes('{{amount}}')) {
        console.log(`Updating data rows for template: ${row.name}`);
        html = html.replace('<td class="num">{{price}}</td>', '<td class="num">{{price}}</td>\n        <td class="num">{{discount}}</td>\n        <td class="num">{{tax}}</td>\n        <td class="num">{{amount}}</td>');
        updated = true;
      }

      // 3. Ensure Summary Section
      if (!html.includes('{{invoice.nhil}}') || !html.includes('{{invoice.get_fund}}') || !html.includes('{{invoice.vat}}')) {
        console.log(`Updating summary section for template: ${row.name}`);
        // Look for the last summary row or the end of the summary block
        const summaryEndTag = 'Net Invoice Value';
        if (html.includes(summaryEndTag) && !html.includes('NHIL')) {
           const insertPoint = html.lastIndexOf('<div class="summary-row">');
           const newSummary = `
      <div class="summary-row"><div class="s-label">NHIL [2.5%]</div><div class="s-val">{{invoice.nhil}}</div></div>
      <div class="summary-row"><div class="s-label">GET FUND 2.5% ON SALES</div><div class="s-val">{{invoice.get_fund}}</div></div>
      <div class="summary-row"><div class="s-label">VAT 15%</div><div class="s-val">{{invoice.vat}}</div></div>
`;
           html = html.replace('<div class="summary-row"><div class="s-label">Net Invoice Value', newSummary + '      <div class="summary-row"><div class="s-label">Net Invoice Value');
           updated = true;
        }
      }

      if (updated) {
        db.run("UPDATE document_templates SET html_content = ? WHERE id = ?", [html, row.id], (updErr) => {
          if (updErr) console.error(`Failed to update template ${row.id}:`, updErr);
          else console.log(`Successfully updated template: ${row.name}`);
        });
      } else {
        console.log(`Template ${row.name} already appears to be up to date.`);
      }
    });

    // Close after a short delay to allow updates to finish
    setTimeout(() => {
        db.close();
        console.log("Database update complete.");
    }, 2000);
  });
}

updateInvoiceTemplates();
