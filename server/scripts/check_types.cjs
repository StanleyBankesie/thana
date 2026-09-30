const { query } = require('./config/db.js');
async function run() {
  const rows = await query('SELECT code, name FROM fin_voucher_types');
  console.log(rows);
  process.exit(0);
}
run();
