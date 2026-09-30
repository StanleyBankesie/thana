/**
 * Script to update database schema for inv_service_confirmations adding order_id and execution_id.
 */
const mysql = require("mysql2/promise");
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: "localhost",
    user: "root",
    database: "omnisuite"
  });
  
  try {
    await conn.query("ALTER TABLE inv_service_confirmations ADD COLUMN order_id BIGINT UNSIGNED NULL");
    console.log("Added order_id");
  } catch (e) {
    console.log(e.message);
  }
  
  try {
    await conn.query("ALTER TABLE inv_service_confirmations ADD COLUMN execution_id BIGINT UNSIGNED NULL");
    console.log("Added execution_id");
  } catch (e) {
    console.log(e.message);
  }
  
  try {
    await conn.query("ALTER TABLE inv_service_confirmations MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'");
    console.log("Modified status to VARCHAR(50)");
  } catch (e) {
    console.log(e.message);
  }
  
  await conn.end();
})();
