import { query } from './server/db/pool.js';
async function test() {
  try {
    const res = await query('DESCRIBE inv_warehouses');
    console.log("inv_warehouses schema:");
    console.log(res.map(r => r.Field));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
test();
