const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'c:/Users/stanl/baseline/server/.env' });
async function test() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: 'root', // try root user
    password: '',
    database: process.env.DB_NAME,
  });
  try {
    const [rows] = await pool.query("SELECT COUNT(*) as c, MAX(invoice_date) as md FROM sal_invoices");
    console.log("Invoices count:", rows);
    const [cust] = await pool.query("SELECT COUNT(*) as c FROM sal_customers");
    console.log("Customers count:", cust);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
test();
