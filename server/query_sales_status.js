import { query } from './db/pool.js';

(async () => {
  try {
    const res = await query(`
      SELECT id, receipt_no, payment_method, payment_status, gross_amount, net_amount, paid_amount 
      FROM pos_sales 
      WHERE payment_status IS NOT NULL
      ORDER BY id DESC LIMIT 5
    `);

    console.log(res);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
