import { query } from './server/db/pool.js';

async function createTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS adm_license_renewals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        initiator_name VARCHAR(255) NOT NULL,
        initiator_email VARCHAR(255) NOT NULL,
        initiator_mobile VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        plan_name VARCHAR(100) NOT NULL,
        status ENUM('PENDING', 'SUCCESS', 'FAILED') DEFAULT 'PENDING',
        reference VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await query(sql);
    console.log("Table adm_license_renewals created successfully");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createTable();
