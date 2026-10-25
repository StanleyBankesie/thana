import { pool, query } from "../db/pool.js";

export async function migrateFMAdvanced() {
  console.log("[FM Advanced Migration] Starting table creation...");

  // 1. Soft Facilities Daily Tasks
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_soft_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      task_no VARCHAR(50) NOT NULL,
      property_id INT NOT NULL,
      building_id INT NULL,
      zone_id INT NULL,
      space_id INT NULL,
      task_category ENUM('JANITORIAL', 'SECURITY_PATROL', 'PEST_CONTROL', 'WASTE_MANAGEMENT', 'LANDSCAPING', 'CONCIERGE_FRONTDESK', 'GENERAL_FACILITIES') DEFAULT 'JANITORIAL',
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      assignment_type ENUM('MANUAL', 'SCHEDULED_DAILY', 'SCHEDULED_WEEKLY', 'SHIFT_BASED') DEFAULT 'MANUAL',
      scheduled_date DATE NOT NULL,
      shift ENUM('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'ALL_DAY') DEFAULT 'MORNING',
      assigned_to_user_id INT NULL,
      assigned_to_name VARCHAR(150) NOT NULL,
      supervisor_id INT NULL,
      supervisor_name VARCHAR(150) NULL,
      checklist_template_id INT NULL,
      priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
      status ENUM('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED') DEFAULT 'ASSIGNED',
      checklist_data LONGTEXT NULL,
      completion_notes TEXT NULL,
      completion_photos TEXT NULL,
      completed_at DATETIME NULL,
      verified_by_supervisor TINYINT(1) DEFAULT 0,
      verified_at DATETIME NULL,
      supervisor_rating INT DEFAULT 5,
      supervisor_comments TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_st_comp (company_id),
      INDEX idx_st_prop (property_id),
      INDEX idx_st_date (scheduled_date),
      INDEX idx_st_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 2. Health, Safety & Compliance Tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_safety_incidents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      incident_no VARCHAR(50) NOT NULL,
      property_id INT NOT NULL,
      incident_date DATETIME NOT NULL,
      incident_type ENUM('NEAR_MISS', 'FIRST_AID', 'MEDICAL_TREATMENT', 'LOST_TIME_INJURY', 'PROPERTY_DAMAGE', 'ENVIRONMENTAL_SPILL', 'SECURITY_BREACH', 'FIRE_ALARM') DEFAULT 'NEAR_MISS',
      severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
      location_details VARCHAR(255) NOT NULL,
      reported_by VARCHAR(150) NOT NULL,
      affected_person_name VARCHAR(150) NULL,
      incident_description TEXT NOT NULL,
      immediate_action_taken TEXT NULL,
      root_cause TEXT NULL,
      corrective_actions TEXT NULL,
      status ENUM('REPORTED', 'INVESTIGATING', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED') DEFAULT 'REPORTED',
      closed_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_hsa_comp (company_id),
      INDEX idx_hsa_prop (property_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_permits_to_work (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      permit_no VARCHAR(50) NOT NULL,
      property_id INT NOT NULL,
      permit_type ENUM('HOT_WORK', 'WORKING_AT_HEIGHT', 'CONFINED_SPACE', 'ELECTRICAL_ISOLATION', 'EXCAVATION', 'HAZARDOUS_CHEMICAL', 'GENERAL_HAZARDOUS') DEFAULT 'HOT_WORK',
      work_description TEXT NOT NULL,
      contractor_or_team VARCHAR(150) NOT NULL,
      authorized_supervisor VARCHAR(150) NOT NULL,
      lead_worker_name VARCHAR(150) NOT NULL,
      start_validity DATETIME NOT NULL,
      end_validity DATETIME NOT NULL,
      safety_precautions JSON NULL,
      gas_test_performed TINYINT(1) DEFAULT 0,
      gas_test_results VARCHAR(255) NULL,
      status ENUM('DRAFT', 'ACTIVE_PERMITTED', 'EXTENDED', 'WORK_SUSPENDED', 'SURRENDERED_CLOSED', 'EXPIRED') DEFAULT 'ACTIVE_PERMITTED',
      closed_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ptw_comp (company_id),
      INDEX idx_ptw_prop (property_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_compliance_certificates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      certificate_no VARCHAR(100) NOT NULL,
      property_id INT NOT NULL,
      certificate_type ENUM('FIRE_SAFETY_PERMIT', 'ELEVATOR_LIFT_STATUTORY', 'BOILER_PRESSURE_VESSEL', 'ELECTRICAL_INSTALLATION_CERT', 'ENVIRONMENTAL_EPA_PERMIT', 'OCCUPATIONAL_HEALTH_CERT', 'WATER_QUALITY_ASSURANCE', 'BUILDING_INTEGRITY') DEFAULT 'FIRE_SAFETY_PERMIT',
      issuing_authority VARCHAR(200) NOT NULL,
      issue_date DATE NOT NULL,
      expiry_date DATE NOT NULL,
      renewal_lead_days INT DEFAULT 30,
      inspector_name VARCHAR(150) NULL,
      compliance_status ENUM('VALID_COMPLIANT', 'RENEWAL_DUE', 'EXPIRED', 'PENDING_INSPECTION') DEFAULT 'VALID_COMPLIANT',
      document_url VARCHAR(500) NULL,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cert_comp (company_id),
      INDEX idx_cert_prop (property_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_risk_assessments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      assessment_no VARCHAR(50) NOT NULL,
      property_id INT NOT NULL,
      activity_title VARCHAR(200) NOT NULL,
      assessor_name VARCHAR(150) NOT NULL,
      assessment_date DATE NOT NULL,
      review_date DATE NULL,
      identified_hazards TEXT NOT NULL,
      persons_at_risk VARCHAR(255) DEFAULT 'Staff, Contractors, Visitors',
      initial_risk_score INT DEFAULT 6,
      control_measures TEXT NOT NULL,
      residual_risk_score INT DEFAULT 2,
      status ENUM('APPROVED', 'UNDER_REVIEW', 'DRAFT') DEFAULT 'APPROVED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 3. Utilities & Energy Tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_utility_meters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      property_id INT NOT NULL,
      meter_code VARCHAR(50) NOT NULL,
      utility_type ENUM('ELECTRICITY_GRID', 'WATER_MUNICIPAL', 'DIESEL_GENERATOR', 'SOLAR_PV', 'LPG_GAS', 'BOREHOLE_WATER') DEFAULT 'ELECTRICITY_GRID',
      location_description VARCHAR(200) NOT NULL,
      meter_serial_number VARCHAR(100) NULL,
      unit_of_measure VARCHAR(20) DEFAULT 'kWh',
      tariff_rate_per_unit DECIMAL(10, 4) DEFAULT 0.0000,
      status ENUM('ACTIVE', 'FAULTY', 'DISCONNECTED') DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_meter_prop (property_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_utility_readings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meter_id INT NOT NULL,
      reading_date DATE NOT NULL,
      previous_reading DECIMAL(14, 2) NOT NULL,
      current_reading DECIMAL(14, 2) NOT NULL,
      consumption DECIMAL(14, 2) NOT NULL,
      total_cost DECIMAL(14, 2) DEFAULT 0.00,
      recorded_by VARCHAR(150) NULL,
      notes VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_read_meter (meter_id, reading_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_generator_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      property_id INT NOT NULL,
      log_date DATE NOT NULL,
      generator_name VARCHAR(150) NOT NULL,
      start_run_hours DECIMAL(10, 2) NOT NULL,
      end_run_hours DECIMAL(10, 2) NOT NULL,
      total_hours_run DECIMAL(8, 2) NOT NULL,
      fuel_added_liters DECIMAL(10, 2) DEFAULT 0.00,
      fuel_consumed_liters DECIMAL(10, 2) NOT NULL,
      current_fuel_level_percent INT DEFAULT 80,
      kwh_generated DECIMAL(12, 2) DEFAULT 0.00,
      fuel_efficiency_kwh_per_liter DECIMAL(8, 2) DEFAULT 3.20,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_utility_bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      property_id INT NOT NULL,
      utility_type ENUM('ELECTRICITY', 'WATER', 'FUEL_DIESEL', 'WASTE_SEWAGE', 'GAS') DEFAULT 'ELECTRICITY',
      service_provider VARCHAR(150) NOT NULL,
      account_number VARCHAR(100) NULL,
      bill_reference VARCHAR(100) NOT NULL,
      billing_month VARCHAR(20) NOT NULL,
      total_consumption DECIMAL(14, 2) NOT NULL,
      bill_amount DECIMAL(14, 2) NOT NULL,
      due_date DATE NULL,
      payment_status ENUM('PAID', 'PENDING', 'OVERDUE') DEFAULT 'PENDING',
      notes VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 4. Contractor & Vendor Management Tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_vendors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      vendor_code VARCHAR(50) NOT NULL,
      vendor_name VARCHAR(200) NOT NULL,
      service_specialty VARCHAR(150) NOT NULL,
      contact_person VARCHAR(150) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(150) NULL,
      address TEXT NULL,
      tax_id VARCHAR(100) NULL,
      insurance_policy_no VARCHAR(100) NULL,
      insurance_expiry DATE NULL,
      average_rating DECIMAL(3, 2) DEFAULT 5.00,
      status ENUM('ACTIVE_APPROVED', 'UNDER_REVIEW', 'SUSPENDED', 'BLACKLISTED') DEFAULT 'ACTIVE_APPROVED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_vendor_contracts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendor_id INT NOT NULL,
      contract_title VARCHAR(200) NOT NULL,
      contract_ref VARCHAR(100) NOT NULL,
      property_id INT NULL,
      annual_contract_value DECIMAL(14, 2) DEFAULT 0.00,
      sla_response_time_hours INT DEFAULT 4,
      sla_resolution_time_hours INT DEFAULT 24,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      auto_renew TINYINT(1) DEFAULT 0,
      status ENUM('ACTIVE', 'PENDING_RENEWAL', 'TERMINATED', 'EXPIRED') DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_vendor_ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendor_id INT NOT NULL,
      job_reference VARCHAR(100) NULL,
      rated_by VARCHAR(150) NOT NULL,
      rating_date DATE NOT NULL,
      quality_rating INT DEFAULT 5,
      timeliness_rating INT DEFAULT 5,
      safety_compliance_rating INT DEFAULT 5,
      overall_rating DECIMAL(3, 2) DEFAULT 5.00,
      feedback_notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 5. Budgeting & Financial Management Tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_budgets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      fiscal_year INT NOT NULL,
      property_id INT NOT NULL,
      budget_name VARCHAR(150) NOT NULL,
      total_allocated DECIMAL(16, 2) DEFAULT 0.00,
      actual_spent DECIMAL(16, 2) DEFAULT 0.00,
      committed_contract_spend DECIMAL(16, 2) DEFAULT 0.00,
      variance_amount DECIMAL(16, 2) DEFAULT 0.00,
      status ENUM('DRAFT', 'APPROVED', 'LOCKED') DEFAULT 'APPROVED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_budget_line_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      budget_id INT NOT NULL,
      cost_category ENUM('PLANNED_PREVENTATIVE_MAINT', 'REACTIVE_REPAIRS', 'SOFT_SERVICES_JANITORIAL', 'SECURITY_SERVICES', 'UTILITIES_ENERGY', 'CAPEX_REFURBISHMENT', 'STATUTORY_COMPLIANCE') NOT NULL,
      item_description VARCHAR(255) NOT NULL,
      allocated_budget DECIMAL(14, 2) NOT NULL,
      actual_spent DECIMAL(14, 2) DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 6. Space & Occupancy Management Tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_room_bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      property_id INT NOT NULL,
      space_or_room_name VARCHAR(150) NOT NULL,
      booked_by_name VARCHAR(150) NOT NULL,
      department_or_tenant VARCHAR(150) NOT NULL,
      booking_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      purpose VARCHAR(255) NOT NULL,
      attendees_count INT DEFAULT 4,
      status ENUM('CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'CONFIRMED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_tenant_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      property_id INT NOT NULL,
      tenant_name VARCHAR(200) NOT NULL,
      contact_person VARCHAR(150) NULL,
      contact_email VARCHAR(150) NULL,
      contact_phone VARCHAR(50) NULL,
      allocated_space_sqm DECIMAL(10, 2) NOT NULL,
      occupied_rooms_or_units VARCHAR(200) NOT NULL,
      headcount INT DEFAULT 1,
      lease_start_date DATE NOT NULL,
      lease_end_date DATE NOT NULL,
      monthly_service_charge DECIMAL(12, 2) DEFAULT 0.00,
      occupancy_status ENUM('ACTIVE_OCCUPIED', 'RENEWAL_PENDING', 'VACATING', 'VACANT') DEFAULT 'ACTIVE_OCCUPIED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 7. Sustainability & Environmental Management Tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_sustainability_metrics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      property_id INT NOT NULL,
      reporting_period VARCHAR(20) NOT NULL,
      scope1_co2e_tons DECIMAL(10, 2) DEFAULT 0.00,
      scope2_co2e_tons DECIMAL(10, 2) DEFAULT 0.00,
      total_co2e_tons DECIMAL(10, 2) DEFAULT 0.00,
      water_recycled_liters DECIMAL(14, 2) DEFAULT 0.00,
      waste_diverted_from_landfill_percent DECIMAL(5, 2) DEFAULT 0.00,
      solar_generation_kwh DECIMAL(12, 2) DEFAULT 0.00,
      energy_use_intensity_kwh_per_sqm DECIMAL(8, 2) DEFAULT 0.00,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_green_initiatives (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      property_id INT NOT NULL,
      initiative_name VARCHAR(200) NOT NULL,
      category ENUM('ENERGY_EFFICIENCY', 'WATER_CONSERVATION', 'WASTE_REDUCTION', 'SOLAR_RENEWABLE', 'GREEN_MOBILITY', 'CARBON_OFFSET') DEFAULT 'ENERGY_EFFICIENCY',
      target_description TEXT NOT NULL,
      estimated_annual_co2_reduction_tons DECIMAL(8, 2) DEFAULT 0.00,
      estimated_annual_cost_savings DECIMAL(12, 2) DEFAULT 0.00,
      status ENUM('PLANNING', 'IN_PROGRESS', 'IMPLEMENTED', 'MONITORING') DEFAULT 'PLANNING',
      target_completion_date DATE NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log("[FM Advanced Migration] All 15 Facilities Management tables ensured successfully!");

  // Seed sample initial records if empty
  await seedFMAdvancedSamples();
}

async function seedFMAdvancedSamples() {
  const [props] = await pool.query("SELECT id FROM fm_properties LIMIT 1");
  const propId = props && props.length > 0 ? props[0].id : 1;

  // 1. Seed sample daily soft task if none
  const [tasks] = await pool.query("SELECT id FROM fm_soft_tasks LIMIT 1");
  if (tasks.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    await pool.query(`
      INSERT INTO fm_soft_tasks (
        company_id, task_no, property_id, task_category, title, description, 
        assignment_type, scheduled_date, shift, assigned_to_name, supervisor_name, priority, status
      ) VALUES 
      (1, 'ST-DAILY-001', ?, 'JANITORIAL', 'Daily Executive Restrooms Deep Sanitization', 'Disinfect door handles, mirrors, restock sanitizers and paper towels.', 'SCHEDULED_DAILY', ?, 'MORNING', 'Grace Mensah (Cleaner)', 'David Osei (FM Supervisor)', 'HIGH', 'ASSIGNED'),
      (1, 'ST-DAILY-002', ?, 'SECURITY_PATROL', 'Perimeter Fence & Gate Checkpoint Rounds', 'Inspect access control gates, boom barriers, and verify security visitor logs.', 'SHIFT_BASED', ?, 'MORNING', 'Sergeant Kwaku Boateng', 'David Osei (FM Supervisor)', 'MEDIUM', 'IN_PROGRESS'),
      (1, 'ST-DAILY-003', ?, 'WASTE_MANAGEMENT', 'Waste Sorting & Recyclable Separation', 'Sort office refuse bins, package shredded documents, and transport to central refuse yard.', 'SCHEDULED_DAILY', ?, 'AFTERNOON', 'Kofi Adams', 'David Osei (FM Supervisor)', 'MEDIUM', 'COMPLETED'),
      (1, 'ST-DAILY-004', ?, 'LANDSCAPING', 'Irrigation & Lawn Grooming at Main Entrance', 'Trim decorative hedge, check drip irrigation timers, weed garden beds.', 'SCHEDULED_WEEKLY', ?, 'MORNING', 'Emmanuel Tetteh', 'David Osei (FM Supervisor)', 'LOW', 'ASSIGNED')
    `, [propId, today, propId, today, propId, today, propId, today]);
    console.log("[FM Advanced Migration] Seeded sample daily soft tasks.");
  }

  // 2. Seed safety incidents & certificates if none
  const [certs] = await pool.query("SELECT id FROM fm_compliance_certificates LIMIT 1");
  if (certs.length === 0) {
    await pool.query(`
      INSERT INTO fm_compliance_certificates (
        company_id, certificate_no, property_id, certificate_type, issuing_authority, issue_date, expiry_date, compliance_status
      ) VALUES
      (1, 'GNFS-ACC-2026-889', ?, 'FIRE_SAFETY_PERMIT', 'Ghana National Fire Service', '2026-01-15', '2027-01-14', 'VALID_COMPLIANT'),
      (1, 'DE-LIFT-99120', ?, 'ELEVATOR_LIFT_STATUTORY', 'Department of Factories Inspectorate', '2025-06-10', '2026-11-10', 'RENEWAL_DUE'),
      (1, 'EPA-ENV-2025-044', ?, 'ENVIRONMENTAL_EPA_PERMIT', 'Environmental Protection Agency (EPA)', '2025-03-01', '2027-02-28', 'VALID_COMPLIANT')
    `, [propId, propId, propId]);
  }

  // 3. Seed utility meters if none
  const [meters] = await pool.query("SELECT id FROM fm_utility_meters LIMIT 1");
  if (meters.length === 0) {
    await pool.query(`
      INSERT INTO fm_utility_meters (
        company_id, property_id, meter_code, utility_type, location_description, meter_serial_number, unit_of_measure, tariff_rate_per_unit
      ) VALUES
      (1, ?, 'MTR-ELEC-01', 'ELECTRICITY_GRID', 'Main Power Substation - Incomer 1', 'ECG-788912-3B', 'kWh', 1.8500),
      (1, ?, 'MTR-WATER-01', 'WATER_MUNICIPAL', 'Ground Floor Bulk Inflow Tank', 'GWCL-99214', 'm3', 14.5000),
      (1, ?, 'MTR-GEN-01', 'DIESEL_GENERATOR', 'Standby FG Wilson 500kVA Generator 1', 'GEN-FGW-500-A', 'Liters', 13.9000),
      (1, ?, 'MTR-SOLAR-01', 'SOLAR_PV', 'Rooftop Solar PV Inverter Bank', 'SMA-SOLAR-50KW', 'kWh', 0.0000)
    `, [propId, propId, propId, propId]);
  }

  // 4. Seed vendors if none
  const [vendors] = await pool.query("SELECT id FROM fm_vendors LIMIT 1");
  if (vendors.length === 0) {
    await pool.query(`
      INSERT INTO fm_vendors (
        company_id, vendor_code, vendor_name, service_specialty, contact_person, phone, email, average_rating, status
      ) VALUES
      (1, 'VND-HVAC-01', 'Apex Air Conditioning & Refrigeration Ltd', 'HVAC & VRF Systems', 'Patrick Mensah', '+233 24 456 7890', 'service@apexair.com.gh', 4.85, 'ACTIVE_APPROVED'),
      (1, 'VND-ELEV-01', 'Schindler Elevators Ghana', 'Elevators & Escalators Maintenance', 'Anita Asante', '+233 30 211 4455', 'ghana@schindler.com', 4.90, 'ACTIVE_APPROVED'),
      (1, 'VND-SEC-01', 'Intercon Security Services', '24/7 Guard Force & CCTV Monitoring', 'Major (Rtd) K. Owusu', '+233 20 889 0012', 'operations@intercon.com.gh', 4.70, 'ACTIVE_APPROVED'),
      (1, 'VND-PEST-01', 'Rentokil Initial FM Ltd', 'Pest Management & Fumigation', 'Selasi Dogbe', '+233 27 554 1122', 'info@rentokil.com.gh', 4.80, 'ACTIVE_APPROVED')
    `, []);
  }

  // 5. Seed budgets if none
  const [budgets] = await pool.query("SELECT id FROM fm_budgets LIMIT 1");
  if (budgets.length === 0) {
    const [bRes] = await pool.query(`
      INSERT INTO fm_budgets (
        company_id, fiscal_year, property_id, budget_name, total_allocated, actual_spent, committed_contract_spend, variance_amount
      ) VALUES (1, 2026, ?, 'Annual Facility Operations & Maintenance Budget 2026', 450000.00, 185420.00, 160000.00, 104580.00)
    `, [propId]);
    const bId = bRes.insertId;
    await pool.query(`
      INSERT INTO fm_budget_line_items (budget_id, cost_category, item_description, allocated_budget, actual_spent) VALUES
      (?, 'PLANNED_PREVENTATIVE_MAINT', 'HVAC, Generator & Elevator Service Contracts', 150000.00, 72000.00),
      (?, 'UTILITIES_ENERGY', 'Grid Electricity & Standby Diesel Fuel', 180000.00, 84200.00),
      (?, 'SOFT_SERVICES_JANITORIAL', 'Cleaning Supplies, Hygiene Consumables & Pest Control', 55000.00, 18500.00),
      (?, 'STATUTORY_COMPLIANCE', 'Fire Permits, Lift Certifications & Insurance Renewals', 25000.00, 4800.00),
      (?, 'REACTIVE_REPAIRS', 'Emergency Plumbing, Electrical & Building Repairs Contingency', 40000.00, 5920.00)
    `, [bId, bId, bId, bId, bId]);
  }

  // 6. Seed room bookings & tenants if none
  const [tenants] = await pool.query("SELECT id FROM fm_tenant_records LIMIT 1");
  if (tenants.length === 0) {
    await pool.query(`
      INSERT INTO fm_tenant_records (
        company_id, property_id, tenant_name, contact_person, contact_email, contact_phone, 
        allocated_space_sqm, occupied_rooms_or_units, headcount, lease_start_date, lease_end_date, monthly_service_charge
      ) VALUES
      (1, ?, 'Standard Chartered Bank Regional HQ', 'Edward Quaye', 'edward.quaye@sc.com', '+233 24 100 2000', 850.00, 'Floors 2 & 3', 65, '2024-01-01', '2028-12-31', 12500.00),
      (1, ?, 'PwC Consulting Ghana', 'Ama Serwaa', 'ama.serwaa@pwc.com', '+233 20 300 4000', 620.00, 'Floor 4 West Wing', 42, '2023-06-01', '2027-05-31', 9200.00),
      (1, ?, 'OmniSuite Tech Hub', 'Stanley Admin', 'admin@omnisuite.com', '+233 55 900 8000', 380.00, 'Penthouse Suite 601', 25, '2025-01-01', '2029-12-31', 5800.00)
    `, [propId, propId, propId]);
  }

  // 7. Seed sustainability metrics if none
  const [sust] = await pool.query("SELECT id FROM fm_sustainability_metrics LIMIT 1");
  if (sust.length === 0) {
    await pool.query(`
      INSERT INTO fm_sustainability_metrics (
        company_id, property_id, reporting_period, scope1_co2e_tons, scope2_co2e_tons, total_co2e_tons, 
        water_recycled_liters, waste_diverted_from_landfill_percent, solar_generation_kwh, energy_use_intensity_kwh_per_sqm
      ) VALUES
      (1, ?, '2026-Q1', 14.80, 48.20, 63.00, 32000.00, 68.50, 18500.00, 92.40),
      (1, ?, '2026-Q2', 12.20, 42.10, 54.30, 36500.00, 74.00, 21400.00, 84.80)
    `, [propId, propId]);

    await pool.query(`
      INSERT INTO fm_green_initiatives (
        company_id, property_id, initiative_name, category, target_description, estimated_annual_co2_reduction_tons, estimated_annual_cost_savings, status, target_completion_date
      ) VALUES
      (1, ?, 'Rooftop Solar PV Expansion (Phase 2)', 'SOLAR_RENEWABLE', 'Install additional 75kWp solar array to offset peak grid daytime tariff.', 38.50, 45000.00, 'IN_PROGRESS', '2026-12-15'),
      (1, ?, 'Basement LED Retrofit & Motion Sensors', 'ENERGY_EFFICIENCY', 'Replace remaining fluorescent fixtures with smart occupancy sensor LEDs.', 12.00, 18200.00, 'IMPLEMENTED', '2026-04-30'),
      (1, ?, 'Rainwater Harvesting & Cooling Tower Recirculation', 'WATER_CONSERVATION', 'Capture rooftop stormwater runoff for chiller cooling towers and landscape watering.', 6.50, 14000.00, 'PLANNING', '2027-03-31')
    `, [propId, propId, propId]);
  }
}

// Execute migration
migrateFMAdvanced()
  .then(() => {
    console.log("[FM Advanced Migration] Completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[FM Advanced Migration] Failed:", err);
    process.exit(1);
  });
