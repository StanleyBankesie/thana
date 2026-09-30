import { query } from "./pool.js";

async function runMigration() {
  console.log("Starting trans_trips migration...");
  try {
    await query(`ALTER TABLE trans_trips ADD COLUMN tracking_status VARCHAR(50) DEFAULT 'PENDING' AFTER status`);
    console.log("Added tracking_status to trans_trips");
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') console.warn("Could not add tracking_status to trans_trips", e.message);
    else console.log("tracking_status already exists on trans_trips");
  }
  process.exit(0);
}

runMigration();
