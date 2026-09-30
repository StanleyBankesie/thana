const mysql = require('mysql2/promise');
async function test() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'omnisuite',
    namedPlaceholders: true
  });
  const proxyParams = new Proxy({ companyId: 1, branchId: 1, branchIdsStr: '' }, {
    get(target, prop) {
      if (prop === "branchIdsStr" && target[prop] === undefined) return "";
      const val = target[prop];
      return val === undefined ? null : val;
    },
    has(target, prop) {
      return true;
    },
  });
  try {
    const [rows] = await pool.execute(
      `SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
       FROM sal_invoices
       WHERE company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND YEAR(invoice_date) = YEAR(CURDATE())
         AND MONTH(invoice_date) = MONTH(CURDATE())`,
      proxyParams
    );
    console.log("Sales:", rows);
  } catch(e) {
    console.error("Error with proxy execute!", e);
  }
  process.exit();
}
test();
