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
    const [cust1] = await pool.query("SELECT COUNT(*) as c FROM sal_customers WHERE company_id = 1");
    console.log("Customers company 1:", cust1);
    const [cust2] = await pool.query("SELECT COUNT(*) as c FROM sal_customers WHERE company_id = 2");
    console.log("Customers company 2:", cust2);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
test();
