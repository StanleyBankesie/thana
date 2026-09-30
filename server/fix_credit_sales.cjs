require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'demo',
      password: process.env.DB_PASSWORD || 'demo_password',
      database: process.env.DB_NAME || 'demo_db',
    });

    const [res] = await pool.execute(`
      UPDATE pos_sales 
      SET payment_method = 'CREDIT' 
      WHERE payment_status = 'UNPAID' 
        AND customer_id IS NOT NULL 
        AND payment_method = 'CASH'
        AND paid_amount = 0
    `);

    console.log('Fixed records:', res.affectedRows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
