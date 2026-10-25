const pool = require('../server/db/pool');

async function run() {
  await pool.query("UPDATE fin_tax_codes SET valid_pages = '2,9,10,13,17,18,19,21,24,25,26,27,28' WHERE id = 1");
  await pool.query("UPDATE fin_tax_codes SET valid_pages = '1,2,3,4,5,6,7,8,9,10,11,12,13,22,23,24,25,26,27,28' WHERE id = 3");
  await pool.query("UPDATE fin_tax_codes SET valid_pages = '1,2,3,4,5,6,7,8,9,10,11,12,13,24,25,26,27,28' WHERE id = 4");
  const rows = await pool.query('SELECT id, code, name, valid_pages FROM fin_tax_codes');
  console.log('Updated rows in fin_tax_codes:');
  console.log(rows);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
