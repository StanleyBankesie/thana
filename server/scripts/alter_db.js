import { query } from './db/pool.js';

async function alterDb() {
  try {
    await query(`ALTER TABLE trans_trips ADD COLUMN origin_name VARCHAR(255) NULL`);
    await query(`ALTER TABLE trans_trips ADD COLUMN origin_lat DECIMAL(10,8) NULL`);
    await query(`ALTER TABLE trans_trips ADD COLUMN origin_lng DECIMAL(11,8) NULL`);
    await query(`ALTER TABLE trans_trips ADD COLUMN destination_name VARCHAR(255) NULL`);
    await query(`ALTER TABLE trans_trips ADD COLUMN destination_lat DECIMAL(10,8) NULL`);
    await query(`ALTER TABLE trans_trips ADD COLUMN destination_lng DECIMAL(11,8) NULL`);
    console.log("Columns added successfully");
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Columns already exist");
    } else {
      console.error("Error altering DB:", err);
    }
  }
  process.exit();
}

alterDb();
