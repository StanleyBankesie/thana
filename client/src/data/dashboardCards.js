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
  pos: "pos",
  bi: "bi",
  "business-intelligence": "bi",
  executive: "executive",
  "executive-overview": "executive",
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
