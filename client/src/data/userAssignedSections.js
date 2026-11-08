/**
 * @fileoverview Module Sections Registry and helper for sidebar navigation.
 * Maps all modules and their functional sections with their navigation targets,
 * icons, and feature keys.
 */

export const ALL_MODULE_SECTIONS = [
  // --- POINT OF SALE ---
  {
    moduleKey: "pos",
    modulePath: "/pos",
    title: "Transactions & Register",
    icon: "💳",
    path: "/pos/sales-entry",
    features: [
      "sales-entry",
      "day-management",
      "cash-collection",
      "invoices",
      "on-hold",
      "receipt-reprint",
      "returns",
      "customers",
    ],
  },
  {
    moduleKey: "pos",
    modulePath: "/pos",
    title: "Direct Procurement",
    icon: "📦",
    path: "/pos/direct-purchases",
    features: ["direct-purchase", "suppliers"],
  },
  {
    moduleKey: "pos",
    modulePath: "/pos",
    title: "Store Inventory",
    icon: "🏬",
    path: "/pos/items",
    features: [
      "items",
      "item-classification",
      "stock-balances",
      "stock-transfers",
      "transfer-acceptance",
      "stock-adjustments",
      "stock-reorder",
      "batches",
    ],
  },
  {
    moduleKey: "pos",
    modulePath: "/pos",
    title: "Finance & Cash Desk",
    icon: "💰",
    path: "/pos/payment-voucher",
    features: [
      "payment-voucher",
      "receipt-voucher",
      "contra-voucher",
      "post-to-finance",
    ],
  },
  {
    moduleKey: "pos",
    modulePath: "/pos",
    title: "Reports & Analytics",
    icon: "📊",
    path: "/pos/reports/sales-summary",
    features: [
      "profitandlossreport",
      "pricevariancereport",
      "supplierpayablesreport",
      "customeroutstandingreport",
      "purchaseregisterreport",
      "itempurchasehistoryreport",
      "supplieroutstandingreport",
      "purchasereturnsanalysisreport",
      "debtorsledgerreport",
      "voucherregisterreport",
      "outstandingreceivablereport",
      "paymentduereport",
      "stockbalancesreport",
      "fastmovingreport",
      "slowmovingreport",
      "expireditemsreport",
      "stockadjustmentsreport",
      "stocktransferreport",
      "inventoryhealthmonitorreport",
    ],
  },
  {
    moduleKey: "pos",
    modulePath: "/pos",
    title: "Setup",
    icon: "⚙️",
    path: "/pos/setup/terminals",
    features: ["terminals", "cash-drawers", "receipt-templates", "setup"],
  },

  // --- SALES ---
  {
    moduleKey: "sales",
    modulePath: "/sales",
    title: "Sales Transactions",
    icon: "💳",
    path: "/sales/quotations",
    features: [
      "quotations",
      "sales-orders",
      "invoices",
      "delivery",
      "returns",
      "sales-upload",
    ],
  },
  {
    moduleKey: "sales",
    modulePath: "/sales",
    title: "Pricing & Discounts",
    icon: "🏷️",
    path: "/sales/price-setup",
    features: ["price-setup", "discount-schemes"],
  },
  {
    moduleKey: "sales",
    modulePath: "/sales",
    title: "Customer Management",
    icon: "👥",
    path: "/sales/customers",
    features: [
      "customers",
      "customer-credit",
      "prospect-customers",
      "prospect-conversion",
      "bulk-upload",
    ],
  },
  {
    moduleKey: "sales",
    modulePath: "/sales",
    title: "Analytics & Reports",
    icon: "📊",
    path: "/sales/reports",
    features: [
      "salesregisterreport",
      "salesprofitabilityreport",
      "invoicesummaryreport",
      "debtorsbalancereport",
      "monthlysalestrendreport",
    ],
  },

  // --- INVENTORY ---
  {
    moduleKey: "inventory",
    modulePath: "/inventory",
    title: "Stock Operations",
    icon: "📦",
    path: "/inventory/stock",
    features: [
      "stock",
      "stock-balances",
      "material-requisitions",
      "stock-journal",
      "stock-transfers",
      "stock-adjustments",
      "stock-reorder",
      "batches",
    ],
  },
  {
    moduleKey: "inventory",
    modulePath: "/inventory",
    title: "Goods Receipt",
    icon: "📥",
    path: "/inventory/material-receipts",
    features: ["material-receipts", "transfer-acceptance"],
  },
  {
    moduleKey: "inventory",
    modulePath: "/inventory",
    title: "Setup & Parameters",
    icon: "⚙️",
    path: "/inventory/items",
    features: [
      "items",
      "item-classification",
      "units-of-measure",
      "warehouses",
      "storage-locations",
      "setup",
    ],
  },
  {
    moduleKey: "inventory",
    modulePath: "/inventory",
    title: "Reports & Valuation",
    icon: "📈",
    path: "/inventory/reports",
    features: ["stockbalancesreport", "stocksummaryreport", "reports"],
  },

  // --- PURCHASE ---
  {
    moduleKey: "purchase",
    modulePath: "/purchase",
    title: "Procurement",
    icon: "🛒",
    path: "/purchase/direct-purchase",
    features: [
      "direct-purchase",
      "general-requisitions",
      "rfqs",
      "supplier-quotations",
      "quotation-analysis",
    ],
  },
  {
    moduleKey: "purchase",
    modulePath: "/purchase",
    title: "Purchase Orders",
    icon: "📋",
    path: "/purchase/purchase-orders-local",
    features: ["purchase-orders-local", "purchase-orders-import"],
  },
  {
    moduleKey: "purchase",
    modulePath: "/purchase",
    title: "Logistics",
    icon: "🚚",
    path: "/purchase/shipping-advice",
    features: ["shipping-advice", "port-clearances"],
  },
  {
    moduleKey: "purchase",
    modulePath: "/purchase",
    title: "Billing",
    icon: "🧾",
    path: "/purchase/purchase-bills-local",
    features: [
      "purchase-bills-local",
      "purchase-bills-import",
      "purchase-upload",
    ],
  },
  {
    moduleKey: "purchase",
    modulePath: "/purchase",
    title: "Returns",
    icon: "↩",
    path: "/purchase/returns",
    features: ["returns", "purchase-returns"],
  },
  {
    moduleKey: "purchase",
    modulePath: "/purchase",
    title: "Master Data",
    icon: "🗂️",
    path: "/purchase/suppliers",
    features: ["suppliers", "item-purchase-history"],
  },
  {
    moduleKey: "purchase",
    modulePath: "/purchase",
    title: "Analytics & Reports",
    icon: "📊",
    path: "/purchase/reports",
    features: [
      "purchaseregisterreport",
      "pricevariancereport",
      "supplierpayablesreport",
      "reports",
    ],
  },

  // --- FINANCE ---
  {
    moduleKey: "finance",
    modulePath: "/finance",
    title: "Voucher Management",
    icon: "🧾",
    path: "/finance/journal-voucher",
    features: [
      "journal-voucher",
      "payment-voucher",
      "receipt-voucher",
      "contra-voucher",
      "credit-note",
      "debit-note",
      "sales-voucher",
      "purchase-voucher",
    ],
  },
  {
    moduleKey: "finance",
    modulePath: "/finance",
    title: "Banking",
    icon: "🏦",
    path: "/finance/bank-accounts",
    features: [
      "bank-accounts",
      "bank-reconciliation",
      "cheque-management",
      "banking",
    ],
  },
  {
    moduleKey: "finance",
    modulePath: "/finance",
    title: "Accounting Setup",
    icon: "⚙️",
    path: "/finance/chart-of-accounts",
    features: [
      "chart-of-accounts",
      "fiscal-year",
      "tax-setup",
      "currencies",
      "setup",
    ],
  },
  {
    moduleKey: "finance",
    modulePath: "/finance",
    title: "Reports & Analysis",
    icon: "📊",
    path: "/finance/reports",
    features: [
      "trial-balance",
      "profit-and-loss",
      "balance-sheet",
      "general-ledger",
      "reports",
    ],
  },

  // --- HUMAN RESOURCES ---
  {
    moduleKey: "human-resources",
    modulePath: "/human-resources",
    title: "Employee Management",
    icon: "👔",
    path: "/human-resources/employees",
    features: ["employees", "departments", "designations"],
  },
  {
    moduleKey: "human-resources",
    modulePath: "/human-resources",
    title: "Time & Attendance",
    icon: "⏰",
    path: "/human-resources/attendance",
    features: ["attendance", "shifts"],
  },
  {
    moduleKey: "human-resources",
    modulePath: "/human-resources",
    title: "Leave Management",
    icon: "✍️",
    path: "/human-resources/leave",
    features: ["leave", "leave-balances", "leave-types"],
  },
  {
    moduleKey: "human-resources",
    modulePath: "/human-resources",
    title: "Payroll & Benefits",
    icon: "💰",
    path: "/human-resources/payroll",
    features: ["payroll", "salary-structure", "payslips"],
  },
  {
    moduleKey: "human-resources",
    modulePath: "/human-resources",
    title: "Reports",
    icon: "📊",
    path: "/human-resources/reports",
    features: ["reports"],
  },
  {
    moduleKey: "human-resources",
    modulePath: "/human-resources",
    title: "Settings & Setup",
    icon: "⚙️",
    path: "/human-resources/setup",
    features: ["setup"],
  },
  {
    moduleKey: "human-resources",
    modulePath: "/human-resources",
    title: "Analytics & Performance",
    icon: "📈",
    path: "/human-resources/analytics",
    features: ["analytics"],
  },

  // --- MAINTENANCE ---
  {
    moduleKey: "maintenance",
    modulePath: "/maintenance",
    title: "Equipment & Assets",
    icon: "🏗️",
    path: "/maintenance/equipment",
    features: ["equipment", "categories"],
  },
  {
    moduleKey: "maintenance",
    modulePath: "/maintenance",
    title: "Maintenance Operations",
    icon: "🛠️",
    path: "/maintenance/work-orders",
    features: ["work-orders", "schedules", "requests"],
  },
  {
    moduleKey: "maintenance",
    modulePath: "/maintenance",
    title: "Resource Management",
    icon: "👥",
    path: "/maintenance/technicians",
    features: ["technicians", "spare-parts"],
  },
  {
    moduleKey: "maintenance",
    modulePath: "/maintenance",
    title: "Procurement & Billing",
    icon: "💳",
    path: "/maintenance/contracts",
    features: ["contracts", "invoices"],
  },
  {
    moduleKey: "maintenance",
    modulePath: "/maintenance",
    title: "Reports & Analytics",
    icon: "📊",
    path: "/maintenance/reports",
    features: ["reports"],
  },
  {
    moduleKey: "maintenance",
    modulePath: "/maintenance",
    title: "System Setup",
    icon: "⚙️",
    path: "/maintenance/setup",
    features: ["setup"],
  },

  // --- PRODUCTION ---
  {
    moduleKey: "production",
    modulePath: "/production",
    title: "Manufacturing Masters & Setup",
    icon: "🏗️",
    path: "/production/bom",
    features: ["bom", "work-centers", "routings", "setup"],
  },
  {
    moduleKey: "production",
    modulePath: "/production",
    title: "Planning & Requirements",
    icon: "🗓️",
    path: "/production/planning",
    features: ["planning", "mrp"],
  },
  {
    moduleKey: "production",
    modulePath: "/production",
    title: "Shop Floor & Execution",
    icon: "⚡",
    path: "/production/orders",
    features: ["orders", "job-cards", "tracking"],
  },
  {
    moduleKey: "production",
    modulePath: "/production",
    title: "Reports & Costing",
    icon: "📊",
    path: "/production/reports",
    features: ["reports", "costing"],
  },

  // --- PROJECT MANAGEMENT ---
  {
    moduleKey: "project-management",
    modulePath: "/project-management",
    title: "Portfolio",
    icon: "📁",
    path: "/project-management/projects",
    features: ["projects", "templates"],
  },
  {
    moduleKey: "project-management",
    modulePath: "/project-management",
    title: "Execution & Tasks",
    icon: "📋",
    path: "/project-management/tasks",
    features: ["tasks", "gantt", "milestones", "timesheets"],
  },
  {
    moduleKey: "project-management",
    modulePath: "/project-management",
    title: "Materials & Procurement",
    icon: "🛒",
    path: "/project-management/requisitions",
    features: ["requisitions", "issues"],
  },
  {
    moduleKey: "project-management",
    modulePath: "/project-management",
    title: "Financials & Expenses",
    icon: "📝",
    path: "/project-management/budgets",
    features: ["budgets", "expenses", "invoices"],
  },
  {
    moduleKey: "project-management",
    modulePath: "/project-management",
    title: "Reports & Analytics",
    icon: "📈",
    path: "/project-management/reports",
    features: ["reports"],
  },
  {
    moduleKey: "project-management",
    modulePath: "/project-management",
    title: "Construction Estimating & Cost Control",
    icon: "📐",
    path: "/project-management/estimating",
    features: ["estimating"],
  },
  {
    moduleKey: "project-management",
    modulePath: "/project-management",
    title: "Valuations & Contracts",
    icon: "📜",
    path: "/project-management/contracts",
    features: ["contracts"],
  },
  {
    moduleKey: "project-management",
    modulePath: "/project-management",
    title: "Site Operations & Plant",
    icon: "🏗️",
    path: "/project-management/site",
    features: ["site"],
  },
  {
    moduleKey: "project-management",
    modulePath: "/project-management",
    title: "Planning, QA/QC & Safety",
    icon: "📅",
    path: "/project-management/planning",
    features: ["planning"],
  },

  // --- SERVICE MANAGEMENT ---
  {
    moduleKey: "service-management",
    modulePath: "/service-management",
    title: "Service Requests",
    icon: "📋",
    path: "/service-management/requests",
    features: ["requests", "tickets"],
  },
  {
    moduleKey: "service-management",
    modulePath: "/service-management",
    title: "Service Orders & Execution",
    icon: "🛠️",
    path: "/service-management/orders",
    features: ["orders", "technicians"],
  },
  {
    moduleKey: "service-management",
    modulePath: "/service-management",
    title: "Visitors Log",
    icon: "📇",
    path: "/service-management/visitors",
    features: ["visitors", "gate-pass"],
  },
  {
    moduleKey: "service-management",
    modulePath: "/service-management",
    title: "Reports & Parameters",
    icon: "📊",
    path: "/service-management/reports",
    features: ["reports", "parameters"],
  },

  // --- TRANSPORT ---
  {
    moduleKey: "transport",
    modulePath: "/transport",
    title: "Operations",
    icon: "🚚",
    path: "/transport/vehicles",
    features: ["vehicles", "requests", "trips"],
  },
  {
    moduleKey: "transport",
    modulePath: "/transport",
    title: "Fuel & Expenses",
    icon: "📑",
    path: "/transport/fuel",
    features: ["fuel", "expenses"],
  },
  {
    moduleKey: "transport",
    modulePath: "/transport",
    title: "Reports & Analytics",
    icon: "📊",
    path: "/transport/reports",
    features: ["reports"],
  },
  {
    moduleKey: "transport",
    modulePath: "/transport",
    title: "Configuration",
    icon: "⚙️",
    path: "/transport/config",
    features: ["config"],
  },

  // --- FACILITIES ---
  {
    moduleKey: "facilities",
    modulePath: "/facilities",
    title: "Portfolio & Sites Register",
    icon: "🏢",
    path: "/facilities/sites",
    features: ["sites", "buildings"],
  },
  {
    moduleKey: "facilities",
    modulePath: "/facilities",
    title: "Contracts, SLA & Billing",
    icon: "📜",
    path: "/facilities/contracts",
    features: ["contracts", "leases", "billing"],
  },
  {
    moduleKey: "facilities",
    modulePath: "/facilities",
    title: "Operations & Helpdesk",
    icon: "🎧",
    path: "/facilities/requests",
    features: ["requests", "work-orders"],
  },
  {
    moduleKey: "facilities",
    modulePath: "/facilities",
    title: "Tasks & Materials Management",
    icon: "📋",
    path: "/facilities/tasks",
    features: ["tasks"],
  },
  {
    moduleKey: "facilities",
    modulePath: "/facilities",
    title: "Inspections, Safety & Compliance",
    icon: "🦺",
    path: "/facilities/inspections",
    features: ["inspections"],
  },
  {
    moduleKey: "facilities",
    modulePath: "/facilities",
    title: "Utilities, Energy & Sustainability",
    icon: "⚡",
    path: "/facilities/utilities",
    features: ["utilities"],
  },
  {
    moduleKey: "facilities",
    modulePath: "/facilities",
    title: "Security, Workforce & Space",
    icon: "🔐",
    path: "/facilities/security",
    features: ["security"],
  },
  {
    moduleKey: "facilities",
    modulePath: "/facilities",
    title: "Subcontractors, Finance & Reports",
    icon: "📊",
    path: "/facilities/reports",
    features: ["reports"],
  },

  // --- ASSET MANAGEMENT ---
  {
    moduleKey: "asset-management",
    modulePath: "/asset-management",
    title: "Asset Register & Master Data",
    icon: "🏛️",
    path: "/asset-management/assets",
    features: ["assets", "categories"],
  },
  {
    moduleKey: "asset-management",
    modulePath: "/asset-management",
    title: "Financial Depreciation & General Ledger",
    icon: "🧮",
    path: "/asset-management/depreciation",
    features: ["depreciation"],
  },
  {
    moduleKey: "asset-management",
    modulePath: "/asset-management",
    title: "Custody & Lifecycle Movements",
    icon: "🔄",
    path: "/asset-management/transfers",
    features: ["transfers", "disposals"],
  },

  // --- ADMINISTRATION ---
  {
    moduleKey: "administration",
    modulePath: "/administration",
    title: "User Management & Access Control",
    icon: "🔒",
    path: "/administration/roles",
    features: ["roles", "user-permissions", "user-overrides", "users"],
  },
  {
    moduleKey: "administration",
    modulePath: "/administration",
    title: "System Health & Settings",
    icon: "🖥️",
    path: "/administration/settings",
    features: ["settings", "diagnostics"],
  },
  {
    moduleKey: "administration",
    modulePath: "/administration",
    title: "Workflow Engine",
    icon: "🔄",
    path: "/administration/workflows",
    features: ["workflows", "workflow-approvals", "document-review"],
  },
  {
    moduleKey: "administration",
    modulePath: "/administration",
    title: "Audit & Logs",
    icon: "📜",
    path: "/administration/reports/system-log-book",
    features: ["system-log-book", "user-login-activity"],
  },

  // --- SYSTEM CONFIGURATION ---
  {
    moduleKey: "system-configuration",
    modulePath: "/system-configuration",
    title: "System Configuration",
    icon: "🏢",
    path: "/system-configuration",
    features: ["company", "branches", "settings"],
  },
  {
    moduleKey: "system-configuration",
    modulePath: "/system-configuration",
    title: "Access & Security",
    icon: "🛡️",
    path: "/system-configuration/security",
    features: ["admin-permissions", "backup"],
  },
  {
    moduleKey: "system-configuration",
    modulePath: "/system-configuration",
    title: "Licensing & Billing",
    icon: "🔑",
    path: "/system-configuration/licensing",
    features: ["license-management", "payment-packages"],
  },
];

/**
 * Filter sections assigned to the user based on permissions.
 * Only displays sections the user is entitled to based on their assigned role features.
 * NB: Super Admin (user ID = 1) is exempt and retains all sections.
 */
/**
 * Filter sections assigned to the user based on permissions.
 * Checks the pages and features assigned to the user first before showing sections in the side menu.
 * Strictly scopes permissions to the target module to prevent cross-module bleed (e.g. POS vs Purchase).
 * NB: Super Admin (user ID = 1) is exempt and retains all sections.
 */
export function getAssignedSectionsForUser(perm, user) {
  if (!perm) return [];

  const uid = Number(user?.id || user?.sub || 0);

  // Super Admin (User ID = 1) gets all sections
  if (uid === 1) {
    return ALL_MODULE_SECTIONS;
  }

  const {
    modules,
    roleFeatures,
    permissions,
    permByFeatureKey,
    canViewModule,
  } = perm;

  // Build a map of moduleKey (lowercase) -> Set of allowed featureKeys (lowercase)
  // Strictly module-scoped so permissions in POS do not grant access to Purchase/Procurement and vice-versa.
  const userAllowedFeaturesByModule = new Map();

  const addAllowed = (modKey, featKey) => {
    const m = String(modKey || "").trim().toLowerCase();
    const f = String(featKey || "").trim().toLowerCase();
    if (!m || !f) return;
    if (!userAllowedFeaturesByModule.has(m)) {
      userAllowedFeaturesByModule.set(m, new Set());
    }
    const set = userAllowedFeaturesByModule.get(m);
    set.add(f);
    if (!f.includes(":")) {
      set.add(`${m}:${f}`);
    } else {
      const parts = f.split(":");
      if (parts[1]) set.add(parts[1]);
    }
  };

  // 1. Gather from roleFeatures (e.g. "pos:invoices", "sales:quotations", "administration:users")
  const rawRoleFeatures = roleFeatures instanceof Set
    ? Array.from(roleFeatures)
    : Array.isArray(roleFeatures)
      ? roleFeatures
      : [];

  for (const rf of rawRoleFeatures) {
    if (!rf) continue;
    const str = String(rf).trim().toLowerCase();
    if (str.includes(":")) {
      const [m, k] = str.split(":");
      addAllowed(m, k);
    }
  }

  // 2. Gather from permissions array
  if (Array.isArray(permissions)) {
    for (const p of permissions) {
      if (!p) continue;
      const canView =
        p.can_view === true ||
        p.can_view === 1 ||
        p.can_view === "1" ||
        p.view === true ||
        p.view === 1;

      if (canView) {
        const pMk = String(p.module_key || "").trim().toLowerCase();
        const pFk = String(p.feature_key || "").trim().toLowerCase();
        if (pFk.includes(":")) {
          const [m, k] = pFk.split(":");
          addAllowed(m || pMk, k);
        } else if (pMk && pFk) {
          addAllowed(pMk, pFk);
        }
      }
    }
  }

  // 3. Gather from permByFeatureKey map if available
  if (permByFeatureKey instanceof Map) {
    for (const [k, val] of permByFeatureKey.entries()) {
      if (val && (val.can_view === true || val.can_view === 1 || val.view === true || val.view === 1)) {
        const strK = String(k || "").trim().toLowerCase();
        if (strK.includes(":")) {
          const [m, feat] = strK.split(":");
          addAllowed(m, feat);
        } else if (val.module_key) {
          addAllowed(val.module_key, strK);
        }
      }
    }
  }

  return ALL_MODULE_SECTIONS.filter((section) => {
    const mk = String(section.moduleKey || "").trim().toLowerCase();

    // 1. System configuration check (restricted to user 1 & 2)
    if (mk === "system-configuration") {
      if (uid !== 1 && uid !== 2) return false;
    }

    // 2. Module Level Check:
    // User must have this module assigned
    if (modules instanceof Set && modules.size > 0) {
      if (!modules.has("*") && !modules.has(mk)) {
        return false;
      }
    } else if (Array.isArray(modules) && modules.length > 0) {
      if (!modules.includes("*") && !modules.includes(mk)) {
        return false;
      }
    }

    if (typeof canViewModule === "function") {
      if (!canViewModule(mk)) return false;
    }

    // 3. Check pages/features assigned to user in THIS SPECIFIC MODULE
    const moduleAllowedFeatures = userAllowedFeaturesByModule.get(mk);
    if (!moduleAllowedFeatures || moduleAllowedFeatures.size === 0) {
      return false;
    }

    // 4. Section Feature Level Check:
    // User must have at least one assigned page/feature in this section
    const sectionFeatures = Array.isArray(section.features) ? section.features : [];
    let hasAssignedPage = false;

    for (const rawFeat of sectionFeatures) {
      const feat = String(rawFeat || "").trim().toLowerCase();
      if (!feat) continue;

      // Purchase Upload strictly requires Admin Permissions in System Admin
      if (feat === "purchase-upload" || feat === "upload") {
        if (uid !== 1) {
          const hasAdminPerm =
            (Array.isArray(permissions) &&
              permissions.some(
                (p) =>
                  (p.is_exclusive || p.isExclusive) &&
                  (p.feature_key === "purchase:purchase-upload" ||
                    p.feature_key === "purchase-upload")
              )) ||
            (perm?.exceptionalPerms instanceof Set &&
              (perm.exceptionalPerms.has("purchase:purchase-upload") ||
                perm.exceptionalPerms.has("purchase-upload")));
          if (!hasAdminPerm) continue;
        }
      }

      const fullKey = `${mk}:${feat}`;
      const cleanFullKey = fullKey.replace(/[^a-z0-9:]/g, "");
      const cleanFeat = feat.replace(/[^a-z0-9]/g, "");

      // Direct match
      if (
        moduleAllowedFeatures.has(feat) ||
        moduleAllowedFeatures.has(fullKey)
      ) {
        hasAssignedPage = true;
        break;
      }

      // Normalized match within this module's allowed features
      for (const allowedF of moduleAllowedFeatures) {
        const cleanAllowed = allowedF.replace(/[^a-z0-9:]/g, "");
        if (cleanAllowed === cleanFullKey || cleanAllowed === cleanFeat) {
          hasAssignedPage = true;
          break;
        }
      }
      if (hasAssignedPage) break;
    }

    return hasAssignedPage;
  });
}
