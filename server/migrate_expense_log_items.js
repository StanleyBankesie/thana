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
    
    // Add currency column if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE trans_expense_logs 
        ADD COLUMN currency VARCHAR(10) DEFAULT 'GHS' AFTER amount
      `);
      console.log('Added currency column to trans_expense_logs');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('Column currency already exists');
      } else {
        throw e;
      }
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trans_expense_log_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        log_id INT NOT NULL,
        item_id INT NOT NULL,
        uom VARCHAR(20) DEFAULT NULL,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
        unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        net_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_exp_log_items_log FOREIGN KEY (log_id) REFERENCES trans_expense_logs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created trans_expense_log_items table');
  } catch (e) {
    console.error('Migration failed:', e);
  }
  process.exit(0);
}
migrate();
