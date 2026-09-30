const { pool } = require('./server/config/db');
async function test() {
  try {
    const [rows] = await pool.query('SHOW COLUMNS FROM fin_accounts');
    console.log(rows);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
