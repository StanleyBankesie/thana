const { query } = require('../server/utils/dbUtils.js');

async function main() {
  const tables = await query('SHOW TABLES');
  const names = tables.map(t => Object.values(t)[0]);
  console.log('Matching tables:', names.filter(n => n.includes('subcontract') || n.includes('supplier')));

  const scCols = await query('DESCRIBE pm_subcontracts');
  console.log('pm_subcontracts columns:', scCols.map(c => `${c.Field} (${c.Type})`));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
