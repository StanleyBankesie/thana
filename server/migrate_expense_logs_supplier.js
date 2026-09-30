import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function migrate() {
  try {
    const pool = createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'omnisuite',
    });
    
    try {
      await pool.query(`
        ALTER TABLE trans_expense_logs 
        ADD COLUMN supplier_id INT DEFAULT NULL AFTER vehicle_id
      `);
      console.log('Added supplier_id column to trans_expense_logs');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('Column supplier_id already exists');
      } else {
        throw e;
      }
    }
  } catch (e) {
    console.error('Migration failed:', e);
  }
  process.exit(0);
}
migrate();
