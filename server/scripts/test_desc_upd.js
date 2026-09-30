import { query } from './server/db/pool.js';
async function test() {
  try {
    const res = await query('DESCRIBE inv_stock_updations');
    console.log("inv_stock_updations schema:");
    console.log(res.map(r => r.Field));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
test();
