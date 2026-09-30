import pool from './server/db/pool.js';
(async () => {
  try {
    await pool.query('ALTER TABLE sal_customers CHANGE service_client service_customer VARCHAR(1) DEFAULT "N"');
    console.log('Renamed service_client to service_customer in sal_customers');
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') console.log('service_client does not exist (maybe already renamed?)');
    else console.error('SQL Error:', err.message);
  }
  process.exit(0);
})();
