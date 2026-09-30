import pool from './server/db/pool.js';
import { ensureCustomerFinAccountIdTx } from './server/controllers/finance.controller.js';

(async () => {
  try {
    const [rows] = await pool.query('SELECT id, company_id FROM sal_customers');
    console.log(`Found ${rows.length} customers to sync.`);
    
    for (const row of rows) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await ensureCustomerFinAccountIdTx(conn, { companyId: row.company_id, customerId: row.id });
        await conn.commit();
        console.log(`Synced account for customer ${row.id}`);
      } catch (err) {
        await conn.rollback();
        console.error(`Failed for customer ${row.id}:`, err.message);
      } finally {
        conn.release();
      }
    }
    console.log('Done!');
  } catch (err) {
    console.error('Fatal error:', err.message);
  }
  process.exit(0);
})();
