const pool = require('./server/db/pool.js');

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trans_transportation_bills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        bill_no VARCHAR(50) NOT NULL,
        bill_date DATE NOT NULL,
        supplier_id INT NOT NULL,
        total_amount DECIMAL(15,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'DRAFT',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trans_transportation_bill_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NOT NULL,
        item_id INT NOT NULL,
        quantity DECIMAL(15,2) DEFAULT 1.00,
        unit_price DECIMAL(15,2) DEFAULT 0.00,
        total_amount DECIMAL(15,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log("trans_transportation_bills tables created successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error creating tables:", err);
    process.exit(1);
  }
}

createTables();
