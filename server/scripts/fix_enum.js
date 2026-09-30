import { query } from "./db/pool.js";
async function run() {
  try {
    await query("ALTER TABLE adm_company_licenses MODIFY COLUMN status ENUM('ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED') DEFAULT 'ACTIVE'");
    await query("UPDATE adm_company_licenses SET status = 'INACTIVE' WHERE status = ''");
    console.log("Table altered successfully.");
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
