const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'c:/Users/stanl/baseline/server/.env' });
async function test() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    namedPlaceholders: true
  });
  try {
    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
       FROM sal_invoices
       WHERE company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND DATE(invoice_date) = CURDATE()`,
      { companyId: 1, branchIdsStr: '' }
    );
    console.log(rows);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
test();
