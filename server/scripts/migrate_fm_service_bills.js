import { pool } from "../db/pool.js";

export async function migrateFMServiceBills() {
  console.log("Connected to DB, running FM Service Bills migration...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_service_bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL DEFAULT 1,
      branch_id INT NULL,
      bill_no VARCHAR(50) NOT NULL,
      bill_date DATE NOT NULL,
      due_date DATE NULL,
      property_id INT NULL,
      client_id INT NULL,
      client_name VARCHAR(150) NULL,
      contract_id INT NULL,
      contract_no VARCHAR(100) NULL,
      currency_id INT NULL,
      exchange_rate DECIMAL(12, 6) DEFAULT 1.000000,
      subtotal DECIMAL(14, 2) DEFAULT 0.00,
      tax_amount DECIMAL(14, 2) DEFAULT 0.00,
      discount_amount DECIMAL(14, 2) DEFAULT 0.00,
      total_amount DECIMAL(14, 2) DEFAULT 0.00,
      paid_amount DECIMAL(14, 2) DEFAULT 0.00,
      balance_due DECIMAL(14, 2) DEFAULT 0.00,
      status ENUM('DRAFT', 'PENDING', 'APPROVED', 'POSTED', 'PAID', 'OVERDUE', 'CANCELLED') DEFAULT 'POSTED',
      payment_status ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID') DEFAULT 'UNPAID',
      payment_method VARCHAR(50) DEFAULT 'Bank Transfer',
      payment_terms VARCHAR(50) DEFAULT 'Net 30',
      notes TEXT NULL,
      created_by VARCHAR(100) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_fm_bill_no (company_id, bill_no),
      INDEX idx_fm_bill_prop (property_id),
      INDEX idx_fm_bill_date (bill_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_service_bill_details (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bill_id INT NOT NULL,
      item_seq INT DEFAULT 1,
      service_id INT NULL,
      description VARCHAR(255) NOT NULL,
      quantity DECIMAL(10, 2) DEFAULT 1.00,
      uom VARCHAR(20) DEFAULT 'Lot',
      unit_price DECIMAL(14, 2) DEFAULT 0.00,
      discount_percent DECIMAL(5, 2) DEFAULT 0.00,
      tax_code_id INT NULL,
      tax_rate DECIMAL(5, 2) DEFAULT 0.00,
      tax_amount DECIMAL(14, 2) DEFAULT 0.00,
      total_amount DECIMAL(14, 2) DEFAULT 0.00,
      notes VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fmdet_bill (bill_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Add cost_center columns to fm_budgets if missing
  const [cols] = await pool.query("SHOW COLUMNS FROM fm_budgets LIKE 'cost_center_id'");
  if (cols.length === 0) {
    await pool.query("ALTER TABLE fm_budgets ADD COLUMN cost_center_id INT NULL AFTER property_id, ADD COLUMN cost_center_name VARCHAR(150) NULL AFTER cost_center_id");
    console.log("Added cost_center_id & cost_center_name to fm_budgets");
  }

  // Seed initial FB- bill if none exist
  const [bills] = await pool.query("SELECT id FROM fm_service_bills LIMIT 1");
  if (bills.length === 0) {
    const [res] = await pool.query(`
      INSERT INTO fm_service_bills (
        company_id, bill_no, bill_date, due_date, property_id, client_id, client_name, contract_id, contract_no,
        subtotal, tax_amount, total_amount, paid_amount, balance_due, status, payment_status, payment_method, notes, created_by
      ) VALUES (
        1, 'FB-2026-0001', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1, 1, 'Ridgecrest Corporate Plaza', 1, 'CTR-FM-2026-001',
        4500.00, 984.38, 5484.38, 5484.38, 0.00, 'POSTED', 'PAID', 'Bank Transfer', 'Monthly Comprehensive HVAC & Cleaning Service Fee', 'Admin'
      )
    `);
    await pool.query(`
      INSERT INTO fm_service_bill_details (
        bill_id, item_seq, description, quantity, uom, unit_price, tax_rate, tax_amount, total_amount
      ) VALUES
      (?, 1, 'Chilled Water HVAC Central Plant Maintenance', 1, 'Month', 3000.00, 21.875, 656.25, 3656.25),
      (?, 2, 'Daily Janitorial & Restroom Sanitization Operatives', 1, 'Month', 1500.00, 21.875, 328.13, 1828.13)
    `, [res.insertId, res.insertId]);
    console.log("Seeded initial FB-2026-0001 bill successfully");
  }

  console.log("Migration completed successfully!");
}

migrateFMServiceBills().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
