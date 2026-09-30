import { query } from "./db/pool.js";
async function run() {
  await query("ALTER TABLE trans_trips MODIFY COLUMN status ENUM('SCHEDULED', 'STARTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED'");
  process.exit(0);
}
run();
