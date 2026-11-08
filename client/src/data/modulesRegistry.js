/**
 * Module Features Registry
 * Centralized definition of all modules, their features, and dashboards
 * Used by Role Management UI and permission system
 * 
 * IMPORTANT: Keep this in sync with the module home page sections and
 * server/data/featuresRegistry.js
 */

export const MODULES_REGISTRY = {
  administration: {
    name: "Administration",
    icon: "⚙️",
    features: [
      { key: "roles", label: "Role Setup", type: "feature" },
      { key: "user-permissions", label: "User Permissions", type: "feature" },
      { key: "user-overrides", label: "Exceptional Permissions", type: "feature" },

      { key: "users", label: "User Management", type: "feature" },
      { key: "settings", label: "Settings", type: "feature" },
      { key: "diagnostics", label: "Diagnostics", type: "feature" },
      { key: "system-log-book", label: "System Log Book Report", path: "/administration/reports/system-log-book", type: "feature" },
      { key: "user-login-activity", label: "User Login Activity Report", path: "/administration/reports/user-login-activity", type: "feature" },
    ],
    dashboards: [

          { key: "admin-active-users", label: "Active Users", type: "dashboard" },
      { key: "admin-role-count", label: "Role Count", type: "dashboard" },
      { key: "admin-recent-logins", label: "Recent Logins", type: "dashboard" },
]
  },

  sales: {
    name: "Sales",
    icon: "💰",
    features: [
      { key: "quotations", label: "Quotations", type: "feature" },
      { key: "sales-orders", label: "Sales Orders", type: "feature" },
      { key: "invoices", label: "Invoices", type: "feature" },
      { key: "delivery", label: "Delivery Management", type: "feature" },
      { key: "customers", label: "Customer Management", type: "feature" },

      { key: "accountsreceivableagingreport", label: " Accounts Receivable Aging Report", type: "feature" },
      { key: "cancelledordersreport", label: " Cancelled Orders Report", type: "feature" },
      { key: "customerhistoryreport", label: " Customer History Report", type: "feature" },
      { key: "customerlistreport", label: " Customer List Report", type: "feature" },
      { key: "customerorderhistoryreport", label: " Customer Order History Report", type: "feature" },
      { key: "debtorsbalancereport", label: " Debtors Balance Report", type: "feature" },
      { key: "deliveryregisterreport", label: " Delivery Register Report", type: "feature" },
      { key: "discountutilizationreport", label: " Discount Utilization Report", type: "feature" },
      { key: "invoicesummaryreport", label: " Invoice Summary Report", type: "feature" },
      { key: "monthlysalestrendreport", label: " Monthly Sales Trend Report", type: "feature" },
      { key: "pricelistreport", label: " Price List Report", type: "feature" },
      { key: "prospectivecustomerlistreport", label: " Prospective Customer List Report", type: "feature" },
      { key: "quotationconversionreport", label: " Quotation Conversion Report", type: "feature" },
      { key: "quotationsummaryreport", label: " Quotation Summary Report", type: "feature" },
      { key: "revenuebycustomerreport", label: " Revenue By Customer Report", type: "feature" },
      { key: "revenuebyproductreport", label: " Revenue By Product Report", type: "feature" },
      { key: "salesorderstatusreport", label: " Sales Order Status Report", type: "feature" },
      { key: "salesprofitabilityreport", label: " Sales Profitability Report", type: "feature" },
      { key: "salesregisterreport", label: " Sales Register Report", type: "feature" },
      { key: "salesreturnreport", label: " Sales Return Report", type: "feature" },
      { key: "salestrackingreport", label: " Sales Tracking Report", type: "feature" },
      { key: "returns", label: "Sales Returns", type: "feature" },
      { key: "price-setup", label: "Price Setup", type: "feature" },
      { key: "discount-schemes", label: "Discount Schemes", type: "feature" },
      { key: "customer-credit", label: "Customer Credit", type: "feature" },
      { key: "bulk-upload", label: "Bulk Customer Upload", type: "feature" },
      { key: "sales-upload", label: "Sales Upload", type: "feature", isExclusive: true },
      { key: "prospect-customers", label: "Prospective Customers", type: "feature" },
      { key: "prospect-conversion", label: "Prospect Conversion", type: "feature" },
      { key: "setup", label: "Sales Setup", type: "feature" },
    ],
    dashboards: [
      { key: "sales-total-revenue", label: "Total Revenue This Month", type: "dashboard" },
      { key: "sales-avg-sales-this-month", label: "Average Sales This Month", type: "dashboard" },
      { key: "sales-pending-orders", label: "Pending Orders", type: "dashboard" },
      { key: "sales-active-customers", label: "Active Customers", type: "dashboard" },
    ]
  },

  purchase: {
    name: "Purchase",
    icon: "🛒",
    features: [
      { key: "direct-purchase", label: "Direct Purchase", type: "feature" },
      { key: "general-requisitions", label: "General Requisition", type: "feature" },
      { key: "rfqs", label: "Request for Quotation", type: "feature" },
      { key: "supplier-quotations", label: "Supplier Quotations", type: "feature" },
      { key: "quotation-analysis", label: "Quotation Analysis", type: "feature" },
      { key: "purchase-orders-local", label: "Local Purchase Orders", type: "feature" },
      { key: "purchase-orders-import", label: "Import Purchase Orders", type: "feature" },
      { key: "shipping-advice", label: "Shipping Advice", type: "feature" },
      { key: "port-clearances", label: "Port Clearances", type: "feature" },
      { key: "purchase-bills-local", label: "Local Purchase Bills", type: "feature" },
      { key: "purchase-bills-import", label: "Import Purchase Bills", type: "feature" },
      { key: "purchase-upload", label: "Purchase Upload", type: "feature", isExclusive: true },
      { key: "suppliers", label: "Suppliers", type: "feature" },
      { key: "purchase-returns", label: "Purchase Returns", type: "feature" },

      { key: "cancelledpurchaseordersreport", label: " Cancelled Purchase Orders Report", type: "feature" },
      { key: "departmentpurchaseanalysisreport", label: " Department Purchase Analysis Report", type: "feature" },
      { key: "importcostbreakdownreport", label: " Import Cost Breakdown Report", type: "feature" },
      { key: "importorderlistreport", label: " Import Order List Report", type: "feature" },
      { key: "importordertrackingreport", label: " Import Order Tracking Report", type: "feature" },
      { key: "itempurchasehistoryreport", label: " Item Purchase History Report", type: "feature" },
      { key: "leadtimeanalysisreport", label: " Lead Time Analysis Report", type: "feature" },
      { key: "localordertrackingreport", label: " Local Order Tracking Report", type: "feature" },
      { key: "pendinggrntobillimportreport", label: " Pending Grn To Bill Import Report", type: "feature" },
      { key: "pendinggrntobilllocalreport", label: " Pending Grn To Bill Local Report", type: "feature" },
      { key: "pendingshipmentdetailsreport", label: " Pending Shipment Details Report", type: "feature" },
      { key: "pricevariancereport", label: " Price Variance Report", type: "feature" },
      { key: "purchaseagingreport", label: " Purchase Aging Report", type: "feature" },
      { key: "purchaseregisterreport", label: " Purchase Register Report", type: "feature" },
      { key: "purchasereturnsanalysisreport", label: " Purchase Returns Analysis Report", type: "feature" },
      { key: "purchasetrackingreport", label: " Purchase Tracking Report", type: "feature" },
      { key: "supplieroutstandingpayablesreport", label: " Supplier Outstanding Payables Report", type: "feature" },
      { key: "supplierperformancereport", label: " Supplier Performance Report", type: "feature" },
      { key: "supplierquotationanalysisreport", label: " Supplier Quotation Analysis Report", type: "feature" },
      { key: "setup", label: "Purchase Setup", type: "feature" },
    ],
    dashboards: [


          { key: "purchase-total-value", label: "Total Purchase Value", type: "dashboard" },
      { key: "purchase-pending-pos", label: "Pending POs", type: "dashboard" },
      { key: "purchase-active-suppliers", label: "Active Suppliers", type: "dashboard" },
]
  },

  inventory: {
    name: "Inventory",
    icon: "📦",
    features: [
      { key: "material-requisitions", label: "Material Requisitions", type: "feature" },
      { key: "stock-upload", label: "Stock Upload", type: "feature", isExclusive: true },
      { key: "stock-updation", label: "Stock Updation", type: "feature" },
      { key: "stock-adjustments", label: "Stock Adjustment", type: "feature" },
      { key: "stock-transfers", label: "Stock Transfer", type: "feature" },
      { key: "stock-verification", label: "Stock Verification", type: "feature" },
      { key: "return-to-stores", label: "Return to Stores Advice", type: "feature" },
      { key: "issue-to-requirement", label: "Issue to Requirement Area", type: "feature" },
      { key: "transfer-acceptance", label: "Transfer Acceptance", type: "feature" },
      { key: "grn-local", label: "Material Receipt (GRN) - Local", type: "feature" },
      { key: "grn-import", label: "Material Receipt (GRN) - Import", type: "feature" },
      { key: "items", label: "Item Management", type: "feature" },

      { key: "unit-conversions", label: "Unit Conversion", type: "feature" },
      { key: "warehouses", label: "Warehouse Management", type: "feature" },
      { key: "batches", label: "Item Batches Tracking", type: "feature" },
      { key: "stock-taking", label: "Stock Taking", type: "feature" },
      { key: "stock-reorder", label: "Stock Reorder", type: "feature" },

      { key: "fastmovingreport", label: " Fast Moving Report", type: "feature" },
      { key: "issueregisterreport", label: " Issue Register Report", type: "feature" },
      { key: "materialreturnreport", label: " Material Return Report", type: "feature" },
      { key: "nonmovingreport", label: " Non Moving Report", type: "feature" },
      { key: "slowmovingreport", label: " Slow Moving Report", type: "feature" },
      { key: "stockadjustmentreport", label: " Stock Adjustment Report", type: "feature" },
      { key: "stockaginganalysisreport", label: " Stock Aging Analysis Report", type: "feature" },
      { key: "stockbalancesreport", label: " Stock Balances Report", type: "feature" },
      { key: "stocktransferregisterreport", label: " Stock Transfer Register Report", type: "feature" },
      { key: "stockvaluereport", label: " Stock Value Report", type: "feature" },
      { key: "stockverificationreport", label: " Stock Verification Report", type: "feature" },
    ],
    dashboards: [


          { key: "inventory-total-items", label: "Total Items", type: "dashboard" },
      { key: "inventory-low-stock", label: "Low Stock Alerts", type: "dashboard" },
      { key: "inventory-warehouses", label: "Active Warehouses", type: "dashboard" },
]
  },

  finance: {
    name: "Finance",
    icon: "🏦",
    features: [
      { key: "journal-voucher", label: "Journal Entry", type: "feature" },
      { key: "payment-voucher", label: "Make Payment", type: "feature" },
      { key: "receipt-voucher", label: "Receive Payment", type: "feature" },
      { key: "contra-voucher", label: "Contra Entry", type: "feature" },
      { key: "credit-note", label: "Credit Note", type: "feature" },
      { key: "debit-note", label: "Debit Note", type: "feature" },
      { key: "sales-voucher", label: "Sales Voucher", type: "feature" },
      { key: "purchase-voucher", label: "Purchase Voucher", type: "feature" },
      { key: "chart-of-accounts", label: "Chart of Accounts", type: "feature" },
      { key: "account-groups", label: "Account Groups", type: "feature" },
      { key: "cost-centers", label: "Cost Centers", type: "feature" },
      { key: "tax-codes", label: "Tax Codes & Deductions", type: "feature" },
      { key: "currencies", label: "Currencies", type: "feature" },
      { key: "fiscal-years", label: "Fiscal Years", type: "feature" },
      { key: "budget", label: "Budget Management", type: "feature" },
      { key: "bank-reconciliation", label: "Bank Reconciliation", type: "feature" },
      { key: "fixed-assets", label: "Fixed Assets", type: "feature" },
      { key: "opening-balances", label: "Opening Balances", type: "feature", isExclusive: true },
      { key: "import-vouchers", label: "Import Vouchers", type: "feature", isExclusive: true },
      { key: "pdc-postings", label: "Post-Dated Cheques", type: "feature" },

      { key: "audittrailreport", label: " Audit Trail Report", type: "feature" },
      { key: "balancesheetreport", label: " Balance Sheet Report", type: "feature" },
      { key: "cashflowreport", label: " Cash Flow Report", type: "feature" },
      { key: "chartofaccountsreport", label: " Chart Of Accounts Report", type: "feature" },
      { key: "creditorsledgerreport", label: " Creditors Ledger Report", type: "feature" },
      { key: "customeroutstandingreport", label: " Customer Outstanding Report", type: "feature" },
      { key: "debtorsledgerreport", label: " Debtors Ledger Report", type: "feature" },
      { key: "generalledgerreport", label: " General Ledger Report", type: "feature" },
      { key: "journalreport", label: " Journal Report", type: "feature" },
      { key: "outstandingreceivablereport", label: " Outstanding Receivable Report", type: "feature" },
      { key: "paymentduereport", label: " Payment Due Report", type: "feature" },
      { key: "profitandlossreport", label: " Profit And Loss Report", type: "feature" },
      { key: "profitlossocireport", label: " Statement of Profit or Loss and Other Comprehensive Income", type: "feature" },
      { key: "ratioanalysisreport", label: " Ratio Analysis Report", type: "feature" },
      { key: "supplieroutstandingreport", label: " Supplier Outstanding Report", type: "feature" },
      { key: "trialbalancereport", label: " Trial Balance Report", type: "feature" },
      { key: "voucherregisterreport", label: " Voucher Register Report", type: "feature" },
      { key: "budgetvsactualreport", label: " Budget vs Actual Report", type: "feature" },
    ],
    dashboards: [



          { key: "finance-cash-balance", label: "Cash Balance", type: "dashboard" },
      { key: "finance-ar", label: "Accounts Receivable", type: "dashboard" },
      { key: "finance-ap", label: "Accounts Payable", type: "dashboard" },
]
  },

  pos: {
    name: "Point of Sale",
    icon: "🛒",
    features: [
      { key: "sales-entry", label: "Sales Entry", type: "feature" },
      { key: "day-management", label: "Start/End Business Day", type: "feature" },
      { key: "cash-collection", label: "Cash Collection", type: "feature" },
      { key: "invoices", label: "POS Invoices", type: "feature" },
      { key: "post-to-finance", label: "Post to Finance", type: "feature" },
      { key: "returns", label: "POS Returns", type: "feature" },
      { key: "register", label: "POS Register", type: "feature" },



      { key: "customer-history", label: "Customer Accounts", type: "feature" },
      { key: "on-hold", label: "On-Hold Sales", type: "feature", path: "/pos/holds" },
      { key: "receipt-reprint", label: "Receipt Reprint", type: "feature", path: "/pos/receipt-reprint" },
      { key: "reconciliation", label: "Sync Reconciliation", type: "feature" },
      { key: "setup", label: "POS Setup", type: "feature" },
      { key: "terminals", label: "POS Terminals", type: "feature", path: "/pos/setup/terminals" },
      { key: "cash-drawers", label: "Cash Drawers", type: "feature", path: "/pos/setup/cash-drawers" },
      { key: "receipt-templates", label: "Receipt Templates", type: "feature", path: "/pos/setup/receipt-templates" },

      { key: "customers", label: "Customers", type: "feature", path: "/pos/customers" },

      // Procurement (Direct Purchases)
      { key: "direct-purchase", label: "Direct Purchases", type: "feature" },
      { key: "suppliers", label: "Suppliers", type: "feature", path: "/pos/suppliers" },

      // Store Inventory Operations
      { key: "items", label: "Items Master", type: "feature" },
      { key: "item-classification", label: "Item Classification", type: "feature" },
      { key: "stock-balances", label: "Stock Balances", type: "feature" },
      { key: "stock-transfers", label: "Stock Transfers", type: "feature" },
      { key: "transfer-acceptance", label: "Transfer Acceptance", type: "feature" },
      { key: "stock-adjustments", label: "Stock Adjustments", type: "feature" },
      { key: "stock-reorder", label: "Stock Reorder", type: "feature" },
      { key: "batches", label: "Item Batches", type: "feature" },

      // Finance & Cash Desk
      { key: "payment-voucher", label: "Store Expenses (Payment Voucher)", type: "feature" },
      { key: "receipt-voucher", label: "Customer Payments (Receipt Voucher)", type: "feature" },
      { key: "contra-voucher", label: "Bank Deposit (Contra Voucher)", type: "feature" },

      // Reports (Purchase, Finance, Inventory)
      { key: "purchaseregisterreport", label: "Purchase Register Report", type: "feature" },
      { key: "itempurchasehistoryreport", label: "Item Purchase History Report", type: "feature" },
      { key: "supplieroutstandingreport", label: "Supplier Outstanding Report", type: "feature" },
      { key: "supplierpayablesreport", label: "Supplier Outstanding Payables", type: "feature" },
      { key: "purchasereturnsanalysisreport", label: "Purchase Returns Analysis Report", type: "feature" },
      { key: "pricevariancereport", label: "Price Variance Report", type: "feature" },
      { key: "profitandlossreport", label: "Profit and Loss Report", type: "feature" },
      { key: "customeroutstandingreport", label: "Customer Outstanding Report", type: "feature" },
      { key: "debtorsledgerreport", label: "Debtors Ledger Report", type: "feature" },
      { key: "voucherregisterreport", label: "Voucher Register Report", type: "feature" },
      { key: "outstandingreceivablereport", label: "Outstanding Receivables Report", type: "feature" },
      { key: "paymentduereport", label: "Payment Due Report", type: "feature" },
      { key: "stockbalancesreport", label: "Stock Balances Report", type: "feature" },
      { key: "fastmovingreport", label: "Fast Moving Report", type: "feature" },
      { key: "slowmovingreport", label: "Slow Moving Report", type: "feature" },
      { key: "expireditemsreport", label: "Expired Items Report", type: "feature" },
      { key: "stockadjustmentsreport", label: "Stock Adjustments Report", type: "feature" },
      { key: "stocktransferreport", label: "Stock Transfer Register Report", type: "feature" },
      { key: "inventoryhealthmonitorreport", label: "Inventory Health Monitor", type: "feature" },
    ],
    dashboards: [

          { key: "pos-today-sales", label: "Today Sales", type: "dashboard" },
      { key: "pos-total-transactions", label: "Total Transactions", type: "dashboard" },
      { key: "pos-avg-order", label: "Average Order Value", type: "dashboard" },
]
  },



  "executive-overview": {
    name: "Executive Overview",
    icon: "🎯",
    features: [

      { key: "kpi-reports", label: "KPI Reports", type: "feature" },
    ],
    dashboards: [

    ]
  },


  "business-intelligence": {
    name: "Business Intelligence",
    path: "/business-intelligence",
    icon: "📈",
    features: [
      { key: "executive-dashboard", label: "Executive Dashboard", type: "feature" },
      { key: "data-sources", label: "Data Sources & Ingestion", type: "feature" },
      { key: "datasets", label: "Analytical Datasets", type: "feature" },
      { key: "data-prep", label: "Data Preparation Studio", type: "feature" },
      { key: "data-models", label: "Data Models & Star Schema", type: "feature" },
      { key: "etl-pipelines", label: "ETL Pipelines Manager", type: "feature" },
      { key: "data-quality", label: "Data Quality & Quarantine", type: "feature" },
      { key: "multidimensional", label: "Multidimensional Slicing", type: "feature" },
      { key: "insights", label: "Automated Exceptions", type: "feature" },
      { key: "dashboard-builder", label: "Dashboard Builder", type: "feature" },
      { key: "dashboards", label: "Custom Dashboards", type: "feature" },
      { key: "financial", label: "Financial Analytics", type: "feature" },
      { key: "inventory", label: "Inventory Analytics", type: "feature" },
      { key: "purchase", label: "Purchase Analytics", type: "feature" },
      { key: "pos", label: "POS Analytics", type: "feature" },
      { key: "administration", label: "Administration Analytics", type: "feature" },
      { key: "cross-module", label: "Cross Module Analytics", type: "feature" },
      { key: "kpi-center", label: "KPI Center", type: "feature" },
      { key: "data-explorer", label: "Data Explorer", type: "feature" },
      { key: "ai-insights", label: "AI Insights", type: "feature" },
      { key: "banks-ai", label: "Ask Banks AI", type: "feature" },
      { key: "alerts", label: "Alerts Center", type: "feature" },
      { key: "report-center", label: "Report Center", type: "feature" },
      { key: "settings", label: "BI Settings", type: "feature" }
    ],
    dashboards: [
      { key: "bi-executive-summary", label: "Executive Summary Dashboard", type: "dashboard" },
      { key: "bi-revenue-performance", label: "Revenue & Sales Performance", type: "dashboard" },
      { key: "bi-procurement-spend", label: "Procurement & Spend Dashboard", type: "dashboard" },
      { key: "bi-inventory-valuation", label: "Inventory Valuation & Stock", type: "dashboard" },
      { key: "bi-financial-gl", label: "General Ledger Financials", type: "dashboard" }
    ]
  },

  system: {
    name: "System Operations",
    icon: "🔧",
    features: [
      { key: "license-renewal", label: "License Renewal Access", type: "feature", isExclusive: true }
    ],
    dashboards: [      { key: "sys-cpu-usage", label: "System CPU Usage", type: "dashboard" },
      { key: "sys-memory-usage", label: "System Memory Usage", type: "dashboard" },
      { key: "sys-active-sessions", label: "Active User Sessions", type: "dashboard" },
]
  }
};

export function getAllModuleKeys() {
  return Object.keys(MODULES_REGISTRY);
}

export function getModuleInfo(moduleKey) {
  return MODULES_REGISTRY[moduleKey] || null;
}

export function getAllFeatures(includeExclusive = false) {
  const features = [];
  Object.entries(MODULES_REGISTRY).forEach(([moduleKey, moduleInfo]) => {
    const allItems = [...(moduleInfo.features || []), ...(moduleInfo.dashboards || [])].filter(
      (item) => includeExclusive || !item.isExclusive,
    );
    allItems.forEach(feature => {
      features.push({
        module_key: moduleKey,
        feature_key: `${moduleKey}:${feature.key}`,
        label: feature.label,
        type: feature.type || "feature",
        path: `/${moduleKey}/${feature.key}`,
        isExclusive: !!feature.isExclusive,
      });
    });
  });
  return features;
}

export function getExclusiveFeatures() {
  const exclusive = [];
  Object.entries(MODULES_REGISTRY).forEach(([moduleKey, moduleInfo]) => {
    const allItems = [...(moduleInfo.features || []), ...(moduleInfo.dashboards || [])].filter(
      (item) => item.isExclusive,
    );
    allItems.forEach((feature) => {
      exclusive.push({
        module_key: moduleKey,
        feature_key: `${moduleKey}:${feature.key}`,
        key: feature.key,
        label: feature.label,
        type: feature.type || "feature",
        path: `/${moduleKey}/${feature.key}`,
        isExclusive: true,
      });
    });
  });
  return exclusive;
}

export function getAllDashboards() {
  const dashboards = [];
  Object.entries(MODULES_REGISTRY).forEach(([moduleKey, moduleInfo]) => {
    moduleInfo.dashboards.forEach(dashboard => {
      dashboards.push({
        module_key: moduleKey,
        feature_key: `${moduleKey}:${dashboard.key}`,
        label: dashboard.label,
        type: dashboard.type,
        path: `/${moduleKey}/${dashboard.key}`,
      });
    });
  });
  return dashboards;
}

export function getModuleFeatures(moduleKey) {
  const moduleInfo = MODULES_REGISTRY[moduleKey];
  if (!moduleInfo) return [];
  const allItems = [...(moduleInfo.features || []), ...(moduleInfo.dashboards || [])].filter(item => !item.isExclusive);
  return allItems.map(feature => ({
    module_key: moduleKey,
    feature_key: `${moduleKey}:${feature.key}`,
    label: feature.label,
    type: feature.type || "feature",
    path: `/${moduleKey}/${feature.key}`,
  }));
}

export function getModuleDashboards(moduleKey) {
  const moduleInfo = MODULES_REGISTRY[moduleKey];
  if (!moduleInfo) return [];
  return moduleInfo.dashboards.map(dashboard => ({
    module_key: moduleKey,
    feature_key: `${moduleKey}:${dashboard.key}`,
    label: dashboard.label,
    type: dashboard.type,
    path: `/${moduleKey}/${dashboard.key}`,
  }));
}
