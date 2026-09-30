import { query } from './db/pool.js';

async function fixDB() {
  const queries = [
    "ALTER TABLE trans_requests ADD COLUMN vehicle_id BIGINT UNSIGNED NULL AFTER customer_id;",
    "ALTER TABLE trans_requests ADD COLUMN requester_name VARCHAR(255) NULL AFTER vehicle_id;",
    "ALTER TABLE trans_requests ADD COLUMN return_date DATE NULL AFTER required_date;",
    "ALTER TABLE trans_requests ADD COLUMN required_time TIME NULL AFTER return_date;",
    "ALTER TABLE trans_requests ADD COLUMN return_time TIME NULL AFTER required_time;",
    "ALTER TABLE trans_requests ADD COLUMN no_of_days DECIMAL(10,2) NULL AFTER return_time;",
    "ALTER TABLE trans_requests ADD COLUMN no_of_hours DECIMAL(10,2) NULL AFTER no_of_days;",
    "ALTER TABLE trans_requests ADD COLUMN purpose_of_journey TEXT NULL AFTER destination;",
    "ALTER TABLE trans_requests ADD COLUMN priority VARCHAR(50) DEFAULT 'NORMAL' AFTER purpose_of_journey;",
    "ALTER TABLE trans_requests ADD COLUMN notes TEXT NULL AFTER priority;"
  ];

  for (const q of queries) {
    try {
      await query(q);
      console.log("SUCCESS:", q);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("ALREADY EXISTS:", q);
      } else {
        console.error("ERROR:", e.message);
      }
    }
  }

  process.exit(0);
}

fixDB();
