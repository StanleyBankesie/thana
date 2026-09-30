import { query } from './server/db/pool.js';
async function test() {
  try {
    const res = await query('DESCRIBE adm_license_renewals');
    console.log("adm_license_renewals schema:");
    console.log(res.map(r => r.Field));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
test();
