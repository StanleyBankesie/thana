import pool from './db/pool.js';

async function run() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute("SELECT voucher_no FROM fin_vouchers WHERE voucher_type_id = 7");
    console.log(rows);
    await conn.execute("UPDATE fin_voucher_types SET next_number = 47 WHERE code = 'PV'");
  } catch (err) {
    console.error(err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
