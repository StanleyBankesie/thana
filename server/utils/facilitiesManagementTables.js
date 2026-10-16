import { pool } from "../db/pool.js";

/**
 * Safely check and add columns if they don't already exist.
 */
async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
      console.log(`[FM Migration] Added column ${columnName} to ${tableName}`);
    }
  } catch (err) {
    console.warn(`[FM Migration] Could not add ${columnName} to ${tableName}:`, err.message);
  }
}

/**
 * Ensures complete database schema for Facilities Management (FM):
 * 1. fm_properties: Multi-tier property registers (Commercial, Residential, Malls, Hospitals, etc.)
 * 2. fm_buildings: Buildings within a property portfolio
 * 3. fm_zones: Floors, Wings, Rooftops, Basements, Common areas
 * 4. fm_spaces: Specific rooms, tenancies, plant rooms, parking bays
 * 5. fm_service_contracts: FM Client service contracts with SLA tiers, billing cycles, emergency callouts
 * 6. fm_contract_properties: Properties covered under contract
 * 7. fm_contract_service_lines: Inclusions / exclusions by service line (HVAC, Power, Cleaning, Security, Pest, etc.)
 * 8. fm_sla_policies: SLA response & resolution duration matrices
 * 9. fm_checklist_templates & fm_checklist_template_items: Configurable inspection checklists
 * 10. fm_work_order_checklists & fm_work_order_checklist_values: Executed checklists & inspection readings
 * 11. fm_service_reports: Customer sign-off, labor summary, materials, before/after photos
 * 12. Soft services logs: fm_janitorial_logs, fm_security_patrol_logs, fm_pest_control_logs, fm_waste_disposal_logs
 * 13. Extensions to maint_assets, maint_requests, and maint_job_orders
 */
export async function ensureFacilitiesManagementTables() {
  try {
    // 1. fm_properties: Master Property Register
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_properties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT NULL,
        client_id INT NULL,
        property_code VARCHAR(50) NOT NULL,
        property_name VARCHAR(200) NOT NULL,
        property_type ENUM(
          'COMMERCIAL_OFFICE', 'RESIDENTIAL_ESTATE', 'SHOPPING_MALL', 
          'HEALTHCARE_HOSPITAL', 'INDUSTRIAL_WAREHOUSE', 'EDUCATIONAL_CAMPUS', 
          'MIXED_USE', 'HOTEL_HOSPITALITY', 'GOVERNMENT_PUBLIC', 'OTHER'
        ) DEFAULT 'COMMERCIAL_OFFICE',
        address TEXT NULL,
        city VARCHAR(100) NULL,
        state VARCHAR(100) NULL,
        country VARCHAR(100) DEFAULT 'Ghana',
        postal_code VARCHAR(30) NULL,
        gps_lat DECIMAL(10, 8) NULL,
        gps_lng DECIMAL(11, 8) NULL,
        total_area_sqm DECIMAL(14, 2) NULL,
        contact_person_name VARCHAR(150) NULL,
        contact_person_phone VARCHAR(50) NULL,
        contact_person_email VARCHAR(150) NULL,
        property_manager_id INT NULL,
        property_manager_name VARCHAR(150) NULL,
        status ENUM('ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'DECOMMISSIONED') DEFAULT 'ACTIVE',
        notes TEXT NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_fm_prop_comp (company_id),
        INDEX idx_fm_prop_client (client_id),
        INDEX idx_fm_prop_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. fm_buildings: Buildings within a Property
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_buildings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        property_id INT NOT NULL,
        building_code VARCHAR(50) NOT NULL,
        building_name VARCHAR(150) NOT NULL,
        total_floors INT DEFAULT 1,
        basement_floors INT DEFAULT 0,
        gross_floor_area_sqm DECIMAL(12, 2) NULL,
        status ENUM('ACTIVE', 'INACTIVE', 'UNDER_RENOVATION') DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_fm_bld_prop (property_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. fm_zones: Floors, Wings, Basements, Outdoor Grounds
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_zones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        property_id INT NOT NULL,
        building_id INT NOT NULL,
        zone_code VARCHAR(50) NOT NULL,
        zone_name VARCHAR(150) NOT NULL,
        floor_number INT DEFAULT 0,
        zone_type ENUM('FLOOR', 'WING', 'OUTDOOR_GROUNDS', 'ROOFTOP', 'BASEMENT_PARKING', 'MEZZANINE', 'COMMON_AREA', 'OTHER') DEFAULT 'FLOOR',
        status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_fm_zone_bld (building_id),
        INDEX idx_fm_zone_prop (property_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. fm_spaces: Rooms, Specific Locations, Tenancies, Plant Rooms
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_spaces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        property_id INT NOT NULL,
        building_id INT NOT NULL,
        zone_id INT NOT NULL,
        space_code VARCHAR(50) NOT NULL,
        space_name VARCHAR(150) NOT NULL,
        space_type ENUM(
          'OFFICE_SUITE', 'CONFERENCE_ROOM', 'SERVER_ROOM', 'RESTROOM', 
          'ELECTRICAL_ROOM', 'GENERATOR_ROOM', 'PUMP_ROOM', 'HVAC_PLANT', 
          'LOBBY_RECEPTION', 'CORRIDOR', 'PARKING_BAY', 'CANTEEN_CAFETERIA', 
          'STORAGE_WAREHOUSE', 'SECURITY_GATE', 'OTHER'
        ) DEFAULT 'OFFICE_SUITE',
        occupant_tenant_name VARCHAR(150) NULL,
        area_sqm DECIMAL(10, 2) NULL,
        status ENUM('ACTIVE', 'VACANT', 'OCCUPIED', 'OUT_OF_SERVICE') DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_fm_space_zone (zone_id),
        INDEX idx_fm_space_prop (property_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. fm_service_contracts: FM Client Service Contracts & SLAs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_service_contracts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT NULL,
        contract_no VARCHAR(50) NOT NULL,
        contract_title VARCHAR(200) NOT NULL,
        client_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        billing_frequency ENUM('MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY', 'PER_JOB') DEFAULT 'MONTHLY',
        billing_amount DECIMAL(18, 4) DEFAULT 0.0000,
        contract_value DECIMAL(18, 4) DEFAULT 0.0000,
        currency_id INT NULL,
        payment_terms VARCHAR(100) DEFAULT '30 Days Net',
        emergency_callout_included TINYINT(1) DEFAULT 1,
        emergency_callout_limit INT DEFAULT 0,
        emergency_callouts_used INT DEFAULT 0,
        sla_standard_response_hours DECIMAL(6, 2) DEFAULT 4.00,
        sla_standard_resolution_hours DECIMAL(6, 2) DEFAULT 24.00,
        sla_critical_response_hours DECIMAL(6, 2) DEFAULT 1.00,
        sla_critical_resolution_hours DECIMAL(6, 2) DEFAULT 4.00,
        contract_status ENUM('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'EXPIRED', 'TERMINATED') DEFAULT 'ACTIVE',
        renewal_reminder_days INT DEFAULT 30,
        terms_and_conditions TEXT NULL,
        contract_file_url VARCHAR(500) NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_fm_ctr_client (client_id),
        INDEX idx_fm_ctr_status (contract_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. fm_contract_properties: Linked Properties Covered Under Contract
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_contract_properties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contract_id INT NOT NULL,
        property_id INT NOT NULL,
        notes VARCHAR(255) NULL,
        INDEX idx_fm_cp_ctr (contract_id),
        INDEX idx_fm_cp_prop (property_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. fm_contract_service_lines: Scope of Covered Service Lines
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_contract_service_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contract_id INT NOT NULL,
        service_line ENUM(
          'HVAC_AIR_CONDITIONING', 'GENERATOR_POWER', 'ELECTRICAL_SERVICES', 
          'PLUMBING_WATER_SYSTEMS', 'LIFT_ELEVATOR_MAINTENANCE', 'FIRE_SAFETY_SYSTEMS', 
          'CLEANING_JANITORIAL', 'SECURITY_PATROL', 'PEST_CONTROL', 
          'LANDSCAPING_GROUNDS', 'WASTE_MANAGEMENT', 'GENERAL_BUILDING_FABRIC'
        ) NOT NULL,
        is_covered TINYINT(1) DEFAULT 1,
        coverage_scope_notes TEXT NULL,
        max_included_labor_hours DECIMAL(8, 2) DEFAULT 0.00,
        parts_included TINYINT(1) DEFAULT 0,
        INDEX idx_fm_csl_ctr (contract_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. fm_sla_policies: Granular Priority SLA Definitions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_sla_policies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        contract_id INT NULL,
        priority ENUM('EMERGENCY', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW') NOT NULL,
        response_time_minutes INT NOT NULL,
        resolution_time_hours DECIMAL(6, 2) NOT NULL,
        escalation_level_1_hours DECIMAL(6, 2) NULL,
        escalation_level_2_hours DECIMAL(6, 2) NULL,
        INDEX idx_fm_sla_ctr (contract_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 9. Checklist Templates & Items
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_checklist_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        template_code VARCHAR(50) NOT NULL,
        template_name VARCHAR(150) NOT NULL,
        service_line VARCHAR(100) NOT NULL,
        description TEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_fm_clt_comp (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_checklist_template_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_id INT NOT NULL,
        item_sequence INT DEFAULT 0,
        section_header VARCHAR(100) NULL,
        item_text VARCHAR(255) NOT NULL,
        field_type ENUM('PASS_FAIL', 'YES_NO_NA', 'NUMERIC_READING', 'TEXT_NOTE', 'PHOTO_REQUIRED', 'RATING_1_5') DEFAULT 'PASS_FAIL',
        min_reading DECIMAL(12, 4) NULL,
        max_reading DECIMAL(12, 4) NULL,
        unit_of_measure VARCHAR(30) NULL,
        is_critical TINYINT(1) DEFAULT 0,
        failure_action ENUM('FLAG_ONLY', 'CREATE_WORK_ORDER', 'NOTIFY_SUPERVISOR') DEFAULT 'CREATE_WORK_ORDER',
        INDEX idx_fm_clti_tpl (template_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 10. Executed Work Order Checklists & Results
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_work_order_checklists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        work_order_id INT NOT NULL,
        template_id INT NOT NULL,
        template_name VARCHAR(150) NOT NULL,
        completed_by INT NULL,
        completed_at DATETIME NULL,
        overall_result ENUM('PASS', 'FAIL', 'CONDITIONAL_PASS', 'INCOMPLETE') DEFAULT 'INCOMPLETE',
        overall_notes TEXT NULL,
        INDEX idx_fm_woc_wo (work_order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_work_order_checklist_values (
        id INT AUTO_INCREMENT PRIMARY KEY,
        checklist_id INT NOT NULL,
        template_item_id INT NOT NULL,
        item_text VARCHAR(255) NOT NULL,
        field_type VARCHAR(30) NOT NULL,
        status_result ENUM('PASS', 'FAIL', 'YES', 'NO', 'NA') NULL,
        numeric_value DECIMAL(12, 4) NULL,
        text_value TEXT NULL,
        photo_url VARCHAR(500) NULL,
        is_out_of_range TINYINT(1) DEFAULT 0,
        corrective_work_order_id INT NULL,
        INDEX idx_fm_wocv_cl (checklist_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 11. fm_service_reports: Technician Completion & Customer Sign-off
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_service_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        work_order_id INT NOT NULL,
        company_id INT NOT NULL,
        report_no VARCHAR(50) NOT NULL,
        property_id INT NULL,
        client_id INT NULL,
        technician_id INT NULL,
        technician_name VARCHAR(150) NULL,
        work_performed TEXT NOT NULL,
        root_cause TEXT NULL,
        corrective_action TEXT NULL,
        safety_protocols_followed TINYINT(1) DEFAULT 1,
        total_labor_hours DECIMAL(6, 2) DEFAULT 0.00,
        total_material_cost DECIMAL(14, 2) DEFAULT 0.00,
        customer_representative_name VARCHAR(150) NULL,
        customer_signature_data LONGTEXT NULL,
        customer_feedback TEXT NULL,
        customer_rating INT DEFAULT 5,
        signed_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fm_sr_wo (work_order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 12. Soft Services Logs
    // Janitorial / Cleaning Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_janitorial_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        property_id INT NOT NULL,
        space_id INT NULL,
        cleaner_name VARCHAR(150) NOT NULL,
        log_date DATE NOT NULL,
        shift ENUM('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT') DEFAULT 'MORNING',
        restrooms_sanitized TINYINT(1) DEFAULT 1,
        floors_mopped TINYINT(1) DEFAULT 1,
        trash_emptied TINYINT(1) DEFAULT 1,
        soap_paper_restocked TINYINT(1) DEFAULT 1,
        supervisor_rating INT DEFAULT 5,
        supervisor_name VARCHAR(150) NULL,
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fm_jan_prop (property_id, log_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Security Patrol Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_security_patrol_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        property_id INT NOT NULL,
        guard_name VARCHAR(150) NOT NULL,
        patrol_time DATETIME NOT NULL,
        checkpoint_name VARCHAR(150) NOT NULL,
        checkpoint_status ENUM('SECURE', 'ANOMALY_FOUND', 'DOOR_UNLOCKED', 'BREACH_ATTEMPT', 'LIGHT_DEFECTIVE') DEFAULT 'SECURE',
        incident_description TEXT NULL,
        action_taken TEXT NULL,
        photo_url VARCHAR(500) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fm_sec_prop (property_id, patrol_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Pest Control Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_pest_control_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        property_id INT NOT NULL,
        treatment_date DATE NOT NULL,
        technician_name VARCHAR(150) NOT NULL,
        target_pest ENUM('RODENTS', 'INSECTS_COCKROACHES', 'TERMITES', 'MOSQUITOES', 'BEDBUGS', 'GENERAL') NOT NULL,
        chemicals_applied VARCHAR(255) NULL,
        dosage_and_method VARCHAR(255) NULL,
        bait_stations_checked INT DEFAULT 0,
        bait_stations_activity_detected INT DEFAULT 0,
        risk_level ENUM('LOW', 'MEDIUM', 'HIGH', 'INFESTATION') DEFAULT 'LOW',
        next_scheduled_date DATE NULL,
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fm_pest_prop (property_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Waste Disposal Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fm_waste_disposal_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        property_id INT NOT NULL,
        collection_date DATE NOT NULL,
        waste_type ENUM(
          'GENERAL_REFUSE', 'RECYCLABLE_PAPER_PLASTIC', 'ORGANIC_COMPOST', 
          'HAZARDOUS_CHEMICAL', 'ELECTRONIC_EWASTE', 'MEDICAL_CLINICAL'
        ) DEFAULT 'GENERAL_REFUSE',
        quantity_kg_or_bins DECIMAL(10, 2) NOT NULL,
        unit ENUM('BINS', 'KG', 'TONS', 'BAGS') DEFAULT 'BINS',
        contractor_carrier_name VARCHAR(150) NULL,
        manifest_reference_no VARCHAR(100) NULL,
        disposal_facility VARCHAR(150) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fm_waste_prop (property_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Enhance srv_service_invoice_details to allow service contract fee lines without physical stock item
    try {
      await pool.query("ALTER TABLE srv_service_invoice_details MODIFY COLUMN item_id BIGINT UNSIGNED NULL DEFAULT 0");
    } catch (e) {}

    // Enhance maint_assets
    await addColumnIfNotExists("maint_assets", "property_id", "INT NULL");
    await addColumnIfNotExists("maint_assets", "building_id", "INT NULL");
    await addColumnIfNotExists("maint_assets", "zone_id", "INT NULL");
    await addColumnIfNotExists("maint_assets", "space_id", "INT NULL");
    await addColumnIfNotExists("maint_assets", "client_id", "INT NULL");
    await addColumnIfNotExists("maint_assets", "category", "VARCHAR(100) NULL");
    await addColumnIfNotExists("maint_assets", "make", "VARCHAR(100) NULL");
    await addColumnIfNotExists("maint_assets", "model", "VARCHAR(100) NULL");
    await addColumnIfNotExists("maint_assets", "serial_number", "VARCHAR(100) NULL");
    await addColumnIfNotExists("maint_assets", "capacity_rating", "VARCHAR(100) NULL");
    await addColumnIfNotExists("maint_assets", "criticality", "ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM'");
    await addColumnIfNotExists("maint_assets", "installed_date", "DATE NULL");
    await addColumnIfNotExists("maint_assets", "warranty_expiry_date", "DATE NULL");

    // Enhance maint_requests
    await addColumnIfNotExists("maint_requests", "property_id", "INT NULL");
    await addColumnIfNotExists("maint_requests", "building_id", "INT NULL");
    await addColumnIfNotExists("maint_requests", "zone_id", "INT NULL");
    await addColumnIfNotExists("maint_requests", "space_id", "INT NULL");
    await addColumnIfNotExists("maint_requests", "client_id", "INT NULL");
    await addColumnIfNotExists("maint_requests", "contract_id", "INT NULL");
    await addColumnIfNotExists("maint_requests", "service_line", "VARCHAR(100) NULL");
    await addColumnIfNotExists("maint_requests", "sla_priority", "ENUM('EMERGENCY', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM'");
    await addColumnIfNotExists("maint_requests", "sla_response_due", "DATETIME NULL");
    await addColumnIfNotExists("maint_requests", "sla_resolution_due", "DATETIME NULL");
    await addColumnIfNotExists("maint_requests", "responded_at", "DATETIME NULL");
    await addColumnIfNotExists("maint_requests", "resolved_at", "DATETIME NULL");
    await addColumnIfNotExists("maint_requests", "sla_response_breached", "TINYINT(1) DEFAULT 0");
    await addColumnIfNotExists("maint_requests", "sla_resolution_breached", "TINYINT(1) DEFAULT 0");
    await addColumnIfNotExists("maint_requests", "sla_pause_reason", "VARCHAR(255) NULL");
    await addColumnIfNotExists("maint_requests", "sla_paused_at", "DATETIME NULL");
    await addColumnIfNotExists("maint_requests", "sla_resumed_at", "DATETIME NULL");
    await addColumnIfNotExists("maint_requests", "total_paused_minutes", "INT DEFAULT 0");
    await addColumnIfNotExists("maint_requests", "billable_type", "ENUM('CONTRACT_COVERED', 'BILLABLE_EXTRA', 'WARRANTY', 'GOODWILL') DEFAULT 'CONTRACT_COVERED'");
    await addColumnIfNotExists("maint_requests", "estimated_cost", "DECIMAL(14, 2) DEFAULT 0.00");
    await addColumnIfNotExists("maint_requests", "actual_cost", "DECIMAL(14, 2) DEFAULT 0.00");
    await addColumnIfNotExists("maint_requests", "tenant_contact_name", "VARCHAR(150) NULL");
    await addColumnIfNotExists("maint_requests", "tenant_contact_phone", "VARCHAR(50) NULL");
    await addColumnIfNotExists("maint_requests", "tenant_unit", "VARCHAR(100) NULL");

    // Enhance maint_job_orders
    await addColumnIfNotExists("maint_job_orders", "property_id", "INT NULL");
    await addColumnIfNotExists("maint_job_orders", "building_id", "INT NULL");
    await addColumnIfNotExists("maint_job_orders", "zone_id", "INT NULL");
    await addColumnIfNotExists("maint_job_orders", "space_id", "INT NULL");
    await addColumnIfNotExists("maint_job_orders", "client_id", "INT NULL");
    await addColumnIfNotExists("maint_job_orders", "contract_id", "INT NULL");
    await addColumnIfNotExists("maint_job_orders", "service_line", "VARCHAR(100) NULL");
    await addColumnIfNotExists("maint_job_orders", "priority", "VARCHAR(50) DEFAULT 'MEDIUM'");
    await addColumnIfNotExists("maint_job_orders", "estimated_hours", "DECIMAL(6, 2) DEFAULT 0.00");
    await addColumnIfNotExists("maint_job_orders", "actual_hours", "DECIMAL(6, 2) DEFAULT 0.00");
    await addColumnIfNotExists("maint_job_orders", "travel_start_time", "DATETIME NULL");
    await addColumnIfNotExists("maint_job_orders", "arrival_time", "DATETIME NULL");
    await addColumnIfNotExists("maint_job_orders", "job_start_time", "DATETIME NULL");
    await addColumnIfNotExists("maint_job_orders", "job_end_time", "DATETIME NULL");
    await addColumnIfNotExists("maint_job_orders", "travel_duration_minutes", "INT DEFAULT 0");
    await addColumnIfNotExists("maint_job_orders", "vehicle_id", "INT NULL");
    await addColumnIfNotExists("maint_job_orders", "safety_briefing_acknowledged", "TINYINT(1) DEFAULT 0");
    await addColumnIfNotExists("maint_job_orders", "risk_assessment_notes", "TEXT NULL");
    await addColumnIfNotExists("maint_job_orders", "completion_notes", "TEXT NULL");
    await addColumnIfNotExists("maint_job_orders", "customer_signature_name", "VARCHAR(150) NULL");
    await addColumnIfNotExists("maint_job_orders", "customer_signature_data", "LONGTEXT NULL");
    await addColumnIfNotExists("maint_job_orders", "customer_satisfaction_rating", "INT NULL");
    await addColumnIfNotExists("maint_job_orders", "customer_feedback", "TEXT NULL");
    await addColumnIfNotExists("maint_job_orders", "before_photos", "LONGTEXT NULL");
    await addColumnIfNotExists("maint_job_orders", "after_photos", "LONGTEXT NULL");

    // 14. Seed Default Inspection Checklist Templates
    await seedDefaultFMChecklists();

    console.log("[FM Migration] Facilities Management schema ensured successfully.");
  } catch (error) {
    console.error("[FM Migration] Error ensuring facilities management tables:", error);
    throw error;
  }
}

/**
 * Seed industry-standard FM inspection templates if none exist
 */
async function seedDefaultFMChecklists() {
  try {
    const [existing] = await pool.query("SELECT COUNT(*) AS count FROM fm_checklist_templates");
    if (existing[0]?.count > 0) return;

    // Template 1: HVAC Quarterly Routine Inspection
    const [hvac] = await pool.query(`
      INSERT INTO fm_checklist_templates (company_id, template_code, template_name, service_line, description)
      VALUES (1, 'TPL-HVAC-QTR', 'HVAC & Chiller Quarterly Inspection', 'HVAC_AIR_CONDITIONING', 'Standard quarterly operational inspection for chillers, AHUs, and split units.')
    `);
    const hvacId = hvac.insertId;

    const hvacItems = [
      [hvacId, 1, 'Electrical & Controls', 'Check supply voltage across phases (within 380V-420V)', 'NUMERIC_READING', 380, 420, 'V', 1, 'CREATE_WORK_ORDER'],
      [hvacId, 2, 'Electrical & Controls', 'Check compressor running current (within rated FLA)', 'NUMERIC_READING', 5, 60, 'A', 1, 'CREATE_WORK_ORDER'],
      [hvacId, 3, 'Electrical & Controls', 'Inspect thermostat calibration & control panel alarms', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [hvacId, 4, 'Refrigeration Cycle', 'Suction refrigerant pressure (psi)', 'NUMERIC_READING', 55, 80, 'psi', 1, 'CREATE_WORK_ORDER'],
      [hvacId, 5, 'Refrigeration Cycle', 'Discharge refrigerant pressure (psi)', 'NUMERIC_READING', 200, 280, 'psi', 1, 'CREATE_WORK_ORDER'],
      [hvacId, 6, 'Mechanical & Airflow', 'Clean/replace primary and secondary air filters', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [hvacId, 7, 'Mechanical & Airflow', 'Inspect fan motor bearings and lubricate', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [hvacId, 8, 'Condensate & Drainage', 'Clean condensate drain pan and verify unobstructed drainage', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY']
    ];
    for (const item of hvacItems) {
      await pool.query(`
        INSERT INTO fm_checklist_template_items 
        (template_id, item_sequence, section_header, item_text, field_type, min_reading, max_reading, unit_of_measure, is_critical, failure_action)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, item);
    }

    // Template 2: Generator 250-Hour / Monthly PM Inspection
    const [gen] = await pool.query(`
      INSERT INTO fm_checklist_templates (company_id, template_code, template_name, service_line, description)
      VALUES (1, 'TPL-GEN-MTH', 'Diesel Generator Monthly / 250H Inspection', 'GENERATOR_POWER', 'Preventive maintenance check for standby generator sets and ATS.')
    `);
    const genId = gen.insertId;

    const genItems = [
      [genId, 1, 'Fluids & Levels', 'Check engine oil level on dipstick', 'PASS_FAIL', null, null, null, 1, 'CREATE_WORK_ORDER'],
      [genId, 2, 'Fluids & Levels', 'Check radiator coolant level and antifreeze inhibitor', 'PASS_FAIL', null, null, null, 1, 'CREATE_WORK_ORDER'],
      [genId, 3, 'Fluids & Levels', 'Check fuel day-tank level (%)', 'NUMERIC_READING', 25, 100, '%', 1, 'CREATE_WORK_ORDER'],
      [genId, 4, 'Electrical & Starting', 'Measure starter battery DC voltage (resting)', 'NUMERIC_READING', 12.4, 14.2, 'V', 1, 'CREATE_WORK_ORDER'],
      [genId, 5, 'Electrical & Starting', 'Inspect battery charger trickle output', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [genId, 6, 'Operational Test', 'Perform 10-minute test run without load; verify smooth startup', 'PASS_FAIL', null, null, null, 1, 'CREATE_WORK_ORDER'],
      [genId, 7, 'Operational Test', 'Record engine oil pressure during operation (bar)', 'NUMERIC_READING', 3.0, 5.5, 'bar', 1, 'CREATE_WORK_ORDER'],
      [genId, 8, 'Operational Test', 'Record operating coolant temperature (°C)', 'NUMERIC_READING', 75, 95, '°C', 1, 'CREATE_WORK_ORDER'],
      [genId, 9, 'ATS & Switchgear', 'Inspect ATS controller for active fault codes and alarms', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY']
    ];
    for (const item of genItems) {
      await pool.query(`
        INSERT INTO fm_checklist_template_items 
        (template_id, item_sequence, section_header, item_text, field_type, min_reading, max_reading, unit_of_measure, is_critical, failure_action)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, item);
    }

    // Template 3: Fire Safety & Extinguishers Monthly Audit
    const [fire] = await pool.query(`
      INSERT INTO fm_checklist_templates (company_id, template_code, template_name, service_line, description)
      VALUES (1, 'TPL-FIRE-MTH', 'Fire Detection & Suppression Monthly Audit', 'FIRE_SAFETY_SYSTEMS', 'Monthly regulatory audit of fire alarm panels, break glass units, and extinguishers.')
    `);
    const fireId = fire.insertId;

    const fireItems = [
      [fireId, 1, 'Fire Alarm Control Panel', 'Verify FACP power LED is green and no supervisory/trouble faults exist', 'PASS_FAIL', null, null, null, 1, 'CREATE_WORK_ORDER'],
      [fireId, 2, 'Fire Alarm Control Panel', 'Test panel lamp and sounder buzzer', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [fireId, 3, 'Fire Extinguishers', 'Verify pressure gauge needles are in green operational zone', 'PASS_FAIL', null, null, null, 1, 'CREATE_WORK_ORDER'],
      [fireId, 4, 'Fire Extinguishers', 'Check safety pins and tamper seals are intact', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [fireId, 5, 'Emergency Exits & Lighting', 'Inspect emergency exit signage illumination and pathway clearance', 'PASS_FAIL', null, null, null, 1, 'CREATE_WORK_ORDER'],
      [fireId, 6, 'Hose Reels & Hydrants', 'Inspect fire hose reels for leaks and verify nozzle functionality', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY']
    ];
    for (const item of fireItems) {
      await pool.query(`
        INSERT INTO fm_checklist_template_items 
        (template_id, item_sequence, section_header, item_text, field_type, min_reading, max_reading, unit_of_measure, is_critical, failure_action)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, item);
    }

    // Template 4: Restroom & Janitorial Hygiene Audit
    const [clean] = await pool.query(`
      INSERT INTO fm_checklist_templates (company_id, template_code, template_name, service_line, description)
      VALUES (1, 'TPL-CLEAN-AUDIT', 'Restroom & Janitorial Hygiene Quality Audit', 'CLEANING_JANITORIAL', 'Supervisor cleaning quality inspection and restocking audit.')
    `);
    const cleanId = clean.insertId;

    const cleanItems = [
      [cleanId, 1, 'Fixtures & Sanitization', 'Toilet bowls, seats, and urinals thoroughly descaled & disinfected', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [cleanId, 2, 'Fixtures & Sanitization', 'Washbasins and taps cleaned and polished without residue', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [cleanId, 3, 'Surfaces & Floors', 'Floors scrubbed, mopped, dry and odor-free', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [cleanId, 4, 'Surfaces & Floors', 'Mirrors, partition walls, and high-touch door handles wiped', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [cleanId, 5, 'Consumables Restocking', 'Hand soap dispensers, paper towels, and toilet paper fully restocked', 'PASS_FAIL', null, null, null, 1, 'CREATE_WORK_ORDER'],
      [cleanId, 6, 'Waste Disposal', 'Sanitary and refuse bins emptied, cleaned, and re-lined', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [cleanId, 7, 'Overall Impression', 'Supervisor overall presentation rating (1 to 5 stars)', 'RATING_1_5', 1, 5, 'stars', 0, 'FLAG_ONLY']
    ];
    for (const item of cleanItems) {
      await pool.query(`
        INSERT INTO fm_checklist_template_items 
        (template_id, item_sequence, section_header, item_text, field_type, min_reading, max_reading, unit_of_measure, is_critical, failure_action)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, item);
    }

    // Template 5: Pest Control Station Audit
    const [pest] = await pool.query(`
      INSERT INTO fm_checklist_templates (company_id, template_code, template_name, service_line, description)
      VALUES (1, 'TPL-PEST-INSP', 'Commercial Pest Control & Bait Station Audit', 'PEST_CONTROL', 'Inspection of rodent bait stations, insect light traps, and pest risk points.')
    `);
    const pestId = pest.insertId;

    const pestItems = [
      [pestId, 1, 'External Perimeter', 'Inspect external tamper-resistant rodent stations for activity or bait take', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [pestId, 2, 'External Perimeter', 'Replace decayed bait blocks with fresh bromadiolone/difenacoum blocks', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [pestId, 3, 'Internal Traps', 'Inspect glue boards in warehouse and canteen areas', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [pestId, 4, 'Fly Control Units', 'Clean insect light trap catch trays and inspect UV tubes', 'PASS_FAIL', null, null, null, 0, 'FLAG_ONLY'],
      [pestId, 5, 'Risk Assessment', 'Record overall infestation risk level (1=Low, 5=High)', 'RATING_1_5', 1, 5, 'risk', 1, 'CREATE_WORK_ORDER']
    ];
    for (const item of pestItems) {
      await pool.query(`
        INSERT INTO fm_checklist_template_items 
        (template_id, item_sequence, section_header, item_text, field_type, min_reading, max_reading, unit_of_measure, is_critical, failure_action)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, item);
    }

    console.log("[FM Migration] Seeded 5 industry-standard FM inspection templates.");
  } catch (err) {
    console.warn("[FM Migration] Seed checklist warning:", err.message);
  }
}
