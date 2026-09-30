const { query } = require("./server/config/db.config");

async function test() {
  try {
    console.log("--- Bank Accounts ---");
    const ba = await query(`SELECT id, name, gl_account_id, company_id FROM fin_bank_accounts LIMIT 5`);
    console.log(ba);

    console.log("\n--- Vouchers (with bank account in lines) ---");
    const vl = await query(`
      SELECT v.id, v.voucher_no, v.status, vl.account_id, vl.payment_method, vl.debit, vl.credit
      FROM fin_vouchers v
      JOIN fin_voucher_lines vl ON v.id = vl.voucher_id
      WHERE vl.account_id IN (SELECT gl_account_id FROM fin_bank_accounts)
      LIMIT 10
    `);
    console.log(vl);

    console.log("\n--- Check the exact query ---");
    const items = await query(
      `SELECT v.id AS voucher_id,
              v.voucher_no,
              v.voucher_date,
              vt.name AS voucher_type_name,
              vl.payment_method,
              ba.id as ba_id
         FROM fin_vouchers v
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
         JOIN fin_bank_accounts ba ON ba.gl_account_id = vl.account_id
                                  AND ba.company_id = v.company_id
         LEFT JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
         LEFT JOIN fin_bank_reconciliation_lines brl ON brl.voucher_id = v.id
        WHERE v.status IN ('APPROVED', 'POSTED')
          AND vl.payment_method IN ('Cheque', 'Bank Transfer', 'Credit Card', 'Journal')
        LIMIT 10`
    );
    console.log(items);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
