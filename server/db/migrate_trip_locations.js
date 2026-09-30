import pool from './pool.js';

async function migrate() {
  console.log('Adding missing columns to trans_trip_locations...');
  
  const alterStatements = [
    'ALTER TABLE trans_trip_locations ADD COLUMN vehicle_id INT DEFAULT NULL AFTER trip_id',
    'ALTER TABLE trans_trip_locations ADD COLUMN driver_id INT DEFAULT NULL AFTER vehicle_id',
    'ALTER TABLE trans_trip_locations ADD COLUMN altitude DECIMAL(8, 2) DEFAULT NULL AFTER accuracy',
    'ALTER TABLE trans_trip_locations ADD COLUMN battery_level DECIMAL(5, 2) DEFAULT NULL AFTER altitude',
    'ALTER TABLE trans_trip_locations ADD COLUMN network_status VARCHAR(50) DEFAULT NULL AFTER battery_level',
    'ALTER TABLE trans_trip_locations ADD COLUMN engine_status VARCHAR(50) DEFAULT NULL AFTER network_status',
    'ALTER TABLE trans_trip_locations ADD COLUMN is_offline_point BOOLEAN DEFAULT FALSE AFTER engine_status',
  ];

  for (const sql of alterStatements) {
    try {
      await pool.query(sql);
      console.log('  OK:', sql.substring(0, 80) + '...');
    } catch (e) {
      if (e.message && e.message.includes('Duplicate')) {
        console.log('  SKIP (already exists):', sql.substring(0, 60) + '...');
      } else {
        console.warn('  WARN:', e.message);
      }
    }
  }

  // Add indexes
  const indexStatements = [
    'ALTER TABLE trans_trip_locations ADD INDEX idx_trip_recorded (trip_id, recorded_at)',
    'ALTER TABLE trans_trip_locations ADD INDEX idx_vehicle_recorded (vehicle_id, recorded_at)',
  ];
  
  for (const sql of indexStatements) {
    try {
      await pool.query(sql);
      console.log('  OK:', sql.substring(0, 80) + '...');
    } catch (e) {
      if (e.message && e.message.includes('Duplicate')) {
        console.log('  SKIP (already exists):', sql.substring(0, 60) + '...');
      } else {
        console.warn('  WARN:', e.message);
      }
    }
  }

  console.log('Migration complete!');
  await pool.end();
}

migrate();
