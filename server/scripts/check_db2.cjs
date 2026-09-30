const { query } = require('./utils/dbUtils.js');
async function run() {
  const r = await query("SELECT id, item_code, selling_price, cost_price FROM inv_items WHERE item_code='ITM-000004'");
  console.log(r);
  process.exit(0);
}
run();
