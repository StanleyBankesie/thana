import { query } from "../db/pool.js";

async function createTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS trans_vehicle_compliance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT NULL,
        vehicle_id INT NOT NULL,
        compliance_no VARCHAR(50) NOT NULL,
        compliance_type VARCHAR(100) NOT NULL,
        document_no VARCHAR(100) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Valid',
        issue_date DATE NULL,
        expiry_date DATE NULL,
        reminder_days INT DEFAULT 30,
        issuing_authority VARCHAR(150) NULL,
        policy_type VARCHAR(100) NULL,
        insurance_company VARCHAR(150) NULL,
        policy_no VARCHAR(100) NULL,
        premium_amount DECIMAL(15,2) DEFAULT 0.00,
        coverage_amount DECIMAL(15,2) DEFAULT 0.00,
        amount_fee DECIMAL(15,2) DEFAULT 0.00,
        payment_date DATE NULL,
        payment_reference VARCHAR(100) NULL,
        attachment_url TEXT NULL,
        receipt_url TEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT NULL,
        INDEX idx_vehicle (vehicle_id),
        INDEX idx_company (company_id)
      );
    `);
    console.log("Table created successfully");
    process.exit(0);
  } catch (error) {
    console.error("Failed to create table", error);
    process.exit(1);
  }
}

createTable();
