/**
 * @fileoverview Module Permission Guardrails for Banks AI.
 * Strictly prevents users from accessing information or asking questions
 * about ERP modules they do not have permissions for.
 */

export const MODULE_REGISTRY_MAP = [
  {
    name: "Human Resources",
    moduleKey: "hr",
    aliases: ["hr", "human_resource", "human-resource", "human-resources", "human_resources"],
    keywords: [
      "employee", "employees", "staff", "payroll", "salary", "salaries", "payslip",
      "payslips", "wage", "wages", "leave", "leaves", "attendance", "appraisal",
      "appraisals", "headcount", "recruitment", "interview", "overtime", "job position",
      "hr department", "hiring", "worker", "workers", "roster"
    ],
    tables: [
      "hr_employees", "hr_payroll", "hr_salaries", "hr_leave", "hr_attendance",
      "hr_appraisals", "hr_departments", "hr_designations", "hr_job_applications",
      "hr_trainings", "hr_leave_roster_details"
    ],
  },
  {
    name: "Sales",
    moduleKey: "sales",
    aliases: ["sales", "sal"],
    keywords: [
      "customer invoice", "customer invoices", "sales order", "sales orders", "quotation",
      "quotations", "sales revenue", "customer balance", "debtor", "debtors",
      "accounts receivable", "delivery note", "credit limit", "customer payment",
      "sales return", "sales returns", "proforma"
    ],
    tables: [
      "sal_invoices", "sal_invoice_items", "sal_orders", "sal_order_details",
      "sal_customers", "sal_quotations", "sal_deliveries", "sal_returns"
    ],
  },
  {
    name: "Point of Sale",
    moduleKey: "pos",
    aliases: ["pos"],
    keywords: [
      "pos", "point of sale", "cash register", "retail register", "cashier", "shift sales",
      "till", "expected cash", "cash variance", "day close", "day open", "pos receipt"
    ],
    tables: [
      "pos_sales", "pos_sale_lines", "pos_orders", "pos_sessions", "pos_shifts",
      "pos_cash_management", "pos_registers"
    ],
  },
  {
    name: "Purchases & Procurement",
    moduleKey: "purchase",
    aliases: ["purchase", "purchases", "pur", "procurement"],
    keywords: [
      "purchase order", "purchase orders", "purchase bill", "purchase bills", "supplier bill",
      "supplier bills", "vendor", "vendors", "supplier", "suppliers", "procurement",
      "goods receipt", "grn", "rfq", "direct purchase", "clearing at port", "shipping advice"
    ],
    tables: [
      "pur_orders", "pur_order_details", "pur_bills", "pur_bill_details",
      "pur_suppliers", "pur_direct_purchase_hdr", "pur_rfqs", "pur_goods_receipts"
    ],
  },
  {
    name: "Inventory & Warehousing",
    moduleKey: "inventory",
    aliases: ["inventory", "inv"],
    keywords: [
      "inventory", "stock", "stock balance", "items", "item master", "warehouse",
      "warehouses", "reorder level", "stock valuation", "low stock", "stock take",
      "stock adjustment", "stock transfer", "uom", "sku", "material requisition"
    ],
    tables: [
      "inv_items", "inv_stock_balances", "inv_warehouses", "inv_stock_transfers",
      "inv_material_requisitions", "inv_uom", "inv_categories"
    ],
  },
  {
    name: "Finance & Accounts",
    moduleKey: "finance",
    aliases: ["finance", "fin", "accounts", "accounting"],
    keywords: [
      "general ledger", "chart of accounts", "voucher", "vouchers", "journal entry",
      "journal entries", "trial balance", "balance sheet", "profit and loss", "p&l",
      "vat", "tax code", "withholding tax", "bank account", "bank accounts",
      "bank reconciliation", "fiscal year"
    ],
    tables: [
      "fin_vouchers", "fin_voucher_lines", "fin_accounts", "fin_account_balances",
      "fin_fiscal_years", "fin_tax_details", "fin_banks"
    ],
  },
  {
    name: "Production & Manufacturing",
    moduleKey: "production",
    aliases: ["production", "prod", "manufacturing"],
    keywords: [
      "production", "work order", "work orders", "bom", "bill of materials", "manufacturing",
      "machine", "machines", "downtime", "qc pass", "quality control", "production plan",
      "factory", "batch number"
    ],
    tables: [
      "prod_work_orders", "prod_boms", "prod_daily_plans", "prod_operations", "prod_machines"
    ],
  },
  {
    name: "Project Management",
    moduleKey: "projects",
    aliases: ["projects", "project_management", "project-management", "pm"],
    keywords: [
      "project", "projects", "milestone", "milestones", "site activity", "site report",
      "project budget", "site material", "site workforce", "project invoice", "project quotation"
    ],
    tables: [
      "pm_projects", "pm_tasks", "pm_daily_site_reports", "prj_invoices", "prj_quotations"
    ],
  },
  {
    name: "Transport & Fleet",
    moduleKey: "transport",
    aliases: ["transport", "trans"],
    keywords: [
      "transport", "fleet", "vehicle", "vehicles", "driver", "drivers", "trip", "trips",
      "fuel log", "fuel logs", "odometer", "fuel expense", "dispatch", "dispatches", "breakdown"
    ],
    tables: [
      "trans_vehicles", "trans_drivers", "trans_trips", "trans_fuel_logs",
      "trans_fuel_bills", "trans_deliveries"
    ],
  },
  {
    name: "Maintenance & Equipment",
    moduleKey: "maintenance",
    aliases: ["maintenance", "maint"],
    keywords: [
      "maintenance", "equipment", "job order", "job orders", "repair", "repairs",
      "servicing", "maintenance request", "maintenance schedule", "meter reading"
    ],
    tables: [
      "maint_equipment", "maint_job_orders", "maint_requests", "maint_schedules", "maint_assets"
    ],
  },
  {
    name: "Facilities Management",
    moduleKey: "facilities",
    aliases: ["facilities", "facilities_management", "facilities-management"],
    keywords: [
      "facility", "facilities", "building", "buildings", "property", "properties",
      "site inspection", "lease", "leases", "tenant", "tenants", "facility inspection"
    ],
    tables: [
      "fac_facilities", "fac_properties", "fac_leases", "fac_inspections"
    ],
  },
  {
    name: "Asset Management",
    moduleKey: "assets",
    aliases: ["assets", "asset_management", "asset-management"],
    keywords: [
      "asset", "assets", "fixed asset", "fixed assets", "depreciation", "asset register",
      "asset code", "asset tag", "asset disposal", "asset revaluation"
    ],
    tables: [
      "ast_fixed_assets", "ast_asset_register", "ast_depreciation_engine", "ast_disposals"
    ],
  },
  {
    name: "Administration & Access Control",
    moduleKey: "administration",
    aliases: ["administration", "admin"],
    keywords: [
      "user permissions", "exceptional permissions", "role permissions", "system settings",
      "system logs", "audit log", "audit logs", "api keys", "admin users", "user account"
    ],
    tables: [
      "adm_users", "adm_roles", "adm_role_permissions", "adm_exceptional_permissions",
      "adm_system_settings", "adm_system_logs"
    ],
  },
];

/**
 * Checks if the user's prompt inquires about a module they do not have permissions for.
 *
 * @param {string} prompt User prompt text
 * @param {object} userContext { roleName, isSuperAdmin, allowedModules }
 * @returns {{ allowed: boolean, moduleName?: string, moduleKey?: string, message?: string }}
 */
export function checkPromptModulePermission(prompt, userContext = {}) {
  const { isSuperAdmin = false, allowedModules = ["*"] } = userContext;

  // Superadmins and users with global wildcard access have unrestricted access
  if (isSuperAdmin || (Array.isArray(allowedModules) && allowedModules.includes("*"))) {
    return { allowed: true };
  }

  const normalizedAllowed = (Array.isArray(allowedModules) ? allowedModules : [allowedModules])
    .map((m) => String(m).toLowerCase().trim())
    .filter(Boolean);

  const text = String(prompt || "").toLowerCase();

  for (const mod of MODULE_REGISTRY_MAP) {
    // Check if the prompt asks about this module
    const matchesKeyword = mod.keywords.some((kw) => {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      return regex.test(text);
    });

    if (matchesKeyword) {
      // Check if user has permission to this module
      const isAuthorized = mod.aliases.some((alias) => normalizedAllowed.includes(alias.toLowerCase()));

      if (!isAuthorized) {
        return {
          allowed: false,
          moduleName: mod.name,
          moduleKey: mod.moduleKey,
          message: `⚠️ **Access Denied:** You do not have permissions to access any information or permission for the **${mod.name}** module. Therefore, access is denied.`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Checks if a SQL query touches any tables belonging to restricted modules.
 *
 * @param {string} sql SQL query string
 * @param {object} userContext User authorization context
 * @returns {{ allowed: boolean, moduleName?: string, message?: string }}
 */
export function checkSqlTablePermissions(sql, userContext = {}) {
  const { isSuperAdmin = false, allowedModules = ["*"] } = userContext;

  if (isSuperAdmin || (Array.isArray(allowedModules) && allowedModules.includes("*"))) {
    return { allowed: true };
  }

  const normalizedAllowed = (Array.isArray(allowedModules) ? allowedModules : [allowedModules])
    .map((m) => String(m).toLowerCase().trim())
    .filter(Boolean);

  const cleanSql = String(sql || "").toLowerCase();

  for (const mod of MODULE_REGISTRY_MAP) {
    const touchesTable = mod.tables.some((t) => cleanSql.includes(t.toLowerCase()));
    if (touchesTable) {
      const isAuthorized = mod.aliases.some((alias) => normalizedAllowed.includes(alias.toLowerCase()));
      if (!isAuthorized) {
        return {
          allowed: false,
          moduleName: mod.name,
          message: `Access Denied: You do not have permissions to access any information or permission for the ${mod.name} module. Therefore, access is denied.`,
        };
      }
    }
  }

  return { allowed: true };
}
