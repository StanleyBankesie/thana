import { query } from './server/db/pool.js';
async function test() {
  const renewals = await query('DESCRIBE adm_license_renewals');
  const licenses = await query('DESCRIBE adm_company_licenses');
  const packages = await query('DESCRIBE adm_payment_packages');
  console.log("RENEWALS:", renewals);
  console.log("LICENSES:", licenses);
  console.log("PACKAGES:", packages);
  process.exit(0);
}
test();
