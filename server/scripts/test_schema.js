import { query } from "./db/pool.js";
async function run() {
  const [rows] = await query("DESCRIBE adm_company_licenses");
  console.log(rows);
  process.exit(0);
}
run();
