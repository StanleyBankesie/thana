// Database Dependencies
import { query } from "../db/pool.js";
import { getAllFeatures } from "../data/featuresRegistry.js";

// Utility function to safely convert variables to numbers
/**
 * Convert a value to a number.
 * @param {*} v - The value to convert.
 * @param {*} fallback - The fallback value if conversion fails.
 * @returns {number|*} The numeric value or the fallback.
 */
export function toNumber(v, fallback = null) {
  const n = Number(v);
  // Return the number if valid, otherwise fallback
  return Number.isFinite(n) ? n : fallback;
}

// Memory Caches for Database Metadata
const columnCache = new Map();

/**
 * Check if a table exists in the database.
 * @param {string} tableName - The name of the table.
 * @returns {Promise<boolean>} True if table exists.
 */
export async function hasTable(tableName) {
  const rows = await query("SHOW TABLES LIKE :tableName", { tableName });
  return rows.length > 0;
}

/**
 * Check if a column exists in a table.
 * @param {string} tableName - The name of the table.
 * @param {string} columnName - The name of the column.
 * @returns {Promise<boolean>} True if column exists.
 */
export async function hasColumn(tableName, columnName) {
  const key = `${tableName}.${columnName}`;
  const cached = columnCache.get(key);
  if (cached !== undefined) return cached;
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
  const result = Number(rows?.[0]?.c || 0) > 0;
  columnCache.set(key, result);
  return result;
}

/**
 * Ensure a column exists in a table. If it doesn't, add it using the DDL provided.
 * @param {string} tableName - The name of the table.
 * @param {string} columnName - The name of the column.
 * @param {string} ddlRef - The SQL DDL to add the column.
 * @returns {Promise<boolean>} True if successful or column already exists.
 */
export async function ensureCol(tableName, columnName, ddlRef) {
  // Check if column already exists
  const has = await hasColumn(tableName, columnName);
  if (!has) {
    try {
      // Execute the ALTER TABLE query to add the column
      await query(
        `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${ddlRef}`,
        {},
      );
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Ensure the adm_system_logs table and its expected columns exist.
 * @returns {Promise<void>}
 */
export async function ensureSystemLogsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_system_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NULL,
      branch_id BIGINT UNSIGNED NULL,
      user_id BIGINT UNSIGNED NULL,
      module_name VARCHAR(100) NULL,
      action VARCHAR(100) NULL,
      ref_no VARCHAR(100) NULL,
      message VARCHAR(255) NULL,
      url_path VARCHAR(255) NULL,
      event_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sys_logs_time (event_time),
      KEY idx_sys_logs_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  try {
    const cols = [
      {
        name: "module_name",
        ddl: "ALTER TABLE adm_system_logs ADD COLUMN module_name VARCHAR(100) NULL AFTER user_id",
      },
      {
        name: "action",
        ddl: "ALTER TABLE adm_system_logs ADD COLUMN action VARCHAR(100) NULL AFTER module_name",
      },
      {
        name: "ref_no",
        ddl: "ALTER TABLE adm_system_logs ADD COLUMN ref_no VARCHAR(100) NULL AFTER action",
      },
      {
        name: "message",
        ddl: "ALTER TABLE adm_system_logs ADD COLUMN message VARCHAR(255) NULL AFTER ref_no",
      },
      {
        name: "url_path",
        ddl: "ALTER TABLE adm_system_logs ADD COLUMN url_path VARCHAR(255) NULL AFTER message",
      },
      {
        name: "event_time",
        ddl: "ALTER TABLE adm_system_logs ADD COLUMN event_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER url_path",
      },
    ];
    for (const c of cols) {
      // eslint-disable-next-line no-await-in-loop
      const has = await hasColumn("adm_system_logs", c.name);
      // eslint-disable-next-line no-await-in-loop
      if (!has) await query(c.ddl);
    }
    const hasCreatedAt = await hasColumn("adm_system_logs", "created_at");
    if (!hasCreatedAt) {
      await query(
        "ALTER TABLE adm_system_logs ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER event_time",
      );
      await query(
        "UPDATE adm_system_logs SET created_at = event_time WHERE created_at IS NULL",
      );
    }
    // Setup scheduled event to automatically prune old logs
    // Create event to auto-delete logs older than 7 days
    try {
      // Enable event scheduler globally
      await query("SET GLOBAL event_scheduler = ON");
      await query(`
        CREATE EVENT IF NOT EXISTS cleanup_adm_system_logs
        ON SCHEDULE EVERY 1 DAY
        STARTS CURRENT_DATE + INTERVAL 1 DAY
        DO
          DELETE FROM adm_system_logs WHERE created_at < NOW() - INTERVAL 7 DAY
      `);
    } catch {}
  } catch {}
}

// Track tables that have already been verified to avoid redundant checks
// Exported so other modules can share this singleton cache and skip DDL queries
export const verifiedTables = new Set();

/**
 * Ensure the adm_branches table has all expected columns.
 * @returns {Promise<void>}
 */
export async function ensureBranchColumns() {
  const table = "adm_branches";
  if (verifiedTables.has(table)) return;
  if (!(await hasColumn(table, "address"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN address VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "city"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN city VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "state"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN state VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "postal_code"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN postal_code VARCHAR(20) NULL`);
  }
  if (!(await hasColumn(table, "country"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN country VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "location"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN location VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "telephone"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN telephone VARCHAR(50) NULL`);
  }
  if (!(await hasColumn(table, "email"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN email VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "remarks"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN remarks TEXT NULL`);
  }
  if (!(await hasColumn(table, "is_superbranch"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN is_superbranch TINYINT(1) DEFAULT 0`);
  }
  if (!(await hasColumn(table, "parent_branch_id"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN parent_branch_id BIGINT UNSIGNED NULL`);
  }
  verifiedTables.add(table);
}

/**
 * Ensure the adm_users table has all expected columns.
 * @returns {Promise<void>}
 */
export async function ensureUserColumns() {
  const table = "adm_users";
  if (verifiedTables.has(table)) return;
  if (!(await hasColumn(table, "profile_picture"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN profile_picture LONGBLOB NULL`,
    );
  }
  if (!(await hasColumn(table, "full_name"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN full_name VARCHAR(150) NULL`);
  }
  if (!(await hasColumn(table, "is_employee"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN is_employee TINYINT(1) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(table, "user_type"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN user_type VARCHAR(50) DEFAULT 'Internal'`,
    );
  }
  if (!(await hasColumn(table, "valid_from"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN valid_from DATETIME NULL`);
  }
  if (!(await hasColumn(table, "telephone"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN telephone VARCHAR(20) NULL`);
  }
  if (!(await hasColumn(table, "valid_to"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN valid_to DATETIME NULL`);
  }
  if (!(await hasColumn(table, "role_id"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN role_id BIGINT UNSIGNED NULL`);
  }
  if (!(await hasColumn(table, "branch_id"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN branch_id BIGINT UNSIGNED NULL`,
    );
  }
  if (!(await hasColumn(table, "is_active"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN is_active TINYINT(1) DEFAULT 1`,
    );
  }
  if (!(await hasColumn(table, "created_at"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
    );
  }
  verifiedTables.add(table);
}

/**
 * Ensure the adm_pages table exists and is properly structured with feature keys.
 * @returns {Promise<void>}
 */
export async function ensurePagesTable() {
  const table = "adm_pages";
  if (verifiedTables.has(table)) return;
  if (pendingEnsures.has(table)) return pendingEnsures.get(table);
  const promise = (async () => {
    try {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_pages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      module VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(100) NOT NULL UNIQUE,
      path VARCHAR(255) NULL,
      feature_key VARCHAR(150) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_module (module)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Backwards-compatible: add feature_key column if missing
  if (!(await hasColumn("adm_pages", "feature_key"))) {
    await query(
      `ALTER TABLE adm_pages ADD COLUMN feature_key VARCHAR(150) NULL AFTER path`,
    );
  }

  // Backfill feature_key for existing rows based on path
  const allFeatures = getAllFeatures();
  const pagesNeedingFk = await query(
    `SELECT id, path FROM adm_pages WHERE feature_key IS NULL OR feature_key = ''`,
    {},
  );
  for (const row of pagesNeedingFk) {
    const rawPath = String(row.path || "").trim();
    if (!rawPath) continue;
    let bestFeatureKey = null;
    let bestLen = -1;
    for (const f of allFeatures) {
      const fp = String(f.path || "").trim();
      if (!fp) continue;
      if (rawPath === fp || rawPath.startsWith(fp + "/")) {
        if (fp.length > bestLen) {
          bestLen = fp.length;
          bestFeatureKey = String(f.feature_key || "").trim();
        }
      }
    }
    if (bestFeatureKey) {
      await query(
        `UPDATE adm_pages SET feature_key = :feature_key WHERE id = :id`,
        { feature_key: bestFeatureKey, id: row.id },
      );
    }
  }

  const pagesStillNeedingFk = await query(
    `SELECT id, path FROM adm_pages WHERE feature_key IS NULL OR feature_key = ''`,
    {},
  );
  for (const row of pagesStillNeedingFk) {
    const rawPath = String(row.path || "").trim();
    if (!rawPath) continue;
    const segs = rawPath.split("/").filter(Boolean);
    if (segs.length < 2) continue;
    const feature_key = `${segs[0]}:${segs[1]}`;
    await query(
      `UPDATE adm_pages SET feature_key = :feature_key WHERE id = :id`,
      {
        feature_key,
        id: row.id,
      },
    );
  }
    verifiedTables.add(table);
    } finally {
      pendingEnsures.delete(table);
    }
  })();
  pendingEnsures.set(table, promise);
  return promise;
}

/**
 * Seed the adm_pages table with the default system pages.
 * @returns {Promise<void>}
 */
export async function ensurePagesSeed() {
  const pages = [
    { module: "Administration", name: "Roles", path: "/administration/roles" },
    {
      module: "Administration",
      name: "Role List",
      path: "/administration/roles",
    },
    {
      module: "Administration",
      name: "Role Form",
      path: "/administration/roles/new",
    },
    {
      module: "Administration",
      name: "Role Edit",
      path: "/administration/roles/:id",
    },
    { module: "Administration", name: "Users", path: "/administration/users" },
    {
      module: "Administration",
      name: "User List",
      path: "/administration/users",
    },
    {
      module: "Administration",
      name: "User Form",
      path: "/administration/users/new",
    },
    {
      module: "Administration",
      name: "User Edit",
      path: "/administration/users/:id",
    },
    {
      module: "Administration",
      name: "User Management",
      path: "/administration/users",
    },
    {
      module: "Administration",
      name: "Workflows",
      path: "/administration/workflows",
    },
    {
      module: "Administration",
      name: "Workflow List",
      path: "/administration/workflows",
    },
    {
      module: "Administration",
      name: "Workflow Form",
      path: "/administration/workflows/new",
    },
    {
      module: "Administration",
      name: "Workflow Edit",
      path: "/administration/workflows/:id",
    },
    {
      module: "Administration",
      name: "Workflow Approvals",
      path: "/administration/workflows/approvals",
    },
    {
      module: "Administration",
      name: "Document Review",
      path: "/administration/workflows/approvals/:instanceId",
    },
    {
      module: "Administration",
      name: "Branches",
      path: "/administration/branches",
    },
    {
      module: "Administration",
      name: "Branch List",
      path: "/administration/branches",
    },
    {
      module: "Administration",
      name: "Branch Form",
      path: "/administration/branches/new",
    },
    {
      module: "Administration",
      name: "Branch Edit",
      path: "/administration/branches/:id",
    },
    {
      module: "Administration",
      name: "Companies",
      path: "/administration/companies",
    },
    {
      module: "Administration",
      name: "Company List",
      path: "/administration/companies",
    },
    {
      module: "Administration",
      name: "Company Form",
      path: "/administration/companies/new",
    },
    {
      module: "Administration",
      name: "Company Edit",
      path: "/administration/companies/:id",
    },
    {
      module: "Administration",
      name: "Exceptional Permissions",
      path: "/administration/exceptional-permissions",
    },
    {
      module: "Administration",
      name: "Exceptional Permissions List",
      path: "/administration/exceptional-permissions",
    },
    {
      module: "Administration",
      name: "Exceptional Permission Form",
      path: "/administration/exceptional-permissions/new",
    },
    {
      module: "Administration",
      name: "Exceptional Permission Edit",
      path: "/administration/exceptional-permissions/:id",
    },
    {
      module: "Administration",
      name: "Reports",
      path: "/administration/reports",
    },
    {
      module: "Administration",
      name: "User Login Activity Report",
      path: "/administration/reports/user-login-activity",
    },
    {
      module: "Administration",
      name: "System Log Book Report",
      path: "/administration/reports/system-log-book",
    },
    {
      module: "Administration",
      name: "Permissions Dashboard",
      path: "/administration/permissions",
    },
    {
      module: "Administration",
      name: "User Permission Assignment",
      path: "/administration/user-permissions",
    },
    {
      module: "Administration",
      name: "Settings",
      path: "/administration/settings",
    },
    {
      module: "Administration",
      name: "Settings List",
      path: "/administration/settings",
    },
    {
      module: "Administration",
      name: "Settings Form",
      path: "/administration/settings/new",
    },
    {
      module: "Administration",
      name: "Settings Edit",
      path: "/administration/settings/:id",
    },
    { module: "Sales", name: "Quotations", path: "/sales/quotations" },
    { module: "Sales", name: "Quotation List", path: "/sales/quotations" },
    { module: "Sales", name: "Quotation Form", path: "/sales/quotations/new" },
    { module: "Sales", name: "Quotation Edit", path: "/sales/quotations/:id" },
    { module: "Sales", name: "Sales Orders", path: "/sales/sales-orders" },
    { module: "Sales", name: "Sales Order List", path: "/sales/sales-orders" },
    {
      module: "Sales",
      name: "Sales Order Form",
      path: "/sales/sales-orders/new",
    },
    {
      module: "Sales",
      name: "Sales Order Edit",
      path: "/sales/sales-orders/:id",
    },
    { module: "Sales", name: "Invoices", path: "/sales/invoices" },
    { module: "Sales", name: "Invoice List", path: "/sales/invoices" },
    { module: "Sales", name: "Invoice Form", path: "/sales/invoices/new" },
    { module: "Sales", name: "Invoice Edit", path: "/sales/invoices/:id" },
    { module: "Sales", name: "Delivery", path: "/sales/delivery" },
    { module: "Sales", name: "Delivery List", path: "/sales/delivery" },
    { module: "Sales", name: "Delivery Form", path: "/sales/delivery/new" },
    { module: "Sales", name: "Delivery Edit", path: "/sales/delivery/:id" },
    { module: "Sales", name: "Price Setup", path: "/sales/price-setup" },
    {
      module: "Sales",
      name: "Discount Schemes",
      path: "/sales/discount-schemes",
    },
    { module: "Sales", name: "Customers", path: "/sales/customers" },
    { module: "Sales", name: "Customer List", path: "/sales/customers" },
    { module: "Sales", name: "Customer Form", path: "/sales/customers/new" },
    { module: "Sales", name: "Customer Edit", path: "/sales/customers/:id" },
    {
      module: "Sales",
      name: "Customer Credit",
      path: "/sales/customer-credit",
    },
    {
      module: "Sales",
      name: "Bulk Customer Upload",
      path: "/sales/bulk-upload",
    },
    { module: "Sales", name: "Sales Reports", path: "/sales/reports" },
    { module: "Sales", name: "Sales Returns", path: "/sales/returns" },
    {
      module: "Inventory",
      name: "Material Requisitions",
      path: "/inventory/material-requisitions",
    },
    {
      module: "Inventory",
      name: "Material Requisition Edit",
      path: "/inventory/material-requisitions/:id",
    },
    {
      module: "Inventory",
      name: "Stock Updation",
      path: "/inventory/stock-updation",
    },
    {
      module: "Inventory",
      name: "Stock Updation Edit",
      path: "/inventory/stock-updation/:id",
    },
    {
      module: "Inventory",
      name: "Stock Verification",
      path: "/inventory/stock-verification",
    },
    {
      module: "Inventory",
      name: "Stock Verification Edit",
      path: "/inventory/stock-verification/:id",
    },
    {
      module: "Inventory",
      name: "Return To Stores",
      path: "/inventory/return-to-stores",
    },
    {
      module: "Inventory",
      name: "Return To Stores Form",
      path: "/inventory/return-to-stores/new",
    },
    {
      module: "Inventory",
      name: "Return To Stores Edit",
      path: "/inventory/return-to-stores/:id",
    },
    {
      module: "Inventory",
      name: "Stock Adjustments",
      path: "/inventory/stock-adjustments",
    },
    {
      module: "Inventory",
      name: "Stock Adjustment Form",
      path: "/inventory/stock-adjustments/new",
    },
    {
      module: "Inventory",
      name: "Stock Adjustment Edit",
      path: "/inventory/stock-adjustments/:id",
    },
    {
      module: "Inventory",
      name: "Issue To Requirement",
      path: "/inventory/issue-to-requirement",
    },
    {
      module: "Inventory",
      name: "Issue To Requirement Form",
      path: "/inventory/issue-to-requirement/new",
    },
    {
      module: "Inventory",
      name: "Issue To Requirement Edit",
      path: "/inventory/issue-to-requirement/:id",
    },
    {
      module: "Inventory",
      name: "Stock Transfers",
      path: "/inventory/stock-transfers",
    },
    {
      module: "Inventory",
      name: "Stock Transfer Edit",
      path: "/inventory/stock-transfers/:id",
    },
    {
      module: "Inventory",
      name: "Transfer Acceptance",
      path: "/inventory/transfer-acceptance",
    },
    {
      module: "Inventory",
      name: "Transfer Acceptance Edit",
      path: "/inventory/transfer-acceptance/:id",
    },
    {
      module: "Inventory",
      name: "Stock Reorder",
      path: "/inventory/stock-reorder",
    },
    { module: "Inventory", name: "Stock Take", path: "/inventory/stock-take" },
    {
      module: "Inventory",
      name: "Stock Take Edit",
      path: "/inventory/stock-take/:id",
    },
    { module: "Inventory", name: "GRN Local", path: "/inventory/grn-local" },
    {
      module: "Inventory",
      name: "GRN Local Edit",
      path: "/inventory/grn-local/:id",
    },
    { module: "Inventory", name: "GRN Import", path: "/inventory/grn-import" },
    {
      module: "Inventory",
      name: "GRN Import Edit",
      path: "/inventory/grn-import/:id",
    },
    {
      module: "Inventory",
      name: "Sales Returns",
      path: "/inventory/sales-returns",
    },
    { module: "Inventory", name: "Items", path: "/inventory/items" },
    { module: "Inventory", name: "Item Edit", path: "/inventory/items/:id" },
    {
      module: "Inventory",
      name: "Item Groups",
      path: "/inventory/item-groups",
    },
    {
      module: "Inventory",
      name: "Item Group Edit",
      path: "/inventory/item-groups/:id",
    },
    {
      module: "Inventory",
      name: "Unit Conversions",
      path: "/inventory/unit-conversions",
    },
    {
      module: "Inventory",
      name: "Unit Conversion Edit",
      path: "/inventory/unit-conversions/:id",
    },
    { module: "Inventory", name: "Warehouses", path: "/inventory/warehouses" },
    {
      module: "Inventory",
      name: "Warehouse Edit",
      path: "/inventory/warehouses/:id",
    },
    { module: "Inventory", name: "Reports", path: "/inventory/reports" },
    { module: "Purchase", name: "RFQs", path: "/purchase/rfqs" },
    { module: "Purchase", name: "RFQ Form", path: "/purchase/rfqs/new" },
    { module: "Purchase", name: "RFQ Edit", path: "/purchase/rfqs/:id" },
    {
      module: "Purchase",
      name: "RFQ Edit Form",
      path: "/purchase/rfqs/:id/edit",
    },
    {
      module: "Purchase",
      name: "Supplier Quotations",
      path: "/purchase/supplier-quotations",
    },
    {
      module: "Purchase",
      name: "Supplier Quotation Form",
      path: "/purchase/supplier-quotations/new",
    },
    {
      module: "Purchase",
      name: "Supplier Quotation Edit",
      path: "/purchase/supplier-quotations/:id",
    },
    {
      module: "Purchase",
      name: "Supplier Quotation Edit Form",
      path: "/purchase/supplier-quotations/:id/edit",
    },
    {
      module: "Purchase",
      name: "Quotation Analysis",
      path: "/purchase/quotation-analysis",
    },
    {
      module: "Purchase",
      name: "Purchase Orders Local",
      path: "/purchase/purchase-orders-local",
    },
    {
      module: "Purchase",
      name: "Purchase Order Local Form",
      path: "/purchase/purchase-orders-local/new",
    },
    {
      module: "Purchase",
      name: "Purchase Order Local Edit",
      path: "/purchase/purchase-orders-local/:id",
    },
    {
      module: "Purchase",
      name: "Purchase Order Local Edit Form",
      path: "/purchase/purchase-orders-local/:id/edit",
    },
    {
      module: "Purchase",
      name: "Purchase Orders Import",
      path: "/purchase/purchase-orders-import",
    },
    {
      module: "Purchase",
      name: "Purchase Order Import Form",
      path: "/purchase/purchase-orders-import/new",
    },
    {
      module: "Purchase",
      name: "Purchase Order Import Edit",
      path: "/purchase/purchase-orders-import/:id",
    },
    {
      module: "Purchase",
      name: "Purchase Order Import Edit Form",
      path: "/purchase/purchase-orders-import/:id/edit",
    },
    {
      module: "Purchase",
      name: "Shipping Advice",
      path: "/purchase/shipping-advice",
    },
    {
      module: "Purchase",
      name: "Shipping Advice Form",
      path: "/purchase/shipping-advice/new",
    },
    {
      module: "Purchase",
      name: "Shipping Advice Edit",
      path: "/purchase/shipping-advice/:id",
    },
    {
      module: "Purchase",
      name: "Port Clearances",
      path: "/purchase/port-clearances",
    },
    {
      module: "Purchase",
      name: "Port Clearance Form",
      path: "/purchase/port-clearances/new",
    },
    {
      module: "Purchase",
      name: "Port Clearance Edit",
      path: "/purchase/port-clearances/:id",
    },
    {
      module: "Purchase",
      name: "Purchase Bills Local",
      path: "/purchase/purchase-bills-local",
    },
    {
      module: "Purchase",
      name: "Purchase Bill Local Form",
      path: "/purchase/purchase-bills-local/new",
    },
    {
      module: "Purchase",
      name: "Purchase Bill Local Edit",
      path: "/purchase/purchase-bills-local/:id",
    },
    {
      module: "Purchase",
      name: "Purchase Bills Import",
      path: "/purchase/purchase-bills-import",
    },
    {
      module: "Purchase",
      name: "Purchase Bill Import Form",
      path: "/purchase/purchase-bills-import/new",
    },
    {
      module: "Purchase",
      name: "Purchase Bill Import Edit",
      path: "/purchase/purchase-bills-import/:id",
    },
    { module: "Purchase", name: "Suppliers", path: "/purchase/suppliers" },
    {
      module: "Purchase",
      name: "Supplier Form",
      path: "/purchase/suppliers/new",
    },
    {
      module: "Purchase",
      name: "Supplier Edit",
      path: "/purchase/suppliers/:id",
    },
    {
      module: "Purchase",
      name: "Service Confirmation",
      path: "/purchase/service-confirmation",
    },
    {
      module: "Purchase",
      name: "Service Confirmation Edit",
      path: "/purchase/service-confirmation/:id",
    },
    {
      module: "Purchase",
      name: "Service Requests",
      path: "/purchase/service-requests",
    },
    {
      module: "Purchase",
      name: "Service Request Form",
      path: "/purchase/service-requests/new",
    },
    {
      module: "Purchase",
      name: "Service Bills",
      path: "/purchase/service-bills",
    },
    {
      module: "Purchase",
      name: "Service Bill Form",
      path: "/purchase/service-bills/new",
    },
    {
      module: "Purchase",
      name: "Service Bill Edit",
      path: "/purchase/service-bills/:id",
    },
    {
      module: "Purchase",
      name: "Service Orders",
      path: "/purchase/service-orders",
    },
    {
      module: "Purchase",
      name: "Service Order Form",
      path: "/purchase/service-orders/new",
    },
    {
      module: "Purchase",
      name: "Service Order Edit",
      path: "/purchase/service-orders/:id",
    },
    {
      module: "Purchase",
      name: "Service Confirmation Form",
      path: "/purchase/service-confirmation/new",
    },
    {
      module: "Purchase",
      name: "General Requisitions",
      path: "/purchase/general-requisitions",
    },
    {
      module: "Purchase",
      name: "General Requisition Form",
      path: "/purchase/general-requisitions/new",
    },
    {
      module: "Purchase",
      name: "General Requisition View",
      path: "/purchase/general-requisitions/:id",
    },
    {
      module: "Purchase",
      name: "General Requisition Edit",
      path: "/purchase/general-requisitions/:id/edit",
    },
    {
      module: "Service Management",
      name: "Customer Service Requests",
      path: "/service-management/customer-service-requests",
    },
    {
      module: "Service Management",
      name: "Supplier Service Requests",
      path: "/service-management/supplier-service-requests",
    },
    {
      module: "Service Management",
      name: "Service Requests",
      path: "/service-management/service-requests",
    },
    {
      module: "Service Management",
      name: "Service Request Form",
      path: "/service-management/service-requests/new",
    },
    {
      module: "Service Management",
      name: "Service Request Edit",
      path: "/service-management/service-requests/:id",
    },
    {
      module: "Service Management",
      name: "Service Orders",
      path: "/service-management/service-orders",
    },
    {
      module: "Service Management",
      name: "Service Order Form",
      path: "/service-management/service-orders/new",
    },
    {
      module: "Service Management",
      name: "Service Order Edit",
      path: "/service-management/service-orders/:id",
    },
    {
      module: "Service Management",
      name: "Service Executions",
      path: "/service-management/service-executions",
    },
    {
      module: "Service Management",
      name: "Service Execution Form",
      path: "/service-management/service-execution",
    },
    {
      module: "Service Management",
      name: "Service Execution Edit",
      path: "/service-management/service-execution/:id",
    },
    {
      module: "Service Management",
      name: "Service Confirmation",
      path: "/service-management/service-confirmation",
    },
    {
      module: "Service Management",
      name: "Service Confirmation Form",
      path: "/service-management/service-confirmation/new",
    },
    {
      module: "Service Management",
      name: "Service Confirmation Edit",
      path: "/service-management/service-confirmation/:id",
    },
    {
      module: "Service Management",
      name: "Service Bills",
      path: "/service-management/service-bills",
    },
    {
      module: "Service Management",
      name: "Service Bill Form",
      path: "/service-management/service-bills/new",
    },
    {
      module: "Service Management",
      name: "Service Bill Edit",
      path: "/service-management/service-bills/:id",
    },
    {
      module: "Service Management",
      name: "Service Setup",
      path: "/service-management/setup",
    },
    {
      module: "Purchase",
      name: "Mass Suppliers Upload",
      path: "/purchase/suppliers/mass-upload",
    },
    { module: "Purchase", name: "Reports", path: "/purchase/reports" },
    {
      module: "Finance",
      name: "Account Groups",
      path: "/finance/account-groups",
    },
    { module: "Finance", name: "Accounts", path: "/finance/accounts" },
    { module: "Finance", name: "COA", path: "/finance/coa" },
    { module: "Finance", name: "Tax Codes", path: "/finance/tax-codes" },
    { module: "Finance", name: "Currencies", path: "/finance/currencies" },
    { module: "Finance", name: "Fiscal Years", path: "/finance/fiscal-years" },
    {
      module: "Finance",
      name: "Journal Entry",
      path: "/finance/journal-voucher",
    },
    {
      module: "Finance",
      name: "Journal Entry Form",
      path: "/finance/journal-voucher/create",
    },
    {
      module: "Finance",
      name: "Make Payment",
      path: "/finance/payment-voucher",
    },
    {
      module: "Finance",
      name: "Make Payment Form",
      path: "/finance/payment-voucher/create",
    },
    {
      module: "Finance",
      name: "Receive Payment",
      path: "/finance/receipt-voucher",
    },
    {
      module: "Finance",
      name: "Receive Payment Form",
      path: "/finance/receipt-voucher/create",
    },
    {
      module: "Finance",
      name: "Contra Voucher",
      path: "/finance/contra-voucher",
    },
    {
      module: "Finance",
      name: "Contra Voucher Form",
      path: "/finance/contra-voucher/create",
    },
    {
      module: "Finance",
      name: "Sales Voucher",
      path: "/finance/sales-voucher",
    },
    {
      module: "Finance",
      name: "Sales Voucher Form",
      path: "/finance/sales-voucher/create",
    },
    {
      module: "Finance",
      name: "Purchase Voucher",
      path: "/finance/purchase-voucher",
    },
    {
      module: "Finance",
      name: "Purchase Voucher Form",
      path: "/finance/purchase-voucher/create",
    },
    {
      module: "Finance",
      name: "Bank Reconciliation",
      path: "/finance/bank-reconciliation",
    },
    {
      module: "Finance",
      name: "Bank Reconciliation Edit",
      path: "/finance/bank-reconciliation/:id",
    },
    { module: "Finance", name: "PDC Postings", path: "/finance/pdc-postings" },
    {
      module: "Finance",
      name: "PDC Posting Edit",
      path: "/finance/pdc-postings/:id",
    },
    { module: "Finance", name: "Reports", path: "/finance/reports" },
    {
      module: "Finance",
      name: "Reports Voucher Register",
      path: "/finance/reports/voucher-register",
    },
    {
      module: "Finance",
      name: "Reports Trial Balance",
      path: "/finance/reports/trial-balance",
    },
    {
      module: "Finance",
      name: "Reports Journals",
      path: "/finance/reports/journals",
    },
    {
      module: "Finance",
      name: "Reports General Ledger",
      path: "/finance/reports/general-ledger",
    },
    {
      module: "Finance",
      name: "Reports Profit And Loss",
      path: "/finance/reports/profit-and-loss",
    },
    {
      module: "Finance",
      name: "Reports Statement of Profit or Loss and OCI",
      path: "/finance/reports/profit-loss-oci",
    },
    {
      module: "Finance",
      name: "Reports Balance Sheet",
      path: "/finance/reports/balance-sheet",
    },
    {
      module: "Finance",
      name: "Reports Cash Flow",
      path: "/finance/reports/cash-flow",
    },
    {
      module: "Human Resources",
      name: "Employees",
      path: "/human-resources/employees",
    },
    {
      module: "Human Resources",
      name: "HR Setup",
      path: "/human-resources/setup",
    },
    {
      module: "Human Resources",
      name: "Leave Setup",
      path: "/human-resources/leave-setup",
    },
    {
      module: "Human Resources",
      name: "Shifts",
      path: "/human-resources/shifts",
    },
    {
      module: "Human Resources",
      name: "Attendance",
      path: "/human-resources/attendance",
    },
    {
      module: "Human Resources",
      name: "Salary Config",
      path: "/human-resources/salary-config",
    },
    {
      module: "Human Resources",
      name: "Tax Config",
      path: "/human-resources/tax-config",
    },
    {
      module: "Human Resources",
      name: "Allowances",
      path: "/human-resources/allowances",
    },
    {
      module: "Human Resources",
      name: "Loans",
      path: "/human-resources/loans",
    },
    {
      module: "Human Resources",
      name: "Payslips",
      path: "/human-resources/payslips",
    },
    {
      module: "Human Resources",
      name: "Payslip Form",
      path: "/human-resources/payslips/new",
    },
    {
      module: "Human Resources",
      name: "Payslip Edit",
      path: "/human-resources/payslips/:id",
    },
    {
      module: "Human Resources",
      name: "Promotions",
      path: "/human-resources/promotions",
    },
    {
      module: "Human Resources",
      name: "Medical Policies",
      path: "/human-resources/medical-policies",
    },
    {
      module: "Human Resources",
      name: "Reports",
      path: "/human-resources/reports",
    },
    {
      module: "Project Management",
      name: "Projects",
      path: "/project-management/projects",
    },
    {
      module: "Project Management",
      name: "Project Form",
      path: "/project-management/projects/new",
    },
    {
      module: "Project Management",
      name: "Project Edit",
      path: "/project-management/projects/:id",
    },
    {
      module: "Project Management",
      name: "Tasks",
      path: "/project-management/tasks",
    },
    {
      module: "Project Management",
      name: "Task Form",
      path: "/project-management/tasks/new",
    },
    {
      module: "Project Management",
      name: "Task Edit",
      path: "/project-management/tasks/:id",
    },
    {
      module: "Project Management",
      name: "Reports",
      path: "/project-management/reports",
    },
    {
      module: "Production",
      name: "Work Orders",
      path: "/production/work-orders",
    },
    {
      module: "Production",
      name: "Work Order Form",
      path: "/production/work-orders/new",
    },
    {
      module: "Production",
      name: "Work Order Edit",
      path: "/production/work-orders/:id",
    },
    { module: "Production", name: "Reports", path: "/production/reports" },
    { module: "POS", name: "Sales", path: "/pos/sales" },
    { module: "POS", name: "New Sale", path: "/pos/sales/new" },
    { module: "POS", name: "Sale Edit", path: "/pos/sales/:id" },
    { module: "POS", name: "Terminals", path: "/pos/terminals" },
    { module: "POS", name: "Terminal Form", path: "/pos/terminals/new" },
    { module: "POS", name: "Terminal Edit", path: "/pos/terminals/:id" },
    { module: "POS", name: "Reports", path: "/pos/reports" },
    { module: "POS", name: "Sales Entry", path: "/pos/sales-entry" },
    { module: "POS", name: "Invoice List", path: "/pos/invoices" },
    { module: "POS", name: "Sales Return", path: "/pos/returns" },
    { module: "POS", name: "POS Register", path: "/pos/register" },
    { module: "POS", name: "Cash Collection", path: "/pos/cash-collection" },
    { module: "POS", name: "Post to Finance", path: "/pos/post-to-finance" },
    {
      module: "Business Intelligence",
      name: "Dashboards",
      path: "/business-intelligence/dashboards",
    },
    {
      module: "Business Intelligence",
      name: "Analytics",
      path: "/business-intelligence/analytics",
    },
    {
      module: "Business Intelligence",
      name: "Reports",
      path: "/business-intelligence/reports",
    },
    {
      module: "Business Intelligence",
      name: "BI Reports",
      path: "/bi-reports",
    },
  ];
  const deleteDerived = pages
    .filter((p) => /\bEdit\b$/i.test(p.name))
    .map((p) => ({
      module: p.module,
      name: p.name.replace(/\bEdit\b$/i, "Delete"),
      path: p.path,
    }));
  const allPages = [...pages, ...deleteDerived];

  const allFeatures = getAllFeatures();

  function deriveFeatureKeyFromPath(path) {
    const rawPath = String(path || "").trim();
    if (!rawPath) return null;
    let bestFeatureKey = null;
    let bestLen = -1;
    for (const f of allFeatures) {
      const fp = String(f.path || "").trim();
      if (!fp) continue;
      if (rawPath === fp || rawPath.startsWith(fp + "/")) {
        if (fp.length > bestLen) {
          bestLen = fp.length;
          bestFeatureKey = String(f.feature_key || "").trim();
        }
      }
    }
    return bestFeatureKey;
  }

  for (const p of allPages) {
    const code = `${p.module}_${p.name}`
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const feature_key = deriveFeatureKeyFromPath(p.path);
    await query(
      "INSERT IGNORE INTO adm_pages (module, name, code, path, feature_key) VALUES (:module, :name, :code, :path, :feature_key)",
      {
        module: p.module,
        name: p.name,
        code,
        path: p.path || null,
        feature_key: feature_key || null,
      },
    );
  }

  // Ensure every feature in the registry has at least one entry in adm_pages.
  // This guarantees that page-based permission tables can store permissions for features without real pages.
  const existingRows = await query("SELECT feature_key FROM adm_pages WHERE feature_key IS NOT NULL");
  const existingFks = new Set(existingRows.map(r => String(r.feature_key).trim()));

  for (const f of allFeatures) {
    const fk = String(f.feature_key || "").trim();
    if (!fk || existingFks.has(fk)) continue;

    const moduleStr = f.module_key || fk.split(":")[0];
    const code = `${moduleStr}_${f.name || fk.split(":")[1] || "FEATURE"}`
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    
    await query(
      "INSERT IGNORE INTO adm_pages (module, name, code, path, feature_key) VALUES (:module, :name, :code, :path, :feature_key)",
      {
        module: moduleStr,
        name: f.name || fk,
        code: code,
        path: f.path || `/${moduleStr}/synthetic/${fk.split(":")[1] || "feature"}`,
        feature_key: fk,
      },
    );
  }
}

export async function ensureRolePagesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_role_pages (
      role_id BIGINT UNSIGNED NOT NULL,
      page_id BIGINT UNSIGNED NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, page_id),
      FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE,
      FOREIGN KEY (page_id) REFERENCES adm_pages(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureUserPermissionsTable() {
  const table = "adm_user_permissions";
  if (verifiedTables.has(table)) return;
  if (pendingEnsures.has(table)) return pendingEnsures.get(table);
  const promise = (async () => {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS adm_user_permissions (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          page_id BIGINT UNSIGNED NOT NULL,
          can_view TINYINT(1) DEFAULT 0,
          can_create TINYINT(1) DEFAULT 0,
          can_edit TINYINT(1) DEFAULT 0,
          can_delete TINYINT(1) DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_user_page (user_id, page_id),
          FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE,
          FOREIGN KEY (page_id) REFERENCES adm_pages(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      verifiedTables.add(table);
    } finally {
      pendingEnsures.delete(table);
    }
  })();
  pendingEnsures.set(table, promise);
  return promise;
}

export const pendingEnsures = new Map();

export async function ensureUserPermissionCacheAndTriggers() {
  const table = "adm_page_permission_effective_triggers";
  if (verifiedTables.has(table)) return;
  if (pendingEnsures.has(table)) return pendingEnsures.get(table);
  const promise = (async () => {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS adm_page_permission_effective (
          user_id BIGINT UNSIGNED NOT NULL,
          page_id BIGINT UNSIGNED NOT NULL,
          can_view TINYINT(1) NOT NULL DEFAULT 0,
          can_create TINYINT(1) NOT NULL DEFAULT 0,
          can_edit TINYINT(1) NOT NULL DEFAULT 0,
          can_delete TINYINT(1) NOT NULL DEFAULT 0,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, page_id),
          KEY idx_page (page_id),
          CONSTRAINT fk_e_user FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE,
          CONSTRAINT fk_e_page FOREIGN KEY (page_id) REFERENCES adm_pages(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // Recreate triggers idempotently
      await query(`DROP TRIGGER IF EXISTS trg_adm_user_permissions_ai`);
      await query(`DROP TRIGGER IF EXISTS trg_adm_user_permissions_au`);
      await query(`DROP TRIGGER IF EXISTS trg_adm_user_permissions_ad`);
      await query(`
        CREATE TRIGGER trg_adm_user_permissions_ai
        AFTER INSERT ON adm_user_permissions
        FOR EACH ROW
        BEGIN
          INSERT INTO adm_page_permission_effective (user_id, page_id, can_view, can_create, can_edit, can_delete, updated_at)
          VALUES (NEW.user_id, NEW.page_id, NEW.can_view, NEW.can_create, NEW.can_edit, NEW.can_delete, NOW())
          ON DUPLICATE KEY UPDATE
            can_view = VALUES(can_view),
            can_create = VALUES(can_create),
            can_edit = VALUES(can_edit),
            can_delete = VALUES(can_delete),
            updated_at = NOW();
        END
      `);
      await query(`
        CREATE TRIGGER trg_adm_user_permissions_au
        AFTER UPDATE ON adm_user_permissions
        FOR EACH ROW
        BEGIN
          INSERT INTO adm_page_permission_effective (user_id, page_id, can_view, can_create, can_edit, can_delete, updated_at)
          VALUES (NEW.user_id, NEW.page_id, NEW.can_view, NEW.can_create, NEW.can_edit, NEW.can_delete, NOW())
          ON DUPLICATE KEY UPDATE
            can_view = VALUES(can_view),
            can_create = VALUES(can_create),
            can_edit = VALUES(can_edit),
            can_delete = VALUES(can_delete),
            updated_at = NOW();
        END
      `);
      await query(`
        CREATE TRIGGER trg_adm_user_permissions_ad
        AFTER DELETE ON adm_user_permissions
        FOR EACH ROW
        BEGIN
          DELETE FROM adm_page_permission_effective
          WHERE user_id = OLD.user_id AND page_id = OLD.page_id;
        END
      `);
      verifiedTables.add(table);
    } finally {
      pendingEnsures.delete(table);
    }
  })();
  pendingEnsures.set(table, promise);
  return promise;
}

export async function ensureErrorLogsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_error_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NULL,
      module VARCHAR(100) NULL,
      action VARCHAR(150) NULL,
      error_code VARCHAR(50) NULL,
      message VARCHAR(255) NULL,
      details TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureExceptionalPermissionsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_exceptional_permissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      permission_code VARCHAR(150) NOT NULL,
      effect ENUM('ALLOW','DENY') NOT NULL DEFAULT 'ALLOW',
      reason VARCHAR(255) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      effective_from DATETIME NULL,
      effective_to DATETIME NULL,
      approved_by BIGINT UNSIGNED NULL,
      exception_type VARCHAR(50) NOT NULL DEFAULT 'TEMPORARY',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ep_user (user_id),
      KEY idx_ep_code (permission_code),
      FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureUserBranchMapping() {
  if (verifiedTables.has("adm_user_branches")) return;
  await query(`
    CREATE TABLE IF NOT EXISTS adm_user_branches (
      user_id BIGINT UNSIGNED NOT NULL,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (user_id, branch_id),
      KEY idx_ub_company (company_id),
      KEY idx_ub_branch (branch_id),
      CONSTRAINT fk_ub_user FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_ub_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
      CONSTRAINT fk_ub_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  verifiedTables.add("adm_user_branches");
}

export async function logError({
  user_id = null,
  module = null,
  action = null,
  error_code = null,
  message = null,
  details = null,
}) {
  await ensureErrorLogsTable();
  await query(
    `INSERT INTO adm_error_logs (user_id, module, action, error_code, message, details) VALUES (:user_id, :module, :action, :error_code, :message, :details)`,
    { user_id, module, action, error_code, message, details },
  );
}

export async function nextWorkflowCode(companyId) {
  const rows = await query(
    `
    SELECT workflow_code
    FROM adm_workflows
    WHERE company_id = :companyId
      AND workflow_code REGEXP '^WF-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(workflow_code, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].workflow_code || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `WF-${String(nextNum).padStart(6, "0")}`;
}

export async function ensureHRTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS hr_departments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      dept_code VARCHAR(20) NOT NULL,
      dept_name VARCHAR(100) NOT NULL,
      manager_id BIGINT UNSIGNED NULL,
      parent_dept_id BIGINT UNSIGNED NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_dept_code (company_id, dept_code),
      KEY idx_dept_company (company_id),
      KEY idx_dept_manager (manager_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_employee_base_salaries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      base_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
      effective_date DATE NOT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ebs_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_positions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      pos_code VARCHAR(20) NOT NULL,
      pos_name VARCHAR(100) NOT NULL,
      dept_id BIGINT UNSIGNED NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_pos_code (company_id, pos_code),
      KEY idx_pos_dept (dept_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_employees (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NULL COMMENT 'Link to adm_users',
      emp_code VARCHAR(20) NOT NULL,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      middle_name VARCHAR(50) NULL,
      gender ENUM('MALE', 'FEMALE', 'OTHER') NULL,
      dob DATE NULL,
      joining_date DATE NOT NULL,
      email VARCHAR(100) NULL,
      phone VARCHAR(20) NULL,
      dept_id BIGINT UNSIGNED NULL,
      pos_id BIGINT UNSIGNED NULL,
      manager_id BIGINT UNSIGNED NULL,
      employment_type ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN') NOT NULL DEFAULT 'FULL_TIME',
      status ENUM('PROBATION', 'ACTIVE', 'TERMINATED', 'RESIGNED', 'SUSPENDED') NOT NULL DEFAULT 'PROBATION',
      base_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
      address TEXT NULL,
      emergency_contact_name VARCHAR(100) NULL,
      emergency_contact_phone VARCHAR(20) NULL,
      bank_name VARCHAR(100) NULL,
      bank_account_no VARCHAR(50) NULL,
      tin VARCHAR(50) NULL,
      ssnit_no VARCHAR(50) NULL,
      component_flags JSON NULL COMMENT 'Per-component flags e.g. {\\"allowance_5\\":1, \\"tax_2\\":0}',
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_emp_code (company_id, emp_code),
      KEY idx_emp_user (user_id),
      KEY idx_emp_dept (dept_id),
      KEY idx_emp_pos (pos_id),
      KEY idx_emp_manager (manager_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_employee_documents (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      employee_id BIGINT UNSIGNED NOT NULL,
      doc_type VARCHAR(50) NOT NULL,
      doc_name VARCHAR(255) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      expiry_date DATE NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_emp_doc_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_job_requisitions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      req_no VARCHAR(20) NOT NULL,
      title VARCHAR(100) NOT NULL,
      dept_id BIGINT UNSIGNED NOT NULL,
      pos_id BIGINT UNSIGNED NOT NULL,
      vacancies INT NOT NULL DEFAULT 1,
      employment_type ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN') NOT NULL,
      recruitment_type ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'EXTERNAL',
      from_date DATE NULL,
      to_date DATE NULL,
      reason TEXT NULL,
      requirements TEXT NULL,
      status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_req_no (company_id, req_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_candidates (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      email VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NULL,
      resume_url VARCHAR(500) NULL,
      source VARCHAR(50) NULL,
      requisition_id BIGINT UNSIGNED NULL,
      status ENUM('NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED') NOT NULL DEFAULT 'NEW',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_candidate_requisition (requisition_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_promotions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      promotion_date DATE NOT NULL,
      previous_pos_id BIGINT UNSIGNED NULL,
      new_pos_id BIGINT UNSIGNED NULL,
      previous_salary DECIMAL(18,4) NULL,
      new_salary DECIMAL(18,4) NULL,
      remarks TEXT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_promotion_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_leave_setup (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      leave_type_id BIGINT UNSIGNED NOT NULL,
      entitled_days INT NOT NULL DEFAULT 0,
      carried_forward INT NOT NULL DEFAULT 0,
      taken_days INT NOT NULL DEFAULT 0,
      remaining_days INT NOT NULL DEFAULT 0,
      year INT NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_emp_leave_year (employee_id, leave_type_id, year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_job_applications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      requisition_id BIGINT UNSIGNED NOT NULL,
      candidate_id BIGINT UNSIGNED NOT NULL,
      applied_date DATE NOT NULL,
      status ENUM('PENDING', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
      remarks TEXT NULL,
      PRIMARY KEY (id),
      KEY idx_app_req (requisition_id),
      KEY idx_app_cand (candidate_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_shifts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      code VARCHAR(20) NOT NULL,
      name VARCHAR(100) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      break_minutes INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_shift_code (company_id, code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_work_schedules (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      shift_id BIGINT UNSIGNED NOT NULL,
      off_days VARCHAR(100) NULL COMMENT 'JSON array of weekdays 0-6',
      effective_from DATE NULL,
      effective_to DATE NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_emp_active (employee_id, is_active),
      KEY idx_ws_emp (employee_id),
      KEY idx_ws_shift (shift_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_attendance (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      attendance_date DATE NOT NULL,
      clock_in DATETIME NULL,
      clock_out DATETIME NULL,
      status ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE') NOT NULL DEFAULT 'PRESENT',
      overtime_minutes INT NOT NULL DEFAULT 0,
      remarks VARCHAR(255) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_emp_date (employee_id, attendance_date),
      KEY idx_att_date (attendance_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_leave_types (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      type_name VARCHAR(50) NOT NULL,
      days_per_year INT NOT NULL,
      is_paid TINYINT(1) NOT NULL DEFAULT 1,
      carry_forward TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_leave_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      leave_type_id BIGINT UNSIGNED NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_days DECIMAL(5,2) NOT NULL,
      reason TEXT NULL,
      status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'SUBMITTED', 'SCHEDULED', 'ACTIVE', 'OVERRIDDEN') NOT NULL DEFAULT 'ACTIVE',
      source ENUM('APPLICATION', 'SCHEDULE', 'ROSTER') NOT NULL DEFAULT 'APPLICATION',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_leave_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_leave_roster (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      year INT NOT NULL,
      department_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_roster_company_year (company_id, year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_leave_roster_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      roster_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      leave_type_id BIGINT UNSIGNED NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_days DECIMAL(5,2) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_roster_details_hdr (roster_id),
      KEY idx_roster_details_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_employee_salaries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      basic_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
      allowances DECIMAL(18,4) NOT NULL DEFAULT 0,
      deductions DECIMAL(18,4) NOT NULL DEFAULT 0,
      effective_from DATE NOT NULL,
      effective_to DATE NULL,
      status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_emp_salary_emp (employee_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_salary_structures (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_payroll (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      period_id BIGINT UNSIGNED NOT NULL,
      status ENUM('OPEN','GENERATED','CLOSED') NOT NULL DEFAULT 'OPEN',
      generated_at DATETIME NULL,
      closed_at DATETIME NULL,
      remarks VARCHAR(255) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_payroll_period (company_id, period_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_payroll_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      payroll_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      basic_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
      allowances DECIMAL(18,4) NOT NULL DEFAULT 0,
      deductions DECIMAL(18,4) NOT NULL DEFAULT 0,
      net_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_payroll_item_hdr (payroll_id),
      KEY idx_payroll_item_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_payroll_periods (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      period_name VARCHAR(50) NOT NULL COMMENT 'e.g. March 2026',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status ENUM('OPEN', 'PROCESSING', 'CLOSED') NOT NULL DEFAULT 'OPEN',
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_payslips (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      employee_id BIGINT UNSIGNED NOT NULL,
      period_id BIGINT UNSIGNED NOT NULL,
      basic_salary DECIMAL(18,4) NOT NULL,
      allowances DECIMAL(18,4) NOT NULL DEFAULT 0,
      deductions DECIMAL(18,4) NOT NULL DEFAULT 0,
      net_salary DECIMAL(18,4) NOT NULL,
      status ENUM('DRAFT', 'PAID') NOT NULL DEFAULT 'DRAFT',
      paid_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_emp_period (employee_id, period_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_exits (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      employee_id BIGINT UNSIGNED NOT NULL,
      exit_type ENUM('RESIGNATION', 'TERMINATION', 'RETIREMENT') NOT NULL,
      resignation_date DATE NULL,
      last_working_day DATE NOT NULL,
      reason TEXT NULL,
      status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_interviews (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      requisition_id BIGINT UNSIGNED NOT NULL,
      candidate_id BIGINT UNSIGNED NOT NULL,
      interviewer_user_id BIGINT UNSIGNED NULL,
      scheduled_at DATETIME NOT NULL,
      status ENUM('SCHEDULED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
      feedback TEXT NULL,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_interviews_req (requisition_id),
      KEY idx_interviews_candidate (candidate_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_offers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      requisition_id BIGINT UNSIGNED NOT NULL,
      candidate_id BIGINT UNSIGNED NOT NULL,
      offer_no VARCHAR(30) NOT NULL,
      offer_date DATE NOT NULL,
      position_id BIGINT UNSIGNED NULL,
      gross_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
      allowances DECIMAL(18,4) NOT NULL DEFAULT 0,
      deductions DECIMAL(18,4) NOT NULL DEFAULT 0,
      net_salary DECIMAL(18,4) NOT NULL DEFAULT 0,
      status ENUM('DRAFT','PENDING','APPROVED','REJECTED','ACCEPTED') NOT NULL DEFAULT 'DRAFT',
      remarks TEXT NULL,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_offer_no (company_id, offer_no),
      KEY idx_offers_req (requisition_id),
      KEY idx_offers_candidate (candidate_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_kpis (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      code VARCHAR(30) NOT NULL,
      name VARCHAR(150) NOT NULL,
      description TEXT NULL,
      target_value DECIMAL(12,2) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_kpi_code (company_id, code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_policies (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      code VARCHAR(30) NOT NULL,
      title VARCHAR(150) NOT NULL,
      content TEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_policy_code (company_id, code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_clearance (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      exit_id BIGINT UNSIGNED NOT NULL,
      department VARCHAR(100) NOT NULL,
      cleared TINYINT(1) NOT NULL DEFAULT 0,
      cleared_at DATETIME NULL,
      remarks TEXT NULL,
      PRIMARY KEY (id),
      KEY idx_clearance_exit (exit_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_medical_policies (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      policy_code VARCHAR(30) NOT NULL,
      policy_name VARCHAR(150) NOT NULL,
      provider VARCHAR(150) NOT NULL,
      description TEXT NULL,
      coverage_details TEXT NULL,
      premium_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      renewal_date DATE NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_med_policy_code (company_id, policy_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_allowances (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      allowance_code VARCHAR(30) NOT NULL,
      allowance_name VARCHAR(150) NOT NULL,
      amount_type ENUM('FIXED', 'PERCENTAGE') NOT NULL DEFAULT 'FIXED',
      amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      is_taxable TINYINT(1) NOT NULL DEFAULT 1,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_allowance_code (company_id, allowance_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_loans (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      loan_type VARCHAR(50) NOT NULL,
      amount DECIMAL(18,4) NOT NULL,
      interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
      repayment_period_months INT NOT NULL,
      monthly_installment DECIMAL(18,4) NOT NULL,
      start_date DATE NOT NULL,
      status ENUM('PENDING', 'APPROVED', 'DISBURSED', 'REPAID', 'REJECTED') NOT NULL DEFAULT 'PENDING',
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_loan_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_tax_config (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      tax_name VARCHAR(100) NOT NULL,
      tax_type ENUM('INCOME_TAX', 'SOCIAL_SECURITY', 'OTHER') NOT NULL,
      min_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      max_amount DECIMAL(18,4) NULL,
      tax_rate DECIMAL(5,2) NOT NULL,
      fixed_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      affect_payslip TINYINT(1) NOT NULL DEFAULT 1,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_setup_employment_types (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_setup_employee_categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_setup_allowance_types (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_setup_parameters (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      param_key VARCHAR(100) NOT NULL,
      param_value VARCHAR(255) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_param_key (company_id, param_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_timesheets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      work_date DATE NOT NULL,
      time_in TIME NULL,
      time_out TIME NULL,
      hours_worked DECIMAL(5,2) NOT NULL DEFAULT 0,
      overtime_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
      short_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
      location_gps VARCHAR(255) NULL,
      remarks TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_timesheet_emp_date (employee_id, work_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_employee_tax_mappings (
      employee_id BIGINT UNSIGNED NOT NULL,
      tax_config_id BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (employee_id, tax_config_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS hr_employee_allowance_mappings (
      employee_id BIGINT UNSIGNED NOT NULL,
      allowance_id BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (employee_id, allowance_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS hr_locations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
      location_name VARCHAR(150) NOT NULL,
      address TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_loc_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_salary_components (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      column_name VARCHAR(100) NOT NULL COMMENT 'Exact column name in hr_payslips (e.g. basic_salary, allowance_3, income_tax_1)',
      label VARCHAR(150) NOT NULL COMMENT 'Human-readable label shown on payslip',
      component_type ENUM(
        'BASIC',
        'ALLOWANCE',
        'INCOME_TAX',
        'SOCIAL_SECURITY',
        'PROVIDENT_FUND',
        'DEDUCTION',
        'NET_SALARY',
        'SUBTOTAL',
        'OTHER'
      ) NOT NULL DEFAULT 'OTHER',
      display_order INT NOT NULL DEFAULT 0 COMMENT 'Order in which component appears on payslip',
      is_earning TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = earning/addition, 0 = deduction',
      is_fixed TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = core column always present, 0 = dynamically added',
      source_type ENUM('NONE','ALLOWANCE','TAX_CONFIG') NOT NULL DEFAULT 'NONE' COMMENT 'Which master table this component references',
      source_id BIGINT UNSIGNED NULL COMMENT 'FK to hr_allowances.id or hr_tax_config.id',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_comp_col (company_id, column_name),
      KEY idx_sc_company (company_id),
      KEY idx_sc_type (component_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];

  for (const sql of tables) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await query(sql);
    } catch (err) {
      console.error("Error creating HR table:", err);
    }
  }

  // Ensure columns exist for older tables
  const columnChecks = [
    {
      table: "hr_leave_requests",
      column: "company_id",
      sql: "ALTER TABLE hr_leave_requests ADD COLUMN company_id BIGINT UNSIGNED NULL",
    },
    {
      table: "hr_leave_requests",
      column: "status",
      sql: "ALTER TABLE hr_leave_requests MODIFY COLUMN status ENUM('DRAFT','PENDING','APPROVED','REJECTED','CANCELLED','SUBMITTED','SCHEDULED','ACTIVE','OVERRIDDEN') NOT NULL DEFAULT 'ACTIVE'",
    },
    {
      table: "hr_job_requisitions",
      column: "recruitment_type",
      sql: "ALTER TABLE hr_job_requisitions ADD COLUMN recruitment_type ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'EXTERNAL' AFTER employment_type",
    },
    {
      table: "hr_job_requisitions",
      column: "from_date",
      sql: "ALTER TABLE hr_job_requisitions ADD COLUMN from_date DATE NULL AFTER recruitment_type",
    },
    {
      table: "hr_job_requisitions",
      column: "to_date",
      sql: "ALTER TABLE hr_job_requisitions ADD COLUMN to_date DATE NULL AFTER from_date",
    },
    {
      table: "hr_candidates",
      column: "requisition_id",
      sql: "ALTER TABLE hr_candidates ADD COLUMN requisition_id BIGINT UNSIGNED NULL AFTER source",
    },
    {
      table: "hr_departments",
      column: "branch_id",
      sql: "ALTER TABLE hr_departments ADD COLUMN branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER company_id",
    },
    {
      table: "hr_positions",
      column: "branch_id",
      sql: "ALTER TABLE hr_positions ADD COLUMN branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER company_id",
    },
    {
      table: "hr_departments",
      column: "deleted_at",
      sql: "ALTER TABLE hr_departments ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at",
    },
    {
      table: "hr_positions",
      column: "deleted_at",
      sql: "ALTER TABLE hr_positions ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at",
    },
    {
      table: "hr_allowances",
      column: "affect_payslip",
      sql: "ALTER TABLE hr_allowances ADD COLUMN affect_payslip TINYINT(1) NOT NULL DEFAULT 1 AFTER amount",
    },
    {
      table: "hr_loans",
      column: "affect_payslip",
      sql: "ALTER TABLE hr_loans ADD COLUMN affect_payslip TINYINT(1) NOT NULL DEFAULT 1 AFTER monthly_installment",
    },
    {
      table: "hr_tax_config",
      column: "affect_payslip",
      sql: "ALTER TABLE hr_tax_config ADD COLUMN affect_payslip TINYINT(1) NOT NULL DEFAULT 1 AFTER fixed_amount",
    },
    {
      table: "hr_tax_config",
      column: "employee_contribution_rate",
      sql: "ALTER TABLE hr_tax_config ADD COLUMN employee_contribution_rate DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER tax_rate",
    },
    {
      table: "hr_tax_config",
      column: "employer_contribution_rate",
      sql: "ALTER TABLE hr_tax_config ADD COLUMN employer_contribution_rate DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER employee_contribution_rate",
    },
    {
      table: "hr_salary_structures",
      column: "components",
      sql: "ALTER TABLE hr_salary_structures ADD COLUMN components TEXT NULL",
    },
    {
      table: "hr_payroll_items",
      column: "income_tax",
      sql: "ALTER TABLE hr_payroll_items ADD COLUMN income_tax DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER deductions",
    },
    {
      table: "hr_payroll_items",
      column: "ssf_employee",
      sql: "ALTER TABLE hr_payroll_items ADD COLUMN ssf_employee DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER income_tax",
    },
    {
      table: "hr_tax_config",
      column: "taxable_components",
      sql: "ALTER TABLE hr_tax_config ADD COLUMN taxable_components TEXT NULL COMMENT 'JSON array of component keys like BASIC, ALLOWANCE_ID_1 etc'",
    },
    {
      table: "hr_allowances",
      column: "account_id",
      sql: "ALTER TABLE hr_allowances ADD COLUMN account_id BIGINT UNSIGNED NULL",
    },
    {
      table: "hr_employees",
      column: "company_id",
      sql: "ALTER TABLE hr_employees ADD COLUMN company_id BIGINT UNSIGNED NOT NULL AFTER id",
    },
    {
      table: "hr_employees",
      column: "first_name",
      sql: "ALTER TABLE hr_employees ADD COLUMN first_name VARCHAR(50) NOT NULL",
    },
    {
      table: "hr_employees",
      column: "last_name",
      sql: "ALTER TABLE hr_employees ADD COLUMN last_name VARCHAR(50) NOT NULL",
    },
    {
      table: "hr_employees",
      column: "middle_name",
      sql: "ALTER TABLE hr_employees ADD COLUMN middle_name VARCHAR(50) NULL",
    },
    {
      table: "hr_employees",
      column: "email",
      sql: "ALTER TABLE hr_employees ADD COLUMN email VARCHAR(100) NULL",
    },
    {
      table: "hr_employees",
      column: "phone",
      sql: "ALTER TABLE hr_employees ADD COLUMN phone VARCHAR(20) NULL",
    },
    {
      table: "hr_employees",
      column: "dept_id",
      sql: "ALTER TABLE hr_employees ADD COLUMN dept_id BIGINT UNSIGNED NULL",
    },
    {
      table: "hr_employees",
      column: "pos_id",
      sql: "ALTER TABLE hr_employees ADD COLUMN pos_id BIGINT UNSIGNED NULL",
    },
    {
      table: "hr_employees",
      column: "manager_id",
      sql: "ALTER TABLE hr_employees ADD COLUMN manager_id BIGINT UNSIGNED NULL",
    },
    {
      table: "hr_employees",
      column: "employment_type",
      sql: "ALTER TABLE hr_employees ADD COLUMN employment_type ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN') NOT NULL DEFAULT 'FULL_TIME'",
    },
    {
      table: "hr_employees",
      column: "status",
      sql: "ALTER TABLE hr_employees ADD COLUMN status ENUM('PROBATION', 'ACTIVE', 'TERMINATED', 'RESIGNED', 'SUSPENDED') NOT NULL DEFAULT 'PROBATION'",
    },
    {
      table: "hr_employees",
      column: "base_salary",
      sql: "ALTER TABLE hr_employees ADD COLUMN base_salary DECIMAL(18,4) NOT NULL DEFAULT 0",
    },
    {
      table: "hr_employees",
      column: "joining_date",
      sql: "ALTER TABLE hr_employees ADD COLUMN joining_date DATE NOT NULL DEFAULT (CURRENT_DATE)",
    },
    {
      table: "hr_employees",
      column: "created_at",
      sql: "ALTER TABLE hr_employees ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
    {
      table: "hr_employees",
      column: "updated_at",
      sql: "ALTER TABLE hr_employees ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    },
    {
      table: "hr_employees",
      column: "deleted_at",
      sql: "ALTER TABLE hr_employees ADD COLUMN deleted_at TIMESTAMP NULL",
    },
    {
      table: "hr_employees",
      column: "category_id",
      sql: "ALTER TABLE hr_employees ADD COLUMN category_id BIGINT UNSIGNED NULL AFTER branch_id",
    },
    {
      table: "hr_employees",
      column: "employment_type_id",
      sql: "ALTER TABLE hr_employees ADD COLUMN employment_type_id BIGINT UNSIGNED NULL AFTER category_id",
    },
    {
      table: "hr_employees",
      column: "picture_url",
      sql: "ALTER TABLE hr_employees ADD COLUMN picture_url VARCHAR(500) NULL AFTER last_name",
    },
    {
      table: "hr_employees",
      column: "national_id",
      sql: "ALTER TABLE hr_employees ADD COLUMN national_id VARCHAR(50) NULL AFTER picture_url",
    },
    {
      table: "hr_employees",
      column: "branch_id",
      sql: "ALTER TABLE hr_employees ADD COLUMN branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER company_id",
    },
    {
      table: "hr_employees",
      column: "emp_code",
      sql: "ALTER TABLE hr_employees ADD COLUMN emp_code VARCHAR(20) NULL AFTER branch_id",
    },
    {
      table: "hr_employees",
      column: "old_dept_id",
      sql: "ALTER TABLE hr_employees ADD COLUMN old_dept_id BIGINT UNSIGNED NULL AFTER dept_id",
    },
    {
      table: "hr_promotions",
      column: "previous_dept_id",
      sql: "ALTER TABLE hr_promotions ADD COLUMN previous_dept_id BIGINT UNSIGNED NULL AFTER employee_id",
    },
    {
      table: "hr_promotions",
      column: "new_dept_id",
      sql: "ALTER TABLE hr_promotions ADD COLUMN new_dept_id BIGINT UNSIGNED NULL AFTER previous_dept_id",
    },
    {
      table: "hr_promotions",
      column: "previous_branch_id",
      sql: "ALTER TABLE hr_promotions ADD COLUMN previous_branch_id BIGINT UNSIGNED NULL AFTER new_dept_id",
    },
    {
      table: "hr_promotions",
      column: "new_branch_id",
      sql: "ALTER TABLE hr_promotions ADD COLUMN new_branch_id BIGINT UNSIGNED NULL AFTER previous_branch_id",
    },
    {
      table: "hr_employees",
      column: "location_id",
      sql: "ALTER TABLE hr_employees ADD COLUMN location_id BIGINT UNSIGNED NULL AFTER branch_id",
    },
    {
      table: "hr_employees",
      column: "has_paye",
      sql: "ALTER TABLE hr_employees ADD COLUMN has_paye TINYINT(1) NOT NULL DEFAULT 0",
    },
    {
      table: "hr_employees",
      column: "has_ssnit",
      sql: "ALTER TABLE hr_employees ADD COLUMN has_ssnit TINYINT(1) NOT NULL DEFAULT 0",
    },
    {
      table: "hr_employees",
      column: "has_tier3",
      sql: "ALTER TABLE hr_employees ADD COLUMN has_tier3 TINYINT(1) NOT NULL DEFAULT 0",
    },
    {
      table: "hr_employees",
      column: "has_transport_allowance",
      sql: "ALTER TABLE hr_employees ADD COLUMN has_transport_allowance TINYINT(1) NOT NULL DEFAULT 0",
    },
    {
      table: "hr_employees",
      column: "has_wardrobe_allowance",
      sql: "ALTER TABLE hr_employees ADD COLUMN has_wardrobe_allowance TINYINT(1) NOT NULL DEFAULT 0",
    },
    {
      table: "hr_employees",
      column: "tax_mappings",
      sql: "ALTER TABLE hr_employees ADD COLUMN tax_mappings JSON NULL",
    },
    {
      table: "hr_employees",
      column: "allowance_mappings",
      sql: "ALTER TABLE hr_employees ADD COLUMN allowance_mappings JSON NULL",
    },
    {
      table: "hr_positions",
      column: "reports_to_pos_id",
      sql: "ALTER TABLE hr_positions ADD COLUMN reports_to_pos_id BIGINT UNSIGNED NULL AFTER dept_id",
    },
    {
      table: "hr_promotions",
      column: "new_location_id",
      sql: "ALTER TABLE hr_promotions ADD COLUMN new_location_id BIGINT UNSIGNED NULL AFTER new_pos_id",
    },
    {
      table: "hr_employees",
      column: "city",
      sql: "ALTER TABLE hr_employees ADD COLUMN city VARCHAR(100) NULL",
    },
    {
      table: "hr_employees",
      column: "state",
      sql: "ALTER TABLE hr_employees ADD COLUMN state VARCHAR(100) NULL",
    },
    {
      table: "hr_employees",
      column: "country",
      sql: "ALTER TABLE hr_employees ADD COLUMN country VARCHAR(100) NULL",
    },
    {
      table: "hr_employees",
      column: "emergency_contact_name",
      sql: "ALTER TABLE hr_employees ADD COLUMN emergency_contact_name VARCHAR(150) NULL",
    },
    {
      table: "hr_employees",
      column: "emergency_contact_phone",
      sql: "ALTER TABLE hr_employees ADD COLUMN emergency_contact_phone VARCHAR(50) NULL",
    },
    {
      table: "hr_employees",
      column: "bank_name",
      sql: "ALTER TABLE hr_employees ADD COLUMN bank_name VARCHAR(150) NULL",
    },
    {
      table: "hr_employees",
      column: "bank_account_number",
      sql: "ALTER TABLE hr_employees ADD COLUMN bank_account_number VARCHAR(100) NULL",
    },
    {
      table: "hr_employees",
      column: "ssnit_number",
      sql: "ALTER TABLE hr_employees ADD COLUMN ssnit_number VARCHAR(100) NULL",
    },
    {
      table: "hr_payslips",
      column: "basic_salary",
      sql: "ALTER TABLE hr_payslips ADD COLUMN basic_salary DECIMAL(18,4) NOT NULL DEFAULT 0",
    },
    {
      table: "hr_payslips",
      column: "allowances",
      sql: "ALTER TABLE hr_payslips ADD COLUMN allowances DECIMAL(18,4) NOT NULL DEFAULT 0",
    },
    {
      table: "hr_payslips",
      column: "deductions",
      sql: "ALTER TABLE hr_payslips ADD COLUMN deductions DECIMAL(18,4) NOT NULL DEFAULT 0",
    },
    {
      table: "hr_payslips",
      column: "net_salary",
      sql: "ALTER TABLE hr_payslips ADD COLUMN net_salary DECIMAL(18,4) NOT NULL DEFAULT 0",
    },
    {
      table: "hr_employee_base_salaries",
      column: "id",
      sql: "ALTER TABLE hr_employee_base_salaries DROP PRIMARY KEY, ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST, ADD PRIMARY KEY (id)",
    },
    {
      table: "hr_employee_base_salaries",
      column: "company_id",
      sql: "ALTER TABLE hr_employee_base_salaries ADD COLUMN company_id BIGINT UNSIGNED NOT NULL AFTER id",
    },
    {
      table: "hr_employee_base_salaries",
      column: "created_by",
      sql: "ALTER TABLE hr_employee_base_salaries ADD COLUMN created_by BIGINT UNSIGNED NULL",
    },
    {
      table: "hr_employee_base_salaries",
      column: "created_at",
      sql: "ALTER TABLE hr_employee_base_salaries ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
  ];

  for (const check of columnChecks) {
    try {
      // eslint-disable-next-line no-await-in-loop
      // For metadata like SHOW COLUMNS, it's safer to avoid placeholders in some MySQL versions
      const cols = await query(
        `SHOW COLUMNS FROM ${check.table} LIKE '${check.column}'`,
      );
      if (cols.length === 0) {
        // eslint-disable-next-line no-await-in-loop
        await query(check.sql);
      }
    } catch (err) {
      // ignore
    }
  }
  if (!(await hasColumn("hr_leave_requests", "source"))) {
    try {
      await query(
        `ALTER TABLE hr_leave_requests ADD COLUMN source ENUM('APPLICATION','SCHEDULE','ROSTER') NOT NULL DEFAULT 'APPLICATION'`,
      );
      await query(
        `ALTER TABLE hr_leave_requests MODIFY COLUMN status ENUM('DRAFT','PENDING','APPROVED','REJECTED','CANCELLED','SUBMITTED','SCHEDULED','ACTIVE','OVERRIDDEN') NOT NULL DEFAULT 'ACTIVE'`,
      );
    } catch {}
  }

  // --- Performance & Training Tables ---
  const perfTrainingTables = [
    `CREATE TABLE IF NOT EXISTS hr_kpi_categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_kpi_cat_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_kpi_assignments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      kpi_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NULL,
      dept_id BIGINT UNSIGNED NULL,
      pos_id BIGINT UNSIGNED NULL,
      assignment_type ENUM('EMPLOYEE','DEPARTMENT','POSITION','BRANCH','TEAM') NOT NULL DEFAULT 'EMPLOYEE',
      weight DECIMAL(5,2) NOT NULL DEFAULT 0,
      target_value DECIMAL(12,2) NULL,
      scoring_method ENUM('MANUAL','AUTO','WEIGHTED') NOT NULL DEFAULT 'MANUAL',
      effective_date DATE NULL,
      expiry_date DATE NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_kpi_assign_kpi (kpi_id),
      KEY idx_kpi_assign_emp (employee_id),
      KEY idx_kpi_assign_dept (dept_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_appraisals (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      reviewer_user_id BIGINT UNSIGNED NULL,
      review_period VARCHAR(100) NOT NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      kpi_score DECIMAL(5,2) NULL,
      competency_score DECIMAL(5,2) NULL,
      overall_score DECIMAL(5,2) NULL,
      status ENUM('DRAFT','PENDING_EMPLOYEE','PENDING_SUPERVISOR','PENDING_HR','APPROVED','REJECTED','CLOSED') NOT NULL DEFAULT 'DRAFT',
      employee_remarks TEXT NULL,
      manager_remarks TEXT NULL,
      hr_remarks TEXT NULL,
      recommend_promotion TINYINT(1) NOT NULL DEFAULT 0,
      recommend_increment DECIMAL(5,2) NULL,
      recommend_training TEXT NULL,
      submitted_at DATETIME NULL,
      supervisor_approved_at DATETIME NULL,
      hr_approved_at DATETIME NULL,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_appr_emp (employee_id),
      KEY idx_appr_company (company_id),
      KEY idx_appr_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_appraisal_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      appraisal_id BIGINT UNSIGNED NOT NULL,
      kpi_id BIGINT UNSIGNED NOT NULL,
      target_value DECIMAL(12,2) NULL,
      actual_value DECIMAL(12,2) NULL,
      weight DECIMAL(5,2) NOT NULL DEFAULT 0,
      rating DECIMAL(5,2) NULL,
      score DECIMAL(5,2) NULL,
      achievement_pct DECIMAL(5,2) NULL,
      manager_remarks TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_appr_detail_appr (appraisal_id),
      KEY idx_appr_detail_kpi (kpi_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_competency_scores (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      appraisal_id BIGINT UNSIGNED NOT NULL,
      competency_name VARCHAR(100) NOT NULL,
      rating INT NOT NULL DEFAULT 0,
      remarks TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_comp_appr (appraisal_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_goal_tracking (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      appraisal_id BIGINT UNSIGNED NOT NULL,
      goal_name VARCHAR(255) NOT NULL,
      completion_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
      remarks TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_goal_appr (appraisal_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_training_programs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      code VARCHAR(30) NOT NULL,
      name VARCHAR(200) NOT NULL,
      category VARCHAR(100) NULL,
      description TEXT NULL,
      training_type ENUM('INTERNAL','EXTERNAL','ONLINE','CERTIFICATION','WORKSHOP','SEMINAR') NOT NULL DEFAULT 'INTERNAL',
      trainer VARCHAR(200) NULL,
      vendor VARCHAR(200) NULL,
      venue VARCHAR(255) NULL,
      training_mode VARCHAR(50) NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      cost DECIMAL(12,2) NOT NULL DEFAULT 0,
      capacity INT NOT NULL DEFAULT 0,
      dept_id BIGINT UNSIGNED NULL,
      required_skills TEXT NULL,
      attachment_url TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_tp_code (company_id, code),
      KEY idx_tp_dept (dept_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_training_assignments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      program_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      assigned_by BIGINT UNSIGNED NULL,
      status ENUM('ASSIGNED','CONFIRMED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'ASSIGNED',
      score DECIMAL(5,2) NULL,
      feedback TEXT NULL,
      assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME NULL,
      completed_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_ta_prog (program_id),
      KEY idx_ta_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_training_attendance (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      assignment_id BIGINT UNSIGNED NOT NULL,
      session_date DATE NOT NULL,
      present TINYINT(1) NOT NULL DEFAULT 0,
      hours_attended DECIMAL(5,2) NULL,
      remarks TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ta_assign (assignment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_certifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      employee_id BIGINT UNSIGNED NOT NULL,
      training_program_id BIGINT UNSIGNED NULL,
      cert_name VARCHAR(255) NOT NULL,
      issued_by VARCHAR(200) NULL,
      issue_date DATE NULL,
      expiry_date DATE NULL,
      cert_url TEXT NULL,
      cert_number VARCHAR(100) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_cert_emp (employee_id),
      KEY idx_cert_expiry (expiry_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS hr_appraisal_workflow_log (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      appraisal_id BIGINT UNSIGNED NOT NULL,
      action ENUM('SUBMIT','APPROVE','REJECT','SEND_BACK','FORWARD','ESCALATE') NOT NULL,
      actor_user_id BIGINT UNSIGNED NULL,
      comments TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_awl_appr (appraisal_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];

  for (const sql of perfTrainingTables) {
    try {
      await query(sql);
    } catch (err) {
      console.error("Error creating performance/training table:", err);
    }
  }
}

export async function ensureWorkflowTables() {
  if (verifiedTables.has("adm_workflows")) return;
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflows (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_code VARCHAR(50) NOT NULL,
      workflow_name VARCHAR(150) NOT NULL,
      module_key VARCHAR(50) NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      document_route VARCHAR(255) DEFAULT NULL,
      min_amount DECIMAL(18,2) DEFAULT NULL,
      max_amount DECIMAL(18,2) DEFAULT NULL,
      default_behavior VARCHAR(20) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_workflow_company_code (company_id, workflow_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_step_approvers (
      workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      approver_user_id BIGINT UNSIGNED NOT NULL,
      approval_limit DECIMAL(15,2) DEFAULT NULL,
      PRIMARY KEY (workflow_id, step_order, approver_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  if (!(await hasColumn("adm_workflows", "document_route"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN document_route VARCHAR(255) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "min_amount"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN min_amount DECIMAL(18,2) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "max_amount"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN max_amount DECIMAL(18,2) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "default_behavior"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN default_behavior VARCHAR(20) DEFAULT NULL`,
    );
  }
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_steps (
      workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      step_name VARCHAR(150) NOT NULL,
      approver_user_id BIGINT UNSIGNED NOT NULL,
      approver_role_id BIGINT UNSIGNED DEFAULT NULL,
      min_amount DECIMAL(18,2) DEFAULT NULL,
      max_amount DECIMAL(18,2) DEFAULT NULL,
      approval_limit DECIMAL(15,2) DEFAULT NULL,
      is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (workflow_id, step_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_document_workflows (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_id BIGINT UNSIGNED NOT NULL,
      document_id BIGINT UNSIGNED NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      amount DECIMAL(15,2) DEFAULT 0.00,
      current_step_order INT NOT NULL DEFAULT 1,
      status ENUM('PENDING','APPROVED','REJECTED','RETURNED') NOT NULL DEFAULT 'PENDING',
      assigned_to_user_id BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_doc_workflow_lookup (document_id, document_type),
      KEY idx_doc_workflow_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      document_workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      actor_user_id BIGINT UNSIGNED NOT NULL,
      comments VARCHAR(255),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_wf_logs_dw (document_workflow_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      link VARCHAR(255),
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_notif_user (user_id, is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_tasks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_id BIGINT UNSIGNED NOT NULL,
      document_workflow_id BIGINT UNSIGNED NOT NULL,
      document_id BIGINT UNSIGNED NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      step_order INT NOT NULL,
      assigned_to_user_id BIGINT UNSIGNED NOT NULL,
      action ENUM('PENDING','APPROVED','REJECTED','RETURNED') NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_wf_task_lookup (document_workflow_id, step_order),
      KEY idx_wf_task_assignee (assigned_to_user_id, action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  verifiedTables.add("adm_workflows");
}

export async function ensurePushTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_push_subscriptions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      endpoint VARCHAR(500) NOT NULL,
      p256dh VARCHAR(255) NOT NULL,
      auth VARCHAR(100) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_active_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_endpoint (endpoint),
      KEY idx_user (user_id),
      KEY idx_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  if (!(await hasColumn("adm_push_subscriptions", "company_id"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN company_id BIGINT UNSIGNED NOT NULL DEFAULT 1",
    );
  }
  if (!(await hasColumn("adm_push_subscriptions", "branch_id"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1",
    );
  }
  if (!(await hasColumn("adm_push_subscriptions", "user_id"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN user_id BIGINT UNSIGNED NOT NULL DEFAULT 0",
    );
  }
  if (!(await hasColumn("adm_push_subscriptions", "is_active"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1",
    );
  }
  if (!(await hasColumn("adm_push_subscriptions", "created_at"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    );
  }
  if (!(await hasColumn("adm_push_subscriptions", "last_active_at"))) {
    await query(
      "ALTER TABLE adm_push_subscriptions ADD COLUMN last_active_at TIMESTAMP NULL",
    );
  }
}

export async function ensureSalesOrderColumns() {
  // Ensure columns used by Sales Orders exist to prevent runtime SQL errors
  const orders = "sal_orders";
  if (verifiedTables.has(orders)) return;
  if (!(await hasColumn(orders, "status"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'`,
    ).catch(() => null);
  }
  if (!(await hasColumn(orders, "priority"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'`,
    ).catch(() => null);
  }
  if (!(await hasColumn(orders, "sub_total"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN sub_total DECIMAL(18,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orders, "tax_amount"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN tax_amount DECIMAL(18,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orders, "currency_id"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN currency_id BIGINT UNSIGNED DEFAULT 4`,
    );
  }
  if (!(await hasColumn(orders, "exchange_rate"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN exchange_rate DECIMAL(18,6) DEFAULT 1`,
    );
  }
  if (!(await hasColumn(orders, "price_type"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN price_type ENUM('WHOLESALE','RETAIL') DEFAULT 'RETAIL'`,
    );
  }
  if (!(await hasColumn(orders, "payment_type"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN payment_type ENUM('CASH','CHEQUE','CREDIT') DEFAULT 'CASH'`,
    );
  }
  if (!(await hasColumn(orders, "warehouse_id"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN warehouse_id BIGINT UNSIGNED NULL`,
    );
  }
  if (!(await hasColumn(orders, "quotation_id"))) {
    await query(
      `ALTER TABLE ${orders} ADD COLUMN quotation_id BIGINT UNSIGNED NULL`,
    );
  }
  if (!(await hasColumn(orders, "remarks"))) {
    await query(`ALTER TABLE ${orders} ADD COLUMN remarks VARCHAR(500) NULL`);
  }
  if (!(await hasColumn(orders, "payment_date"))) {
    await query(`ALTER TABLE ${orders} ADD COLUMN payment_date DATE NULL`);
  }

  const orderDetails = "sal_order_details";
  if (!(await hasColumn(orderDetails, "qty"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN qty DECIMAL(18,4) NOT NULL DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "unit_price"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN unit_price DECIMAL(18,4) NOT NULL DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "discount_percent"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "total_amount"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN total_amount DECIMAL(18,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "net_amount"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN net_amount DECIMAL(18,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "tax_amount"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN tax_amount DECIMAL(18,2) DEFAULT 0`,
    );
  }
  if (!(await hasColumn(orderDetails, "uom"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN uom VARCHAR(50) DEFAULT 'PCS'`,
    );
  }
  if (!(await hasColumn(orderDetails, "tax_code_id"))) {
    await query(
      `ALTER TABLE ${orderDetails} ADD COLUMN tax_code_id BIGINT UNSIGNED NULL`,
    );
  }
  verifiedTables.add(orders).add(orderDetails);
}

export async function ensureRoleModulesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_role_modules (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      role_id BIGINT UNSIGNED NOT NULL,
      module_key VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_role_module (role_id, module_key),
      KEY idx_rm_role (role_id),
      KEY idx_rm_module (module_key),
      FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureRolePermissionsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_role_permissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      role_id BIGINT UNSIGNED NOT NULL,
      module_key VARCHAR(100) NOT NULL,
      feature_key VARCHAR(100) NOT NULL,
      can_view TINYINT(1) DEFAULT 0,
      can_create TINYINT(1) DEFAULT 0,
      can_edit TINYINT(1) DEFAULT 0,
      can_delete TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_role_module_feature (role_id, module_key, feature_key),
      KEY idx_rp_role (role_id),
      KEY idx_rp_module (module_key),
      FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  if (!(await hasColumn("adm_role_permissions", "feature_key"))) {
    try {
      await query(
        `ALTER TABLE adm_role_permissions ADD COLUMN feature_key VARCHAR(100) NOT NULL AFTER module_key`,
      );
      await query(
        `ALTER TABLE adm_role_permissions DROP INDEX uq_role_module_perm`,
      );
      await query(
        `ALTER TABLE adm_role_permissions ADD UNIQUE KEY uq_role_module_feature (role_id, module_key, feature_key)`,
      );
    } catch (err) {
      console.error("Error upgrading adm_role_permissions table:", err);
    }
  }
}

export async function ensureRoleFeaturesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_role_features (
      role_id BIGINT UNSIGNED NOT NULL,
      feature_key VARCHAR(150) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, feature_key),
      INDEX idx_role_id (role_id),
      INDEX idx_feature_key (feature_key),
      FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureTemplateTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS document_templates (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(150) NOT NULL,
      document_type VARCHAR(50) NOT NULL,
      html_content MEDIUMTEXT NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      KEY idx_company_type (company_id, document_type),
      KEY idx_company_branch (company_id, branch_id),
      KEY idx_default (company_id, document_type, is_default)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Ensure document_templates exists
  await query(`
    CREATE TABLE IF NOT EXISTS document_templates (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(150) NOT NULL,
      document_type VARCHAR(50) NOT NULL,
      html_content MEDIUMTEXT NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      KEY idx_company_type (company_id, document_type),
      KEY idx_company_branch (company_id, branch_id),
      KEY idx_default (company_id, document_type, is_default)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);


  if (!(await hasColumn("document_templates", "header_logo_url"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_logo_url VARCHAR(500) NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_name"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_name VARCHAR(255) NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_address"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_address TEXT NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_address2"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_address2 TEXT NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_phone"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_phone VARCHAR(50) NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_email"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_email VARCHAR(255) NULL",
    );
  }
  if (!(await hasColumn("document_templates", "header_website"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN header_website VARCHAR(255) NULL",
    );
  }
  if (!(await hasColumn("document_templates", "branch_id"))) {
    await query(
      "ALTER TABLE document_templates ADD COLUMN branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1",
    );
  }
  await ensureCol("document_templates", "feature_names", "TEXT NULL");
}

export async function ensurePMOrderTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS pm_orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      order_no VARCHAR(50) NOT NULL,
      order_date DATE NOT NULL,
      project_id BIGINT UNSIGNED NULL,
      project_name VARCHAR(255) NULL,
      priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      sub_total DECIMAL(18,2) DEFAULT 0,
      tax_amount DECIMAL(18,2) DEFAULT 0,
      total_amount DECIMAL(18,2) DEFAULT 0,
      currency_id BIGINT UNSIGNED DEFAULT 4,
      exchange_rate DECIMAL(18,6) DEFAULT 1,
      price_type ENUM('WHOLESALE','RETAIL') DEFAULT 'RETAIL',
      payment_type ENUM('CASH','CHEQUE','CREDIT') DEFAULT 'CASH',
      warehouse_id BIGINT UNSIGNED NULL,
      remarks TEXT NULL,
      is_active ENUM('Y','N') NOT NULL DEFAULT 'Y',
      deleted_at DATETIME NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pm_order_scope_no (company_id, branch_id, order_no),
      KEY idx_pm_order_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);

  await query(`
    CREATE TABLE IF NOT EXISTS pm_order_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty DECIMAL(18,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      discount_percent DECIMAL(5,2) DEFAULT 0,
      total_amount DECIMAL(18,2) DEFAULT 0,
      net_amount DECIMAL(18,2) DEFAULT 0,
      tax_amount DECIMAL(18,2) DEFAULT 0,
      uom VARCHAR(50) DEFAULT 'PCS',
      tax_code_id BIGINT UNSIGNED NULL,
      PRIMARY KEY (id),
      KEY idx_pm_order_items_order (order_id),
      KEY idx_pm_order_items_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);

  const orders = "pm_orders";
  const ensureCol = async (col, ddl) => {
    if (!(await hasColumn(orders, col))) {
      await query(`ALTER TABLE ${orders} ADD COLUMN ${ddl}`).catch(() => null);
    }
  };
  await ensureCol("priority", "VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'");
  await ensureCol("sub_total", "DECIMAL(18,2) DEFAULT 0");
  await ensureCol("tax_amount", "DECIMAL(18,2) DEFAULT 0");
  await ensureCol("currency_id", "BIGINT UNSIGNED DEFAULT 4");
  await ensureCol("exchange_rate", "DECIMAL(18,6) DEFAULT 1");
  await ensureCol("price_type", "ENUM('WHOLESALE','RETAIL') DEFAULT 'RETAIL'");
  await ensureCol("payment_type", "ENUM('CASH','CHEQUE','CREDIT') DEFAULT 'CASH'");
  await ensureCol("warehouse_id", "BIGINT UNSIGNED NULL");
  await ensureCol("remarks", "TEXT NULL");
  await ensureCol("is_active", "ENUM('Y','N') NOT NULL DEFAULT 'Y'");
  await ensureCol("deleted_at", "DATETIME NULL");
  await ensureCol("created_by", "BIGINT UNSIGNED NULL");

  const orderItems = "pm_order_items";
  const ensureItemCol = async (col, ddl) => {
    if (!(await hasColumn(orderItems, col))) {
      await query(`ALTER TABLE ${orderItems} ADD COLUMN ${ddl}`).catch(() => null);
    }
  };
  await ensureItemCol("qty", "DECIMAL(18,4) NOT NULL DEFAULT 0");
  await ensureItemCol("unit_price", "DECIMAL(18,4) NOT NULL DEFAULT 0");
  await ensureItemCol("discount_percent", "DECIMAL(5,2) DEFAULT 0");
  await ensureItemCol("total_amount", "DECIMAL(18,2) DEFAULT 0");
  await ensureItemCol("net_amount", "DECIMAL(18,2) DEFAULT 0");
  await ensureItemCol("tax_amount", "DECIMAL(18,2) DEFAULT 0");
  await ensureItemCol("uom", "VARCHAR(50) DEFAULT 'PCS'");
  await ensureItemCol("tax_code_id", "BIGINT UNSIGNED NULL");
}

export async function ensurePMPurchaseRequisitionTables() {
  const t = "pm_purchase_requisitions";
  if (!(await hasTable(t))) {
    await query(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        requisition_no VARCHAR(50) NOT NULL,
        requisition_date DATE NOT NULL,
        project_id BIGINT UNSIGNED NULL,
        project_name VARCHAR(255) NULL,
        department VARCHAR(100) NULL,
        requested_by VARCHAR(150) NULL,
        purpose TEXT NULL,
        priority ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
        required_date DATE NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
        remarks TEXT NULL,
        is_active ENUM('Y','N') NOT NULL DEFAULT 'Y',
        deleted_at DATETIME NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_pm_pr_scope_no (company_id, branch_id, requisition_no),
        KEY idx_pm_pr_scope (company_id, branch_id),
        KEY idx_pm_pr_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  }
  const ensureCol2 = async (col, ddl) => {
    if (!(await hasColumn(t, col))) {
      await query(`ALTER TABLE ${t} ADD COLUMN ${ddl}`).catch(() => null);
    }
  };
  await ensureCol2("is_active", "ENUM('Y','N') NOT NULL DEFAULT 'Y'");
  await ensureCol2("deleted_at", "DATETIME NULL");
  await ensureCol2("project_id", "BIGINT UNSIGNED NULL");
  await ensureCol2("project_name", "VARCHAR(255) NULL");
  await ensureCol2("timeline", "VARCHAR(255) NULL");

  const ti = "pm_purchase_requisition_items";
  if (!(await hasTable(ti))) {
    await query(`
      CREATE TABLE IF NOT EXISTS ${ti} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        requisition_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NULL,
        description VARCHAR(255) NOT NULL,
        qty DECIMAL(18,3) NOT NULL DEFAULT 0,
        uom VARCHAR(20) NULL,
        estimated_unit_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
        estimated_total DECIMAL(18,2) NOT NULL DEFAULT 0,
        remarks VARCHAR(255) NULL,
        PRIMARY KEY (id),
        KEY idx_pm_pri_req (requisition_id),
        CONSTRAINT fk_pm_pri_req FOREIGN KEY (requisition_id) REFERENCES ${t}(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  }
}

export async function ensurePMQuotationTables() {
  const t = "prj_quotations";
  if (!(await hasTable(t))) {
    await query(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        quotation_no VARCHAR(50) NOT NULL,
        quotation_date DATE NOT NULL,
        project_id BIGINT UNSIGNED NULL,
        project_name VARCHAR(255) NULL,
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
        remarks TEXT NULL,
        terms_and_conditions TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_prj_quotation_scope_no (company_id, branch_id, quotation_no),
        KEY idx_prj_quotation_scope (company_id, branch_id),
        KEY idx_prj_quotation_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  }

  const ensureCol = async (col, ddl) => {
    if (!(await hasColumn(t, col))) {
      await query(`ALTER TABLE ${t} ADD COLUMN ${ddl}`).catch(() => null);
    }
  };
  await ensureCol("project_id", "BIGINT UNSIGNED NULL");
  await ensureCol("project_name", "VARCHAR(255) NULL");

  const ti = "prj_quotation_details";
  if (!(await hasTable(ti))) {
    await query(`
      CREATE TABLE IF NOT EXISTS ${ti} (
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
        KEY idx_prj_qd_q (quotation_id),
        KEY idx_prj_qd_item (item_id),
        CONSTRAINT fk_prj_qd_q FOREIGN KEY (quotation_id) REFERENCES ${t}(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  }
}

export async function ensurePMInvoiceTables() {
  const t = "prj_invoices";
  if (!(await hasTable(t))) {
    await query(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        invoice_no VARCHAR(50) NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE NULL,
        project_id BIGINT UNSIGNED NULL,
        project_name VARCHAR(255) NULL,
        customer_id BIGINT UNSIGNED NULL,
        customer_name VARCHAR(255) NULL,
        customer_address VARCHAR(255) NULL,
        customer_city VARCHAR(100) NULL,
        customer_state VARCHAR(100) NULL,
        customer_country VARCHAR(100) NULL,
        total_amount DECIMAL(18,2) DEFAULT 0,
        net_amount DECIMAL(18,2) DEFAULT 0,
        tax_amount DECIMAL(18,2) DEFAULT 0,
        amount_paid DECIMAL(18,2) DEFAULT 0,
        balance DECIMAL(18,2) DEFAULT 0,
        status VARCHAR(30) DEFAULT 'DRAFT',
        payment_status ENUM('UNPAID','PARTIAL','PAID') DEFAULT 'UNPAID',
        currency_id BIGINT UNSIGNED DEFAULT 4,
        exchange_rate DECIMAL(18,6) DEFAULT 1,
        remarks TEXT NULL,
        terms_and_conditions TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_prj_inv_scope_no (company_id, branch_id, invoice_no),
        KEY idx_prj_inv_scope (company_id, branch_id),
        KEY idx_prj_inv_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  }
  
  const ensureCol = async (col, ddl) => {
    if (!(await hasColumn(t, col))) {
      await query(`ALTER TABLE ${t} ADD COLUMN ${ddl}`).catch(() => null);
    }
  };
  await ensureCol("project_id", "BIGINT UNSIGNED NULL");
  await ensureCol("project_name", "VARCHAR(255) NULL");

  const ti = "prj_invoice_details";
  if (!(await hasTable(ti))) {
    await query(`
      CREATE TABLE IF NOT EXISTS ${ti} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        invoice_id BIGINT UNSIGNED NOT NULL,
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
        KEY idx_prj_id_i (invoice_id),
        KEY idx_prj_id_item (item_id),
        CONSTRAINT fk_prj_id_i FOREIGN KEY (invoice_id) REFERENCES ${t}(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  }
}

/**
 * Ensure social feed tables exist with correct schema.
 * Handles the warehouse_id → branch_id migration automatically.
 */
export async function ensureSocialFeedTables() {
  // 1. posts table
  if (!(await hasTable("posts"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        content LONGTEXT NOT NULL,
        image_url VARCHAR(500),
        visibility_type ENUM('company', 'branch', 'warehouse') NOT NULL DEFAULT 'company',
        branch_id INT DEFAULT NULL,
        warehouse_id INT DEFAULT NULL,
        like_count INT DEFAULT 0,
        comment_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_posts_visibility (visibility_type),
        INDEX idx_posts_branch (branch_id),
        INDEX idx_posts_user (user_id),
        INDEX idx_posts_created_at (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  } else {
    // Add branch_id if missing (older schema only has warehouse_id)
    if (!(await hasColumn("posts", "branch_id"))) {
      await query("ALTER TABLE posts ADD COLUMN branch_id INT DEFAULT NULL").catch(() => null);
    }
    // Add warehouse_id if missing
    if (!(await hasColumn("posts", "warehouse_id"))) {
      await query("ALTER TABLE posts ADD COLUMN warehouse_id INT DEFAULT NULL").catch(() => null);
    }
    // Expand visibility_type enum to include 'branch' and 'warehouse'
    await query(`
      ALTER TABLE posts MODIFY COLUMN visibility_type ENUM('company', 'branch', 'warehouse') NOT NULL DEFAULT 'company'
    `).catch(() => null);
  }

  // 2. post_likes table
  if (!(await hasTable("post_likes"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_post_like (post_id, user_id),
        INDEX idx_likes_post (post_id),
        INDEX idx_likes_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  }

  // 3. post_comments table
  if (!(await hasTable("post_comments"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        comment_text LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_comments_post (post_id),
        INDEX idx_comments_user (user_id),
        INDEX idx_comments_created (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  }
}

/**
 * Ensure core transport module tables exist with all required columns.
 * Creates tables from scratch if missing, then adds any missing columns.
 */
export async function ensureTransportTables() {
  const ec = async (table, col, ddl) => {
    if (!(await hasColumn(table, col))) {
      await query(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`).catch(() => null);
    }
  };

  // trans_vehicles
  if (!(await hasTable("trans_vehicles"))) {
    await query(`
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
        status ENUM('AVAILABLE','ON_TRIP','MAINTENANCE','RETIRED') NOT NULL DEFAULT 'AVAILABLE',
        insurance_expiry DATE NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_vehicle_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  }

  // trans_drivers – also needs employee_name for JOIN-free queries
  if (!(await hasTable("trans_drivers"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS trans_drivers (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        employee_id BIGINT UNSIGNED NOT NULL,
        employee_name VARCHAR(255) NULL,
        license_number VARCHAR(100) NOT NULL,
        license_type VARCHAR(50) NOT NULL,
        license_expiry DATE NOT NULL,
        status ENUM('AVAILABLE','ON_TRIP','ON_LEAVE','SUSPENDED') NOT NULL DEFAULT 'AVAILABLE',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  } else {
    await ec("trans_drivers", "employee_name", "VARCHAR(255) NULL");
  }

  // trans_trips
  if (!(await hasTable("trans_trips"))) {
    await query(`
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
        status ENUM('SCHEDULED','STARTED','IN_TRANSIT','COMPLETED','CANCELLED','DELAYED') NOT NULL DEFAULT 'SCHEDULED',
        tracking_status VARCHAR(50) DEFAULT 'PENDING',
        pod_signature_url VARCHAR(255) DEFAULT NULL,
        pod_photo_url VARCHAR(255) DEFAULT NULL,
        pod_notes TEXT DEFAULT NULL,
        pod_timestamp DATETIME DEFAULT NULL,
        remarks TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_trip_vehicle (vehicle_id),
        KEY idx_trip_driver (driver_id),
        KEY idx_trip_status (status),
        KEY idx_trip_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  } else {
    // Add columns added by later migrations
    await ec("trans_trips", "tracking_status", "VARCHAR(50) DEFAULT 'PENDING' AFTER status");
    await ec("trans_trips", "origin_name", "VARCHAR(255) NULL");
    await ec("trans_trips", "origin_lat", "DECIMAL(10,8) NULL");
    await ec("trans_trips", "origin_lng", "DECIMAL(11,8) NULL");
    await ec("trans_trips", "destination_name", "VARCHAR(255) NULL");
    await ec("trans_trips", "destination_lat", "DECIMAL(10,8) NULL");
    await ec("trans_trips", "destination_lng", "DECIMAL(11,8) NULL");
    await ec("trans_trips", "pod_signature_url", "VARCHAR(255) DEFAULT NULL");
    await ec("trans_trips", "pod_photo_url", "VARCHAR(255) DEFAULT NULL");
    await ec("trans_trips", "pod_notes", "TEXT DEFAULT NULL");
    await ec("trans_trips", "pod_timestamp", "DATETIME DEFAULT NULL");
    await ec("trans_trips", "trip_date", "DATE NULL");
    // Expand status enum to include STARTED and DELAYED
    await query(`
      ALTER TABLE trans_trips 
      MODIFY COLUMN status ENUM('SCHEDULED','STARTED','IN_TRANSIT','COMPLETED','CANCELLED','DELAYED') NOT NULL DEFAULT 'SCHEDULED'
    `).catch(() => null);
  }

  // trans_trip_locations
  if (!(await hasTable("trans_trip_locations"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS trans_trip_locations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        trip_id BIGINT UNSIGNED NOT NULL,
        vehicle_id BIGINT UNSIGNED NULL,
        driver_id BIGINT UNSIGNED NULL,
        latitude DECIMAL(10,8) NOT NULL,
        longitude DECIMAL(11,8) NOT NULL,
        heading DECIMAL(5,2) DEFAULT 0,
        speed DECIMAL(5,2) DEFAULT 0,
        accuracy DECIMAL(8,2) DEFAULT NULL,
        altitude DECIMAL(8,2) DEFAULT NULL,
        battery_level DECIMAL(5,2) DEFAULT NULL,
        is_offline_point BOOLEAN DEFAULT FALSE,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_loc_trip (trip_id),
        KEY idx_loc_recorded (recorded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => null);
  }
}

/**
 * Ensure core finance tax tables exist with all required columns.
 * Creates fin_tax_codes, fin_tax_details, and fin_tax_components if missing,
 * and adds any missing columns.
 */
export async function ensureTaxTables() {
  if (verifiedTables.has("fin_tax_tables")) return;

  // 1. fin_tax_codes table
  await query(`
    CREATE TABLE IF NOT EXISTS fin_tax_codes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      rate_percent DECIMAL(9,4) NOT NULL DEFAULT 0,
      type VARCHAR(50) NOT NULL DEFAULT 'TAX',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_sales_tax TINYINT(1) NOT NULL DEFAULT 0,
      is_purchase_tax TINYINT(1) NOT NULL DEFAULT 0,
      is_service_tax TINYINT(1) NOT NULL DEFAULT 0,
      valid_pages VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_tax_code_company (company_id, code),
      KEY idx_tax_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);

  // Guarantee columns exist and type allows DEDUCTION without ENUM truncation
  await query(`ALTER TABLE fin_tax_codes ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'TAX'`).catch(() => {});
  await query(`ALTER TABLE fin_tax_codes MODIFY COLUMN type VARCHAR(50) NOT NULL DEFAULT 'TAX'`).catch(() => {});
  await query(`ALTER TABLE fin_tax_codes ADD COLUMN rate_percent DECIMAL(9,4) NOT NULL DEFAULT 0`).catch(() => {});
  await query(`ALTER TABLE fin_tax_codes MODIFY COLUMN rate_percent DECIMAL(9,4) NOT NULL DEFAULT 0`).catch(() => {});
  await query(`ALTER TABLE fin_tax_codes ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`).catch(() => {});
  await query(`ALTER TABLE fin_tax_codes ADD COLUMN is_sales_tax TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {});
  await query(`ALTER TABLE fin_tax_codes ADD COLUMN is_purchase_tax TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {});
  await query(`ALTER TABLE fin_tax_codes ADD COLUMN is_service_tax TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {});
  await query(`ALTER TABLE fin_tax_codes ADD COLUMN valid_pages VARCHAR(255) NULL`).catch(() => {});
  await query(`ALTER TABLE fin_tax_codes ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
  await query(`ALTER TABLE fin_tax_codes ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).catch(() => {});

  // 2. fin_tax_details table
  await query(`
    CREATE TABLE IF NOT EXISTS fin_tax_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      tax_code_id BIGINT UNSIGNED NOT NULL,
      component_name VARCHAR(100) NOT NULL,
      rate_percent DECIMAL(9,4) NOT NULL DEFAULT 0,
      account_id BIGINT UNSIGNED NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_tax_detail_code (tax_code_id),
      KEY idx_tax_detail_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);

  await query(`ALTER TABLE fin_tax_details ADD COLUMN account_id BIGINT UNSIGNED NULL`).catch(() => {});
  await query(`ALTER TABLE fin_tax_details MODIFY COLUMN account_id BIGINT UNSIGNED NULL`).catch(() => {});
  await query(`ALTER TABLE fin_tax_details ADD COLUMN rate_percent DECIMAL(9,4) NOT NULL DEFAULT 0`).catch(() => {});
  await query(`ALTER TABLE fin_tax_details ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`).catch(() => {});
  await query(`ALTER TABLE fin_tax_details ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
  await query(`ALTER TABLE fin_tax_details ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).catch(() => {});

  // 3. fin_tax_components table
  await query(`
    CREATE TABLE IF NOT EXISTS fin_tax_components (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      tax_code_id BIGINT UNSIGNED NOT NULL,
      tax_detail_id BIGINT UNSIGNED NOT NULL,
      rate_percent DECIMAL(9,4) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      compound_level INT NULL DEFAULT 0,
      compound_levels VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_tax_components (company_id, tax_code_id, tax_detail_id),
      KEY idx_tc_tax_code (tax_code_id),
      KEY idx_tc_tax_detail (tax_detail_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);

  await query(`ALTER TABLE fin_tax_components ADD COLUMN rate_percent DECIMAL(9,4) NULL`).catch(() => {});
  await query(`ALTER TABLE fin_tax_components ADD COLUMN sort_order INT NOT NULL DEFAULT 0`).catch(() => {});
  await query(`ALTER TABLE fin_tax_components ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`).catch(() => {});
  await query(`ALTER TABLE fin_tax_components ADD COLUMN compound_level INT NULL DEFAULT 0`).catch(() => {});
  await query(`ALTER TABLE fin_tax_components ADD COLUMN compound_levels VARCHAR(255) NULL`).catch(() => {});
  await query(`ALTER TABLE fin_tax_components ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`).catch(() => {});

  verifiedTables.add("fin_tax_tables");
}

