import { pool } from "../db/pool.js";

async function updateSchema() {
  const conn = await pool.getConnection();
  try {
    console.log("Starting schema update for Issue to Requirement...");

    // Create inv_issue_to_requirement
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inv_issue_to_requirement (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT NOT NULL,
        issue_no VARCHAR(50) NOT NULL,
        issue_date DATE NOT NULL,
        warehouse_id INT,
        department_id INT,
        issued_to VARCHAR(100),
        requisition_id INT,
        issue_type VARCHAR(50) DEFAULT 'GENERAL',
        status VARCHAR(20) DEFAULT 'DRAFT',
        remarks TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_company_branch (company_id, branch_id)
      )
    `);
    console.log("Ensured inv_issue_to_requirement table exists");

    // Create inv_issue_to_requirement_details
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inv_issue_to_requirement_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_id INT NOT NULL,
        item_id INT NOT NULL,
        qty_issued DECIMAL(15, 2) NOT NULL DEFAULT 0,
        uom VARCHAR(20) DEFAULT 'PCS',
        batch_number VARCHAR(100),
        serial_number VARCHAR(100),
        FOREIGN KEY (issue_id) REFERENCES inv_issue_to_requirement(id) ON DELETE CASCADE
      )
    `);
    console.log("Ensured inv_issue_to_requirement_details table exists");

    // Now try to add columns if table existed but columns didn't
    const headerColumns = [
      "ADD COLUMN issue_type VARCHAR(50) DEFAULT 'GENERAL'",
      "ADD COLUMN department_id INT NULL",
      "ADD COLUMN requisition_id INT NULL",
    ];

    for (const col of headerColumns) {
      try {
        await conn.query(`ALTER TABLE inv_issue_to_requirement ${col}`);
        console.log(`Executed: ALTER TABLE inv_issue_to_requirement ${col}`);
      } catch (e) {
        if (!e.message.includes("Duplicate column")) {
          // Ignore if column already exists
        }
      }
    }

    const detailColumns = [
      "ADD COLUMN batch_number VARCHAR(100) NULL",
      "ADD COLUMN serial_number VARCHAR(100) NULL",
      "ADD COLUMN uom VARCHAR(20) DEFAULT 'PCS'",
    ];

    for (const col of detailColumns) {
      try {
        await conn.query(`ALTER TABLE inv_issue_to_requirement_details ${col}`);
        console.log(
          `Executed: ALTER TABLE inv_issue_to_requirement_details ${col}`
        );
      } catch (e) {
        if (!e.message.includes("Duplicate column")) {
          // Ignore if column already exists
        }
      }
    }

    console.log("Schema update completed successfully.");
  } catch (err) {
    console.error("Schema update failed:", err);
  } finally {
    conn.release();
    process.exit();
  }
}

updateSchema();
