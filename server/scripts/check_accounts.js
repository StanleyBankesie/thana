import pool from './server/db/pool.js';
(async () => {
  try {
    const rows = await pool.query("SELECT id, name FROM fin_accounts WHERE name LIKE '%sales%'");
    console.log(rows);
  } catch (err) {
    console.error('SQL Error:', err.message);
  }
  process.exit(0);
})();
