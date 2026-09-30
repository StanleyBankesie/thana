import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), "server", ".env") });

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'baseline',
  });
  
  try {
    const [rows] = await pool.query("SELECT id, order_no, created_by, created_at FROM sal_orders LIMIT 5");
    console.log(rows);
  } catch(e) {
    console.log(e);
  }
  process.exit(0);
}
run();
