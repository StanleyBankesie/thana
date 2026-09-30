import { query } from './server/db/pool.js';
async function test() {
  const tpl = await query('DESCRIBE adm_document_templates');
  console.log("TEMPLATES:", tpl);
  process.exit(0);
}
test();
