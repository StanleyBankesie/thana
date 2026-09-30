-- Transport Module Schema
-- Version: 1.0.0
-- Description: Complete Transport module for ERP

SET FOREIGN_KEY_CHECKS = 0;

-- trans_vehicles
CREATE TABLE IF NOT EXISTS trans_vehicles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  reg_number VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(100) NOT NULL,
  make VARCHAR(100) NULL,
  model VARCHAR(100) NULL,
  year_of_manufacture INT NULL,
  capacity DECIMAL(15,2) NULL,
  capacity_unit VARCHAR(20) NULL,
  current_odometer DECIMAL(15,2) NOT NULL DEFAULT 0,
  status ENUM('AVAILABLE', 'ON_TRIP', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'AVAILABLE',
  insurance_expiry DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_vehicle_reg (company_id, reg_number),
  KEY idx_vehicle_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- trans_drivers
CREATE TABLE IF NOT EXISTS trans_drivers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  license_number VARCHAR(100) NOT NULL,
  license_type VARCHAR(50) NOT NULL,
  license_expiry DATE NOT NULL,
  status ENUM('AVAILABLE', 'ON_TRIP', 'ON_LEAVE', 'SUSPENDED') NOT NULL DEFAULT 'AVAILABLE',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_driver_emp (company_id, employee_id),
  UNIQUE KEY uk_driver_license (company_id, license_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- trans_routes
CREATE TABLE IF NOT EXISTS trans_routes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  route_code VARCHAR(50) NOT NULL,
  route_name VARCHAR(255) NOT NULL,
  origin VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  distance DECIMAL(15,2) NULL,
  estimated_time INT NULL, -- in minutes
  base_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_route_code (company_id, route_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- trans_requests
CREATE TABLE IF NOT EXISTS trans_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  request_number VARCHAR(50) NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  department_id BIGINT UNSIGNED NULL, -- for internal requests
  request_date DATE NOT NULL,
  required_date DATE NOT NULL,
  origin VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  cargo_description TEXT NULL,
  weight DECIMAL(15,2) NULL,
  status ENUM('DRAFT', 'PENDING', 'APPROVED', 'SCHEDULED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  remarks TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_request_num (company_id, request_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- trans_trips
CREATE TABLE IF NOT EXISTS trans_trips (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  trip_number VARCHAR(50) NOT NULL,
  request_id BIGINT UNSIGNED NULL,
  route_id BIGINT UNSIGNED NULL,
  vehicle_id BIGINT UNSIGNED NOT NULL,
  driver_id BIGINT UNSIGNED NOT NULL,
  start_time DATETIME NULL,
  end_time DATETIME NULL,
  start_odometer DECIMAL(15,2) NULL,
  end_odometer DECIMAL(15,2) NULL,
  origin_name VARCHAR(255) NULL,
  origin_lat DECIMAL(10,8) NULL,
  origin_lng DECIMAL(11,8) NULL,
  destination_name VARCHAR(255) NULL,
  destination_lat DECIMAL(10,8) NULL,
  destination_lng DECIMAL(11,8) NULL,
  status ENUM('SCHEDULED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  remarks TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_trip_num (company_id, trip_number),
  KEY idx_trip_vehicle (vehicle_id),
  KEY idx_trip_driver (driver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- trans_fuel_logs
CREATE TABLE IF NOT EXISTS trans_fuel_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  vehicle_id BIGINT UNSIGNED NOT NULL,
  trip_id BIGINT UNSIGNED NULL,
  driver_id BIGINT UNSIGNED NULL,
  log_date DATE NOT NULL,
  odometer_reading DECIMAL(15,2) NOT NULL,
  fuel_quantity DECIMAL(15,2) NOT NULL,
  cost_per_unit DECIMAL(15,2) NOT NULL,
  total_cost DECIMAL(15,2) NOT NULL,
  supplier_id BIGINT UNSIGNED NULL,
  receipt_ref VARCHAR(100) NULL,
  remarks TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_fuel_vehicle (vehicle_id),
  KEY idx_fuel_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- trans_trip_expenses
CREATE TABLE IF NOT EXISTS trans_trip_expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  trip_id BIGINT UNSIGNED NOT NULL,
  expense_type ENUM('TOLL', 'PARKING', 'MEALS', 'ACCOMMODATION', 'MAINTENANCE', 'OTHER') NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  expense_date DATE NOT NULL,
  receipt_ref VARCHAR(100) NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_expense_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- trans_billing
CREATE TABLE IF NOT EXISTS trans_billing (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  trip_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  invoice_number VARCHAR(100) NULL,
  amount DECIMAL(15,2) NOT NULL,
  billing_date DATE NOT NULL,
  status ENUM('PENDING', 'INVOICED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  remarks TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_billing_trip (trip_id),
  KEY idx_billing_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
