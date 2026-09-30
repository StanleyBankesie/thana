import { query } from './server/db.js';
async function test() {
  try {
    const rows = await query('SELECT COUNT(*) as count FROM sal_invoices WHERE balance_amount > 0');
    console.log(rows);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
