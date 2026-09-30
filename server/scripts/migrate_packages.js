import { query } from './server/db/pool.js';

async function migrate() {
  try {
    console.log("Renaming table...");
    await query(`RENAME TABLE adm_payment_plans TO adm_payment_packages`);
    
    console.log("Adding columns...");
    await query(`
      ALTER TABLE adm_payment_packages
      ADD COLUMN cloud_hosting DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER amount,
      ADD COLUMN support_maintenance DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER cloud_hosting,
      ADD COLUMN software_license DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER support_maintenance
    `);
    
    console.log("Migration complete.");
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log("Table adm_payment_packages already exists, skipping rename.");
    } else {
      console.error(err);
      process.exit(1);
    }
  }
}

migrate();
