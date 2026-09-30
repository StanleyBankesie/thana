/**
 * @file get_templates.cjs
 * @description Script to retrieve and display HTML content of document templates.
 */
const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'admin', password: 'admin',
    database: 'omnisuite'
  });
  const [rows] = await conn.query(
    "SELECT document_type, html_content FROM document_templates WHERE document_type IN ('sales-order','invoice')"
  );
  for (const r of rows) {
    console.log('=== DOCUMENT TYPE: ' + r.document_type + ' ===');
    console.log(r.html_content);
    console.log('=== END ===');
  }
  await conn.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
