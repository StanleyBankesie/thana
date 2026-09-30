import pool from './db/pool.js';

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.execute("UPDATE fin_voucher_types SET next_number = 1 WHERE code = 'DN'");
    console.log("Successfully reset Debit Note next_number to 1");
  } catch (err) {
    console.error(err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
