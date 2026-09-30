const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'server/.env' });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME
  });
  try {
    const [cols1] = await conn.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sal_salespersons' AND COLUMN_NAME='email' AND TABLE_SCHEMA=DATABASE()"
    );
    if (!cols1.length) {
      await conn.execute('ALTER TABLE sal_salespersons ADD COLUMN email VARCHAR(255) NULL');
      console.log('Added email to sal_salespersons');
    }
    const [cols2] = await conn.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sal_salespersons' AND COLUMN_NAME='is_active' AND TABLE_SCHEMA=DATABASE()"
    );
    if (!cols2.length) {
      await conn.execute('ALTER TABLE sal_salespersons ADD COLUMN is_active TINYINT(1) DEFAULT 1');
      console.log('Added is_active to sal_salespersons');
    }
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
