import { pool } from "../db/pool.js";

async function run() {
  const conn = await pool.getConnection();
  try {
    console.log("Updating schema for Return to Stores...");

    // Check if columns exist in inv_return_to_stores
    try {
      await conn.query(
        `ALTER TABLE inv_return_to_stores ADD COLUMN department_id INT`
      );
      console.log("Added department_id column");
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log(
          "department_id column already exists or other error:",
          e.message
        );
    }

    try {
      await conn.query(
        `ALTER TABLE inv_return_to_stores ADD COLUMN requisition_id INT`
      );
      console.log("Added requisition_id column");
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log(
          "requisition_id column already exists or other error:",
          e.message
        );
    }

    // Check inv_return_to_stores_details
    try {
      await conn.query(
        `ALTER TABLE inv_return_to_stores_details ADD COLUMN \`condition\` VARCHAR(50) DEFAULT 'GOOD'`
      );
      console.log("Added condition column");
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log(
          "condition column already exists or other error:",
          e.message
        );
    }

    try {
      await conn.query(
        `ALTER TABLE inv_return_to_stores_details ADD COLUMN batch_serial VARCHAR(100)`
      );
      console.log("Added batch_serial column");
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log(
          "batch_serial column already exists or other error:",
          e.message
        );
    }

    try {
      await conn.query(
        `ALTER TABLE inv_return_to_stores_details ADD COLUMN location VARCHAR(100)`
      );
      console.log("Added location column");
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log(
          "location column already exists or other error:",
          e.message
        );
    }

    console.log("Schema update complete.");
  } catch (err) {
    console.error("Schema update failed:", err);
  } finally {
    conn.release();
    process.exit();
  }
}

run();
