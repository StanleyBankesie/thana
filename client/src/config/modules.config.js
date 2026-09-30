/**
 * Centralized Module-Feature Configuration Registry
 * 
 * This file defines the complete hierarchical structure of all modules,
 * features, and dashboards in the system. It serves as the single
 * source of truth for RBAC configuration.
 * 
 * Structure:
 * - Each module contains features and dashboards
 * - Features are business functions (pages, forms, reports)
 * - Dashboards are analytical views
 * - All permissions are derived from this configuration
 */

export const MODULES_CONFIG = [
  {
    key: "purchase",
    name: "Purchase",
    icon: "🛒",
    path: "/purchase",
    features: [
      {
        key: "purchase-order",
        name: "Purchase Order",
        description: "Create and manage purchase orders",
        path: "/purchase/purchase-orders"
      },
      {
        key: "grn",
        name: "GRN",
        description: "Goods Receipt Note management",
        path: "/purchase/grn"
      },
      {
        key: "purchase-bill",
        name: "Purchase Bill",
        description: "Purchase invoice processing",
        path: "/purchase/purchase-bills"
      },
      {
        key: "direct-purchase",
        name: "Direct Purchase",
        description: "Quick purchase processing",
        path: "/purchase/direct-purchase"
      },
      {
        key: "purchase-return",
        name: "Purchase Return",
        description: "Return purchase items",
        path: "/purchase/purchase-returns"
      },
      {
        key: "rfq",
        name: "RFQ",
        description: "Request for Quotation",
        path: "/purchase/rfq"
      }
    ],
    dashboards: [
      {
        key: "purchase-dashboard",
        name: "Purchase Dashboard",
        description: "Purchase analytics and insights",
        path: "/purchase/dashboard"
      }
    ]
  },
  {
    key: "sales",
    name: "Sales",
    icon: "💰",
    path: "/sales",
    features: [
      {
        key: "sales-order",
        name: "Sales Order",
        description: "Create and manage sales orders",
        path: "/sales/sales-orders"
      },
      {
        key: "sales-invoice",
        name: "Sales Invoice",
        description: "Generate sales invoices",
        path: "/sales/sales-invoices"
      },
      {
        key: "sales-return",
        name: "Sales Return",
        description: "Process sales returns",
        path: "/sales/sales-returns"
      },
      {
        key: "quotation",
        name: "Quotation",
        description: "Create customer quotations",
        path: "/sales/quotations"
      },
      {
        key: "customer-payment",
        name: "Customer Payment",
        description: "Process customer payments",
        path: "/sales/customer-payments"
      }
    ],
    dashboards: [
      {
        key: "sales-dashboard",
        name: "Sales Dashboard",
        description: "Sales performance analytics",
        path: "/sales/dashboard"
      }
    ]
  },
  {
    key: "inventory",
    name: "Inventory",
    icon: "📦",
    path: "/inventory",
    features: [
      {
        key: "stock-management",
        name: "Stock Management",
        description: "Manage stock levels",
        path: "/inventory/stock"
      },
      {
        key: "stock-transfer",
        name: "Stock Transfer",
        description: "Transfer stock between locations",
        path: "/inventory/stock-transfer"
      },
      {
        key: "stock-adjustment",
        name: "Stock Adjustment",
        description: "Adjust stock quantities",
        path: "/inventory/stock-adjustment"
      },
      {
        key: "item-master",
        name: "Item Master",
        description: "Product/item management",
        path: "/inventory/items"
      }
    ],
    dashboards: [
      {
        key: "inventory-dashboard",
        name: "Inventory Dashboard",
        description: "Stock level analytics",
        path: "/inventory/dashboard"
      }
    ]
  },
  {
    key: "accounts",
    name: "Accounts",
    icon: "📊",
    path: "/accounts",
    features: [
      {
        key: "chart-of-accounts",
        name: "Chart of Accounts",
        description: "Account management",
        path: "/accounts/chart-of-accounts"
      },
      {
        key: "journal-entry",
        name: "Journal Entry",
        description: "Create journal entries",
        path: "/accounts/journal-entries"
      },
      {
        key: "ledger",
        name: "Ledger",
        description: "View account ledgers",
        path: "/accounts/ledger"
      },
      {
        key: "trial-balance",
        name: "Trial Balance",
        description: "Generate trial balance",
        path: "/accounts/trial-balance"
      },
      {
        key: "balance-sheet",
        name: "Balance Sheet",
        description: "View balance sheet",
        path: "/accounts/balance-sheet"
      },
      {
        key: "profit-loss",
        name: "Profit & Loss",
        description: "View P&L statement",
        path: "/accounts/profit-loss"
      }
    ],
    dashboards: [
      {
        key: "accounts-dashboard",
        name: "Accounts Dashboard",
        description: "Financial overview",
        path: "/accounts/dashboard"
      }
    ]
  },
  {
    key: "business-intelligence",
    name: "Business Intelligence",
    icon: "📈",
    path: "/business-intelligence",
    features: [
      { key: "executive-dashboard", name: "Executive Dashboard", description: "High-level cross-module analytics", path: "/business-intelligence/executive-dashboard" },
      { key: "data-sources", name: "Data Sources & Ingestion", description: "Manage ERP and external data sources", path: "/business-intelligence/data-sources" },
      { key: "datasets", name: "Analytical Datasets", description: "Catalog of analytical datasets and schemas", path: "/business-intelligence/datasets" },
      { key: "data-prep", name: "Data Preparation Studio", description: "Build and test data transformation recipes", path: "/business-intelligence/data-prep" },
      { key: "data-models", name: "Data Models & Star Schema", description: "Fact and dimension table architecture", path: "/business-intelligence/data-models" },
      { key: "etl-pipelines", name: "ETL Pipelines Manager", description: "Orchestrate 6-stage ETL pipelines", path: "/business-intelligence/etl-pipelines" },
      { key: "data-quality", name: "Data Quality & Quarantine", description: "Validation scores and quarantined records", path: "/business-intelligence/data-quality" },
      { key: "multidimensional", name: "Multidimensional Slicing", description: "OLAP slicing and variance drill-down", path: "/business-intelligence/multidimensional" },
      { key: "insights", name: "Automated Exceptions", description: "Automated business anomaly detection", path: "/business-intelligence/insights" },
      { key: "dashboard-builder", name: "Dashboard Builder", description: "Design custom BI dashboards", path: "/business-intelligence/dashboard-builder" },
      { key: "dashboards", name: "Custom Dashboards", description: "View configured custom dashboards", path: "/business-intelligence/dashboards" },
      { key: "financial", name: "Financial Analytics", description: "P&L, balance sheet, and revenue trends", path: "/business-intelligence/financial" },
      { key: "inventory", name: "Inventory Analytics", description: "Stock turnover, valuation, and aging", path: "/business-intelligence/inventory" },
      { key: "purchase", name: "Purchase Analytics", description: "Procurement spend and vendor performance", path: "/business-intelligence/purchase" },
      { key: "hr", name: "HR Analytics", description: "Headcount, payroll, and department metrics", path: "/business-intelligence/hr" },
      { key: "maintenance", name: "Maintenance Analytics", description: "Equipment downtime and work order costs", path: "/business-intelligence/maintenance" },
      { key: "production", name: "Production Analytics", description: "Manufacturing yield, scrap, and OEE", path: "/business-intelligence/production" },
      { key: "projects", name: "Project Analytics", description: "Project milestone completion and budgets", path: "/business-intelligence/projects" },
      { key: "transport", name: "Transport Analytics", description: "Fleet utilization, fuel, and trip metrics", path: "/business-intelligence/transport" },
      { key: "service", name: "Service Analytics", description: "Field service tickets, SLA, and billing", path: "/business-intelligence/service" },
      { key: "pos", name: "POS Analytics", description: "Retail checkout trends and registers", path: "/business-intelligence/pos" },
      { key: "administration", name: "Administration Analytics", description: "User logins, roles, and audit trails", path: "/business-intelligence/administration" },
      { key: "cross-module", name: "Cross Module Analytics", description: "Unified cross-functional BI metrics", path: "/business-intelligence/cross-module" },
      { key: "kpi-center", name: "KPI Center", description: "Manage KPIs and target thresholds", path: "/business-intelligence/kpi-center" },
      { key: "data-explorer", name: "Data Explorer", description: "Self-service ad-hoc analytical querying", path: "/business-intelligence/data-explorer" },
      { key: "ai-insights", name: "AI Insights", description: "AI-generated business observations", path: "/business-intelligence/ai-insights" },
      { key: "banks-ai", name: "Ask Banks AI", description: "Conversational ERP intelligence agent", path: "/business-intelligence/banks-ai" },
      { key: "alerts", name: "Alerts Center", description: "Analytical alert rule configurations", path: "/business-intelligence/alerts" },
      { key: "report-center", name: "Report Center", description: "View and schedule analytical reports", path: "/business-intelligence/report-center" },
      { key: "settings", name: "BI Settings", description: "Platform configuration and schedules", path: "/business-intelligence/settings" }
    ],
    dashboards: [
      { key: "bi-executive-summary", name: "Executive Summary Dashboard", description: "High-level cross-module analytics", path: "/business-intelligence/executive-dashboard" },
      { key: "bi-revenue-performance", name: "Revenue & Sales Performance", description: "Sales and revenue metrics", path: "/business-intelligence/multidimensional" },
      { key: "bi-procurement-spend", name: "Procurement & Spend Dashboard", description: "Purchasing spend analytics", path: "/business-intelligence/purchase" },
      { key: "bi-inventory-valuation", name: "Inventory Valuation & Stock", description: "Stock balance analytics", path: "/business-intelligence/inventory" },
      { key: "bi-manufacturing-yield", name: "Manufacturing Yield & Scrap", description: "Production yield analytics", path: "/business-intelligence/production" },
      { key: "bi-financial-gl", name: "General Ledger Financials", description: "GL debit/credit financial analytics", path: "/business-intelligence/financial" }
    ]
  },
  {
    key: "admin",
    name: "Admin",
    icon: "⚙️",
    path: "/admin",
    features: [
      {
        key: "user-management",
        name: "User Management",
        description: "Manage system users",
        path: "/admin/users"
      },
      {
        key: "role-management",
        name: "Role Management",
        description: "Manage user roles",
        path: "/admin/roles"
      },
      {
        key: "company-settings",
        name: "Company Settings",
        description: "Configure company details",
        path: "/admin/company"
      },
      {
        key: "system-settings",
        name: "System Settings",
        description: "System configuration",
        path: "/admin/settings"
      }
    ],
    dashboards: [
      {
        key: "admin-dashboard",
        name: "Admin Dashboard",
        description: "System administration overview",
        path: "/admin/dashboard"
      }
    ]
  }
];

/**
 * Helper functions for working with the module configuration
 */

export const getModuleByKey = (key) => {
  return MODULES_CONFIG.find(module => module.key === key);
};

export const getFeatureByKey = (moduleKey, featureKey) => {
  const module = getModuleByKey(moduleKey);
  return module?.features.find(feature => feature.key === featureKey);
};

export const getDashboardByKey = (moduleKey, dashboardKey) => {
  const module = getModuleByKey(moduleKey);
  return module?.dashboards.find(dashboard => dashboard.key === dashboardKey);
};

export const getAllModuleKeys = () => {
  return MODULES_CONFIG.map(module => module.key);
};

export const getAllFeatureKeys = () => {
  const features = [];
  MODULES_CONFIG.forEach(module => {
    module.features.forEach(feature => {
      features.push(`${module.key}:${feature.key}`);
    });
  });
  return features;
};

export const getAllDashboardKeys = () => {
  const dashboards = [];
  MODULES_CONFIG.forEach(module => {
    module.dashboards.forEach(dashboard => {
      dashboards.push(`${module.key}:${dashboard.key}`);
    });
  });
  return dashboards;
};

export const getModuleFeatures = (moduleKey) => {
  const module = getModuleByKey(moduleKey);
  return module?.features.map(feature => `${module.key}:${feature.key}`) || [];
};

export const getModuleDashboards = (moduleKey) => {
  const module = getModuleByKey(moduleKey);
  return module?.dashboards.map(dashboard => `${module.key}:${dashboard.key}`) || [];
};

export default MODULES_CONFIG;