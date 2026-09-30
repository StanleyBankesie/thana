import pool from './db/pool.js'; async function main() { const sql = process.argv.slice(2).join(' ') || 'SELECT 1'; const res = await pool.query(sql); console.log(res[0]); process.exit(0); } main();
