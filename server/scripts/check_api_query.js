import { query } from './db/pool.js';

async function run() {
  const q = `
        SELECT
          i.id,
          i.item_code,
          i.item_name,
          i.cost_price,
          i.selling_price
        FROM inv_items i
        WHERE i.item_code = 'ITM-000004'
  `;
  const res = await query(q);
  console.log(res);
  process.exit(0);
}
run();
