const mysql = require('mysql2/promise');
async function test() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'omnisuite',
    namedPlaceholders: true
  });
  try {
    const [rows] = await pool.query(
      `SELECT invoice_no, branch_id FROM sal_invoices ORDER BY invoice_date DESC LIMIT 5`
    );
    console.log("Branches:", rows);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
test();
