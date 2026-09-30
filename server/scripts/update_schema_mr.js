import { pool } from '../db/pool.js';

async function updateSchema() {
  const conn = await pool.getConnection();
  try {
    console.log('Starting schema update...');

    // 1. Create adm_departments table
    console.log('Creating adm_departments table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS adm_departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NOT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        -- Foreign keys can be tricky if tables don't exist, assuming adm_companies/branches exist
      )
    `);

    // 2. Update inv_material_requisitions table
    console.log('Updating inv_material_requisitions table...');
    
    // Check if columns exist to avoid errors (simplified approach: try/catch or just run and ignore specific errors)
    // We'll use a safer approach by checking information_schema or just ignoring "Duplicate column" errors.
    // However, DROP COLUMN is destructive.

    // Let's try to add columns first.
    try {
      await conn.query(`ALTER TABLE inv_material_requisitions ADD COLUMN warehouse_id INT`);
      console.log('Added warehouse_id');
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.log('warehouse_id might already exist or error:', e.message);
    }

    try {
      await conn.query(`ALTER TABLE inv_material_requisitions ADD COLUMN department_id INT`);
      console.log('Added department_id');
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.log('department_id might already exist or error:', e.message);
    }

    try {
      await conn.query(`ALTER TABLE inv_material_requisitions ADD COLUMN requisition_type VARCHAR(50) DEFAULT 'INTERNAL'`);
      console.log('Added requisition_type');
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.log('requisition_type might already exist or error:', e.message);
    }

    try {
      await conn.query(`ALTER TABLE inv_material_requisitions ADD COLUMN priority VARCHAR(20) DEFAULT 'MEDIUM'`);
      console.log('Added priority');
    } catch (e) {
      if (!e.message.includes("Duplicate column")) console.log('priority might already exist or error:', e.message);
    }

    // Drop required_date
    try {
      await conn.query(`ALTER TABLE inv_material_requisitions DROP COLUMN required_date`);
      console.log('Dropped required_date');
    } catch (e) {
      console.log('required_date might not exist or error:', e.message);
    }

    console.log('Schema update completed successfully.');
  } catch (err) {
    console.error('Schema update failed:', err);
  } finally {
    conn.release();
    process.exit();
  }
}

updateSchema();
