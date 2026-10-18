import { pool } from "../db/pool.js";

/**
 * Ensures complete database schema for Fixed Asset Management:
 * 1. ast_asset_categories: Asset classes, depreciation policies, and default GL accounts
 * 2. ast_assets: Master Fixed Asset Register with acquisition cost, NBV, and custody
 * 3. ast_depreciation_runs: Monthly batch run records
 * 4. ast_depreciation_run_items: Line-by-line asset depreciation calculations
 * 5. ast_asset_transfers: Location & custodian movement history
 * 6. ast_asset_disposals: Asset sales, write-offs, scrapings, and gain/loss tracking
 */
export async function ensureAssetManagementTables() {
  try {
    // 1. Asset Categories
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ast_asset_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        category_code VARCHAR(50) NOT NULL,
        category_name VARCHAR(150) NOT NULL,
        depreciation_method ENUM('STRAIGHT_LINE', 'REDUCING_BALANCE', 'DOUBLE_DECLINING', 'NONE') DEFAULT 'STRAIGHT_LINE',
        useful_life_years DECIMAL(6,2) DEFAULT 5.00,
        depreciation_rate_pct DECIMAL(6,2) DEFAULT 20.00,
        asset_cost_account_id INT NULL,
        accum_depreciation_account_id INT NULL,
        depreciation_expense_account_id INT NULL,
        gain_loss_account_id INT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ast_cat_co (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure depreciation_frequency column supports YEARLY, HALF_YEARLY, QUARTERLY, MONTHLY
    try {
      await pool.query("ALTER TABLE ast_asset_categories MODIFY COLUMN depreciation_frequency ENUM('YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY') DEFAULT 'YEARLY'");
    } catch (e) {
      // Ignored
    }

    // 2. Master Fixed Asset Register
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ast_assets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT NOT NULL DEFAULT 1,
        asset_code VARCHAR(50) NOT NULL,
        asset_name VARCHAR(200) NOT NULL,
        category_id INT NOT NULL,
        property_id INT NULL,
        building_id INT NULL,
        space_id INT NULL,
        location VARCHAR(200) NULL,
        department_id INT NULL,
        custodian_id INT NULL,
        custodian_name VARCHAR(150) NULL,
        serial_number VARCHAR(100) NULL,
        barcode VARCHAR(100) NULL,
        make VARCHAR(100) NULL,
        model VARCHAR(100) NULL,
        purchase_date DATE NULL,
        capitalization_date DATE NOT NULL,
        purchase_cost DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        salvage_value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        current_nbv DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        accumulated_depreciation DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        depreciation_method ENUM('STRAIGHT_LINE', 'REDUCING_BALANCE', 'DOUBLE_DECLINING', 'NONE') DEFAULT 'STRAIGHT_LINE',
        useful_life_years DECIMAL(6,2) DEFAULT 5.00,
        depreciation_rate_pct DECIMAL(6,2) DEFAULT 20.00,
        warranty_expiry_date DATE NULL,
        status ENUM('ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED', 'WRITTEN_OFF', 'UNDER_MAINTENANCE') DEFAULT 'ACTIVE',
        notes TEXT NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ast_co_br (company_id, branch_id),
        INDEX idx_ast_code (asset_code),
        INDEX idx_ast_cat (category_id),
        INDEX idx_ast_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      await pool.query("ALTER TABLE ast_assets MODIFY COLUMN depreciation_frequency ENUM('YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY') DEFAULT 'YEARLY'");
    } catch (e) {
      // Ignored
    }

    // 3. Depreciation Runs (Batch calculations)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ast_depreciation_runs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT NOT NULL DEFAULT 1,
        run_no VARCHAR(50) NOT NULL,
        run_date DATE NOT NULL,
        period_year INT NOT NULL,
        period_month INT NOT NULL,
        total_depreciation DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        assets_count INT NOT NULL DEFAULT 0,
        voucher_id INT NULL,
        status ENUM('DRAFT', 'POSTED', 'REVERSED') DEFAULT 'POSTED',
        notes TEXT NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ast_run_co (company_id, period_year, period_month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Depreciation Run Items (Line-by-line asset breakdown)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ast_depreciation_run_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        run_id INT NOT NULL,
        asset_id INT NOT NULL,
        asset_code VARCHAR(50) NOT NULL,
        asset_name VARCHAR(200) NOT NULL,
        cost_basis DECIMAL(15,2) NOT NULL,
        prior_accum_depreciation DECIMAL(15,2) NOT NULL,
        depreciation_amount DECIMAL(15,2) NOT NULL,
        new_accum_depreciation DECIMAL(15,2) NOT NULL,
        new_nbv DECIMAL(15,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ast_run_item_run (run_id),
        INDEX idx_ast_run_item_asset (asset_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Asset Transfers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ast_asset_transfers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        transfer_no VARCHAR(50) NOT NULL,
        asset_id INT NOT NULL,
        transfer_date DATE NOT NULL,
        from_branch_id INT NULL,
        to_branch_id INT NULL,
        from_property_id INT NULL,
        to_property_id INT NULL,
        from_space_id INT NULL,
        to_space_id INT NULL,
        from_location VARCHAR(200) NULL,
        to_location VARCHAR(200) NULL,
        from_custodian_name VARCHAR(150) NULL,
        to_custodian_name VARCHAR(150) NULL,
        reason TEXT NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ast_tr_asset (asset_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Asset Disposals
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ast_asset_disposals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        disposal_no VARCHAR(50) NOT NULL,
        asset_id INT NOT NULL,
        disposal_date DATE NOT NULL,
        disposal_type ENUM('SALE', 'SCRAP', 'WRITE_OFF', 'DONATION') DEFAULT 'SALE',
        sale_proceeds DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        cost_at_disposal DECIMAL(15,2) NOT NULL,
        accum_dep_at_disposal DECIMAL(15,2) NOT NULL,
        nbv_at_disposal DECIMAL(15,2) NOT NULL,
        gain_loss DECIMAL(15,2) NOT NULL,
        buyer_name VARCHAR(150) NULL,
        reason TEXT NULL,
        voucher_id INT NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ast_disp_asset (asset_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. Asset Revaluations & Value Adjustments (Upward Revaluation / Impairment)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ast_asset_revaluations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        branch_id INT NOT NULL DEFAULT 1,
        revaluation_no VARCHAR(50) NOT NULL,
        asset_id INT NOT NULL,
        revaluation_date DATE NOT NULL,
        revaluation_type ENUM('INCREASE', 'DECREASE', 'IMPAIRMENT') DEFAULT 'INCREASE',
        previous_cost DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        new_cost DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        previous_nbv DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        new_nbv DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        adjustment_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        valuation_reason VARCHAR(255) NULL,
        valuer_name VARCHAR(150) NULL,
        valuation_report_ref VARCHAR(100) NULL,
        voucher_id INT NULL,
        notes TEXT NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ast_rev_asset (asset_id),
        INDEX idx_ast_rev_co (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. Manufacturers / Brands
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ast_manufacturers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50) NULL,
        country VARCHAR(100) NULL,
        support_contact VARCHAR(150) NULL,
        website VARCHAR(200) NULL,
        notes TEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ast_mfg_co (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed standard manufacturers if none exist
    const [existingMfgs] = await pool.query("SELECT COUNT(*) AS c FROM ast_manufacturers");
    if (existingMfgs[0].c === 0) {
      await pool.query(`
        INSERT INTO ast_manufacturers (company_id, name, code, country)
        VALUES 
          (1, 'Caterpillar', 'CAT', 'USA'),
          (1, 'Dell Technologies', 'DELL', 'USA'),
          (1, 'HP Inc.', 'HP', 'USA'),
          (1, 'Toyota Industries', 'TOYOTA', 'Japan'),
          (1, 'Siemens AG', 'SIEMENS', 'Germany'),
          (1, 'Schneider Electric', 'SCHNEIDER', 'France'),
          (1, 'Daikin Industries', 'DAIKIN', 'Japan'),
          (1, 'Cisco Systems', 'CISCO', 'USA'),
          (1, 'Apple Inc.', 'APPLE', 'USA')
      `);
      console.log("[Asset Management] Seeded standard manufacturers/brands");
    }

    // 9. Properties / Facility Sites
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ast_properties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        property_code VARCHAR(50) NOT NULL,
        property_name VARCHAR(150) NOT NULL,
        property_type VARCHAR(100) DEFAULT 'SITE',
        address VARCHAR(255) NULL,
        city VARCHAR(100) NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ast_prop_co (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [existingProps] = await pool.query("SELECT COUNT(*) AS c FROM ast_properties");
    if (existingProps[0].c === 0) {
      await pool.query(`
        INSERT INTO ast_properties (company_id, property_code, property_name, property_type, city)
        VALUES 
          (1, 'HQ-SITE', 'Corporate Headquarters', 'OFFICE', 'Accra'),
          (1, 'PLANT-01', 'Main Industrial Plant & Warehouse', 'FACILITY', 'Tema'),
          (1, 'SITE-WEST', 'Regional Operations Centre', 'BRANCH', 'Takoradi')
      `);
      console.log("[Asset Management] Seeded standard property/facility sites");
    }

    // 10. Asset Tagging Nomenclature Rules
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ast_tag_nomenclature (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        prefix VARCHAR(20) DEFAULT 'AST',
        include_category TINYINT(1) DEFAULT 1,
        include_site TINYINT(1) DEFAULT 0,
        include_year TINYINT(1) DEFAULT 1,
        seq_digits INT DEFAULT 4,
        separator_char VARCHAR(5) DEFAULT '-',
        current_sequence INT DEFAULT 1,
        sample_format VARCHAR(100) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unq_ast_tag_co (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [existingTagRules] = await pool.query("SELECT COUNT(*) AS c FROM ast_tag_nomenclature");
    if (existingTagRules[0].c === 0) {
      await pool.query(`
        INSERT INTO ast_tag_nomenclature (company_id, prefix, include_category, include_site, include_year, seq_digits, separator_char, current_sequence, sample_format)
        VALUES (1, 'AST', 1, 0, 1, 4, '-', 1, 'AST-CAT-2026-0001')
      `);
      console.log("[Asset Management] Seeded asset tag nomenclature settings");
    }

    // Seed initial categories if none exist
    const [existingCats] = await pool.query("SELECT COUNT(*) AS c FROM ast_asset_categories");
    if (existingCats[0].c === 0) {
      await pool.query(`
        INSERT INTO ast_asset_categories 
          (company_id, category_code, category_name, depreciation_method, useful_life_years, depreciation_rate_pct)
        VALUES 
          (1, 'LAND_BLDG', 'Land & Buildings', 'STRAIGHT_LINE', 25.00, 4.00),
          (1, 'PLANT_MACH', 'Plant & Machinery', 'STRAIGHT_LINE', 10.00, 10.00),
          (1, 'VEHICLES', 'Motor Vehicles', 'REDUCING_BALANCE', 5.00, 20.00),
          (1, 'IT_COMP', 'Computer & IT Equipment', 'STRAIGHT_LINE', 3.00, 33.33),
          (1, 'FURN_FIXT', 'Office Furniture & Fixtures', 'STRAIGHT_LINE', 8.00, 12.50)
      `);
      console.log("[Asset Management] Seeded standard fixed asset categories");
    }

    // 7. Ensure standard automated GL accounts exist and link to categories
    try {
      // 7a. Ensure Accumulated Depreciation account (Code 1099, Contra-Asset, Credit)
      const [accumRows] = await pool.query(
        "SELECT id FROM fin_accounts WHERE name LIKE '%Accumulated Depreciation%' OR code = '1099' LIMIT 1"
      );
      let accumAccountId = accumRows[0]?.id;
      if (!accumAccountId) {
        const [insAccum] = await pool.query(`
          INSERT INTO fin_accounts (company_id, group_id, code, name, balance_type, is_control_account, is_postable, is_active)
          VALUES (1, 27, '1099', 'Accumulated Depreciation', 'CREDIT', 0, 1, 1)
        `);
        accumAccountId = insAccum.insertId;
        console.log("[Asset Management] Created automated GL account: 1099 Accumulated Depreciation");
      }

      // 7b. Ensure Gain/Loss on Asset Disposal account (Code 4016, Income, Credit)
      const [gainLossRows] = await pool.query(
        "SELECT id FROM fin_accounts WHERE name LIKE '%Gain/Loss on Asset Disposal%' OR code = '4016' LIMIT 1"
      );
      let gainLossAccountId = gainLossRows[0]?.id;
      if (!gainLossAccountId) {
        const [insGl] = await pool.query(`
          INSERT INTO fin_accounts (company_id, group_id, code, name, balance_type, is_control_account, is_postable, is_active)
          VALUES (1, 13, '4016', 'Gain/Loss on Asset Disposal', 'CREDIT', 0, 1, 1)
        `);
        gainLossAccountId = insGl.insertId;
        console.log("[Asset Management] Created automated GL account: 4016 Gain/Loss on Asset Disposal");
      }

      // 7c. Find Depreciation Expense account (Code 5024)
      const [expRows] = await pool.query(
        "SELECT id FROM fin_accounts WHERE code = '5024' OR name LIKE '%Depreciation Expense%' LIMIT 1"
      );
      const expenseAccountId = expRows[0]?.id || 47;

      // 7d. Link standard automated accounts to categories where unset
      const [landBldg] = await pool.query("SELECT id FROM fin_accounts WHERE code = '1030' LIMIT 1");
      const [plantMach] = await pool.query("SELECT id FROM fin_accounts WHERE code = '1031' LIMIT 1");
      const [officeEqp] = await pool.query("SELECT id FROM fin_accounts WHERE code = '1032' OR code = '1030' LIMIT 1");

      const landAccId = landBldg[0]?.id || 12;
      const plantAccId = plantMach[0]?.id || 13;
      const officeAccId = officeEqp[0]?.id || plantAccId;

      await pool.query(`
        UPDATE ast_asset_categories
        SET 
          accum_depreciation_account_id = COALESCE(accum_depreciation_account_id, ?),
          depreciation_expense_account_id = COALESCE(depreciation_expense_account_id, ?),
          gain_loss_account_id = COALESCE(gain_loss_account_id, ?),
          asset_cost_account_id = CASE 
            WHEN asset_cost_account_id IS NOT NULL THEN asset_cost_account_id
            WHEN category_code = 'LAND_BLDG' THEN ?
            WHEN category_code = 'PLANT_MACH' THEN ?
            ELSE ?
          END
        WHERE accum_depreciation_account_id IS NULL OR asset_cost_account_id IS NULL OR depreciation_expense_account_id IS NULL
      `, [accumAccountId, expenseAccountId, gainLossAccountId, landAccId, plantAccId, officeAccId]);
    } catch (coaErr) {
      console.warn("[Asset Management] GL default accounts note:", coaErr.message);
    }

    console.log("[Asset Management] Ensured all fixed asset tables successfully.");
  } catch (err) {
    console.error("[Asset Management] Error ensuring tables:", err.message);
  }
}
