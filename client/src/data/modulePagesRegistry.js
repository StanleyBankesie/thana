/**
 * @fileoverview Central registry of individual pages for every module.
 * Used by Basic Mode homepage and navigation to display the top 3 accessible
 * individual pages per assigned module.
 */

export const MODULE_PRIMARY_PAGES = {
  sales: [
    { title: "Quotations", path: "/sales/quotations", feature_key: "quotations", icon: "📋", description: "Create and manage customer price quotes" },
    { title: "Sales Orders", path: "/sales/sales-orders", feature_key: "sales-orders", icon: "📑", description: "Track customer orders and fulfillments" },
    { title: "Invoices", path: "/sales/invoices", feature_key: "invoices", icon: "🧾", description: "Manage billing and tax invoices" },
    { title: "Delivery Management", path: "/sales/delivery", feature_key: "delivery", icon: "🚚", description: "Coordinate delivery notes and dispatch" },
    { title: "Customer Management", path: "/sales/customers", feature_key: "customers", icon: "👥", description: "Customer directory and account balances" },
    { title: "Price Setup", path: "/sales/price-setup", feature_key: "price-setup", icon: "🏷️", description: "Product price lists and rate cards" },
    { title: "Sales Returns", path: "/sales/returns", feature_key: "returns", icon: "🔄", description: "Customer return notes and credit memos" },
    { title: "Discount Schemes", path: "/sales/discount-schemes", feature_key: "discount-schemes", icon: "🎁", description: "Manage promotional pricing and discounts" },
  ],

  inventory: [
    { title: "Item Master", path: "/inventory/items", feature_key: "items", icon: "📦", description: "Product catalog, pricing, and reorder levels" },
    { title: "Stock Journal", path: "/inventory/stock-journal", feature_key: "stock-journal", icon: "📖", description: "Record daily stock movements and entries" },
    { title: "Stock Transfers", path: "/inventory/stock-transfers", feature_key: "stock-transfers", icon: "🔄", description: "Transfer stock between warehouses/branches" },
    { title: "Stock Adjustments", path: "/inventory/stock-adjustments", feature_key: "stock-adjustments", icon: "⚖️", description: "Record manual inventory quantity adjustments" },
    { title: "Physical Stock Take", path: "/inventory/physical-stock-take", feature_key: "physical-stock-take", icon: "📋", description: "Comprehensive audit stock counts" },
    { title: "Expired Items Report", path: "/inventory/reports/expired-items", feature_key: "expired-items", icon: "⚠️", description: "Monitor near-expiry and expired stock" },
    { title: "Warehouses", path: "/inventory/warehouses", feature_key: "warehouses", icon: "🏬", description: "Warehouse locations and bin setup" },
  ],

  purchase: [
    { title: "Direct Purchase", path: "/purchase/direct-purchase", feature_key: "direct-purchase", icon: "⚡", description: "Quick direct purchases and expense entries" },
    { title: "Purchase Orders", path: "/purchase/purchase-orders-local", feature_key: "purchase-orders-local", icon: "📑", description: "Create and issue purchase orders to vendors" },
    { title: "Purchase Bills", path: "/purchase/purchase-bills-local", feature_key: "purchase-bills-local", icon: "🧾", description: "Verify and process vendor purchase bills" },
    { title: "Suppliers", path: "/purchase/suppliers", feature_key: "suppliers", icon: "🏢", description: "Supplier directory and payable balances" },
    { title: "General Requisitions", path: "/purchase/general-requisitions", feature_key: "general-requisitions", icon: "📝", description: "Internal employee purchase requisitions" },
    { title: "Request for Quotation", path: "/purchase/rfqs", feature_key: "rfqs", icon: "📬", description: "Request pricing proposals from suppliers" },
  ],

  pos: [
    { title: "Sales Entry", path: "/pos/sales-entry", feature_key: "sales-entry", icon: "🛒", description: "Fast barcode checkout, cash & digital sales" },
    { title: "Receipt Reprint", path: "/pos/receipt-reprint", feature_key: "receipt-reprint", icon: "🖨️", description: "Search, preview, and reprint sales slips" },
    { title: "Day Management", path: "/pos/day-management", feature_key: "day-management", icon: "⏱️", description: "Open and close POS daily register" },
    { title: "POS Invoices", path: "/pos/invoices", feature_key: "invoices", icon: "🧾", description: "History of retail sales invoices" },
    { title: "Cash Collection", path: "/pos/cash-collection", feature_key: "cash-collection", icon: "💵", description: "Till drops, cash float, and safe deposits" },
    { title: "POS Returns", path: "/pos/returns", feature_key: "returns", icon: "🔄", description: "Customer returns and exchanges" },
  ],

  finance: [
    { title: "Chart of Accounts", path: "/finance/chart-of-accounts", feature_key: "chart-of-accounts", icon: "📊", description: "General ledger account directory" },
    { title: "Payment Vouchers", path: "/finance/payment-vouchers", feature_key: "payment-vouchers", icon: "💳", description: "Record cash & bank disbursements" },
    { title: "Receipt Vouchers", path: "/finance/receipt-vouchers", feature_key: "receipt-vouchers", icon: "📥", description: "Record incoming customer receipts" },
    { title: "Journal Vouchers", path: "/finance/journal-vouchers", feature_key: "journal-vouchers", icon: "📝", description: "Double-entry general journal adjustments" },
    { title: "Bank Reconciliation", path: "/finance/bank-reconciliation", feature_key: "bank-reconciliation", icon: "🏦", description: "Reconcile bank accounts with statements" },
    { title: "Accounts Setup", path: "/finance/accounts", feature_key: "accounts", icon: "⚙️", description: "Manage ledger accounts and nature" },
  ],

  "human-resources": [
    { title: "Employees", path: "/human-resources/employees", feature_key: "employees", icon: "👥", description: "Staff directory and personal profiles" },
    { title: "Attendance", path: "/human-resources/attendance", feature_key: "attendance", icon: "⏱️", description: "Daily attendance and clocking records" },
    { title: "Leave Requests", path: "/human-resources/leave", feature_key: "leave", icon: "🏖️", description: "Employee leave applications and approvals" },
    { title: "Payroll", path: "/human-resources/payroll", feature_key: "payroll", icon: "💰", description: "Salary calculation, allowances, and payslips" },
    { title: "Departments", path: "/human-resources/departments", feature_key: "departments", icon: "🏢", description: "Department and division structures" },
  ],

  maintenance: [
    { title: "Maintenance Jobs", path: "/maintenance/jobs", feature_key: "jobs", icon: "🛠️", description: "Equipment repair and service work orders" },
    { title: "Maintenance Requests", path: "/maintenance/requests", feature_key: "requests", icon: "📋", description: "Facility breakdown fault tickets" },
    { title: "Equipment Master", path: "/maintenance/equipment", feature_key: "equipment", icon: "⚙️", description: "Equipment and asset machinery register" },
    { title: "Preventive Maintenance", path: "/maintenance/preventive", feature_key: "preventive", icon: "📅", description: "Scheduled servicing and inspection plans" },
  ],

  production: [
    { title: "Production Orders", path: "/production/orders", feature_key: "orders", icon: "🏭", description: "Manufacturing jobs and progress tracking" },
    { title: "Bill of Materials", path: "/production/bom", feature_key: "bom", icon: "🧩", description: "Product recipes and component formulations" },
    { title: "Work Centers", path: "/production/work-centers", feature_key: "work-centers", icon: "⚙️", description: "Factory work centers and production lines" },
    { title: "Quality Checks", path: "/production/quality", feature_key: "quality", icon: "✅", description: "Quality inspection and approval tests" },
  ],

  "project-management": [
    { title: "Projects", path: "/project-management/projects", feature_key: "projects", icon: "📌", description: "Active projects and execution tracking" },
    { title: "Tasks", path: "/project-management/tasks", feature_key: "tasks", icon: "✅", description: "Assigned tasks and deliverables" },
    { title: "Milestones", path: "/project-management/milestones", feature_key: "milestones", icon: "🚩", description: "Project milestone checkpoints" },
    { title: "Timesheets", path: "/project-management/timesheets", feature_key: "timesheets", icon: "⏱️", description: "Employee timesheet hours" },
  ],

  "service-management": [
    { title: "Service Tickets", path: "/service-management/tickets", feature_key: "tickets", icon: "🎫", description: "Customer helpdesk and ticket tracking" },
    { title: "Service Contracts", path: "/service-management/contracts", feature_key: "contracts", icon: "📜", description: "SLA contracts and maintenance agreements" },
    { title: "Technicians", path: "/service-management/technicians", feature_key: "technicians", icon: "👨‍🔧", description: "Field technician roster and jobs" },
    { title: "Service Scheduling", path: "/service-management/scheduling", feature_key: "scheduling", icon: "📅", description: "Dispatch and appointment calendar" },
  ],

  transport: [
    { title: "Transport Requests", path: "/transport/requests", feature_key: "requests", icon: "📋", description: "Vehicle trip requests and dispatch orders" },
    { title: "Fleet Vehicles", path: "/transport/vehicles", feature_key: "vehicles", icon: "🚚", description: "Fleet inventory and vehicle status" },
    { title: "Trip Management", path: "/transport/trips", feature_key: "trips", icon: "🗺️", description: "Driver manifests and live journey tracking" },
    { title: "Fuel Logs", path: "/transport/fuel", feature_key: "fuel", icon: "⛽", description: "Fuel receipts and consumption monitoring" },
    { title: "Drivers", path: "/transport/drivers", feature_key: "drivers", icon: "👤", description: "Driver profiles and licensing validity" },
  ],

  administration: [
    { title: "User Management", path: "/administration/users", feature_key: "users", icon: "👥", description: "System users, logins, and access status" },
    { title: "Role Setup", path: "/admin/roles", feature_key: "roles", icon: "🛡️", description: "Role definitions and assigned modules" },
    { title: "User Permissions", path: "/admin/user-permissions", feature_key: "user-permissions", icon: "🔐", description: "Configure feature level permissions" },
    { title: "Workflow Configuration", path: "/administration/workflows", feature_key: "workflows", icon: "🔄", description: "Document approval chains and rules" },
    { title: "System Log Book", path: "/administration/system-log-book", feature_key: "system-log-book", icon: "📜", description: "System audit log and user actions" },
  ],

  "system-configuration": [
    { title: "General Settings", path: "/system-configuration/general", feature_key: "general", icon: "⚙️", description: "System layout, mode, and configurations" },
    { title: "Branch Setup", path: "/system-configuration/branches", feature_key: "branches", icon: "🏢", description: "Company branches and locations" },
    { title: "Company Profile", path: "/system-configuration/company", feature_key: "company", icon: "🏛️", description: "Organization details and legal identity" },
  ],

  "business-intelligence": [
    { title: "Executive Dashboard", path: "/business-intelligence", feature_key: "executive-dashboard", icon: "📊", description: "Unified executive analytics and charts" },
    { title: "Report Center", path: "/business-intelligence/reports", feature_key: "reports", icon: "📑", description: "Custom business intelligence reports" },
    { title: "Data Sources", path: "/business-intelligence/data-sources", feature_key: "data-sources", icon: "🗄️", description: "Connected data sources and pipelines" },
  ],

  "executive-overview": [
    { title: "Executive Overview", path: "/executive-overview", feature_key: "executive-overview", icon: "📈", description: "Executive dashboard metrics and KPIs" },
    { title: "Outstanding Receivables", path: "/executive-overview/outstanding-receivables", feature_key: "outstanding-receivables", icon: "💰", description: "Overdue customer receivable aging" },
    { title: "Outstanding Payables", path: "/executive-overview/outstanding-payables", feature_key: "outstanding-payables", icon: "🧾", description: "Pending vendor liabilities and aging" },
  ],
};

/**
 * Filter and retrieve up to `maxPages` individual pages assigned to the current user
 * for the specified moduleKey.
 */
export function getAssignedPagesForModule(moduleKey, permContext, maxPages = 3) {
  const { canAccessPath, canAccessFeatureKey, isSuper } = permContext || {};
  const pages = MODULE_PRIMARY_PAGES[moduleKey] || [];

  const accessible = pages.filter((page) => {
    if (!page.path) return false;
    if (isSuper) return true;

    if (typeof canAccessFeatureKey === "function" && page.feature_key) {
      if (canAccessFeatureKey(moduleKey, page.feature_key)) return true;
    }

    if (typeof canAccessPath === "function") {
      return canAccessPath(page.path, "view");
    }

    return false;
  });

  return accessible.slice(0, maxPages);
}
