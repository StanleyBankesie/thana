const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'server/.env' });
async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  try {
    await c.execute(`
      CREATE OR REPLACE VIEW v_inv_material_returns AS
      SELECT
        r.company_id,
        r.branch_id,
        r.id AS rts_id,
        r.rts_no,
        r.rts_date,
        r.status,
        r.warehouse_id,
        r.department_id,
        d.item_id,
        d.qty_returned AS qty,
        d.uom,
        r.created_at,
        r.created_by,
        u.username AS created_by_name
       FROM inv_return_to_stores r
      JOIN inv_return_to_stores_details d ON d.rts_id = r.id
      LEFT JOIN adm_users u ON u.id = r.created_by
    `);
    console.log('View created successfully');
  } catch (err) {
    console.error('Error creating view:', err.message);
  }
  
  await c.end();
}
main();
