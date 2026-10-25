import { pool } from "../db/pool.js";

export async function migrateFMExpansionMaster() {
  console.log("[FM Master Expansion Migration] Starting database schema verification and upgrades...");

  // 1. Property Onboarding & Handover
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_property_onboarding (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      onboarding_no VARCHAR(50) NOT NULL,
      property_id INT NOT NULL,
      client_id INT NULL,
      stage ENUM('DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'OPERATIONAL', 'ON_HOLD') DEFAULT 'DRAFT',
      target_handover_date DATE NULL,
      actual_handover_date DATE NULL,
      property_manager_id INT NULL,
      property_manager_name VARCHAR(150) NULL,
      condition_summary TEXT NULL,
      total_checklist_items INT DEFAULT 0,
      completed_checklist_items INT DEFAULT 0,
      outstanding_defects INT DEFAULT 0,
      approval_notes TEXT NULL,
      approved_by VARCHAR(150) NULL,
      approved_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_fmo_comp (company_id),
      INDEX idx_fmo_prop (property_id),
      INDEX idx_fmo_stage (stage)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_onboarding_checklists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      onboarding_id INT NOT NULL,
      category ENUM('LEGAL_CONTRACTS', 'ASSET_INVENTORY', 'BUILDING_DRAWINGS', 'UTILITY_SETUP', 'EMERGENCY_HSE', 'ACCESS_KEYS', 'SERVICE_SCHEDULES') DEFAULT 'ASSET_INVENTORY',
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      is_mandatory TINYINT(1) DEFAULT 1,
      status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'WAIVED') DEFAULT 'PENDING',
      assigned_to VARCHAR(150) NULL,
      completed_at DATETIME NULL,
      completed_by VARCHAR(150) NULL,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fmc_ob (onboarding_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 2. Hard Services & Building Engineering Systems
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_hard_services_systems (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      system_code VARCHAR(50) NOT NULL,
      property_id INT NOT NULL,
      building_id INT NULL,
      space_id INT NULL,
      system_category ENUM('ELECTRICAL', 'HVAC', 'PLUMBING', 'GENERATOR_POWER', 'ELEVATOR_ESCALATOR', 'FIRE_SAFETY', 'WATER_TREATMENT', 'BMS_AUTOMATION', 'STRUCTURAL_CIVIL', 'ACCESS_HARDWARE') DEFAULT 'HVAC',
      system_name VARCHAR(200) NOT NULL,
      asset_id INT NULL,
      contract_id INT NULL,
      manufacturer VARCHAR(150) NULL,
      model_no VARCHAR(100) NULL,
      serial_no VARCHAR(100) NULL,
      installation_date DATE NULL,
      warranty_expiry DATE NULL,
      criticality ENUM('LOW', 'MEDIUM', 'HIGH', 'MISSION_CRITICAL') DEFAULT 'MEDIUM',
      operational_status ENUM('OPERATIONAL', 'DEGRADED', 'OFFLINE', 'UNDER_MAINTENANCE') DEFAULT 'OPERATIONAL',
      responsible_technician VARCHAR(150) NULL,
      service_interval_days INT DEFAULT 90,
      last_serviced_date DATE NULL,
      next_service_due DATE NULL,
      replacement_cost_estimate DECIMAL(14,2) DEFAULT 0.00,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_fmh_comp (company_id),
      INDEX idx_fmh_prop (property_id),
      INDEX idx_fmh_cat (system_category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 3. Central Helpdesk & Service Requests
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_helpdesk_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      ticket_no VARCHAR(50) NOT NULL,
      source_channel ENUM('WEB_PORTAL', 'EMAIL', 'PHONE', 'MOBILE_APP', 'WALK_IN') DEFAULT 'WEB_PORTAL',
      client_id INT NULL,
      property_id INT NOT NULL,
      building_id INT NULL,
      space_id INT NULL,
      asset_id INT NULL,
      hard_service_id INT NULL,
      service_category VARCHAR(100) DEFAULT 'GENERAL_FACILITIES',
      subject VARCHAR(255) NOT NULL,
      description TEXT NULL,
      priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY') DEFAULT 'MEDIUM',
      status ENUM('NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_CLIENT', 'PENDING_PARTS', 'RESOLVED', 'CLOSED', 'REOPENED') DEFAULT 'NEW',
      requester_name VARCHAR(150) NOT NULL,
      requester_email VARCHAR(150) NULL,
      requester_phone VARCHAR(50) NULL,
      preferred_access_time VARCHAR(100) NULL,
      assigned_to_user_id INT NULL,
      assigned_to_name VARCHAR(150) NULL,
      work_order_id INT NULL,
      sla_target_hours DECIMAL(6,2) DEFAULT 24.00,
      sla_resolution_due DATETIME NULL,
      sla_status ENUM('ON_TRACK', 'AT_RISK', 'BREACHED', 'MET') DEFAULT 'ON_TRACK',
      sla_paused TINYINT(1) DEFAULT 0,
      sla_pause_reason VARCHAR(255) NULL,
      sla_paused_at DATETIME NULL,
      total_paused_minutes INT DEFAULT 0,
      resolution_code VARCHAR(100) NULL,
      root_cause TEXT NULL,
      resolution_notes TEXT NULL,
      client_satisfaction_rating INT NULL,
      client_feedback TEXT NULL,
      resolved_at DATETIME NULL,
      closed_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_fmt_comp (company_id),
      INDEX idx_fmt_prop (property_id),
      INDEX idx_fmt_status (status),
      INDEX idx_fmt_priority (priority)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_ticket_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      user_id INT NULL,
      user_name VARCHAR(150) NOT NULL,
      note_type ENUM('INTERNAL', 'CLIENT_VISIBLE') DEFAULT 'INTERNAL',
      note_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ftn_ticket (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 4. Site Inspections & Corrective Actions (CAPA)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_inspection_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      run_no VARCHAR(50) NOT NULL,
      template_id INT NULL,
      template_name VARCHAR(200) NOT NULL,
      property_id INT NOT NULL,
      building_id INT NULL,
      space_id INT NULL,
      asset_id INT NULL,
      inspector_id INT NULL,
      inspector_name VARCHAR(150) NOT NULL,
      supervisor_name VARCHAR(150) NULL,
      inspection_type ENUM('ROUTINE_DAILY', 'WEEKLY_AUDIT', 'MONTHLY_PPM', 'AD_HOC', 'RISK_BASED', 'STATUTORY') DEFAULT 'ROUTINE_DAILY',
      scheduled_date DATE NOT NULL,
      executed_date DATETIME NULL,
      status ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FLAGGED_DEFECTS') DEFAULT 'SCHEDULED',
      overall_score_pct DECIMAL(5,2) DEFAULT 100.00,
      pass_fail_result ENUM('PASS', 'CONDITIONAL_PASS', 'FAIL') DEFAULT 'PASS',
      findings_summary TEXT NULL,
      defects_count INT DEFAULT 0,
      corrective_actions_count INT DEFAULT 0,
      checklist_payload LONGTEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fmi_comp (company_id),
      INDEX idx_fmi_prop (property_id),
      INDEX idx_fmi_date (scheduled_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_corrective_actions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      action_no VARCHAR(50) NOT NULL,
      inspection_run_id INT NULL,
      property_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      severity ENUM('MINOR', 'MAJOR', 'CRITICAL') DEFAULT 'MINOR',
      assigned_to_name VARCHAR(150) NOT NULL,
      deadline_date DATE NOT NULL,
      status ENUM('OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED') DEFAULT 'OPEN',
      corrective_action_taken TEXT NULL,
      verification_notes TEXT NULL,
      verified_by VARCHAR(150) NULL,
      verified_at DATETIME NULL,
      work_order_id INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fca_comp (company_id),
      INDEX idx_fca_prop (property_id),
      INDEX idx_fca_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 5. Security & Access Management (Visitors, Badges, Keys, Patrols)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_security_visitors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      visitor_no VARCHAR(50) NOT NULL,
      property_id INT NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(150) NULL,
      company_name VARCHAR(150) NULL,
      id_card_type VARCHAR(50) DEFAULT 'NATIONAL_ID',
      id_card_number VARCHAR(100) NULL,
      visitor_badge_no VARCHAR(50) NULL,
      host_employee_name VARCHAR(150) NOT NULL,
      host_department VARCHAR(100) NULL,
      visit_purpose VARCHAR(255) NOT NULL,
      access_zone_permitted VARCHAR(150) DEFAULT 'LOBBY_AND_MEETING_ROOMS',
      check_in_time DATETIME NOT NULL,
      check_out_time DATETIME NULL,
      status ENUM('EXPECTED', 'CHECKED_IN', 'CHECKED_OUT', 'OVERSTAY') DEFAULT 'CHECKED_IN',
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fsv_comp (company_id),
      INDEX idx_fsv_prop (property_id),
      INDEX idx_fsv_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_security_key_register (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      property_id INT NOT NULL,
      key_or_card_code VARCHAR(50) NOT NULL,
      space_or_door_name VARCHAR(150) NOT NULL,
      key_type ENUM('PHYSICAL_KEY', 'RFID_CARD', 'MASTER_KEY', 'EMERGENCY_KEY') DEFAULT 'PHYSICAL_KEY',
      status ENUM('AVAILABLE', 'ISSUED', 'LOST', 'DAMAGED') DEFAULT 'AVAILABLE',
      issued_to_name VARCHAR(150) NULL,
      issued_to_phone VARCHAR(50) NULL,
      issued_date DATETIME NULL,
      expected_return_date DATETIME NULL,
      returned_date DATETIME NULL,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fsk_comp (company_id),
      INDEX idx_fsk_prop (property_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 6. Workforce Deployment & Rosters
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_workforce_rosters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      roster_no VARCHAR(50) NOT NULL,
      property_id INT NOT NULL,
      contract_id INT NULL,
      shift_id INT NULL,
      shift_name VARCHAR(100) NOT NULL,
      role_required VARCHAR(100) NOT NULL,
      employee_id INT NULL,
      employee_name VARCHAR(150) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days_of_week VARCHAR(100) DEFAULT 'MON,TUE,WED,THU,FRI',
      hours_per_shift DECIMAL(5,2) DEFAULT 8.00,
      hourly_rate DECIMAL(10,2) DEFAULT 25.00,
      status ENUM('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'SCHEDULED',
      attendance_status ENUM('PRESENT', 'ABSENT', 'LEAVE', 'LATE') DEFAULT 'PRESENT',
      overtime_hours DECIMAL(5,2) DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fwr_comp (company_id),
      INDEX idx_fwr_prop (property_id),
      INDEX idx_fwr_dates (start_date, end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 7. Compliance Obligations & Statutory Documents Register
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_compliance_obligations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      obligation_code VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      category ENUM('STATUTORY', 'ENVIRONMENTAL', 'FIRE_SAFETY', 'ELECTRICAL_SAFETY', 'OCCUPATIONAL_HEALTH', 'ELEVATOR_REGULATION', 'INSURANCE') DEFAULT 'STATUTORY',
      issuing_authority VARCHAR(150) NOT NULL,
      property_id INT NOT NULL,
      asset_id INT NULL,
      contractor_id INT NULL,
      document_ref VARCHAR(100) NULL,
      issue_date DATE NOT NULL,
      expiry_date DATE NOT NULL,
      renewal_lead_days INT DEFAULT 30,
      status ENUM('VALID', 'EXPIRING_SOON', 'EXPIRED', 'UNDER_RENEWAL') DEFAULT 'VALID',
      responsible_person VARCHAR(150) NOT NULL,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fco_comp (company_id),
      INDEX idx_fco_prop (property_id),
      INDEX idx_fco_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 8. SLA Policies Table Upgrades
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_sla_policies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      contract_id INT NULL,
      priority ENUM('EMERGENCY','CRITICAL','HIGH','MEDIUM','LOW') NOT NULL,
      response_time_minutes INT NOT NULL DEFAULT 120,
      resolution_time_hours DECIMAL(6,2) NOT NULL DEFAULT 24.00,
      escalation_level_1_hours DECIMAL(6,2) NULL,
      escalation_level_2_hours DECIMAL(6,2) NULL,
      INDEX idx_sla_comp (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Add missing columns to fm_sla_policies if they don't exist
  const [slaCols] = await pool.query(`SHOW COLUMNS FROM fm_sla_policies`);
  const slaColNames = slaCols.map(c => c.Field);
  
  if (!slaColNames.includes("policy_name")) {
    await pool.query(`ALTER TABLE fm_sla_policies ADD COLUMN policy_name VARCHAR(150) NULL AFTER company_id`);
  }
  if (!slaColNames.includes("service_category")) {
    await pool.query(`ALTER TABLE fm_sla_policies ADD COLUMN service_category VARCHAR(100) DEFAULT 'GENERAL_FACILITIES' AFTER policy_name`);
  }
  if (!slaColNames.includes("ack_target_minutes")) {
    await pool.query(`ALTER TABLE fm_sla_policies ADD COLUMN ack_target_minutes INT DEFAULT 15 AFTER priority`);
  }
  if (!slaColNames.includes("attendance_target_hours")) {
    await pool.query(`ALTER TABLE fm_sla_policies ADD COLUMN attendance_target_hours DECIMAL(5,2) DEFAULT 4.00 AFTER response_time_minutes`);
  }
  if (!slaColNames.includes("operating_hours")) {
    await pool.query(`ALTER TABLE fm_sla_policies ADD COLUMN operating_hours VARCHAR(50) DEFAULT '24/7'`);
  }
  if (!slaColNames.includes("is_active")) {
    await pool.query(`ALTER TABLE fm_sla_policies ADD COLUMN is_active TINYINT(1) DEFAULT 1`);
  }
  if (!slaColNames.includes("created_at")) {
    await pool.query(`ALTER TABLE fm_sla_policies ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
  }

  // 9. Consumables Usage Tracking in Soft Services
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_consumables_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      task_id INT NULL,
      property_id INT NOT NULL,
      item_name VARCHAR(150) NOT NULL,
      category ENUM('CLEANING_CHEMICALS', 'PAPER_HYGIENE', 'TRASH_BAGS', 'PPE', 'SPARE_LIGHTING', 'MISC') DEFAULT 'CLEANING_CHEMICALS',
      quantity_used DECIMAL(10,2) NOT NULL,
      unit_of_measure VARCHAR(20) DEFAULT 'PCS',
      unit_cost DECIMAL(10,2) DEFAULT 0.00,
      total_cost DECIMAL(12,2) DEFAULT 0.00,
      recorded_by VARCHAR(150) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fcl_comp (company_id),
      INDEX idx_fcl_prop (property_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 10. Hazard Register & Risk Assessment Matrix
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fm_hazard_assessments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      property_id INT NOT NULL,
      hazard_title VARCHAR(255) NOT NULL,
      work_activity VARCHAR(200) NOT NULL,
      likelihood_score INT DEFAULT 2,
      severity_score INT DEFAULT 3,
      risk_rating ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
      existing_controls TEXT NULL,
      additional_mitigations TEXT NULL,
      action_owner VARCHAR(150) NOT NULL,
      review_date DATE NULL,
      status ENUM('ACTIVE', 'MITIGATED', 'ARCHIVED') DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fha_comp (company_id),
      INDEX idx_fha_prop (property_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log("[FM Master Expansion Migration] Tables verified successfully!");

  // Seed default SLA Policies if none exist
  const [existingPolicies] = await pool.query(`SELECT COUNT(*) AS cnt FROM fm_sla_policies`);
  if (existingPolicies[0]?.cnt === 0) {
    console.log("[FM Master Expansion Migration] Seeding default SLA policies...");
    await pool.query(`
      INSERT INTO fm_sla_policies 
        (company_id, policy_name, service_category, priority, ack_target_minutes, response_time_minutes, attendance_target_hours, resolution_time_hours, operating_hours)
      VALUES
        (1, 'Emergency Critical Infrastructure SLA', 'HVAC_AIR_CONDITIONING', 'EMERGENCY', 5, 30, 1.00, 4.00, '24/7'),
        (1, 'Critical Power & Life Safety SLA', 'GENERATOR_POWER', 'CRITICAL', 10, 60, 2.00, 8.00, '24/7'),
        (1, 'High Priority Soft Services SLA', 'JANITORIAL', 'HIGH', 15, 120, 4.00, 12.00, '07:00-19:00'),
        (1, 'Standard Facilities Operational SLA', 'GENERAL_FACILITIES', 'MEDIUM', 30, 240, 8.00, 24.00, '08:00-18:00'),
        (1, 'Low Priority Scheduled Work SLA', 'GENERAL_FACILITIES', 'LOW', 60, 480, 24.00, 72.00, '08:00-18:00');
    `);
  }

  // Seed default hard services equipment if none exist
  const [existingHard] = await pool.query(`SELECT COUNT(*) AS cnt FROM fm_hard_services_systems`);
  if (existingHard[0]?.cnt === 0) {
    console.log("[FM Master Expansion Migration] Seeding baseline hard services systems...");
    await pool.query(`
      INSERT INTO fm_hard_services_systems
        (company_id, system_code, property_id, system_category, system_name, manufacturer, model_no, serial_no, installation_date, criticality, operational_status, responsible_technician, service_interval_days, next_service_due, replacement_cost_estimate)
      VALUES
        (1, 'HVAC-CHILLER-01', 1, 'HVAC', 'Main Central Chiller Plant 450-TR', 'Carrier', 'AquaForce 30XA', 'CR-992144-X', '2023-01-15', 'MISSION_CRITICAL', 'OPERATIONAL', 'Kwame Mensah (HVAC Tech)', 30, DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY), 85000.00),
        (1, 'GEN-CATERPILLAR-01', 1, 'GENERATOR_POWER', 'Backup Diesel Generator 1250-kVA', 'Caterpillar', 'CAT C32 ACERT', 'CAT-881290-B', '2022-08-20', 'MISSION_CRITICAL', 'OPERATIONAL', 'Emmanuel Osei (Electrical Eng)', 60, DATE_ADD(CURRENT_DATE, INTERVAL 25 DAY), 120000.00),
        (1, 'ELEV-PASSENGER-01', 1, 'ELEVATOR_ESCALATOR', 'Passenger Elevator Tower A (16-Stop)', 'Otis', 'Gen2 Premier', 'OT-5512-A', '2023-03-10', 'HIGH', 'OPERATIONAL', 'Kofi Boateng (Lift Tech)', 30, DATE_ADD(CURRENT_DATE, INTERVAL 8 DAY), 65000.00),
        (1, 'FIRE-ALARM-MAIN', 1, 'FIRE_SAFETY', 'Addressable Fire Alarm & Smoke Detection Panel', 'Honeywell', 'NOTIFIER NFS-320', 'HN-NOT-4412', '2022-11-05', 'HIGH', 'OPERATIONAL', 'Samuel Addo (Safety Tech)', 90, DATE_ADD(CURRENT_DATE, INTERVAL 45 DAY), 35000.00),
        (1, 'PUMP-BOOSTER-01', 1, 'WATER_TREATMENT', 'Potable Water Hydro-Pneumatic Booster Set', 'Grundfos', 'Hydro MPC-E', 'GF-7729-P', '2023-05-12', 'MEDIUM', 'OPERATIONAL', 'David Quaye (Plumbing Lead)', 60, DATE_ADD(CURRENT_DATE, INTERVAL 18 DAY), 22000.00);
    `);
  }

  // Seed baseline sample onboarding if none exist
  const [existingOnboarding] = await pool.query(`SELECT COUNT(*) AS cnt FROM fm_property_onboarding`);
  if (existingOnboarding[0]?.cnt === 0) {
    console.log("[FM Master Expansion Migration] Seeding sample property onboarding record...");
    const [res] = await pool.query(`
      INSERT INTO fm_property_onboarding
        (company_id, onboarding_no, property_id, stage, target_handover_date, property_manager_name, condition_summary, total_checklist_items, completed_checklist_items, outstanding_defects)
      VALUES
        (1, 'ONB-2026-001', 1, 'IN_PROGRESS', DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY), 'Isaac Frimpong', 'Prime corporate commercial facility undergoing 30-day operational mobilization and tenant lease integration.', 7, 5, 2);
    `);
    const obId = res.insertId;
    await pool.query(`
      INSERT INTO fm_onboarding_checklists
        (onboarding_id, category, title, is_mandatory, status, assigned_to)
      VALUES
        (${obId}, 'LEGAL_CONTRACTS', 'Executed FM Service Agreement & Scope Matrix', 1, 'COMPLETED', 'Isaac Frimpong'),
        (${obId}, 'ASSET_INVENTORY', 'Complete Plant & Machinery Equipment Register Import', 1, 'COMPLETED', 'Kwame Mensah'),
        (${obId}, 'BUILDING_DRAWINGS', 'As-Built Architectural, MEP & Fire Layout Drawings Upload', 1, 'COMPLETED', 'Isaac Frimpong'),
        (${obId}, 'UTILITY_SETUP', 'Electricity & Water Account Transfer & Tariff Validation', 1, 'COMPLETED', 'Finance Team'),
        (${obId}, 'EMERGENCY_HSE', 'Site Fire Safety Audit & Evacuation Procedures Sign-off', 1, 'COMPLETED', 'Samuel Addo'),
        (${obId}, 'ACCESS_KEYS', 'Master Key Schedule & RFID Access Badge Handover to Security', 1, 'IN_PROGRESS', 'Security Supervisor'),
        (${obId}, 'SERVICE_SCHEDULES', 'Daily Janitorial, Security & Weekly PPM Schedules Loaded in System', 1, 'IN_PROGRESS', 'Operations Coord');
    `);
  }

  console.log("[FM Master Expansion Migration] Master migration completed successfully.");
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith("migrate_fm_expansion_master.js")) {
  migrateFMExpansionMaster()
    .then(() => {
      console.log("Migration executed standalone successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
