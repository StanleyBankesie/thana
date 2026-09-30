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
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trans_expense_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT DEFAULT NULL,
        trip_id INT DEFAULT NULL,
        vehicle_id INT DEFAULT NULL,
        expense_type VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        expense_date DATE DEFAULT NULL,
        description TEXT DEFAULT NULL,
        recorded_by VARCHAR(100) DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        KEY (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created trans_expense_logs table');
  } catch (e) {
    console.error('Migration failed:', e);
  }
  process.exit(0);
}
migrate();
