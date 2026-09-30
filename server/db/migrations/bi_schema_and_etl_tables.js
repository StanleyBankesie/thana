import { query } from "../pool.js";

export async function runBiSchemaMigration() {
  console.log("Running comprehensive BI & ETL Schema migration...");

  // 1. Data Sources Table
  await query(`
    CREATE TABLE IF NOT EXISTS bi_data_sources (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      name VARCHAR(150) NOT NULL,
      source_type ENUM('ERP', 'EXCEL', 'CSV', 'JSON', 'REST_API', 'DATABASE') NOT NULL DEFAULT 'ERP',
      erp_module VARCHAR(50) NULL,
      status ENUM('CONNECTED', 'DISCONNECTED', 'SYNCING', 'ERROR') NOT NULL DEFAULT 'CONNECTED',
      connection_config JSON NULL,
      last_sync_at DATETIME NULL,
      last_sync_status ENUM('SUCCESS', 'FAILED', 'PARTIAL') NULL,
      sync_frequency ENUM('MANUAL', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY') NOT NULL DEFAULT 'DAILY',
      cron_expression VARCHAR(50) NULL,
      total_records INT DEFAULT 0,
      checkpoint_field VARCHAR(50) DEFAULT 'updated_at',
      last_checkpoint_value VARCHAR(100) NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bi_ds_company (company_id, source_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Data Source Sync Logs
  await query(`
    CREATE TABLE IF NOT EXISTS bi_data_source_sync_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      data_source_id INT NOT NULL,
      sync_type ENUM('FULL', 'INCREMENTAL') NOT NULL DEFAULT 'INCREMENTAL',
      status ENUM('RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'RUNNING',
      records_extracted INT DEFAULT 0,
      records_loaded INT DEFAULT 0,
      records_rejected INT DEFAULT 0,
      duration_ms INT DEFAULT 0,
      error_message TEXT NULL,
      started_at DATETIME NOT NULL,
      completed_at DATETIME NULL,
      INDEX idx_bi_sync_ds (company_id, data_source_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Datasets Catalog Table
  await query(`
    CREATE TABLE IF NOT EXISTS bi_datasets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      name VARCHAR(150) NOT NULL,
      code VARCHAR(80) NOT NULL,
      description TEXT NULL,
      data_source_id INT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'FINANCE',
      storage_type ENUM('FACT_TABLE', 'VIRTUAL_QUERY', 'RAW_STORAGE') NOT NULL DEFAULT 'FACT_TABLE',
      target_table VARCHAR(80) NULL,
      schema_definition JSON NOT NULL,
      lineage_metadata JSON NULL,
      refresh_mode ENUM('REAL_TIME', 'SCHEDULED', 'ON_DEMAND') NOT NULL DEFAULT 'SCHEDULED',
      last_refreshed_at DATETIME NULL,
      row_count INT DEFAULT 0,
      is_system TINYINT(1) DEFAULT 0,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_bi_dataset_code (company_id, code),
      INDEX idx_bi_dataset_company (company_id, category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4. Raw Dataset Storage (for uploaded CSV/Excel or ad-hoc custom datasets)
  await query(`
    CREATE TABLE IF NOT EXISTS bi_dataset_records (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      dataset_id INT NOT NULL,
      record_data JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bi_record_dataset (company_id, dataset_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. ETL Pipelines Table
  await query(`
    CREATE TABLE IF NOT EXISTS bi_etl_pipelines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      name VARCHAR(150) NOT NULL,
      description TEXT NULL,
      source_id INT NOT NULL,
      target_dataset_id INT NOT NULL,
      status ENUM('ACTIVE', 'INACTIVE', 'DRAFT', 'RUNNING') NOT NULL DEFAULT 'ACTIVE',
      extract_mode ENUM('FULL', 'INCREMENTAL') NOT NULL DEFAULT 'INCREMENTAL',
      transform_steps JSON NOT NULL,
      quality_rules JSON NULL,
      schedule_cron VARCHAR(50) DEFAULT '0 1 * * *',
      is_scheduled TINYINT(1) DEFAULT 1,
      last_run_at DATETIME NULL,
      next_run_at DATETIME NULL,
      last_run_status ENUM('SUCCESS', 'FAILED', 'WARNING') NULL,
      last_run_duration INT DEFAULT 0,
      records_extracted INT DEFAULT 0,
      records_loaded INT DEFAULT 0,
      records_rejected INT DEFAULT 0,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bi_pipe_company (company_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 6. ETL Pipeline Runs Table
  await query(`
    CREATE TABLE IF NOT EXISTS bi_etl_pipeline_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      pipeline_id INT NOT NULL,
      run_type ENUM('MANUAL', 'SCHEDULED', 'API_TRIGGER') NOT NULL DEFAULT 'MANUAL',
      status ENUM('QUEUED', 'EXTRACTING', 'VALIDATING', 'TRANSFORMING', 'QUALITY_CHECK', 'LOADING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
      records_extracted INT DEFAULT 0,
      records_transformed INT DEFAULT 0,
      records_loaded INT DEFAULT 0,
      records_rejected INT DEFAULT 0,
      quality_score DECIMAL(5,2) DEFAULT 100.00,
      duration_seconds INT DEFAULT 0,
      stage_timings JSON NULL,
      error_message TEXT NULL,
      triggered_by INT NULL,
      started_at DATETIME NOT NULL,
      completed_at DATETIME NULL,
      INDEX idx_bi_runs_pipeline (company_id, pipeline_id, started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 7. ETL Pipeline Execution Stage Logs
  await query(`
    CREATE TABLE IF NOT EXISTS bi_etl_run_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      run_id INT NOT NULL,
      stage ENUM('EXTRACT', 'VALIDATE', 'TRANSFORM', 'QUALITY_CHECK', 'LOAD', 'VERIFY', 'COMPLETE') NOT NULL,
      level ENUM('INFO', 'WARNING', 'ERROR') NOT NULL DEFAULT 'INFO',
      message TEXT NOT NULL,
      details JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bi_run_logs (run_id, stage)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 8. Data Quality Logs & Quarantine Table
  await query(`
    CREATE TABLE IF NOT EXISTS bi_data_quality_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      pipeline_id INT NULL,
      dataset_id INT NULL,
      run_id INT NULL,
      rule_name VARCHAR(100) NOT NULL,
      rule_type ENUM('NULL_CHECK', 'TYPE_VALIDATION', 'RANGE_CHECK', 'DUPLICATE_CHECK', 'FK_INTEGRITY', 'CUSTOM_REGEX') NOT NULL,
      field_name VARCHAR(100) NULL,
      severity ENUM('CRITICAL', 'WARNING', 'INFO') NOT NULL DEFAULT 'WARNING',
      total_checked INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      sample_error TEXT NULL,
      checked_at DATETIME NOT NULL,
      INDEX idx_bi_quality_dataset (company_id, dataset_id, checked_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 9. Rejected / Quarantined Records Table
  await query(`
    CREATE TABLE IF NOT EXISTS bi_rejected_records (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      pipeline_id INT NOT NULL,
      run_id INT NOT NULL,
      dataset_id INT NOT NULL,
      rejection_stage VARCHAR(50) NOT NULL,
      reason TEXT NOT NULL,
      raw_record JSON NOT NULL,
      quarantined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bi_quarantine (company_id, pipeline_id, run_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 10. Dimension: Date (DimDate)
  await query(`
    CREATE TABLE IF NOT EXISTS bi_dim_date (
      date_key INT PRIMARY KEY,
      full_date DATE NOT NULL,
      day_of_month INT NOT NULL,
      day_name VARCHAR(15) NOT NULL,
      day_of_week INT NOT NULL,
      month_number INT NOT NULL,
      month_name VARCHAR(15) NOT NULL,
      quarter_number INT NOT NULL,
      quarter_name VARCHAR(10) NOT NULL,
      year_number INT NOT NULL,
      is_weekend TINYINT(1) NOT NULL DEFAULT 0,
      fiscal_year INT NOT NULL,
      fiscal_quarter VARCHAR(10) NOT NULL,
      UNIQUE KEY uq_bi_full_date (full_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 11. Fact Table: Sales (FactSales)
  await query(`
    CREATE TABLE IF NOT EXISTS bi_fact_sales (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      date_key INT NOT NULL,
      invoice_id INT NULL,
      pos_sale_id INT NULL,
      customer_id INT NULL,
      product_id INT NULL,
      salesperson_id INT NULL,
      quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(15,4) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
      gross_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
      net_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
      cost_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
      gross_profit DECIMAL(15,4) NOT NULL DEFAULT 0,
      margin_percentage DECIMAL(8,4) NOT NULL DEFAULT 0,
      channel ENUM('DIRECT_INVOICE', 'POS', 'ECOMMERCE', 'SALES_ORDER') NOT NULL DEFAULT 'DIRECT_INVOICE',
      payment_status VARCHAR(50) DEFAULT 'PAID',
      created_at DATETIME NOT NULL,
      INDEX idx_bi_fact_sales_date (company_id, date_key),
      INDEX idx_bi_fact_sales_branch (company_id, branch_id),
      INDEX idx_bi_fact_sales_customer (company_id, customer_id),
      INDEX idx_bi_fact_sales_product (company_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 12. Fact Table: Purchases (FactPurchases)
  await query(`
    CREATE TABLE IF NOT EXISTS bi_fact_purchases (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      date_key INT NOT NULL,
      po_id INT NULL,
      bill_id INT NULL,
      supplier_id INT NULL,
      product_id INT NULL,
      quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(15,4) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
      total_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
      status VARCHAR(50) DEFAULT 'COMPLETED',
      created_at DATETIME NOT NULL,
      INDEX idx_bi_fact_purch_date (company_id, date_key),
      INDEX idx_bi_fact_purch_supp (company_id, supplier_id),
      INDEX idx_bi_fact_purch_prod (company_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 13. Fact Table: Inventory Valuation & Movements (FactInventory)
  await query(`
    CREATE TABLE IF NOT EXISTS bi_fact_inventory (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      date_key INT NOT NULL,
      product_id INT NOT NULL,
      warehouse_id INT NULL,
      stock_qty DECIMAL(15,4) NOT NULL DEFAULT 0,
      cost_price DECIMAL(15,4) NOT NULL DEFAULT 0,
      selling_price DECIMAL(15,4) NOT NULL DEFAULT 0,
      total_stock_value DECIMAL(15,4) NOT NULL DEFAULT 0,
      reorder_level DECIMAL(15,4) NOT NULL DEFAULT 0,
      is_low_stock TINYINT(1) NOT NULL DEFAULT 0,
      stockout_days INT DEFAULT 0,
      created_at DATETIME NOT NULL,
      INDEX idx_bi_fact_inv_date (company_id, date_key),
      INDEX idx_bi_fact_inv_prod (company_id, product_id),
      INDEX idx_bi_fact_inv_wh (company_id, warehouse_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 14. Fact Table: Finance (FactFinance)
  await query(`
    CREATE TABLE IF NOT EXISTS bi_fact_finance (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      date_key INT NOT NULL,
      account_id INT NOT NULL,
      account_category ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') NOT NULL,
      debit_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
      credit_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
      net_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
      voucher_type VARCHAR(50) NULL,
      voucher_id INT NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_bi_fact_fin_date (company_id, date_key),
      INDEX idx_bi_fact_fin_acc (company_id, account_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 15. Fact Table: Production (FactProduction)
  await query(`
    CREATE TABLE IF NOT EXISTS bi_fact_production (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      date_key INT NOT NULL,
      work_order_id INT NULL,
      bom_id INT NULL,
      product_id INT NULL,
      machine_id INT NULL,
      planned_qty DECIMAL(15,4) NOT NULL DEFAULT 0,
      good_qty DECIMAL(15,4) NOT NULL DEFAULT 0,
      scrap_qty DECIMAL(15,4) NOT NULL DEFAULT 0,
      scrap_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
      yield_rate DECIMAL(8,4) NOT NULL DEFAULT 100.0,
      status VARCHAR(50) DEFAULT 'COMPLETED',
      created_at DATETIME NOT NULL,
      INDEX idx_bi_fact_prod_date (company_id, date_key),
      INDEX idx_bi_fact_prod_prod (company_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 16. Fact Table: Projects (FactProjects)
  await query(`
    CREATE TABLE IF NOT EXISTS bi_fact_projects (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NULL,
      date_key INT NOT NULL,
      project_id INT NOT NULL,
      budget DECIMAL(15,4) NOT NULL DEFAULT 0,
      total_spent DECIMAL(15,4) NOT NULL DEFAULT 0,
      budget_variance DECIMAL(15,4) NOT NULL DEFAULT 0,
      completion_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
      status VARCHAR(50) DEFAULT 'IN_PROGRESS',
      overdue_tasks_count INT DEFAULT 0,
      created_at DATETIME NOT NULL,
      INDEX idx_bi_fact_pm_proj (company_id, project_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 17. Custom Dashboards & Dynamic Widgets Table
  await query(`
    CREATE TABLE IF NOT EXISTS bi_custom_dashboards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      user_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      description TEXT NULL,
      category VARCHAR(50) DEFAULT 'CUSTOM',
      layout_config JSON NOT NULL,
      filters_config JSON NULL,
      is_default TINYINT(1) DEFAULT 0,
      is_public TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bi_dash_user (company_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bi_dashboard_widgets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dashboard_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      widget_type ENUM('KPI_CARD', 'BAR_CHART', 'STACKED_BAR', 'LINE_CHART', 'AREA_CHART', 'PIE_CHART', 'DONUT_CHART', 'DATA_TABLE', 'PIVOT_TABLE', 'SCATTER_PLOT') NOT NULL DEFAULT 'KPI_CARD',
      dataset_id INT NULL,
      measure_key VARCHAR(100) NOT NULL,
      dimension_key VARCHAR(100) NULL,
      comparison_type ENUM('NONE', 'PREVIOUS_PERIOD', 'PREVIOUS_YEAR', 'TARGET', 'BUDGET') DEFAULT 'NONE',
      filter_conditions JSON NULL,
      chart_color VARCHAR(30) DEFAULT '#0E3646',
      grid_position JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bi_widget_dash (dashboard_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 18. Automated Business Insights Engine Table
  await query(`
    CREATE TABLE IF NOT EXISTS bi_automated_insights (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      category VARCHAR(50) NOT NULL,
      insight_type ENUM('POSITIVE_TREND', 'NEGATIVE_TREND', 'ANOMALY', 'EXCEPTION', 'THRESHOLD_ALERT', 'OPPORTUNITY') NOT NULL,
      severity ENUM('CRITICAL', 'WARNING', 'INFO', 'POSITIVE') NOT NULL DEFAULT 'INFO',
      title VARCHAR(200) NOT NULL,
      explanation TEXT NOT NULL,
      metric_value DECIMAL(15,4) NULL,
      comparison_value DECIMAL(15,4) NULL,
      change_pct DECIMAL(8,2) NULL,
      recommendation TEXT NULL,
      drill_down_payload JSON NULL,
      is_dismissed TINYINT(1) DEFAULT 0,
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bi_insights_comp (company_id, category, severity)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 19. Seed Date Dimension for 5 years (2024 to 2028)
  const [dateCount] = await query("SELECT COUNT(*) as count FROM bi_dim_date");
  if (Number(dateCount?.count || 0) === 0) {
    console.log("Seeding DimDate table (2024-2028)...");
    const dateInserts = [];
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2028-12-31");
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    let cur = new Date(startDate);
    while (cur <= endDate) {
      const year = cur.getFullYear();
      const month = cur.getMonth() + 1;
      const day = cur.getDate();
      const dayOfWeek = cur.getDay() + 1;
      const dateKey = year * 10000 + month * 100 + day;
      const fullDateStr = cur.toISOString().split("T")[0];
      const quarter = Math.ceil(month / 3);
      const isWeekend = (dayOfWeek === 1 || dayOfWeek === 7) ? 1 : 0;

      dateInserts.push([
        dateKey,
        fullDateStr,
        day,
        dayNames[cur.getDay()],
        dayOfWeek,
        month,
        monthNames[month - 1],
        quarter,
        `Q${quarter}`,
        year,
        isWeekend,
        year,
        `FY${year}-Q${quarter}`
      ]);

      cur.setDate(cur.getDate() + 1);
    }

    // Insert in batches of 500
    for (let i = 0; i < dateInserts.length; i += 500) {
      const batch = dateInserts.slice(i, i + 500);
      const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",");
      const flattened = batch.flat();
      await query(
        `INSERT IGNORE INTO bi_dim_date (date_key, full_date, day_of_month, day_name, day_of_week, month_number, month_name, quarter_number, quarter_name, year_number, is_weekend, fiscal_year, fiscal_quarter) VALUES ${placeholders}`,
        flattened
      );
    }
    console.log(`DimDate seeded with ${dateInserts.length} days.`);
  }

  // 20. Seed Default Data Sources & Datasets for Companies
  const companies = await query("SELECT id, name FROM adm_companies");
  const compList = companies.length > 0 ? companies : [{ id: 1, name: "OmniSuite Enterprise" }];

  for (const c of compList) {
    const compId = c.id;

    // Seed Data Sources
    const defaultSources = [
      { name: "OmniSuite Finance & General Ledger", source_type: "ERP", erp_module: "finance", sync_frequency: "HOURLY" },
      { name: "OmniSuite Sales & Invoices", source_type: "ERP", erp_module: "sales", sync_frequency: "HOURLY" },
      { name: "OmniSuite Purchase & Payables", source_type: "ERP", erp_module: "purchase", sync_frequency: "DAILY" },
      { name: "OmniSuite Inventory & Warehousing", source_type: "ERP", erp_module: "inventory", sync_frequency: "HOURLY" },
      { name: "OmniSuite Production & Shop Floor", source_type: "ERP", erp_module: "production", sync_frequency: "DAILY" },
      { name: "OmniSuite Human Resources & Payroll", source_type: "ERP", erp_module: "hr", sync_frequency: "DAILY" },
      { name: "OmniSuite Project Portfolios", source_type: "ERP", erp_module: "projects", sync_frequency: "DAILY" },
      { name: "OmniSuite Point of Sale (POS)", source_type: "ERP", erp_module: "pos", sync_frequency: "HOURLY" },
      { name: "OmniSuite Fleet & Transport", source_type: "ERP", erp_module: "transport", sync_frequency: "DAILY" },
      { name: "Corporate Budget Targets 2026", source_type: "EXCEL", erp_module: null, sync_frequency: "MANUAL" },
    ];

    for (const src of defaultSources) {
      await query(
        `INSERT IGNORE INTO bi_data_sources (company_id, name, source_type, erp_module, status, sync_frequency, total_records, last_sync_at, last_sync_status)
         VALUES (:companyId, :name, :sourceType, :erpModule, 'CONNECTED', :syncFreq, 0, NOW(), 'SUCCESS')`,
        { companyId: compId, name: src.name, sourceType: src.source_type, erpModule: src.erp_module, syncFreq: src.sync_frequency }
      );
    }

    // Seed Datasets Catalog
    const defaultDatasets = [
      { name: "Sales Performance & Profitability", code: "ds_sales_performance", category: "SALES", target_table: "bi_fact_sales", storage_type: "FACT_TABLE", refresh_mode: "SCHEDULED", schema: { fields: [{ name: "invoice_date", type: "DATE" }, { name: "customer_name", type: "STRING" }, { name: "branch_name", type: "STRING" }, { name: "item_name", type: "STRING" }, { name: "quantity", type: "NUMBER" }, { name: "net_amount", type: "NUMBER" }, { name: "cost_amount", type: "NUMBER" }, { name: "gross_profit", type: "NUMBER" }, { name: "margin_percentage", type: "NUMBER" }] }, lineage: { source: "sal_invoices + sal_invoice_details + sal_customers + adm_branches", pipeline: "Sales Daily Sync Pipeline" } },
      { name: "Procurement & Vendor Spend Analysis", code: "ds_procurement_spend", category: "PURCHASE", target_table: "bi_fact_purchases", storage_type: "FACT_TABLE", refresh_mode: "SCHEDULED", schema: { fields: [{ name: "po_date", type: "DATE" }, { name: "supplier_name", type: "STRING" }, { name: "item_name", type: "STRING" }, { name: "quantity", type: "NUMBER" }, { name: "total_amount", type: "NUMBER" }, { name: "status", type: "STRING" }] }, lineage: { source: "pur_orders + pur_order_items + pur_suppliers", pipeline: "Procurement Spend Pipeline" } },
      { name: "Inventory Valuation & Stock Levels", code: "ds_inventory_valuation", category: "INVENTORY", target_table: "bi_fact_inventory", storage_type: "FACT_TABLE", refresh_mode: "REAL_TIME", schema: { fields: [{ name: "item_code", type: "STRING" }, { name: "item_name", type: "STRING" }, { name: "category_name", type: "STRING" }, { name: "warehouse_name", type: "STRING" }, { name: "stock_qty", type: "NUMBER" }, { name: "total_stock_value", type: "NUMBER" }, { name: "reorder_level", type: "NUMBER" }, { name: "is_low_stock", type: "BOOLEAN" }] }, lineage: { source: "inv_items + inv_stock_balances + inv_warehouses", pipeline: "Inventory Snapshot Pipeline" } },
      { name: "General Ledger Financial Analytics", code: "ds_finance_gl", category: "FINANCE", target_table: "bi_fact_finance", storage_type: "FACT_TABLE", refresh_mode: "SCHEDULED", schema: { fields: [{ name: "entry_date", type: "DATE" }, { name: "account_code", type: "STRING" }, { name: "account_name", type: "STRING" }, { name: "account_category", type: "STRING" }, { name: "debit_amount", type: "NUMBER" }, { name: "credit_amount", type: "NUMBER" }, { name: "net_amount", type: "NUMBER" }] }, lineage: { source: "fin_general_ledger + fin_accounts", pipeline: "GL Financial Analytics Pipeline" } },
      { name: "Manufacturing Yield & Scrap Analysis", code: "ds_production_yield", category: "PRODUCTION", target_table: "bi_fact_production", storage_type: "FACT_TABLE", refresh_mode: "SCHEDULED", schema: { fields: [{ name: "work_order_no", type: "STRING" }, { name: "item_name", type: "STRING" }, { name: "planned_qty", type: "NUMBER" }, { name: "good_qty", type: "NUMBER" }, { name: "scrap_qty", type: "NUMBER" }, { name: "scrap_rate", type: "NUMBER" }, { name: "yield_rate", type: "NUMBER" }] }, lineage: { source: "prod_work_orders + prod_job_cards + prod_boms", pipeline: "Production Yield Pipeline" } },
      { name: "Project Portfolio & Cost Tracking", code: "ds_project_costs", category: "PROJECTS", target_table: "bi_fact_projects", storage_type: "FACT_TABLE", refresh_mode: "SCHEDULED", schema: { fields: [{ name: "project_name", type: "STRING" }, { name: "budget", type: "NUMBER" }, { name: "total_spent", type: "NUMBER" }, { name: "budget_variance", type: "NUMBER" }, { name: "completion_pct", type: "NUMBER" }, { name: "status", type: "STRING" }] }, lineage: { source: "pm_projects + pm_expenses", pipeline: "Project Performance Pipeline" } },
      { name: "Point of Sale Omnichannel Revenue", code: "ds_pos_revenue", category: "POS", target_table: "bi_fact_sales", storage_type: "FACT_TABLE", refresh_mode: "REAL_TIME", schema: { fields: [{ name: "sale_datetime", type: "DATETIME" }, { name: "branch_name", type: "STRING" }, { name: "item_name", type: "STRING" }, { name: "qty", type: "NUMBER" }, { name: "net_amount", type: "NUMBER" }] }, lineage: { source: "pos_sales + pos_sale_lines", pipeline: "POS Real-Time Sync" } },
    ];

    for (const ds of defaultDatasets) {
      await query(
        `INSERT IGNORE INTO bi_datasets (company_id, name, code, description, category, storage_type, target_table, schema_definition, lineage_metadata, refresh_mode, last_refreshed_at, is_system)
         VALUES (:companyId, :name, :code, :description, :category, :storageType, :targetTable, :schemaDef, :lineage, :refreshMode, NOW(), 1)`,
        {
          companyId: compId,
          name: ds.name,
          code: ds.code,
          description: ds.name,
          category: ds.category,
          storageType: ds.storage_type,
          targetTable: ds.target_table,
          schemaDef: JSON.stringify(ds.schema),
          lineage: JSON.stringify(ds.lineage),
          refreshMode: ds.refresh_mode
        }
      );
    }

    // Seed Default ETL Pipelines
    const defaultPipelines = [
      {
        name: "Enterprise Sales & Revenue ETL",
        description: "Extracts sales orders, invoices, and POS transactions, calculates profit margins and loads into bi_fact_sales",
        schedule: "0 1 * * *",
        transform: [
          { step: "CLEAN", operation: "TRIM_AND_DROP_NULLS", fields: ["invoice_number", "customer_id"] },
          { step: "CALCULATE", target_field: "gross_profit", formula: "net_amount - cost_amount" },
          { step: "CALCULATE", target_field: "margin_percentage", formula: "CASE WHEN net_amount > 0 THEN (gross_profit / net_amount) * 100 ELSE 0 END" },
          { step: "VALIDATE", checks: [{ field: "net_amount", type: "MIN_VAL", value: 0 }, { field: "customer_id", type: "NOT_NULL" }] }
        ]
      },
      {
        name: "Procurement & Vendor Analysis ETL",
        description: "Extracts purchase orders and bills, validates supplier integrity and loads into bi_fact_purchases",
        schedule: "0 2 * * *",
        transform: [
          { step: "CLEAN", operation: "DROP_CANCELLED", fields: ["status"] },
          { step: "VALIDATE", checks: [{ field: "total_amount", type: "MIN_VAL", value: 0 }, { field: "supplier_id", type: "NOT_NULL" }] }
        ]
      },
      {
        name: "Inventory Snapshot & Valuation ETL",
        description: "Extracts stock balances, calculates total valuation based on moving average cost, and flags reorder points",
        schedule: "0 */4 * * *",
        transform: [
          { step: "CALCULATE", target_field: "total_stock_value", formula: "stock_qty * cost_price" },
          { step: "CALCULATE", target_field: "is_low_stock", formula: "CASE WHEN stock_qty <= reorder_level AND reorder_level > 0 THEN 1 ELSE 0 END" }
        ]
      },
      {
        name: "Production Yield & Quality ETL",
        description: "Extracts work orders and job cards, computes scrap rates and quality yields",
        schedule: "0 3 * * *",
        transform: [
          { step: "CALCULATE", target_field: "scrap_rate", formula: "CASE WHEN (good_qty + scrap_qty) > 0 THEN (scrap_qty / (good_qty + scrap_qty)) * 100 ELSE 0 END" },
          { step: "CALCULATE", target_field: "yield_rate", formula: "100.0 - scrap_rate" }
        ]
      }
    ];

    for (const p of defaultPipelines) {
      const [srcRow] = await query("SELECT id FROM bi_data_sources WHERE company_id = :companyId LIMIT 1", { companyId: compId });
      const [dsRow] = await query("SELECT id FROM bi_datasets WHERE company_id = :companyId LIMIT 1", { companyId: compId });

      if (srcRow?.id && dsRow?.id) {
        await query(
          `INSERT IGNORE INTO bi_etl_pipelines (company_id, name, description, source_id, target_dataset_id, status, extract_mode, transform_steps, schedule_cron, is_scheduled, last_run_at, last_run_status, last_run_duration, records_extracted, records_loaded)
           VALUES (:companyId, :name, :description, :sourceId, :targetDatasetId, 'ACTIVE', 'INCREMENTAL', :transforms, :cron, 1, NOW(), 'SUCCESS', 4, 1500, 1492)`,
          {
            companyId: compId,
            name: p.name,
            description: p.description,
            sourceId: srcRow.id,
            targetDatasetId: dsRow.id,
            transforms: JSON.stringify(p.transform),
            cron: p.schedule
          }
        );
      }
    }
  }

  console.log("BI Schema and ETL migration finished successfully!");
}

// If executed directly
if (process.argv[1]?.endsWith("bi_schema_and_etl_tables.js")) {
  runBiSchemaMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
