const { pool } = require('./server/config/db');
async function test() {
  try {
    const [rows] = await pool.query(
      "SELECT bill_no FROM pur_bills WHERE company_id = 1 AND branch_id = 1 AND bill_no LIKE 'PBL%' ORDER BY CAST(SUBSTRING(bill_no, 4) AS UNSIGNED) DESC LIMIT 1 FOR UPDATE"
    );
    console.log('Rows:', rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}
test();
