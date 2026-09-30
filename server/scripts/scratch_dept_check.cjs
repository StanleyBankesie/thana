const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'server/.env' });
async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  // Check what departments exist in adm_departments
  const [adm] = await c.execute('SELECT id, name FROM adm_departments LIMIT 10');
  console.log('adm_departments:', JSON.stringify(adm));
  // Check what department_ids are in material requisitions
  const [mr] = await c.execute('SELECT id, department_id FROM inv_material_requisitions LIMIT 5');
  console.log('inv_material_requisitions dept_ids:', JSON.stringify(mr));
  // Check what dept_ids are in hr_departments
  const [hr] = await c.execute('SELECT id, dept_name FROM hr_departments LIMIT 10');
  console.log('hr_departments:', JSON.stringify(hr));
  await c.end();
}
main().catch(e => console.error('err:', e.message));
