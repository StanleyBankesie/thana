import { pool } from './db/pool.js';
import { postPurchaseBillVoucherTx } from './routes/purchase.routes.js';

async function fix() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute("SELECT id, company_id, branch_id FROM pur_bills WHERE bill_no = 'PBL-000026'");
    if (rows.length > 0) {
      const bill = rows[0];
      await conn.beginTransaction();
      const res = await postPurchaseBillVoucherTx(conn, {
        billId: bill.id,
        companyId: bill.company_id,
        branchId: bill.branch_id || null,
        branchIdsStr: ''
      });
      if (res?.voucherId) {
        // Also update pur_direct_purchase_hdr if applicable
        await conn.execute("UPDATE pur_direct_purchase_hdr SET bill_voucher_id = :vid WHERE bill_id = :bid", { vid: res.voucherId, bid: bill.id });
        console.log("Created voucher:", res.voucherNo);
      }
      await conn.commit();
    } else {
      console.log("Bill not found");
    }
  } catch(e) {
    console.error(e);
    await conn.rollback();
  } finally {
    conn.release();
    process.exit();
  }
}
fix();
