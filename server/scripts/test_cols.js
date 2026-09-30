import pool from './server/db/pool.js';
async function main() {
  const [cols] = await pool.query('SHOW COLUMNS FROM adm_licenses');
  console.log(cols);
  process.exit(0);
}
main();
