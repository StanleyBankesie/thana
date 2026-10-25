/**
 * @file constructionTables.js
 * @description Safe idempotent schema migrations and table definitions for OmniSuite Construction Management.
 * Follows OmniSuite ERP database conventions, multi-tenant company/branch isolation, and audit timestamps.
 */

import { query } from "../db/pool.js";

let tablesEnsured = false;

export async function ensureConstructionTables() {
  if (tablesEnsured) return;
  tablesEnsured = true;

  try {
    // 1. Extend pm_projects with Construction metadata
    const projectAlterations = [
      "ADD COLUMN project_type VARCHAR(100) DEFAULT 'GENERAL_CONSTRUCTION' AFTER project_name",
      "ADD COLUMN site_address VARCHAR(255) NULL AFTER client_name",
      "ADD COLUMN site_city VARCHAR(100) NULL AFTER site_address",
      "ADD COLUMN site_gps_lat DECIMAL(10,8) NULL AFTER site_city",
      "ADD COLUMN site_gps_lng DECIMAL(11,8) NULL AFTER site_gps_lat",
      "ADD COLUMN client_id BIGINT UNSIGNED NULL AFTER client_name",
      "ADD COLUMN contract_ref_no VARCHAR(100) NULL AFTER client_id",
      "ADD COLUMN contract_sum DECIMAL(18,2) DEFAULT 0.00 AFTER budget",
      "ADD COLUMN revised_contract_sum DECIMAL(18,2) DEFAULT 0.00 AFTER contract_sum",
      "ADD COLUMN site_engineer_id INT NULL AFTER manager_id",
      "ADD COLUMN site_engineer_name VARCHAR(200) NULL AFTER site_engineer_id",
      "ADD COLUMN qs_id INT NULL AFTER site_engineer_name",
      "ADD COLUMN qs_name VARCHAR(200) NULL AFTER qs_id",
      "ADD COLUMN supervisor_id INT NULL AFTER qs_name",
      "ADD COLUMN supervisor_name VARCHAR(200) NULL AFTER supervisor_id",
      "ADD COLUMN commercial_manager_id INT NULL AFTER supervisor_name",
      "ADD COLUMN commercial_manager_name VARCHAR(200) NULL AFTER commercial_manager_id",
      "ADD COLUMN retention_percent DECIMAL(5,2) DEFAULT 5.00 AFTER revised_contract_sum",
      "ADD COLUMN retention_cap DECIMAL(18,2) DEFAULT 0.00 AFTER retention_percent",
      "ADD COLUMN retention_held DECIMAL(18,2) DEFAULT 0.00 AFTER retention_cap",
      "ADD COLUMN retention_released DECIMAL(18,2) DEFAULT 0.00 AFTER retention_held",
      "ADD COLUMN advance_payment_amount DECIMAL(18,2) DEFAULT 0.00 AFTER retention_released",
      "ADD COLUMN advance_recovery_percent DECIMAL(5,2) DEFAULT 10.00 AFTER advance_payment_amount",
      "ADD COLUMN advance_recovered DECIMAL(18,2) DEFAULT 0.00 AFTER advance_recovery_percent",
      "ADD COLUMN defects_liability_months INT DEFAULT 12 AFTER advance_recovered",
      "ADD COLUMN practical_completion_date DATE NULL AFTER actual_end_date",
      "ADD COLUMN final_completion_date DATE NULL AFTER practical_completion_date",
      "ADD COLUMN wbs_code VARCHAR(50) NULL AFTER remarks",
    ];

    for (const alt of projectAlterations) {
      try {
        await query(`ALTER TABLE pm_projects ${alt}`);
      } catch (e) {
        // Column already exists or table busy; safe to ignore
      }
    }

    // 2. Sites & Work Breakdown Structure (WBS)
    await query(`
      CREATE TABLE IF NOT EXISTS pm_sites (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        site_name VARCHAR(200) NOT NULL,
        site_code VARCHAR(50) NOT NULL,
        location VARCHAR(255) NULL,
        gps_lat DECIMAL(10,8) NULL,
        gps_lng DECIMAL(11,8) NULL,
        supervisor_name VARCHAR(200) NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_sites_proj (project_id),
        KEY idx_pm_sites_comp (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_phases (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        site_id BIGINT UNSIGNED NULL,
        phase_code VARCHAR(50) NOT NULL,
        phase_name VARCHAR(200) NOT NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        budget DECIMAL(18,2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'PLANNED',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_phases_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_work_packages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        phase_id BIGINT UNSIGNED NULL,
        package_code VARCHAR(50) NOT NULL,
        package_name VARCHAR(200) NOT NULL,
        lead_user_id INT NULL,
        lead_user_name VARCHAR(200) NULL,
        status VARCHAR(50) DEFAULT 'PLANNED',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_wp_proj (project_id),
        KEY idx_pm_wp_phase (phase_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Project Cost Codes
    await query(`
      CREATE TABLE IF NOT EXISTS pm_cost_codes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        code VARCHAR(50) NOT NULL,
        description VARCHAR(255) NOT NULL,
        category ENUM(
          'MATERIALS',
          'DIRECT_LABOUR',
          'PLANT_EQUIPMENT',
          'SUBCONTRACTORS',
          'TRANSPORT_LOGISTICS',
          'SITE_OVERHEADS',
          'PROFESSIONAL_FEES',
          'TEMPORARY_WORKS',
          'INSURANCE_COMPLIANCE',
          'GENERAL_OVERHEADS'
        ) NOT NULL DEFAULT 'MATERIALS',
        is_active ENUM('Y','N') DEFAULT 'Y',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_cost_code_comp (company_id, code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default construction cost codes if empty
    try {
      const existingCodes = await query(`SELECT id FROM pm_cost_codes LIMIT 1`);
      if (!existingCodes || existingCodes.length === 0) {
        await query(`
          INSERT INTO pm_cost_codes (company_id, code, description, category) VALUES
          (1, 'MAT-001', 'Bulk Building Materials (Cement, Sand, Gravel, Blocks)', 'MATERIALS'),
          (1, 'MAT-002', 'Reinforcement Steel & Wire', 'MATERIALS'),
          (1, 'MAT-003', 'Timber & Formwork Materials', 'MATERIALS'),
          (1, 'MAT-004', 'Finishes & Paints', 'MATERIALS'),
          (1, 'LAB-001', 'Direct Skilled Labour (Masons, Carpenters, Steel Fixers)', 'DIRECT_LABOUR'),
          (1, 'LAB-002', 'Direct Casual & Gang Labour', 'DIRECT_LABOUR'),
          (1, 'EQP-001', 'Heavy Earthmoving Plant (Excavator, Bulldozer, Compactor)', 'PLANT_EQUIPMENT'),
          (1, 'EQP-002', 'Concrete Equipment (Mixers, Poker Vibrators, Pumps)', 'PLANT_EQUIPMENT'),
          (1, 'EQP-003', 'Scaffolding & Craneage', 'PLANT_EQUIPMENT'),
          (1, 'SUB-001', 'Specialist Subcontractors (MEP, Roofing, Glazing)', 'SUBCONTRACTORS'),
          (1, 'TRN-001', 'Site Haulage & Materials Cartage', 'TRANSPORT_LOGISTICS'),
          (1, 'OVH-001', 'Site Overheads, Security, Electricity & Water', 'SITE_OVERHEADS'),
          (1, 'PRO-001', 'Engineering Supervision & QS Professional Fees', 'PROFESSIONAL_FEES'),
          (1, 'INS-001', 'Contractor All Risks (CAR) Insurance & Statutory Permits', 'INSURANCE_COMPLIANCE');
        `);
      }
    } catch {}

    // 4. Tenders & Estimations
    await query(`
      CREATE TABLE IF NOT EXISTS pm_tenders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        tender_no VARCHAR(50) NOT NULL,
        client_name VARCHAR(200) NOT NULL,
        client_id BIGINT UNSIGNED NULL,
        project_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'GENERAL_CONSTRUCTION',
        submission_deadline DATE NULL,
        site_visit_date DATE NULL,
        bid_decision ENUM('PENDING','BID','NO_BID') DEFAULT 'PENDING',
        estimated_cost DECIMAL(18,2) DEFAULT 0.00,
        bid_price DECIMAL(18,2) DEFAULT 0.00,
        status ENUM('DRAFT','SUBMITTED','UNDER_EVALUATION','AWARDED','REJECTED') DEFAULT 'DRAFT',
        awarded_project_id INT NULL,
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_tender_no (company_id, tender_no),
        KEY idx_pm_tenders_comp (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Bill of Quantities (BOQ) & Items
    await query(`
      CREATE TABLE IF NOT EXISTS pm_boqs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NULL,
        project_id INT NULL,
        tender_id BIGINT UNSIGNED NULL,
        boq_reference VARCHAR(100) NULL,
        boq_title VARCHAR(255) NOT NULL,
        client_name VARCHAR(255) NULL,
        site_location VARCHAR(255) NULL,
        boq_date DATE NULL,
        version VARCHAR(30) DEFAULT '1.0',
        currency VARCHAR(10) DEFAULT 'GHS',
        subtotal DECIMAL(18,2) DEFAULT 0.00,
        contingency_percent DECIMAL(5,2) DEFAULT 0.00,
        contingency_amount DECIMAL(18,2) DEFAULT 0.00,
        tax_percent DECIMAL(5,2) DEFAULT 0.00,
        tax_amount DECIMAL(18,2) DEFAULT 0.00,
        other_charges DECIMAL(18,2) DEFAULT 0.00,
        total_amount DECIMAL(18,2) DEFAULT 0.00,
        status ENUM('DRAFT','UNDER_REVIEW','APPROVED','REVISED','REJECTED') DEFAULT 'DRAFT',
        prepared_by_id INT NULL,
        prepared_by_name VARCHAR(150) NULL,
        prepared_date DATE NULL,
        reviewed_by_id INT NULL,
        reviewed_by_name VARCHAR(150) NULL,
        reviewed_date DATE NULL,
        approved_by_id INT NULL,
        approved_by_name VARCHAR(150) NULL,
        approved_date DATE NULL,
        approval_remarks TEXT NULL,
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_boqs_proj (project_id),
        KEY idx_pm_boqs_tender (tender_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_boq_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        boq_id BIGINT UNSIGNED NOT NULL,
        project_id INT NULL,
        phase_id BIGINT UNSIGNED NULL,
        work_package_id BIGINT UNSIGNED NULL,
        cost_code_id BIGINT UNSIGNED NULL,
        item_code VARCHAR(50) NOT NULL,
        item_description TEXT NOT NULL,
        uom VARCHAR(30) NOT NULL,
        cost_category ENUM('MATERIALS','LABOUR','EQUIPMENT','SUBCONTRACTING','TRANSPORTATION','OTHER') DEFAULT 'MATERIALS',
        quantity DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
        unit_rate DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
        amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        tax_rate_percent DECIMAL(5,2) DEFAULT 0.00,
        tax_amount DECIMAL(18,2) DEFAULT 0.00,
        estimated_qty DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
        tender_rate DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
        tender_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        unit_cost_estimate DECIMAL(18,4) DEFAULT 0.0000,
        total_cost_estimate DECIMAL(18,2) DEFAULT 0.00,
        markup_percent DECIMAL(5,2) DEFAULT 0.00,
        actual_qty DECIMAL(15,4) DEFAULT 0.0000,
        actual_cost DECIMAL(18,2) DEFAULT 0.00,
        item_order INT DEFAULT 0,
        status VARCHAR(30) DEFAULT 'ACTIVE',
        remarks TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_boq_items_boq (boq_id),
        KEY idx_boq_items_proj (project_id),
        KEY idx_boq_items_cc (cost_code_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_boq_revisions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        boq_id BIGINT UNSIGNED NOT NULL,
        version VARCHAR(30) NOT NULL,
        revision_date DATE NOT NULL,
        prepared_by VARCHAR(150) NULL,
        reviewed_by VARCHAR(150) NULL,
        approved_by VARCHAR(150) NULL,
        subtotal DECIMAL(18,2) DEFAULT 0.00,
        contingency_amount DECIMAL(18,2) DEFAULT 0.00,
        tax_amount DECIMAL(18,2) DEFAULT 0.00,
        total_amount DECIMAL(18,2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'DRAFT',
        remarks TEXT NULL,
        snapshot_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_boq_rev_boq (boq_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Rate Build-Up Analysis & Quantity Takeoff Sheets
    await query(`
      CREATE TABLE IF NOT EXISTS pm_rate_analyses (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        boq_item_id BIGINT UNSIGNED NOT NULL,
        material_cost DECIMAL(18,4) DEFAULT 0.0000,
        labour_cost DECIMAL(18,4) DEFAULT 0.0000,
        plant_cost DECIMAL(18,4) DEFAULT 0.0000,
        subc_cost DECIMAL(18,4) DEFAULT 0.0000,
        transport_cost DECIMAL(18,4) DEFAULT 0.0000,
        overhead_percent DECIMAL(5,2) DEFAULT 10.00,
        profit_markup_percent DECIMAL(5,2) DEFAULT 15.00,
        computed_unit_rate DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
        breakdown_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_ra_item (boq_item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_takeoff_sheets (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        boq_item_id BIGINT UNSIGNED NULL,
        sheet_no VARCHAR(50) NOT NULL,
        description VARCHAR(255) NOT NULL,
        drawing_ref VARCHAR(100) NULL,
        formula_description VARCHAR(255) NULL,
        dimensions_json JSON NULL,
        calculated_qty DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
        uom VARCHAR(20) NOT NULL,
        reviewer_id INT NULL,
        status ENUM('DRAFT','REVIEWED','APPROVED') DEFAULT 'DRAFT',
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_takeoff_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Project Budgets, Budget Lines & Revisions
    await query(`
      CREATE TABLE IF NOT EXISTS pm_project_budgets (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        budget_title VARCHAR(255) NOT NULL,
        revision_no INT DEFAULT 1,
        original_budget DECIMAL(18,2) DEFAULT 0.00,
        approved_budget DECIMAL(18,2) DEFAULT 0.00,
        status ENUM('DRAFT','PENDING_APPROVAL','APPROVED','REVISED','REJECTED') DEFAULT 'DRAFT',
        approved_by BIGINT UNSIGNED NULL,
        approved_at DATETIME NULL,
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_bud_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_budget_lines (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        budget_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        cost_code_id BIGINT UNSIGNED NOT NULL,
        category VARCHAR(50) NOT NULL,
        phase_id BIGINT UNSIGNED NULL,
        work_package_id BIGINT UNSIGNED NULL,
        original_amount DECIMAL(18,2) DEFAULT 0.00,
        approved_amount DECIMAL(18,2) DEFAULT 0.00,
        committed_amount DECIMAL(18,2) DEFAULT 0.00,
        actual_amount DECIMAL(18,2) DEFAULT 0.00,
        forecast_to_complete DECIMAL(18,2) DEFAULT 0.00,
        forecast_final_cost DECIMAL(18,2) DEFAULT 0.00,
        variance DECIMAL(18,2) DEFAULT 0.00,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_bl_budget (budget_id),
        KEY idx_bl_proj (project_id),
        KEY idx_bl_cost_code (cost_code_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_budget_revisions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        budget_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        revision_no INT NOT NULL,
        reason TEXT NOT NULL,
        change_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        status ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
        approved_by BIGINT UNSIGNED NULL,
        approved_at DATETIME NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_br_budget (budget_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Construction Planning, Critical Path (CPM) & EOT
    const taskAlterations = [
      "ADD COLUMN wbs_code VARCHAR(50) NULL AFTER phase_id",
      "ADD COLUMN early_start DATE NULL AFTER end_date",
      "ADD COLUMN early_finish DATE NULL AFTER early_start",
      "ADD COLUMN late_start DATE NULL AFTER early_finish",
      "ADD COLUMN late_finish DATE NULL AFTER late_start",
      "ADD COLUMN total_float INT DEFAULT 0 AFTER late_finish",
      "ADD COLUMN is_critical TINYINT(1) DEFAULT 0 AFTER total_float",
      "ADD COLUMN baseline_start DATE NULL AFTER is_critical",
      "ADD COLUMN baseline_end DATE NULL AFTER baseline_start",
      "ADD COLUMN cost_code_id BIGINT UNSIGNED NULL AFTER priority",
      "ADD COLUMN work_package_id BIGINT UNSIGNED NULL AFTER wbs_code",
    ];
    for (const alt of taskAlterations) {
      try {
        await query(`ALTER TABLE pm_tasks ${alt}`);
      } catch (e) {}
    }

    await query(`
      CREATE TABLE IF NOT EXISTS pm_schedule_baselines (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        baseline_name VARCHAR(150) NOT NULL,
        version_no INT DEFAULT 1,
        snapshot_json LONGTEXT NOT NULL,
        approved_by BIGINT UNSIGNED NULL,
        approved_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_baseline_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_eot_requests (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        request_no VARCHAR(50) NOT NULL,
        days_requested INT NOT NULL,
        reason TEXT NOT NULL,
        delay_category VARCHAR(100) DEFAULT 'CLIENT_EVENT',
        impact_assessment TEXT NULL,
        status ENUM('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED') DEFAULT 'DRAFT',
        approved_days INT DEFAULT 0,
        revised_completion_date DATE NULL,
        approved_by BIGINT UNSIGNED NULL,
        approved_at DATETIME NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_eot_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Daily Site Diary & Operational Reporting
    await query(`
      CREATE TABLE IF NOT EXISTS pm_daily_site_reports (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        site_id BIGINT UNSIGNED NULL,
        report_no VARCHAR(50) NOT NULL,
        report_date DATE NOT NULL,
        shift ENUM('DAY','NIGHT') DEFAULT 'DAY',
        reporting_officer_id INT NULL,
        reporting_officer_name VARCHAR(200) NOT NULL,
        weather ENUM('SUNNY','RAINY','CLOUDY','STORMY','WINDY') DEFAULT 'SUNNY',
        rainfall_mm DECIMAL(6,2) DEFAULT 0.00,
        site_condition VARCHAR(255) NULL,
        workforce_count INT DEFAULT 0,
        total_labour_hours DECIMAL(10,2) DEFAULT 0.00,
        supervisor_comments TEXT NULL,
        status ENUM('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','RETURNED') DEFAULT 'DRAFT',
        reviewer_id INT NULL,
        reviewer_comments TEXT NULL,
        approved_at DATETIME NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_site_rep (company_id, project_id, report_date, shift),
        KEY idx_dsr_proj (project_id),
        KEY idx_dsr_date (report_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_daily_site_activities (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        report_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        task_id INT NULL,
        boq_item_id BIGINT UNSIGNED NULL,
        activity_name VARCHAR(255) NOT NULL,
        location VARCHAR(200) NULL,
        measured_qty_completed DECIMAL(15,4) DEFAULT 0.0000,
        uom VARCHAR(20) NULL,
        progress_percent DECIMAL(5,2) DEFAULT 0.00,
        remarks TEXT NULL,
        PRIMARY KEY (id),
        KEY idx_dsa_rep (report_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_daily_site_workforce (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        report_id BIGINT UNSIGNED NOT NULL,
        trade_category VARCHAR(100) NOT NULL,
        headcount INT NOT NULL DEFAULT 1,
        total_hours DECIMAL(8,2) NOT NULL DEFAULT 8.00,
        subcontractor_name VARCHAR(200) NULL,
        remarks VARCHAR(255) NULL,
        PRIMARY KEY (id),
        KEY idx_dsw_rep (report_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_daily_site_equipment (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        report_id BIGINT UNSIGNED NOT NULL,
        equipment_name VARCHAR(200) NOT NULL,
        asset_no VARCHAR(100) NULL,
        operating_hours DECIMAL(6,2) DEFAULT 0.00,
        idle_hours DECIMAL(6,2) DEFAULT 0.00,
        breakdown_hours DECIMAL(6,2) DEFAULT 0.00,
        fuel_litres DECIMAL(8,2) DEFAULT 0.00,
        operator_name VARCHAR(200) NULL,
        PRIMARY KEY (id),
        KEY idx_dse_rep (report_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_daily_site_materials (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        report_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NULL,
        item_name VARCHAR(255) NOT NULL,
        qty_received DECIMAL(15,4) DEFAULT 0.0000,
        qty_consumed DECIMAL(15,4) DEFAULT 0.0000,
        uom VARCHAR(20) NULL,
        delivery_note_ref VARCHAR(100) NULL,
        PRIMARY KEY (id),
        KEY idx_dsm_rep (report_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_daily_site_photos (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        report_id BIGINT UNSIGNED NOT NULL,
        photo_url VARCHAR(500) NOT NULL,
        caption VARCHAR(255) NULL,
        activity_ref VARCHAR(100) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_dsp_rep (report_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Subcontractor Management & Valuations (IPCs)
    await query(`
      CREATE TABLE IF NOT EXISTS pm_subcontracts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        contract_no VARCHAR(50) NOT NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,
        subcontractor_name VARCHAR(200) NOT NULL,
        trade_category VARCHAR(100) NOT NULL,
        scope_of_work TEXT NOT NULL,
        contract_value DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        retention_percent DECIMAL(5,2) DEFAULT 5.00,
        retention_cap DECIMAL(18,2) DEFAULT 0.00,
        retention_held DECIMAL(18,2) DEFAULT 0.00,
        advance_percent DECIMAL(5,2) DEFAULT 0.00,
        advance_paid DECIMAL(18,2) DEFAULT 0.00,
        advance_recovered DECIMAL(18,2) DEFAULT 0.00,
        start_date DATE NULL,
        completion_date DATE NULL,
        status ENUM('DRAFT','ACTIVE','SUSPENDED','COMPLETED','TERMINATED') DEFAULT 'DRAFT',
        terms_and_conditions TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_subc_no (company_id, contract_no),
        KEY idx_pm_subc_proj (project_id),
        KEY idx_pm_subc_supp (supplier_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_subcontract_valuations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        subcontract_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        valuation_no VARCHAR(50) NOT NULL,
        valuation_date DATE NOT NULL,
        period_from DATE NULL,
        period_to DATE NULL,
        gross_claimed DECIMAL(18,2) DEFAULT 0.00,
        gross_certified DECIMAL(18,2) DEFAULT 0.00,
        previous_certified DECIMAL(18,2) DEFAULT 0.00,
        current_certified DECIMAL(18,2) DEFAULT 0.00,
        retention_deducted DECIMAL(18,2) DEFAULT 0.00,
        advance_recovered DECIMAL(18,2) DEFAULT 0.00,
        other_deductions DECIMAL(18,2) DEFAULT 0.00,
        net_payable DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        status ENUM('DRAFT','SUBMITTED','UNDER_REVIEW','CERTIFIED','INVOICED','PAID','REJECTED') DEFAULT 'DRAFT',
        voucher_id BIGINT UNSIGNED NULL,
        certified_by BIGINT UNSIGNED NULL,
        certified_at DATETIME NULL,
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_sub_val (company_id, valuation_no),
        KEY idx_pm_subval_sc (subcontract_id),
        KEY idx_pm_subval_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_subcontract_valuation_lines (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        valuation_id BIGINT UNSIGNED NOT NULL,
        item_description VARCHAR(255) NOT NULL,
        uom VARCHAR(20) NOT NULL,
        contract_qty DECIMAL(15,4) DEFAULT 0.0000,
        previous_qty DECIMAL(15,4) DEFAULT 0.0000,
        this_period_qty DECIMAL(15,4) DEFAULT 0.0000,
        cumulative_qty DECIMAL(15,4) DEFAULT 0.0000,
        unit_rate DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
        this_period_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        PRIMARY KEY (id),
        KEY idx_sc_vl_val (valuation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Client Interim Payment Applications (IPAs) & Valuations
    await query(`
      CREATE TABLE IF NOT EXISTS pm_client_valuations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        client_id BIGINT UNSIGNED NULL,
        client_name VARCHAR(200) NOT NULL,
        application_no VARCHAR(50) NOT NULL,
        valuation_date DATE NOT NULL,
        period_from DATE NULL,
        period_to DATE NULL,
        gross_claimed DECIMAL(18,2) DEFAULT 0.00,
        gross_certified DECIMAL(18,2) DEFAULT 0.00,
        previous_certified DECIMAL(18,2) DEFAULT 0.00,
        current_certified DECIMAL(18,2) DEFAULT 0.00,
        approved_variations_total DECIMAL(18,2) DEFAULT 0.00,
        retention_deducted DECIMAL(18,2) DEFAULT 0.00,
        advance_recovered DECIMAL(18,2) DEFAULT 0.00,
        other_deductions DECIMAL(18,2) DEFAULT 0.00,
        net_amount_due DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        status ENUM('DRAFT','SUBMITTED','CERTIFIED','INVOICED','PAID','DISPUTED') DEFAULT 'DRAFT',
        invoice_id BIGINT UNSIGNED NULL,
        certified_by_client_rep VARCHAR(200) NULL,
        client_cert_date DATE NULL,
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_client_val (company_id, application_no),
        KEY idx_pm_cv_proj (project_id),
        KEY idx_pm_cv_client (client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_client_valuation_lines (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        valuation_id BIGINT UNSIGNED NOT NULL,
        boq_item_id BIGINT UNSIGNED NULL,
        description VARCHAR(255) NOT NULL,
        uom VARCHAR(20) NOT NULL,
        boq_qty DECIMAL(15,4) DEFAULT 0.0000,
        unit_rate DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
        prev_qty DECIMAL(15,4) DEFAULT 0.0000,
        current_qty DECIMAL(15,4) DEFAULT 0.0000,
        cumulative_qty DECIMAL(15,4) DEFAULT 0.0000,
        current_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        PRIMARY KEY (id),
        KEY idx_pm_cvl_val (valuation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11b. Interim Payment Applications (IPAs) & Payment Tracking
    await query(`
      CREATE TABLE IF NOT EXISTS pm_payment_applications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        application_number VARCHAR(50) NOT NULL,
        project_id INT NOT NULL,
        contract_ref VARCHAR(100) NULL,
        client_id BIGINT UNSIGNED NULL,
        client_name VARCHAR(200) NOT NULL,
        contractor_name VARCHAR(200) NOT NULL DEFAULT 'Contractor',
        valuation_id BIGINT UNSIGNED NULL,
        valuation_no VARCHAR(50) NULL,
        application_date DATE NOT NULL,
        period_from DATE NULL,
        period_to DATE NULL,
        due_date DATE NULL,
        payment_terms VARCHAR(100) NULL,
        currency VARCHAR(10) DEFAULT 'GHS',
        application_type ENUM('INTERIM','FINAL') DEFAULT 'INTERIM',
        status ENUM('DRAFT','SUBMITTED','UNDER_REVIEW','CERTIFIED','PARTIALLY_CERTIFIED','REJECTED','PAID') DEFAULT 'DRAFT',
        work_completed_value DECIMAL(18,2) DEFAULT 0.00,
        approved_variations_value DECIMAL(18,2) DEFAULT 0.00,
        materials_on_site_value DECIMAL(18,2) DEFAULT 0.00,
        other_additions_value DECIMAL(18,2) DEFAULT 0.00,
        gross_amount_assessed DECIMAL(18,2) DEFAULT 0.00,
        retention_amount DECIMAL(18,2) DEFAULT 0.00,
        advance_recovery_amount DECIMAL(18,2) DEFAULT 0.00,
        other_deductions_amount DECIMAL(18,2) DEFAULT 0.00,
        previous_certified_amount DECIMAL(18,2) DEFAULT 0.00,
        adjustments_amount DECIMAL(18,2) DEFAULT 0.00,
        net_amount_requested DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        submitted_amount DECIMAL(18,2) DEFAULT 0.00,
        assessed_amount DECIMAL(18,2) DEFAULT 0.00,
        certified_amount DECIMAL(18,2) DEFAULT 0.00,
        rejected_amount DECIMAL(18,2) DEFAULT 0.00,
        adjustment_reason TEXT NULL,
        qs_comments TEXT NULL,
        pm_comments TEXT NULL,
        reviewed_by BIGINT UNSIGNED NULL,
        reviewed_by_name VARCHAR(150) NULL,
        reviewed_at DATETIME NULL,
        certified_by BIGINT UNSIGNED NULL,
        certified_by_name VARCHAR(150) NULL,
        certified_at DATETIME NULL,
        certification_doc_no VARCHAR(100) NULL,
        amount_paid DECIMAL(18,2) DEFAULT 0.00,
        outstanding_balance DECIMAL(18,2) DEFAULT 0.00,
        payment_status ENUM('UNPAID','PARTIALLY_PAID','PAID','OVERDUE') DEFAULT 'UNPAID',
        payment_voucher_ref VARCHAR(100) NULL,
        voucher_id BIGINT UNSIGNED NULL,
        payment_date DATE NULL,
        payment_method VARCHAR(50) NULL,
        finance_notes TEXT NULL,
        attachments JSON NULL,
        approval_history JSON NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_pm_payapp (company_id, application_number),
        KEY idx_pm_pa_proj (project_id),
        KEY idx_pm_pa_val (valuation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. Variations & Change Orders
    await query(`
      CREATE TABLE IF NOT EXISTS pm_variations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        variation_no VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        reason ENUM('CLIENT_REQUEST','SITE_CONDITION','DESIGN_CHANGE','STATUTORY','OMISSION','OTHER') DEFAULT 'CLIENT_REQUEST',
        originator ENUM('CLIENT','CONSULTANT','CONTRACTOR') DEFAULT 'CLIENT',
        drawing_ref VARCHAR(100) NULL,
        rfi_ref VARCHAR(100) NULL,
        boq_item_id BIGINT UNSIGNED NULL,
        cost_impact DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        proposed_selling_price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        schedule_impact_days INT DEFAULT 0,
        status ENUM('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED') DEFAULT 'DRAFT',
        approved_by BIGINT UNSIGNED NULL,
        approved_at DATETIME NULL,
        rejection_reason TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_var_no (company_id, variation_no),
        KEY idx_pm_var_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. Quality Assurance & Quality Control (QA/QC)
    await query(`
      CREATE TABLE IF NOT EXISTS pm_inspection_templates (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(200) NOT NULL,
        trade_discipline VARCHAR(100) NOT NULL,
        checklist_items_json JSON NOT NULL,
        is_active ENUM('Y','N') DEFAULT 'Y',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_inspection_requests (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        request_no VARCHAR(50) NOT NULL,
        template_id BIGINT UNSIGNED NULL,
        trade_discipline VARCHAR(100) NOT NULL,
        location VARCHAR(200) NOT NULL,
        inspection_date DATE NOT NULL,
        inspector_name VARCHAR(200) NULL,
        client_rep_witness VARCHAR(200) NULL,
        results_json JSON NULL,
        status ENUM('REQUESTED','IN_PROGRESS','APPROVED','CONCESSION','REJECTED') DEFAULT 'REQUESTED',
        findings TEXT NULL,
        attachments_json JSON NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_ir_no (company_id, request_no),
        KEY idx_pm_ir_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_ncrs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        ncr_no VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        trade_discipline VARCHAR(100) NOT NULL,
        root_cause TEXT NULL,
        corrective_action TEXT NULL,
        responsible_person VARCHAR(200) NULL,
        due_date DATE NULL,
        rework_cost DECIMAL(18,2) DEFAULT 0.00,
        status ENUM('OPEN','RECTIFIED','VERIFIED_CLOSED','REJECTED') DEFAULT 'OPEN',
        closed_by BIGINT UNSIGNED NULL,
        closed_at DATETIME NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_ncr_no (company_id, ncr_no),
        KEY idx_pm_ncr_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_snag_list (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        item_no INT NOT NULL,
        location VARCHAR(200) NOT NULL,
        defect_description TEXT NOT NULL,
        trade VARCHAR(100) NOT NULL,
        assigned_to VARCHAR(200) NULL,
        status ENUM('OPEN','IN_PROGRESS','COMPLETED') DEFAULT 'OPEN',
        resolved_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_snag_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_material_tests (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        test_type VARCHAR(100) NOT NULL,
        sample_ref VARCHAR(100) NOT NULL,
        test_date DATE NOT NULL,
        element_cast VARCHAR(200) NULL,
        seven_day_strength DECIMAL(8,2) NULL,
        twentyeight_day_strength DECIMAL(8,2) NULL,
        required_strength DECIMAL(8,2) NULL,
        result ENUM('PASS','FAIL','PENDING') DEFAULT 'PENDING',
        lab_name VARCHAR(200) NULL,
        certificate_url VARCHAR(500) NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_mt_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 14. Health, Safety & Environment (HSE)
    await query(`
      CREATE TABLE IF NOT EXISTS pm_safety_incidents (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        incident_no VARCHAR(50) NOT NULL,
        incident_date DATE NOT NULL,
        incident_type ENUM('NEAR_MISS','FIRST_AID','MEDICAL_TREATMENT','LOST_TIME_INJURY','FATALITY','DANGEROUS_OCCURRENCE','ENVIRONMENTAL') DEFAULT 'NEAR_MISS',
        severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'LOW',
        location VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        persons_involved TEXT NULL,
        lost_workdays INT DEFAULT 0,
        immediate_action_taken TEXT NULL,
        investigation_findings TEXT NULL,
        corrective_actions TEXT NULL,
        status ENUM('REPORTED','UNDER_INVESTIGATION','ACTION_REQUIRED','CLOSED') DEFAULT 'REPORTED',
        reported_by VARCHAR(200) NOT NULL,
        closed_by BIGINT UNSIGNED NULL,
        closed_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_inc_no (company_id, incident_no),
        KEY idx_pm_si_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_toolbox_talks (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        talk_date DATE NOT NULL,
        topic VARCHAR(255) NOT NULL,
        delivered_by VARCHAR(200) NOT NULL,
        attendees_count INT DEFAULT 0,
        summary_points TEXT NULL,
        attendees_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_tbt_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 15. Technical Documents, Drawings & RFIs
    await query(`
      CREATE TABLE IF NOT EXISTS pm_documents (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        doc_category ENUM('ARCHITECTURAL','STRUCTURAL','CIVIL','MEP','SPECIFICATION','CONTRACT','AS_BUILT','OTHER') DEFAULT 'ARCHITECTURAL',
        doc_number VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        current_revision VARCHAR(20) DEFAULT 'Rev 0',
        status ENUM('FOR_REVIEW','APPROVED_FOR_CONSTRUCTION','FOR_INFORMATION','SUPERSEDED') DEFAULT 'APPROVED_FOR_CONSTRUCTION',
        file_url VARCHAR(500) NOT NULL,
        uploaded_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_doc_no (company_id, project_id, doc_number),
        KEY idx_pm_doc_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_document_revisions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        document_id BIGINT UNSIGNED NOT NULL,
        revision_no VARCHAR(20) NOT NULL,
        revision_date DATE NOT NULL,
        change_description TEXT NULL,
        file_url VARCHAR(500) NOT NULL,
        uploaded_by VARCHAR(200) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_doc_rev (document_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pm_rfis (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        rfi_no VARCHAR(50) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        question TEXT NOT NULL,
        drawing_ref VARCHAR(100) NULL,
        assigned_to VARCHAR(200) NOT NULL,
        date_issued DATE NOT NULL,
        due_date DATE NULL,
        response TEXT NULL,
        responded_by VARCHAR(200) NULL,
        response_date DATE NULL,
        has_cost_impact TINYINT(1) DEFAULT 0,
        has_schedule_impact TINYINT(1) DEFAULT 0,
        status ENUM('OPEN','ANSWERED','CLOSED') DEFAULT 'OPEN',
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_rfi_no (company_id, rfi_no),
        KEY idx_pm_rfi_proj (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 16. Plant & Equipment Daily Logs
    await query(`
      CREATE TABLE IF NOT EXISTS pm_equipment_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        project_id INT NOT NULL,
        equipment_id INT NOT NULL,
        equipment_name VARCHAR(200) NOT NULL,
        log_date DATE NOT NULL,
        start_hours DECIMAL(10,2) DEFAULT 0.00,
        end_hours DECIMAL(10,2) DEFAULT 0.00,
        operating_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        idle_hours DECIMAL(8,2) DEFAULT 0.00,
        breakdown_hours DECIMAL(8,2) DEFAULT 0.00,
        fuel_litres DECIMAL(8,2) DEFAULT 0.00,
        hourly_cost_rate DECIMAL(15,2) DEFAULT 0.00,
        total_cost DECIMAL(18,2) DEFAULT 0.00,
        operator_name VARCHAR(200) NULL,
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pm_eql_proj (project_id),
        KEY idx_pm_eql_eq (equipment_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Schema compatibility alterations for daily reports and equipment logs
    const schemaCompatibilityAlts = [
      ["pm_daily_site_reports", "ADD COLUMN report_number VARCHAR(50) NULL AFTER report_no"],
      ["pm_daily_site_reports", "ADD COLUMN site_engineer_name VARCHAR(200) NULL AFTER shift"],
      ["pm_daily_site_reports", "ADD COLUMN weather_morning VARCHAR(50) DEFAULT 'SUNNY' AFTER weather"],
      ["pm_daily_site_reports", "ADD COLUMN weather_afternoon VARCHAR(50) DEFAULT 'SUNNY' AFTER weather_morning"],
      ["pm_daily_site_reports", "ADD COLUMN working_hours_from VARCHAR(20) DEFAULT '08:00:00' AFTER site_condition"],
      ["pm_daily_site_reports", "ADD COLUMN working_hours_to VARCHAR(20) DEFAULT '17:00:00' AFTER working_hours_from"],
      ["pm_daily_site_reports", "ADD COLUMN general_remarks TEXT NULL AFTER supervisor_comments"],
      ["pm_daily_site_reports", "ADD COLUMN safety_observations TEXT NULL AFTER general_remarks"],
      ["pm_daily_site_reports", "ADD COLUMN prepared_by BIGINT UNSIGNED NULL AFTER created_by"],
      ["pm_daily_site_reports", "MODIFY COLUMN reporting_officer_name VARCHAR(200) NULL"],
      ["pm_daily_site_reports", "DROP INDEX uq_site_rep"],

      ["pm_daily_site_activities", "ADD COLUMN location_grid VARCHAR(200) NULL AFTER location"],
      ["pm_daily_site_activities", "ADD COLUMN description TEXT NULL AFTER location_grid"],
      ["pm_daily_site_activities", "ADD COLUMN quantity_completed DECIMAL(15,4) DEFAULT 0.00 AFTER measured_qty_completed"],
      ["pm_daily_site_activities", "ADD COLUMN unit VARCHAR(50) NULL AFTER uom"],
      ["pm_daily_site_activities", "MODIFY COLUMN activity_name VARCHAR(255) NULL"],
      ["pm_daily_site_activities", "MODIFY COLUMN project_id INT NULL"],

      ["pm_daily_site_workforce", "ADD COLUMN trade_name VARCHAR(200) NULL AFTER trade_category"],

      ["pm_daily_site_equipment", "ADD COLUMN equipment_tag VARCHAR(100) NULL AFTER equipment_name"],
      ["pm_daily_site_equipment", "ADD COLUMN hours_worked DECIMAL(6,2) DEFAULT 0.00 AFTER asset_no"],
      ["pm_daily_site_equipment", "ADD COLUMN hours_idle DECIMAL(6,2) DEFAULT 0.00 AFTER hours_worked"],
      ["pm_daily_site_equipment", "ADD COLUMN hours_breakdown DECIMAL(6,2) DEFAULT 0.00 AFTER hours_idle"],
      ["pm_daily_site_equipment", "ADD COLUMN remarks TEXT NULL AFTER operator_name"],

      ["pm_daily_site_materials", "ADD COLUMN material_name VARCHAR(255) NULL AFTER item_name"],
      ["pm_daily_site_materials", "ADD COLUMN quantity DECIMAL(15,4) DEFAULT 0.00 AFTER qty_consumed"],
      ["pm_daily_site_materials", "ADD COLUMN unit VARCHAR(50) NULL AFTER uom"],
      ["pm_daily_site_materials", "ADD COLUMN supplier_name VARCHAR(255) NULL AFTER unit"],
      ["pm_daily_site_materials", "ADD COLUMN delivery_note_no VARCHAR(100) NULL AFTER supplier_name"],
      ["pm_daily_site_materials", "ADD COLUMN remarks TEXT NULL AFTER delivery_note_no"],
      ["pm_daily_site_materials", "MODIFY COLUMN item_name VARCHAR(255) NULL"],

      ["pm_equipment_logs", "ADD COLUMN hours_worked DECIMAL(8,2) DEFAULT 0.00 AFTER operating_hours"],
      ["pm_equipment_logs", "ADD COLUMN hours_idle DECIMAL(8,2) DEFAULT 0.00 AFTER hours_worked"],
      ["pm_equipment_logs", "ADD COLUMN hours_breakdown DECIMAL(8,2) DEFAULT 0.00 AFTER hours_idle"],
      ["pm_equipment_logs", "ADD COLUMN fuel_consumed_litres DECIMAL(8,2) DEFAULT 0.00 AFTER fuel_litres"],
      ["pm_equipment_logs", "ADD COLUMN hourly_rate DECIMAL(15,2) DEFAULT 0.00 AFTER hourly_cost_rate"],
      ["pm_equipment_logs", "ADD COLUMN logged_by BIGINT UNSIGNED NULL AFTER created_by"],
      ["pm_equipment_logs", "MODIFY COLUMN equipment_name VARCHAR(200) NULL"],

      ["pm_eot_requests", "ADD COLUMN request_number VARCHAR(50) NULL AFTER request_no"],
      ["pm_eot_requests", "ADD COLUMN delay_cause VARCHAR(255) NULL AFTER reason"],
      ["pm_eot_requests", "ADD COLUMN financial_claim_amount DECIMAL(18,2) DEFAULT 0.00 AFTER days_requested"],
      ["pm_eot_requests", "ADD COLUMN requested_date DATE NULL AFTER delay_category"],
      ["pm_eot_requests", "ADD COLUMN justification TEXT NULL AFTER impact_assessment"],

      ["pm_safety_incidents", "MODIFY COLUMN branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1"],
      ["pm_safety_incidents", "MODIFY COLUMN incident_no VARCHAR(50) NOT NULL DEFAULT ''"],
      ["pm_safety_incidents", "MODIFY COLUMN location VARCHAR(200) NOT NULL DEFAULT 'Site'"],
      ["pm_safety_incidents", "MODIFY COLUMN reported_by VARCHAR(200) NOT NULL DEFAULT 'Safety Officer'"],
      ["pm_safety_incidents", "MODIFY COLUMN incident_type ENUM('NEAR_MISS','FIRST_AID','MEDICAL_TREATMENT','LOST_TIME_INJURY','LOST_TIME','FATALITY','DANGEROUS_OCCURRENCE','ENVIRONMENTAL') DEFAULT 'NEAR_MISS'"],
      ["pm_safety_incidents", "ADD COLUMN injured_person_name VARCHAR(200) NULL AFTER persons_involved"],
      ["pm_safety_incidents", "ADD COLUMN days_lost INT DEFAULT 0 AFTER lost_workdays"],
      ["pm_safety_incidents", "ADD COLUMN root_cause TEXT NULL AFTER immediate_action_taken"],
      ["pm_safety_incidents", "ADD COLUMN corrective_action TEXT NULL AFTER corrective_actions"],
      ["pm_safety_incidents", "ADD COLUMN reported_to_authority VARCHAR(10) DEFAULT 'N' AFTER status"],

      ["pm_toolbox_talks", "MODIFY COLUMN branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1"],
      ["pm_toolbox_talks", "MODIFY COLUMN delivered_by VARCHAR(200) NOT NULL DEFAULT 'Safety Officer'"],
      ["pm_toolbox_talks", "ADD COLUMN conductor_name VARCHAR(200) NULL AFTER delivered_by"],
      ["pm_toolbox_talks", "ADD COLUMN attendee_count INT DEFAULT 0 AFTER attendees_count"],
      ["pm_toolbox_talks", "ADD COLUMN notes TEXT NULL AFTER summary_points"],

      ["pm_rfis", "ADD COLUMN file_url VARCHAR(500) NULL AFTER drawing_ref"],
      ["pm_rfis", "ADD COLUMN attachments_json JSON NULL AFTER file_url"],
      ["pm_rfis", "ADD COLUMN rfi_number VARCHAR(50) NULL AFTER rfi_no"],
      ["pm_rfis", "ADD COLUMN drawing_reference VARCHAR(200) NULL AFTER drawing_ref"],
      ["pm_rfis", "ADD COLUMN cost_impact VARCHAR(10) DEFAULT 'N' AFTER has_cost_impact"],
      ["pm_rfis", "ADD COLUMN schedule_impact VARCHAR(10) DEFAULT 'N' AFTER has_schedule_impact"],
      ["pm_rfis", "ADD COLUMN answer TEXT NULL AFTER response"],
      ["pm_rfis", "ADD COLUMN answered_by BIGINT UNSIGNED NULL AFTER response_date"],
      ["pm_rfis", "ADD COLUMN answered_date DATE NULL AFTER answered_by"],
      ["pm_rfis", "ADD COLUMN date_raised DATE NULL AFTER date_issued"],
      ["pm_rfis", "ADD COLUMN raised_by BIGINT UNSIGNED NULL AFTER created_by"],
      ["pm_rfis", "MODIFY COLUMN branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1"],
      ["pm_rfis", "MODIFY COLUMN rfi_no VARCHAR(50) NOT NULL DEFAULT ''"],

      ["pm_documents", "MODIFY COLUMN file_url VARCHAR(500) NULL"],
      ["pm_documents", "MODIFY COLUMN doc_category VARCHAR(100) NULL DEFAULT 'ARCHITECTURAL'"],
      ["pm_documents", "ADD COLUMN category VARCHAR(100) NULL AFTER doc_category"],
      ["pm_documents", "MODIFY COLUMN current_revision VARCHAR(50) NULL DEFAULT '0'"],
      ["pm_documents", "MODIFY COLUMN status VARCHAR(50) NULL DEFAULT 'APPROVED_FOR_CONSTRUCTION'"],
      ["pm_documents", "MODIFY COLUMN doc_number VARCHAR(100) NOT NULL DEFAULT ''"],
      ["pm_documents", "ADD COLUMN attachments_json JSON NULL AFTER file_url"],
      ["pm_documents", "ADD COLUMN document_number VARCHAR(100) NULL AFTER doc_number"],
      ["pm_documents", "ADD COLUMN discipline VARCHAR(100) NULL AFTER doc_category"],

      ["pm_client_valuations", "MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'"],
      ["pm_client_valuations", "ADD COLUMN forwarded_to_username VARCHAR(150) NULL AFTER status"],
      ["pm_variations", "ADD COLUMN forwarded_to_username VARCHAR(150) NULL AFTER status"]
    ];

    for (const [tbl, sql] of schemaCompatibilityAlts) {
      try {
        await query(`ALTER TABLE ${tbl} ${sql}`);
      } catch (e) {
        // Safe to ignore duplicate column / index not found
      }
    }

    console.log("[Construction] Schema migrations verified and completed successfully.");
  } catch (err) {
    console.error("[Construction] Error in ensureConstructionTables:", err);
  }
}
