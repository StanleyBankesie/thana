import { query } from './server/db/pool.js';
async function test() {
  try {
    const res = await query('DESCRIBE adm_payment_packages');
    console.log("adm_payment_packages schema:");
    console.log(res.map(r => r.Field));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
test();
