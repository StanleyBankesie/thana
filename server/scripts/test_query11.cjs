const mysql = require('mysql2/promise');
async function test() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'omnisuite',
    namedPlaceholders: true
  });
  
  const params = { companyId: 1, branchId: 1 };
  
  const cleanParams = new Proxy(params, {
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
        "SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total FROM sal_invoices WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND invoice_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
      cleanParams
    );
    console.log("Stats:", rows);
  } catch(e) {
    console.error("Error stats!", e);
  }
  process.exit();
}
test();
