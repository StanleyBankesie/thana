import { query } from './server/db/pool.js';

async function createTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS adm_payment_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_name VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        duration_months INT NOT NULL,
        status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await query(sql);
    console.log("Table adm_payment_plans created successfully");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createTable();
