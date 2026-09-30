import { query } from "./db/pool.js";

async function run() {
  try {
    console.log("Adding allow_login_renewal to adm_company_licenses...");
    await query("ALTER TABLE adm_company_licenses ADD COLUMN allow_login_renewal BOOLEAN DEFAULT TRUE");
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
