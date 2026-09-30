/**
 * @fileoverview Utility script to check columns of the document_templates table.
 * @module check_tables
 */

const mysql = require('mysql2/promise');

/**
 * Connects to the database and logs the columns of the document_templates table.
 *
 * @async
 * @returns {Promise<void>}
 */
async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'admin', password: 'admin',
    database: 'omnisuite'
  });
  const [rows] = await conn.query("SHOW COLUMNS FROM document_templates");
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
