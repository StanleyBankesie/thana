import { pool } from "../db/pool.js";

/**
 * Helper to safely check and add columns if they don't already exist.
 */
async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
      console.log(`[Finance Migration] Added column ${columnName} to ${tableName}`);
    }
  } catch (err) {
    console.warn(`[Finance Migration] Could not add ${columnName} to ${tableName}:`, err.message);
  }
}

/**
 * Ensures comprehensive database schema for Finance Module Budget Management:
 * - fin_budgets: Master header with approval workflow, versioning, and project/dept dimensions
 * - fin_budget_lines: Line-item allocations with account, project, department, cost center, unit cost, and periodic distribution
 * - fin_budget_revisions: Historical revision audit log with snapshots
 * - fin_budget_variances: Variance explanations, corrective action plans, and resolution tracking
 * - fin_budget_controls: Company policy thresholds (WARN_ONLY, REQUIRE_APPROVAL, BLOCK)
 * - fin_budget_forecasts: Forecast final cost estimates and adjustments
 */
export async function ensureFinanceBudgetTables() {
  try {
    // 1. Master Budget Header Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fin_budgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT NULL,
        fiscal_year_id INT NOT NULL,
        budget_code VARCHAR(50) NOT NULL,
        budget_name VARCHAR(150) NOT NULL,
        cost_center_id INT NULL,
        department_id INT NULL,
        project_id INT NULL,
        currency_id INT NULL,
        budget_type ENUM('OPEX', 'CAPEX', 'PROJECT', 'DEPARTMENTAL', 'REVENUE', 'OTHER') DEFAULT 'OPEX',
        version VARCHAR(20) DEFAULT '1.0',
        revision_no INT DEFAULT 0,
        start_date DATE NULL,
        end_date DATE NULL,
        description TEXT NULL,
        notes TEXT NULL,
        total_budget DECIMAL(18,4) DEFAULT 0.0000,
        status ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CLOSED', 'ACTIVE') DEFAULT 'DRAFT',
        rejection_reason TEXT NULL,
        created_by INT NULL,
        submitted_by INT NULL,
        submitted_at DATETIME NULL,
        approved_by INT NULL,
        approved_at DATETIME NULL,
        rejected_by INT NULL,
        rejected_at DATETIME NULL,
        closed_by INT NULL,
        closed_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_fin_bud_comp (company_id, fiscal_year_id),
        INDEX idx_fin_bud_proj (project_id),
        INDEX idx_fin_bud_dept (department_id),
        INDEX idx_fin_bud_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure columns in fin_budgets if table existed previously with simpler schema
    await addColumnIfNotExists("fin_budgets", "department_id", "INT NULL");
    await addColumnIfNotExists("fin_budgets", "project_id", "INT NULL");
    await addColumnIfNotExists("fin_budgets", "budget_type", "ENUM('OPEX', 'CAPEX', 'PROJECT', 'DEPARTMENTAL', 'REVENUE', 'OTHER') DEFAULT 'OPEX'");
    await addColumnIfNotExists("fin_budgets", "version", "VARCHAR(20) DEFAULT '1.0'");
    await addColumnIfNotExists("fin_budgets", "revision_no", "INT DEFAULT 0");
    await addColumnIfNotExists("fin_budgets", "start_date", "DATE NULL");
    await addColumnIfNotExists("fin_budgets", "end_date", "DATE NULL");
    await addColumnIfNotExists("fin_budgets", "notes", "TEXT NULL");
    await addColumnIfNotExists("fin_budgets", "rejection_reason", "TEXT NULL");
    await addColumnIfNotExists("fin_budgets", "submitted_by", "INT NULL");
    await addColumnIfNotExists("fin_budgets", "submitted_at", "DATETIME NULL");
    await addColumnIfNotExists("fin_budgets", "approved_at", "DATETIME NULL");
    await addColumnIfNotExists("fin_budgets", "rejected_by", "INT NULL");
    await addColumnIfNotExists("fin_budgets", "rejected_at", "DATETIME NULL");
    await addColumnIfNotExists("fin_budgets", "closed_by", "INT NULL");
    await addColumnIfNotExists("fin_budgets", "closed_at", "DATETIME NULL");

    // Ensure status enum allows all workflow states
    try {
      await pool.query(`
        ALTER TABLE fin_budgets MODIFY COLUMN status 
        ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CLOSED', 'ACTIVE') DEFAULT 'DRAFT'
      `);
    } catch (e) {
      // Ignore if already altered
    }

    // 2. Budget Lines Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fin_budget_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        budget_id INT NOT NULL,
        account_id INT NOT NULL,
        cost_center_id INT NULL,
        project_id INT NULL,
        department_id INT NULL,
        period_month INT NULL,
        description VARCHAR(255) NULL,
        planned_quantity DECIMAL(14,4) DEFAULT 0.0000,
        unit_cost DECIMAL(18,4) DEFAULT 0.0000,
        budget_amount DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
        notes VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_fin_bud_line (budget_id, account_id),
        INDEX idx_fin_bud_line_proj (project_id),
        INDEX idx_fin_bud_line_dept (department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure columns in fin_budget_lines
    await addColumnIfNotExists("fin_budget_lines", "project_id", "INT NULL");
    await addColumnIfNotExists("fin_budget_lines", "department_id", "INT NULL");
    await addColumnIfNotExists("fin_budget_lines", "description", "VARCHAR(255) NULL");
    await addColumnIfNotExists("fin_budget_lines", "planned_quantity", "DECIMAL(14,4) DEFAULT 0.0000");
    await addColumnIfNotExists("fin_budget_lines", "unit_cost", "DECIMAL(18,4) DEFAULT 0.0000");

    // 3. Historical Revisions Log
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fin_budget_revisions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        budget_id INT NOT NULL,
        revision_no INT NOT NULL,
        revised_by INT NULL,
        revision_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        previous_total DECIMAL(18,4) NOT NULL,
        new_total DECIMAL(18,4) NOT NULL,
        reason TEXT NULL,
        snapshot_data LONGTEXT NULL,
        INDEX idx_fbr_budget (budget_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Variance Explanations & Corrective Actions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fin_budget_variances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        budget_id INT NOT NULL,
        account_id INT NULL,
        project_id INT NULL,
        period_month INT NULL,
        variance_amount DECIMAL(18,4) DEFAULT 0.0000,
        explanation TEXT NOT NULL,
        corrective_action TEXT NULL,
        action_owner_id INT NULL,
        status ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED') DEFAULT 'PENDING',
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fbv_budget (budget_id),
        INDEX idx_fbv_comp (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Budget Control Settings & Thresholds
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fin_budget_controls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        policy_type ENUM('WARN_ONLY', 'REQUIRE_APPROVAL', 'BLOCK') DEFAULT 'WARN_ONLY',
        warning_threshold_pct DECIMAL(5,2) DEFAULT 85.00,
        block_threshold_pct DECIMAL(5,2) DEFAULT 100.00,
        applies_to_po BOOLEAN DEFAULT TRUE,
        applies_to_expense BOOLEAN DEFAULT TRUE,
        applies_to_vouchers BOOLEAN DEFAULT TRUE,
        updated_by INT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_fbc_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Forecast Cost Adjustments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fin_budget_forecasts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        budget_id INT NOT NULL,
        account_id INT NULL,
        project_id INT NULL,
        forecast_cost DECIMAL(18,4) DEFAULT 0.0000,
        method VARCHAR(50) DEFAULT 'MANUAL',
        notes TEXT NULL,
        updated_by INT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_fbf_budget (budget_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("[Finance] Complete Budget Management schema verified successfully.");
  } catch (err) {
    console.error("[Finance] Error ensuring budget tables:", err.message);
  }
}
