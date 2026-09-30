import { query } from './utils/dbUtils.js';

async function test() {
  try {
    const rows = await query("SELECT item_name, selling_price, cost_price FROM inv_items WHERE item_code = 'ITM-000004'");
    console.log("DB Result:", rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
