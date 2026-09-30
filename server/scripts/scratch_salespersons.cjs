const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'server/.env' });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    namedPlaceholders: true
  });
  try {
    await conn.execute(`CREATE TABLE IF NOT EXISTS sal_salespersons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_company_name (company_id, name)
    )`);
    console.log('sal_salespersons table created/verified');

    const [cols1] = await conn.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sal_orders' AND COLUMN_NAME='sales_person_id' AND TABLE_SCHEMA=DATABASE()"
    );
    if (!cols1.length) {
      await conn.execute('ALTER TABLE sal_orders ADD COLUMN sales_person_id INT NULL');
      console.log('Added sales_person_id to sal_orders');
    } else {
      console.log('sales_person_id already in sal_orders');
    }

    const [cols2] = await conn.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sal_invoices' AND COLUMN_NAME='sales_person_id' AND TABLE_SCHEMA=DATABASE()"
    );
    if (!cols2.length) {
      await conn.execute('ALTER TABLE sal_invoices ADD COLUMN sales_person_id INT NULL');
      console.log('Added sales_person_id to sal_invoices');
    } else {
      console.log('sales_person_id already in sal_invoices');
    }

  } finally {
    await conn.end();
  }
}

main().catch(console.error);
