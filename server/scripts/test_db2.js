const mysql = require('mysql2/promise');
async function test() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'omnidb',
  });
  try {
    const [rows] = await pool.query('SELECT COUNT(*) as c FROM sal_invoices WHERE balance_amount > 0');
    console.log('Outstanding invoices:', rows[0].c);
    const [rows2] = await pool.query('SELECT COUNT(*) as c FROM sal_invoices');
    console.log('Total invoices:', rows2[0].c);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
