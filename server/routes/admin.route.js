/**
 * @file admin.route.js
 * @description Routes for administrative functions, roles, permissions, branches, companies, and users.
 */
// Module Dependencies
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { setRuntimeApiKey } from "../services/ai/banks.service.js";
import { autoPostMidnightPosSalesToFinance } from "../services/posFinanceAutoPost.service.js";

// Controller Imports
import {
  logErrorController,
  updateExceptionalPermissionController,
  deleteExceptionalPermissionController,
  listPages,
  listExceptionalPermissions,
  getExceptionalPermissionById,
  createExceptionalPermission,
  getMe,
  getDashboardStats,
  getExceptionalPermissionsForUser,
  bulkUpsertExceptionalPermissionsForUser,
} from "../controllers/admin.controller.js";

// Authentication and Authorization Middlewares
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";

// Database Utilities and Error Handling
import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  ensureRoleModulesTable,
  ensureRolePermissionsTable,
  ensureRoleFeaturesTable,
  verifiedTables,
} from "../utils/dbUtils.js";
import { ensureUserPermissionCacheAndTriggers } from "../utils/dbUtils.js";
import {
  createBranch,
  getBranchById,
  getBranches,
  getCompanies,
  getCompanyById,
  getCompanyLogo,
  getDepartments,
  mangeCompanies,
  updateBranch,
  updateCompanies,
  updateDepartment,
  uploadCompanyLogo,
  getDepartmentById,
  createDepartment,
  getCurrentCompany,
} from "../controllers/companies.controller.js";
import {
  getUserRole,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
} from "../controllers/roles.controller.js";
import {
  getUsers,
  getUserById,
  getUserBranches,
  updateUserBranches,
  createUser,
  updateUser,
  patchUser,
  getUserPermissionsContext,
  saveUserPermissions,
  getUserAssignments,
  saveUserFeaturePermissions,
  getUserFeaturePermissionsContext,
  getUserFeaturePermissionsList,
} from "../controllers/users.controller.js";
import {
  getRoles as getRolesRbac,
  createRole as createRoleRbac,
  updateRole as updateRoleRbac,
  getRoleModules,
  saveRoleModules,
  getRolePermissions,
  saveRolePermissions,
  getRoleFeatures,
  saveRoleFeatures,
} from "../controllers/rbac.controller.js";
import { isMailerConfigured, sendMail } from "../utils/mailer.js";

const router = express.Router();

/**
 * Utility function to safely convert a value to a number.
 * Fallbacks to the provided default if the result is not finite.
 * @param {any} v - Value to convert.
 * @param {any} fallback - Default value if conversion fails.
 * @returns {number | any}
 */
function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Checks if a specific column exists within a given database table.
 * Used for dynamic schema migrations.
 * @param {string} tableName - Name of the table to check.
 * @param {string} columnName - Name of the column to search for.
 * @returns {Promise<boolean>} True if column exists, else false.
 */
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

/**
 * Normalizes an application module string by mapping common aliases
 * to a standardized module key (e.g., "admin" -> "administration").
 * @param {string} moduleKey - The raw module key string.
 * @returns {string} Normalized module key.
 */
function normalizeModuleKey(moduleKey) {
  const raw = String(moduleKey || "").trim().toLowerCase();
  if (!raw) return "";
  
  // Mapping of potential abbreviations to their standard names
  const aliases = {
    admin: "administration",
    administration: "administration",
    sales: "sales",
    sal: "sales",
    inventory: "inventory",
    inv: "inventory",
    purchase: "purchase",
    pur: "purchase",
    finance: "finance",
    fin: "finance",
    hr: "human-resources",
    "human-resources": "human-resources",
    humanresources: "human-resources",
    maintenance: "maintenance",
    maint: "maintenance",
    production: "production",
    prod: "production",
    projects: "project-management",
    project: "project-management",
    "project-management": "project-management",
    proj: "project-management",
    pos: "pos",
    bi: "business-intelligence",
    "business-intelligence": "business-intelligence",
    businessintelligence: "business-intelligence",
    service: "service-management",
    svc: "service-management",
    "service-management": "service-management",
  };
  return aliases[raw] || raw;
}

/**
 * Normalizes a feature key, ensuring it includes the appropriate module prefix.
 * e.g. "roles" with module "admin" -> "administration:roles".
 * @param {string} featureKey - The raw feature key string.
 * @param {string} moduleKey - The optional module prefix.
 * @returns {string} Normalized feature key.
 */
function normalizeFeatureKey(featureKey, moduleKey = "") {
  const rawFeatureKey = String(featureKey || "").trim();
  const normalizedModuleKey = normalizeModuleKey(moduleKey);
  if (!rawFeatureKey) return "";
  
  // If no prefix is provided in the feature key, append the normalized module key
  if (!rawFeatureKey.includes(":")) {
    return normalizedModuleKey
      ? `${normalizedModuleKey}:${rawFeatureKey.toLowerCase()}`
      : rawFeatureKey.toLowerCase();
  }
  const [featureModule, ...rest] = rawFeatureKey.split(":");
  const normalizedFeatureModule = normalizeModuleKey(featureModule);
  const suffix = rest.join(":").trim().toLowerCase();
  return suffix
    ? `${normalizedFeatureModule}:${suffix}`
    : normalizedFeatureModule;
}

// ===== System & Activity Tables =====
async function ensureSystemLogsTable() {
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
        name: "ip_address",
        ddl: "ALTER TABLE adm_system_logs ADD COLUMN ip_address VARCHAR(100) NULL AFTER branch_id",
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
      // Best-effort: backfill created_at from event_time
      await query(
        "UPDATE adm_system_logs SET created_at = event_time WHERE created_at IS NULL",
      );
    }
    try {
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
/**
 * Ensures the adm_login_logs table exists for tracking user login activity.
 */
async function ensureLoginLogsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_login_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NULL,
      username VARCHAR(150) NULL,
      company_id BIGINT UNSIGNED NULL,
      branch_id BIGINT UNSIGNED NULL,
      ip_address VARCHAR(100) NULL,
      user_agent VARCHAR(255) NULL,
      login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_login_time (login_time),
      KEY idx_login_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
/**
 * Ensures the adm_push_subscriptions table exists for storing WebPush subscriptions.
 */
async function ensurePushSubscriptionsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_push_subscriptions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NULL,
      endpoint VARCHAR(500) NOT NULL UNIQUE,
      p256dh VARCHAR(255) NULL,
      auth VARCHAR(255) NULL,
      subscription_json TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_push_user (user_id),
      KEY idx_push_endpoint (endpoint)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * Ensures required address and contact columns exist in the adm_branches table.
 */
async function ensureBranchColumns() {
  const table = "adm_branches";
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
}

/**
 * Ensures required user profile and valid date columns exist in the adm_users table.
 */
async function ensureUserColumns() {
  const table = "adm_users";
  if (!(await hasColumn(table, "profile_picture"))) {
    await query(
      `ALTER TABLE ${table} ADD COLUMN profile_picture LONGBLOB NULL`,
    );
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

  // Ensure user ID 1 cannot be deleted
  try {
    await query(`DROP TRIGGER IF EXISTS trg_prevent_delete_user_1`);
    await query(`
      CREATE TRIGGER trg_prevent_delete_user_1
      BEFORE DELETE ON adm_users
      FOR EACH ROW
      BEGIN
        IF OLD.id = 1 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot delete super admin user id 1';
        END IF;
      END;
    `);
  } catch (err) {
    console.error("Failed to create trigger for user 1 deletion prevention:", err.message);
  }
}

/**
 * Ensures the adm_pages table exists to define application modules and features.
 */
async function ensurePagesTable() {
  if (verifiedTables.has("adm_pages")) return;
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

  // Backwards-compatible: add feature_key column if it does not exist yet
  if (!(await hasColumn("adm_pages", "feature_key"))) {
    await query(
      `ALTER TABLE adm_pages ADD COLUMN feature_key VARCHAR(150) NULL AFTER path`,
    );
  }
  verifiedTables.add("adm_pages");
}

/**
 * Seeds the adm_pages table with the default set of application pages and their routes.
 * Automatically adds derived 'Delete' actions for pages that have an 'Edit' page.
 */
async function ensurePagesSeed() {
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
    {
      module: "Sales",
      name: "Potential Customers",
      path: "/sales/potential-customers",
    },
    {
      module: "Sales",
      name: "Potential Customer List",
      path: "/sales/potential-customers",
    },
    {
      module: "Sales",
      name: "Potential Customer Form",
      path: "/sales/potential-customers/new",
    },
    {
      module: "Sales",
      name: "Potential Customer Edit",
      path: "/sales/potential-customers/:id",
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
    {
      module: "Purchase",
      name: "Direct Purchase",
      path: "/purchase/direct-purchase",
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
      name: "Opening Balances",
      path: "/finance/opening-balances",
    },
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
      name: "Employee Form",
      path: "/human-resources/employees/new",
    },
    {
      module: "Human Resources",
      name: "Employee Edit",
      path: "/human-resources/employees/:id",
    },
    {
      module: "Human Resources",
      name: "Leave Setup",
      path: "/human-resources/leave-setup",
    },
    {
      module: "Human Resources",
      name: "Leave Setup Form",
      path: "/human-resources/leave-setup/new",
    },
    {
      module: "Human Resources",
      name: "Leave Setup Edit",
      path: "/human-resources/leave-setup/:id",
    },
    {
      module: "Human Resources",
      name: "Shifts",
      path: "/human-resources/shifts",
    },
    {
      module: "Human Resources",
      name: "Shift Form",
      path: "/human-resources/shifts/new",
    },
    {
      module: "Human Resources",
      name: "Shift Edit",
      path: "/human-resources/shifts/:id",
    },
    {
      module: "Human Resources",
      name: "Attendance",
      path: "/human-resources/attendance",
    },
    {
      module: "Human Resources",
      name: "Attendance Form",
      path: "/human-resources/attendance/new",
    },
    {
      module: "Human Resources",
      name: "Attendance Edit",
      path: "/human-resources/attendance/:id",
    },
    {
      module: "Human Resources",
      name: "Salary Config",
      path: "/human-resources/salary-config",
    },
    {
      module: "Human Resources",
      name: "Salary Config Form",
      path: "/human-resources/salary-config/new",
    },
    {
      module: "Human Resources",
      name: "Salary Config Edit",
      path: "/human-resources/salary-config/:id",
    },
    {
      module: "Human Resources",
      name: "Tax Config",
      path: "/human-resources/tax-config",
    },
    {
      module: "Human Resources",
      name: "Tax Config Form",
      path: "/human-resources/tax-config/new",
    },
    {
      module: "Human Resources",
      name: "Tax Config Edit",
      path: "/human-resources/tax-config/:id",
    },
    {
      module: "Human Resources",
      name: "Allowances",
      path: "/human-resources/allowances",
    },
    {
      module: "Human Resources",
      name: "Allowance Form",
      path: "/human-resources/allowances/new",
    },
    {
      module: "Human Resources",
      name: "Allowance Edit",
      path: "/human-resources/allowances/:id",
    },
    {
      module: "Human Resources",
      name: "Loans",
      path: "/human-resources/loans",
    },
    {
      module: "Human Resources",
      name: "Loan Form",
      path: "/human-resources/loans/new",
    },
    {
      module: "Human Resources",
      name: "Loan Edit",
      path: "/human-resources/loans/:id",
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
      name: "Promotion Form",
      path: "/human-resources/promotions/new",
    },
    {
      module: "Human Resources",
      name: "Promotion Edit",
      path: "/human-resources/promotions/:id",
    },
    {
      module: "Human Resources",
      name: "Medical Policies",
      path: "/human-resources/medical-policies",
    },
    {
      module: "Human Resources",
      name: "Medical Policy Form",
      path: "/human-resources/medical-policies/new",
    },
    {
      module: "Human Resources",
      name: "Medical Policy Edit",
      path: "/human-resources/medical-policies/:id",
    },
    {
      module: "Human Resources",
      name: "Reports",
      path: "/human-resources/reports",
    },

    { module: "Maintenance", name: "Assets", path: "/maintenance/assets" },
    {
      module: "Maintenance",
      name: "Asset Form",
      path: "/maintenance/assets/new",
    },
    {
      module: "Maintenance",
      name: "Asset Edit",
      path: "/maintenance/assets/:id",
    },
    {
      module: "Maintenance",
      name: "Work Orders",
      path: "/maintenance/work-orders",
    },
    {
      module: "Maintenance",
      name: "Work Order Form",
      path: "/maintenance/work-orders/new",
    },
    {
      module: "Maintenance",
      name: "Work Order Edit",
      path: "/maintenance/work-orders/:id",
    },
    {
      module: "Maintenance",
      name: "Schedules",
      path: "/maintenance/pm-schedules",
    },
    {
      module: "Maintenance",
      name: "Schedule Form",
      path: "/maintenance/pm-schedules/new",
    },
    {
      module: "Maintenance",
      name: "Schedule Edit",
      path: "/maintenance/pm-schedules/:id",
    },
    { module: "Maintenance", name: "Reports", path: "/maintenance/reports" },

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
  for (const p of allPages) {
    const code = `${p.module}_${p.name}`
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    await query(
      "INSERT IGNORE INTO adm_pages (module, name, code, path) VALUES (:module, :name, :code, :path)",
      { module: p.module, name: p.name, code, path: p.path || null },
    );
  }
}

/**
 * Ensures the adm_role_pages table exists for mapping roles to accessible pages.
 */
async function ensureRolePagesTable() {
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

/**
 * Ensures the adm_user_permissions table exists for fine-grained user access control to pages.
 */
async function ensureUserPermissionsTable() {
  if (verifiedTables.has("adm_user_permissions")) return;
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
  verifiedTables.add("adm_user_permissions");
}

function deriveActionAndBase(page) {
  const path = String(page?.path || "");
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) {
    return { base: path, action: "view" };
  }
  const seg = parts[parts.length - 1];
  let action = "view";
  if (seg === "new" || seg === "create") action = "create";
  else if (seg && seg.startsWith(":")) action = "edit";
  const name = String(page?.name || "");
  if (/\bDelete\b/i.test(name)) action = "delete";
  let baseParts = parts.slice();
  if (action !== "view") {
    baseParts = parts.slice(0, parts.length - 1);
  }
  const base = baseParts.length > 0 ? `/${baseParts.join("/")}` : path || "/";
  return { base, action };
}

function basePathFromRequestPath(p) {
  const raw = String(p || "").trim() || "/";
  let parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  const last = parts[parts.length - 1];
  if (last === "new" || last === "create") {
    parts = parts.slice(0, parts.length - 1);
  } else if (/^[0-9]+$/.test(last) || /^[0-9a-fA-F-]{8,}$/.test(last)) {
    parts = parts.slice(0, parts.length - 1);
  }
  if (
    parts[0] === "administration" &&
    parts[1] === "access" &&
    parts.length >= 3
  ) {
    return `/${parts.slice(0, 3).join("/")}`;
  }
  if (parts.length >= 2) return `/${parts.slice(0, 2).join("/")}`;
  return `/${parts[0]}`;
}

function requirePageAccess(path, action = "view") {
  return async function pageAccessMiddleware(req, res, next) {
    try {
      const perms = Array.isArray(req.user?.permissions)
        ? req.user.permissions
        : [];
      if (perms.includes("*")) return next();
      const userId = Number(req.user?.sub);
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(httpError(401, "UNAUTHORIZED", "Invalid user"));
      }
      if (userId === 1) return next();
      const rows = await query(
        `SELECT id, module, name, path,
          created_at,
          u.username AS created_by_name
         FROM adm_pages
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE path = :path AND is_active = 1 LIMIT 1`,
        { path },
      );
      const page = rows[0];
      if (!page) {
        return next(httpError(404, "NOT_FOUND", "Page not registered"));
      }
      const users = await query(
        `SELECT role_id,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id LIMIT 1`,
        { id: userId },
      );
      const roleId = Number(users?.[0]?.role_id || 0);
      await ensureRolePagesTable();
      await ensureUserPermissionsTable();
      if (!roleId) {
        return next(httpError(403, "FORBIDDEN", "Role not assigned"));
      }
      const roleHasPageRows = await query(
        `SELECT 1,
          created_at,
          u.username AS created_by_name
         FROM adm_role_pages
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE role_id = :rid AND page_id = :pid 
         LIMIT 1`,
        { rid: roleId, pid: page.id },
      );
      if (!roleHasPageRows.length) {
        return next(httpError(403, "FORBIDDEN", "Insufficient page rights"));
      }
      let can_view = 1;
      let can_create = 0;
      let can_edit = 0;
      let can_delete = 0;
      const upRows = await query(
        `SELECT can_view, can_create, can_edit, can_delete,
          created_at,
          u.username AS created_by_name
         FROM adm_user_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :uid AND page_id = :pid 
         LIMIT 1`,
        { uid: userId, pid: page.id },
      );
      if (upRows.length) {
        const row = upRows[0];
        can_view = Number(row.can_view) ? 1 : 0;
        can_create = Number(row.can_create) ? 1 : 0;
        can_edit = Number(row.can_edit) ? 1 : 0;
        can_delete = Number(row.can_delete) ? 1 : 0;
      }
      if (action === "view" && can_view) return next();
      if (action === "create" && can_create) return next();
      if (action === "edit" && can_edit) return next();
      if (action === "delete" && can_delete) return next();
      return next(httpError(403, "FORBIDDEN", "Insufficient page rights"));
    } catch (err) {
      return next(err);
    }
  };
}

async function ensureErrorLogsTable() {
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

async function ensureExceptionalPermissionsTable() {
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

async function logError({
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

async function ensureUserBranchMapping() {
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

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (String(file.mimetype || "").startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
});

const loginBackgroundUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (String(file.mimetype || "").startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
});
const appBgUploadDir = path.join(process.cwd(), "uploads", "backgrounds");
try {
  if (!fs.existsSync(appBgUploadDir)) {
    fs.mkdirSync(appBgUploadDir, { recursive: true });
  }
} catch {}

const appBackgroundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(appBgUploadDir)) {
        fs.mkdirSync(appBgUploadDir, { recursive: true });
      }
    } catch {}
    cb(null, appBgUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "") || ".jpg";
    cb(null, `custom-bg-${Date.now()}${ext}`);
  },
});

const appBackgroundUpload = multer({
  storage: appBackgroundStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (String(file.mimetype || "").startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
});

let _appBgColumnsEnsured = false;
async function ensureAppBackgroundColumns() {
  if (_appBgColumnsEnsured) return;
  await ensureLoginBrandingTable();
  try {
    const cols = await query(`SHOW COLUMNS FROM adm_login_branding`);
    const colNames = (cols || []).map((c) => c.Field);
    if (!colNames.includes("app_bg_image")) {
      await query(`ALTER TABLE adm_login_branding ADD COLUMN app_bg_image LONGBLOB NULL`);
    }
    if (!colNames.includes("app_bg_mime")) {
      await query(`ALTER TABLE adm_login_branding ADD COLUMN app_bg_mime VARCHAR(100) NULL`);
    }
  } catch (err) {
    console.error("Failed to ensure app_bg columns in adm_login_branding:", err);
  }
  _appBgColumnsEnsured = true;
}

let _brandingTableEnsured = false;
async function ensureLoginBrandingTable() {
  if (_brandingTableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS adm_login_branding (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      background_image LONGBLOB NULL,
      background_mime VARCHAR(100) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  
  // Ensure missing hero columns exist
  try {
    const cols = await query(`SHOW COLUMNS FROM adm_login_branding`);
    const colNames = cols.map(c => c.Field);
    if (!colNames.includes('hero_image')) {
      await query(`ALTER TABLE adm_login_branding ADD COLUMN hero_image LONGBLOB NULL AFTER background_mime`);
    }
    if (!colNames.includes('hero_mime')) {
      await query(`ALTER TABLE adm_login_branding ADD COLUMN hero_mime VARCHAR(100) NULL AFTER hero_image`);
    }
  } catch (err) {
    console.error("Failed to alter adm_login_branding:", err);
  }
  _brandingTableEnsured = true;
}

// Get login background metadata
router.get("/settings/login-bg-info", async (req, res) => {
  try {
    await ensureLoginBrandingTable().catch(() => {});
    const rows = await query(
      `SELECT background_image IS NOT NULL AS has_background, updated_at
         FROM adm_login_branding
        WHERE id = 1
        LIMIT 1`,
    ).catch(() => []);
    const row = rows[0] || {};
    res.json({
      hasBackground: Number(row.has_background || 0) === 1,
      updatedAt: row.updated_at || null,
    });
  } catch (err) {
    res.json({ hasBackground: false, updatedAt: null });
  }
});

// Get login hero background metadata
router.get("/settings/login-hero-bg-info", async (req, res) => {
  try {
    await ensureLoginBrandingTable().catch(() => {});
    const rows = await query(
      `SELECT hero_image IS NOT NULL AS has_background, updated_at
         FROM adm_login_branding
        WHERE id = 1
        LIMIT 1`,
    ).catch(() => []);
    const row = rows[0] || {};
    res.json({
      hasBackground: Number(row.has_background || 0) === 1,
      updatedAt: row.updated_at || null,
    });
  } catch (err) {
    res.json({ hasBackground: false, updatedAt: null });
  }
});

router.get("/settings/login-background", async (req, res, next) => {
  try {
    await ensureLoginBrandingTable();
    const rows = await query(
      `SELECT background_image, background_mime
         FROM adm_login_branding
        WHERE id = 1
        LIMIT 1`,
    );
    const row = rows[0] || null;
    if (!row?.background_image) return res.status(404).end();
    const body = Buffer.isBuffer(row.background_image)
      ? row.background_image
      : Buffer.from(row.background_image);
    res.setHeader("Content-Type", row.background_mime || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.end(body);
  } catch (err) {
    next(err);
  }
});

router.get("/settings/login-hero-background", async (req, res, next) => {
  try {
    const bgDir = path.join(process.cwd(), "uploads", "backgrounds");
    const candidates = [
      path.join(bgDir, "login-hero.jpg"),
      path.join(bgDir, "login-hero.jpeg"),
      path.join(bgDir, "login-hero.png"),
      path.join(bgDir, "login-hero.webp"),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        res.setHeader("Cache-Control", "public, max-age=300");
        return res.sendFile(file);
      }
    }

    await ensureLoginBrandingTable();
    const rows = await query(
      `SELECT hero_image, hero_mime
         FROM adm_login_branding
        WHERE id = 1
        LIMIT 1`,
    );
    const row = rows[0] || null;
    if (!row?.hero_image) return res.status(404).end();
    const body = Buffer.isBuffer(row.hero_image)
      ? row.hero_image
      : Buffer.from(row.hero_image);
    res.setHeader("Content-Type", row.hero_mime || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.end(body);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/settings/login-background",
  requireAuth,
  requirePageAccess("/administration/settings", "edit"),
  loginBackgroundUpload.single("background"),
  async (req, res, next) => {
    try {
      if (!req.file?.buffer) {
        throw httpError(400, "VALIDATION_ERROR", "Background image is required");
      }
      await ensureLoginBrandingTable();
      try { await query("SET SESSION max_allowed_packet = 16777216"); } catch {}
      await query(
        `INSERT INTO adm_login_branding (id, background_image, background_mime)
         VALUES (1, :image, :mime)
         ON DUPLICATE KEY UPDATE
           background_image = VALUES(background_image),
           background_mime = VALUES(background_mime)`,
        {
          image: req.file.buffer,
          mime: req.file.mimetype || "image/jpeg",
        },
      );
      res.json({ success: true, updatedAt: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/settings/login-hero-background",
  requireAuth,
  requirePageAccess("/administration/settings", "edit"),
  loginBackgroundUpload.single("background"),
  async (req, res, next) => {
    try {
      if (!req.file?.buffer) {
        throw httpError(400, "VALIDATION_ERROR", "Hero image is required");
      }
      await ensureLoginBrandingTable();

      // Write to uploads/backgrounds disk storage for static streaming
      try {
        const bgDir = path.join(process.cwd(), "uploads", "backgrounds");
        if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });
        const ext = req.file.mimetype?.includes("png") ? "png" : "jpg";
        const heroDiskPath = path.join(bgDir, `login-hero.${ext}`);
        fs.writeFileSync(heroDiskPath, req.file.buffer);
      } catch (fsErr) {
        console.warn("Failed to write login hero image to disk:", fsErr.message);
      }

      try { await query("SET SESSION max_allowed_packet = 16777216"); } catch {}
      await query(
        `INSERT INTO adm_login_branding (id, hero_image, hero_mime)
         VALUES (1, :image, :mime)
         ON DUPLICATE KEY UPDATE
           hero_image = VALUES(hero_image),
           hero_mime = VALUES(hero_mime)`,
        {
          image: req.file.buffer,
          mime: req.file.mimetype || "image/jpeg",
        },
      );
      res.json({ success: true, updatedAt: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/settings/login-background",
  requireAuth,
  requirePageAccess("/administration/settings", "delete"),
  async (req, res, next) => {
    try {
      await ensureLoginBrandingTable();
      await query(`UPDATE adm_login_branding SET background_image = NULL, background_mime = NULL WHERE id = 1`);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/settings/login-hero-background",
  requireAuth,
  requirePageAccess("/administration/settings", "delete"),
  async (req, res, next) => {
    try {
      const bgDir = path.join(process.cwd(), "uploads", "backgrounds");
      const candidates = [
        path.join(bgDir, "login-hero.jpg"),
        path.join(bgDir, "login-hero.jpeg"),
        path.join(bgDir, "login-hero.png"),
        path.join(bgDir, "login-hero.webp"),
      ];
      for (const file of candidates) {
        if (fs.existsSync(file)) {
          try { fs.unlinkSync(file); } catch {}
        }
      }
      await ensureLoginBrandingTable();
      await query(`UPDATE adm_login_branding SET hero_image = NULL, hero_mime = NULL WHERE id = 1`);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/me", requireAuth, requireCompanyScope, requireBranchScope, getMe);

// ===== COMPANIES =====

router.get(
  "/companies",
  requireAuth,
  requirePermission("ADMIN.COMPANIES.VIEW"),
  getCompanies,
);

router.get(
  "/companies/:id",
  requireAuth,
  requirePermission("ADMIN.COMPANIES.VIEW"),
  getCompanyById,
);

router.post(
  "/companies/:id/logo",
  requireAuth,
  requirePageAccess("/administration/settings", "create"),
  logoUpload.single("logo"),
  uploadCompanyLogo,
);

router.get(
  "/companies/:id/logo",
  requireAuth,
  requirePageAccess("/administration/settings", "view"),
  getCompanyLogo,
);

router.delete(
  "/companies/:id/logo",
  requireAuth,
  requirePageAccess("/administration/settings", "delete"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0)
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await query(`UPDATE adm_companies SET logo = NULL WHERE id = :id`, {
        id,
      });
      res.json({ success: true, message: "Logo deleted" });
    } catch (err) {
      next(err);
    }
  },
);

// ===== USER ROLE ASSIGNMENTS =====
router.get("/users/:id/roles", requireAuth, getUserRole);

router.post(
  "/companies",
  requireAuth,
  requirePermission("ADMIN.COMPANIES.MANAGE"),
  mangeCompanies,
);

router.put(
  "/companies/:id",
  requireAuth,
  requirePermission("ADMIN.COMPANIES.MANAGE"),
  updateCompanies,
);

// ===== BRANCHES =====

router.get(
  "/branches",
  requireAuth,
  requirePermission("ADMIN.BRANCHES.VIEW"),
  getBranches,
);
router.get(
  "/branches/:id",
  requireAuth,
  requirePermission("ADMIN.BRANCHES.VIEW"),
  getBranchById,
);

router.post(
  "/branches",
  requireAuth,
  requirePermission("ADMIN.BRANCHES.MANAGE"),
  createBranch,
);

router.put(
  "/branches/:id",
  requireAuth,
  requirePermission("ADMIN.BRANCHES.MANAGE"),
  updateBranch,
);

// ===== DEPARTMENTS =====

router.get(
  "/departments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  getDepartments,
);

router.get("/departments/:id", requireAuth, getDepartmentById);

router.post("/departments", requireAuth, requireCompanyScope, createDepartment);

router.put("/departments/:id", requireAuth, requireCompanyScope, updateDepartment);

// ===== PAGES =====

// legacy pages API removed under hybrid model

// ===== ROLES =====

// legacy roles APIs removed; replaced by access routes

// ===== USERS =====

router.get(
  "/users",
  requireAuth,
  getUsers,
);

router.get(
  "/users/:id",
  requireAuth,
  getUserById,
);

router.get(
  "/users/:id/branches",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  getUserBranches,
);

router.put(
  "/users/:id/branches",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  updateUserBranches,
);

router.post(
  "/users",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  createUser,
);

router.put(
  "/users/:id",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  updateUser,
);

// Patch for quick updates (e.g. branch assignment)
router.patch(
  "/users/:id",
  requireAuth,
  requirePermission("ADMIN.USERS.MANAGE"),
  patchUser,
);

router.post(
  "/users/:id/feature-permissions",
  requireAuth,
  saveUserFeaturePermissions,
);

router.get(
  "/users/:id/feature-permissions-context",
  requireAuth,
  getUserFeaturePermissionsContext,
);

router.get(
  "/users/:id/feature-permissions",
  requireAuth,
  getUserFeaturePermissionsList,
);

// ===== Exceptional Permissions (User-scoped) =====
router.get(
  "/users/:id/exceptional-permissions",
  requireAuth,
  getExceptionalPermissionsForUser,
);
router.put(
  "/users/:id/exceptional-permissions",
  requireAuth,
  bulkUpsertExceptionalPermissionsForUser,
);

// Global exceptional permissions list/detail
router.get("/exceptional-permissions", requireAuth, listExceptionalPermissions);
router.get(
  "/exceptional-permissions/:id",
  requireAuth,
  getExceptionalPermissionById,
);

// Page-level permissions snapshot for current user on a given path
router.get("/page-permissions", requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub || req.user?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return next(httpError(401, "UNAUTHORIZED", "Invalid user"));
    }
    try {
      await ensurePagesTable();
      await ensureUserPermissionsTable();
      await ensureUserPermissionCacheAndTriggers();
    } catch (e) {
      console.error("Error in ensure permission tables:", e);
    }
    const reqPath = String(req.query?.path || "").trim() || "/";
    const base = basePathFromRequestPath(reqPath);
    let pages = await query(
      `SELECT id, path, feature_key,
          created_at,
          u.username AS created_by_name
         FROM adm_pages
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE path = :path AND is_active = 1 LIMIT 1`,
      { path: base },
    );
    if (!pages.length) {
      const parts = base.split("/").filter(Boolean);
      const fallbackFeatureKey =
        parts[0] === "administration" && parts[1] === "access" && parts[2]
          ? `administration:${parts[2]}`
          : parts.length >= 2
            ? `${parts[0]}:${parts[1]}`
            : null;
      if (fallbackFeatureKey) {
        pages = await query(
          `SELECT id, path, feature_key,
              created_at,
              u.username AS created_by_name
             FROM adm_pages
            LEFT JOIN adm_users u ON u.id = created_by
            WHERE feature_key = :featureKey
              AND is_active = 1
            ORDER BY CASE WHEN path = :path THEN 0 ELSE 1 END,
                     LENGTH(COALESCE(path, '')) DESC
            LIMIT 1`,
          { featureKey: fallbackFeatureKey, path: base },
        );
      }
    }
    if (!pages.length) {
      return res.json({
        path: base,
        can_view: 0,
        can_create: 0,
        can_edit: 0,
        can_delete: 0,
      });
    }
    const page = pages[0];
    // Start with role-level defaults using feature_key (if present)
    let roleDefaults = {
      can_view: 0,
      can_create: 0,
      can_edit: 0,
      can_delete: 0,
    };
    try {
      const fk = String(page?.feature_key || "").trim() || null;
      if (fk) {
        const agg = await query(
          `SELECT 
             MAX(rp.can_view)   AS can_view,
             MAX(rp.can_create) AS can_create,
             MAX(rp.can_edit)   AS can_edit,
             MAX(rp.can_delete) AS can_delete,
          rp.created_at,
          uc.username AS created_by_name
         FROM adm_role_permissions rp
           JOIN adm_users u ON u.role_id = rp.role_id
        LEFT JOIN adm_users uc ON uc.id = rp.created_by
         WHERE u.id = :uid
             AND (rp.feature_key = :fk OR rp.feature_key LIKE CONCAT(:fk, ':%'))
           LIMIT 1`,
          { uid: userId, fk },
        );
        if (agg.length) {
          roleDefaults = {
            can_view: Number(agg[0].can_view) ? 1 : 0,
            can_create: Number(agg[0].can_create) ? 1 : 0,
            can_edit: Number(agg[0].can_edit) ? 1 : 0,
            can_delete: Number(agg[0].can_delete) ? 1 : 0,
          };
        }
      }
    } catch (e) {
      console.error("Error calculating role defaults:", e);
    }
    // Prefer the effective cache table for performance; override role defaults if user-specific exists
    let row = null;
    try {
      const eff = await query(
        `SELECT can_view, can_create, can_edit, can_delete,
          created_at,
          u.username AS created_by_name
         FROM adm_page_permission_effective
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :uid AND page_id = :pid
         LIMIT 1`,
        { uid: userId, pid: page.id },
      );
      if (eff.length) row = eff[0];
    } catch (e) {
      console.error("Error checking effective permissions:", e);
    }
    if (!row) {
      try {
        const ups = await query(
          `SELECT can_view, can_create, can_edit, can_delete,
          created_at,
          u.username AS created_by_name
         FROM adm_user_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :uid AND page_id = :pid
           LIMIT 1`,
          { uid: userId, pid: page.id },
        );
        row = ups[0] || null;
      } catch (e) {
        console.error("Error checking user permissions:", e);
      }
    }
    const out = {
      path: base,
      can_view: roleDefaults.can_view,
      can_create: roleDefaults.can_create,
      can_edit: roleDefaults.can_edit,
      can_delete: roleDefaults.can_delete,
    };
    if (row) {
      out.can_view = Number(row.can_view) ? 1 : 0;
      out.can_create = Number(row.can_create) ? 1 : 0;
      out.can_edit = Number(row.can_edit) ? 1 : 0;
      out.can_delete = Number(row.can_delete) ? 1 : 0;
    }
    res.json(out);
  } catch (err) {
    console.error("CRITICAL ERROR in page-permissions route:", err);
    try {
      const reqPath = String(req.query?.path || "").trim() || "/";
      const base = basePathFromRequestPath(reqPath);
      // Fail-open for view so the UI doesn't break; restrict create/edit/delete by default
      res.status(200).json({
        path: base,
        can_view: 1,
        can_create: 0,
        can_edit: 0,
        can_delete: 0,
      });
    } catch {
      // As a last resort, respond with global defaults
      res.status(200).json({
        path: "/",
        can_view: 1,
        can_create: 0,
        can_edit: 0,
        can_delete: 0,
      });
    }
  }
});

// legacy page-based user permissions removed

// ===== DASHBOARD STATS =====

router.get("/dashboard-stats", requireAuth, getDashboardStats);

// legacy exceptional permissions APIs removed

router.post("/error-logs", requireAuth, logErrorController);

// ===== System Status =====
router.get("/system-status", requireAuth, async (req, res, next) => {
  try {
    await ensureLoginLogsTable();
    const uptimeSeconds = Math.floor(process.uptime());
    const startedAt = new Date(Date.now() - uptimeSeconds * 1000);
    const rowsVars = await query(`SHOW VARIABLES LIKE 'max_connections'`, {});
    const rowsStatus = await query(
      `SHOW STATUS WHERE Variable_name IN ('Threads_connected','Threads_running')`,
      {},
    );
    const maxConnections = Number(
      rowsVars?.[0]?.Value || rowsVars?.[0]?.value || 100,
    );
    let threadsConnected = 0;
    let threadsRunning = 0;
    for (const r of rowsStatus || []) {
      const name = String(
        r.Variable_name || r.Variable_Name || "",
      ).toLowerCase();
      const val = Number(r.Value || r.value || 0);
      if (name === "threads_connected") threadsConnected = val;
      if (name === "threads_running") threadsRunning = val;
    }
    const loadPercent = Math.max(
      0,
      Math.min(
        100,
        Math.round((threadsConnected / Math.max(1, maxConnections)) * 100),
      ),
    );
    const recentLogins = await query(
      `
       SELECT l.id, l.username, l.user_id, l.ip_address, l.user_agent, l.login_time,
          l.login_time AS created_at
         FROM adm_login_logs l
         ORDER BY l.login_time DESC
      LIMIT 20
      `,
      {},
    );
    res.json({
      startedAt: startedAt.toISOString(),
      uptimeSeconds,
      uptimeHuman: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor(
        (uptimeSeconds % 3600) / 60,
      )}m ${uptimeSeconds % 60}s`,
      database: {
        threadsConnected,
        threadsRunning,
        maxConnections,
        loadPercent,
      },
      recentLogins,
    });
  } catch (err) {
    console.error("Error in POST /api/admin/activity/log:", err);
    next(err);
  }
});

// ===== Activity Logging & Reports =====
router.post("/activity/log", requireAuth, async (req, res, next) => {
  try {
    const { companyId, branchId, branchIdsStr } = req.scope || {};
    const userId = Number(req.user?.id) || Number(req.user?.sub) || null;
    const { module_name, action, ref_no, message, url_path, event_time } =
      req.body || {};
    await ensureSystemLogsTable();
    const parsedEvent =
      event_time && !Number.isNaN(Date.parse(String(event_time)))
        ? new Date(String(event_time))
        : new Date();
    await query(
      `
      INSERT INTO adm_system_logs (company_id, branch_id, user_id, module_name, action, ref_no, message, url_path, event_time)
      VALUES (:company_id, :branch_id, :user_id, :module_name, :action, :ref_no, :message, :url_path, :event_time)
      `,
      {
        company_id: Number(companyId) || null,
        branch_id: Number(branchId, branchIdsStr) || null,
        user_id: userId || null,
        module_name: module_name || null,
        action: action || "VIEW",
        ref_no: ref_no || null,
        message: message || null,
        url_path: url_path || null,
        event_time: parsedEvent,
      },
    );
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/system-log-book", requireAuth, async (req, res, next) => {
  try {
    await ensureSystemLogsTable();
    await ensureLoginLogsTable();
    const { from, to, module, action, user_id } = req.query || {};
    // Build filters for system logs
    const pSys = {};
    const sysClauses = [];
    if (from) {
      sysClauses.push("event_time >= :from");
      pSys.from = new Date(String(from));
    }
    if (to) {
      sysClauses.push("event_time < DATE_ADD(:to, INTERVAL 1 DAY)");
      pSys.to = new Date(String(to));
    }
    if (user_id) {
      sysClauses.push("user_id = :uid");
      pSys.uid = Number(user_id);
    }
    if (module) {
      const modules = String(module)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (modules.length) {
        const placeholders = modules.map((_, i) => `:m${i}`).join(", ");
        sysClauses.push(`module_name IN (${placeholders})`);
        modules.forEach((m, i) => (pSys[`m${i}`] = m));
      }
    }
    if (action) {
      const actions = String(action)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (actions.length) {
        const placeholders = actions.map((_, i) => `:a${i}`).join(", ");
        sysClauses.push(`action IN (${placeholders})`);
        actions.forEach((a, i) => (pSys[`a${i}`] = a));
      }
    }
    const whereSys = sysClauses.length
      ? `WHERE ${sysClauses.join(" AND ")}`
      : "";
    // Build filters for login logs (time range and optional user only)
    const pLogin = {};
    const loginClauses = [];
    if (from) {
      loginClauses.push("login_time >= :from");
      pLogin.from = new Date(String(from));
    }
    if (to) {
      loginClauses.push("login_time < DATE_ADD(:to, INTERVAL 1 DAY)");
      pLogin.to = new Date(String(to));
    }
    if (user_id) {
      loginClauses.push("user_id = :uid");
      pLogin.uid = Number(user_id);
    }
    const whereLogin = loginClauses.length
      ? `WHERE ${loginClauses.join(" AND ")}`
      : "";
    const items = await query(
      `
        SELECT 
          s.id,
          s.event_time,
          u.username AS user_name,
          b.name AS branch_name,
          s.module_name,
          s.action,
          s.ref_no,
          s.message,
          s.url_path AS page_name,
          s.ip_address,
          s.created_at
         FROM adm_system_logs s
        LEFT JOIN adm_users u ON s.user_id = u.id
        LEFT JOIN adm_branches b ON s.branch_id = b.id
        ${whereSys}
         ORDER BY s.event_time DESC
        LIMIT 200
        `,
      pSys,
    );
    const loginItems = await query(
      `
        SELECT 
          l.id,
          l.login_time AS event_time,
          l.username AS user_name,
          b.name AS branch_name,
          'Authentication' AS module_name,
          'LOGIN' AS action,
          l.ip_address,
          '' AS page_name,
          l.user_agent AS message
         FROM adm_login_logs l
        LEFT JOIN adm_branches b ON l.branch_id = b.id
        ${whereLogin}
         ORDER BY l.login_time DESC
        LIMIT 200
        `,
      pLogin,
    );
    const combined = [...items, ...loginItems].sort((a, b) => {
      const ta = new Date(a.event_time).getTime();
      const tb = new Date(b.event_time).getTime();
      return tb - ta;
    });
    res.json({ items: combined.slice(0, 200) });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/reports/user-login-activity",
  requireAuth,
  async (req, res, next) => {
    try {
      await ensureLoginLogsTable();
      await ensureSystemLogsTable();
      const { from, to, user_id, filter } = req.query || {};
      const sysParams = {};
      const sysClauses = [];
      if (from) { sysClauses.push("s.event_time >= :from"); sysParams.from = new Date(String(from)); }
      if (to) { sysClauses.push("s.event_time < DATE_ADD(:to, INTERVAL 1 DAY)"); sysParams.to = new Date(String(to)); }
      if (user_id) { sysClauses.push("s.user_id = :uid"); sysParams.uid = Number(user_id); }
      const sysWhere = sysClauses.length ? `WHERE ${sysClauses.join(" AND ")}` : "";

      const loginParams = {};
      const loginClauses = [];
      if (from) { loginClauses.push("l.login_time >= :from"); loginParams.from = new Date(String(from)); }
      if (to) { loginClauses.push("l.login_time < DATE_ADD(:to, INTERVAL 1 DAY)"); loginParams.to = new Date(String(to)); }
      if (user_id) { loginClauses.push("l.user_id = :uid"); loginParams.uid = Number(user_id); }
      const loginWhere = loginClauses.length ? `WHERE ${loginClauses.join(" AND ")}` : "";

      const pageItems = filter !== "login" ? await query(`
        SELECT s.id, s.event_time, u.username AS user_name, s.module_name,
               s.url_path AS page_name, s.ip_address, '' AS location,
               'page' AS event_type
          FROM adm_system_logs s
          LEFT JOIN adm_users u ON s.user_id = u.id
         ${sysWhere}
         ORDER BY s.event_time DESC LIMIT 500
      `, sysParams) : [];

      const loginItems = filter !== "page" ? await query(`
        SELECT l.id, l.login_time AS event_time, l.username AS user_name,
               'Authentication' AS module_name, 'LOGIN' AS page_name,
               l.ip_address, '' AS location, 'login' AS event_type
          FROM adm_login_logs l
         ${loginWhere}
         ORDER BY l.login_time DESC LIMIT 200
      `, loginParams) : [];

      const combined = [...(pageItems || []), ...(loginItems || [])].sort((a, b) => {
        const ta = new Date(a.event_time).getTime();
        const tb = new Date(b.event_time).getTime();
        return tb - ta;
      });
      res.json({ items: combined.slice(0, 500) });
    } catch (err) {
      next(err);
    }
  },
);

// ===== Push Notifications =====
router.get("/push/public-key", requireAuth, async (req, res, next) => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY || "";
    res.json({ publicKey });
  } catch (err) {
    next(err);
  }
});

router.post("/push/subscribe", requireAuth, async (req, res, next) => {
  try {
    await ensurePushSubscriptionsTable();
    const userId = Number(req.user?.id) || Number(req.user?.sub) || null;
    const { subscription } = req.body || {};
    const endpoint = String(subscription?.endpoint || "");
    if (!endpoint)
      throw httpError(400, "VALIDATION_ERROR", "endpoint required");
    const keys = subscription?.keys || subscription?.Keys || {};
    const p256dh = String(keys?.p256dh || keys?.P256DH || "");
    const auth = String(keys?.auth || keys?.Auth || "");
    await query(
      `
      INSERT INTO adm_push_subscriptions (user_id, endpoint, p256dh, auth, subscription_json)
      VALUES (:user_id, :endpoint, :p256dh, :auth, :subscription_json)
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        p256dh = VALUES(p256dh),
        auth = VALUES(auth),
        subscription_json = VALUES(subscription_json),
        updated_at = CURRENT_TIMESTAMP
      `,
      {
        user_id: userId || null,
        endpoint,
        p256dh: p256dh || null,
        auth: auth || null,
        subscription_json: JSON.stringify(subscription || {}),
      },
    );
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/push/unsubscribe", requireAuth, async (req, res, next) => {
  try {
    await ensurePushSubscriptionsTable();
    const { subscription } = req.body || {};
    const endpoint = String(subscription?.endpoint || "");
    if (!endpoint)
      throw httpError(400, "VALIDATION_ERROR", "endpoint required");
    await query(
      `DELETE FROM adm_push_subscriptions WHERE endpoint = :endpoint`,
      { endpoint },
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ===== RBAC SYSTEM ROUTES =====
// ROLES MANAGEMENT
router.get("/roles", requireAuth, getRolesRbac);
router.post("/roles", requireAuth, createRoleRbac);
router.put("/roles/:id", requireAuth, updateRoleRbac);

// ROLE MODULES
router.get("/role-modules/:roleId", requireAuth, getRoleModules);
router.post("/role-modules", requireAuth, saveRoleModules);

router.get("/role-permissions/:roleId", requireAuth, getRolePermissions);
router.post("/role-permissions", requireAuth, saveRolePermissions);

// ROLE FEATURES (allowlist)
router.get("/role-features/:roleId", requireAuth, getRoleFeatures);
router.post("/role-features", requireAuth, saveRoleFeatures);

// USER PERMISSIONS ENDPOINT
router.get("/user-permissions", requireAuth, async (req, res, next) => {
  try {
    // Ensure RBAC tables exist before querying
    await ensureRoleModulesTable();
    await ensureRolePermissionsTable();
    await ensureRoleFeaturesTable();

    const userId = Number(req.user?.sub || req.user?.id);

    // Allow invalid user IDs to proceed but return empty permissions
    if (userId === null || userId === undefined || !Number.isFinite(userId)) {
      return res.json({ modules: [], permissions: [] });
    }

    if (userId === 1) {
      return res.json({
        modules: ["*"],
        permissions: [{ module_key: "*", feature_key: "*", can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 }],
        role_features: ["*"],
        licensed_modules: ["*"],
      });
    }

    // Get user's role and company
    const roleResult = await query(
      `SELECT role_id, company_id
         FROM adm_users
        WHERE id = :userId`,
      { userId },
    );

    let roleId = Number(roleResult?.[0]?.role_id || 0) || 0;
    if (!roleId) {
      const mappedRoles = await query(
        `SELECT ur.role_id
           FROM adm_user_roles ur
           JOIN adm_roles r ON r.id = ur.role_id
          WHERE ur.user_id = :userId
            AND COALESCE(r.is_active, 1) = 1
          ORDER BY ur.created_at DESC, ur.role_id DESC
          LIMIT 1`,
        { userId },
      ).catch(() => []);
      roleId = Number(mappedRoles?.[0]?.role_id || 0) || 0;
    }
    if (!roleId) return res.json({ modules: [], permissions: [] });

    // Get user's modules
    const modules = await query(
      `SELECT module_key
         FROM adm_role_modules
        WHERE role_id = :roleId`,
      { roleId },
    );

    // Get user's permissions
    const permissions = await query(
      `SELECT module_key, feature_key, can_view, can_create, can_edit, can_delete
         FROM adm_role_permissions
        WHERE role_id = :roleId`,
      { roleId },
    );

    const roleFeatures = await query(
      `SELECT feature_key
         FROM adm_role_features
        WHERE role_id = :roleId`,
      { roleId },
    );

    const normalizedPermissions = permissions.map((row) => {
      const moduleKey = normalizeModuleKey(row.module_key);
      return {
        ...row,
        module_key: moduleKey,
        feature_key: normalizeFeatureKey(row.feature_key, moduleKey),
      };
    });

    const normalizedRoleFeatures = roleFeatures
      .map((row) => normalizeFeatureKey(row.feature_key))
      .filter(Boolean);

    const explicitModules = new Set(
      modules
        .map((row) => normalizeModuleKey(row.module_key))
        .filter(Boolean),
    );

    // Fetch exclusive permissions for this user
    const exclusivePerms = await query(
      `SELECT module_key, feature_key FROM adm_admin_page_permissions WHERE user_id = :userId`,
      { userId }
    );
    for (const ep of exclusivePerms) {
      const mk = normalizeModuleKey(ep.module_key);
      const fk = normalizeFeatureKey(ep.feature_key, mk);
      explicitModules.add(mk);
      normalizedRoleFeatures.push(fk);
      normalizedPermissions.push({
        module_key: mk,
        feature_key: fk,
        can_view: 1,
        can_create: 1,
        can_edit: 1,
        can_delete: 1,
      });
    }

    const inferredModules = new Set(explicitModules);

    const companyId = Number(roleResult?.[0]?.company_id || 0);
    let licensedModules = null;
    if (companyId) {
      const licenseQuery = await query(`SELECT id FROM adm_company_licenses WHERE company_id = :companyId ORDER BY id DESC LIMIT 1`, { companyId });
      if (licenseQuery && licenseQuery.length > 0) {
        const licenseId = licenseQuery[0].id;
        const lm = await query(`SELECT module_code FROM adm_license_modules WHERE license_id = :licenseId`, { licenseId });
        licensedModules = new Set(lm.map(x => x.module_code));
      }
    }

    let finalModules = Array.from(inferredModules);
    let finalPermissions = normalizedPermissions;
    let finalRoleFeatures = normalizedRoleFeatures;

    // Only filter by modules explicitly assigned to the role.
    // License enforcement happens at role-assignment time (in saveRoleModules).
    // Do NOT strip role-assigned modules by license here — that causes enabled modules
    // (e.g. transport) to disappear from sidebar even when checked in role setup.
    finalPermissions = finalPermissions.filter(p => explicitModules.has(p.module_key));
    finalRoleFeatures = finalRoleFeatures.filter(f => {
      const [m] = f.split(":");
      return explicitModules.has(m);
    });

    res.json({
      modules: finalModules,
      permissions: finalPermissions,
      role_features: finalRoleFeatures,
      licensed_modules: Array.from(licensedModules || []),
    });
  } catch (err) {
    next(err);
  }
});

// ===== System Settings (Cloudinary) =====
async function ensureSystemSettingsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_system_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NULL,
      branch_id BIGINT UNSIGNED NULL,
      setting_key VARCHAR(150) NOT NULL,
      setting_value TEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_setting (company_id, branch_id, setting_key),
      KEY idx_setting_key (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

router.get(
  "/settings/cloudinary",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `
        SELECT setting_key, setting_value,
          created_at,
          u.username AS created_by_name
         FROM adm_system_settings
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE (company_id = :companyId OR company_id IS NULL)
          AND ((:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
          AND setting_key IN ('CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','CLOUDINARY_UPLOAD_FOLDER')
        ORDER BY company_id DESC, branch_id DESC
        `,
        { companyId: companyId ?? null, branchId: branchId ?? null, branchIdsStr },
      );
      const map = {};
      for (const r of rows) map[r.setting_key] = r.setting_value;
      res.json({
        data: {
          cloud_name: map.CLOUDINARY_CLOUD_NAME || "",
          api_key: map.CLOUDINARY_API_KEY || "",
          has_secret: map.CLOUDINARY_API_SECRET != null,
          folder: map.CLOUDINARY_UPLOAD_FOLDER || "",
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/settings/cloudinary",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const body = req.body || {};
      const cloud_name = String(body.cloud_name || "").trim();
      const api_key = String(body.api_key || "").trim();
      const api_secret = String(body.api_secret || "").trim();
      const folder = String(body.folder || "").trim();
      if (!cloud_name || !api_key || !api_secret) {
        return res
          .status(400)
          .json({ message: "cloud_name, api_key and api_secret are required" });
      }
      await query(
        `
        INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
        VALUES 
          (:companyId, :branchId, 'CLOUDINARY_CLOUD_NAME', :cloud_name),
          (:companyId, :branchId, 'CLOUDINARY_API_KEY', :api_key),
          (:companyId, :branchId, 'CLOUDINARY_API_SECRET', :api_secret)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        `,
        {
          companyId: companyId ?? null,
          branchId: branchId ?? null, branchIdsStr,
          cloud_name,
          api_key,
          api_secret,
        },
      );
      await query(
        `
        INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
        VALUES (:companyId, :branchId, 'CLOUDINARY_UPLOAD_FOLDER', :folder)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        `,
        { companyId: companyId ?? null, branchId: branchId ?? null, branchIdsStr, folder },
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/settings/google-maps",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      let apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
      
      if (!apiKey) {
        await ensureSystemSettingsTable();
        const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
        const rows = await query(
          `
          SELECT setting_key, setting_value
           FROM adm_system_settings
           WHERE (company_id = :companyId OR company_id IS NULL)
            AND ((:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
            AND setting_key = 'GOOGLE_MAPS_API_KEY'
          ORDER BY company_id DESC, branch_id DESC
          LIMIT 1
          `,
          { companyId: companyId ?? null, branchId: branchId ?? null, branchIdsStr },
        );
        if (rows.length > 0 && rows[0].setting_value) {
          apiKey = rows[0].setting_value;
        }
      }

      res.json({
        data: {
          api_key: apiKey,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/settings/google-maps",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const api_key = String(req.body?.api_key || "").trim();

      if (api_key === "********") {
        return res.json({ success: true, message: "No change" });
      }

      // 1. Update in-memory process.env
      process.env.GOOGLE_MAPS_API_KEY = api_key;

      // 2. Write to server/.env and root .env files
      const fs = await import("fs");
      const path = await import("path");
      
      const envPaths = [
        path.resolve(process.cwd(), ".env"),
        path.resolve(process.cwd(), "server", ".env"),
      ];

      for (const envPath of envPaths) {
        try {
          let content = "";
          if (fs.existsSync(envPath)) {
            content = fs.readFileSync(envPath, "utf-8");
          }
          let lines = content ? content.split(/\r?\n/) : [];
          const index = lines.findIndex(line => line.startsWith("GOOGLE_MAPS_API_KEY="));
          if (index >= 0) {
            lines[index] = `GOOGLE_MAPS_API_KEY=${api_key}`;
          } else {
            lines.push(`GOOGLE_MAPS_API_KEY=${api_key}`);
          }
          fs.writeFileSync(envPath, lines.join("\n"));
        } catch (e) {
          console.error(`Failed writing GOOGLE_MAPS_API_KEY to ${envPath}:`, e);
        }
      }

      // 3. Dual-storage sync to DB
      await ensureSystemSettingsTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      await query(
        `
        INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
        VALUES (:companyId, :branchId, 'GOOGLE_MAPS_API_KEY', :api_key)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        `,
        { companyId: companyId ?? null, branchId: branchId ?? null, branchIdsStr, api_key },
      );

      res.json({ success: true, message: "Google Maps API Key saved to .env file and environment." });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/settings/branch-sharing",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      const { companyId } = req.scope || {};
      const rows = await query(
        `SELECT setting_key, setting_value
         FROM adm_system_settings
         WHERE (company_id = :companyId OR company_id IS NULL)
           AND setting_key IN ('BRANCH_SHARE_CUSTOMERS', 'BRANCH_SHARE_SUPPLIERS', 'BRANCH_SHARE_ITEMS')
         ORDER BY company_id DESC`,
        { companyId: companyId ?? null },
      );
      const map = {};
      for (const r of rows) {
        if (map[r.setting_key] === undefined) {
          map[r.setting_key] = r.setting_value;
        }
      }
      res.json({
        data: {
          share_customers: map.BRANCH_SHARE_CUSTOMERS === "1" || map.BRANCH_SHARE_CUSTOMERS === "true",
          share_suppliers: map.BRANCH_SHARE_SUPPLIERS === "1" || map.BRANCH_SHARE_SUPPLIERS === "true",
          share_items: map.BRANCH_SHARE_ITEMS === "1" || map.BRANCH_SHARE_ITEMS === "true",
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/settings/branch-sharing",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      const { companyId } = req.scope || {};
      const body = req.body || {};
      const shareCustomers = body.share_customers ? "1" : "0";
      const shareSuppliers = body.share_suppliers ? "1" : "0";
      const shareItems = body.share_items ? "1" : "0";

      await query(
        `INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
         VALUES 
           (:companyId, NULL, 'BRANCH_SHARE_CUSTOMERS', :shareCustomers),
           (:companyId, NULL, 'BRANCH_SHARE_SUPPLIERS', :shareSuppliers),
           (:companyId, NULL, 'BRANCH_SHARE_ITEMS', :shareItems)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
        {
          companyId: companyId ?? null,
          shareCustomers,
          shareSuppliers,
          shareItems,
        },
      );
      res.json({ success: true, message: "Branch data sharing settings saved successfully" });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/settings/pos-day-control",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      const { companyId } = req.scope || {};
      const rows = await query(
        `SELECT setting_key, setting_value
         FROM adm_system_settings
         WHERE (company_id = :companyId OR company_id IS NULL)
           AND setting_key IN ('POS_ENABLE_DAY_OPEN_CLOSE', 'POS_AUTO_FINANCE_SALES_ACCOUNT_ID')
         ORDER BY company_id DESC`,
        { companyId: companyId ?? null }
      );
      const map = {};
      for (const r of rows) {
        if (map[r.setting_key] === undefined) {
          map[r.setting_key] = r.setting_value;
        }
      }

      const enableDayOpenClose =
        map.POS_ENABLE_DAY_OPEN_CLOSE === undefined ||
        map.POS_ENABLE_DAY_OPEN_CLOSE === null ||
        map.POS_ENABLE_DAY_OPEN_CLOSE === "1" ||
        map.POS_ENABLE_DAY_OPEN_CLOSE === "true";

      const salesAccountId = map.POS_AUTO_FINANCE_SALES_ACCOUNT_ID || null;

      const paymentModes = await query(
        `SELECT pm.id, pm.name, pm.type, pm.account, pm.is_active,
                a.code AS account_code, a.name AS account_name
         FROM pos_payment_modes pm
         LEFT JOIN fin_accounts a ON (a.id = pm.account OR a.code = pm.account) AND a.company_id = pm.company_id
         WHERE pm.company_id = :companyId AND pm.is_active = 1`,
        { companyId: companyId ?? null }
      ).catch(() => []);

      const taxSettings = await query(
        `SELECT ts.tax_account_id, a.code AS tax_account_code, a.name AS tax_account_name
         FROM pos_tax_settings ts
         LEFT JOIN fin_accounts a ON a.id = ts.tax_account_id AND a.company_id = ts.company_id
         WHERE ts.company_id = :companyId LIMIT 1`,
        { companyId: companyId ?? null }
      ).catch(() => []);

      let salesAccountInfo = null;
      if (salesAccountId) {
        const sRows = await query(
          `SELECT id, code, name FROM fin_accounts WHERE company_id = :companyId AND id = :id LIMIT 1`,
          { companyId: companyId ?? null, id: salesAccountId }
        ).catch(() => []);
        if (sRows.length > 0) salesAccountInfo = sRows[0];
      }
      if (!salesAccountInfo) {
        const defRows = await query(
          `SELECT id, code, name FROM fin_accounts
           WHERE company_id = :companyId AND is_active = 1 AND (code IN ('4000', '400000') OR LOWER(name) LIKE '%sales revenue%')
           ORDER BY CASE WHEN code = '4000' THEN 0 ELSE 1 END LIMIT 1`,
          { companyId: companyId ?? null }
        ).catch(() => []);
        if (defRows.length > 0) salesAccountInfo = defRows[0];
      }

      res.json({
        data: {
          enable_day_open_close: enableDayOpenClose,
          sales_account_id: salesAccountId ? String(salesAccountId) : (salesAccountInfo ? String(salesAccountInfo.id) : ""),
          sales_account: salesAccountInfo,
          payment_modes: paymentModes,
          tax_account: taxSettings?.[0] || null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/settings/pos-day-control",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      const { companyId } = req.scope || {};
      const body = req.body || {};
      const enableVal = body.enable_day_open_close === false || body.enable_day_open_close === "0" ? "0" : "1";
      const salesAccId = body.sales_account_id ? String(body.sales_account_id) : "";

      await query(
        `INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
         VALUES 
           (:companyId, NULL, 'POS_ENABLE_DAY_OPEN_CLOSE', :enableVal),
           (:companyId, NULL, 'POS_AUTO_FINANCE_SALES_ACCOUNT_ID', :salesAccId)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
        {
          companyId: companyId ?? null,
          enableVal,
          salesAccId,
        }
      );
      res.json({ success: true, message: "Day Open & Close settings saved successfully" });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/settings/pos-day-control/test-auto-post",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope || {};
      const date = req.body?.date || new Date().toISOString().slice(0, 10);
      const outcome = await autoPostMidnightPosSalesToFinance({
        targetDate: date,
        specificCompanyId: companyId,
        specificBranchId: branchId,
        isManualTest: true,
      });
      res.json({ success: true, data: outcome });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/settings/app-mode",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      const { companyId } = req.scope || {};
      const rows = await query(
        `SELECT setting_key, setting_value
         FROM adm_system_settings
         WHERE (company_id = :companyId OR company_id IS NULL)
           AND setting_key IN ('SYSTEM_APPLICATION_MODE', 'MODULE_HOME_SECTION_VIEW')
         ORDER BY company_id DESC`,
        { companyId: companyId ?? null }
      );
      let rawMode = "STANDARD";
      let sectionView = false;
      for (const r of rows) {
        if (r.setting_key === "SYSTEM_APPLICATION_MODE") {
          rawMode = r.setting_value ? String(r.setting_value).toUpperCase() : "STANDARD";
        } else if (r.setting_key === "MODULE_HOME_SECTION_VIEW") {
          sectionView = r.setting_value === "true" || r.setting_value === "1";
        }
      }
      const mode = rawMode === "BASIC" ? "BASIC" : "STANDARD";
      res.json({ success: true, mode, module_section_view: sectionView });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/settings/app-mode",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      const { companyId } = req.scope || {};
      const requestedMode = String(req.body?.mode || "STANDARD").toUpperCase() === "BASIC" ? "BASIC" : "STANDARD";
      const moduleSectionView = req.body?.module_section_view === true || req.body?.module_section_view === "true" || req.body?.module_section_view === 1 || req.body?.module_section_view === "1";

      await query(
        `DELETE FROM adm_system_settings 
         WHERE setting_key = 'SYSTEM_APPLICATION_MODE' AND (company_id = :companyId OR (:companyId IS NULL AND company_id IS NULL))`,
        { companyId: companyId ?? null }
      );
      await query(
        `INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
         VALUES (:companyId, NULL, 'SYSTEM_APPLICATION_MODE', :mode)`,
        {
          companyId: companyId ?? null,
          mode: requestedMode,
        }
      );

      if (req.body?.module_section_view !== undefined) {
        await query(
          `DELETE FROM adm_system_settings 
           WHERE setting_key = 'MODULE_HOME_SECTION_VIEW' AND (company_id = :companyId OR (:companyId IS NULL AND company_id IS NULL))`,
          { companyId: companyId ?? null }
        );
        await query(
          `INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
           VALUES (:companyId, NULL, 'MODULE_HOME_SECTION_VIEW', :sectionView)`,
          {
            companyId: companyId ?? null,
            sectionView: moduleSectionView ? "true" : "false",
          }
        );
      }

      res.json({
        success: true,
        message: `Application settings updated`,
        mode: requestedMode,
        module_section_view: moduleSectionView,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ===== Application Background Settings =====
router.get(
  "/settings/app-background",
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      await ensureAppBackgroundColumns().catch(() => {});
      const companyId = req.scope?.companyId ?? null;

      const rows = await query(
        `SELECT setting_key, setting_value
         FROM adm_system_settings
         WHERE (company_id = :companyId OR company_id IS NULL)
           AND setting_key IN ('APP_BACKGROUND_URL', 'APP_BACKGROUND_PRESET', 'APP_BACKGROUND_OPACITY', 'APP_BACKGROUND_BLUR')
         ORDER BY company_id DESC`,
        { companyId }
      );

      const map = {};
      for (const r of rows) {
        if (map[r.setting_key] === undefined) {
          map[r.setting_key] = r.setting_value;
        }
      }

      let hasCustom = false;
      let customVersion = null;
      try {
        if (fs.existsSync(appBgUploadDir)) {
          const files = fs.readdirSync(appBgUploadDir).filter((f) => f.startsWith("custom-bg-"));
          if (files.length > 0) {
            hasCustom = true;
            const stat = fs.statSync(path.join(appBgUploadDir, files[0]));
            customVersion = Math.round(stat.mtimeMs);
          }
        }
      } catch {}
      if (!hasCustom) {
        try {
          const customRows = await query(
            `SELECT app_bg_image IS NOT NULL AS has_image, updated_at
             FROM adm_login_branding
             WHERE id = 1
             LIMIT 1`
          );
          if (customRows[0]?.has_image) {
            hasCustom = true;
            customVersion = customRows[0]?.updated_at ? new Date(customRows[0].updated_at).getTime() : Date.now();
          }
        } catch {}
      }

      const defaultUrl = "/backgrounds/abstract-silk-waves.jpg";
      const backgroundUrl = map.APP_BACKGROUND_URL !== undefined ? map.APP_BACKGROUND_URL : defaultUrl;
      const backgroundPreset = map.APP_BACKGROUND_PRESET !== undefined ? map.APP_BACKGROUND_PRESET : "silk-waves";
      const backgroundOpacity = map.APP_BACKGROUND_OPACITY !== undefined ? Number(map.APP_BACKGROUND_OPACITY) : 40;
      const backgroundBlur = map.APP_BACKGROUND_BLUR !== undefined ? Number(map.APP_BACKGROUND_BLUR) : 0;

      res.json({
        success: true,
        background_url: backgroundUrl,
        background_preset: backgroundPreset,
        background_opacity: Number.isFinite(backgroundOpacity) ? backgroundOpacity : 40,
        background_blur: Number.isFinite(backgroundBlur) ? backgroundBlur : 0,
        has_custom: hasCustom,
        custom_url: hasCustom ? `/api/admin/settings/app-background/image?v=${customVersion || Date.now()}` : null,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/settings/app-background",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      const companyId = req.scope?.companyId ?? null;
      const {
        background_url = "/backgrounds/abstract-silk-waves.jpg",
        background_preset = "silk-waves",
        background_opacity = 40,
        background_blur = 0,
      } = req.body || {};

      const settings = [
        { key: "APP_BACKGROUND_URL", value: String(background_url || "") },
        { key: "APP_BACKGROUND_PRESET", value: String(background_preset || "silk-waves") },
        { key: "APP_BACKGROUND_OPACITY", value: String(background_opacity ?? 40) },
        { key: "APP_BACKGROUND_BLUR", value: String(background_blur ?? 0) },
      ];

      for (const s of settings) {
        await query(
          `DELETE FROM adm_system_settings 
           WHERE setting_key = :key AND (company_id = :companyId OR (:companyId IS NULL AND company_id IS NULL))`,
          { companyId, key: s.key }
        );
        await query(
          `INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
           VALUES (:companyId, NULL, :key, :value)`,
          {
            companyId,
            key: s.key,
            value: s.value,
          }
        );
      }

      res.json({
        success: true,
        message: "Application background settings saved successfully",
        background_url,
        background_preset,
        background_opacity,
        background_blur,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/settings/app-background/upload",
  requireAuth,
  requireCompanyScope,
  appBackgroundUpload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw httpError(400, "VALIDATION_ERROR", "Background image file is required");
      }

      // Remove older custom background files on disk so only the current one is kept
      try {
        if (fs.existsSync(appBgUploadDir)) {
          const currentFilename = path.basename(req.file.path);
          const files = fs.readdirSync(appBgUploadDir).filter((f) => f.startsWith("custom-bg-") && f !== currentFilename);
          for (const f of files) {
            try { fs.unlinkSync(path.join(appBgUploadDir, f)); } catch {}
          }
        }
      } catch {}

      const customUrl = `/api/admin/settings/app-background/image?v=${Date.now()}`;
      const companyId = req.scope?.companyId ?? null;

      await query(
        `DELETE FROM adm_system_settings 
         WHERE setting_key IN ('APP_BACKGROUND_URL', 'APP_BACKGROUND_PRESET')
           AND (company_id = :companyId OR (:companyId IS NULL AND company_id IS NULL))`,
        { companyId }
      );
      await query(
        `INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
         VALUES (:companyId, NULL, 'APP_BACKGROUND_URL', :url)`,
        { companyId, url: customUrl }
      );
      await query(
        `INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
         VALUES (:companyId, NULL, 'APP_BACKGROUND_PRESET', 'custom')`,
        { companyId }
      );

      res.json({
        success: true,
        message: "Custom background image uploaded and saved successfully",
        background_url: customUrl,
        background_preset: "custom",
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/settings/app-background/image", async (req, res, next) => {
  try {
    if (fs.existsSync(appBgUploadDir)) {
      const files = fs.readdirSync(appBgUploadDir).filter((f) => f.startsWith("custom-bg-"));
      if (files.length > 0) {
        const latestFile = files.sort().reverse()[0];
        const fullPath = path.join(appBgUploadDir, latestFile);
        res.setHeader("Cache-Control", "public, max-age=300");
        return res.sendFile(fullPath);
      }
    }

    // Fallback to adm_login_branding if previously stored in DB
    await ensureAppBackgroundColumns().catch(() => {});
    const rows = await query(
      `SELECT app_bg_image, app_bg_mime
       FROM adm_login_branding
       WHERE id = 1
       LIMIT 1`
    );
    const row = rows[0] || null;
    if (!row?.app_bg_image) return res.status(404).end();
    const body = Buffer.isBuffer(row.app_bg_image)
      ? row.app_bg_image
      : Buffer.from(row.app_bg_image);
    res.setHeader("Content-Type", row.app_bg_mime || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.end(body);
  } catch (err) {
    next(err);
  }
});

router.delete(
  "/settings/app-background/custom",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      if (fs.existsSync(appBgUploadDir)) {
        const files = fs.readdirSync(appBgUploadDir).filter((f) => f.startsWith("custom-bg-"));
        for (const f of files) {
          try { fs.unlinkSync(path.join(appBgUploadDir, f)); } catch {}
        }
      }
      await ensureAppBackgroundColumns().catch(() => {});
      await query(
        `UPDATE adm_login_branding
         SET app_bg_image = NULL, app_bg_mime = NULL
         WHERE id = 1`
      ).catch(() => {});

      const companyId = req.scope?.companyId ?? null;
      const defaultUrl = "/backgrounds/abstract-silk-waves.jpg";

      await query(
        `DELETE FROM adm_system_settings 
         WHERE setting_key IN ('APP_BACKGROUND_URL', 'APP_BACKGROUND_PRESET')
           AND (company_id = :companyId OR (:companyId IS NULL AND company_id IS NULL))`,
        { companyId }
      );
      await query(
        `INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
         VALUES (:companyId, NULL, 'APP_BACKGROUND_URL', :url)`,
        { companyId, url: defaultUrl }
      );
      await query(
        `INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
         VALUES (:companyId, NULL, 'APP_BACKGROUND_PRESET', 'silk-waves')`,
        { companyId }
      );

      res.json({ success: true, message: "Custom background removed and reset to default preset", default_url: defaultUrl });
    } catch (err) {
      next(err);
    }
  }
);

router.post("/email/test", requireAuth, async (req, res, next) => {
  try {
    const to =
      String(req.body?.to || "").trim() || String(req.user?.email || "");
    const configured = isMailerConfigured();
    if (!to) {
      return res.status(400).json({ message: "Recipient email required" });
    }
    let sent = false;
    if (configured) {
      try {
        const subject = "Test Email";
        const text = "Test email from OmniSuite";
        const html = "<p>Test email from OmniSuite</p>";
        sent = await sendMail({ to, subject, text, html });
      } catch {}
    }
    res.json({ configured, sent });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/companies/current",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  getCurrentCompany,
);

// ===== System Settings (Backups) =====
router.get(
  "/settings/backups",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `
        SELECT setting_key, setting_value
         FROM adm_system_settings
         WHERE (company_id = :companyId OR company_id IS NULL)
          AND ((:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
          AND setting_key IN (
            'BACKUP_S3_BUCKET', 'BACKUP_S3_REGION', 'BACKUP_S3_ENDPOINT', 'BACKUP_S3_ACCESS_KEY', 'BACKUP_S3_SECRET_KEY',
            'BACKUP_GDRIVE_CLIENT_EMAIL', 'BACKUP_GDRIVE_PRIVATE_KEY', 'BACKUP_GDRIVE_FOLDER_ID',
            'BACKUP_B2_BUCKET', 'BACKUP_B2_ENDPOINT', 'BACKUP_B2_ACCESS_KEY', 'BACKUP_B2_SECRET_KEY'
          )
        ORDER BY company_id DESC, branch_id DESC
        `,
        { companyId: companyId ?? null, branchId: branchId ?? null, branchIdsStr },
      );
      const map = {};
      for (const r of rows) map[r.setting_key] = r.setting_value;
      
      res.json({
        data: {
          s3: {
            bucket: map.BACKUP_S3_BUCKET || "",
            region: map.BACKUP_S3_REGION || "",
            endpoint: map.BACKUP_S3_ENDPOINT || "",
            access_key: map.BACKUP_S3_ACCESS_KEY || "",
            has_secret: !!map.BACKUP_S3_SECRET_KEY,
          },
          gdrive: {
            client_email: map.BACKUP_GDRIVE_CLIENT_EMAIL || "",
            folder_id: map.BACKUP_GDRIVE_FOLDER_ID || "",
            has_private_key: !!map.BACKUP_GDRIVE_PRIVATE_KEY,
          },
          b2: {
            bucket: map.BACKUP_B2_BUCKET || "",
            endpoint: map.BACKUP_B2_ENDPOINT || "",
            access_key: map.BACKUP_B2_ACCESS_KEY || "",
            has_secret: !!map.BACKUP_B2_SECRET_KEY,
          }
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/settings/backups",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureSystemSettingsTable();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const { s3 = {}, gdrive = {}, b2 = {} } = req.body || {};
      
      const updates = [];
      const addUpdate = (key, val) => {
        if (val !== undefined) updates.push([key, String(val).trim()]);
      };

      // S3
      addUpdate('BACKUP_S3_BUCKET', s3.bucket);
      addUpdate('BACKUP_S3_REGION', s3.region);
      addUpdate('BACKUP_S3_ENDPOINT', s3.endpoint);
      addUpdate('BACKUP_S3_ACCESS_KEY', s3.access_key);
      if (s3.secret_key) addUpdate('BACKUP_S3_SECRET_KEY', s3.secret_key);

      // GDrive
      addUpdate('BACKUP_GDRIVE_CLIENT_EMAIL', gdrive.client_email);
      addUpdate('BACKUP_GDRIVE_FOLDER_ID', gdrive.folder_id);
      if (gdrive.private_key) addUpdate('BACKUP_GDRIVE_PRIVATE_KEY', gdrive.private_key);

      // B2
      addUpdate('BACKUP_B2_BUCKET', b2.bucket);
      addUpdate('BACKUP_B2_ENDPOINT', b2.endpoint);
      addUpdate('BACKUP_B2_ACCESS_KEY', b2.access_key);
      if (b2.secret_key) addUpdate('BACKUP_B2_SECRET_KEY', b2.secret_key);

      for (const [key, value] of updates) {
        await query(
          `
          INSERT INTO adm_system_settings (company_id, branch_id, setting_key, setting_value)
          VALUES (:companyId, :branchId, :key, :value)
          ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
          `,
          { companyId: companyId ?? null, branchId: branchId ?? null, branchIdsStr, key, value }
        );
      }
      
      res.json({ message: "Backup settings saved successfully" });
    } catch (err) {
      next(err);
    }
  },
);


// ==========================================
// Admin Page Permissions Routes
// ==========================================

router.get('/exclusive-permissions', requireAuth, async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT p.*, u.username, u.full_name 
      FROM adm_admin_page_permissions p
      JOIN adm_users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/exclusive-permissions', requireAuth, async (req, res, next) => {
  try {
    const { user_id, module_key, feature_key } = req.body;
    if (!user_id || !module_key || !feature_key) {
      throw httpError(400, "Missing required fields");
    }
    
    // Check super admin 
    const superRes = await query("SELECT value FROM app_settings WHERE `key` = 'super_admin_id'").catch(()=>[]);
    const superIdVal = superRes[0]?.value || (superRes.rows && superRes.rows[0]?.value);
    const superId = superIdVal ? parseInt(superIdVal, 10) : 1;
    if (req.user.id !== superId) {
       throw httpError(403, "Only Super Admin can assign page permissions");
    }

    await query(
      `INSERT INTO adm_admin_page_permissions (user_id, module_key, feature_key) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE module_key=VALUES(module_key)`,
      [user_id, module_key, feature_key]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/exclusive-permissions/:id', requireAuth, async (req, res, next) => {
  try {
    // Check super admin 
    const superRes = await query("SELECT value FROM app_settings WHERE `key` = 'super_admin_id'").catch(()=>[]);
    const superIdVal = superRes[0]?.value || (superRes.rows && superRes.rows[0]?.value);
    const superId = superIdVal ? parseInt(superIdVal, 10) : 1;
    if (req.user.id !== superId) {
       throw httpError(403, "Only Super Admin can delete page permissions");
    }

    await query("DELETE FROM adm_admin_page_permissions WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /admin/notification-settings
router.get("/notification-settings", requireAuth, requireCompanyScope, async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const settings = await query(
      "SELECT * FROM adm_notification_settings WHERE company_id = ?",
      [companyId]
    );
    res.json({ items: settings });
  } catch (err) {
    next(err);
  }
});

// POST /admin/notification-settings
router.post("/notification-settings", requireAuth, requireCompanyScope, async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      throw httpError(400, "VALIDATION_ERROR", "items array is required");
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const item of items) {
        const { module_code, status_trigger, send_email, send_sms, send_whatsapp, recipients } = item;
        if (!module_code || !status_trigger) continue;

        await conn.query(
          `INSERT INTO adm_notification_settings 
           (company_id, module_code, status_trigger, send_email, send_sms, send_whatsapp, recipients) 
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           send_email = VALUES(send_email),
           send_sms = VALUES(send_sms),
           send_whatsapp = VALUES(send_whatsapp),
           recipients = VALUES(recipients)`,
          [
            companyId, module_code, status_trigger, 
            send_email || 'N', send_sms || 'N', send_whatsapp || 'N',
            recipients || null
          ]
        );
      }

      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});
// GET /admin/settings/compliance-template
router.get("/settings/compliance-template", requireAuth, requireCompanyScope, async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const [row] = await query(
      "SELECT setting_value FROM adm_system_settings WHERE company_id = ? AND setting_key = 'compliance_notification_template'",
      [companyId]
    );
    res.json({ template: row ? row.setting_value : "" });
  } catch (err) {
    next(err);
  }
});

// POST /admin/settings/compliance-template
router.post("/settings/compliance-template", requireAuth, requireCompanyScope, async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { template } = req.body;
    await query(
      `INSERT INTO adm_system_settings (company_id, setting_key, setting_value) 
       VALUES (?, 'compliance_notification_template', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [companyId, template]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /admin/settings/servicing-template
router.get("/settings/servicing-template", requireAuth, requireCompanyScope, async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const [row] = await query(
      "SELECT setting_value FROM adm_system_settings WHERE company_id = ? AND setting_key = 'servicing_notification_template'",
      [companyId]
    );
    res.json({ template: row ? row.setting_value : "" });
  } catch (err) {
    next(err);
  }
});

// POST /admin/settings/servicing-template
router.post("/settings/servicing-template", requireAuth, requireCompanyScope, async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { template } = req.body;
    await query(
      `INSERT INTO adm_system_settings (company_id, setting_key, setting_value) 
       VALUES (?, 'servicing_notification_template', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [companyId, template]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/settings/env", requireAuth, async (req, res, next) => {
  try {
    if (req.user.id !== 1) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const fs = await import("fs");
    const path = await import("path");
    const envPath = path.resolve(process.cwd(), ".env");
    let content = "";
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, "utf-8");
    }
    const envVars = {};
    content.split(/\r?\n/).forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envVars[match[1].trim()] = match[2].trim();
      }
    });
    return res.json({
      GOOGLE_MAPS_API_KEY: envVars.GOOGLE_MAPS_API_KEY ? "********" : "",
      GROQ_API_KEY: envVars.GROQ_API_KEY ? "********" : "",
      ARKESEL_API_KEY: envVars.ARKESEL_API_KEY ? "********" : "",
      ARKESEL_SENDER_ID: envVars.ARKESEL_SENDER_ID ? "********" : "",
      GREEN_API_ID_INSTANCE: envVars.GREEN_API_ID_INSTANCE || "",
      GREEN_API_TOKEN_INSTANCE: envVars.GREEN_API_TOKEN_INSTANCE ? "********" : "",
      SMTP_HOST: envVars.SMTP_HOST || "",
      SMTP_PORT: envVars.SMTP_PORT || "",
      SMTP_USER: envVars.SMTP_USER || "",
      SMTP_PASS: envVars.SMTP_PASS ? "********" : "",
      SMTP_FROM: envVars.SMTP_FROM || "",
      SMTP_SECURE: envVars.SMTP_SECURE || "false",
      TEMPLATE_SALES_ORDER: envVars.TEMPLATE_SALES_ORDER || "Dear {customer_name},\n\nYour Sales Order {document_no} for {amount} has been {status}.\n\nThank you!",
      TEMPLATE_PURCHASE_ORDER: envVars.TEMPLATE_PURCHASE_ORDER || "Dear {customer_name},\n\nYour Purchase Order {document_no} for {amount} has been {status}.\n\nThank you!",
      TEMPLATE_SERVICE_ORDER: envVars.TEMPLATE_SERVICE_ORDER || "Dear {customer_name},\n\nYour Service Order {document_no} for {amount} has been {status}.\n\nThank you!",
      TEMPLATE_MAINTENANCE_JOB: envVars.TEMPLATE_MAINTENANCE_JOB || "Dear {customer_name},\n\nYour Maintenance Job {document_no} has been {status}.\n\nThank you!",
      TEMPLATE_PAYMENT_VOUCHER: envVars.TEMPLATE_PAYMENT_VOUCHER || "Dear {customer_name},\n\nYour Payment Voucher {document_no} for {amount} has been {status}.\n\nThank you!",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/settings/env", requireAuth, async (req, res, next) => {
  try {
    if (req.user.id !== 1) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const fs = await import("fs");
    const path = await import("path");
    const envPath = path.resolve(process.cwd(), ".env");
    
    let content = "";
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, "utf-8");
    }

    const updates = req.body;
    const allowedKeys = [
      "GOOGLE_MAPS_API_KEY", "GROQ_API_KEY", "ARKESEL_API_KEY", "ARKESEL_SENDER_ID", "GREEN_API_ID_INSTANCE", "GREEN_API_TOKEN_INSTANCE",
      "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "SMTP_SECURE",
      "TEMPLATE_SALES_ORDER", "TEMPLATE_PURCHASE_ORDER", "TEMPLATE_SERVICE_ORDER", 
      "TEMPLATE_MAINTENANCE_JOB", "TEMPLATE_PAYMENT_VOUCHER"
    ];
    
    let lines = content.split(/\r?\n/);
    for (const key of allowedKeys) {
      if (updates[key] !== undefined && updates[key] !== "********") {
        const val = String(updates[key]);
        const index = lines.findIndex(line => line.startsWith(key + "="));
        if (index >= 0) {
          lines[index] = `${key}=${val}`;
        } else {
          lines.push(`${key}=${val}`);
        }
        process.env[key] = val; // Update in-memory
        if (key === "GROQ_API_KEY") {
          setRuntimeApiKey(val);
        }
      }
    }
    
    fs.writeFileSync(envPath, lines.join("\n"));
    return res.json({ message: "Environment variables updated successfully" });
  } catch (err) {
    next(err);
  }
});


router.get("/settings/announcements", requireAuth, async (req, res, next) => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`key\` VARCHAR(100) NOT NULL UNIQUE,
        value LONGTEXT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const rows = await query("SELECT value FROM app_settings WHERE `key` = 'upcoming_announcements' LIMIT 1");
    let announcements = [];
    if (rows[0]?.value) {
      try {
        const parsed = JSON.parse(rows[0].value);
        if (Array.isArray(parsed)) {
          announcements = parsed.filter(Boolean);
        } else {
          announcements = [rows[0].value];
        }
      } catch (e) {
        announcements = [rows[0].value];
      }
    }
    res.json({ announcements });
  } catch (err) {
    next(err);
  }
});

router.post("/settings/announcements", requireAuth, async (req, res, next) => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`key\` VARCHAR(100) NOT NULL UNIQUE,
        value LONGTEXT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const { announcements } = req.body;
    let val = "[]";
    if (Array.isArray(announcements)) {
      val = JSON.stringify(announcements.filter(Boolean).map(String));
    } else if (announcements) {
      val = JSON.stringify([String(announcements)]);
    }
    const rows = await query("SELECT id FROM app_settings WHERE `key` = 'upcoming_announcements'");
    if (rows.length > 0) {
      await query("UPDATE app_settings SET value = ? WHERE `key` = 'upcoming_announcements'", [val]);
    } else {
      await query("INSERT INTO app_settings (`key`, value) VALUES ('upcoming_announcements', ?)", [val]);
    }
    res.json({ success: true, announcements: JSON.parse(val) });
  } catch (err) {
    next(err);
  }
});

export default router;
