/**
 * @fileoverview Utility script to check database connectivity using environment variables.
 * @module check_db
 */

import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

/**
 * Connects to the database and retrieves sample service orders.
 *
 * @async
 * @returns {Promise<void>}
 */
// Utility function to verify database connectivity using environment variables
async function check() {
  // Establish a connection using credentials loaded from .env
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'seriana_erp',
    port: process.env.DB_PORT || 3306,
  });

  // Query a small sample of recent purchase service orders to test data retrieval
  const [rows] = await conn.execute(`SELECT id, created_by, created_at FROM pur_service_orders ORDER BY id DESC LIMIT 5`);
  // Log the retrieved rows
  console.log(rows);
  // Gracefully close the connection
  conn.end();
}
// Execute the connectivity check and catch any top-level errors
check().catch(console.error);
