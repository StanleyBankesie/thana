import { query } from "./server/db/pool.js";
async function main() {
  const result = await query("SELECT * FROM adm_company_licenses");
  console.log(result);
  process.exit(0);
}
main();
