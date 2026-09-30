import { query } from "../db/pool.js";

async function createTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS trans_driver_logbook (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT NULL,
        vehicle_id INT NOT NULL,
        driver_id INT NOT NULL,
        logbook_no VARCHAR(50) NOT NULL,
        trip_date DATE NULL,
        department VARCHAR(100) NULL,
        purpose VARCHAR(255) NULL,
        origin VARCHAR(255) NULL,
        destination VARCHAR(255) NULL,
        planned_route VARCHAR(255) NULL,
        departure_time DATETIME NULL,
        expected_return_time DATETIME NULL,
        actual_return_time DATETIME NULL,
        trip_status VARCHAR(50) NOT NULL DEFAULT 'Planned',
        beginning_mileage DECIMAL(15,2) DEFAULT 0.00,
        ending_mileage DECIMAL(15,2) DEFAULT 0.00,
        distance_travelled DECIMAL(15,2) DEFAULT 0.00,
        fuel_level_departure VARCHAR(50) NULL,
        fuel_level_return VARCHAR(50) NULL,
        fuel_issued DECIMAL(15,2) DEFAULT 0.00,
        fuel_cost DECIMAL(15,2) DEFAULT 0.00,
        fuel_station VARCHAR(150) NULL,
        num_passengers INT DEFAULT 0,
        passenger_names TEXT NULL,
        driver_remarks TEXT NULL,
        incident_report TEXT NULL,
        traffic_offence TEXT NULL,
        breakdown_details TEXT NULL,
        requested_by VARCHAR(100) NULL,
        approved_by VARCHAR(100) NULL,
        approval_status VARCHAR(50) DEFAULT 'Pending',
        fuel_receipt_url TEXT NULL,
        toll_receipts_url TEXT NULL,
        support_doc_url TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT NULL,
        INDEX idx_vehicle (vehicle_id),
        INDEX idx_driver (driver_id),
        INDEX idx_company (company_id)
      );
    `);
    console.log("trans_driver_logbook table created successfully");
    process.exit(0);
  } catch (error) {
    console.error("Failed to create table", error);
    process.exit(1);
  }
}

createTable();
