import pool from './db/pool.js';
pool.query('ALTER TABLE sal_invoices ADD COLUMN service_execution_id bigint(20) unsigned DEFAULT NULL')
  .then(() => {
    console.log('Column added');
    process.exit(0);
  })
  .catch(e => {
    if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('Column already exists');
        process.exit(0);
    }
    console.error(e.message);
    process.exit(1);
  });
