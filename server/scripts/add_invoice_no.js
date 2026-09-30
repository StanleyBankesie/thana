import { query } from "./db/pool.js";

async function run() {
  try {
    console.log("Adding invoice_no to adm_license_renewals...");
    await query("ALTER TABLE adm_license_renewals ADD COLUMN invoice_no VARCHAR(50) NULL");
    console.log("Done.");
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("Column already exists.");
    } else {
      console.error(err);
    }
  }
  process.exit(0);
}
run();
