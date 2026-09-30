// Third-party Library Imports
import express from "express";

import { cacheListResponse } from "../middleware/cache.middleware.js";
// Authentication & Authorization Middleware Dependencies
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { checkModuleAccess } from "../middleware/access.js";
import {
  requirePermission,
  requireAnyPermission,
} from "../middleware/requirePermission.js";
// Database Configuration and Connection
import { query, pool } from "../db/pool.js";

// Utility Dependencies
import { httpError } from "../utils/httpError.js";
import { ensureSalesOrderColumns } from "../utils/dbUtils.js";
import {
  getInactiveWorkflowBehavior,
  resolveWorkflowSelection,
} from "../utils/workflowResolution.js";
import { ensureStockBalancesWarehouseInfrastructure } from "../services/stock.service.js";
import {
  requireIdParam,
  ensureCustomerFinAccountIdTx,
} from "../controllers/finance.controller.js";
import { isMailerConfigured, sendMail } from "../utils/mailer.js";
import * as XLSX from "xlsx";

import { allocateFromBatchesTx } from "./inventory.routes.js";

const router = express.Router();

// Enforce module-level access for all Sales endpoints
router.use(
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  checkModuleAccess("sales"),
);

// Utility Function: Check if a specific column exists in a given table
// Why: Used during startup scripts to conditionally apply schema migrations without failing if they already exist
async function hasColumn(tableName, columnName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
      AND column_name = :columnName
    `,
    { tableName, columnName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

// Ensure sal_deliveries columns
(async () => {
  try {
    if (!(await hasColumn("sal_deliveries", "delivery_instructions"))) {
      await query(
        "ALTER TABLE sal_deliveries ADD COLUMN delivery_instructions TEXT NULL",
      );
    }
    if (!(await hasColumn("sal_deliveries", "terms_and_conditions"))) {
      await query(
        "ALTER TABLE sal_deliveries ADD COLUMN terms_and_conditions TEXT NULL",
      );
    }
    if (!(await hasColumn("sal_deliveries", "total_tax"))) {
      await query(
        "ALTER TABLE sal_deliveries ADD COLUMN total_tax DECIMAL(18,2) DEFAULT 0",
      );
    }
    if (!(await hasColumn("sal_deliveries", "invoice_amount"))) {
      await query(
        "ALTER TABLE sal_deliveries ADD COLUMN invoice_amount DECIMAL(18,2) DEFAULT 0",
      );
    }
  } catch (err) {
    console.error("Failed to update sal_deliveries schema:", err);
  }
})();

// Ensure prospective customers table exists
// Major Logical Block: Ensure 'sal_prospect_customers' table and columns exist
// Why: Automatically applies schema migrations for prospective customers tracking
async function ensureProspectiveCustomersTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS sal_prospect_customers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      customer_code VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      customer_name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      credit_limit DECIMAL(18,2) NOT NULL DEFAULT '0.00',
      is_active TINYINT(1) NOT NULL DEFAULT '1',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      city VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      state VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      zone VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      country VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      price_type_id BIGINT UNSIGNED DEFAULT NULL,
      email VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      phone VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      contact_person VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      customer_type VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      address TEXT COLLATE utf8mb4_unicode_ci,
      mobile VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      payment_terms VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      currency_id BIGINT UNSIGNED DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_prospect_customers_scope (company_id, branch_id),
      KEY fk_prospect_customers_branch (branch_id),
      CONSTRAINT fk_prospect_customers_branch FOREIGN KEY (branch_id) REFERENCES adm_branches (id),
      CONSTRAINT fk_prospect_customers_company FOREIGN KEY (company_id) REFERENCES adm_companies (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);

  // Migrate existing tables that were created with the old schema (missing columns)
  const columnsToAdd = [
    ["branch_id", "BIGINT UNSIGNED NOT NULL DEFAULT 1"],
    ["customer_code", "VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL"],
    ["customer_name", "VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT ''"],
    ["credit_limit", "DECIMAL(18,2) NOT NULL DEFAULT '0.00'"],
    ["is_active", "TINYINT(1) NOT NULL DEFAULT '1'"],
    ["zone", "VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL"],
    ["price_type_id", "BIGINT UNSIGNED DEFAULT NULL"],
    ["phone", "VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL"],
    ["contact_person", "VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL"],
    ["customer_type", "VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL"],
    ["mobile", "VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL"],
    ["payment_terms", "VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL"],
    ["currency_id", "BIGINT UNSIGNED DEFAULT NULL"],
  ];
  for (const [col, def] of columnsToAdd) {
    if (!(await hasColumn("sal_prospect_customers", col))) {
      await query(
        `ALTER TABLE sal_prospect_customers ADD COLUMN ${col} ${def}`,
      ).catch(() => null);
    }
  }

  // Ensure prospect_customer is nullable if it exists, and add it if not
  if (await hasColumn("sal_prospect_customers", "prospect_customer")) {
    await query(
      "ALTER TABLE sal_prospect_customers MODIFY COLUMN prospect_customer VARCHAR(200) NULL",
    ).catch(() => null);
  } else {
    await query(
      "ALTER TABLE sal_prospect_customers ADD COLUMN prospect_customer VARCHAR(200) NULL",
    ).catch(() => null);
  }
}
// Major Logical Block: Ensure quotation tables (headers) exist
// Why: Sets up 'sal_quotations' table and ensures missing columns are added for updates
async function ensureQuotationTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS sal_quotations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      quotation_no VARCHAR(50) NOT NULL,
      quotation_date DATE NOT NULL,
      customer_id BIGINT UNSIGNED NULL,
      customer_name VARCHAR(255) NULL,
      customer_address VARCHAR(255) NULL,
      customer_city VARCHAR(100) NULL,
      customer_state VARCHAR(100) NULL,
      customer_country VARCHAR(100) NULL,
      valid_days INT NULL,
      valid_until DATE NULL,
      total_amount DECIMAL(18,2) DEFAULT 0,
      net_amount DECIMAL(18,2) DEFAULT 0,
      tax_amount DECIMAL(18,2) DEFAULT 0,
      status VARCHAR(30) DEFAULT 'DRAFT',
      price_type ENUM('WHOLESALE','RETAIL') DEFAULT 'RETAIL',
      payment_type ENUM('CASH','CHEQUE','CREDIT') DEFAULT 'CASH',
      currency_id BIGINT UNSIGNED DEFAULT 4,
      exchange_rate DECIMAL(18,6) DEFAULT 1,
      warehouse_id BIGINT UNSIGNED NULL,
      remarks TEXT NULL,
      terms_and_conditions TEXT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_quotation_scope_no (company_id, branch_id, quotation_no),
      KEY idx_quotation_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);

  const table = "sal_quotations";
  const ensureCol = async (col, ddl) => {
    if (!(await hasColumn(table, col))) {
      await query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).catch(() => null);
    }
  };
  await ensureCol("customer_address", "customer_address VARCHAR(255) NULL");
  await ensureCol("customer_city", "customer_city VARCHAR(100) NULL");
  await ensureCol("customer_state", "customer_state VARCHAR(100) NULL");
  await ensureCol("customer_country", "customer_country VARCHAR(100) NULL");
  await ensureCol("valid_days", "valid_days INT NULL");
  await ensureCol("net_amount", "net_amount DECIMAL(18,2) DEFAULT 0");
  await ensureCol("tax_amount", "tax_amount DECIMAL(18,2) DEFAULT 0");
  await ensureCol("terms_and_conditions", "terms_and_conditions TEXT NULL");
}

// Major Logical Block: Ensure quotation line-items table exists
// Why: Creates 'sal_quotation_details' table and backfills any new schema modifications
async function ensureQuotationDetailsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS sal_quotation_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      quotation_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty DECIMAL(18,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      net_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      tax_type BIGINT UNSIGNED NULL,
      uom VARCHAR(20) NULL,
      PRIMARY KEY (id),
      KEY idx_qd_q (quotation_id),
      KEY idx_qd_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);

  const table = "sal_quotation_details";
  const ensureCol = async (col, ddl) => {
    if (!(await hasColumn(table, col))) {
      await query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).catch(() => null);
    }
  };
  await ensureCol(
    "discount_percent",
    "discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0",
  );
  await ensureCol(
    "total_amount",
    "total_amount DECIMAL(18,2) NOT NULL DEFAULT 0",
  );
  await ensureCol("net_amount", "net_amount DECIMAL(18,2) NOT NULL DEFAULT 0");
  await ensureCol("tax_amount", "tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0");
  await ensureCol("tax_type", "tax_type BIGINT UNSIGNED NULL");
  await ensureCol("uom", "uom VARCHAR(20) NULL");
}
// Major Logical Block: Ensure invoice tables (headers and details) exist
// Why: Creates 'srv_service_invoices' and 'srv_service_invoice_details' for billing operations and runs migrations
async function ensureInvoiceTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS srv_service_invoices (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      invoice_no VARCHAR(50) NOT NULL,
      invoice_date DATE NULL,
      customer_id BIGINT UNSIGNED NULL,
      payment_status VARCHAR(30) DEFAULT 'UNPAID',
      status VARCHAR(30) DEFAULT 'DRAFT',
      total_amount DECIMAL(18,2) DEFAULT 0,
      net_amount DECIMAL(18,2) DEFAULT 0,
      balance_amount DECIMAL(18,2) DEFAULT 0,
      tax_amount DECIMAL(18,2) DEFAULT 0,
      tax_components LONGTEXT NULL,
      price_type ENUM('WHOLESALE','RETAIL') DEFAULT 'RETAIL',
      payment_type ENUM('CASH','CHEQUE','CREDIT') DEFAULT 'CASH',
      currency_id BIGINT UNSIGNED DEFAULT 4,
      exchange_rate DECIMAL(18,6) DEFAULT 1,
      warehouse_id BIGINT UNSIGNED NULL,
      sales_order_id BIGINT UNSIGNED NULL,
      remarks TEXT NULL,
      payment_date DATE NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_invoice_scope_no (company_id, branch_id, invoice_no),
      KEY idx_invoice_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  if (!(await hasColumn("srv_service_invoices", "tax_components"))) {
    await query(
      "ALTER TABLE srv_service_invoices ADD COLUMN tax_components LONGTEXT NULL AFTER tax_amount",
    ).catch(() => null);
  }
  if (!(await hasColumn("srv_service_invoices", "tax_amount"))) {
    await query(
      "ALTER TABLE srv_service_invoices ADD COLUMN tax_amount DECIMAL(18,2) DEFAULT 0 AFTER balance_amount",
    ).catch(() => null);
  }
  await query(`
    CREATE TABLE IF NOT EXISTS srv_service_invoice_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      invoice_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      net_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      uom VARCHAR(20) NULL,
      remarks VARCHAR(255) NULL,
      PRIMARY KEY (id),
      KEY idx_invoice_details_invoice (invoice_id),
      KEY idx_invoice_details_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  const details = "srv_service_invoice_details";
  if (!(await hasColumn(details, "quantity")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN quantity DECIMAL(18,4) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "unit_price")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN unit_price DECIMAL(18,4) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "uom")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN uom VARCHAR(20) NULL AFTER unit_price`,
    ).catch(() => null);
  if (!(await hasColumn(details, "discount_percent")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "total_amount")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN total_amount DECIMAL(18,2) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "net_amount")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN net_amount DECIMAL(18,2) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "tax_amount")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "uom")))
    await query(`ALTER TABLE ${details} ADD COLUMN uom VARCHAR(20) NULL`).catch(
      () => null,
    );
  if (!(await hasColumn(details, "remarks")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN remarks VARCHAR(255) NULL`,
    ).catch(() => null);
  if (!(await hasColumn(details, "tax_type")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN tax_type BIGINT UNSIGNED NULL`,
    ).catch(() => null);
  const table = "srv_service_invoices";
  if (!(await hasColumn(table, "total_amount")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN total_amount DECIMAL(18,2) DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(table, "net_amount")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN net_amount DECIMAL(18,2) DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(table, "balance_amount")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN balance_amount DECIMAL(18,2) DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(table, "price_type")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN price_type ENUM('WHOLESALE','RETAIL') DEFAULT 'RETAIL'`,
    ).catch(() => null);
  if (!(await hasColumn(table, "payment_type")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN payment_type ENUM('CASH','CHEQUE','CREDIT') DEFAULT 'CASH'`,
    ).catch(() => null);
  if (!(await hasColumn(table, "currency_id")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN currency_id BIGINT UNSIGNED DEFAULT 4`,
    ).catch(() => null);
  if (!(await hasColumn(table, "exchange_rate")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN exchange_rate DECIMAL(18,6) DEFAULT 1`,
    ).catch(() => null);
  if (!(await hasColumn(table, "warehouse_id")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN warehouse_id BIGINT UNSIGNED NULL`,
    ).catch(() => null);
  if (!(await hasColumn(table, "sales_order_id")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN sales_order_id BIGINT UNSIGNED NULL`,
    ).catch(() => null);
  if (!(await hasColumn(table, "remarks")))
    await query(`ALTER TABLE ${table} ADD COLUMN remarks TEXT NULL`).catch(
      () => null,
    );
  if (!(await hasColumn(table, "payment_date")))
    await query(`ALTER TABLE ${table} ADD COLUMN payment_date DATE NULL`).catch(
      () => null,
    );
  if (!(await hasColumn(table, "created_by")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN created_by BIGINT UNSIGNED NULL`,
    ).catch(() => null);
}

// Ensure sal_customers has created_by column
async function ensureCustomersTableColumns() {
  if (!(await hasColumn("sal_customers", "created_by"))) {
    await query(
      `ALTER TABLE sal_customers ADD COLUMN created_by BIGINT UNSIGNED NULL`,
    ).catch(() => null);
  }
  if (!(await hasColumn("sal_customers", "sales_account_id"))) {
    await query(
      `ALTER TABLE sal_customers ADD COLUMN sales_account_id BIGINT UNSIGNED NULL`,
    ).catch(() => null);
  }
}

async function ensureSalesReturnTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS sal_return_reasons (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      reason_code VARCHAR(50) NOT NULL,
      reason_name VARCHAR(255) NOT NULL,
      is_active TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reason_code (company_id, reason_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);

  await query(`
    CREATE TABLE IF NOT EXISTS sal_zones (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      zone_name VARCHAR(100) NOT NULL,
      description VARCHAR(255) DEFAULT NULL,
      is_active TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_zone_name (company_id, zone_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);

  await query(`
    CREATE TABLE IF NOT EXISTS sal_returns (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      return_no VARCHAR(50) NOT NULL,
      return_date DATE NOT NULL,
      invoice_id BIGINT UNSIGNED NULL,
      customer_id BIGINT UNSIGNED NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      return_type VARCHAR(50) DEFAULT 'DAMAGED',
      status VARCHAR(20) DEFAULT 'DRAFT',
      remarks TEXT,
      total_amount DECIMAL(18,2) DEFAULT 0,
      tax_amount DECIMAL(18,2) DEFAULT 0,
      sub_total DECIMAL(18,2) DEFAULT 0,
      created_by BIGINT UNSIGNED,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_return_no (company_id, branch_id, return_no),
      INDEX idx_company_branch (company_id, branch_id)
    )
  `).catch(() => null);
  await query(`
    CREATE TABLE IF NOT EXISTS sal_return_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      return_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty_returned DECIMAL(18,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      total_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      reason_code VARCHAR(50),
      remarks TEXT,
      PRIMARY KEY (id),
      INDEX idx_return (return_id),
      CONSTRAINT fk_sal_return_details_header FOREIGN KEY (return_id) REFERENCES sal_returns(id) ON DELETE CASCADE
    )
  `).catch(() => null);
}
async function ensureDeliveryTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS sal_deliveries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      delivery_no VARCHAR(50) NOT NULL,
      delivery_date DATE NOT NULL,
      customer_id BIGINT UNSIGNED NOT NULL,
      sales_order_id BIGINT UNSIGNED NULL,
      remarks TEXT NULL,
      status VARCHAR(20) DEFAULT 'DRAFT',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_delivery_scope_no (company_id, branch_id, delivery_no),
      KEY idx_delivery_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  await query(`
    CREATE TABLE IF NOT EXISTS sal_delivery_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      delivery_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      uom VARCHAR(20) NULL,
      remarks VARCHAR(255) NULL,
      PRIMARY KEY (id),
      KEY idx_delivery_details_delivery (delivery_id),
      KEY idx_delivery_details_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  const deliveries = "sal_deliveries";
  if (!(await hasColumn(deliveries, "invoice_id")))
    await query(
      `ALTER TABLE ${deliveries} ADD COLUMN invoice_id BIGINT UNSIGNED NULL AFTER sales_order_id`,
    ).catch(() => null);
  const details = "sal_delivery_details";
  if (!(await hasColumn(details, "unit_price")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN unit_price DECIMAL(18,4) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "uom")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN uom VARCHAR(20) NULL AFTER unit_price`,
    ).catch(() => null);
  if (!(await hasColumn(deliveries, "created_by")))
    await query(
      `ALTER TABLE ${deliveries} ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER invoice_id`,
    ).catch(() => null);
}
async function ensureDeliverySequenceTableTx(conn) {
  await conn
    .execute(
      `
      CREATE TABLE IF NOT EXISTS sal_delivery_sequences (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        prefix VARCHAR(10) NOT NULL DEFAULT 'DN',
        next_number BIGINT UNSIGNED NOT NULL DEFAULT 1,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_delivery_seq_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
    )
    .catch(() => null);
}
async function nextDeliveryNoTx(conn, { companyId, branchId, branchIdsStr }) {
  await ensureDeliverySequenceTableTx(conn);
  const [rows] = await conn.execute(
    `
    SELECT prefix, next_number
    FROM sal_delivery_sequences
    WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
    FOR UPDATE
    `,
    { companyId, branchId },
  );
  if (!rows?.length) {
    const [maxRows] = await conn.execute(
      `
      SELECT delivery_no
      FROM sal_deliveries
      WHERE company_id = :companyId
        AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        AND delivery_no REGEXP '^DN-?[0-9]{6}$'
      ORDER BY CAST(REPLACE(delivery_no, 'DN-', '') AS UNSIGNED) DESC
      LIMIT 1
      `,
      { companyId, branchId, branchIdsStr },
    );
    let startNext = 1;
    if (maxRows?.length) {
      const prev = String(maxRows[0].delivery_no || "");
      const numPart = prev.replace(/^DN-?/, "");
      const n = parseInt(numPart, 10);
      if (Number.isFinite(n)) startNext = n + 1;
    }
    await conn.execute(
      `
      INSERT INTO sal_delivery_sequences (company_id, branch_id, prefix, next_number)
      VALUES (:companyId, :branchId, 'DN', :next)
      `,
      { companyId, branchId, branchIdsStr, next: startNext },
    );
  }
  const [seqRows] = await conn.execute(
    `
    SELECT prefix, next_number
    FROM sal_delivery_sequences
    WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
    LIMIT 1
    `,
    { companyId, branchId, branchIdsStr },
  );
  const seq = seqRows?.[0];
  if (!seq)
    throw httpError(500, "SERVER_ERROR", "Delivery sequence not initialized");
  const nextNo = `${seq.prefix}${String(seq.next_number).padStart(6, "0")}`;
  await conn.execute(
    `
    UPDATE sal_delivery_sequences
       SET next_number = next_number + 1
     WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
    `,
    { companyId, branchId, branchIdsStr },
  );
  return nextNo;
}
async function hasTrigger(triggerName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.triggers
    WHERE trigger_name = :triggerName
      AND trigger_schema = DATABASE()
    `,
    { triggerName },
  ).catch(() => []);
  return Number(rows?.[0]?.c || 0) > 0;
}
let _triggersEnsured = false;
async function ensureStandardPriceSyncTriggersOnce() {
  if (_triggersEnsured) return;
  await ensureStandardPriceSyncTriggers();
  await pool
    .query(
      `CREATE INDEX idx_best_price ON sal_standard_prices (company_id, product_id, price_type_id, branch_id)`,
    )
    .catch(() => null);
  _triggersEnsured = true;
}
async function ensureStandardPriceSyncTriggers() {
  if (!(await hasTrigger("tr_sal_standard_prices_ai_item_price"))) {
    await pool
      .query(
        `
        CREATE TRIGGER tr_sal_standard_prices_ai_item_price
        AFTER INSERT ON sal_standard_prices
        FOR EACH ROW
        BEGIN
          UPDATE inv_items
             SET selling_price = NEW.selling_price
           WHERE company_id = NEW.company_id
             AND id = NEW.product_id;
        END
        `,
      )
      .catch(() => null);
  }
  if (!(await hasTrigger("tr_sal_standard_prices_au_item_price"))) {
    await pool
      .query(
        `
        CREATE TRIGGER tr_sal_standard_prices_au_item_price
        AFTER UPDATE ON sal_standard_prices
        FOR EACH ROW
        BEGIN
          UPDATE inv_items
             SET selling_price = NEW.selling_price
           WHERE company_id = NEW.company_id
             AND id = NEW.product_id;
        END
        `,
      )
      .catch(() => null);
  }
}
async function nextSalesReturnNo(companyId, branchId) {
  const rows = await query(
    `SELECT return_no,
          created_at,
          u.username AS created_by_name
         FROM sal_returns
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
       AND return_no REGEXP '^SR-[0-9]{6}$'
     ORDER BY CAST(SUBSTRING(return_no, 4) AS UNSIGNED) DESC
     LIMIT 1`,
    { companyId, branchId, branchIdsStr },
  ).catch(() => []);
  let nextNum = 1;
  if (rows.length) {
    const prev = String(rows[0].return_no || "");
    const num = parseInt(prev.slice(3), 10);
    if (Number.isFinite(num)) nextNum = num + 1;
  }
  return `SR-${String(nextNum).padStart(6, "0")}`;
}

async function userHasExceptionalAllow(userId, permissionCode = null) {
  const rows = await query(
    `
    SELECT 1,
          created_at,
          u.username AS created_by_name
         FROM adm_exceptional_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :uid
       AND effect = 'ALLOW'
       AND is_active = 1
       ${permissionCode ? "AND permission_code = :code" : ""}
     LIMIT 1
    `,
    { uid: userId, code: permissionCode || undefined },
  ).catch(() => []);
  return rows.length > 0;
}
function toYmd(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
async function resolveVoucherTypeIdByCode(conn, { companyId, code }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = :code AND is_active = 1 LIMIT 1",
    { companyId, code },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}
async function ensureCreditNoteVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "CN",
  });
  if (existingId) return existingId;
  try {
    await conn.execute(
      `
      INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
      VALUES
        (:companyId, 'CN', 'Credit Note', 'CREDIT_NOTE', 'CN', 1, 0, 1)
      `,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }
  const id = await resolveVoucherTypeIdByCode(conn, { companyId, code: "CN" });
  return id || 0;
}
async function nextVoucherNoTx(conn, { companyId, voucherTypeId }) {
  const [rows] = await conn.execute(
    "SELECT prefix, next_number FROM fin_voucher_types WHERE company_id = :companyId AND id = :voucherTypeId LIMIT 1",
    { companyId, voucherTypeId },
  );
  const vt = rows?.[0];
  if (!vt) throw httpError(404, "NOT_FOUND", "Voucher type not found");
  const voucherNo = `${vt.prefix}${String(vt.next_number).padStart(6, "0")}`;
  await conn.execute(
    "UPDATE fin_voucher_types SET next_number = next_number + 1 WHERE company_id = :companyId AND id = :voucherTypeId",
    { companyId, voucherTypeId },
  );
  return voucherNo;
}
async function ensureInvoiceSequenceTableTx(conn) {
  await conn
    .execute(
      `
      CREATE TABLE IF NOT EXISTS sal_invoice_sequences (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        prefix VARCHAR(10) NOT NULL DEFAULT 'INV',
        next_number BIGINT UNSIGNED NOT NULL DEFAULT 1,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_invoice_seq_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
    )
    .catch(() => null);
}
async function nextInvoiceNoTx(conn, { companyId, branchId, branchIdsStr }) {
  await ensureInvoiceSequenceTableTx(conn);
  const [rows] = await conn.execute(
    `
    SELECT prefix, next_number
    FROM sal_invoice_sequences
    WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
    FOR UPDATE
    `,
    { companyId, branchId },
  );
  if (!rows?.length) {
    const [maxRows] = await conn.execute(
      `
      SELECT invoice_no
      FROM srv_service_invoices
      WHERE company_id = :companyId
        AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        AND invoice_no REGEXP '^INV-?[0-9]{6}$'
      ORDER BY CAST(REPLACE(invoice_no, 'INV-', '') AS UNSIGNED) DESC
      LIMIT 1
      `,
      { companyId, branchId, branchIdsStr },
    );
    let startNext = 1;
    if (maxRows?.length) {
      const prev = String(maxRows[0].invoice_no || "");
      const numPart = prev.replace(/^INV-?/, "");
      const n = parseInt(numPart, 10);
      if (Number.isFinite(n)) startNext = n + 1;
    }
    await conn.execute(
      `
      INSERT INTO sal_invoice_sequences (company_id, branch_id, prefix, next_number)
      VALUES (:companyId, :branchId, 'INV', :next)
      `,
      { companyId, branchId, branchIdsStr, next: startNext },
    );
  }
  const [seqRows] = await conn.execute(
    `
    SELECT prefix, next_number
    FROM sal_invoice_sequences
    WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
    LIMIT 1
    `,
    { companyId, branchId, branchIdsStr },
  );
  const seq = seqRows?.[0];
  if (!seq) throw httpError(500, "SERVER_ERROR", "Sequence not initialized");
  const nextNo = `${seq.prefix}${String(seq.next_number).padStart(6, "0")}`;
  await conn.execute(
    `
    UPDATE sal_invoice_sequences
       SET next_number = next_number + 1
     WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
    `,
    { companyId, branchId, branchIdsStr },
  );
  return nextNo;
}
async function resolveOpenFiscalYearId(conn, { companyId }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_fiscal_years WHERE company_id = :companyId AND is_open = 1 ORDER BY start_date DESC LIMIT 1",
    { companyId },
  );
  const id = Number(rows?.[0]?.id || 0);
  if (id) return id;
  const today = new Date();
  const todayYmd = toYmd(today);
  if (!todayYmd) return 0;
  const [inRangeRows] = await conn.execute(
    `
    SELECT id, is_open
    FROM fin_fiscal_years
    WHERE company_id = :companyId
      AND :todayYmd >= start_date
      AND :todayYmd <= end_date
    ORDER BY start_date DESC
    LIMIT 1
    `,
    { companyId, todayYmd },
  );
  const inRange = inRangeRows?.[0] || null;
  const inRangeId = Number(inRange?.id || 0) || 0;
  if (inRangeId) {
    if (Number(inRange?.is_open) !== 1) {
      await conn.execute(
        "UPDATE fin_fiscal_years SET is_open = 1 WHERE company_id = :companyId AND id = :id",
        { companyId, id: inRangeId },
      );
    }
    return inRangeId;
  }
  const [companyRows] = await conn.execute(
    "SELECT fiscal_year_start_month FROM adm_companies WHERE id = :companyId LIMIT 1",
    { companyId },
  );
  let startMonth = Number(companyRows?.[0]?.fiscal_year_start_month || 1);
  if (!Number.isFinite(startMonth) || startMonth < 1 || startMonth > 12) {
    startMonth = 1;
  }
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const startYear = currentMonth >= startMonth ? currentYear : currentYear - 1;
  const endYear = startYear + 1;
  const startDateObj = new Date(startYear, startMonth - 1, 1);
  const nextStartObj = new Date(endYear, startMonth - 1, 1);
  const endDateObj = new Date(nextStartObj);
  endDateObj.setDate(endDateObj.getDate() - 1);
  const startDate = toYmd(startDateObj);
  const endDate = toYmd(endDateObj);
  if (!startDate || !endDate) return 0;
  const codeBase =
    startMonth === 1
      ? `FY${startYear}`
      : `FY${startYear}/${String(endYear).slice(-2)}`;
  let code = codeBase;
  for (let i = 0; i < 5; i += 1) {
    const [existsRows] = await conn.execute(
      "SELECT id FROM fin_fiscal_years WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code },
    );
    if (!existsRows?.length) break;
    code = `${codeBase}-${i + 1}`;
  }
  const [ins] = await conn.execute(
    `
    INSERT INTO fin_fiscal_years (company_id, code, start_date, end_date, is_open)
    VALUES (:companyId, :code, :startDate, :EndDate, 1)
    `,
    { companyId, code, startDate, EndDate: endDate },
  );
  const newId = Number(ins?.insertId || 0) || 0;
  return newId;
}
async function resolveFinAccountId(conn, { companyId, accountRef }) {
  const raw = String(accountRef || "").trim();
  if (!raw) return 0;
  const asId = Number(raw);
  if (Number.isFinite(asId) && asId > 0) {
    const [rows] = await conn.execute(
      "SELECT id FROM fin_accounts WHERE company_id = :companyId AND id = :id LIMIT 1",
      { companyId, id: asId },
    );
    return Number(rows?.[0]?.id || 0) || 0;
  }
  const [rows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code: raw },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}
async function resolveDefaultSalesAccountId(conn, { companyId }) {
  const [rows] = await conn.execute(
    `
    SELECT a.id
    FROM fin_accounts a
    JOIN fin_account_groups g ON g.id = a.group_id
    WHERE a.company_id = :companyId
      AND a.is_active = 1
      AND a.is_postable = 1
      AND g.nature = 'INCOME'
    ORDER BY
      CASE
        WHEN a.code IN ('4000','400000') THEN 0
        WHEN LOWER(a.name) LIKE '%sales%' THEN 1
        WHEN LOWER(a.code) LIKE '4%' THEN 2
        ELSE 3
      END,
      a.code
    LIMIT 1
    `,
    { companyId },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}
async function ensureGroupIdTx(
  conn,
  { companyId, code, name, nature, parentId = null },
) {
  const [existingRows] = await conn.execute(
    "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND (code = :code OR name = :name) LIMIT 1",
    { companyId, code, name },
  );
  const existingId = Number(existingRows?.[0]?.id || 0) || 0;
  if (existingId) return existingId;
  const [ins] = await conn.execute(
    `INSERT INTO fin_account_groups
      (company_id, code, name, nature, parent_id, is_active)
     VALUES
      (:companyId, :code, :name, :nature, :parentId, 1)`,
    { companyId, code, name, nature, parentId },
  );
  return Number(ins?.insertId || 0) || 0;
}
async function resolveUniqueAccountCodeTx(
  conn,
  { companyId, preferredCode, ownerAccountId, fallbackPrefix },
) {
  const preferred = String(preferredCode || "").trim();
  const ownerId = Number(ownerAccountId || 0) || 0;
  const baseFallback = String(fallbackPrefix || "ACC")
    .trim()
    .replace(/\s+/g, "-");
  const candidates = [];
  if (preferred) candidates.push(preferred);
  candidates.push(baseFallback);
  for (let i = 1; i <= 50; i += 1) candidates.push(`${baseFallback}-${i}`);
  for (const candidate of candidates) {
    const [rows] = await conn.execute(
      "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code: candidate },
    );
    const existingId = Number(rows?.[0]?.id || 0) || 0;
    if (!existingId || existingId === ownerId) return candidate;
  }
  return preferred || `${baseFallback}-${Date.now()}`;
}
async function resolveCurrencyIdByCodeOrBaseTx(conn, { companyId, code }) {
  const wanted = String(code || "")
    .trim()
    .toUpperCase();
  if (wanted) {
    const [rows] = await conn.execute(
      "SELECT id FROM fin_currencies WHERE company_id = :companyId AND UPPER(code) = :code LIMIT 1",
      { companyId, code: wanted },
    );
    const id = Number(rows?.[0]?.id || 0) || 0;
    if (id) return id;
  }
  const [baseRows] = await conn.execute(
    "SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
    { companyId },
  );
  return Number(baseRows?.[0]?.id || 0) || 0;
}
async function ensureSalesVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "SV",
  });
  if (existingId) return existingId;
  try {
    await conn.execute(
      `INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
       VALUES
        (:companyId, 'SV', 'Sales Voucher', 'SALES', 'SV', 1, 0, 1)`,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }
  return await resolveVoucherTypeIdByCode(conn, { companyId, code: "SV" });
}
async function ensureDefaultSalesAccountIdTx(conn, { companyId }) {
  const existingId = await resolveDefaultSalesAccountId(conn, { companyId });
  if (existingId) return existingId;
  const groupId = await ensureGroupIdTx(conn, {
    companyId,
    code: "SALES",
    name: "Sales",
    nature: "INCOME",
  });
  const currencyId =
    (await resolveCurrencyIdByCodeOrBaseTx(conn, { companyId, code: "GHS" })) ||
    null;
  const [rows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND (LOWER(name) = 'sales' OR code IN ('4000','400000')) LIMIT 1",
    { companyId },
  );
  const existing = Number(rows?.[0]?.id || 0) || 0;
  if (existing) return existing;
  const [ins] = await conn.execute(
    `INSERT INTO fin_accounts
      (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
     VALUES
      (:companyId, :groupId, '4000', 'Sales', :currencyId, 0, 1, 1)`,
    { companyId, groupId, currencyId },
  );
  return Number(ins?.insertId || 0) || 0;
}
async function fetchItemSalesAccountMap(conn, { companyId, itemIds }) {
  const ids = Array.from(
    new Set((Array.isArray(itemIds) ? itemIds : []).map((n) => Number(n))),
  ).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return new Map();
  const placeholders = ids.map((_, idx) => `:id${idx}`).join(", ");
  const params = { companyId };
  for (let i = 0; i < ids.length; i += 1) {
    params[`id${i}`] = ids[i];
  }
  const [rows] = await conn.execute(
    `SELECT id, sales_account_id FROM inv_items WHERE company_id = :companyId AND id IN (${placeholders})`,
    params,
  );
  const m = new Map();
  for (const r of rows || []) {
    m.set(Number(r.id), Number(r.sales_account_id || 0));
  }
  return m;
}
async function ensureTaxComponentAccountTx(
  conn,
  { companyId, taxDetailId, componentName },
) {
  const safeName = String(componentName || "").trim();
  if (!safeName) return 0;
  const groupId = await ensureGroupIdTx(conn, {
    companyId,
    code: "TAXPAY",
    name: "Tax Payables",
    nature: "LIABILITY",
  });
  const currencyId =
    (await resolveCurrencyIdByCodeOrBaseTx(conn, { companyId, code: "GHS" })) ||
    null;
  const code = `TAX-${String(Number(taxDetailId || 0)).padStart(4, "0")}`;
  const [existingRows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  const existingId = Number(existingRows?.[0]?.id || 0) || 0;
  if (existingId) {
    await conn.execute(
      `UPDATE fin_accounts
          SET group_id = :groupId,
              name = :name,
              currency_id = :currencyId,
              is_active = 1
        WHERE company_id = :companyId AND id = :id`,
      { companyId, id: existingId, groupId, name: safeName, currencyId },
    );
    return existingId;
  }
  const [ins] = await conn.execute(
    `INSERT INTO fin_accounts
      (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
     VALUES
      (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
    { companyId, groupId, code, name: safeName, currencyId },
  );
  return Number(ins?.insertId || 0) || 0;
}
async function loadTaxComponentsByCodeTx(conn, { companyId, taxCodeId }) {
  const [rows] = await conn.execute(
    `SELECT c.tax_detail_id,
            COALESCE(c.rate_percent, d.rate_percent, 0) AS rate_percent,
            COALESCE(c.compound_level, 0) AS compound_level,
            COALESCE(c.sort_order, 100) AS sort_order,
            d.component_name
       FROM fin_tax_components c
       JOIN fin_tax_details d
         ON d.id = c.tax_detail_id
      WHERE c.company_id = :companyId
        AND c.tax_code_id = :taxCodeId
        AND c.is_active = 1
      ORDER BY c.compound_level ASC, c.sort_order ASC, d.component_name ASC`,
    { companyId, taxCodeId },
  );
  return Array.isArray(rows) ? rows : [];
}
function allocateTaxComponents(baseAmount, taxAmount, components) {
  const base = Math.max(0, Number(baseAmount || 0));
  const expectedTax = Math.max(0, Number(taxAmount || 0));
  const list = Array.isArray(components) ? components : [];
  if (!list.length || !(expectedTax > 0)) return [];
  const grouped = new Map();
  for (const comp of list) {
    const level = Number(comp.compound_level || 0);
    if (!grouped.has(level)) grouped.set(level, []);
    grouped.get(level).push(comp);
  }
  const levels = Array.from(grouped.keys()).sort((a, b) => a - b);
  let currentBase = base;
  const raw = [];
  for (const level of levels) {
    const comps = grouped.get(level) || [];
    let levelTotal = 0;
    for (const comp of comps) {
      const amt = (currentBase * Number(comp.rate_percent || 0)) / 100;
      raw.push({ ...comp, amount: amt });
      levelTotal += amt;
    }
    currentBase += levelTotal;
  }
  const rounded = raw.map((r) => ({
    ...r,
    amount: Math.round(Number(r.amount || 0) * 100) / 100,
  }));
  const totalRounded = rounded.reduce((s, r) => s + Number(r.amount || 0), 0);
  const diff = Math.round((expectedTax - totalRounded) * 100) / 100;
  if (rounded.length && Math.abs(diff) > 0.00001) {
    rounded[rounded.length - 1].amount =
      Math.round(
        (Number(rounded[rounded.length - 1].amount || 0) + diff) * 100,
      ) / 100;
  }
  return rounded.filter((r) => Number(r.amount || 0) > 0);
}

async function calculateInvoiceTaxLines(
  conn,
  { companyId, details, taxTotal },
) {
  const voucherTaxLines = [];
  for (const l of details) {
    const qty = Number(l.qty || l.quantity || 0);
    const price = Number(l.unit_price || 0);
    const discPct = Number(l.discount_percent || 0);
    const gross = qty * price;
    const discount = (gross * discPct) / 100;
    const net = gross - discount;
    const taxAmt = Number(l.taxAmt || l.tax_amount || 0);
    const taxCodeId = Number(l.tax_type || l.taxType || l.tax_id || 0) || 0;
    if (taxCodeId && taxAmt > 0) {
      const components = await loadTaxComponentsByCodeTx(conn, {
        companyId,
        taxCodeId,
      });
      const allocations = allocateTaxComponents(net, taxAmt, components);
      if (allocations.length) {
        voucherTaxLines.push(...allocations);
      }
    }
  }

  const taxCreditLines = [];
  for (const tl of voucherTaxLines) {
    const key = `${tl.tax_detail_id}|${tl.component_name}`;
    const found = taxCreditLines.find(
      (x) => `${x.tax_detail_id}|${x.component_name}` === key,
    );
    if (found) found.amount += Number(tl.amount || 0);
    else taxCreditLines.push({ ...tl, amount: Number(tl.amount || 0) });
  }

  const creditedTax = taxCreditLines.reduce(
    (s, x) => s + Number(x.amount || 0),
    0,
  );
  if (Math.abs(creditedTax - taxTotal) > 0.009) {
    const diff = Math.round((taxTotal - creditedTax) * 100) / 100;
    if (taxCreditLines.length) {
      taxCreditLines[taxCreditLines.length - 1].amount =
        Math.round(
          (Number(taxCreditLines[taxCreditLines.length - 1].amount || 0) +
            diff) *
            100,
        ) / 100;
    }
  }

  return taxCreditLines;
}
async function createPostedSalesVoucherForInvoiceTx(
  conn,
  {
    companyId,
    branchId, branchIdsStr,
    invoiceId,
    invoiceNo,
    invoiceDate,
    customerId,
    grandTotal,
    baseTotal,
    taxTotal,
    discountTotal,
    currencyId,
    exchangeRate,
    createdBy,
    lineTaxes,
    itemLines,
    remarks,
  },
) {
  const [custRows] = await conn.execute(
    "SELECT customer_name FROM sal_customers WHERE id = :customerId LIMIT 1",
    { customerId },
  );
  const customerName = custRows?.[0]?.customer_name || "Customer";
  if (!(Number(grandTotal || 0) > 0)) return 0;
  const [existingRows] = await conn.execute(
    `SELECT v.id
       FROM fin_vouchers v
       JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
       JOIN fin_voucher_lines l ON l.voucher_id = v.id
      WHERE v.company_id = :companyId
        AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        AND vt.code = 'SV'
        AND l.reference_no = :ref
      LIMIT 1`,
    { companyId, branchId, branchIdsStr, ref: invoiceNo },
  );
  const existingId = Number(existingRows?.[0]?.id || 0) || 0;
  if (existingId) {
    await conn.execute(
      "DELETE FROM fin_voucher_lines WHERE voucher_id = :vid",
      { vid: existingId },
    );
    await conn.execute("DELETE FROM fin_vouchers WHERE id = :vid", {
      vid: existingId,
    });
  }
  const voucherTypeId = await ensureSalesVoucherTypeIdTx(conn, { companyId });
  const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
  const voucherNo = await nextVoucherNoTx(conn, { companyId, voucherTypeId });
  const customerAccountId = await ensureCustomerFinAccountIdTx(conn, {
    companyId,
    customerId,
  });
  const defaultSalesAccountId = await ensureDefaultSalesAccountIdTx(conn, {
    companyId,
  });
  if (
    !customerAccountId ||
    !defaultSalesAccountId ||
    !voucherTypeId ||
    !fiscalYearId
  ) {
    throw httpError(
      400,
      "VALIDATION_ERROR",
      "Unable to resolve customer, sales account, voucher type, or fiscal year for invoice posting",
    );
  }
  const itemIds = (Array.isArray(itemLines) ? itemLines : [])
    .map((l) => Number(l.item_id || 0))
    .filter((n) => n > 0);
  const itemSalesAccountMap = await fetchItemSalesAccountMap(conn, {
    companyId,
    itemIds,
  });
  const [hdr] = await conn.execute(
    `INSERT INTO fin_vouchers
      (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, balanced_amount, status, created_by)
     VALUES
      (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, :exchangeRate, :td, :tc, :ba, 'POSTED', :createdBy)`,
    {
      companyId,
      branchId, branchIdsStr,
      fiscalYearId,
      voucherTypeId,
      voucherNo,
      voucherDate: invoiceDate || toYmd(new Date()),
      narration: `Sales made...... Invoice ${invoiceNo} to ${customerName}${remarks ? " - " + remarks : ""}`,
      currencyId: currencyId || null,
      exchangeRate: exchangeRate || 1,
      td: grandTotal,
      tc: grandTotal,
      ba: grandTotal,
      createdBy: createdBy || null,
    },
  );
  const voucherId = Number(hdr?.insertId || 0) || 0;
  let lineNo = 1;
  await conn.execute(
    `INSERT INTO fin_voucher_lines
      (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
     VALUES
      (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref)`,
    {
      companyId,
      voucherId,
      lineNo: lineNo++,
      accountId: customerAccountId,
      description: `Customer receivable for ${invoiceNo}`,
      debit: grandTotal,
      ref: invoiceNo,
    },
  );
  const salesCreditByAccount = new Map();
  for (const item of Array.isArray(itemLines) ? itemLines : []) {
    const itemId = Number(item.item_id || 0);
    const qty = Number(item.qty || item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const discPct = Number(item.discount_percent || 0);
    const gross = qty * price;
    const discount = (gross * discPct) / 100;
    const net = gross - discount;
    let accId = Number(itemSalesAccountMap.get(itemId) || 0);
    if (!accId) accId = defaultSalesAccountId;
    const prev = salesCreditByAccount.get(accId) || 0;
    salesCreditByAccount.set(accId, prev + net);
  }
  for (const [accId, creditAmt] of salesCreditByAccount) {
    if (!(Number(creditAmt || 0) > 0)) continue;
    await conn.execute(
      `INSERT INTO fin_voucher_lines
        (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
       VALUES
        (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref)`,
      {
        companyId,
        voucherId,
        lineNo: lineNo++,
        accountId: accId,
        description: `Sales for ${invoiceNo}`,
        credit: Math.max(0, Math.round(Number(creditAmt) * 100) / 100),
        ref: invoiceNo,
      },
    );
  }
  for (const taxLine of Array.isArray(lineTaxes) ? lineTaxes : []) {
    const accountId = await ensureTaxComponentAccountTx(conn, {
      companyId,
      taxDetailId: taxLine.tax_detail_id,
      componentName: taxLine.component_name,
    });
    if (!accountId || !(Number(taxLine.amount || 0) > 0)) continue;
    await conn.execute(
      `INSERT INTO fin_voucher_lines
        (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
       VALUES
        (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref)`,
      {
        companyId,
        voucherId,
        lineNo: lineNo++,
        accountId,
        description: `${taxLine.component_name} on ${invoiceNo}`,
        credit: Math.max(0, Number(taxLine.amount || 0)),
        ref: invoiceNo,
      },
    );
  }
  return voucherId;
}

async function createSalesReturnCreditNoteTx(conn, opts) {
  const {
    companyId,
    branchId, branchIdsStr,
    return_no,
    return_date,
    customer_id,
    normalized,
    total_amount,
    tax_total,
    created_by,
    invoice_id,
  } = opts;
  const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
  const voucherTypeId = await ensureCreditNoteVoucherTypeIdTx(conn, {
    companyId,
  });
  const voucherNo = await nextVoucherNoTx(conn, { companyId, voucherTypeId });
  const voucherDate = return_date || toYmd(new Date());

  const customerAccountId = await ensureCustomerFinAccountIdTx(conn, {
    companyId,
    customerId: customer_id,
  });

  const itemSalesAccountMap = await fetchItemSalesAccountMap(conn, {
    companyId,
    itemIds: normalized.map((ln) => ln.item_id),
  });
  const defaultSalesAccountId = await ensureDefaultSalesAccountIdTx(conn, {
    companyId,
  });

  let voucherId = null;
  if (customerAccountId && fiscalYearId && voucherTypeId) {
    const [vIns] = await conn.execute(
      `INSERT INTO fin_vouchers
        (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
       VALUES
        (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :totalDebit, :totalCredit, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
      {
        companyId,
        branchId, branchIdsStr,
        fiscalYearId,
        voucherTypeId,
        voucherNo,
        voucherDate,
        narration: `Sales Return for Invoice ${return_no}`,
        totalDebit: total_amount,
        totalCredit: total_amount,
        createdBy: created_by,
        approvedBy: created_by,
        postedBy: created_by,
      },
    );
    voucherId = Number(vIns?.insertId || 0) || 0;
    let lineNo = 1;

    const salesDebitByAccount = new Map();
    for (const ln of normalized) {
      let accId = Number(itemSalesAccountMap.get(ln.item_id) || 0);
      if (!accId) accId = defaultSalesAccountId;
      const prev = salesDebitByAccount.get(accId) || 0;
      salesDebitByAccount.set(accId, prev + ln.total_amount);
    }
    for (const [accId, debitAmt] of salesDebitByAccount) {
      if (!(debitAmt > 0) || !accId) continue;
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, :ref)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: accId,
          description: `Sales Return reversal - ${return_no}`,
          debit: Math.round(debitAmt * 100) / 100,
          ref: return_no,
        },
      );
    }

    if (tax_total > 0) {
      const componentTotals = new Map();
      for (const ln of normalized) {
        if (!ln.tax_type || !(ln.tax_amount > 0)) continue;
        const comps = await loadTaxComponentsByCodeTx(conn, {
          companyId,
          taxCodeId: Number(ln.tax_type),
        });
        const allocations = allocateTaxComponents(
          ln.total_amount,
          ln.tax_amount,
          comps,
        );
        for (const alloc of allocations) {
          const accountId = await ensureTaxComponentAccountTx(conn, {
            companyId,
            taxDetailId: alloc.tax_detail_id,
            componentName: alloc.component_name,
          });
          if (!accountId) continue;
          const key = String(accountId);
          const prev = componentTotals.get(key) || {
            amount: 0,
            name: alloc.component_name,
          };
          componentTotals.set(key, {
            amount: prev.amount + Number(alloc.amount || 0),
            name: alloc.component_name,
          });
        }
      }
      for (const [accountId, ct] of componentTotals) {
        const amt = Math.round(ct.amount * 100) / 100;
        if (!(amt > 0)) continue;
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, :ref)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: Number(accountId),
            description: `${ct.name} Reversal on Sales Return - ${return_no}`,
            debit: amt,
            ref: return_no,
          },
        );
      }
    }

    let creditAccountId = customerAccountId;
    if (invoice_id) {
      const [inv] = await conn.execute(
        `SELECT payment_type FROM srv_service_invoices WHERE id = :invoice_id`,
        { invoice_id },
      );
      if (
        inv &&
        (inv.payment_type === "CASH" || inv.payment_type === "CHEQUE")
      ) {
        const [cashAccRows] = await conn.execute(
          `SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = '1000' LIMIT 1`,
          { companyId },
        );
        const cashAccId = Number(cashAccRows?.[0]?.id || 0);
        if (cashAccId) creditAccountId = cashAccId;
      }
    }
    await conn.execute(
      `INSERT INTO fin_voucher_lines
        (company_id, voucher_id, line_no, account_id, description, debit, credit, reference_no)
       VALUES
        (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, :ref)`,
      {
        companyId,
        voucherId,
        lineNo: lineNo++,
        accountId: creditAccountId,
        description: `Sales Return reversal - ${return_no}`,
        credit: total_amount,
        ref: return_no,
      },
    );
  }
  return voucherId;
}

async function createCreditNoteForReturnApprovalTx(
  conn,
  { id, companyId, branchId, branchIdsStr },
) {
  const [hdrRows] = await conn.execute(
    `SELECT * FROM sal_returns WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
    { id, companyId, branchId },
  );
  if (!hdrRows?.length) return null;
  const hdr = hdrRows[0];
  const {
    return_no,
    return_date,
    customer_id,
    total_amount,
    tax_amount,
    sub_total,
    invoice_id,
    created_by,
  } = hdr;

  const [detRows] = await conn.execute(
    `SELECT sd.*, it.vat_on_sales_id AS tax_type
     FROM sal_return_details sd
     JOIN inv_items it ON it.id = sd.item_id
     WHERE sd.return_id = :id`,
    { id },
  );
  const normalized = (detRows || []).map((d) => ({
    item_id: d.item_id,
    qty: d.qty_returned,
    unit_price: d.unit_price,
    total_amount: d.total_amount,
    tax_amount: d.tax_amount,
    tax_type: d.tax_type,
  }));
  if (!normalized.length) return null;

  return createSalesReturnCreditNoteTx(conn, {
    companyId,
    branchId, branchIdsStr,
    return_no,
    return_date,
    customer_id,
    normalized,
    total_amount,
    tax_total: tax_amount,
    created_by,
    invoice_id,
  });
}

router.get(
  "/prospects",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const q = String(req.query.q || "").trim();
      await query(`
        CREATE TABLE IF NOT EXISTS sal_prospect_customers (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          company_id BIGINT UNSIGNED NOT NULL,
          prospect_customer VARCHAR(200) NOT NULL,
          address VARCHAR(255) NULL,
          city VARCHAR(100) NULL,
          state VARCHAR(100) NULL,
          country VARCHAR(100) NULL,
          telephone VARCHAR(50) NULL,
          email VARCHAR(150) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_prospect_scope_name (company_id, prospect_customer),
          KEY idx_prospect_scope (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).catch(() => null);
      const params = { companyId };
      let where = "company_id = :companyId";
      if (q) {
        where += " AND (prospect_customer LIKE :q OR customer_name LIKE :q)";
        params.q = `%${q}%`;
      }
      const items = await query(
        `
        SELECT id, company_id, 
               COALESCE(customer_name, prospect_customer) AS prospect_customer, 
               address, city, state, country, 
               COALESCE(phone, telephone) AS telephone, 
               email,
          created_at,
          u.username AS created_by_name
         FROM sal_prospect_customers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE ${where}
        ORDER BY prospect_customer ASC
        `,
        params,
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/customers/template",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.CREATE"),
  async (req, res, next) => {
    try {
      const headers = [
        "customer_code",
        "customer_name",
        "email",
        "phone",
        "mobile",
        "contact_person",
        "address",
        "city",
        "state",
        "zone",
        "country",
        "customer_type",
        "credit_limit",
        "payment_terms",
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "CustomersTemplate");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=CustomerTemplate.xlsx",
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.send(buf);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/customers/next-code",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const rows = await query(
        `SELECT customer_code,
          created_at,
          u.username AS created_by_name
         FROM sal_customers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND customer_code REGEXP '^C(-?[0-9]+)?$'
         ORDER BY id DESC
         LIMIT 1`,
        { companyId },
      ).catch(() => []);
      let nextNum = 1;
      if (rows.length) {
        const prev = String(rows[0].customer_code || "");
        const match = prev.match(/\d+$/);
        if (match) {
          nextNum = parseInt(match[0], 10) + 1;
        }
      }
      const code = `C-${String(nextNum).padStart(6, "0")}`;
      res.json({ code });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/customers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const activeParam = String(req.query.active || "")
        .trim()
        .toLowerCase();
      // If active=false is explicitly requested, show all. Otherwise show only active.
      const onlyActive =
        activeParam === "true" || activeParam === "1" || activeParam === "";
      const params = { companyId };
      const where = ["c.company_id = :companyId"];
      if (onlyActive) where.push("c.is_active = 1");
      const items = await query(
        `SELECT 
           c.id,
           c.company_id,
           c.branch_id,
           c.customer_code,
           c.customer_name,
           c.customer_type,
           c.price_type_id,
           pt.name AS price_type_name,
           c.contact_person,
           c.email,
           c.phone,
           c.mobile,
           c.credit_limit,
           c.is_active,
           c.address,
           c.city,
           c.state,
           c.zone,
           c.country,
           c.payment_terms,
           c.currency_id,
           c.sales_account_id,
           fa.name AS sales_account_name,
          c.created_at,
          u.username AS created_by_name
         FROM sal_customers c
         LEFT JOIN sal_price_types pt
           ON pt.id = c.price_type_id AND pt.company_id = c.company_id
        LEFT JOIN adm_users u ON u.id = c.created_by
        LEFT JOIN fin_accounts fa ON fa.id = c.sales_account_id AND fa.company_id = c.company_id
         WHERE ${where.join(" AND ")}
         ORDER BY c.customer_name ASC`,
        params,
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/customers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }
      const rows = await query(
        `SELECT 
           c.*,
           pt.name AS price_type_name,
           fa.name AS sales_account_name,
          c.created_at,
          u.username AS created_by_name
         FROM sal_customers c
         LEFT JOIN sal_price_types pt
           ON pt.id = c.price_type_id AND pt.company_id = c.company_id
        LEFT JOIN adm_users u ON u.id = c.created_by
        LEFT JOIN fin_accounts fa ON fa.id = c.sales_account_id AND fa.company_id = c.company_id
         WHERE c.id = :id AND c.company_id = :companyId
         LIMIT 1`,
        { id, companyId },
      ).catch(() => []);
      if (!rows.length) throw httpError(404, "NOT_FOUND", "Customer not found");
      res.json({ item: rows[0] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.CREATE"),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const {
        customer_code,
        customer_name,
        email,
        phone,
        mobile,
        contact_person,
        address,
        city,
        state,
        zone,
        country,
        customer_type,
        price_type_id,
        currency_id,
        credit_limit,
        payment_terms,
        is_active,
        sales_account_id,
      } = req.body;

      if (!customer_name) {
        throw httpError(400, "VALIDATION_ERROR", "Customer name is required");
      }

      // Ensure created_by column exists
      await ensureCustomersTableColumns();

      const createdBy = req.user?.id || req.user?.sub || null;

      const result = await query(
        `INSERT INTO sal_customers 
         (company_id, branch_id, customer_code, customer_name, email, phone, mobile, 
          contact_person, address, city, state, zone, country, customer_type, 
          price_type_id, currency_id, credit_limit, payment_terms, is_active, sales_account_id, created_by)
         VALUES (:companyId, :branchId, :customer_code, :customer_name, :email, :phone, :mobile,
                 :contact_person, :address, :city, :state, :zone, :country, :customer_type,
                 :price_type_id, :currency_id, :credit_limit, :payment_terms, :is_active, :sales_account_id, :createdBy)`,
        {
          companyId,
          branchId, branchIdsStr,
          customer_code: customer_code || null,
          customer_name,
          email: email || null,
          phone: phone || null,
          mobile: mobile || null,
          contact_person: contact_person || null,
          address: address || null,
          city: city || null,
          state: state || null,
          zone: zone || null,
          country: country || null,
          customer_type: customer_type || "Individual",
          price_type_id: price_type_id || null,
          currency_id: currency_id || null,
          credit_limit: credit_limit || 0,
          payment_terms: payment_terms || "Net 30",
          is_active: is_active === false ? 0 : 1,
          sales_account_id: sales_account_id || null,
          createdBy,
        },
      );

      res.status(201).json({
        id: result.insertId,
        message: "Customer created successfully",
      });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/customers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.UPDATE"),
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }
      const {
        customer_code,
        customer_name,
        email,
        phone,
        mobile,
        contact_person,
        address,
        city,
        state,
        zone,
        country,
        customer_type,
        price_type_id,
        currency_id,
        credit_limit,
        payment_terms,
        is_active,
        sales_account_id,
      } = req.body;

      const isActive =
        is_active === false ||
        is_active === 0 ||
        String(is_active || "")
          .trim()
          .toLowerCase() === "false" ||
        String(is_active || "").trim() === "0"
          ? 0
          : 1;

      const result = await query(
        `UPDATE sal_customers 
         SET customer_code = :customer_code, 
             customer_name = :customer_name, 
             email = :email, 
             phone = :phone, 
             mobile = :mobile,
             contact_person = :contact_person, 
             address = :address, 
             city = :city, 
             state = :state, 
             zone = :zone, 
             country = :country, 
             customer_type = :customer_type,
             price_type_id = :price_type_id, 
             currency_id = :currency_id, 
             credit_limit = :credit_limit, 
             payment_terms = :payment_terms, 
             is_active = :is_active,
             sales_account_id = :sales_account_id
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          companyId,
          customer_code: customer_code || null,
          customer_name,
          email: email || null,
          phone: phone || null,
          mobile: mobile || null,
          contact_person: contact_person || null,
          address: address || null,
          city: city || null,
          state: state || null,
          zone: zone || null,
          country: country || null,
          customer_type: customer_type || "Individual",
          price_type_id: price_type_id || null,
          currency_id: currency_id || null,
          credit_limit: Number(credit_limit || 0) || 0,
          payment_terms: payment_terms || "Net 30",
          is_active: isActive,
          sales_account_id: sales_account_id || null,
        },
      );

      if (!result?.affectedRows) {
        throw httpError(404, "NOT_FOUND", "Customer not found");
      }

      const rows = await query(
        `SELECT 
           c.*,
           pt.name AS price_type_name,
           fa.name AS sales_account_name
         FROM sal_customers c
         LEFT JOIN sal_price_types pt
           ON pt.id = c.price_type_id AND pt.company_id = c.company_id
         LEFT JOIN fin_accounts fa
           ON fa.id = c.sales_account_id AND fa.company_id = c.company_id
         WHERE c.id = :id AND c.company_id = :companyId
         LIMIT 1`,
        { id, companyId },
      ).catch(() => []);

      res.json({
        message: "Customer updated successfully",
        id,
        item: rows?.[0] || null,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/deliveries",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureDeliveryTables();
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const {
        delivery_no,
        delivery_date,
        customer_id,
        sales_order_id,
        invoice_id,
        remarks,
        status,
        items,
      } = req.body || {};
      const ddate = delivery_date ? String(delivery_date).slice(0, 10) : null;
      const custId = Number(customer_id);
      const soId = sales_order_id == null ? null : Number(sales_order_id);
      const st = String(status || "DRAFT")
        .trim()
        .toUpperCase();
      if (!ddate || !Number.isFinite(custId)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        let warehouseId = null;
        const invoiceIdNum =
          invoice_id == null ? null : Number(invoice_id || 0) || null;
        if (invoiceIdNum) {
          const [invRows] = await conn.execute(
            `
            SELECT warehouse_id
            FROM srv_service_invoices
            WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
            LIMIT 1
            `,
            { id: invoiceIdNum, companyId, branchId },
          );
          if (invRows?.length) {
            warehouseId =
              invRows[0].warehouse_id == null
                ? null
                : Number(invRows[0].warehouse_id) || null;
          }
        }
        let finalDeliveryNo = String(delivery_no || "").trim();
        if (!finalDeliveryNo) {
          finalDeliveryNo = await nextDeliveryNoTx(conn, {
            companyId,
            branchId, branchIdsStr,
          });
        } else {
          const [dupRows] = await conn.execute(
            `
            SELECT id
            FROM sal_deliveries
            WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND delivery_no = :delivery_no
            LIMIT 1
            `,
            { companyId, branchId, delivery_no: finalDeliveryNo },
          );
          if (dupRows?.length) {
            finalDeliveryNo = await nextDeliveryNoTx(conn, {
              companyId,
              branchId, branchIdsStr,
            });
          }
        }
        const userId = Number(req.user?.sub || req.user?.id);
        const [ins] = await conn.execute(
          `
          INSERT INTO sal_deliveries
            (company_id, branch_id, delivery_no, delivery_date, customer_id, sales_order_id, invoice_id, remarks, status,
             delivery_instructions, terms_and_conditions, total_tax, invoice_amount, created_by)
          VALUES
            (:companyId, :branchId, :delivery_no, DATE(:delivery_date), :customer_id, :sales_order_id, :invoice_id, :remarks, :status,
             :delivery_instructions, :terms_and_conditions, :total_tax, :invoice_amount, :created_by)
          `,
          {
            companyId,
            branchId, branchIdsStr,
            delivery_no: finalDeliveryNo,
            delivery_date: ddate,
            customer_id: custId,
            sales_order_id: Number.isFinite(soId) ? soId : null,
            invoice_id: invoiceIdNum,
            remarks: remarks || null,
            status: st,
            delivery_instructions: req.body.delivery_instructions || null,
            terms_and_conditions: req.body.terms_and_conditions || null,
            total_tax: Number(req.body.total_tax || 0),
            invoice_amount: Number(req.body.invoice_amount || 0),
            created_by: userId || null,
          },
        );
        const deliveryId = ins.insertId;
        const arr = Array.isArray(items) ? items : [];
        for (const it of arr) {
          const item_id = Number(it?.item_id);
          const quantity = Number(it?.quantity || 0);
          const unit_price = Number(it?.unit_price || 0);
          const uom = String(it?.uom || "PCS").trim();
          if (!Number.isFinite(item_id) || quantity <= 0) continue;
          await conn.execute(
            `INSERT INTO sal_delivery_details
               (delivery_id, item_id, quantity, unit_price, uom)
             VALUES
               (:delivery_id, :item_id, :quantity, :unit_price, :uom)`,
            {
              delivery_id: deliveryId,
              item_id,
              quantity,
              unit_price,
              uom,
            },
          );
          // Stock deduction is now handled inside allocateFromBatchesTx
          await allocateFromBatchesTx(conn, {
            companyId,
            branchId, branchIdsStr,
            warehouseId: Number(warehouseId || 0),
            itemId: item_id,
            qty: quantity,
            refType: "DELIVERY",
            refId: deliveryId,
            refDate: ddate,
            preferredBatchId: it?.batch_id || null,
          });
        }
        await conn.commit();
        const [item] = await query(
          `
          SELECT
            d.id,
            d.delivery_no,
            d.delivery_date,
            d.sales_order_id,
            d.invoice_id,
            d.customer_id,
            COALESCE(c.customer_name, '') AS customer_name,
            d.status,
          d.created_at,
          u.username AS created_by_name
         FROM sal_deliveries d
          LEFT JOIN sal_customers c
            ON c.id = d.customer_id AND c.company_id = d.company_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.id = :id
          LIMIT 1
          `,
          { id: deliveryId },
        ).catch(() => []);
        res.status(201).json({ item });
      } catch (err) {
        try {
          await conn.rollback();
        } catch {}
        throw err;
      } finally {
        conn.release();
      }
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/deliveries/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureDeliveryTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const {
        delivery_no,
        delivery_date,
        customer_id,
        sales_order_id,
        invoice_id,
        remarks,
        status,
        delivery_instructions,
        terms_and_conditions,
        total_tax,
        invoice_amount,
        items,
      } = req.body || {};
      const dno = String(delivery_no || "").trim();
      const ddate = delivery_date ? String(delivery_date).slice(0, 10) : null;
      const custId = Number(customer_id);
      const soId = sales_order_id == null ? null : Number(sales_order_id);
      const invId = invoice_id == null ? null : Number(invoice_id);
      const st = String(status || "DRAFT")
        .trim()
        .toUpperCase();
      const [existing] = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM sal_deliveries
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Delivery not found");
      await query(
        `
         UPDATE sal_deliveries
            SET delivery_no = :delivery_no,
                delivery_date = DATE(:delivery_date),
                customer_id = :customer_id,
                sales_order_id = :sales_order_id,
                invoice_id = :invoice_id,
                remarks = :remarks,
                status = :status,
                delivery_instructions = :delivery_instructions,
                terms_and_conditions = :terms_and_conditions,
                total_tax = :total_tax,
                invoice_amount = :invoice_amount
          WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        `,
        {
          id,
          companyId,
          branchId, branchIdsStr,
          delivery_no: dno,
          delivery_date: ddate,
          customer_id: custId,
          sales_order_id: Number.isFinite(soId) ? soId : null,
          invoice_id: Number.isFinite(invId) ? invId : null,
          remarks: remarks || null,
          status: st,
          delivery_instructions: delivery_instructions || null,
          terms_and_conditions: terms_and_conditions || null,
          total_tax: Number(total_tax || 0),
          invoice_amount: Number(invoice_amount || 0),
        },
      );
      await query(
        `
        DELETE FROM sal_delivery_details
        WHERE delivery_id = :id
        `,
        { id },
      );
      const arr = Array.isArray(items) ? items : [];
      for (const it of arr) {
        const item_id = Number(it?.item_id);
        const quantity = Number(it?.quantity || 0);
        const unit_price = Number(it?.unit_price || 0);
        const uom = String(it?.uom || "PCS").trim();
        if (!Number.isFinite(item_id) || quantity <= 0) continue;
        await query(
          `
          INSERT INTO sal_delivery_details
            (delivery_id, item_id, quantity, unit_price, uom)
          VALUES
            (:delivery_id, :item_id, :quantity, :unit_price, :uom)
          `,
          {
            delivery_id: id,
            item_id,
            quantity,
            unit_price,
            uom,
          },
        );
      }
      res.json({ id });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/price-types",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.CUSTOMER.VIEW",
    "SAL.ORDER.VIEW",
    "SAL.INVOICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const active = String(req.query.active || "")
        .trim()
        .toLowerCase();
      const onlyActive = active === "true" || active === "1";
      const params = { companyId };
      const where = ["company_id = :companyId"];
      if (onlyActive) where.push("is_active = 1");
      const items = await query(
        `SELECT id, name, description, is_active,
          created_at,
          u.username AS created_by_name
         FROM sal_price_types
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE ${where.join(" AND ")}
          ORDER BY name ASC`,
        params,
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/price-types",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const { priceTypes } = req.body;
      const createdBy = req.user?.sub || null;
      if (!Array.isArray(priceTypes)) {
        throw { status: 400, message: "Invalid payload" };
      }
      for (const pt of priceTypes) {
        if (!pt.name?.trim()) continue;
        if (pt.id) {
          await query(
            `UPDATE sal_price_types 
             SET name = :name, description = :description, is_active = :is_active 
             WHERE id = :id AND company_id = :companyId`,
            {
              id: pt.id,
              companyId,
              name: pt.name.trim(),
              description: pt.description || null,
              is_active: pt.is_active === 0 || pt.is_active === false ? 0 : 1,
            },
          );
        } else {
          await query(
            `INSERT INTO sal_price_types (company_id, name, description, is_active, created_by) 
             VALUES (:companyId, :name, :description, :is_active, :created_by)`,
            {
              companyId,
              name: pt.name.trim(),
              description: pt.description || null,
              is_active: pt.is_active === 0 || pt.is_active === false ? 0 : 1,
              created_by: createdBy,
            },
          );
        }
      }
      res.json({ message: "Price types saved successfully" });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/price-types/:id",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        throw { status: 400, message: "Invalid id" };
      }
      await query(
        `DELETE FROM sal_price_types WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      res.json({ message: "Price type deleted successfully" });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/quotations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.QUOTATION.VIEW",
    "SAL.ORDER.VIEW",
    "SAL.INVOICE.VIEW",
  ]),
  cacheListResponse(30),
  async (req, res, next) => {
    try {
      await ensureQuotationTables();
      await ensureQuotationDetailsTable();
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
      const items = await query(
        `SELECT 
           q.id,
           q.quotation_no,
           q.quotation_date,
           q.customer_id,
           COALESCE(
             NULLIF(q.customer_name, ''), 
             c.customer_name, 
             p.customer_name, 
             p.prospect_customer, 
             ''
           ) AS customer_name,
           COALESCE(q.valid_until, q.quotation_date) AS valid_until,
           q.total_amount,
           q.status,
           q.price_type,
           q.payment_type,
           q.currency_id,
           q.exchange_rate,
          q.created_at,
          u.username AS created_by_name
         FROM sal_quotations q
         LEFT JOIN sal_customers c
           ON c.id = q.customer_id AND c.company_id = q.company_id
         LEFT JOIN sal_prospect_customers p
           ON p.id = q.customer_id AND p.company_id = q.company_id
        LEFT JOIN adm_users u ON u.id = q.created_by
          WHERE q.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(q.branch_id, :branchIdsStr))
          ORDER BY q.quotation_date DESC, q.id DESC`,
         { companyId, branchId, branchIdsStr },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/quotations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.QUOTATION.VIEW",
    "SAL.ORDER.VIEW",
    "SAL.INVOICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      await ensureQuotationTables();
      await ensureQuotationDetailsTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }
      const rows = await query(
        `
        SELECT
          q.id,
          q.quotation_no,
          q.quotation_date,
          q.customer_id,
          COALESCE(
            NULLIF(q.customer_name, ''), 
            c.customer_name, 
            p.customer_name, 
            p.prospect_customer, 
            ''
          ) AS customer_name,
          q.customer_address,
          q.customer_city,
          q.customer_state,
          q.customer_country,
          q.valid_days,
          q.valid_until,
          q.total_amount,
          q.net_amount,
          q.tax_amount,
          q.status,
          q.price_type,
          q.payment_type,
          q.currency_id,
          q.exchange_rate,
          q.warehouse_id,
          q.remarks,
          q.terms_and_conditions,
          q.created_at,
          u.username AS created_by_name
         FROM sal_quotations q
        LEFT JOIN sal_customers c
          ON c.id = q.customer_id AND c.company_id = q.company_id
        LEFT JOIN sal_prospect_customers p
          ON p.id = q.customer_id AND p.company_id = q.company_id
        LEFT JOIN adm_users u ON u.id = q.created_by
         WHERE q.id = :id AND q.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      const item = rows?.[0] || null;
      if (!item) throw httpError(404, "NOT_FOUND", "Quotation not found");
      if (!item.valid_days) {
        try {
          const qd = item.quotation_date ? new Date(item.quotation_date) : null;
          const vd = item.valid_until ? new Date(item.valid_until) : null;
          if (
            qd &&
            vd &&
            !Number.isNaN(qd.getTime()) &&
            !Number.isNaN(vd.getTime())
          ) {
            const diff = Math.round(
              (vd.getTime() - qd.getTime()) / (1000 * 60 * 60 * 24),
            );
            item.valid_days = Number.isFinite(diff) ? diff : null;
          }
        } catch {}
      }
      const details = await query(
        `
        SELECT
          d.id,
          d.item_id,
          d.qty,
          d.unit_price,
          d.discount_percent,
          d.tax_type,
          d.tax_amount,
          d.net_amount,
          d.total_amount,
          d.uom,
          it.item_code,
          it.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM sal_quotation_details d
        LEFT JOIN inv_items it
          ON it.id = d.item_id AND it.company_id = :companyId
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.quotation_id = :id
        ORDER BY d.id ASC
        `,
        { id, companyId },
      ).catch(() => []);
      res.json({ item, details: Array.isArray(details) ? details : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/quotations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.QUOTATION.VIEW",
    "SAL.ORDER.VIEW",
    "SAL.INVOICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      await ensureQuotationTables();
      await ensureQuotationDetailsTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const body = req.body || {};
      let quotation_no = String(body.quotation_no || "").trim();
      const quotation_date = body.quotation_date
        ? String(body.quotation_date).slice(0, 10)
        : null;
      const customer_id =
        body.customer_id == null ? null : Number(body.customer_id);
      if (!quotation_date) {
        throw httpError(400, "VALIDATION_ERROR", "quotation_date is required");
      }
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) {
        throw httpError(400, "VALIDATION_ERROR", "items are required");
      }

      const createdBy = req.user?.sub || null;
      const net_amount = items.reduce(
        (s, it) => s + Number(it?.net_amount || 0),
        0,
      );
      const tax_amount = items.reduce(
        (s, it) => s + Number(it?.tax_amount || 0),
        0,
      );
      const total_amount =
        body.total_amount !== undefined && body.total_amount !== null
          ? Number(body.total_amount || 0)
          : Number(net_amount + tax_amount);

      const resolveNextQuotationNo = async () => {
        const rows = await query(
          `
          SELECT quotation_no,
          created_at,
          u.username AS created_by_name
         FROM sal_quotations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
            AND quotation_no REGEXP '^QN[0-9]{6}$'
          ORDER BY CAST(REPLACE(quotation_no, 'QN', '') AS UNSIGNED) DESC
          LIMIT 1
          `,
          { companyId, branchId, branchIdsStr },
        ).catch(() => []);
        let nextNum = 1;
        if (rows.length > 0) {
          const prev = String(rows[0].quotation_no || "");
          const numPart = prev.replace(/^QN/, "");
          const n = parseInt(numPart, 10);
          if (Number.isFinite(n)) nextNum = n + 1;
        }
        return `QN${String(nextNum).padStart(6, "0")}`;
      };

      if (!quotation_no) {
        quotation_no = await resolveNextQuotationNo();
      }

      const insertHeader = async (qNo) => {
        return query(
          `
          INSERT INTO sal_quotations
            (company_id, branch_id, quotation_no, quotation_date, customer_id, customer_name, customer_address, customer_city, customer_state, customer_country, valid_days, valid_until, total_amount, net_amount, tax_amount, status, price_type, payment_type, currency_id, exchange_rate, warehouse_id, remarks, terms_and_conditions, created_by)
          VALUES
            (:companyId, :branchId, :quotation_no, DATE(:quotation_date), :customer_id, :customer_name, :customer_address, :customer_city, :customer_state, :customer_country, :valid_days, :valid_until, :total_amount, :net_amount, :tax_amount, :status, :price_type, :payment_type, :currency_id, :exchange_rate, :warehouse_id, :remarks, :terms_and_conditions, :created_by)
          `,
          {
            companyId,
            branchId, branchIdsStr,
            quotation_no: qNo,
            quotation_date,
            customer_id: customer_id || null,
            customer_name: body.customer_name
              ? String(body.customer_name)
              : null,
            customer_address: body.customer_address
              ? String(body.customer_address)
              : null,
            customer_city: body.customer_city
              ? String(body.customer_city)
              : null,
            customer_state: body.customer_state
              ? String(body.customer_state)
              : null,
            customer_country: body.customer_country
              ? String(body.customer_country)
              : null,
            valid_days:
              body.valid_days == null
                ? null
                : Number(body.valid_days || 0) || null,
            valid_until: body.valid_until
              ? String(body.valid_until).slice(0, 10)
              : null,
            total_amount: Number(total_amount || 0),
            net_amount: Number(net_amount || 0),
            tax_amount: Number(tax_amount || 0),
            status: String(body.status || "DRAFT")
              .trim()
              .toUpperCase(),
            price_type: String(body.price_type || "RETAIL")
              .trim()
              .toUpperCase(),
            payment_type: String(body.payment_type || "CASH")
              .trim()
              .toUpperCase(),
            currency_id: Number(body.currency_id || 4),
            exchange_rate: Number(body.exchange_rate || 1),
            warehouse_id:
              body.warehouse_id == null ? null : Number(body.warehouse_id),
            remarks: body.remarks ? String(body.remarks) : null,
            terms_and_conditions: body.terms_and_conditions
              ? String(body.terms_and_conditions)
              : null,
            created_by: createdBy,
          },
        );
      };

      let headerInsert = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          headerInsert = await insertHeader(quotation_no);
          break;
        } catch (e) {
          const code = String(e?.code || "");
          if (code === "ER_DUP_ENTRY") {
            quotation_no = await resolveNextQuotationNo();
            continue;
          }
          throw e;
        }
      }
      if (!headerInsert || !headerInsert.insertId) {
        throw httpError(
          409,
          "DUPLICATE",
          "Failed to allocate a unique quotation number",
        );
      }
      const id = Number(headerInsert.insertId || 0);
      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.qty ?? it?.quantity ?? 0);
        if (!Number.isFinite(item_id) || item_id <= 0) continue;
        await query(
          `
          INSERT INTO sal_quotation_details
            (quotation_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, tax_type, uom)
          VALUES
            (:quotation_id, :item_id, :qty, :unit_price, :discount_percent, :total_amount, :net_amount, :tax_amount, :tax_type, :uom)
          `,
          {
            quotation_id: id,
            item_id,
            qty: Number.isFinite(qty) ? qty : 0,
            unit_price: Number(it?.unit_price || 0),
            discount_percent: Number(it?.discount_percent || 0),
            total_amount: Number(it?.total_amount ?? it?.line_total ?? 0),
            net_amount: Number(it?.net_amount || it?.total_amount || it?.line_total || 0),
            tax_amount: Number(it?.tax_amount || 0),
            tax_type: it?.tax_type == null ? null : Number(it.tax_type) || null,
            uom: it?.uom ? String(it.uom) : null,
          },
        );
      }
      res.status(201).json({ id, quotation_no });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/quotations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.QUOTATION.VIEW",
    "SAL.ORDER.VIEW",
    "SAL.INVOICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      await ensureQuotationTables();
      await ensureQuotationDetailsTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }
      const body = req.body || {};
      const quotation_no = String(body.quotation_no || "").trim();
      const quotation_date = body.quotation_date
        ? String(body.quotation_date).slice(0, 10)
        : null;
      if (!quotation_no || !quotation_date) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "quotation_no and quotation_date are required",
        );
      }
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) {
        throw httpError(400, "VALIDATION_ERROR", "items are required");
      }

      const rows = await query(
        `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM sal_quotations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Quotation not found");

      const net_amount = items.reduce(
        (s, it) => s + Number(it?.net_amount || 0),
        0,
      );
      const tax_amount = items.reduce(
        (s, it) => s + Number(it?.tax_amount || 0),
        0,
      );
      const total_amount =
        body.total_amount !== undefined && body.total_amount !== null
          ? Number(body.total_amount || 0)
          : Number(net_amount + tax_amount);

      await query(
        `
        UPDATE sal_quotations
           SET quotation_no = :quotation_no,
               quotation_date = DATE(:quotation_date),
               customer_id = :customer_id,
               customer_name = :customer_name,
               customer_address = :customer_address,
               customer_city = :customer_city,
               customer_state = :customer_state,
               customer_country = :customer_country,
               valid_days = :valid_days,
               valid_until = :valid_until,
               total_amount = :total_amount,
               net_amount = :net_amount,
               tax_amount = :tax_amount,
               status = :status,
               price_type = :price_type,
               payment_type = :payment_type,
               currency_id = :currency_id,
               exchange_rate = :exchange_rate,
               warehouse_id = :warehouse_id,
               remarks = :remarks,
               terms_and_conditions = :terms_and_conditions
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        `,
        {
          id,
          companyId,
          branchId, branchIdsStr,
          quotation_no,
          quotation_date,
          customer_id:
            body.customer_id == null ? null : Number(body.customer_id) || null,
          customer_name: body.customer_name ? String(body.customer_name) : null,
          customer_address: body.customer_address
            ? String(body.customer_address)
            : null,
          customer_city: body.customer_city ? String(body.customer_city) : null,
          customer_state: body.customer_state
            ? String(body.customer_state)
            : null,
          customer_country: body.customer_country
            ? String(body.customer_country)
            : null,
          valid_days:
            body.valid_days == null
              ? null
              : Number(body.valid_days || 0) || null,
          valid_until: body.valid_until
            ? String(body.valid_until).slice(0, 10)
            : null,
          total_amount: Number(total_amount || 0),
          net_amount: Number(net_amount || 0),
          tax_amount: Number(tax_amount || 0),
          status: String(body.status || "DRAFT")
            .trim()
            .toUpperCase(),
          price_type: String(body.price_type || "RETAIL")
            .trim()
            .toUpperCase(),
          payment_type: String(body.payment_type || "CASH")
            .trim()
            .toUpperCase(),
          currency_id: Number(body.currency_id || 4),
          exchange_rate: Number(body.exchange_rate || 1),
          warehouse_id:
            body.warehouse_id == null ? null : Number(body.warehouse_id),
          remarks: body.remarks ? String(body.remarks) : null,
          terms_and_conditions: body.terms_and_conditions
            ? String(body.terms_and_conditions)
            : null,
        },
      );
      await query(
        "DELETE FROM sal_quotation_details WHERE quotation_id = :id",
        { id },
      );
      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.qty ?? it?.quantity ?? 0);
        if (!Number.isFinite(item_id) || item_id <= 0) continue;
        await query(
          `
          INSERT INTO sal_quotation_details
            (quotation_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, tax_type, uom)
          VALUES
            (:quotation_id, :item_id, :qty, :unit_price, :discount_percent, :total_amount, :net_amount, :tax_amount, :tax_type, :uom)
          `,
          {
            quotation_id: id,
            item_id,
            qty: Number.isFinite(qty) ? qty : 0,
            unit_price: Number(it?.unit_price || 0),
            discount_percent: Number(it?.discount_percent || 0),
            total_amount: Number(it?.total_amount ?? it?.line_total ?? 0),
            net_amount: Number(it?.net_amount || it?.total_amount || it?.line_total || 0),
            tax_amount: Number(it?.tax_amount || 0),
            tax_type: it?.tax_type == null ? null : Number(it.tax_type) || null,
            uom: it?.uom ? String(it.uom) : null,
          },
        );
      }
      res.json({ ok: true, id });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/quotations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureQuotationTables();
      await ensureQuotationDetailsTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0)
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const userId = Number(req.user?.sub);
      if (!Number.isFinite(userId) || userId <= 0)
        throw httpError(401, "UNAUTHORIZED", "Invalid user");
      const denyRows = await query(
        `
        SELECT 1,
          created_at,
          u.username AS created_by_name
         FROM adm_exceptional_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :uid
           AND permission_code = 'SALES.QUOTATION.CANCEL'
           AND UPPER(effect) = 'DENY'
         LIMIT 1
        `,
        { uid: userId },
      ).catch(() => []);
      if (denyRows.length) {
        throw httpError(403, "FORBIDDEN", "Exceptional permission denied");
      }
      const allowRows = await query(
        `
        SELECT 1,
          created_at,
          u.username AS created_by_name
         FROM adm_exceptional_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :uid
           AND permission_code = 'SALES.QUOTATION.CANCEL'
           AND UPPER(effect) = 'ALLOW'
         LIMIT 1
        `,
        { uid: userId },
      ).catch(() => []);
      if (!allowRows.length) {
        throw httpError(403, "FORBIDDEN", "Exceptional permission required");
      }
      const rows = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM sal_quotations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Quotation not found");
      const orderRef = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM sal_orders
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND quotation_id = :id
         LIMIT 1
        `,
        { companyId, branchId, branchIdsStr, id },
      ).catch(() => []);
      if (orderRef.length) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Cannot cancel: quotation linked to a sales order",
        );
      }
      await query(
        "DELETE FROM sal_quotation_details WHERE quotation_id = :id",
        {
          id,
        },
      );
      await query(
        "DELETE FROM sal_quotations WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))",
        { id, companyId, branchId, branchIdsStr },
      );
      res.json({ success: true, id });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/quotations/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.QUOTATION.VIEW",
    "SAL.ORDER.VIEW",
    "SAL.INVOICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      await ensureQuotationTables();
      await ensureQuotationDetailsTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `
        SELECT quotation_no,
          created_at,
          u.username AS created_by_name
         FROM sal_quotations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND quotation_no REGEXP '^QN[0-9]{6}$'
        ORDER BY CAST(REPLACE(quotation_no, 'QN', '') AS UNSIGNED) DESC
        LIMIT 1
        `,
        { companyId, branchId, branchIdsStr },
      );
      let nextNum = 1;
      if (rows.length > 0) {
        const prev = String(rows[0].quotation_no || "");
        const numPart = prev.replace(/^QN/, "");
        const n = parseInt(numPart, 10);
        if (Number.isFinite(n)) nextNum = n + 1;
      }
      const nextNo = `QN${String(nextNum).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  cacheListResponse(30),
  requirePermission("SAL.ORDER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const branchIdsStr = req.scope.branchIdsStr;
      
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.max(1, Math.min(500, parseInt(req.query.limit) || 50));
      const offset = (page - 1) * limit;

      // Count query
      const [countResult] = await query(
        `SELECT COUNT(*) AS total
         FROM sal_orders o
         WHERE o.company_id = :companyId 
           AND (:branchIdsStr = '' OR FIND_IN_SET(o.branch_id, :branchIdsStr))
           AND COALESCE(o.is_active,'Y') = 'Y'`,
        { companyId, branchIdsStr }
      ).catch(() => [{ total: 0 }]);
      const total = countResult.total || 0;

      // Optimized query with pagination
      const items = await query(
        `
        SELECT 
          o.id, 
          o.order_no, 
          o.order_date, 
          o.customer_id, 
          c.customer_name AS customer_name,
          o.priority,
          o.status, 
          o.total_amount,
          EXISTS(
            SELECT 1 FROM srv_service_invoices i
            WHERE i.company_id = :companyId
              AND i.sales_order_id = o.id
          ) AS has_invoice
        FROM sal_orders o
        LEFT JOIN sal_customers c
          ON c.id = o.customer_id AND c.company_id = :companyId
        WHERE o.company_id = :companyId 
          AND (:branchIdsStr = '' OR FIND_IN_SET(o.branch_id, :branchIdsStr))
          AND COALESCE(o.is_active,'Y') = 'Y'
        ORDER BY o.order_date DESC, o.id DESC
        LIMIT :limit OFFSET :offset
        `,
        { companyId, branchIdsStr, limit, offset },
      ).catch(() => []);

      res.json({
        items: Array.isArray(items) ? items : [],
        pagination: {
          total,
          page,
          pageSize: limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0)
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const userId = Number(req.user?.sub);
      if (!Number.isFinite(userId) || userId <= 0)
        throw httpError(401, "UNAUTHORIZED", "Invalid user");
      if (!(await userHasExceptionalAllow(userId, "SALES.ORDER.CANCEL"))) {
        throw httpError(403, "FORBIDDEN", "Exceptional permission required");
      }
      const rows = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM sal_orders
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!rows.length) throw httpError(404, "NOT_FOUND", "Order not found");
      const invRef = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM srv_service_invoices
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND sales_order_id = :id
         LIMIT 1
        `,
        { companyId, branchId, branchIdsStr, id },
      ).catch(() => []);
      if (invRef.length) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Cannot cancel: order linked to an invoice",
        );
      }
      await query(
        "UPDATE sal_orders SET status = 'CANCELLED', is_active = 'N', deleted_at = NOW() WHERE id = :id AND company_id = :CompanyId AND branch_id = :BranchId",
        { id, CompanyId: companyId, BranchId: branchId, branchIdsStr },
      );
      res.json({ success: true, id });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const items = await query(
        `
        SELECT
          o.id,
          o.order_no,
          o.order_date,
          o.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          o.status,
          o.total_amount,
          o.sub_total,
          o.tax_amount,
          o.currency_id,
          o.exchange_rate,
          o.price_type,
          o.payment_type,
          o.warehouse_id,
          o.quotation_id,
          o.remarks,
          o.created_at,
          u.username AS created_by_name
         FROM sal_orders o
        LEFT JOIN sal_customers c
          ON c.id = o.customer_id AND c.company_id = o.company_id
        LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE o.id = :id AND o.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!items.length) throw httpError(404, "NOT_FOUND", "Order not found");
      const details = await query(
        `
        SELECT
          d.id,
          d.item_id,
          d.qty AS quantity,
          d.unit_price,
          d.discount_percent,
          d.total_amount,
          d.net_amount,
          d.tax_amount,
          d.tax_code_id,
          d.uom,
          it.item_code,
          it.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM sal_order_details d
        LEFT JOIN inv_items it
          ON it.id = d.item_id AND it.company_id = :companyId
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.order_id = :id
        ORDER BY d.id ASC
        `,
        { id, companyId },
      ).catch(() => []);
      res.json({
        item: items[0],
        details: Array.isArray(details) ? details : [],
      });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesOrderColumns();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const body = req.body || {};
      const order_no = String(body.order_no || "").trim();
      const order_date = body.order_date
        ? String(body.order_date).slice(0, 10)
        : null;
      const customer_id = Number(body.customer_id);
      const status = String(body.status || "DRAFT")
        .trim()
        .toUpperCase();
      if (!order_no || !order_date || !Number.isFinite(customer_id)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      const payload = {
        companyId,
        branchId, branchIdsStr,
        order_no,
        order_date,
        customer_id,
        status,
        total_amount: Number(body.total_amount || 0),
        sub_total: Number(body.sub_total || 0),
        tax_amount: Number(body.tax_amount || 0),
        currency_id: Number(body.currency_id || 4),
        exchange_rate: Number(body.exchange_rate || 1),
        price_type: String(body.price_type || "RETAIL"),
        payment_type: String(body.payment_type || "CASH"),
        warehouse_id:
          body.warehouse_id == null ? null : Number(body.warehouse_id),
        quotation_id:
          body.quotation_id == null ? null : Number(body.quotation_id),
        remarks: body.remarks || null,
        payment_date: body.payment_date
          ? String(body.payment_date).slice(0, 10)
          : null,
      };
      const result = await query(
        `
        INSERT INTO sal_orders
          (company_id, branch_id, order_no, order_date, customer_id, status, total_amount, sub_total, tax_amount, currency_id, exchange_rate, price_type, payment_type, warehouse_id, quotation_id, remarks, payment_date)
        VALUES
          (:companyId, :branchId, :order_no, DATE(:order_date), :customer_id, :status, :total_amount, :sub_total, :tax_amount, :currency_id, :exchange_rate, :price_type, :payment_type, :warehouse_id, :quotation_id, :remarks, :payment_date)
        `,
        payload,
      );
      const orderId = result.insertId;
      const items = Array.isArray(body.items) ? body.items : [];
      // Resolve price_type to ID for campaign override
      let orderPriceTypeId = null;
      const orderPriceTypeStr = String(body.price_type || "RETAIL").trim();
      if (orderPriceTypeStr) {
        const [pt] = await query(
          `SELECT id FROM sal_price_types WHERE company_id = :companyId AND UPPER(name) = UPPER(:name) LIMIT 1`,
          { companyId, name: orderPriceTypeStr },
        ).catch(() => []);
        if (pt?.id) orderPriceTypeId = Number(pt.id);
      }

      const orderCustomerId = Number(body.customer_id);

      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.quantity || 0);
        let unit_price = Number(it?.unit_price || 0);
        const discount_percent = Number(it?.discount_percent || 0);
        const total_amount = Number(it?.total_amount || 0);
        const net_amount = Number(it?.net_amount || 0);
        const tax_amount = Number(it?.tax_amount || 0);
        const tax_code_id = it?.tax_id ? Number(it.tax_id) : null;
        const uom = String(it?.uom || "PCS").trim();
        if (!Number.isFinite(item_id) || qty <= 0) continue;
        // Campaign price override
        const prResult = await resolveBestPrice(
          companyId,
          branchId, branchIdsStr,
          item_id,
          orderCustomerId,
          orderPriceTypeId,
          qty,
        ).catch(() => null);
        if (prResult && prResult.campaignApplied) {
          unit_price = prResult.price;
        }
        await query(
          `
          INSERT INTO sal_order_details
            (order_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, uom, tax_code_id)
          VALUES
            (:order_id, :item_id, :qty, :unit_price, :discount_percent, :total_amount, :net_amount, :tax_amount, :uom, :tax_code_id)
          `,
          {
            order_id: orderId,
            item_id,
            qty,
            unit_price,
            discount_percent,
            total_amount,
            net_amount,
            tax_amount,
            uom,
            tax_code_id,
          },
        );
      }
      // Auto-apply Purchase reward campaigns
      if (items.length) {
        const purchaseRewardFreeItems = await calculatePurchaseRewardFreeItems(
          companyId,
          items,
        );
        for (const bf of purchaseRewardFreeItems) {
          await query(
            `INSERT INTO sal_order_details (order_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, uom)
             VALUES (:order_id, :item_id, :qty, :unit_price, :discount_percent, :total_amount, :net_amount, :tax_amount, :uom)`,
            {
              order_id: orderId,
              item_id: bf.item_id,
              qty: bf.quantity,
              unit_price: 0,
              discount_percent: 0,
              total_amount: 0,
              net_amount: 0,
              tax_amount: 0,
              uom: "PCS",
            },
          );
          // Consume campaign usage
          await query(
            `UPDATE sal_purchase_reward_campaigns SET used_qty = used_qty + :qty WHERE id = :id AND company_id = :companyId`,
            { qty: bf.quantity, id: bf.campaign_id, companyId },
          ).catch(() => {});
        }
      }
      const [item] = await query(
        `
        SELECT 
          o.id, o.order_no, o.order_date, o.customer_id, c.customer_name,
          o.status, o.total_amount,
          o.created_at,
          u.username AS created_by_name
         FROM sal_orders o
        LEFT JOIN sal_customers c ON c.id = o.customer_id AND c.company_id = o.company_id
        LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE o.id = :id
        LIMIT 1
        `,
        { id: orderId },
      ).catch(() => []);
      res.status(201).json({ id: orderId, item: item || null });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesOrderColumns();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const order_no = String(body.order_no || "").trim();
      const order_date = body.order_date
        ? String(body.order_date).slice(0, 10)
        : null;
      const customer_id = Number(body.customer_id);
      const status = String(body.status || "DRAFT")
        .trim()
        .toUpperCase();
      if (!order_no || !order_date || !Number.isFinite(customer_id)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      // Ensure order exists
      const [existing] = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM sal_orders
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Order not found");
      const payload = {
        id,
        companyId,
        branchId, branchIdsStr,
        order_no,
        order_date,
        customer_id,
        status,
        total_amount: Number(body.total_amount || 0),
        sub_total: Number(body.sub_total || 0),
        tax_amount: Number(body.tax_amount || 0),
        currency_id: Number(body.currency_id || 4),
        exchange_rate: Number(body.exchange_rate || 1),
        price_type: String(body.price_type || "RETAIL"),
        payment_type: String(body.payment_type || "CASH"),
        warehouse_id:
          body.warehouse_id == null ? null : Number(body.warehouse_id),
        quotation_id:
          body.quotation_id == null ? null : Number(body.quotation_id),
        remarks: body.remarks || null,
        payment_date: body.payment_date
          ? String(body.payment_date).slice(0, 10)
          : null,
      };
      await query(
        `
        UPDATE sal_orders
           SET order_no = :order_no,
               order_date = DATE(:order_date),
               customer_id = :customer_id,
               status = :status,
               total_amount = :total_amount,
               sub_total = :sub_total,
               tax_amount = :tax_amount,
               currency_id = :currency_id,
               exchange_rate = :exchange_rate,
               price_type = :price_type,
               payment_type = :payment_type,
               warehouse_id = :warehouse_id,
               quotation_id = :quotation_id,
               remarks = :remarks,
               payment_date = :payment_date
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        `,
        payload,
      );
      await query(
        `
        DELETE FROM sal_order_details
        WHERE order_id = :id
        `,
        { id },
      );
      let orderPriceTypeId = null;
      const orderPriceTypeStr = String(body.price_type || "RETAIL").trim();
      if (orderPriceTypeStr) {
        const [pt] = await query(
          `SELECT id FROM sal_price_types WHERE company_id = :companyId AND UPPER(name) = UPPER(:name) LIMIT 1`,
          { companyId, name: orderPriceTypeStr },
        ).catch(() => []);
        if (pt?.id) orderPriceTypeId = Number(pt.id);
      }
      const items = Array.isArray(body.items) ? body.items : [];
      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.quantity || 0);
        let unit_price = Number(it?.unit_price || 0);
        const discount_percent = Number(it?.discount_percent || 0);
        const total_amount = Number(it?.total_amount || 0);
        const net_amount = Number(it?.net_amount || 0);
        const tax_amount = Number(it?.tax_amount || 0);
        const tax_code_id = it?.tax_id ? Number(it.tax_id) : null;
        const uom = String(it?.uom || "PCS").trim();
        if (!Number.isFinite(item_id) || qty <= 0) continue;
        const prResult = await resolveBestPrice(
          companyId,
          branchId, branchIdsStr,
          item_id,
          Number(body.customer_id),
          orderPriceTypeId,
          qty,
        ).catch(() => null);
        if (prResult && prResult.campaignApplied) {
          unit_price = prResult.price;
        }
        await query(
          `
          INSERT INTO sal_order_details
            (order_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, uom, tax_code_id)
          VALUES
            (:order_id, :item_id, :qty, :unit_price, :discount_percent, :total_amount, :net_amount, :tax_amount, :uom, :tax_code_id)
          `,
          {
            order_id: id,
            item_id,
            qty,
            unit_price,
            discount_percent,
            total_amount,
            net_amount,
            tax_amount,
            uom,
            tax_code_id,
          },
        );
      }
      if (items.length) {
        const purchaseRewardFreeItems = await calculatePurchaseRewardFreeItems(
          companyId,
          items,
        );
        for (const bf of purchaseRewardFreeItems) {
          await query(
            `INSERT INTO sal_order_details (order_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, uom)
             VALUES (:order_id, :item_id, :qty, 0, 0, 0, 0, 0, :uom)`,
            { order_id: id, item_id: bf.item_id, qty: bf.quantity, uom: "PCS" },
          );
          await query(
            `UPDATE sal_purchase_reward_campaigns SET used_qty = used_qty + :qty WHERE id = :id AND company_id = :companyId`,
            { qty: bf.quantity, id: bf.campaign_id, companyId },
          ).catch(() => {});
        }
      }
      res.json({ id });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/orders/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesOrderColumns();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [existing] = await query(
        `
        SELECT id, status, total_amount,
          created_at,
          u.username AS created_by_name
         FROM sal_orders
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Order not found");

      const amount =
        req.body?.amount == null
          ? existing.total_amount == null
            ? null
            : Number(existing.total_amount || 0)
          : Number(req.body.amount || 0);
      const explicitWorkflowId =
        req.body?.workflow_id == null ? null : Number(req.body.workflow_id);
      const targetUserId =
        req.body?.target_user_id == null
          ? null
          : Number(req.body.target_user_id);

      let { activeWorkflow: activeWf, inactiveWorkflow } =
        await resolveWorkflowSelection({
          companyId,
          workflowIdOverride: explicitWorkflowId,
          docRouteBase: "/sales/sales-orders",
          typeSynonyms: [
            "SALES_ORDER",
            "Sales Order",
            "SALES_ORDER:LOCAL",
            "SALES_ORDER:IMPORT",
            "SALES ORDER",
          ],
          amount,
        });

      // Fallback: create a simple default workflow if not defined yet and a target approver is provided
      if (!activeWf && Number.isFinite(targetUserId) && targetUserId > 0) {
        try {
          await query(
            `INSERT INTO adm_workflows (company_id, workflow_code, workflow_name, module_key, document_type, document_route, is_active)
             VALUES (:companyId, 'WF-SO-DEFAULT', 'Default SO Approval', 'sales', 'SALES_ORDER', '/sales/sales-orders', 1)
             ON DUPLICATE KEY UPDATE is_active = VALUES(is_active)`,
            { companyId },
          );
        } catch {}
        const wfRows = await query(
          `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflows
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId 
             AND module_key = 'sales' 
             AND (document_type = 'SALES_ORDER' OR document_type = 'Sales Order') 
             AND workflow_name = 'Default SO Approval'
           ORDER BY id ASC LIMIT 1`,
          { companyId },
        ).catch(() => []);
        if (wfRows.length) {
          const wfId = wfRows[0].id;
          try {
            await query(
              `INSERT INTO adm_workflow_steps (workflow_id, step_order, step_name, approver_user_id, approver_role_id, min_amount, max_amount, approval_limit, is_mandatory)
               VALUES (:wfId, 1, 'Approval', :uid, NULL, NULL, NULL, NULL, 1)
               ON DUPLICATE KEY UPDATE approver_user_id = VALUES(approver_user_id)`,
              { wfId, uid: targetUserId },
            );
          } catch {}
          try {
            await query(
              `INSERT INTO adm_workflow_step_approvers (workflow_id, step_order, approver_user_id, approval_limit)
               VALUES (:wfId, 1, :uid, NULL)
               ON DUPLICATE KEY UPDATE approval_limit = VALUES(approval_limit)`,
              { wfId, uid: targetUserId },
            );
          } catch {}
          activeWf = wfRows[0];
        }
      }

      // If a workflow is defined, create/advance document workflow and assign
      if (!activeWf) {
        const behavior = getInactiveWorkflowBehavior(inactiveWorkflow);
        if (behavior && behavior.toUpperCase() !== "AUTO_APPROVE") {
          return res.json({ id, status: "SUBMITTED" });
        }
        await query(
          `UPDATE sal_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
          { id, companyId, branchId, branchIdsStr },
        );
        return res.json({ id, status: "APPROVED" });
      }

      const steps = await query(
        `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        await query(
          `UPDATE sal_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
          { id, companyId, branchId },
        );
        return res.json({ id, status: "APPROVED" });
      }

      const first = steps[0];
      if (!first.approver_user_id) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Workflow step 1 has no approver_user_id configured",
        );
      }
      const allowedUsers = await query(
        `SELECT approver_user_id,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_step_approvers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf AND step_order = :ord`,
        { wf: activeWf.id, ord: first.step_order },
      );
      const allowedSet = new Set(
        allowedUsers.map((r) => Number(r.approver_user_id)),
      );
      let assignedToUserId = Number(first.approver_user_id);
      if (
        targetUserId != null &&
        Number.isFinite(targetUserId) &&
        allowedSet.has(Number(targetUserId))
      ) {
        assignedToUserId = Number(targetUserId);
      } else if (allowedUsers.length > 0) {
        assignedToUserId = Number(allowedUsers[0].approver_user_id);
      }

      const dwRes = await query(
        `
        INSERT INTO adm_document_workflows
          (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
        VALUES
          (:companyId, :workflowId, :documentId, 'SALES_ORDER', :amount, :stepOrder, 'PENDING', :assignedTo)
        `,
        {
          companyId,
          workflowId: activeWf.id,
          documentId: id,
          amount: amount === null ? null : Number(amount),
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      const instanceId = dwRes.insertId;
      await query(
        `
        INSERT INTO adm_workflow_tasks
          (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
        VALUES
          (:companyId, :workflowId, :dwId, :documentId, 'SALES_ORDER', :stepOrder, :assignedTo, 'PENDING')
        `,
        {
          companyId,
          workflowId: activeWf.id,
          dwId: instanceId,
          documentId: id,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      await query(
        `
        INSERT INTO adm_workflow_logs
          (document_workflow_id, step_order, action, actor_user_id, comments)
        VALUES
          (:dwId, :stepOrder, 'SUBMIT', :actor, :comments)
        `,
        {
          dwId: instanceId,
          stepOrder: first.step_order,
          actor: req.user.sub,
          comments: req.body?.comments || "",
        },
      );

      await query(
        `UPDATE sal_orders SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        { id, companyId, branchId, branchIdsStr },
      );
      res.json({ id, status: "PENDING_APPROVAL" });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/invoices",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  cacheListResponse(30),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const branchIdsStr = req.scope.branchIdsStr;
      const customerId = req.query.customer_id
        ? Number(req.query.customer_id)
        : null;

      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.max(1, Math.min(500, parseInt(req.query.limit) || 50));
      const offset = (page - 1) * limit;

      // Count query
      let countQuery = `SELECT COUNT(*) AS total FROM srv_service_invoices i WHERE i.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(i.branch_id, :branchIdsStr))`;
      if (customerId) countQuery += ` AND i.customer_id = :customerId`;

      const [countResult] = await query(countQuery, { companyId, branchIdsStr, customerId }).catch(() => [{ total: 0 }]);
      const total = countResult.total || 0;

      // Optimized paginated query
      let sql = `
        SELECT 
           i.id,
           i.invoice_no,
           i.invoice_date,
           i.customer_id,
           COALESCE(c.customer_name, '') AS customer_name,
           i.payment_status,
           i.status,
           i.net_amount,
           i.balance_amount,
           i.tax_amount,
           i.price_type,
           i.payment_type,
           i.warehouse_id,
           i.sales_order_id,
           i.service_execution_id,
           i.remarks,
           i.created_at,
           u.username AS created_by_name,
           (
             SELECT MAX(it.vat_on_sales_id) 
             FROM srv_service_invoice_details d
             JOIN inv_items it ON it.id = d.item_id 
             WHERE d.invoice_id = i.id AND it.company_id = i.company_id
           ) AS tax_code_id
        FROM srv_service_invoices i
        LEFT JOIN sal_customers c
          ON c.id = i.customer_id AND c.company_id = i.company_id
        LEFT JOIN adm_users u 
          ON u.id = i.created_by
        WHERE i.company_id = :companyId 
          AND (:branchIdsStr = '' OR FIND_IN_SET(i.branch_id, :branchIdsStr))
      `;

      if (customerId) {
        sql += ` AND i.customer_id = :customerId`;
      }

      sql += ` ORDER BY i.invoice_date DESC, i.id DESC LIMIT :limit OFFSET :offset`;

      const items = await query(sql, { companyId, branchIdsStr, customerId, limit, offset }).catch(() => []);

      res.json({
        items: Array.isArray(items) ? items : [],
        pagination: {
          total,
          page,
          pageSize: limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (e) {
      next(e);
    }
  },
);

// Get outstanding invoices for a customer based on account ID
// This endpoint: 1) Gets account code from fin_accounts, 2) Finds customer by customer_code, 3) Returns their outstanding invoices
router.get(
  "/invoices/outstanding-by-account",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = Number(req.scope.companyId);
      const branchId = Number(req.scope.branchId);
      const { account_id } = req.query;

      if (!account_id) {
        return res.status(400).json({ error: "account_id is required" });
      }

      // Step 1: Get account code from fin_accounts table using account ID
      const accountRows = await query(
        `SELECT code FROM fin_accounts
         WHERE id = ? AND company_id = ?`,
        [account_id, companyId],
      );

      if (!accountRows || accountRows.length === 0) {
        return res.json({ items: [] });
      }

      const accountCode = String(accountRows[0].code || "").trim();
      if (!accountCode) {
        return res.json({ items: [] });
      }

      // Step 2: Find customer using customer_code matching account code
      let customerRows = await query(
        `SELECT id, customer_code, customer_name
         FROM sal_customers
         WHERE company_id = ? AND customer_code = ?
         LIMIT 1`,
        [companyId, accountCode],
      );

      // Fallback: try customer_id if no match found
      if (!customerRows || customerRows.length === 0) {
        customerRows = await query(
          `SELECT id, customer_code, customer_name
           FROM sal_customers
           WHERE company_id = ? AND CAST(customer_id AS CHAR) = ?
           LIMIT 1`,
          [companyId, accountCode],
        );
      }

      if (!customerRows || customerRows.length === 0) {
        return res.json({ items: [] });
      }

      // Use the matching customer
      const customerId = customerRows[0].id;

      // Step 3: Get outstanding invoices for this customer
      // Query srv_service_invoices with payment_status UNPAID or PARTIALLY_PAID
      const sql = `SELECT i.id, i.invoice_no, i.invoice_date, i.net_amount,
                COALESCE(i.balance_amount, i.net_amount) as balance_amount,
                i.payment_status, i.due_date, c.customer_name,
                MAX(it.vat_on_sales_id) AS tax_code_id
         FROM srv_service_invoices i
         LEFT JOIN sal_customers c ON i.customer_id = c.id
         LEFT JOIN srv_service_invoice_details d ON d.invoice_id = i.id
         LEFT JOIN inv_items it ON it.id = d.item_id AND it.company_id = i.company_id
         WHERE i.customer_id = ?
           AND i.company_id = ?
           AND (i.branch_id = ? OR i.branch_id IS NULL)
           AND (i.payment_status = 'UNPAID' OR i.payment_status = 'PARTIALLY_PAID')
           AND i.status = 'POSTED'
         GROUP BY i.id, i.invoice_no, i.invoice_date, i.net_amount,
                  i.balance_amount, i.payment_status, i.due_date, c.customer_name
         ORDER BY i.invoice_date DESC`;
      const invoiceParams = [customerId, companyId, branchId];
      const invoiceRows = await query(sql, invoiceParams);

      const invoices = (invoiceRows || []).map((row) => ({
        id: row.id,
        invoice_no: row.invoice_no,
        invoice_date: row.invoice_date,
        net_amount: Number(row.net_amount || 0),
        balance_amount: Number(row.balance_amount || row.net_amount || 0),
        payment_status: row.payment_status,
        due_date: row.due_date,
        customer_name: row.customer_name,
        tax_code_id: row.tax_code_id || null,
      }));

      res.json({
        items: invoices,
        customer: customerRows[0],
        account_code: accountCode,
      });
    } catch (err) {
      console.error("[outstanding-by-account] Error:", err?.message || err);
      console.error("[outstanding-by-account] Stack:", err?.stack);
      next(err);
    }
  },
);

router.get(
  "/invoices/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const items = await query(
        `
        SELECT
          i.id,
          i.invoice_no,
          i.invoice_date,
          i.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          i.payment_status,
          i.status,
          i.total_amount,
          i.net_amount,
          i.balance_amount,
          i.price_type,
          i.payment_type,
          i.currency_id,
          i.warehouse_id,
          i.sales_order_id,
          i.service_execution_id,
          i.remarks,
          i.tax_amount,
          i.tax_components,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN sal_customers c
          ON c.id = i.customer_id AND c.company_id = i.company_id
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.id = :id AND i.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!items.length) throw httpError(404, "NOT_FOUND", "Invoice not found");
      const details = await query(
        `
        SELECT
          d.id,
          d.item_id,
          d.quantity,
          d.unit_price,
          d.discount_percent,
          d.total_amount,
          d.net_amount,
          d.tax_amount,
          d.tax_type AS tax_id,
          d.uom,
          it.item_code,
          it.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM srv_service_invoice_details d
        LEFT JOIN inv_items it
          ON it.id = d.item_id AND it.company_id = :companyId
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.invoice_id = :id
        ORDER BY d.id ASC
        `,
        { id, companyId },
      ).catch(() => []);
      res.json({
        item: items[0],
        details: Array.isArray(details) ? details : [],
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/invoices/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
      const rows = await query(
        `
        SELECT invoice_no,
          created_at,
          u.username AS created_by_name
         FROM srv_service_invoices
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND invoice_no REGEXP '^INV-?[0-9]{6}$'
        ORDER BY CAST(REPLACE(invoice_no, 'INV-', '') AS UNSIGNED) DESC
        LIMIT 1
        `,
        { companyId, branchId, branchIdsStr },
      );
      let nextNum = 1;
      if (rows.length > 0) {
        const prev = String(rows[0].invoice_no || "");
        const numPart = prev.replace(/^INV-?/, "");
        const n = parseInt(numPart, 10);
        if (Number.isFinite(n)) nextNum = n + 1;
      }
      const nextNo = `INV${String(nextNum).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/invoices/:id/reverse-accounting",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0)
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const userId = Number(req.user?.sub);
      if (!Number.isFinite(userId) || userId <= 0)
        throw httpError(401, "UNAUTHORIZED", "Invalid user");
      const denyRows = await query(
        `
        SELECT 1,
          created_at,
          u.username AS created_by_name
         FROM adm_exceptional_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :uid
           AND permission_code = 'SALES.INVOICE.CANCEL'
           AND UPPER(effect) = 'DENY'
         LIMIT 1
        `,
        { uid: userId },
      ).catch(() => []);
      if (denyRows.length) {
        throw httpError(403, "FORBIDDEN", "Exceptional permission denied");
      }
      const allowRows = await query(
        `
        SELECT 1,
          created_at,
          u.username AS created_by_name
         FROM adm_exceptional_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :uid
           AND permission_code = 'SALES.INVOICE.CANCEL'
           AND UPPER(effect) = 'ALLOW'
         LIMIT 1
        `,
        { uid: userId },
      ).catch(() => []);
      if (!allowRows.length) {
        throw httpError(403, "FORBIDDEN", "Exceptional permission required");
      }
      const invRows = await query(
        `
        SELECT id, invoice_no,
          created_at,
          u.username AS created_by_name
         FROM srv_service_invoices
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!invRows.length)
        throw httpError(404, "NOT_FOUND", "Invoice not found");
      const invoiceNo = String(invRows[0].invoice_no || "").trim();
      if (!invoiceNo) {
        res.json({ success: true, deleted: 0 });
        return;
      }
      await conn.beginTransaction();
      const vRows = await conn
        .execute(
          `
          SELECT DISTINCT v.id AS voucher_id
            FROM fin_vouchers v
            JOIN fin_voucher_lines l ON l.voucher_id = v.id
           WHERE v.company_id = :companyId
             AND l.reference_no = :referenceNo
          `,
          { companyId, referenceNo: invoiceNo },
        )
        .then(([rows]) => rows)
        .catch(() => []);
      const voucherIds = vRows
        .map((r) => Number(r.voucher_id))
        .filter((n) => Number.isFinite(n) && n > 0);
      let deleted = 0;
      if (voucherIds.length) {
        const inList = voucherIds.join(",");
        await conn
          .execute(
            `DELETE FROM fin_voucher_lines WHERE voucher_id IN (${inList})`,
          )
          .catch(() => null);
        const [resDel] = await conn
          .execute(`DELETE FROM fin_vouchers WHERE id IN (${inList})`)
          .catch(() => [null]);
        deleted = Number(resDel?.affectedRows || 0);
      }
      await conn
        .execute(`DELETE FROM srv_service_invoice_details WHERE invoice_id = :id`, {
          id,
        })
        .catch(() => null);
      await conn
        .execute(
          `DELETE FROM srv_service_invoices WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
          { id, companyId, branchId, branchIdsStr },
        )
        .catch(() => null);
      await conn.commit();
      res.json({
        success: true,
        deleted,
        invoice_id: id,
        invoice_no: invoiceNo,
      });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/dashboard/metrics",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const topProductsLimit = Math.max(
        1,
        Math.min(50, Number(req.query.topProducts || req.query.top || 10)),
      );
      const topCustomersLimit = Math.max(
        1,
        Math.min(50, Number(req.query.topCustomers || req.query.top || 10)),
      );
      const [fyRow] =
        (await query(
          `SELECT id, start_date,
          created_at,
          u.username AS created_by_name
         FROM fin_fiscal_years
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId ORDER BY start_date DESC LIMIT 1`,
          { companyId },
        ).catch(() => [])) || [];
      const now = new Date();
      const today = req.query.to ? new Date(String(req.query.to)) : now;
      const fromFyDefault =
        fyRow?.start_date || new Date(today.getFullYear(), 0, 1);
      const fromFy = req.query.from
        ? new Date(String(req.query.from))
        : fromFyDefault;
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const day = today.getDay();
      const diffToMonday = (day + 6) % 7;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - diffToMonday);
      function toDateStr(d) {
        return typeof d === "string" ? d : d.toISOString().slice(0, 10);
      }
      const [ytdRow] = (await query(
        `SELECT COALESCE(SUM(i.net_amount),0) AS v,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND i.invoice_date BETWEEN :from AND :to`,
        { companyId, branchId, branchIdsStr, from: toDateStr(fromFy), to: toDateStr(today) },
      ).catch(() => [])) || [{ v: 0 }];
      const [mtdRow] = (await query(
        `SELECT COALESCE(SUM(i.net_amount),0) AS v,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND i.invoice_date BETWEEN :from AND :to`,
        {
          companyId,
          branchId, branchIdsStr,
          from: toDateStr(monthStart),
          to: toDateStr(today),
        },
      ).catch(() => [])) || [{ v: 0 }];
      const [wtdRow] = (await query(
        `SELECT COALESCE(SUM(i.net_amount),0) AS v,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND i.invoice_date BETWEEN :from AND :to`,
        {
          companyId,
          branchId, branchIdsStr,
          from: toDateStr(weekStart),
          to: toDateStr(today),
        },
      ).catch(() => [])) || [{ v: 0 }];
      const [todayRow] = (await query(
        `SELECT COALESCE(SUM(i.net_amount),0) AS v,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND DATE(i.invoice_date) = :d`,
        { companyId, branchId, branchIdsStr, d: toDateStr(today) },
      ).catch(() => [])) || [{ v: 0 }];
      async function grossBetween(from, to) {
        const rows = (await query(
          `SELECT COALESCE(SUM(d.quantity * (d.unit_price * (1 - d.discount_percent/100)) - d.quantity * it.cost_price),0) AS gp,
          d.created_at,
          u.username AS created_by_name
         FROM srv_service_invoice_details d
               JOIN srv_service_invoices i ON i.id = d.invoice_id
               LEFT JOIN inv_items it ON it.id = d.item_id AND it.company_id = i.company_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE i.company_id = :companyId
                AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
                AND i.invoice_date BETWEEN :from AND :to`,
          { companyId, branchId, from: toDateStr(from), to: toDateStr(to) },
        ).catch(() => [])) || [{ gp: 0 }];
        return Number(rows?.[0]?.gp || 0);
      }
      const ytdGP = await grossBetween(fromFy, today);
      const mtdGP = await grossBetween(monthStart, today);
      const wtdGP = await grossBetween(weekStart, today);
      const todayGP = await grossBetween(today, today);
      const topProducts =
        (await query(
          `SELECT it.item_name AS label,
                  COALESCE(SUM(d.quantity * (d.unit_price * (1 - d.discount_percent/100))),0) AS value,
          d.created_at,
          u.username AS created_by_name
         FROM srv_service_invoice_details d
             JOIN srv_service_invoices i ON i.id = d.invoice_id
             LEFT JOIN inv_items it ON it.id = d.item_id AND it.company_id = i.company_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND i.invoice_date BETWEEN :from AND :to
            GROUP BY it.item_name
            ORDER BY value DESC
            LIMIT ${topProductsLimit}`,
          {
            companyId,
            branchId, branchIdsStr,
            from: toDateStr(fromFy),
            to: toDateStr(today),
          },
        ).catch(() => [])) || [];
      const topCustomers =
        (await query(
          `SELECT COALESCE(c.customer_name,'Unknown') AS label,
                  COALESCE(SUM(i.net_amount),0) AS value,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
             LEFT JOIN sal_customers c ON c.id = i.customer_id AND c.company_id = i.company_id
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND i.invoice_date BETWEEN :from AND :to
            GROUP BY COALESCE(c.customer_name,'Unknown')
            ORDER BY value DESC
            LIMIT ${topCustomersLimit}`,
          {
            companyId,
            branchId, branchIdsStr,
            from: toDateStr(fromFy),
            to: toDateStr(today),
          },
        ).catch(() => [])) || [];
      const groupColRes =
        (await query(`SELECT COUNT(*) AS c
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
              AND table_name = 'inv_items'
              AND column_name = 'group_id'`).catch(() => [])) || [];
      const hasGroupId = Number(groupColRes?.[0]?.c || 0) > 0;
      const productGroupPie =
        (await query(
          `SELECT COALESCE(g.group_name,'Unassigned') AS label,
                  COALESCE(SUM(d.quantity * (d.unit_price * (1 - d.discount_percent/100))),0) AS value,
          d.created_at,
          u.username AS created_by_name
         FROM srv_service_invoice_details d
             JOIN srv_service_invoices i ON i.id = d.invoice_id
             LEFT JOIN inv_items it ON it.id = d.item_id AND it.company_id = i.company_id
             LEFT JOIN inv_item_groups g ON g.id = it.${hasGroupId ? "group_id" : "item_group_id"}
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND i.invoice_date BETWEEN :from AND :to
            GROUP BY COALESCE(g.group_name,'Unassigned')
            ORDER BY value DESC`,
          {
            companyId,
            branchId, branchIdsStr,
            from: toDateStr(fromFy),
            to: toDateStr(today),
          },
        ).catch(() => [])) || [];
      const customerTypeDonut =
        (await query(
          `SELECT UPPER(COALESCE(c.customer_type,'OTHER')) AS label,
                  COALESCE(SUM(i.net_amount),0) AS value,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
             LEFT JOIN sal_customers c ON c.id = i.customer_id AND c.company_id = i.company_id
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND i.invoice_date BETWEEN :from AND :to
            GROUP BY UPPER(COALESCE(c.customer_type,'OTHER'))
            ORDER BY value DESC`,
          {
            companyId,
            branchId, branchIdsStr,
            from: toDateStr(fromFy),
            to: toDateStr(today),
          },
        ).catch(() => [])) || [];
      const months = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
      ];
      const monthlyRows =
        (await query(
          `SELECT DATE_FORMAT(i.invoice_date, '%Y-%m') AS ym, COALESCE(SUM(i.net_amount),0) AS v,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND YEAR(i.invoice_date) = YEAR(CURDATE())
            GROUP BY ym
            ORDER BY ym`,
          { companyId, branchId, branchIdsStr },
        ).catch(() => [])) || [];
      const monthlyRevenue = monthlyRows.map((r) => {
        const m = Number(String(r.ym || "").split("-")[1] || 0);
        return { label: months[m - 1] || r.ym, value: Number(r.v || 0) };
      });
      const halfRows =
        (await query(
          `SELECT CASE WHEN MONTH(i.invoice_date) BETWEEN 1 AND 6 THEN 'H1' ELSE 'H2' END AS label,
                  COALESCE(SUM(i.net_amount),0) AS v,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND YEAR(i.invoice_date) = YEAR(CURDATE())
            GROUP BY label
            ORDER BY label`,
          { companyId, branchId, branchIdsStr },
        ).catch(() => [])) || [];
      const halfYearRevenue = halfRows.map((r) => ({
        label: r.label,
        value: Number(r.v || 0),
      }));
      const quarterRows =
        (await query(
          `SELECT CONCAT('Q', QUARTER(i.invoice_date)) AS label,
                  COALESCE(SUM(i.net_amount),0) AS v,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND YEAR(i.invoice_date) = YEAR(CURDATE())
            GROUP BY QUARTER(i.invoice_date)
            ORDER BY QUARTER(i.invoice_date)`,
          { companyId, branchId, branchIdsStr },
        ).catch(() => [])) || [];
      const quarterRevenue = quarterRows.map((r) => ({
        label: r.label,
        value: Number(r.v || 0),
      }));
      const trendRows =
        (await query(
          `SELECT DATE_FORMAT(i.invoice_date, '%Y-%m') AS ym, COALESCE(SUM(i.net_amount),0) AS v,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
              AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
              AND i.invoice_date BETWEEN :from AND :to
            GROUP BY ym
            ORDER BY ym`,
          {
            companyId,
            branchId, branchIdsStr,
            from: toDateStr(fromFy),
            to: toDateStr(today),
          },
        ).catch(() => [])) || [];
      const salesTrend = trendRows.map((r) => {
        const m = Number(String(r.ym || "").split("-")[1] || 0);
        return { label: months[m - 1] || r.ym, value: Number(r.v || 0) };
      });
      res.json({
        cards: {
          ytd_sales: Number(ytdRow?.v || 0),
          mtd_sales: Number(mtdRow?.v || 0),
          wtd_sales: Number(wtdRow?.v || 0),
          today_sales: Number(todayRow?.v || 0),
          ytd_gross_profit: ytdGP,
          mtd_gross_profit: mtdGP,
          wtd_gross_profit: wtdGP,
          today_gross_profit: todayGP,
        },
        top_products: topProducts,
        top_customers: topCustomers,
        product_group_pie: productGroupPie,
        customer_type_donut: customerTypeDonut,
        monthly_revenue: monthlyRevenue,
        half_year_revenue: halfYearRevenue,
        quarter_revenue: quarterRevenue,
        sales_trend: salesTrend,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/invoices",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.INVOICE.MANAGE"),
  async (req, res, next) => {
    await ensureInvoiceTables();
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const body = req.body || {};
      const {
        invoice_no,
        invoice_date,
        customer_id,
        warehouse_id,
        price_type,
        payment_type,
        currency_id,
        exchange_rate,
        sales_order_id,
        service_execution_id,
        remarks,
        lines,
      } = body;
      const details = Array.isArray(lines)
        ? lines
        : Array.isArray(body.items)
          ? body.items
          : [];

      if (!customer_id) {
        throw httpError(400, "VALIDATION_ERROR", "customer_id is required");
      }
      if (!Array.isArray(details) || details.length === 0) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "At least one item is required",
        );
      }

      let subTotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;
      for (const l of details) {
        const qty = Number(l.qty || l.quantity || 0);
        const price = Number(l.unit_price || 0);
        const discPct = Number(l.discount_percent || 0);
        const gross = qty * price;
        const discount = (gross * discPct) / 100;
        const net = gross - discount;
        const taxAmt = Number(l.taxAmt || l.tax_amount || 0);
        subTotal += net;
        taxTotal += taxAmt;
        grandTotal += net + taxAmt;
      }

      const taxCreditLines = await calculateInvoiceTaxLines(conn, {
        companyId,
        details,
        taxTotal,
      });

      await conn.beginTransaction();
      let finalInvoiceNo = String(invoice_no || "").trim();
      if (!finalInvoiceNo) {
        finalInvoiceNo = await nextInvoiceNoTx(conn, { companyId, branchId, branchIdsStr });
      } else {
        const [dupRows] = await conn.execute(
          `
          SELECT id
          FROM srv_service_invoices
          WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND invoice_no = :invoiceNo
          LIMIT 1
          `,
          { companyId, branchId, invoiceNo: finalInvoiceNo },
        );
        if (dupRows?.length) {
          finalInvoiceNo = await nextInvoiceNoTx(conn, { companyId, branchId, branchIdsStr });
        }
      }
      const [ins] = await conn.execute(
        `INSERT INTO srv_service_invoices
          (company_id, branch_id, invoice_no, invoice_date, customer_id, payment_status, status, total_amount, net_amount, balance_amount, tax_amount, tax_components, price_type, payment_type, currency_id, exchange_rate, warehouse_id, sales_order_id, service_execution_id, remarks, payment_date, created_by)
         VALUES
          (:companyId, :branchId, :invoiceNo, :invoiceDate, :customerId, 'UNPAID', 'POSTED', :totalAmount, :netAmount, :balanceAmount, :taxAmount, :taxComponents, :priceType, :paymentType, :currencyId, :exchangeRate, :warehouseId, :salesOrderId, :serviceExecutionId, :remarks, :paymentDate, :createdBy)`,
        {
          companyId,
          branchId, branchIdsStr,
          invoiceNo: finalInvoiceNo,
          invoiceDate: invoice_date || null,
          customerId: Number(customer_id),
          totalAmount: grandTotal,
          netAmount: grandTotal,
          balanceAmount: grandTotal,
          taxAmount: taxTotal,
          taxComponents: JSON.stringify(taxCreditLines),
          priceType: price_type || null,
          paymentType: payment_type || null,
          currencyId: currency_id || null,
          exchangeRate: exchange_rate || null,
          warehouseId: warehouse_id || null,
          salesOrderId: sales_order_id || null,
          serviceExecutionId: service_execution_id || null,
          remarks: remarks || null,
          paymentDate: body.payment_date
            ? String(body.payment_date).slice(0, 10)
            : null,
          createdBy: req.user?.sub || null,
        },
      );
      const invoiceId = ins.insertId;

      // Resolve price_type to ID for campaign override
      let invoicePriceTypeId = null;
      const invoicePriceTypeStr = String(price_type || "RETAIL").trim();
      if (invoicePriceTypeStr) {
        const [pt] = await query(
          `SELECT id FROM sal_price_types WHERE company_id = :companyId AND UPPER(name) = UPPER(:name) LIMIT 1`,
          { companyId, name: invoicePriceTypeStr },
        ).catch(() => []);
        if (pt?.id) invoicePriceTypeId = Number(pt.id);
      }
      const invoiceCustomerId = Number(customer_id || 0);

      let lineNo = 1;
      const invoiceItemList = [];
      for (const l of details) {
        let unitPrice = Number(l.unit_price || 0);
        const prResult = await resolveBestPrice(
          companyId,
          branchId, branchIdsStr,
          Number(l.item_id),
          invoiceCustomerId,
          invoicePriceTypeId,
          Number(l.qty || l.quantity || 0),
        ).catch(() => null);
        if (prResult && prResult.campaignApplied) {
          unitPrice = prResult.price;
        }
        await conn.execute(
          `INSERT INTO srv_service_invoice_details
             (invoice_id, item_id, quantity, unit_price, discount_percent, total_amount, net_amount, tax_amount, tax_type, uom, remarks)
           VALUES
             (:invoiceId, :itemId, :quantity, :unitPrice, :discountPercent, :totalAmount, :netAmount, :taxAmount, :taxType, :uom, :remarks)`,
          {
            invoiceId,
            itemId: Number(l.item_id),
            quantity: Number(l.qty || l.quantity || 0),
            unitPrice,
            discountPercent: Number(l.discount_percent || 0),
            totalAmount: Number(l.total || l.total_amount || 0),
            netAmount: Number(l.net || l.net_amount || 0),
            taxAmount: Number(l.taxAmt || l.tax_amount || 0),
            taxType: Number(l.tax_type || l.taxType || l.tax_id || 0) || null,
            uom: l.uom || null,
            remarks: l.remarks || null,
          },
        );
        invoiceItemList.push({
          item_id: l.item_id,
          quantity: l.qty || l.quantity || 0,
        });
        lineNo++;
      }
      // Auto-apply Purchase reward campaigns
      if (invoiceItemList.length) {
        const purchaseRewardFreeItems = await calculatePurchaseRewardFreeItems(
          companyId,
          invoiceItemList,
        );
        for (const bf of purchaseRewardFreeItems) {
          await conn.execute(
            `INSERT INTO srv_service_invoice_details (invoice_id, item_id, quantity, unit_price, discount_percent, total_amount, net_amount, tax_amount, tax_type, uom, remarks)
             VALUES (:invoiceId, :itemId, :quantity, 0, 0, 0, 0, 0, NULL, 'PCS', 'Purchase reward')`,
            { invoiceId, itemId: bf.item_id, quantity: bf.quantity },
          );
          await query(
            `UPDATE sal_purchase_reward_campaigns SET used_qty = used_qty + :qty WHERE id = :id AND company_id = :companyId`,
            { qty: bf.quantity, id: bf.campaign_id, companyId },
          ).catch(() => {});
        }
      }
      let discountTotal = 0;
      for (const l of details) {
        const qty = Number(l.qty || l.quantity || 0);
        const price = Number(l.unit_price || 0);
        const discPct = Number(l.discount_percent || 0);
        discountTotal += (qty * price * discPct) / 100;
      }
      await createPostedSalesVoucherForInvoiceTx(conn, {
        companyId,
        branchId, branchIdsStr,
        invoiceId,
        invoiceNo: finalInvoiceNo,
        invoiceDate: invoice_date || toYmd(new Date()),
        customerId: Number(customer_id),
        grandTotal,
        baseTotal: subTotal,
        taxTotal,
        discountTotal,
        currencyId: currency_id || null,
        exchangeRate: exchange_rate || 1,
        createdBy: req.user?.sub || null,
        lineTaxes: taxCreditLines,
        itemLines: details,
        remarks: remarks || null,
      });

      await conn.commit();
      res.status(201).json({ id: invoiceId, status: "POSTED" });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/invoices/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.INVOICE.MANAGE"),
  requireIdParam("id"),
  async (req, res, next) => {
    await ensureInvoiceTables();
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      const body = req.body || {};
      const {
        invoice_no,
        invoice_date,
        customer_id,
        warehouse_id,
        price_type,
        payment_type,
        currency_id,
        exchange_rate,
        sales_order_id,
        remarks,
        lines,
      } = body;
      const details = Array.isArray(lines)
        ? lines
        : Array.isArray(body.items)
          ? body.items
          : [];

      const existing = await query(
        "SELECT id, invoice_no, status FROM srv_service_invoices WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1",
        { id, companyId, branchId, branchIdsStr },
      );
      if (!existing.length)
        throw httpError(404, "NOT_FOUND", "Invoice not found");
      const existingInvoiceNo = String(existing[0].invoice_no || "");
      const existingStatus = String(existing[0].status || "DRAFT");

      if (!Array.isArray(details) || details.length === 0) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "At least one item is required",
        );
      }

      let subTotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;
      for (const l of details) {
        const qty = Number(l.qty || l.quantity || 0);
        const price = Number(l.unit_price || 0);
        const discPct = Number(l.discount_percent || 0);
        const gross = qty * price;
        const discount = (gross * discPct) / 100;
        const net = gross - discount;
        const taxAmt = Number(l.taxAmt || l.tax_amount || 0);
        subTotal += net;
        taxTotal += taxAmt;
        grandTotal += net + taxAmt;
      }

      const taxCreditLines = await calculateInvoiceTaxLines(conn, {
        companyId,
        details,
        taxTotal,
      });

      const effectiveStatus = String(body.status || existingStatus || "DRAFT");
      await conn.beginTransaction();
      await conn.execute(
        `UPDATE srv_service_invoices
           SET invoice_no = :invoiceNo,
               invoice_date = :invoiceDate,
               customer_id = :customerId,
               total_amount = :totalAmount,
               net_amount = :netAmount,
               balance_amount = :balanceAmount,
               tax_amount = :taxAmount,
               tax_components = :taxComponents,
               price_type = :priceType,
               payment_type = :paymentType,
               currency_id = :currencyId,
               exchange_rate = :exchangeRate,
               warehouse_id = :warehouseId,
               sales_order_id = :salesOrderId,
               remarks = :remarks,
               status = :status
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        {
          id,
          companyId,
          branchId, branchIdsStr,
          invoiceNo: String(invoice_no || ""),
          invoiceDate: invoice_date || null,
          customerId: Number(customer_id),
          totalAmount: grandTotal,
          netAmount: grandTotal,
          balanceAmount: grandTotal,
          taxAmount: taxTotal,
          taxComponents: JSON.stringify(taxCreditLines),
          priceType: price_type || null,
          paymentType: payment_type || null,
          currencyId: currency_id || null,
          exchangeRate: exchange_rate || null,
          warehouseId: warehouse_id || null,
          salesOrderId: sales_order_id || null,
          remarks: remarks || null,
          status: effectiveStatus,
          paymentDate: body.payment_date
            ? String(body.payment_date).slice(0, 10)
            : null,
        },
      );

      await conn.execute(
        "DELETE FROM srv_service_invoice_details WHERE invoice_id = :id",
        { id },
      );
      let putInvoicePriceTypeId = null;
      const putInvoicePriceTypeStr = String(price_type || "RETAIL").trim();
      if (putInvoicePriceTypeStr) {
        const [pt] = await query(
          `SELECT id FROM sal_price_types WHERE company_id = :companyId AND UPPER(name) = UPPER(:name) LIMIT 1`,
          { companyId, name: putInvoicePriceTypeStr },
        ).catch(() => []);
        if (pt?.id) putInvoicePriceTypeId = Number(pt.id);
      }
      const putInvoiceCustomerId = Number(customer_id || 0);
      for (const l of details) {
        let unitPrice = Number(l.unit_price || 0);
        const prResult = await resolveBestPrice(
          companyId,
          branchId, branchIdsStr,
          Number(l.item_id),
          putInvoiceCustomerId,
          putInvoicePriceTypeId,
          Number(l.qty || l.quantity || 0),
        ).catch(() => null);
        if (prResult && prResult.campaignApplied) {
          unitPrice = prResult.price;
        }
        await conn.execute(
          `INSERT INTO srv_service_invoice_details
             (invoice_id, item_id, quantity, unit_price, discount_percent, total_amount, net_amount, tax_amount, tax_type, uom, remarks)
           VALUES
             (:invoiceId, :itemId, :quantity, :unitPrice, :discountPercent, :totalAmount, :netAmount, :taxAmount, :taxType, :uom, :remarks)`,
          {
            invoiceId: id,
            itemId: Number(l.item_id),
            quantity: Number(l.qty || l.quantity || 0),
            unitPrice,
            discountPercent: Number(l.discount_percent || 0),
            totalAmount: Number(l.total || l.total_amount || 0),
            netAmount: Number(l.net || l.net_amount || 0),
            taxAmount: Number(l.taxAmt || l.tax_amount || 0),
            taxType: Number(l.tax_type || l.taxType || l.tax_id || 0) || null,
            uom: l.uom || null,
            remarks: l.remarks || null,
          },
        );
      }
      // Auto-apply Purchase reward campaigns
      if (details && details.length) {
        const purchaseRewardFreeItems = await calculatePurchaseRewardFreeItems(
          companyId,
          details,
        );
        for (const bf of purchaseRewardFreeItems) {
          await conn.execute(
            `INSERT INTO srv_service_invoice_details (invoice_id, item_id, quantity, unit_price, discount_percent, total_amount, net_amount, tax_amount, tax_type, uom, remarks)
             VALUES (:invoiceId, :itemId, :quantity, 0, 0, 0, 0, 0, NULL, 'PCS', 'Purchase reward')`,
            { invoiceId: id, itemId: bf.item_id, quantity: bf.quantity },
          );
          await query(
            `UPDATE sal_purchase_reward_campaigns SET used_qty = used_qty + :qty WHERE id = :id AND company_id = :companyId`,
            { qty: bf.quantity, id: bf.campaign_id, companyId },
          ).catch(() => {});
        }
      }
      if (effectiveStatus === "POSTED" && Number(grandTotal || 0) > 0) {
        let discountTotal = 0;
        for (const l of details) {
          const qty = Number(l.qty || l.quantity || 0);
          const price = Number(l.unit_price || 0);
          const discPct = Number(l.discount_percent || 0);
          discountTotal += (qty * price * discPct) / 100;
        }
        await createPostedSalesVoucherForInvoiceTx(conn, {
          companyId,
          branchId, branchIdsStr,
          invoiceId: id,
          invoiceNo: String(invoice_no || existingInvoiceNo || ""),
          invoiceDate: invoice_date || toYmd(new Date()),
          customerId: Number(customer_id),
          grandTotal,
          baseTotal: subTotal,
          taxTotal,
          discountTotal,
          currencyId: currency_id || null,
          exchangeRate: exchange_rate || 1,
          createdBy: req.user?.sub || null,
          lineTaxes: taxCreditLines,
          itemLines: details,
          remarks: remarks || null,
        });
      }
      await conn.commit();
      res.json({ id });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/invoices/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.INVOICE.MANAGE"),
  requireIdParam("id"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      const invoices = await query(
        "SELECT id, invoice_no, invoice_date, customer_id, net_amount, balance_amount, status, currency_id, exchange_rate, remarks FROM srv_service_invoices WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1",
        { id, companyId, branchId, branchIdsStr },
      );
      if (!invoices.length)
        throw httpError(404, "NOT_FOUND", "Invoice not found");
      const inv = invoices[0];
      if (String(inv.status) === "POSTED") {
        return res.json({
          id,
          status: "POSTED",
          payment_status: inv.payment_status,
        });
      }
      const details = await query(
        "SELECT item_id, quantity, unit_price, discount_percent, total_amount, net_amount, tax_amount, tax_type FROM srv_service_invoice_details WHERE invoice_id = :id",
        { id },
      );
      if (!details.length)
        throw httpError(400, "VALIDATION_ERROR", "No line items");

      let subTotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;
      for (const l of details) {
        const qty = Number(l.quantity || 0);
        const price = Number(l.unit_price || 0);
        const discPct = Number(l.discount_percent || 0);
        const gross = qty * price;
        const discount = (gross * discPct) / 100;
        const net = gross - discount;
        const taxAmt = Number(l.tax_amount || 0);
        subTotal += net;
        taxTotal += taxAmt;
        grandTotal += net + taxAmt;
      }

      const taxCreditLines = await calculateInvoiceTaxLines(conn, {
        companyId,
        details,
        taxTotal,
      });

      let discountTotal = 0;
      for (const l of details) {
        const qty = Number(l.quantity || 0);
        const price = Number(l.unit_price || 0);
        const discPct = Number(l.discount_percent || 0);
        discountTotal += (qty * price * discPct) / 100;
      }

      const bal = Number(inv.balance_amount || inv.net_amount || grandTotal);
      const paymentStatus =
        bal <= 0 ? "PAID" : bal > 0 ? "UNPAID" : "PARTIALLY_PAID";

      await conn.beginTransaction();
      await conn.execute(
        `UPDATE srv_service_invoices
           SET status = 'POSTED',
               payment_status = :paymentStatus,
               balance_amount = :balance,
               total_amount = :totalAmount,
               net_amount = :netAmount,
               tax_amount = :taxAmount,
               tax_components = :taxComponents
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        {
          id,
          companyId,
          branchId, branchIdsStr,
          paymentStatus,
          balance: bal,
          totalAmount: grandTotal,
          netAmount: grandTotal,
          taxAmount: taxTotal,
          taxComponents: JSON.stringify(taxCreditLines),
        },
      );

      await createPostedSalesVoucherForInvoiceTx(conn, {
        companyId,
        branchId, branchIdsStr,
        invoiceId: id,
        invoiceNo: String(inv.invoice_no || ""),
        invoiceDate: inv.invoice_date || toYmd(new Date()),
        customerId: Number(inv.customer_id || 0),
        grandTotal,
        baseTotal: subTotal,
        taxTotal,
        discountTotal,
        currencyId: inv.currency_id || null,
        exchangeRate: inv.exchange_rate || 1,
        createdBy: req.user?.sub || null,
        lineTaxes: taxCreditLines,
        itemLines: details.map((d) => ({
          item_id: d.item_id,
          quantity: d.quantity,
          unit_price: d.unit_price,
          discount_percent: d.discount_percent,
        })),
        remarks: inv.remarks || null,
      });

      await conn.commit();
      res.json({ id, status: "POSTED", payment_status: paymentStatus });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/deliveries",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  cacheListResponse(30),
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const items = await query(
        `
        SELECT
          d.id,
          d.delivery_no,
          d.delivery_date,
          d.sales_order_id,
          d.invoice_id,
          d.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          d.status,
          d.created_at,
          u.username AS created_by_name
         FROM sal_deliveries d
        LEFT JOIN sal_customers c
          ON c.id = d.customer_id AND c.company_id = d.company_id
         LEFT JOIN adm_users u ON u.id = d.created_by
          WHERE d.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(d.branch_id, :branchIdsStr))
        ORDER BY d.delivery_date DESC, d.id DESC
        `,
        { companyId, branchId, branchIdsStr },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/deliveries/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `
        SELECT delivery_no,
          created_at,
          u.username AS created_by_name
         FROM sal_deliveries
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND delivery_no REGEXP '^DN-?[0-9]{6}$'
        ORDER BY CAST(REPLACE(delivery_no, 'DN-', '') AS UNSIGNED) DESC
        LIMIT 1
        `,
        { companyId, branchId, branchIdsStr },
      ).catch(() => []);
      let nextNum = 1;
      if (rows.length > 0) {
        const prev = String(rows[0].delivery_no || "");
        const numPart = prev.replace(/^DN-?/, "");
        const n = parseInt(numPart, 10);
        if (Number.isFinite(n)) nextNum = n + 1;
      }
      const nextNo = `DN${String(nextNum).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/deliveries/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const items = await query(
        `
        SELECT
          d.id,
          d.delivery_no,
          d.delivery_date,
          d.invoice_id,
          d.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          d.status,
          d.sales_order_id,
          d.remarks,
          d.delivery_instructions,
          d.terms_and_conditions,
          d.total_tax,
          d.invoice_amount,
          d.created_at,
          u.username AS created_by_name
         FROM sal_deliveries d
        LEFT JOIN sal_customers c
          ON c.id = d.customer_id AND c.company_id = d.company_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.id = :id AND d.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!items.length)
        throw httpError(404, "NOT_FOUND", "Delivery not found");
      const details = await query(
        `
        SELECT
          dd.id,
          dd.item_id,
          dd.quantity,
          dd.unit_price,
          dd.uom,
          it.item_code,
          it.item_name,
          dd.created_at,
          u.username AS created_by_name
         FROM sal_delivery_details dd
        LEFT JOIN inv_items it
          ON it.id = dd.item_id AND it.company_id = :companyId
        LEFT JOIN adm_users u ON u.id = dd.created_by
         WHERE dd.delivery_id = :id
        ORDER BY dd.id ASC
        `,
        { id, companyId },
      ).catch(() => []);
      res.json({
        item: items[0],
        details: Array.isArray(details) ? details : [],
      });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/deliveries/:id/status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const status = String(req.body?.status || "")
        .trim()
        .toUpperCase();
      const allowed = new Set(["DRAFT", "DELIVERED", "CANCELLED"]);
      if (!allowed.has(status))
        throw httpError(400, "VALIDATION_ERROR", "Invalid status");
      const [existing] = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM sal_deliveries
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Delivery not found");
      await query(
        `
        UPDATE sal_deliveries
           SET status = :status
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        `,
        { id, companyId, branchId, branchIdsStr, status },
      );
      res.json({ id, status });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/prices/standard",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.PRICE.CREATE",
    "SAL.PRICE.EDIT",
    "SAL.PRICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      await ensureStandardPriceSyncTriggersOnce();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const product_id = Number(req.body?.product_id);
      if (!Number.isFinite(product_id) || product_id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "product_id is required");
      }
      const payload = {
        companyId,
        branchId, branchIdsStr,
        product_id,
        cost_price: Number(req.body?.cost_price || 0),
        selling_price: Number(req.body?.selling_price || 0),
        margin_percent:
          req.body?.margin_percent !== undefined &&
          req.body?.margin_percent !== null
            ? Number(req.body.margin_percent)
            : 0,
        effective_date: req.body?.effective_date || null,
        price_type_id:
          req.body?.price_type_id !== undefined &&
          req.body?.price_type_id !== null &&
          req.body?.price_type_id !== ""
            ? Number(req.body.price_type_id)
            : null,
        uom: req.body?.uom || null,
        currency_id:
          req.body?.currency_id !== undefined &&
          req.body?.currency_id !== null &&
          req.body?.currency_id !== ""
            ? Number(req.body.currency_id)
            : null,
      };
      const ptId =
        payload.price_type_id !== null && payload.price_type_id !== undefined
          ? Number(payload.price_type_id)
          : null;
      const [existing] = await query(
        `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM sal_standard_prices
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
           AND product_id = :product_id
           AND (branch_id <=> :branchId)
           AND (price_type_id <=> :price_type_id)
         LIMIT 1`,
        {
          companyId,
          branchId, branchIdsStr,
          product_id,
          price_type_id: Number.isFinite(ptId) ? ptId : null,
        },
      ).catch(() => []);
      if (existing?.id) {
        await query(
          `UPDATE sal_standard_prices SET
             cost_price = :cost_price,
             selling_price = :selling_price,
             margin_percent = :margin_percent,
             effective_date = :effective_date,
             price_type_id = :price_type_id,
             uom = :uom,
             currency_id = :currency_id,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = :id AND company_id = :companyId`,
          { ...payload, id: existing.id },
        );
        return res.json({
          id: existing.id,
          updated: true,
          item: { ...payload },
        });
      }
      const ins = await query(
        `INSERT INTO sal_standard_prices
          (company_id, branch_id, product_id, cost_price, selling_price, margin_percent, effective_date, price_type_id, uom, currency_id)
         VALUES
          (:companyId, :branchId, :product_id, :cost_price, :selling_price, :margin_percent, :effective_date, :price_type_id, :uom, :currency_id)`,
        payload,
      );
      res.status(201).json({ id: ins?.insertId || null, item: { ...payload } });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/prices/customer",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.PRICE.VIEW",
    "SAL.INVOICE.VIEW",
    "SAL.ORDER.VIEW",
  ]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const customer_id =
        req.query?.customer_id !== undefined && req.query?.customer_id !== ""
          ? Number(req.query.customer_id)
          : null;
      const rows = await query(
        `SELECT cp.*,
          cp.created_at,
          u.username AS created_by_name
         FROM sal_customer_prices cp
        LEFT JOIN adm_users u ON u.id = cp.created_by
         WHERE cp.company_id = :companyId
           AND ((:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR cp.branch_id IS NULL)
           AND (:customer_id IS NULL OR cp.customer_id = :customer_id)
         ORDER BY cp.updated_at DESC, cp.id DESC`,
        { companyId, branchId, branchIdsStr, customer_id },
      ).catch(() => []);
      res.json({ items: Array.isArray(rows) ? rows : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/prices/customer",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.PRICE.CREATE",
    "SAL.PRICE.EDIT",
    "SAL.PRICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const customer_id = Number(req.body?.customer_id);
      const product_id = Number(req.body?.product_id);
      if (!Number.isFinite(customer_id) || customer_id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "customer_id is required");
      }
      if (!Number.isFinite(product_id) || product_id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "product_id is required");
      }
      const payload = {
        companyId,
        branchId, branchIdsStr,
        customer_id,
        product_id,
        standard_price: Number(req.body?.standard_price || 0),
        customer_price: Number(req.body?.customer_price || 0),
        discount_percent:
          req.body?.discount_percent !== undefined &&
          req.body?.discount_percent !== null &&
          req.body?.discount_percent !== ""
            ? Number(req.body.discount_percent)
            : 0,
        min_quantity:
          req.body?.min_quantity !== undefined &&
          req.body?.min_quantity !== null &&
          req.body?.min_quantity !== ""
            ? Number(req.body.min_quantity)
            : 1,
        effective_from: req.body?.effective_from || null,
        effective_to: req.body?.effective_to || null,
        price_type_id:
          req.body?.price_type_id !== undefined &&
          req.body?.price_type_id !== null &&
          req.body?.price_type_id !== ""
            ? Number(req.body.price_type_id)
            : null,
        uom: req.body?.uom || null,
        currency_id:
          req.body?.currency_id !== undefined &&
          req.body?.currency_id !== null &&
          req.body?.currency_id !== ""
            ? Number(req.body.currency_id)
            : null,
      };
      const ptId =
        payload.price_type_id !== null && payload.price_type_id !== undefined
          ? Number(payload.price_type_id)
          : null;
      const [existing] = await query(
        `SELECT id FROM sal_customer_prices
          WHERE company_id = :companyId
            AND customer_id = :customer_id
            AND product_id = :product_id
            AND (price_type_id <=> :price_type_id)
          LIMIT 1`,
        {
          companyId,
          customer_id,
          product_id,
          price_type_id: Number.isFinite(ptId) ? ptId : null,
        },
      ).catch(() => []);
      if (existing?.id) {
        await query(
          `UPDATE sal_customer_prices SET
             standard_price = :standard_price,
             customer_price = :customer_price,
             discount_percent = :discount_percent,
             min_quantity = :min_quantity,
             effective_from = :effective_from,
             effective_to = :effective_to,
             price_type_id = :price_type_id,
             uom = :uom,
             currency_id = :currency_id,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = :id AND company_id = :companyId`,
          { ...payload, id: existing.id },
        );
        return res.json({
          id: existing.id,
          updated: true,
          item: { ...payload },
        });
      }
      const ins = await query(
        `INSERT INTO sal_customer_prices
          (company_id, branch_id, customer_id, product_id, standard_price, customer_price, discount_percent, min_quantity, effective_from, effective_to, price_type_id, uom, currency_id)
         VALUES
          (:companyId, :branchId, :customer_id, :product_id, :standard_price, :customer_price, :discount_percent, :min_quantity, :effective_from, :effective_to, :price_type_id, :uom, :currency_id)`,
        payload,
      );
      res.status(201).json({ id: ins?.insertId || null, item: { ...payload } });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/prices/bulk/standard",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.PRICE.CREATE",
    "SAL.PRICE.EDIT",
    "SAL.PRICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length) return res.json({ success: true, inserted: 0 });
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      let inserted = 0;
      for (const row of items) {
        const productName = String(row["Item Name"] || "").trim();
        const itemCode = String(row["Item Code"] || "").trim();
        const [product] = await query(
          `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM inv_items
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
             AND (:itemCode = '' OR item_code = :itemCode)
             AND (:productName = '' OR item_name = :productName)
           LIMIT 1`,
          { companyId, itemCode, productName },
        ).catch(() => []);
        if (!product?.id) continue;
        const priceTypeName = String(row["Price Type"] || "").trim();
        let bulkPriceTypeId = null;
        if (priceTypeName) {
          const [pt] = await query(
            `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM sal_price_types
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND UPPER(TRIM(name)) = UPPER(TRIM(:name))
             LIMIT 1`,
            { companyId, name: priceTypeName },
          ).catch(() => []);
          if (pt?.id) bulkPriceTypeId = Number(pt.id);
        }
        await query(
          `INSERT INTO sal_standard_prices
            (company_id, branch_id, product_id, cost_price, selling_price, margin_percent, effective_date, uom, price_type_id)
           VALUES
            (:companyId, :branchId, :product_id, :cost_price, :selling_price, :margin_percent, :effective_date, :uom, :price_type_id)`,
          {
            companyId,
            branchId, branchIdsStr,
            product_id: Number(product.id),
            cost_price: Number(row["Cost Price"] || 0),
            selling_price: Number(row["Selling Price"] || 0),
            margin_percent: Number(row["Margin %"] || 0),
            effective_date: row["Effective Date (YYYY-MM-DD)"] || null,
            uom: row["UOM"] || null,
            price_type_id: bulkPriceTypeId,
          },
        );
        inserted += 1;
      }
      res.json({ success: true, inserted });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/prices/bulk/customer",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.PRICE.CREATE",
    "SAL.PRICE.EDIT",
    "SAL.PRICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length) return res.json({ success: true, inserted: 0 });
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      let inserted = 0;
      for (const row of items) {
        const customerName = String(row["Customer Name"] || "").trim();
        const itemCode = String(row["Item Code"] || "").trim();
        const [customer] = await query(
          `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM sal_customers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND customer_name = :customerName
           LIMIT 1`,
          { companyId, customerName },
        ).catch(() => []);
        const [product] = await query(
          `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM inv_items
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND item_code = :itemCode
           LIMIT 1`,
          { companyId, itemCode },
        ).catch(() => []);
        if (!customer?.id || !product?.id) continue;
        await query(
          `INSERT INTO sal_customer_prices
            (company_id, branch_id, customer_id, product_id, standard_price, customer_price, discount_percent, min_quantity, effective_from, effective_to, uom)
           VALUES
            (:companyId, :branchId, :customer_id, :product_id, :standard_price, :customer_price, :discount_percent, :min_quantity, :effective_from, :effective_to, :uom)`,
          {
            companyId,
            branchId, branchIdsStr,
            customer_id: Number(customer.id),
            product_id: Number(product.id),
            standard_price: Number(row["Standard Price"] || 0),
            customer_price: Number(row["Customer Price"] || 0),
            discount_percent: Number(row["Discount %"] || 0),
            min_quantity: Number(row["Min Quantity"] || 1),
            effective_from: row["Effective From (YYYY-MM-DD)"] || null,
            effective_to: row["Effective To (YYYY-MM-DD)"] || null,
            uom: row["UOM"] || null,
          },
        );
        inserted += 1;
      }
      res.json({ success: true, inserted });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/prices/customer/bulk-percentage",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.PRICE.CREATE",
    "SAL.PRICE.EDIT",
    "SAL.PRICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const customer_id = Number(req.body?.customer_id);
      const price_type_id = req.body?.price_type_id
        ? Number(req.body.price_type_id)
        : null;
      const item_ids = Array.isArray(req.body?.item_ids)
        ? req.body.item_ids.map(Number)
        : [];
      const percentage = Number(req.body?.percentage || 0);
      const operator = req.body?.operator === "-" ? "-" : "+";

      if (!Number.isFinite(customer_id) || customer_id <= 0) {
        return res.status(400).json({ message: "customer_id is required" });
      }
      if (!item_ids.length) {
        return res
          .status(400)
          .json({ message: "At least one item_id is required" });
      }
      if (!percentage || percentage <= 0) {
        return res
          .status(400)
          .json({ message: "A valid percentage > 0 is required" });
      }

      const items = await query(
        `SELECT id, selling_price, currency_id, uom
           FROM inv_items
          WHERE company_id = :companyId
            AND id IN (:item_ids)`,
        { companyId, item_ids },
      );

      let applied = 0;
      for (const item of items) {
        const sellingPrice = Number(item.selling_price || 0);
        const adjustment = sellingPrice * (percentage / 100);
        const customerPrice =
          operator === "-"
            ? sellingPrice - adjustment
            : sellingPrice + adjustment;

        const [existing] = await query(
          `SELECT id FROM sal_customer_prices
            WHERE company_id = :companyId
              AND customer_id = :customer_id
              AND product_id = :product_id
              AND (price_type_id <=> :price_type_id)
            LIMIT 1`,
          {
            companyId,
            customer_id,
            product_id: Number(item.id),
            price_type_id,
          },
        ).catch(() => []);

        const today = new Date().toISOString().slice(0, 10);
        if (existing?.id) {
          await query(
            `UPDATE sal_customer_prices SET
               customer_price = :customer_price,
               standard_price = :standard_price,
               price_type_id = :price_type_id,
               uom = :uom,
               currency_id = :currency_id,
               effective_from = :effective_from,
               updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND company_id = :companyId`,
            {
              id: existing.id,
              companyId,
              customer_price: Math.round(customerPrice * 100) / 100,
              standard_price: sellingPrice,
              price_type_id,
              uom: item.uom || null,
              currency_id: item.currency_id || null,
              effective_from: today,
            },
          );
        } else {
          await query(
            `INSERT INTO sal_customer_prices
              (company_id, branch_id, customer_id, product_id, standard_price, customer_price, price_type_id, uom, currency_id, effective_from)
             VALUES
              (:companyId, :branchId, :customer_id, :product_id, :standard_price, :customer_price, :price_type_id, :uom, :currency_id, :effective_from)`,
            {
              companyId,
              branchId, branchIdsStr,
              customer_id,
              product_id: Number(item.id),
              standard_price: sellingPrice,
              customer_price: Math.round(customerPrice * 100) / 100,
              price_type_id,
              uom: item.uom || null,
              currency_id: item.currency_id || null,
              effective_from: today,
            },
          );
        }
        applied++;
      }

      res.json({ success: true, applied });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/prices/best-price",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureStandardPriceSyncTriggersOnce();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const productId = Number(req.body?.product_id);
      const qtyParam = Number(req.body?.quantity || 0);
      const priceTypeInput = req.body?.price_type;
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ message: "Invalid product_id" });
      }
      let priceTypeId = null;
      if (priceTypeInput != null) {
        const asNum = Number(priceTypeInput);
        if (Number.isFinite(asNum) && asNum > 0) {
          priceTypeId = asNum;
        } else {
          const name = String(priceTypeInput || "").trim();
          if (name) {
            const [pt] = await query(
              `SELECT id FROM sal_price_types WHERE company_id = :companyId AND UPPER(name) = UPPER(:name) LIMIT 1`,
              { companyId, name },
            ).catch(() => []);
            if (pt?.id) priceTypeId = Number(pt.id);
          }
        }
      }

      const customerId = Number(req.body?.customer_id);
      const result = await resolveBestPrice(
        companyId,
        branchId,
        productId,
        customerId,
        priceTypeId,
        qtyParam,
      );
      return res.json({
        price: result.price,
        campaign_applied: result.campaignApplied,
      });
    } catch (e) {
      next(e);
    }
  },
);

// ===== DISCOUNT SCHEMES =====
// Minimal list endpoint to avoid 404 for client DiscountSchemeList
router.get(
  "/discount-schemes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      console.log(
        `[GET /discount-schemes] companyId=${companyId}, userId=${req.user?.id}, user.companyIds=${JSON.stringify(req.user?.companyIds)}`,
      );
      await ensureDiscountTables();
      const items = await query(
        `
        SELECT 
          id,
          scheme_code,
          scheme_name,
          discount_type,
          discount_value,
          effective_from,
          effective_to,
          min_quantity,
          min_purchase_amount,
          max_discount_amount,
          description,
          is_active,
          created_at,
           u.username AS created_by_name
         FROM sal_discount_schemes
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
        ORDER BY id DESC
        `,
        { companyId },
      );
      console.log(
        `[GET /discount-schemes] Found ${items?.length || 0} items for companyId=${companyId}`,
      );
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      console.error(`[GET /discount-schemes] Error: ${e.message}`, e);
      next(e);
    }
  },
);

// ===== DISCOUNT SCHEMES CRUD =====
let _discountTablesEnsured = false;

async function ensureDiscountTables() {
  if (_discountTablesEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS sal_discount_schemes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      scheme_code VARCHAR(50) NOT NULL,
      scheme_name VARCHAR(255) NOT NULL,
      discount_type ENUM('PERCENTAGE','FIXED') NOT NULL,
      discount_value DECIMAL(10,2) NOT NULL,
      min_quantity DECIMAL(18,3) NOT NULL DEFAULT '0.000',
      max_quantity DECIMAL(18,3) DEFAULT '0.000',
      effective_from DATE NOT NULL,
      effective_to DATE DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT '1',
      min_purchase_amount DECIMAL(18,2) DEFAULT '0.00',
      max_discount_amount DECIMAL(18,2) DEFAULT '0.00',
      description VARCHAR(255) DEFAULT NULL,
      created_by BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_discount_scheme_code (company_id, scheme_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS sal_discount_scheme_items (
      scheme_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (scheme_id, item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Ensure columns added in later migrations exist on older tables
  const missingCols = [
    "max_quantity DECIMAL(18,3) DEFAULT '0.000' AFTER min_quantity",
    "min_purchase_amount DECIMAL(18,2) DEFAULT '0.00' AFTER max_quantity",
    "max_discount_amount DECIMAL(18,2) DEFAULT '0.00' AFTER min_purchase_amount",
    "description VARCHAR(255) DEFAULT NULL AFTER max_discount_amount",
  ];
  for (const col of missingCols) {
    try {
      await query(`ALTER TABLE sal_discount_schemes ADD COLUMN ${col}`);
    } catch (e) {
      /* column already exists or added */
    }
  }
  _discountTablesEnsured = true;
}

router.get(
  "/discount-schemes/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      await ensureDiscountTables();
      const { id } = req.params;
      const [scheme] = await query(
        `SELECT * FROM sal_discount_schemes WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      ).catch(() => []);
      if (!scheme) return res.status(404).json({ message: "Not found" });
      const items = await query(
        `SELECT si.item_id, i.item_code, i.item_name
         FROM sal_discount_scheme_items si
         JOIN inv_items i ON i.id = si.item_id
         WHERE si.scheme_id = :id ORDER BY si.item_id`,
        { id },
      ).catch(() => []);
      scheme.items = items || [];
      res.json(scheme);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/discount-schemes/discount",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      console.log(
        `[POST /discount-schemes/discount] Creating with companyId=${companyId}, userId=${req.user?.id}`,
      );
      await ensureDiscountTables();
      const userId = req.user?.id || null;
      const {
        scheme_code,
        scheme_name,
        discount_type,
        discount_value,
        effective_from,
        effective_to,
        min_quantity,
        max_quantity,
        description,
        is_active,
        itemIds,
      } = req.body;
      const result = await query(
        `INSERT INTO sal_discount_schemes (company_id, scheme_code, scheme_name, discount_type, discount_value, effective_from, effective_to, min_quantity, max_quantity, description, is_active, created_by)
         VALUES (:companyId, :scheme_code, :scheme_name, :discount_type, :discount_value, :effective_from, :effective_to, :min_quantity, :max_quantity, :description, :is_active, :created_by)`,
        {
          companyId,
          scheme_code,
          scheme_name,
          discount_type,
          discount_value,
          effective_from,
          effective_to: effective_to || null,
          min_quantity: min_quantity || 0,
          max_quantity: max_quantity || null,
          description,
          is_active: is_active ?? 1,
          created_by: userId,
        },
      );
      const schemeId = result?.insertId || 0;
      console.log(
        `[POST /discount-schemes/discount] Inserted schemeId=${schemeId} with companyId=${companyId}`,
      );
      if (Array.isArray(itemIds) && itemIds.length) {
        const values = itemIds
          .map((iid) => `(${Number(schemeId)},${Number(iid)})`)
          .join(",");
        await query(
          `INSERT INTO sal_discount_scheme_items (scheme_id, item_id) VALUES ${values}`,
        ).catch(() => {});
      }
      res
        .status(201)
        .json({ id: schemeId, message: "Discount campaign created" });
    } catch (e) {
      console.error(`[POST /discount-schemes/discount] Error: ${e.message}`, e);
      next(e);
    }
  },
);

router.put(
  "/discount-schemes/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      await ensureDiscountTables();
      const { id } = req.params;
      const {
        scheme_code,
        scheme_name,
        discount_type,
        discount_value,
        effective_from,
        effective_to,
        min_quantity,
        max_quantity,
        description,
        is_active,
        itemIds,
      } = req.body;
      await query(
        `UPDATE sal_discount_schemes SET scheme_code = :scheme_code, scheme_name = :scheme_name, discount_type = :discount_type, discount_value = :discount_value, effective_from = :effective_from, effective_to = :effective_to, min_quantity = :min_quantity, max_quantity = :max_quantity, description = :description, is_active = :is_active WHERE id = :id AND company_id = :companyId`,
        {
          scheme_code,
          scheme_name,
          discount_type,
          discount_value,
          effective_from,
          effective_to: effective_to || null,
          min_quantity: min_quantity || 0,
          max_quantity: max_quantity || null,
          description,
          is_active: is_active ?? 1,
          id,
          companyId,
        },
      );
      await query(
        `DELETE FROM sal_discount_scheme_items WHERE scheme_id = :id`,
        { id },
      );
      if (Array.isArray(itemIds) && itemIds.length) {
        const values = itemIds
          .map((iid) => `(${Number(id)},${Number(iid)})`)
          .join(",");
        await query(
          `INSERT INTO sal_discount_scheme_items (scheme_id, item_id) VALUES ${values}`,
        ).catch(() => {});
      }
      res.json({ message: "Discount campaign updated" });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/discount-schemes/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      await ensureDiscountTables();
      const { id } = req.params;
      await query(
        `DELETE FROM sal_discount_scheme_items WHERE scheme_id = :id`,
        { id },
      );
      await query(
        `DELETE FROM sal_discount_schemes WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      res.json({ message: "Deleted" });
    } catch (e) {
      next(e);
    }
  },
);

// ===== PRICING HELPER (shared by best-price, orders & invoices) =====
async function resolveBestPrice(
  companyId,
  branchId,
  productId,
  customerId,
  priceTypeId,
  quantity,
) {
  let basePrice = null;

  // Cascade 1: customer price (with price_type_id)
  if (Number.isFinite(customerId) && customerId > 0 && priceTypeId != null) {
    const [cpRow] = await query(
      `SELECT customer_price FROM sal_customer_prices
       WHERE company_id = :companyId
         AND product_id = :productId
         AND customer_id = :customerId
         AND price_type_id = :priceTypeId
       ORDER BY id DESC LIMIT 1`,
      { companyId, productId, customerId, priceTypeId },
    ).catch(() => []);
    if (cpRow && cpRow.customer_price != null)
      basePrice = Number(cpRow.customer_price);
  }

  // Cascade 2: customer price (without price_type_id)
  if (basePrice == null && Number.isFinite(customerId) && customerId > 0) {
    const [cpRow2] = await query(
      `SELECT customer_price FROM sal_customer_prices
       WHERE company_id = :companyId
         AND product_id = :productId
         AND customer_id = :customerId
         AND price_type_id IS NULL
       ORDER BY id DESC LIMIT 1`,
      { companyId, productId, customerId },
    ).catch(() => []);
    if (cpRow2 && cpRow2.customer_price != null)
      basePrice = Number(cpRow2.customer_price);
  }

  // Cascade 3: standard price by price_type (or any)
  if (basePrice == null) {
    let priceRow = null;
    if (priceTypeId != null) {
      const [row] = await query(
        `SELECT selling_price FROM sal_standard_prices WHERE company_id = :companyId AND ((:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL) AND product_id = :productId AND price_type_id = :priceTypeId ORDER BY (branch_id IS NULL) ASC, COALESCE(effective_date, DATE('1900-01-01')) DESC, id DESC LIMIT 1`,
        { companyId, branchId, productId, priceTypeId },
      ).catch(() => []);
      priceRow = row || null;
    }
    if (!priceRow) {
      const [row] = await query(
        `SELECT selling_price FROM sal_standard_prices WHERE company_id = :companyId AND ((:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL) AND product_id = :productId ORDER BY (branch_id IS NULL) ASC, COALESCE(effective_date, DATE('1900-01-01')) DESC, id DESC LIMIT 1`,
        { companyId, branchId, productId },
      ).catch(() => []);
      priceRow = row || null;
    }
    if (priceRow && priceRow.selling_price != null)
      basePrice = Number(priceRow.selling_price);
  }

  // Cascade 4: fallback to item selling_price
  if (basePrice == null) {
    const [fallback] = await query(
      `SELECT selling_price FROM inv_items WHERE company_id = :companyId AND id = :productId LIMIT 1`,
      { companyId, productId },
    ).catch(() => []);
    basePrice = Number(fallback?.selling_price ?? 0);
    if (!Number.isFinite(basePrice)) basePrice = 0;
  }

  // Campaign override
  await ensureDiscountTables().catch(() => {});
  let campaignApplied = false;
  const effectiveQty = quantity > 0 ? quantity : null;
  const [campaign] = await query(
    `SELECT ds.discount_type, ds.discount_value, ds.max_discount_amount, ds.min_quantity, ds.max_quantity, ds.min_purchase_amount
     FROM sal_discount_schemes ds
     JOIN sal_discount_scheme_items dsi ON dsi.scheme_id = ds.id
     WHERE ds.company_id = :companyId
       AND ds.is_active = 1
       AND dsi.item_id = :productId
       AND ds.effective_from <= CURDATE()
       AND (ds.effective_to IS NULL OR ds.effective_to >= CURDATE())
     ORDER BY ds.discount_value DESC
     LIMIT 1`,
    { companyId, productId },
  ).catch(() => []);
  if (campaign) {
    const canApply =
      effectiveQty == null ||
      (Number(campaign.min_quantity || 0) <= effectiveQty &&
        (!campaign.max_quantity ||
          Number(campaign.max_quantity) >= effectiveQty));
    if (canApply) {
      let discountAmt = 0;
      if (campaign.discount_type === "PERCENTAGE") {
        discountAmt = (basePrice * Number(campaign.discount_value)) / 100;
      } else {
        discountAmt = Number(campaign.discount_value);
      }
      if (
        campaign.max_discount_amount != null &&
        Number(campaign.max_discount_amount) > 0
      ) {
        discountAmt = Math.min(
          discountAmt,
          Number(campaign.max_discount_amount),
        );
      }
      basePrice = Math.max(0, basePrice - discountAmt);
      campaignApplied = true;
    }
  }

  return { price: Number(basePrice.toFixed(2)), campaignApplied };
}

// ===== PURCHASE REWARD HELPER (shared by orders & invoices) =====
function parseItemIds(str) {
  if (!str) return [];
  return String(str)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function calculatePurchaseRewardFreeItems(companyId, items) {
  await ensurePurchaseRewardTables();
  const campaigns = await query(
    `SELECT * FROM sal_purchase_reward_campaigns
     WHERE company_id = :companyId
       AND is_active = 1
       AND used_qty < campaign_qty
       AND (effective_to IS NULL OR effective_to >= CURDATE())
       AND effective_from <= CURDATE()
     ORDER BY id DESC`,
    { companyId },
  ).catch(() => []);
  if (!Array.isArray(campaigns) || !campaigns.length) return [];
  const freeItems = [];
  for (const campaign of campaigns) {
    const rows = await query(
      `SELECT * FROM sal_purchase_reward_campaign_items WHERE campaign_id = :id ORDER BY id`,
      { id: campaign.id },
    ).catch(() => []);
    if (!Array.isArray(rows) || !rows.length) continue;
    for (const rule of rows) {
      const purchaseIds = parseItemIds(rule.item_ids);
      const freeIds = parseItemIds(rule.free_item_ids);
      if (!purchaseIds.length || !freeIds.length) continue;
      const cartItem = items.find((it) =>
        purchaseIds.includes(Number(it.item_id)),
      );
      if (!cartItem) continue;
      const cartQty = Number(cartItem.quantity || cartItem.qty || 0);
      const needed = Number(rule.item_qty || 0);
      if (needed <= 0 || cartQty < needed) continue;
      const times = Math.floor(cartQty / needed);
      const freeQtyEach = times * Number(rule.free_qty || 0);
      if (freeQtyEach <= 0) continue;
      for (const fid of freeIds) {
        const existingIdx = freeItems.findIndex(
          (f) => Number(f.item_id) === fid && f.campaign_id === campaign.id,
        );
        if (existingIdx >= 0) {
          freeItems[existingIdx].quantity += freeQtyEach;
        } else {
          freeItems.push({
            item_id: fid,
            quantity: freeQtyEach,
            unit_price: 0,
            discount_percent: 0,
            total_amount: 0,
            net_amount: 0,
            tax_amount: 0,
            uom: "PCS",
            campaign_id: campaign.id,
          });
        }
      }
    }
  }
  return freeItems;
}

// ===== PURCHASE REWARD CAMPAIGNS =====
let _purchaseRewardTablesEnsured = false;

async function ensurePurchaseRewardTables() {
  if (_purchaseRewardTablesEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS sal_purchase_reward_campaigns (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      campaign_name VARCHAR(255) NOT NULL,
      campaign_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
      used_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
      effective_from DATE NOT NULL,
      effective_to DATE DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT '1',
      created_by BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_pr_company (company_id),
      KEY idx_pr_created_by (created_by),
      KEY idx_pr_active (company_id, is_active, effective_from, effective_to)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS sal_purchase_reward_campaign_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      campaign_id BIGINT UNSIGNED NOT NULL,
      item_ids VARCHAR(500) NOT NULL DEFAULT '',
      item_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
      free_item_ids VARCHAR(500) NOT NULL DEFAULT '',
      free_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
      PRIMARY KEY (id),
      KEY idx_pr_items_campaign (campaign_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  _purchaseRewardTablesEnsured = true;
  try {
    await query(`
      ALTER TABLE sal_purchase_reward_campaigns
      ADD COLUMN used_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000'
      AFTER campaign_qty
    `);
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }
}
router.get(
  "/purchase-reward-campaigns/active",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      await ensurePurchaseRewardTables();
      const campaigns = await query(
        `SELECT * FROM sal_purchase_reward_campaigns
          WHERE company_id = :companyId
            AND is_active = 1
            AND used_qty < campaign_qty
            AND (effective_to IS NULL OR effective_to >= CURDATE())
            AND effective_from <= CURDATE()
          ORDER BY id DESC`,
        { companyId },
      );
      const result = Array.isArray(campaigns) ? campaigns : [];
      for (const c of result) {
        const items = await query(
          `SELECT * FROM sal_purchase_reward_campaign_items WHERE campaign_id = :id ORDER BY id`,
          { id: c.id },
        );
        c.rows = items || [];
      }
      res.json({ items: result });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/purchase-reward-campaigns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      console.log(
        `[GET /purchase-reward-campaigns] companyId=${companyId}, userId=${req.user?.id}, user.companyIds=${JSON.stringify(req.user?.companyIds)}`,
      );
      await ensurePurchaseRewardTables();
      const items = await query(
        `
        SELECT c.*, u.username AS created_by_name
         FROM sal_purchase_reward_campaigns c
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId
         ORDER BY c.id DESC
        `,
        { companyId },
      );
      console.log(
        `[GET /purchase-reward-campaigns] Found ${items?.length || 0} items for companyId=${companyId}`,
      );
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      console.error(`[GET /purchase-reward-campaigns] Error: ${e.message}`, e);
      next(e);
    }
  },
);

router.get(
  "/purchase-reward-campaigns/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      await ensurePurchaseRewardTables();
      const { id } = req.params;
      const rows = await query(
        `SELECT * FROM sal_purchase_reward_campaigns WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      if (!rows || !rows.length)
        return res.status(404).json({ message: "Not found" });
      const campaign = rows[0];
      const items = await query(
        `SELECT * FROM sal_purchase_reward_campaign_items WHERE campaign_id = :id ORDER BY id`,
        { id },
      );
      campaign.rows = items || [];
      res.json(campaign);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/purchase-reward-campaigns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      console.log(
        `[POST /purchase-reward-campaigns] Creating with companyId=${companyId}, userId=${req.user?.id}`,
      );
      await ensurePurchaseRewardTables();
      const userId = req.user?.id || null;
      const {
        campaign_name,
        campaign_qty,
        effective_from,
        effective_to,
        is_active,
        rows,
      } = req.body;
      const result = await query(
        `INSERT INTO sal_purchase_reward_campaigns (company_id, campaign_name, campaign_qty, effective_from, effective_to, is_active, created_by)
         VALUES (:companyId, :campaign_name, :campaign_qty, :effective_from, :effective_to, :is_active, :created_by)`,
        {
          companyId,
          campaign_name,
          campaign_qty: campaign_qty || 0,
          effective_from,
          effective_to,
          is_active: is_active ?? 1,
          created_by: userId,
        },
      );
      const campaignId = result?.insertId || 0;
      console.log(
        `[POST /purchase-reward-campaigns] Inserted campaignId=${campaignId} with companyId=${companyId}`,
      );
      if (Array.isArray(rows) && rows.length) {
        for (const row of rows) {
          const ids = row.item_ids || row.item_id || "";
          const fids = row.free_item_ids || row.free_item_id || "";
          if (String(ids).trim()) {
            await query(
              `INSERT INTO sal_purchase_reward_campaign_items (campaign_id, item_ids, item_qty, free_item_ids, free_qty)
               VALUES (:campaign_id, :item_ids, :item_qty, :free_item_ids, :free_qty)`,
              {
                campaign_id: campaignId,
                item_ids: String(ids).trim(),
                item_qty: row.item_qty || 0,
                free_item_ids: String(fids).trim(),
                free_qty: row.free_qty || 0,
              },
            );
          }
        }
      }
      res
        .status(201)
        .json({ id: campaignId, message: "Purchase reward campaign created" });
    } catch (e) {
      console.error(`[POST /purchase-reward-campaigns] Error: ${e.message}`, e);
      next(e);
    }
  },
);

router.put(
  "/purchase-reward-campaigns/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      await ensurePurchaseRewardTables();
      const { id } = req.params;
      const {
        campaign_name,
        campaign_qty,
        effective_from,
        effective_to,
        is_active,
        rows,
      } = req.body;
      await query(
        `UPDATE sal_purchase_reward_campaigns SET campaign_name = :campaign_name, campaign_qty = :campaign_qty, effective_from = :effective_from, effective_to = :effective_to, is_active = :is_active WHERE id = :id AND company_id = :companyId`,
        {
          campaign_name,
          campaign_qty: campaign_qty || 0,
          effective_from,
          effective_to,
          is_active: is_active ?? 1,
          id,
          companyId,
        },
      );
      await query(
        `DELETE FROM sal_purchase_reward_campaign_items WHERE campaign_id = :id`,
        { id },
      );
      if (Array.isArray(rows) && rows.length) {
        for (const row of rows) {
          const ids = row.item_ids || row.item_id || "";
          const fids = row.free_item_ids || row.free_item_id || "";
          if (String(ids).trim()) {
            await query(
              `INSERT INTO sal_purchase_reward_campaign_items (campaign_id, item_ids, item_qty, free_item_ids, free_qty)
               VALUES (:campaign_id, :item_ids, :item_qty, :free_item_ids, :free_qty)`,
              {
                campaign_id: id,
                item_ids: String(ids).trim(),
                item_qty: row.item_qty || 0,
                free_item_ids: String(fids).trim(),
                free_qty: row.free_qty || 0,
              },
            );
          }
        }
      }
      res.json({ message: "Purchase reward campaign updated" });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/purchase-reward-campaigns/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      await ensurePurchaseRewardTables();
      const { id } = req.params;
      await query(
        `DELETE FROM sal_purchase_reward_campaign_items WHERE campaign_id = :id`,
        { id },
      );
      await query(
        `DELETE FROM sal_purchase_reward_campaigns WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      res.json({ message: "Deleted" });
    } catch (e) {
      next(e);
    }
  },
);

// Endpoint to consume purchase reward campaign qty (used by POS)
router.post(
  "/purchase-reward-campaigns/:id/consume",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      await ensurePurchaseRewardTables();
      const { id } = req.params;
      const { qty } = req.body;
      const rows = await query(
        `SELECT campaign_qty, used_qty FROM sal_purchase_reward_campaigns WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      if (!rows || !rows.length)
        return res.status(404).json({ message: "Not found" });
      const campaign = rows[0];
      const used = Number(campaign.used_qty || 0) + Number(qty || 0);
      const total = Number(campaign.campaign_qty || 0);
      if (used > total)
        return res.status(400).json({ message: "Campaign qty exhausted" });
      await query(
        `UPDATE sal_purchase_reward_campaigns SET used_qty = :used WHERE id = :id`,
        { used, id },
      );
      res.json({ used_qty: used, remaining: total - used });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT 
          i.id,
          i.invoice_date,
          i.invoice_no,
          COALESCE(c.customer_name, '') AS customer_name,
          (SELECT COUNT(*),
          d.created_at,
          u.username AS created_by_name
         FROM srv_service_invoice_details d
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.invoice_id = i.id) AS items_count,
          i.total_amount,
          i.status
        FROM srv_service_invoices i
        LEFT JOIN sal_customers c
          ON c.id = i.customer_id AND c.company_id = i.company_id
        WHERE i.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND (:from IS NULL OR i.invoice_date >= :from)
          AND (:to IS NULL OR i.invoice_date <= :to)
        ORDER BY i.invoice_date DESC, i.id DESC
        `,
        { companyId, branchId, branchIdsStr, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/delivery-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT
          d.id,
          d.delivery_date,
          d.delivery_no,
          COALESCE(c.customer_name, '') AS customer_name,
          it.item_code,
          it.item_name,
          dd.quantity AS qty,
          d.created_at,
          u.username AS created_by_name
         FROM sal_deliveries d
        JOIN sal_delivery_details dd ON dd.delivery_id = d.id
        LEFT JOIN sal_customers c ON c.id = d.customer_id AND c.company_id = d.company_id
        LEFT JOIN inv_items it ON it.id = dd.item_id AND it.company_id = d.company_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND (:from IS NULL OR d.delivery_date >= :from)
          AND (:to IS NULL OR d.delivery_date <= :to)
        ORDER BY d.delivery_date DESC, d.id DESC, dd.id ASC
        `,
        { companyId, branchId, branchIdsStr, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-return",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT
          r.id,
          r.return_date,
          r.return_no,
          COALESCE(c.customer_name, '') AS customer_name,
          it.item_code,
          it.item_name,
          rd.qty_returned AS qty,
          rd.total_amount AS amount,
          r.created_at,
          u.username AS created_by_name
         FROM sal_returns r
        JOIN sal_return_details rd ON rd.return_id = r.id
        LEFT JOIN sal_customers c ON c.id = r.customer_id AND c.company_id = r.company_id
        LEFT JOIN inv_items it ON it.id = rd.item_id AND it.company_id = r.company_id
        LEFT JOIN adm_users u ON u.id = r.created_by
         WHERE r.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND (:from IS NULL OR r.return_date >= :from)
          AND (:to IS NULL OR r.return_date <= :to)
        ORDER BY r.return_date DESC, r.id DESC, rd.id ASC
        `,
        { companyId, branchId, branchIdsStr, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/debtors-balance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const asOf = req.query.asOf ? String(req.query.asOf) : null;
      const items = await query(
        `
        SELECT
          c.id,
          c.customer_name,
          0 AS opening,
          COALESCE(SUM(i.net_amount), 0) AS invoiced,
          COALESCE(SUM(i.net_amount - i.balance_amount), 0) AS received,
          COALESCE(SUM(i.balance_amount), 0) AS outstanding,
          c.created_at,
          u.username AS created_by_name
         FROM sal_customers c
        LEFT JOIN srv_service_invoices i
          ON i.customer_id = c.id
         AND i.company_id = c.company_id
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND (:asOf IS NULL OR i.invoice_date <= :asOf)
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId
        GROUP BY c.id, c.customer_name
        HAVING outstanding <> 0 OR invoiced <> 0 OR received <> 0
        ORDER BY c.customer_name ASC
        `,
        { companyId, branchId, branchIdsStr, asOf },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-profitability",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT
          i.id,
          i.invoice_date,
          i.invoice_no,
          COALESCE(c.customer_name, '') AS customer_name,
          COALESCE(i.net_amount, i.total_amount, 0) AS net_sales,
          COALESCE((
            SELECT SUM(d.quantity * COALESCE(it.cost_price, 0)),
          d.created_at,
          u.username AS created_by_name
         FROM srv_service_invoice_details d
            LEFT JOIN inv_items it
              ON it.id = d.item_id AND it.company_id = i.company_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.invoice_id = i.id
          ), 0) AS cost
        FROM srv_service_invoices i
        LEFT JOIN sal_customers c
          ON c.id = i.customer_id AND c.company_id = i.company_id
        WHERE i.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND (:from IS NULL OR i.invoice_date >= :from)
          AND (:to IS NULL OR i.invoice_date <= :to)
        ORDER BY i.invoice_date DESC, i.id DESC
        `,
        { companyId, branchId, branchIdsStr, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-tracking",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureQuotationTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const customerId = req.query.customerId
        ? Number(req.query.customerId)
        : null;
      const items = await query(
        `
        SELECT *,
          q.created_at,
          u.username AS created_by_name
         FROM (
          SELECT
            'QUOTATION' AS stage,
            q.quotation_no AS ref_no,
            COALESCE(NULLIF(q.customer_name, ''), c.customer_name, '') AS customer_name,
            q.quotation_date AS txn_date,
            q.status AS status,
            q.total_amount AS total_value
          FROM sal_quotations q
          LEFT JOIN sal_customers c
            ON c.id = q.customer_id AND c.company_id = q.company_id
        LEFT JOIN adm_users u ON u.id = q.created_by
         WHERE q.company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
            AND (:from IS NULL OR q.quotation_date >= :from)
            AND (:to IS NULL OR q.quotation_date <= :to)
            AND (:customerId IS NULL OR q.customer_id = :customerId)
          UNION ALL
          SELECT
            'ORDER' AS stage,
            o.order_no AS ref_no,
            COALESCE(c.customer_name, '') AS customer_name,
            o.order_date AS txn_date,
            o.status AS status,
            o.total_amount AS total_value
          FROM sal_orders o
          LEFT JOIN sal_customers c
            ON c.id = o.customer_id AND c.company_id = o.company_id
          WHERE o.company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
            AND (:from IS NULL OR o.order_date >= :from)
            AND (:to IS NULL OR o.order_date <= :to)
            AND (:customerId IS NULL OR o.customer_id = :customerId)
          UNION ALL
          SELECT
            'DELIVERY' AS stage,
            d.delivery_no AS ref_no,
            COALESCE(c.customer_name, '') AS customer_name,
            d.delivery_date AS txn_date,
            d.status AS status,
            COALESCE(o.total_amount, 0) AS total_value
          FROM sal_deliveries d
          LEFT JOIN sal_orders o
            ON o.id = d.sales_order_id AND o.company_id = d.company_id
          LEFT JOIN sal_customers c
            ON c.id = d.customer_id AND c.company_id = d.company_id
          WHERE d.company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
            AND (:from IS NULL OR d.delivery_date >= :from)
            AND (:to IS NULL OR d.delivery_date <= :to)
            AND (:customerId IS NULL OR d.customer_id = :customerId)
          UNION ALL
          SELECT
            'INVOICE' AS stage,
            i.invoice_no AS ref_no,
            COALESCE(c.customer_name, '') AS customer_name,
            i.invoice_date AS txn_date,
            i.status AS status,
            COALESCE(i.net_amount, i.total_amount, 0) AS total_value
          FROM srv_service_invoices i
          LEFT JOIN sal_customers c
            ON c.id = i.customer_id AND c.company_id = i.company_id
          WHERE i.company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
            AND (:from IS NULL OR i.invoice_date >= :from)
            AND (:to IS NULL OR i.invoice_date <= :to)
            AND (:customerId IS NULL OR i.customer_id = :customerId)
        ) t
        ORDER BY txn_date DESC
        LIMIT 2000
        `,
        { companyId, branchId, branchIdsStr, from, to, customerId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

// --- ADDITIONAL REPORTS ---

router.get(
  "/reports/quotation-summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.QUOTATION.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureQuotationTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const status = req.query.status ? String(req.query.status) : null;
      const salesperson = req.query.salesperson
        ? String(req.query.salesperson)
        : null;
      const rows = await query(
        `
        SELECT q.quotation_no,
               q.quotation_date,
               COALESCE(NULLIF(q.customer_name,''), c.customer_name, '') AS customer_name,
               q.total_amount,
               q.valid_until,
               q.status,
               u.username AS salesperson,
               CASE WHEN UPPER(q.status) IN ('APPROVED','CONVERTED') THEN 'YES' ELSE 'NO' END AS converted_to_order,
          q.created_at,
          u.username AS created_by_name
         FROM sal_quotations q
        LEFT JOIN sal_customers c ON c.id = q.customer_id AND c.company_id = q.company_id
        LEFT JOIN adm_users u ON u.id = q.created_by
        LEFT JOIN adm_users u ON u.id = q.created_by
         WHERE q.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND (:from IS NULL OR q.quotation_date >= :from)
          AND (:to IS NULL OR q.quotation_date <= :to)
          AND (:status IS NULL OR q.status = :status)
          AND (:salesperson IS NULL OR u.username LIKE :salespersonLike)
        ORDER BY q.quotation_date DESC, q.id DESC
        `,
        {
          companyId,
          branchId, branchIdsStr,
          from,
          to,
          status,
          salesperson,
          salespersonLike: salesperson ? `%${salesperson}%` : null,
        },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/quotation-conversion",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.QUOTATION.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureQuotationTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const totalRows = await query(
        `
        SELECT COUNT(*) AS c,
          created_at,
          u.username AS created_by_name
         FROM sal_quotations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND (:from IS NULL OR quotation_date >= :from)
          AND (:to IS NULL OR quotation_date <= :to)
        `,
        { companyId, branchId, branchIdsStr, from, to },
      ).catch(() => []);
      const convRows = await query(
        `
        SELECT COUNT(*) AS c,
          created_at,
          u.username AS created_by_name
         FROM sal_quotations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND UPPER(status) IN ('APPROVED','CONVERTED')
          AND (:from IS NULL OR quotation_date >= :from)
          AND (:to IS NULL OR quotation_date <= :to)
        `,
        { companyId, branchId, branchIdsStr, from, to },
      ).catch(() => []);
      const total = Number(totalRows?.[0]?.c || 0);
      const converted = Number(convRows?.[0]?.c || 0);
      const conversion_rate =
        total > 0 ? Math.round((converted * 100) / total) : 0;
      res.json({
        metrics: {
          total_quotations: total,
          converted_quotations: converted,
          conversion_rate_percent: conversion_rate,
          average_conversion_time_days: null,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-order-status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const status = req.query.status ? String(req.query.status) : null;
      const customer = req.query.customer ? String(req.query.customer) : null;
      const salesperson = req.query.salesperson
        ? String(req.query.salesperson)
        : null;
      const rows = await query(
        `
        SELECT o.order_no,
               o.order_date,
               COALESCE(c.customer_name,'') AS customer_name,
               o.total_amount,
               o.status,
               u.username AS salesperson,
               NULL AS linked_quotation,
          o.created_at,
          u.username AS created_by_name
         FROM sal_orders o
        LEFT JOIN sal_customers c ON c.id = o.customer_id AND c.company_id = o.company_id
        LEFT JOIN adm_users u ON u.id = o.created_by
        LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE o.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND (:from IS NULL OR o.order_date >= :from)
          AND (:to IS NULL OR o.order_date <= :to)
          AND (:status IS NULL OR o.status = :status)
          AND (:customer IS NULL OR c.customer_name LIKE :customerLike)
          AND (:salesperson IS NULL OR u.username LIKE :salespersonLike)
        ORDER BY o.order_date DESC, o.id DESC
        `,
        {
          companyId,
          branchId, branchIdsStr,
          from,
          to,
          status,
          customer,
          salesperson,
          customerLike: customer ? `%${customer}%` : null,
          salespersonLike: salesperson ? `%${salesperson}%` : null,
        },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/invoice-summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureInvoiceTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const customer = req.query.customer ? String(req.query.customer) : null;
      const paymentStatus = req.query.paymentStatus
        ? String(req.query.paymentStatus)
        : null;
      const rows = await query(
        `
        SELECT i.invoice_no,
               i.invoice_date,
               COALESCE(c.customer_name,'') AS customer_name,
               i.total_amount,
               COALESCE(i.net_amount, 0) AS net_amount,
               (i.total_amount - COALESCE(i.net_amount,0)) AS vat_amount,
               (COALESCE(i.net_amount,0) - COALESCE(i.balance_amount,0)) AS paid_amount,
               COALESCE(i.balance_amount,0) AS balance_amount,
               i.payment_status,
               i.status,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN sal_customers c ON c.id = i.customer_id AND c.company_id = i.company_id
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND (:from IS NULL OR i.invoice_date >= :from)
          AND (:to IS NULL OR i.invoice_date <= :to)
          AND (:customer IS NULL OR c.customer_name LIKE :customerLike)
          AND (:paymentStatus IS NULL OR i.payment_status = :paymentStatus)
        ORDER BY i.invoice_date DESC, i.id DESC
        `,
        {
          companyId,
          branchId, branchIdsStr,
          from,
          to,
          customer,
          paymentStatus,
          customerLike: customer ? `%${customer}%` : null,
        },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/ar-aging",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.CUSTOMER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `
        SELECT 
          COALESCE(c.customer_name,'') AS customer_name,
          i.invoice_no,
          i.invoice_date,
          NULL AS due_date,
          COALESCE(i.net_amount, i.total_amount, 0) AS amount,
          CASE WHEN DATEDIFF(CURDATE(), i.invoice_date) BETWEEN 0 AND 30 THEN COALESCE(i.balance_amount,0) ELSE 0 END AS d0_30,
          CASE WHEN DATEDIFF(CURDATE(), i.invoice_date) BETWEEN 31 AND 60 THEN COALESCE(i.balance_amount,0) ELSE 0 END AS d31_60,
          CASE WHEN DATEDIFF(CURDATE(), i.invoice_date) BETWEEN 61 AND 90 THEN COALESCE(i.balance_amount,0) ELSE 0 END AS d61_90,
          CASE WHEN DATEDIFF(CURDATE(), i.invoice_date) > 90 THEN COALESCE(i.balance_amount,0) ELSE 0 END AS d90_plus,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN sal_customers c ON c.id = i.customer_id AND c.company_id = i.company_id
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND COALESCE(i.balance_amount,0) > 0
        ORDER BY c.customer_name ASC, i.invoice_date ASC
        `,
        { companyId, branchId, branchIdsStr },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/revenue-by-customer",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `
        SELECT
          COALESCE(c.customer_name,'') AS customer_name,
          COALESCE(o.total_orders,0) AS total_orders,
          COALESCE(i.total_invoices,0) AS total_invoices,
          COALESCE(i.total_revenue,0) AS total_revenue,
          COALESCE(i.total_outstanding,0) AS outstanding_balance,
          c.created_at,
          u.username AS created_by_name
         FROM sal_customers c
        LEFT JOIN (
          SELECT customer_id, COUNT(*) AS total_orders
          FROM sal_orders
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          GROUP BY customer_id
        ) o ON o.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id,
                 COUNT(*) AS total_invoices,
                 SUM(COALESCE(net_amount, total_amount, 0)) AS total_revenue,
                 SUM(COALESCE(balance_amount, 0)) AS total_outstanding
          FROM srv_service_invoices
          WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          GROUP BY customer_id
        ) i ON i.customer_id = c.id
        WHERE c.company_id = :companyId
        ORDER BY total_revenue DESC
        `,
        { companyId, branchId, branchIdsStr },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/revenue-by-product",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `
        SELECT 
          it.item_name AS product_name,
          SUM(d.quantity) AS quantity_sold,
          SUM(COALESCE(d.net_amount, d.total_amount, d.quantity * d.unit_price)) AS total_revenue,
          AVG(d.unit_price) AS avg_selling_price,
          SUM(ROUND((d.discount_percent/100.0) * d.quantity * d.unit_price, 2)) AS discount_given,
          d.created_at,
          u.username AS created_by_name
         FROM srv_service_invoice_details d
        JOIN srv_service_invoices i ON i.id = d.invoice_id
        LEFT JOIN inv_items it ON it.id = d.item_id AND it.company_id = i.company_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE i.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        GROUP BY it.item_name
        ORDER BY total_revenue DESC
        `,
        { companyId, branchId, branchIdsStr },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/discount-utilization",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `
        SELECT 
          'STANDARD' AS discount_scheme_name,
          COALESCE(c.customer_name,'') AS customer,
          i.invoice_no,
          d.discount_percent AS discount_percent,
          ROUND((d.discount_percent/100.0) * d.quantity * d.unit_price, 2) AS discount_amount,
          u.username AS approved_by,
          d.created_at,
          u.username AS created_by_name
         FROM srv_service_invoice_details d
        JOIN srv_service_invoices i ON i.id = d.invoice_id
        LEFT JOIN sal_customers c ON c.id = i.customer_id AND c.company_id = i.company_id
        LEFT JOIN adm_users u ON u.id = i.created_by
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE i.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND d.discount_percent > 0
        ORDER BY i.invoice_date DESC, i.id DESC, d.id ASC
        `,
        { companyId, branchId, branchIdsStr },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/price-list",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.PRICE.VIEW", "SAL.ITEM.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `
        SELECT 
          it.item_name AS product,
          COALESCE(sp.price, it.sell_price, 0) AS standard_price,
          COALESCE(cp.price, NULL) AS customer_specific_price,
          sp.effective_date,
          u.username AS last_updated_by,
          it.created_at,
          u.username AS created_by_name
         FROM inv_items it
        LEFT JOIN sal_standard_prices sp ON sp.item_id = it.id AND sp.company_id = it.company_id
        LEFT JOIN sal_customer_prices cp ON cp.item_id = it.id AND cp.company_id = it.company_id
        LEFT JOIN adm_users u ON u.id = sp.updated_by
        LEFT JOIN adm_users u ON u.id = it.created_by
         WHERE it.company_id = :companyId
        ORDER BY it.item_name ASC
        `,
        { companyId, branchId, branchIdsStr },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/monthly-sales-trend",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `
        SELECT DATE_FORMAT(i.invoice_date, '%Y-%m-01') AS month_start,
               COUNT(*) AS total_invoices,
               SUM(COALESCE(i.net_amount, i.total_amount, 0)) AS total_revenue,
               SUM(COALESCE(i.net_amount, 0) - COALESCE(i.balance_amount,0)) AS total_paid,
               SUM(COALESCE(i.balance_amount,0)) AS total_discounts -- placeholder for discounts if tracked separately,
          i.created_at,
          u.username AS created_by_name
         FROM srv_service_invoices i
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        GROUP BY DATE_FORMAT(i.invoice_date, '%Y-%m-01')
        ORDER BY month_start ASC
        `,
        { companyId, branchId, branchIdsStr },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/customer-order-history",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.QUOTATION.VIEW",
    "SAL.ORDER.VIEW",
    "SAL.INVOICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const customerId = req.query.customerId
        ? String(req.query.customerId)
        : null;
      const customer = req.query.customer ? String(req.query.customer) : null;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT stage, ref_no, txn_date, amount, notes, customer_name, customer_id,
          created_at,
          created_by_name
         FROM (
          SELECT 'QUOTATION' AS stage, q.quotation_no AS ref_no, q.quotation_date AS txn_date, q.total_amount AS amount, q.status AS notes,
                 COALESCE(c.customer_name, NULLIF(q.customer_name,''), '') AS customer_name,
                 c.id AS customer_id,
                 q.created_at,
                 u.username AS created_by_name
            FROM sal_quotations q
            LEFT JOIN sal_customers c ON c.id = q.customer_id AND c.company_id = q.company_id
            LEFT JOIN adm_users u ON u.id = q.created_by
           WHERE q.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          UNION ALL
          SELECT 'ORDER' AS stage, o.order_no AS ref_no, o.order_date AS txn_date, o.total_amount AS amount, o.status AS notes,
                 COALESCE(c.customer_name,'') AS customer_name,
                 c.id AS customer_id,
                 o.created_at,
                 u.username AS created_by_name
            FROM sal_orders o
            LEFT JOIN sal_customers c ON c.id = o.customer_id AND c.company_id = o.company_id
            LEFT JOIN adm_users u ON u.id = o.created_by
           WHERE o.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          UNION ALL
          SELECT 'INVOICE' AS stage, i.invoice_no AS ref_no, i.invoice_date AS txn_date, COALESCE(i.net_amount, i.total_amount,0) AS amount, i.status AS notes,
                 COALESCE(c.customer_name,'') AS customer_name,
                 c.id AS customer_id,
                 i.created_at,
                 u.username AS created_by_name
            FROM srv_service_invoices i
            LEFT JOIN sal_customers c ON c.id = i.customer_id AND c.company_id = i.company_id
            LEFT JOIN adm_users u ON u.id = i.created_by
           WHERE i.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          UNION ALL
          SELECT 'DELIVERY' AS stage, d.delivery_no AS ref_no, d.delivery_date AS txn_date, 0 AS amount, d.status AS notes,
                 COALESCE(c.customer_name,'') AS customer_name,
                 c.id AS customer_id,
                 d.created_at,
                 u.username AS created_by_name
            FROM sal_deliveries d
            LEFT JOIN sal_customers c ON c.id = d.customer_id AND c.company_id = d.company_id
            LEFT JOIN adm_users u ON u.id = d.created_by
           WHERE d.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        ) t
        WHERE (:customerId IS NULL OR t.customer_id = :customerId)
          AND (:customer IS NULL OR t.customer_name LIKE :customerLike)
          AND (:from IS NULL OR t.txn_date >= :from)
          AND (:to IS NULL OR t.txn_date <= :to)
        ORDER BY t.txn_date DESC
        `,
        {
          companyId,
          branchId, branchIdsStr,
          customerId,
          customer,
          from,
          to,
          customerLike: customer ? `%${customer}%` : null,
        },
      ).catch(() => []);
      res.json({ items: items || [] });
    } catch (e) {
      next(e);
    }
  },
);

// Customer History Report - includes all transactions including returns
router.get(
  "/reports/customer-history",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.QUOTATION.VIEW",
    "SAL.ORDER.VIEW",
    "SAL.INVOICE.VIEW",
    "SAL.RETURN.VIEW",
  ]),
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const customerId = req.query.customerId
        ? String(req.query.customerId)
        : null;
      const customer = req.query.customer ? String(req.query.customer) : null;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;

      const items = await query(
        `
        SELECT stage, ref_no, txn_date, amount, notes, customer_name, customer_id,
          created_at,
          created_by_name
         FROM (
          SELECT 'QUOTATION' AS stage, q.quotation_no AS ref_no, q.quotation_date AS txn_date, q.total_amount AS amount, q.status AS notes,
                 COALESCE(c.customer_name, NULLIF(q.customer_name,''), '') AS customer_name,
                 c.id AS customer_id,
                 q.created_at,
                 u.username AS created_by_name
            FROM sal_quotations q
            LEFT JOIN sal_customers c ON c.id = q.customer_id AND c.company_id = q.company_id
            LEFT JOIN adm_users u ON u.id = q.created_by
           WHERE q.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          UNION ALL
          SELECT 'ORDER' AS stage, o.order_no AS ref_no, o.order_date AS txn_date, o.total_amount AS amount, o.status AS notes,
                 COALESCE(c.customer_name,'') AS customer_name,
                 c.id AS customer_id,
                 o.created_at,
                 u.username AS created_by_name
            FROM sal_orders o
            LEFT JOIN sal_customers c ON c.id = o.customer_id AND c.company_id = o.company_id
            LEFT JOIN adm_users u ON u.id = o.created_by
           WHERE o.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          UNION ALL
          SELECT 'INVOICE' AS stage, i.invoice_no AS ref_no, i.invoice_date AS txn_date, COALESCE(i.net_amount, i.total_amount,0) AS amount, i.status AS notes,
                 COALESCE(c.customer_name,'') AS customer_name,
                 c.id AS customer_id,
                 i.created_at,
                 u.username AS created_by_name
            FROM srv_service_invoices i
            LEFT JOIN sal_customers c ON c.id = i.customer_id AND c.company_id = i.company_id
            LEFT JOIN adm_users u ON u.id = i.created_by
           WHERE i.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          UNION ALL
          SELECT 'DELIVERY' AS stage, d.delivery_no AS ref_no, d.delivery_date AS txn_date, 0 AS amount, d.status AS notes,
                 COALESCE(c.customer_name,'') AS customer_name,
                 c.id AS customer_id,
                 d.created_at,
                 u.username AS created_by_name
            FROM sal_deliveries d
            LEFT JOIN sal_customers c ON c.id = d.customer_id AND c.company_id = d.company_id
            LEFT JOIN adm_users u ON u.id = d.created_by
           WHERE d.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          UNION ALL
          SELECT 'RETURN' AS stage, r.return_no AS ref_no, r.return_date AS txn_date, COALESCE(r.total_amount, 0) AS amount, r.status AS notes,
                 COALESCE(c.customer_name,'') AS customer_name,
                 c.id AS customer_id,
                 r.created_at,
                 u.username AS created_by_name
            FROM sal_returns r
            LEFT JOIN sal_customers c ON c.id = r.customer_id AND c.company_id = r.company_id
            LEFT JOIN adm_users u ON u.id = r.created_by
           WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        ) t
        WHERE (:customerId IS NULL OR t.customer_id = :customerId)
          AND (:customer IS NULL OR t.customer_name LIKE :customerLike)
          AND (:from IS NULL OR t.txn_date >= :from)
          AND (:to IS NULL OR t.txn_date <= :to)
        ORDER BY t.txn_date DESC, t.created_at DESC
        `,
        {
          companyId,
          branchId, branchIdsStr,
          customerId,
          customer,
          from,
          to,
          customerLike: customer ? `%${customer}%` : null,
        },
      ).catch(() => []);

      // Calculate summary totals
      const summary = items.reduce(
        (acc, item) => {
          const stage = item.stage?.toUpperCase();
          const amount = Number(item.amount || 0);
          if (stage === "RETURN") {
            acc.totalReturns += amount;
          } else if (stage === "INVOICE") {
            acc.totalSales += amount;
          }
          return acc;
        },
        { totalSales: 0, totalReturns: 0 },
      );
      summary.netAmount = summary.totalSales - summary.totalReturns;

      res.json({
        items: items || [],
        summary,
        count: items?.length || 0,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/cancelled-orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `
        SELECT o.order_no,
               COALESCE(c.customer_name,'') AS customer,
               o.order_date AS date,
               o.cancel_reason AS cancellation_reason,
               u.username AS cancelled_by,
          o.created_at,
          u.username AS created_by_name
         FROM sal_orders o
        LEFT JOIN sal_customers c ON c.id = o.customer_id AND c.company_id = o.company_id
        LEFT JOIN adm_users u ON u.id = o.updated_by
        LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE o.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND UPPER(o.status) IN ('CANCELLED','REJECTED')
        ORDER BY o.order_date DESC, o.id DESC
        `,
        { companyId, branchId, branchIdsStr },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/return-reasons",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const companyId = req.scope.companyId;
      const items = await query(
        `SELECT id, reason_code, reason_name, is_active FROM sal_return_reasons WHERE company_id = :companyId ORDER BY id ASC`,
        { companyId },
      );
      res.json({ items: items || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/return-reasons",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const companyId = req.scope.companyId;
      const { reasons } = req.body;
      if (!Array.isArray(reasons)) {
        return res.status(400).json({ message: "reasons must be an array" });
      }
      for (const r of reasons) {
        if (!r.reason_code || !r.reason_name) continue;
        if (r.id && /^\d+$/.test(String(r.id))) {
          await query(
            `UPDATE sal_return_reasons 
                SET reason_code = :reason_code, reason_name = :reason_name, is_active = :is_active 
              WHERE id = :id AND company_id = :companyId`,
            {
              id: Number(r.id),
              company_id: companyId,
              reason_code: r.reason_code,
              reason_name: r.reason_name,
              is_active: r.is_active ? 1 : 0,
            },
          );
        } else {
          await query(
            `INSERT INTO sal_return_reasons (company_id, reason_code, reason_name, is_active) 
             VALUES (:companyId, :reason_code, :reason_name, 1)
             ON DUPLICATE KEY UPDATE reason_name = :reason_name, is_active = 1`,
            {
              companyId,
              reason_code: r.reason_code,
              reason_name: r.reason_name,
            },
          );
        }
      }
      res.json({ message: "Return reasons saved successfully" });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/return-reasons/:id",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const companyId = req.scope.companyId;
      const id = Number(req.params.id);
      await query(
        `DELETE FROM sal_return_reasons WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      res.json({ message: "Reason deleted successfully" });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/zones",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const companyId = req.scope.companyId;
      const items = await query(
        `SELECT id, zone_name, description, is_active FROM sal_zones WHERE company_id = :companyId ORDER BY zone_name ASC`,
        { companyId },
      );
      res.json({ items: items || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/zones",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const companyId = req.scope.companyId;
      const { zones } = req.body;
      if (!Array.isArray(zones)) {
        return res.status(400).json({ message: "zones must be an array" });
      }
      for (const z of zones) {
        if (!z.zone_name) continue;
        if (z.id && /^\d+$/.test(String(z.id))) {
          await query(
            `UPDATE sal_zones
                SET zone_name = :zone_name, description = :description, is_active = :is_active
              WHERE id = :id AND company_id = :companyId`,
            {
              id: Number(z.id),
              company_id: companyId,
              zone_name: z.zone_name,
              description: z.description || null,
              is_active: z.is_active ? 1 : 0,
            },
          );
        } else {
          await query(
            `INSERT INTO sal_zones (company_id, zone_name, description, is_active)
             VALUES (:companyId, :zone_name, :description, 1)
             ON DUPLICATE KEY UPDATE description = :description, is_active = 1`,
            {
              companyId,
              zone_name: z.zone_name,
              description: z.description || null,
            },
          );
        }
      }
      res.json({ message: "Zones saved successfully" });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/zones/:id",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const companyId = req.scope.companyId;
      const id = Number(req.params.id);
      await query(
        `DELETE FROM sal_zones WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      res.json({ message: "Zone deleted successfully" });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/returns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  cacheListResponse(30),
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const items = await query(
        `
        SELECT r.id, r.return_no, r.return_date, r.total_amount,
               CASE WHEN iw.has_inactive_pending = 1 THEN 'APPROVED' ELSE r.status END AS status,
               COALESCE(c.customer_name, '') AS customer_name,
               r.invoice_id,
               fu.username AS forwarded_to_username,
          r.created_at,
          cu.username AS created_by_name
         FROM sal_returns r
        LEFT JOIN sal_customers c
          ON c.id = r.customer_id AND c.company_id = r.company_id
        LEFT JOIN (
          SELECT t.document_id, t.assigned_to_user_id
          FROM adm_document_workflows t
          JOIN adm_workflows w ON w.id = t.workflow_id AND w.is_active = 1
          JOIN (
            SELECT document_id, MAX(id) AS max_id
            FROM adm_document_workflows
            WHERE status = 'PENDING'
              AND (document_type = 'SALES_RETURN' OR document_type = 'Sales Return')
            GROUP BY document_id
          ) m ON m.max_id = t.id
        ) x ON x.document_id = r.id
        LEFT JOIN (
          SELECT t.document_id, 1 AS has_inactive_pending
          FROM adm_document_workflows t
          JOIN adm_workflows w ON w.id = t.workflow_id AND w.is_active = 0
          WHERE t.company_id = :companyId
            AND t.status = 'PENDING'
            AND (t.document_type = 'SALES_RETURN' OR t.document_type = 'Sales Return')
          GROUP BY t.document_id
        ) iw ON iw.document_id = r.id
        LEFT JOIN adm_users fu ON fu.id = x.assigned_to_user_id
        LEFT JOIN adm_users cu ON cu.id = r.created_by
        WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        ORDER BY r.id DESC
        `,
        { companyId, branchId, branchIdsStr },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/returns/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const nextNo = await nextSalesReturnNo(companyId, branchId);
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/returns/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }
      const hdrRows = await query(
        `
        SELECT r.*,
               COALESCE(c.customer_name, '') AS customer_name
          FROM sal_returns r
          LEFT JOIN sal_customers c
            ON c.id = r.customer_id AND c.company_id = r.company_id
         WHERE r.id = :id AND r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         LIMIT 1
        `,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      const hdr = hdrRows?.[0];
      if (!hdr) throw httpError(404, "NOT_FOUND", "Sales return not found");
      const details = await query(
        `
        SELECT d.id,
               d.return_id,
               d.item_id,
               d.qty_returned,
               d.unit_price,
               d.total_amount,
               d.tax_amount,
               d.reason_code,
               d.remarks,
               COALESCE(i.item_code, '') AS item_code,
               COALESCE(i.item_name, '') AS item_name,
               COALESCE(i.uom, '') AS uom
          FROM sal_return_details d
          LEFT JOIN inv_items i
            ON i.id = d.item_id AND i.company_id = :companyId
         WHERE d.return_id = :id
         ORDER BY d.id
        `,
        { id, companyId },
      ).catch(() => []);
      res.json({ item: hdr, details: Array.isArray(details) ? details : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/returns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureSalesReturnTables();
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const body = req.body || {};
      const return_no =
        String(body.return_no || "").trim() ||
        (await nextSalesReturnNo(companyId, branchId));
      const return_date = body.return_date
        ? String(body.return_date).slice(0, 10)
        : toYmd(new Date());
      const invoice_id =
        body.invoice_id == null ? null : Number(body.invoice_id || 0) || null;
      const customer_id =
        body.customer_id == null ? null : Number(body.customer_id || 0) || null;
      const warehouse_id =
        body.warehouse_id == null
          ? null
          : Number(body.warehouse_id || 0) || null;
      const return_type = String(body.return_type || "DAMAGED")
        .trim()
        .toUpperCase();
      const remarks = body.remarks || null;
      const status = String(body.status || "DRAFT")
        .trim()
        .toUpperCase();
      const items = Array.isArray(body.items) ? body.items : [];
      if (!return_date || !items.length) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      let sub_total = 0;
      let tax_total = 0;
      const ids = Array.from(
        new Set(
          (items || [])
            .map((x) => Number(x?.item_id || x?.itemId || 0))
            .filter((n) => Number.isFinite(n) && n > 0),
        ),
      );
      let rateMap = new Map();
      if (ids.length) {
        const placeholders = ids.map((_, i) => `:i${i}`).join(", ");
        const params = { companyId };
        ids.forEach((v, i) => (params[`i${i}`] = v));
        const rows = await query(
          `
          SELECT it.id AS item_id,
                 it.vat_on_sales_id AS tax_id,
                 COALESCE(tc.rate_percent, 0) AS rate_percent,
          it.created_at,
          u.username AS created_by_name
         FROM inv_items it
          LEFT JOIN fin_tax_codes tc
            ON tc.company_id = it.company_id
           AND tc.id = it.vat_on_sales_id
        LEFT JOIN adm_users u ON u.id = it.created_by
         WHERE it.company_id = :companyId
            AND it.id IN (${placeholders})
          `,
          params,
        ).catch(() => []);
        for (const r of rows || []) {
          rateMap.set(Number(r.item_id), Number(r.rate_percent || 0));
        }
      }
      const normalized = [];
      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.qty_returned || it?.quantity || 0);
        const unit_price = Number(it?.unit_price || 0);
        const reason_code = String(it?.reason_code || "").trim() || null;
        const lineRemarks = it?.remarks || null;
        if (!Number.isFinite(item_id) || qty <= 0) continue;
        const line_total = Math.round(qty * unit_price * 100) / 100;
        const rate = Number(rateMap.get(item_id) || 0);
        const line_tax =
          Math.round(((qty * unit_price * rate) / 100) * 100) / 100;
        sub_total += line_total;
        tax_total += line_tax;
        normalized.push({
          item_id,
          qty,
          unit_price,
          total_amount: line_total,
          tax_amount: line_tax,
          reason_code,
          remarks: lineRemarks,
        });
      }
      const total_amount = Math.round((sub_total + tax_total) * 100) / 100;
      const created_by = req.user?.sub || null;
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO sal_returns
          (company_id, branch_id, return_no, return_date, invoice_id, customer_id, warehouse_id, return_type, status, remarks, total_amount, tax_amount, sub_total, created_by)
        VALUES
          (:companyId, :branchId, :return_no, :return_date, :invoice_id, :customer_id, :warehouse_id, :return_type, :status, :remarks, :total_amount, :tax_amount, :sub_total, :created_by)
        `,
        {
          companyId,
          branchId, branchIdsStr,
          return_no,
          return_date,
          invoice_id,
          customer_id,
          warehouse_id,
          return_type,
          status,
          remarks,
          total_amount,
          tax_amount: tax_total,
          sub_total,
          created_by,
        },
      );
      const return_id = Number(hdr?.insertId || 0) || 0;
      for (const ln of normalized) {
        await conn.execute(
          `
          INSERT INTO sal_return_details
            (return_id, item_id, qty_returned, unit_price, total_amount, tax_amount, reason_code, remarks)
          VALUES
            (:return_id, :item_id, :qty_returned, :unit_price, :total_amount, :tax_amount, :reason_code, :remarks)
          `,
          {
            return_id,
            item_id: ln.item_id,
            qty_returned: ln.qty,
            unit_price: ln.unit_price,
            total_amount: ln.total_amount,
            tax_amount: ln.tax_amount,
            reason_code: ln.reason_code,
            remarks: ln.remarks,
          },
        );
        await conn.execute(
          `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
           VALUES (:companyId, :branchId, :warehouse_id, :item_id, :qty)
           ON DUPLICATE KEY UPDATE qty = qty + :qty`,
          {
            companyId,
            branchId, branchIdsStr,
            warehouse_id,
            item_id: ln.item_id,
            qty: ln.qty,
          },
        );
      }

      let voucherId = null;
      let voucherNo = null;
      const [wfRows] = await conn.execute(
        `SELECT id FROM adm_workflows
         WHERE company_id = :companyId
           AND (document_type = 'SALES_RETURN' OR document_type = 'Sales Return')
           AND is_active = 1
         LIMIT 1`,
        { companyId },
      );
      const hasActiveWf = wfRows?.length > 0;
      const shouldCreateCreditNote = !hasActiveWf || status === "APPROVED";
      if (shouldCreateCreditNote) {
        voucherId = await createSalesReturnCreditNoteTx(conn, {
          companyId,
          branchId, branchIdsStr,
          return_no,
          return_date,
          customer_id,
          normalized,
          total_amount,
          tax_total,
          created_by,
          invoice_id,
        });
        if (voucherId) {
          const [vRow] = await conn.execute(
            `SELECT voucher_no FROM fin_vouchers WHERE id = :id`,
            { id: voucherId },
          );
          voucherNo = vRow?.[0]?.voucher_no || null;
        }
      }
      await conn.commit();
      res.status(201).json({
        id: return_id,
        return_no,
        total_amount,
        voucher_id: voucherId,
        voucher_no: voucherNo,
      });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/returns/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const amount = req.body?.amount ?? null;
      const workflowIdOverride = Number(req.body?.workflow_id || 0) || null;
      const docRouteBase = "/inventory/sales-returns";

      const { activeWorkflow: activeWf } = await resolveWorkflowSelection({
        companyId,
        workflowIdOverride,
        docRouteBase,
        typeSynonyms: ["SALES_RETURN", "Sales Return"],
        amount,
      });
      if (!activeWf) {
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          await conn.execute(
            `UPDATE sal_returns SET status = 'APPROVED' WHERE id = :id`,
            { id },
          );
          await createCreditNoteForReturnApprovalTx(conn, {
            id,
            companyId,
            branchId, branchIdsStr,
          });
          await conn.commit();
        } catch (e) {
          await conn.rollback().catch(() => {});
          throw e;
        } finally {
          conn.release();
        }
        return res.json({ status: "APPROVED" });
      }

      const steps = await query(
        `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          await conn.execute(
            `UPDATE sal_returns SET status = 'APPROVED' WHERE id = :id`,
            { id },
          );
          await createCreditNoteForReturnApprovalTx(conn, {
            id,
            companyId,
            branchId, branchIdsStr,
          });
          await conn.commit();
        } catch (e) {
          await conn.rollback().catch(() => {});
          throw e;
        } finally {
          conn.release();
        }
        return res.json({ status: "APPROVED" });
      }
      const first = steps[0];
      if (!first.approver_user_id) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Workflow step 1 has no approver_user_id configured",
        );
      }
      const allowedUsers = await query(
        `SELECT approver_user_id,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_step_approvers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf AND step_order = :ord`,
        { wf: activeWf.id, ord: first.step_order },
      );
      const allowedSet = new Set(
        allowedUsers.map((r) => Number(r.approver_user_id)),
      );
      const targetUserIdRaw = req.body?.target_user_id;
      let assignedToUserId = Number(first.approver_user_id);
      if (targetUserIdRaw != null && allowedSet.has(Number(targetUserIdRaw))) {
        assignedToUserId = Number(targetUserIdRaw);
      } else if (allowedUsers.length > 0) {
        assignedToUserId = Number(allowedUsers[0].approver_user_id);
      }
      const dwRes = await query(
        `
          INSERT INTO adm_document_workflows
            (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
          VALUES
            (:companyId, :workflowId, :documentId, 'SALES_RETURN', :amount, :stepOrder, 'PENDING', :assignedTo)
          `,
        {
          companyId,
          workflowId: activeWf.id,
          documentId: id,
          amount: amount === null ? null : Number(amount),
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      const instanceId = dwRes.insertId;
      await query(
        `
          INSERT INTO adm_workflow_tasks
            (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
          VALUES
            (:companyId, :workflowId, :dwId, :documentId, 'SALES_RETURN', :stepOrder, :assignedTo, 'PENDING')
          `,
        {
          companyId,
          workflowId: activeWf.id,
          dwId: instanceId,
          documentId: id,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      await query(
        `
          INSERT INTO adm_workflow_logs
            (document_workflow_id, step_order, action, actor_user_id, comments)
          VALUES
            (:dwId, :stepOrder, 'SUBMIT', :actor, :comments)
          `,
        {
          dwId: instanceId,
          stepOrder: first.step_order,
          actor: req.user.sub,
          comments: req.body?.comments || "",
        },
      );
      await query(
        `UPDATE sal_returns SET status = 'PENDING' WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      const emailRes = await query(
        "SELECT email FROM adm_users WHERE id = :id",
        { id: assignedToUserId },
      );
      if (emailRes.length && emailRes[0].email) {
        const to = emailRes[0].email;
        const subject = "Approval Required";
        const text = `Sales Return #${id} requires your approval. View: ${req.protocol}://${req.headers.host}/administration/workflows/approvals/${instanceId}`;
        const html = `<p>Sales Return #${id} requires your approval.</p><p><a href="/administration/workflows/approvals/${instanceId}">Open Approval</a></p>`;
        if (isMailerConfigured()) {
          try {
            await sendMail({ to, subject, text, html });
          } catch (e) {
            console.log(`[EMAIL ERROR] ${e?.message || e}`);
          }
        } else {
          console.log(
            `[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${text}`,
          );
        }
      }
      res.status(201).json({ instanceId, status: "PENDING" });
    } catch (e) {
      next(e);
    }
  },
);

// ========== PROSPECTIVE CUSTOMERS ENDPOINTS ==========

// GET /prospect-customers - List all prospective customers
router.get(
  "/prospect-customers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      await ensureProspectiveCustomersTable();
      const companyId = req.scope.companyId;
      const activeParam = String(req.query.active || "")
        .trim()
        .toLowerCase();
      // If active=false is explicitly requested, show all. Otherwise show only active.
      const onlyActive =
        activeParam === "true" || activeParam === "1" || activeParam === "";
      const params = { companyId };
      const where = ["c.company_id = :companyId"];
      if (onlyActive) where.push("c.is_active = 1");
      const items = await query(
        `SELECT 
           c.id,
           c.company_id,
           c.branch_id,
           c.customer_code,
           c.customer_name,
           c.customer_type,
           c.price_type_id,
           pt.name AS price_type_name,
           c.contact_person,
           c.email,
           c.phone,
           c.mobile,
           c.credit_limit,
           c.is_active,
           c.address,
           c.city,
           c.state,
           c.zone,
           c.country,
           c.payment_terms,
           c.currency_id,
          c.created_at,
          u.username AS created_by_name
         FROM sal_prospect_customers c
         LEFT JOIN sal_price_types pt
           ON pt.id = c.price_type_id AND pt.company_id = c.company_id
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE ${where.join(" AND ")}
         ORDER BY c.customer_name ASC`,
        params,
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

// GET /prospect-customers/next-code - Get next customer code (MUST be before /:id)
router.get(
  "/prospect-customers/next-code",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      await ensureProspectiveCustomersTable();
      const companyId = req.scope.companyId;
      const rows = await query(
        `SELECT customer_code,
          created_at,
          u.username AS created_by_name
         FROM sal_prospect_customers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND customer_code REGEXP '^PC(-?[0-9]+)?$'
         ORDER BY id DESC
         LIMIT 1`,
        { companyId },
      ).catch(() => []);
      let nextNum = 1;
      if (rows.length) {
        const prev = String(rows[0].customer_code || "");
        const match = prev.match(/\d+$/);
        if (match) {
          nextNum = parseInt(match[0], 10) + 1;
        }
      }
      const code = `PC-${String(nextNum).padStart(6, "0")}`;
      res.json({ code });
    } catch (e) {
      next(e);
    }
  },
);

// GET /prospect-customers/:id - Get single prospective customer
router.get(
  "/prospect-customers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      await ensureProspectiveCustomersTable();
      const companyId = req.scope.companyId;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }
      const items = await query(
        `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM sal_prospect_customers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id, companyId },
      ).catch(() => []);
      if (!items.length) {
        throw httpError(404, "NOT_FOUND", "Prospective customer not found");
      }
      res.json({ item: items[0] });
    } catch (e) {
      next(e);
    }
  },
);

// POST /prospect-customers - Create prospective customer
router.post(
  "/prospect-customers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.CREATE"),
  async (req, res, next) => {
    try {
      await ensureProspectiveCustomersTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const {
        customer_code,
        customer_name,
        email,
        phone,
        is_active,
        address,
        city,
        state,
        zone,
        country,
        price_type_id,
        currency_id,
        contact_person,
        customer_type,
        mobile,
        credit_limit,
        payment_terms,
      } = req.body || {};

      if (!customer_name) {
        throw httpError(400, "VALIDATION_ERROR", "customer_name is required");
      }

      const result = await query(
        `INSERT INTO sal_prospect_customers 
         (company_id, branch_id, customer_code, customer_name, prospect_customer, email, phone, is_active, 
          address, city, state, zone, country, price_type_id, currency_id, contact_person, 
          customer_type, mobile, credit_limit, payment_terms)
         VALUES (:companyId, :branchId, :customer_code, :customer_name, :prospect_customer, :email, :phone, 
                 :is_active, :address, :city, :state, :zone, :country, :price_type_id,
                 :currency_id, :contact_person, :customer_type, :mobile, :credit_limit, :payment_terms)`,
        {
          companyId,
          branchId, branchIdsStr,
          customer_code: customer_code || null,
          customer_name,
          prospect_customer: customer_name,
          email: email || null,
          phone: phone || null,
          is_active: is_active ? 1 : 0,
          address: address || null,
          city: city || null,
          state: state || null,
          zone: zone || null,
          country: country || null,
          price_type_id: price_type_id || null,
          currency_id: currency_id || null,
          contact_person: contact_person || null,
          customer_type: customer_type || null,
          mobile: mobile || null,
          credit_limit: credit_limit || 0,
          payment_terms: payment_terms || null,
        },
      );

      res.status(201).json({
        id: result.insertId,
        item: { id: result.insertId, ...req.body },
      });
    } catch (e) {
      next(e);
    }
  },
);

// PUT /prospect-customers/:id - Update prospective customer
router.put(
  "/prospect-customers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.UPDATE"),
  async (req, res, next) => {
    try {
      await ensureProspectiveCustomersTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }

      const {
        customer_code,
        customer_name,
        email,
        phone,
        is_active,
        address,
        city,
        state,
        zone,
        country,
        price_type_id,
        currency_id,
        contact_person,
        customer_type,
        mobile,
        credit_limit,
        payment_terms,
      } = req.body || {};

      if (!customer_name) {
        throw httpError(400, "VALIDATION_ERROR", "customer_name is required");
      }

      await query(
        `UPDATE sal_prospect_customers 
         SET customer_code = :customer_code, 
             customer_name = :customer_name, 
             prospect_customer = :prospect_customer,
             email = :email, 
             phone = :phone, 
             is_active = :is_active, 
             address = :address, 
             city = :city, 
             state = :state, 
             zone = :zone, 
             country = :country, 
             price_type_id = :price_type_id, 
             currency_id = :currency_id, 
             contact_person = :contact_person, 
             customer_type = :customer_type, 
             mobile = :mobile, 
             credit_limit = :credit_limit, 
             payment_terms = :payment_terms
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        {
          id,
          companyId,
          branchId, branchIdsStr,
          customer_code: customer_code || null,
          customer_name,
          prospect_customer: customer_name,
          email: email || null,
          phone: phone || null,
          is_active: is_active ? 1 : 0,
          address: address || null,
          city: city || null,
          state: state || null,
          zone: zone || null,
          country: country || null,
          price_type_id: price_type_id || null,
          currency_id: currency_id || null,
          contact_person: contact_person || null,
          customer_type: customer_type || null,
          mobile: mobile || null,
          credit_limit: credit_limit || 0,
          payment_terms: payment_terms || null,
        },
      );

      res.json({ id, item: { id, ...req.body } });
    } catch (e) {
      next(e);
    }
  },
);

// DELETE /prospect-customers/:id - Delete prospective customer
router.delete(
  "/prospect-customers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.DELETE"),
  async (req, res, next) => {
    try {
      await ensureProspectiveCustomersTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }

      await query(
        `DELETE FROM sal_prospect_customers WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        { id, companyId, branchId, branchIdsStr },
      );

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/prices/standard",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const rows = await query(
        `SELECT sp.*, i.item_code, i.item_name,
                pt.id AS price_type_lookup_id,
                pt.name AS price_type_name,
          sp.created_at,
          u.username AS created_by_name
         FROM sal_standard_prices sp
         JOIN inv_items i ON i.id = sp.product_id AND i.company_id = sp.company_id
         LEFT JOIN sal_price_types pt
           ON pt.id = sp.price_type_id AND pt.company_id = sp.company_id
        LEFT JOIN adm_users u ON u.id = sp.created_by
         WHERE sp.company_id = :companyId
         ORDER BY i.item_name ASC, pt.name ASC, sp.effective_date DESC, sp.id DESC`,
        { companyId },
      );
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

export { createSalesReturnCreditNoteTx, createCreditNoteForReturnApprovalTx };

