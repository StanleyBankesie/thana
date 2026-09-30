import { query } from "./db/pool.js";
import fs from "fs";

async function run() {
  try {
    const res = await query("SHOW TABLES LIKE 'sys_sessions'");
    if (res.length === 0) {
      console.log("sys_sessions table DOES NOT EXIST. Creating it...");
      await query(`
        CREATE TABLE sys_sessions (
          id VARCHAR(255) PRIMARY KEY,
          data LONGTEXT NOT NULL,
          expires_at BIGINT NOT NULL
        )
      `);
      console.log("Table created.");
    } else {
      console.log("sys_sessions table exists. Schema:");
      const desc = await query("DESCRIBE sys_sessions");
      console.log(desc);
      
      const rows = await query("SELECT id FROM sys_sessions LIMIT 5");
      console.log("Sample rows:", rows);
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
