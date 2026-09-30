import { query } from './db/pool.js';

async function test() {
  try {
    const rows = await query("SELECT * FROM sal_discount_schemes");
    console.log("DB Result sal_discount_schemes:", rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
