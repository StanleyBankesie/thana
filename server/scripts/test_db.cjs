const { query } = require('./utils/db.js');

async function run() {
  try {
    const items = await query(`
      SELECT v.id AS voucher_id, v.voucher_no, v.voucher_date,
             COALESCE(vl.description, v.narration, '') AS narration,
             vl.cheque_number AS checkNumber,
             vl.cheque_date AS chequeDate,
             COALESCE(oa.name, '') AS account_name,
             vl.debit, vl.credit
        FROM fin_voucher_lines vl
        JOIN fin_vouchers v ON v.id = vl.voucher_id
        LEFT JOIN fin_accounts oa ON oa.id = (
          SELECT x.account_id FROM fin_voucher_lines x WHERE x.voucher_id = vl.voucher_id AND x.id <> vl.id LIMIT 1
        )
       WHERE vl.account_id = 7
    `);
    console.log(items);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
