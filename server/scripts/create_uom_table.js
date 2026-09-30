import { pool } from "../db/pool.js";

async function createUomTable() {
  const conn = await pool.getConnection();
  try {
    console.log("Starting schema update for UOMs...");

    // Create inv_uoms table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inv_uoms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        uom_code VARCHAR(20) NOT NULL,
        uom_name VARCHAR(100) NOT NULL,
        uom_type VARCHAR(50) DEFAULT 'COUNT',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_company (company_id)
      )
    `);
    console.log("Ensured inv_uoms table exists");

    // Check if table is empty, if so, seed it
    const [rows] = await conn.query("SELECT COUNT(*) as count FROM inv_uoms");
    if (rows[0].count === 0) {
      console.log("Seeding default UOMs...");
      const defaultUoms = [
        { code: 'PCS', name: 'Pieces', type: 'COUNT' },
        { code: 'BOX', name: 'Box', type: 'COUNT' },
        { code: 'KG', name: 'Kilogram', type: 'WEIGHT' },
        { code: 'LTR', name: 'Liter', type: 'VOLUME' },
        { code: 'MTR', name: 'Meter', type: 'LENGTH' }
      ];

      // Assuming company_id 1 for defaults or handle dynamically. 
      // For this environment, usually companyId is required. I'll use 1.
      const companyId = 1; 

      for (const uom of defaultUoms) {
        await conn.query(
          `INSERT INTO inv_uoms (company_id, uom_code, uom_name, uom_type, is_active) VALUES (?, ?, ?, ?, 1)`,
          [companyId, uom.code, uom.name, uom.type]
        );
      }
      console.log("Seeded default UOMs");
    }

    console.log("Schema update completed successfully.");
  } catch (err) {
    console.error("Schema update failed:", err);
  } finally {
    conn.release();
    process.exit();
  }
}

createUomTable();
