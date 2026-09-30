import { query } from './server/db/pool.js';
async function test() {
  try {
    const res = await query('DESCRIBE inv_items');
    console.log(res);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
test();
