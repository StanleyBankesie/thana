export const DASHBOARD_CARDS = {
  sales: [
    { key: "sales-total-revenue", label: "Total Sales This Month", aliases: ["sales-this-month", "total-revenue"] },
    { key: "sales-avg-sales-this-month", label: "Average Sales This Month", aliases: ["avg-sales-this-month", "average-sales-this-month", "avg-sales-month", "sales-avg-sales"] },
    { key: "sales-open-quotations", label: "Open Quotations", aliases: ["open-quotations"] },
    { key: "sales-pending-deliveries", label: "Pending Deliveries", aliases: ["pending-deliveries"] },
    { key: "sales-overdue-invoices", label: "Overdue Invoices", aliases: ["overdue-invoices"] },
    { key: "sales-growth", label: "Sales Growth %", aliases: ["sales-growth"] },
    { key: "sales-pending-orders", label: "Pending Orders", aliases: ["pending-orders"] },
    { key: "sales-active-customers", label: "Active Customers", aliases: ["active-customers"] },
  ],
  purchase: [
    { key: "purchase-total-value", label: "Purchases (Last 30 Days)", aliases: ["total-purchases"] },
    { key: "purchase-active-pos", label: "Active Purchase Orders", aliases: ["active-purchase-orders", "purchase-pending-pos"] },
    { key: "purchase-active-suppliers", label: "Active Suppliers", aliases: ["active-suppliers"] },
    { key: "purchase-pending-approvals", label: "Pending Approvals", aliases: ["pending-approvals"] },
    { key: "purchase-outstanding-payables", label: "Outstanding Payables", aliases: ["outstanding-payables"] },
  ],
  inventory: [
    { key: "inventory-total-items", label: "Items Tracked", aliases: ["items-tracked"] },
    { key: "inventory-stock-quantity", label: "Stock Quantity", aliases: ["stock-quantity"] },
    { key: "inventory-pending-requisitions", label: "Pending Requisitions", aliases: ["pending-requisitions"] },
    { key: "inventory-low-stock", label: "Low Stock Items", aliases: ["low-stock-items"] },
    { key: "inventory-warehouses", label: "Active Warehouses", aliases: ["warehouses"] },
  ],
  finance: [
    { key: "finance-cash-balance", label: "Cash on Hand", aliases: ["cash-balance"] },
    { key: "finance-bank-balance", label: "Bank Balance", aliases: ["bank-balance"] },
    { key: "finance-pending-vouchers", label: "Pending Vouchers", aliases: ["pending-vouchers"] },
    { key: "finance-net-income", label: "Net Income (MTD)", aliases: ["net-income"] },
    { key: "finance-ar", label: "Accounts Receivable", aliases: ["ar"] },
    { key: "finance-ap", label: "Accounts Payable", aliases: ["ap"] },
  ],
  hr: [
    { key: "hr-total-employees", label: "Active Employees", aliases: ["total-employees"] },
    { key: "hr-on-leave", label: "Active on Leave", aliases: ["active-on-leave", "on-leave"] },
    { key: "hr-monthly-payroll", label: "Monthly Payroll", aliases: ["monthly-payroll"] },
    { key: "hr-pending-approvals", label: "Pending Approvals", aliases: ["pending-approvals"] },
    { key: "hr-new-hires", label: "New Hires (30 Days)", aliases: ["new-hires"] },
  ],
  maintenance: [
    { key: "maint-open-requests", label: "New Requests", aliases: ["open-requests", "maint-open-work-orders"] },
    { key: "maint-active-jobs", label: "Active Job Orders", aliases: ["in-progress-jobs", "maint-assets-in-maint"] },
    { key: "maint-overdue-pm", label: "Overdue PM Tasks", aliases: ["overdue-pm"] },
    { key: "maint-total-assets", label: "Total Assets", aliases: ["total-assets"] },
  ],
  production: [
    { key: "prod-active-orders", label: "Active Production Orders", aliases: ["active-orders", "active-production-orders"] },
    { key: "prod-job-cards", label: "Open Job Cards", aliases: ["job-cards", "open-job-cards"] },
    { key: "prod-pending-requisitions", label: "Pending Requisitions", aliases: ["pending-requisitions"] },
    { key: "prod-active-boms", label: "Active BOMs", aliases: ["active-boms", "boms"] },
    { key: "prod-completed-orders", label: "Completed Orders" },
    { key: "prod-yield", label: "Production Yield" },
  ],
  projects: [
    { key: "pm-active-projects", label: "Active Projects", aliases: ["active-projects"] },
    { key: "pm-overdue-tasks", label: "Overdue Tasks", aliases: ["overdue-tasks"] },
    { key: "pm-total-milestones", label: "Total Milestones", aliases: ["total-milestones"] },
  ],
  pos: [
    { key: "pos-today-sales", label: "Today Sales", aliases: ["today-sales"] },
    { key: "pos-total-transactions", label: "Total Transactions", aliases: ["total-transactions"] },
    { key: "pos-avg-order", label: "Average Order Value", aliases: ["avg-order", "average-order"] },
    { key: "pos-monthly-revenue", label: "Monthly Revenue", aliases: ["monthly-revenue"] },
  ],
  bi: [
    { key: "bi-company-revenue", label: "Company Revenue" },
    { key: "bi-profit-margin", label: "Profit Margin" },
    { key: "bi-top-product", label: "Top Selling Product" },
  ],
  executive: [
    { key: "exec-gross-profit", label: "Gross Profit" },
    { key: "exec-net-income", label: "Net Income" },
    { key: "exec-total-expenses", label: "Total Expenses" },
  ],
  service: [
    { key: "sm-service-requests", label: "Customer Service Requests", aliases: ["service-requests"] },
    { key: "sm-open-orders", label: "Open Service Orders", aliases: ["open-orders"] },
    { key: "sm-executions", label: "Service Executions", aliases: ["executions"] },
    { key: "sm-confirmations", label: "Confirmations", aliases: ["confirmations"] },
    { key: "sm-active-contracts", label: "Active Contracts" },
    { key: "sm-pending-invoices", label: "Pending Service Invoices" },
    { key: "sm-total-revenue", label: "Total Service Revenue" },
  ],
  transport: [
    { key: "trans-active-vehicles", label: "Active Vehicles" },
    { key: "trans-ongoing-trips", label: "Ongoing Trips" },
    { key: "trans-pending-maint", label: "Pending Fleet Maintenance" },
  ],
  admin: [
    { key: "admin-active-users", label: "Active Users" },
    { key: "admin-role-count", label: "Role Count" },
    { key: "admin-recent-logins", label: "Recent Logins" },
  ],
  system: [
    { key: "sys-cpu-usage", label: "System CPU Usage" },
    { key: "sys-memory-usage", label: "System Memory Usage" },
    { key: "sys-active-sessions", label: "Active User Sessions" },
  ],
};

const modulePrefixMap = {
  sales: "sales",
  purchase: "purchase",
  inventory: "inventory",
  finance: "finance",
  hr: "hr",
  "human-resources": "hr",
  maintenance: "maintenance",
  production: "production",
  projects: "projects",
  "project-management": "projects",
  pos: "pos",
  bi: "bi",
  "business-intelligence": "bi",
  executive: "executive",
  "executive-overview": "executive",
  service: "service",
  "service-management": "service",
  transport: "transport",
  admin: "admin",
  administration: "admin",
  system: "system",
  "system-configuration": "system",
};

/**
 * Returns parent module key for a given card key.
 */
export function getCardModule(cardKey) {
  const norm = String(cardKey || "").toLowerCase().trim();
  for (const [modKey, cards] of Object.entries(DASHBOARD_CARDS)) {
    for (const c of cards) {
      if (c.key === norm || (Array.isArray(c.aliases) && c.aliases.includes(norm))) {
        return modKey;
      }
    }
  }
  // Try prefix matching
  const prefix = norm.split("-")[0];
  for (const [alias, canonical] of Object.entries(modulePrefixMap)) {
    if (prefix === alias || prefix === canonical) return canonical;
  }
  return null;
}

/**
 * Returns all recognized alias keys and normalized variations for a given card.
 */
export function getAllCardAliases(cardKey) {
  const norm = String(cardKey || "").toLowerCase().trim();
  const set = new Set([norm]);
  for (const [, cards] of Object.entries(DASHBOARD_CARDS)) {
    for (const c of cards) {
      const match = c.key === norm || (Array.isArray(c.aliases) && c.aliases.includes(norm));
      if (match) {
        set.add(c.key);
        if (Array.isArray(c.aliases)) {
          c.aliases.forEach((a) => set.add(a));
        }
      }
    }
  }
  return Array.from(set);
}
