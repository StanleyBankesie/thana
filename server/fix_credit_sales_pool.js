import { query } from './db/pool.js';

(async () => {
  try {
    const res = await query(`
      UPDATE pos_sales 
      SET payment_method = 'CREDIT' 
      WHERE payment_status IN ('UNPAID', 'PAID') 
        AND customer_id IS NOT NULL 
        AND payment_method = 'CASH'
        AND paid_amount = 0
    `);

    console.log('Fixed records successfully', res);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
