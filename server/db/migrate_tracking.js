import { query } from "./pool.js";

async function runMigration() {
  console.log("Starting tracking tables migration...");

  try {
    // 1. trip_gps_logs
    await query(`
      CREATE TABLE IF NOT EXISTS trip_gps_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        trip_id INT NOT NULL,
        vehicle_id INT NOT NULL,
        driver_id INT,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        heading DECIMAL(5, 2),
        speed DECIMAL(5, 2),
        accuracy DECIMAL(6, 2),
        altitude DECIMAL(8, 2),
        battery_level DECIMAL(5, 2),
        network_status VARCHAR(50),
        engine_status VARCHAR(50),
        is_offline_point BOOLEAN DEFAULT FALSE,
        recorded_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trip_recorded (trip_id, recorded_at),
        INDEX idx_vehicle_recorded (vehicle_id, recorded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("Created trip_gps_logs table.");

    // 2. fleet_geofences
    await query(`
      CREATE TABLE IF NOT EXISTS fleet_geofences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL, -- WAREHOUSE, CUSTOMER_SITE, OFFICE, RESTRICTED, FUEL_STATION
        polygon_json JSON NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("Created fleet_geofences table.");

    // 3. fleet_alerts
    await query(`
      CREATE TABLE IF NOT EXISTS fleet_alerts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        trip_id INT NOT NULL,
        vehicle_id INT NOT NULL,
        driver_id INT,
        alert_type VARCHAR(50) NOT NULL, -- OVERSPEED, GEOFENCE_ENTRY, ROUTE_DEVIATION, EMERGENCY, LONG_IDLE, OFFLINE
        severity VARCHAR(20) DEFAULT 'INFO',
        message TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        is_resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        INDEX idx_trip_alert (trip_id, alert_type),
        INDEX idx_vehicle_unresolved (vehicle_id, is_resolved)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("Created fleet_alerts table.");

    // 4. Alter trips table to add tracking status if it doesn't exist
    try {
      await query(`ALTER TABLE pm_trips ADD COLUMN tracking_status VARCHAR(50) DEFAULT 'PENDING' AFTER status`);
      console.log("Added tracking_status to pm_trips");
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn("Could not add tracking_status to pm_trips", e.message);
    }

    console.log("Migration complete.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
