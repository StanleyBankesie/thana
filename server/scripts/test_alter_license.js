import { query } from './server/db/pool.js';
async function test() {
  try {
    await query('ALTER TABLE adm_company_licenses ADD COLUMN alert_days INT DEFAULT 30');
    console.log("Column added");
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log("Column already exists");
    else console.error(e);
  }
  process.exit(0);
}
test();
