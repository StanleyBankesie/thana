const fs = require('fs');
const pool = require('./server/db/pool.js');

async function runSqlFile(filepath) {
  console.log(`Running ${filepath}...`);
  const sql = fs.readFileSync(filepath, 'utf8');
  // Simple split by ; but ignoring semicolons inside strings would be better.
  // For basic schemas, this usually works:
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const statement of statements) {
    try {
      if (statement.startsWith('--') && !statement.includes('\n')) continue; // skip pure comments
      await pool.query(statement);
    } catch (err) {
      console.error(`Error executing statement: ${statement.substring(0, 100)}...`);
      console.error(err.message);
    }
  }
  console.log(`Finished ${filepath}`);
}

async function main() {
  await runSqlFile('./server/db/transport_module.sql');
  await runSqlFile('./server/db/migrations/transport_gps_pod.sql');
  process.exit(0);
}

main().catch(console.error);
