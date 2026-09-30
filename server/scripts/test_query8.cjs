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
    const [rows] = await pool.execute(
      `SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
       FROM sal_invoices
       WHERE company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND YEAR(invoice_date) = YEAR(CURDATE())
         AND MONTH(invoice_date) = MONTH(CURDATE())`,
      { companyId: 1, branchIdsStr: '' }
    );
    console.log("Sales:", rows);
  } catch(e) {
    console.error("Error with execute!", e);
  }
  process.exit();
}
test();
