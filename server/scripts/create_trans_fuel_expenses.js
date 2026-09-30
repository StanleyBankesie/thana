import { pool } from './server/db/pool.js';

async function run() {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS trans_fuel_expenses (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        vehicle_id BIGINT UNSIGNED NOT NULL,
        driver_name VARCHAR(255),
        description TEXT,
        supplier_id BIGINT UNSIGNED,
        supplier_name VARCHAR(255),
        expense_type VARCHAR(100),
        is_tax_included TINYINT(1) DEFAULT 0,
        tax_code_id BIGINT UNSIGNED,
        amount DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
        remarks TEXT,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by BIGINT UNSIGNED
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("trans_fuel_expenses table created successfully.");
  } catch (err) {
    console.error("Error creating table:", err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

run();
