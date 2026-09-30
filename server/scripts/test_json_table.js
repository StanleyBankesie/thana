import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'serianamart'
  });
  
  // Test MariaDB JSON_TABLE
  const sql = `
        SELECT pt.*
        FROM (SELECT '[{"method": "CASH", "amount": 100}]' AS payments) p
        LEFT JOIN JSON_TABLE(
          p.payments,
          '$[*]' COLUMNS (
            method VARCHAR(20) PATH '$.method',
            amount DECIMAL(18,2) PATH '$.amount'
          )
        ) pt ON 1=1
  `;
  try {
    const [rows] = await conn.execute(sql);
    console.log("Success JSON_TABLE:", rows);
  } catch (err) {
    console.error("SQL Error:", err.message);
  }
  
  // Test version
  try {
    const [rows] = await conn.execute("SELECT VERSION()");
    console.log("Version:", rows);
  } catch (err) {}
  
  await conn.end();
}
test();
