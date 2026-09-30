import { query } from "./db/pool.js";

async function run() {
  try {
    await query("ALTER TABLE trans_invoices ADD COLUMN trip_id BIGINT UNSIGNED NULL");
    console.log("Migration successful");
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log("Column already exists");
    } else {
      console.error("Migration failed:", error);
    }
  }
  process.exit(0);
}

run();
