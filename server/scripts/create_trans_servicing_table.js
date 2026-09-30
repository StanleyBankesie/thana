import { query } from "../db/pool.js";

async function createTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS trans_vehicle_servicing (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT NULL,
        vehicle_id INT NOT NULL,
        service_no VARCHAR(50) NOT NULL,
        service_type VARCHAR(100) NOT NULL,
        service_date DATE NULL,
        next_service_date DATE NULL,
        service_interval_days INT NULL,
        current_service_mileage DECIMAL(15,2) DEFAULT 0.00,
        next_service_mileage DECIMAL(15,2) DEFAULT 0.00,
        odometer_reading DECIMAL(15,2) DEFAULT 0.00,
        service_status VARCHAR(50) NOT NULL DEFAULT 'Completed',
        provider_garage VARCHAR(150) NULL,
        provider_mechanic VARCHAR(150) NULL,
        provider_contact_person VARCHAR(150) NULL,
        provider_contact_number VARCHAR(50) NULL,
        labour_cost DECIMAL(15,2) DEFAULT 0.00,
        parts_cost DECIMAL(15,2) DEFAULT 0.00,
        other_charges DECIMAL(15,2) DEFAULT 0.00,
        total_cost DECIMAL(15,2) DEFAULT 0.00,
        payment_status VARCHAR(50) DEFAULT 'Pending',
        payment_reference VARCHAR(100) NULL,
        services_performed JSON NULL,
        parts_replaced JSON NULL,
        invoice_url TEXT NULL,
        receipt_url TEXT NULL,
        report_url TEXT NULL,
        support_doc_url TEXT NULL,
        notes TEXT NULL,
        completion_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT NULL,
        INDEX idx_vehicle (vehicle_id),
        INDEX idx_company (company_id)
      );
    `);
    console.log("Table created successfully");
    process.exit(0);
  } catch (error) {
    console.error("Failed to create table", error);
    process.exit(1);
  }
}

createTable();
