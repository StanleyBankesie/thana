import { query } from './server/db/pool.js';

async function listSchemas() {
  const tables = await query("SHOW TABLES");
  const dbName = Object.values(tables[0])[0];
  const tableNames = tables.map(t => Object.values(t)[0]);
  
  const relevantTables = tableNames.filter(name => 
    name.startsWith('sal_') || 
    name.startsWith('pur_') || 
    name.startsWith('inv_') || 
    name.startsWith('proj_') ||
    name.includes('expense')
  );

  console.log("Found Tables:", relevantTables);

  for (const t of relevantTables) {
    const desc = await query(`DESCRIBE ${t}`);
    console.log(`\n--- Schema for ${t} ---`);
    console.table(desc);
  }
  
  process.exit(0);
}

listSchemas().catch(console.error);
