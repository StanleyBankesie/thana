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
      `SELECT company_id, branch_id, COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
       FROM sal_invoices
       WHERE YEAR(invoice_date) = YEAR(CURDATE())
         AND MONTH(invoice_date) = MONTH(CURDATE())
       GROUP BY company_id, branch_id`
    );
    console.log("Monthly Sales:", rows);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
test();
