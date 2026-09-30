import { query } from "./db/pool.js";
async function run() {
  try {
    const rows = await query("DESCRIBE adm_company_licenses");
    const statusField = rows.find(r => r.Field === 'status');
    console.log(statusField);
  } catch (err) { console.error(err); }
  process.exit(0);
}
run();
