import pool from './db/pool.js';

async function run() {
  const conn = await pool.getConnection();
  try {
    const [types] = await conn.execute("SELECT * FROM fin_voucher_types");
    
    for (const vt of types) {
      const upCode = String(vt.code).toUpperCase();
      let effectivePrefix = vt.prefix;
      if (upCode === "PAYV") effectivePrefix = "PV";
      else if (upCode === "PV" || upCode === "PUV") effectivePrefix = "PB";

      const prefixStr = (upCode === "PV" || upCode === "PUV" || upCode === "PAYV" || upCode === "SV" || upCode === "RV" || upCode === "CN") ? effectivePrefix : `${effectivePrefix}-`;
      
      const sql = `
        SELECT MAX(
          CAST(
            REPLACE(voucher_no, ?, '') 
          AS UNSIGNED)
        ) AS max_num
        FROM fin_vouchers 
        WHERE voucher_type_id = ? 
        AND company_id = ?
        AND voucher_no LIKE ?
      `;
      const [maxRes] = await conn.execute(sql, [prefixStr, vt.id, vt.company_id, `${prefixStr}%`]);
      const maxNum = Number(maxRes[0]?.max_num || 0);
      
      const newNext = Math.max(vt.next_number, maxNum + 1);
      if (newNext > vt.next_number) {
        await conn.execute("UPDATE fin_voucher_types SET next_number = ? WHERE id = ?", [newNext, vt.id]);
        console.log(`Updated ${vt.code} next_number from ${vt.next_number} to ${newNext}`);
      } else {
        console.log(`${vt.code} is up to date (next: ${vt.next_number})`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
