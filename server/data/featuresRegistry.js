/**
 * Complete Features Registry for Backend
 * Must stay in sync with client/src/data/modulesRegistry.js
 * Contains all modules, features, and dashboards for RBAC system
 */

// Main registry mapping module keys to their respective features and dashboards
// This serves as the single source of truth for all system features in the backend
export const FEATURES_REGISTRY = {
  // Administration Module: Contains features for user, role, company, and system configuration
  administration: {
    features: [
      { feature_key: "administration:roles", type: "feature", label: "Role Setup", path: "/administration/access/roles" },
      { feature_key: "administration:user-permissions", type: "feature", label: "User Permissions", path: "/administration/access/user-permissions" },
      { feature_key: "administration:user-overrides", type: "feature", label: "Exceptional Permissions", path: "/administration/access/user-overrides" },
      { feature_key: "administration:users", type: "feature", label: "User Management", path: "/administration/users" },
      { feature_key: "administration:settings", type: "feature", label: "Settings", path: "/administration/settings" },
      { feature_key: "administration:diagnostics", type: "feature", label: "Diagnostics", path: "/administration/diagnostics" },
      { feature_key: "administration:workflows", type: "feature", label: "Workflow Configuration", path: "/administration/workflows" },
      { feature_key: "administration:workflow-approvals", type: "feature", label: "Workflow Approvals", path: "/administration/workflows/approvals" },
      { feature_key: "administration:document-review", type: "feature", label: "Document Review", path: "/administration/workflows/approvals" },
    ],
    dashboards: [
      { feature_key: "administration:system-log-book", type: "dashboard", label: "System Log Book Report", path: "/administration/reports/system-log-book" },
      { feature_key: "administration:user-login-activity", type: "dashboard", label: "User Login Activity Report", path: "/administration/reports/user-login-activity" },
          { feature_key: "administration:admin-active-users", type: "dashboard", label: "Active Users", path: "/administration/reports/admin-active-users" },
      { feature_key: "administration:admin-role-count", type: "dashboard", label: "Role Count", path: "/administration/reports/admin-role-count" },
      { feature_key: "administration:admin-recent-logins", type: "dashboard", label: "Recent Logins", path: "/administration/reports/admin-recent-logins" },
],
  },

  // Sales Module: Contains features for managing quotations, sales orders, invoices, and customer relations
  sales: {
    features: [
      { feature_key: "sales:quotations", type: "feature", label: "Quotations", path: "/sales/quotations" },
      { feature_key: "sales:sales-orders", type: "feature", label: "Sales Orders", path: "/sales/sales-orders" },
      { feature_key: "sales:invoices", type: "feature", label: "Invoices", path: "/sales/invoices" },
      { feature_key: "sales:delivery", type: "feature", label: "Delivery Management", path: "/sales/delivery" },
      { feature_key: "sales:customers", type: "feature", label: "Customer Management", path: "/sales/customers" },

      { feature_key: "sales:accountsreceivableagingreport", type: "feature", label: " Accounts Receivable Aging Report", path: "/sales/reports/accountsreceivableagingreport" },
      { feature_key: "sales:cancelledordersreport", type: "feature", label: " Cancelled Orders Report", path: "/sales/reports/cancelledordersreport" },
      { feature_key: "sales:customerhistoryreport", type: "feature", label: " Customer History Report", path: "/sales/reports/customerhistoryreport" },
      { feature_key: "sales:customerlistreport", type: "feature", label: " Customer List Report", path: "/sales/reports/customerlistreport" },
      { feature_key: "sales:customerorderhistoryreport", type: "feature", label: " Customer Order History Report", path: "/sales/reports/customerorderhistoryreport" },
      { feature_key: "sales:debtorsbalancereport", type: "feature", label: " Debtors Balance Report", path: "/sales/reports/debtorsbalancereport" },
      { feature_key: "sales:deliveryregisterreport", type: "feature", label: " Delivery Register Report", path: "/sales/reports/deliveryregisterreport" },
      { feature_key: "sales:discountutilizationreport", type: "feature", label: " Discount Utilization Report", path: "/sales/reports/discountutilizationreport" },
      { feature_key: "sales:invoicesummaryreport", type: "feature", label: " Invoice Summary Report", path: "/sales/reports/invoicesummaryreport" },
      { feature_key: "sales:monthlysalestrendreport", type: "feature", label: " Monthly Sales Trend Report", path: "/sales/reports/monthlysalestrendreport" },
      { feature_key: "sales:pricelistreport", type: "feature", label: " Price List Report", path: "/sales/reports/pricelistreport" },
      { feature_key: "sales:prospectivecustomerlistreport", type: "feature", label: " Prospective Customer List Report", path: "/sales/reports/prospectivecustomerlistreport" },
      { feature_key: "sales:quotationconversionreport", type: "feature", label: " Quotation Conversion Report", path: "/sales/reports/quotationconversionreport" },
      { feature_key: "sales:quotationsummaryreport", type: "feature", label: " Quotation Summary Report", path: "/sales/reports/quotationsummaryreport" },
      { feature_key: "sales:revenuebycustomerreport", type: "feature", label: " Revenue By Customer Report", path: "/sales/reports/revenuebycustomerreport" },
      { feature_key: "sales:revenuebyproductreport", type: "feature", label: " Revenue By Product Report", path: "/sales/reports/revenuebyproductreport" },
      { feature_key: "sales:salesorderstatusreport", type: "feature", label: " Sales Order Status Report", path: "/sales/reports/salesorderstatusreport" },
      { feature_key: "sales:salesprofitabilityreport", type: "feature", label: " Sales Profitability Report", path: "/sales/reports/salesprofitabilityreport" },
      { feature_key: "sales:salesregisterreport", type: "feature", label: " Sales Register Report", path: "/sales/reports/salesregisterreport" },
      { feature_key: "sales:salesreturnreport", type: "feature", label: " Sales Return Report", path: "/sales/reports/salesreturnreport" },
      { feature_key: "sales:salestrackingreport", type: "feature", label: " Sales Tracking Report", path: "/sales/reports/salestrackingreport" },
      { feature_key: "sales:returns", type: "feature", label: "Sales Returns", path: "/sales/returns" },
      { feature_key: "sales:price-setup", type: "feature", label: "Price Setup", path: "/sales/price-setup" },
      { feature_key: "sales:discount-schemes", type: "feature", label: "Discount Schemes", path: "/sales/discount-schemes" },
      { feature_key: "sales:customer-credit", type: "feature", label: "Customer Credit", path: "/sales/customer-credit" },
      { feature_key: "sales:bulk-upload", type: "feature", label: "Bulk Customer Upload", path: "/sales/bulk-upload" },
      { feature_key: "sales:sales-upload", type: "feature", label: "Sales Upload", path: "/sales/sales-upload" },
      { feature_key: "sales:prospect-customers", type: "feature", label: "Prospective Customers", path: "/sales/prospect-customers" },
      { feature_key: "sales:prospect-conversion", type: "feature", label: "Prospect Conversion", path: "/sales/prospect-conversion" },
    ],
    dashboards: [

          { feature_key: "sales:sales-total-revenue", type: "dashboard", label: "Total Revenue", path: "/sales/reports/sales-total-revenue" },
      { feature_key: "sales:sales-pending-orders", type: "dashboard", label: "Pending Orders", path: "/sales/reports/sales-pending-orders" },
      { feature_key: "sales:sales-active-customers", type: "dashboard", label: "Active Customers", path: "/sales/reports/sales-active-customers" },
],
  },

  // Purchase Module: Contains features for procurement, purchase orders, RFQs, and supplier management
  purchase: {
    features: [
      { feature_key: "purchase:direct-purchase", type: "feature", label: "Direct Purchase", path: "/purchase/direct-purchase" },
      { feature_key: "purchase:general-requisitions", type: "feature", label: "General Requisition", path: "/purchase/general-requisitions" },
      { feature_key: "purchase:rfqs", type: "feature", label: "Request for Quotation", path: "/purchase/rfqs" },
      { feature_key: "purchase:supplier-quotations", type: "feature", label: "Supplier Quotations", path: "/purchase/supplier-quotations" },
      { feature_key: "purchase:quotation-analysis", type: "feature", label: "Quotation Analysis", path: "/purchase/quotation-analysis" },
      { feature_key: "purchase:purchase-orders-local", type: "feature", label: "Local Purchase Orders", path: "/purchase/purchase-orders-local" },
      { feature_key: "purchase:purchase-orders-import", type: "feature", label: "Import Purchase Orders", path: "/purchase/purchase-orders-import" },
      { feature_key: "purchase:shipping-advice", type: "feature", label: "Shipping Advice", path: "/purchase/shipping-advice" },
      { feature_key: "purchase:port-clearances", type: "feature", label: "Port Clearances", path: "/purchase/port-clearances" },
      { feature_key: "purchase:purchase-bills-local", type: "feature", label: "Local Purchase Bills", path: "/purchase/purchase-bills-local" },
      { feature_key: "purchase:purchase-bills-import", type: "feature", label: "Import Purchase Bills", path: "/purchase/purchase-bills-import" },
      { feature_key: "purchase:purchase-upload", type: "feature", label: "Purchase Upload", path: "/purchase/purchase-upload" },
      { feature_key: "purchase:suppliers", type: "feature", label: "Suppliers", path: "/purchase/suppliers" },
      { feature_key: "purchase:purchase-returns", type: "feature", label: "Purchase Returns", path: "/purchase/purchase-returns" },

      { feature_key: "purchase:cancelledpurchaseordersreport", type: "feature", label: " Cancelled Purchase Orders Report", path: "/purchase/reports/cancelledpurchaseordersreport" },
      { feature_key: "purchase:departmentpurchaseanalysisreport", type: "feature", label: " Department Purchase Analysis Report", path: "/purchase/reports/departmentpurchaseanalysisreport" },
      { feature_key: "purchase:importcostbreakdownreport", type: "feature", label: " Import Cost Breakdown Report", path: "/purchase/reports/importcostbreakdownreport" },
      { feature_key: "purchase:importorderlistreport", type: "feature", label: " Import Order List Report", path: "/purchase/reports/importorderlistreport" },
      { feature_key: "purchase:importordertrackingreport", type: "feature", label: " Import Order Tracking Report", path: "/purchase/reports/importordertrackingreport" },
      { feature_key: "purchase:itempurchasehistoryreport", type: "feature", label: " Item Purchase History Report", path: "/purchase/reports/itempurchasehistoryreport" },
      { feature_key: "purchase:leadtimeanalysisreport", type: "feature", label: " Lead Time Analysis Report", path: "/purchase/reports/leadtimeanalysisreport" },
      { feature_key: "purchase:localordertrackingreport", type: "feature", label: " Local Order Tracking Report", path: "/purchase/reports/localordertrackingreport" },
      { feature_key: "purchase:pendinggrntobillimportreport", type: "feature", label: " Pending Grn To Bill Import Report", path: "/purchase/reports/pendinggrntobillimportreport" },
      { feature_key: "purchase:pendinggrntobilllocalreport", type: "feature", label: " Pending Grn To Bill Local Report", path: "/purchase/reports/pendinggrntobilllocalreport" },
      { feature_key: "purchase:pendingshipmentdetailsreport", type: "feature", label: " Pending Shipment Details Report", path: "/purchase/reports/pendingshipmentdetailsreport" },
      { feature_key: "purchase:pricevariancereport", type: "feature", label: " Price Variance Report", path: "/purchase/reports/pricevariancereport" },
      { feature_key: "purchase:purchaseagingreport", type: "feature", label: " Purchase Aging Report", path: "/purchase/reports/purchaseagingreport" },
      { feature_key: "purchase:purchaseregisterreport", type: "feature", label: " Purchase Register Report", path: "/purchase/reports/purchaseregisterreport" },
      { feature_key: "purchase:purchasereturnsanalysisreport", type: "feature", label: " Purchase Returns Analysis Report", path: "/purchase/reports/purchasereturnsanalysisreport" },
      { feature_key: "purchase:purchasetrackingreport", type: "feature", label: " Purchase Tracking Report", path: "/purchase/reports/purchasetrackingreport" },
      { feature_key: "purchase:supplieroutstandingpayablesreport", type: "feature", label: " Supplier Outstanding Payables Report", path: "/purchase/reports/supplieroutstandingpayablesreport" },
      { feature_key: "purchase:supplierperformancereport", type: "feature", label: " Supplier Performance Report", path: "/purchase/reports/supplierperformancereport" },
      { feature_key: "purchase:supplierquotationanalysisreport", type: "feature", label: " Supplier Quotation Analysis Report", path: "/purchase/reports/supplierquotationanalysisreport" },
      { feature_key: "purchase:setup", type: "feature", label: "Purchase Setup", path: "/purchase/setup" },
    ],
    dashboards: [
          { feature_key: "purchase:purchase-total-value", type: "dashboard", label: "Total Purchase Value", path: "/purchase/reports/purchase-total-value" },
      { feature_key: "purchase:purchase-pending-pos", type: "dashboard", label: "Pending POs", path: "/purchase/reports/purchase-pending-pos" },
      { feature_key: "purchase:purchase-active-suppliers", type: "dashboard", label: "Active Suppliers", path: "/purchase/reports/purchase-active-suppliers" },
],
  },

  // Inventory Module: Contains features for material requisitions, stock management, and warehousing
  inventory: {
    features: [
      { feature_key: "inventory:stock", type: "feature", label: "Stock Balances & Overview", path: "/inventory/stock" },
      { feature_key: "inventory:material-requisitions", type: "feature", label: "Material Requisitions", path: "/inventory/material-requisitions" },
      { feature_key: "inventory:stock-upload", type: "feature", label: "Stock Upload", path: "/inventory/stock-upload" },
      { feature_key: "inventory:stock-updation", type: "feature", label: "Stock Updation", path: "/inventory/stock-updation" },
      { feature_key: "inventory:stock-adjustments", type: "feature", label: "Stock Adjustment", path: "/inventory/stock-adjustments" },
      { feature_key: "inventory:stock-transfers", type: "feature", label: "Stock Transfer", path: "/inventory/stock-transfers" },
      { feature_key: "inventory:stock-verification", type: "feature", label: "Stock Verification", path: "/inventory/stock-verification" },
      { feature_key: "inventory:return-to-stores", type: "feature", label: "Return to Stores Advice", path: "/inventory/return-to-stores" },
      { feature_key: "inventory:issue-to-requirement", type: "feature", label: "Issue to Requirement Area", path: "/inventory/issue-to-requirement" },
      { feature_key: "inventory:transfer-acceptance", type: "feature", label: "Transfer Acceptance", path: "/inventory/transfer-acceptance" },
      { feature_key: "inventory:grn-local", type: "feature", label: "Material Receipt (GRN) - Local", path: "/inventory/grn-local" },
      { feature_key: "inventory:grn-import", type: "feature", label: "Material Receipt (GRN) - Import", path: "/inventory/grn-import" },
      { feature_key: "inventory:items", type: "feature", label: "Item Management", path: "/inventory/items" },

      { feature_key: "inventory:unit-conversions", type: "feature", label: "Unit Conversion", path: "/inventory/unit-conversions" },
      { feature_key: "inventory:warehouses", type: "feature", label: "Warehouse Management", path: "/inventory/warehouses" },
      { feature_key: "inventory:batches", type: "feature", label: "Item Batches Tracking", path: "/inventory/batches" },
      { feature_key: "inventory:stock-taking", type: "feature", label: "Stock Taking", path: "/inventory/stock-taking" },
      { feature_key: "inventory:stock-reorder", type: "feature", label: "Stock Reorder", path: "/inventory/stock-reorder" },

      { feature_key: "inventory:fastmovingreport", type: "feature", label: " Fast Moving Report", path: "/inventory/reports/fastmovingreport" },
      { feature_key: "inventory:issueregisterreport", type: "feature", label: " Issue Register Report", path: "/inventory/reports/issueregisterreport" },
      { feature_key: "inventory:materialreturnreport", type: "feature", label: " Material Return Report", path: "/inventory/reports/materialreturnreport" },
      { feature_key: "inventory:nonmovingreport", type: "feature", label: " Non Moving Report", path: "/inventory/reports/nonmovingreport" },
      { feature_key: "inventory:slowmovingreport", type: "feature", label: " Slow Moving Report", path: "/inventory/reports/slowmovingreport" },
      { feature_key: "inventory:stockadjustmentreport", type: "feature", label: " Stock Adjustment Report", path: "/inventory/reports/stockadjustmentreport" },
      { feature_key: "inventory:stockaginganalysisreport", type: "feature", label: " Stock Aging Analysis Report", path: "/inventory/reports/stockaginganalysisreport" },
      { feature_key: "inventory:stockbalancesreport", type: "feature", label: " Stock Balances Report", path: "/inventory/reports/stockbalancesreport" },
      { feature_key: "inventory:stocktransferregisterreport", type: "feature", label: " Stock Transfer Register Report", path: "/inventory/reports/stocktransferregisterreport" },
      { feature_key: "inventory:stockvaluereport", type: "feature", label: " Stock Value Report", path: "/inventory/reports/stockvaluereport" },
      { feature_key: "inventory:stockverificationreport", type: "feature", label: " Stock Verification Report", path: "/inventory/reports/stockverificationreport" },
    ],
    dashboards: [
          { feature_key: "inventory:inventory-total-items", type: "dashboard", label: "Total Items", path: "/inventory/reports/inventory-total-items" },
      { feature_key: "inventory:inventory-low-stock", type: "dashboard", label: "Low Stock Alerts", path: "/inventory/reports/inventory-low-stock" },
      { feature_key: "inventory:inventory-warehouses", type: "dashboard", label: "Active Warehouses", path: "/inventory/reports/inventory-warehouses" },
],
  },

  // Finance Module: Contains features for accounting, vouchers, bank reconciliation, and budget management
  finance: {
    features: [
      { feature_key: "finance:journal-voucher", type: "feature", label: "Journal Entry", path: "/finance/journal-voucher" },
      { feature_key: "finance:payment-voucher", type: "feature", label: "Make Payment", path: "/finance/payment-voucher" },
      { feature_key: "finance:receipt-voucher", type: "feature", label: "Receive Payment", path: "/finance/receipt-voucher" },
      { feature_key: "finance:contra-voucher", type: "feature", label: "Contra Entry", path: "/finance/contra-voucher" },
      { feature_key: "finance:credit-note", type: "feature", label: "Credit Note", path: "/finance/credit-note" },
      { feature_key: "finance:debit-note", type: "feature", label: "Debit Note", path: "/finance/debit-note" },
      { feature_key: "finance:sales-voucher", type: "feature", label: "Sales Voucher", path: "/finance/sales-voucher" },
      { feature_key: "finance:purchase-voucher", type: "feature", label: "Purchase Voucher", path: "/finance/purchase-voucher" },
      { feature_key: "finance:chart-of-accounts", type: "feature", label: "Chart of Accounts", path: "/finance/chart-of-accounts" },
      { feature_key: "finance:account-groups", type: "feature", label: "Account Groups", path: "/finance/account-groups" },
      { feature_key: "finance:cost-centers", type: "feature", label: "Cost Centers", path: "/finance/cost-centers" },
      { feature_key: "finance:tax-codes", type: "feature", label: "Tax Codes & Deductions", path: "/finance/tax-codes" },
      { feature_key: "finance:currencies", type: "feature", label: "Currencies", path: "/finance/currencies" },
      { feature_key: "finance:fiscal-years", type: "feature", label: "Fiscal Years", path: "/finance/fiscal-years" },
      { feature_key: "finance:budget", type: "feature", label: "Budget Management", path: "/finance/budget" },
      { feature_key: "finance:bank-reconciliation", type: "feature", label: "Bank Reconciliation", path: "/finance/bank-reconciliation" },
      { feature_key: "finance:fixed-assets", type: "feature", label: "Fixed Assets", path: "/finance/fixed-assets" },
      { feature_key: "finance:opening-balances", type: "feature", label: "Opening Balances", path: "/finance/opening-balances" },
      { feature_key: "finance:import-vouchers", type: "feature", label: "Import Vouchers", path: "/finance/vouchers/import" },
      { feature_key: "finance:pdc-postings", type: "feature", label: "Post-Dated Cheques", path: "/finance/pdc-postings" },

      { feature_key: "finance:audittrailreport", type: "feature", label: " Audit Trail Report", path: "/finance/reports/audittrailreport" },
      { feature_key: "finance:balancesheetreport", type: "feature", label: " Balance Sheet Report", path: "/finance/reports/balancesheetreport" },
      { feature_key: "finance:cashflowreport", type: "feature", label: " Cash Flow Report", path: "/finance/reports/cashflowreport" },
      { feature_key: "finance:chartofaccountsreport", type: "feature", label: " Chart Of Accounts Report", path: "/finance/reports/chartofaccountsreport" },
      { feature_key: "finance:creditorsledgerreport", type: "feature", label: " Creditors Ledger Report", path: "/finance/reports/creditorsledgerreport" },
      { feature_key: "finance:customeroutstandingreport", type: "feature", label: " Customer Outstanding Report", path: "/finance/reports/customeroutstandingreport" },
      { feature_key: "finance:debtorsledgerreport", type: "feature", label: " Debtors Ledger Report", path: "/finance/reports/debtorsledgerreport" },
      { feature_key: "finance:generalledgerreport", type: "feature", label: " General Ledger Report", path: "/finance/reports/generalledgerreport" },
      { feature_key: "finance:journalreport", type: "feature", label: " Journal Report", path: "/finance/reports/journalreport" },
      { feature_key: "finance:outstandingreceivablereport", type: "feature", label: " Outstanding Receivable Report", path: "/finance/reports/outstandingreceivablereport" },
      { feature_key: "finance:paymentduereport", type: "feature", label: " Payment Due Report", path: "/finance/reports/paymentduereport" },
      { feature_key: "finance:profitandlossreport", type: "feature", label: " Profit And Loss Report", path: "/finance/reports/profitandlossreport" },
      { feature_key: "finance:profitlossocireport", type: "feature", label: " Statement of Profit or Loss and Other Comprehensive Income", path: "/finance/reports/profit-loss-oci" },
      { feature_key: "finance:ratioanalysisreport", type: "feature", label: " Ratio Analysis Report", path: "/finance/reports/ratioanalysisreport" },
      { feature_key: "finance:supplieroutstandingreport", type: "feature", label: " Supplier Outstanding Report", path: "/finance/reports/supplieroutstandingreport" },
      { feature_key: "finance:trialbalancereport", type: "feature", label: " Trial Balance Report", path: "/finance/reports/trialbalancereport" },
      { feature_key: "finance:voucherregisterreport", type: "feature", label: " Voucher Register Report", path: "/finance/reports/voucherregisterreport" },
    ],
    dashboards: [
          { feature_key: "finance:finance-cash-balance", type: "dashboard", label: "Cash Balance", path: "/finance/reports/finance-cash-balance" },
      { feature_key: "finance:finance-ar", type: "dashboard", label: "Accounts Receivable", path: "/finance/reports/finance-ar" },
      { feature_key: "finance:finance-ap", type: "dashboard", label: "Accounts Payable", path: "/finance/reports/finance-ap" },
],
  },

  // Human Resources Module: Contains features for employee management, payroll, attendance, and leave management
  "human-resources": {
    features: [
      { feature_key: "human-resources:employees", type: "feature", label: "Employee Setup", path: "/human-resources/employees" },
      { feature_key: "human-resources:departments", type: "feature", label: "Departments", path: "/human-resources/departments" },
      { feature_key: "human-resources:designations", type: "feature", label: "Designations", path: "/human-resources/designations" },
      { feature_key: "human-resources:requisitions", type: "feature", label: "Job Requisitions", path: "/human-resources/requisitions" },
      { feature_key: "human-resources:candidates", type: "feature", label: "Candidates", path: "/human-resources/candidates" },
      { feature_key: "human-resources:interviews", type: "feature", label: "Interviews", path: "/human-resources/interviews" },
      { feature_key: "human-resources:offers", type: "feature", label: "Offers", path: "/human-resources/offers" },
      { feature_key: "human-resources:attendance", type: "feature", label: "Attendance Management", path: "/human-resources/attendance" },
      { feature_key: "human-resources:work-schedules", type: "feature", label: "Work Schedule Management", path: "/human-resources/work-schedules" },
      { feature_key: "human-resources:roster", type: "feature", label: "Roster Management", path: "/human-resources/roster" },
      { feature_key: "human-resources:leave-setup", type: "feature", label: "Leave Setup", path: "/human-resources/leave-setup" },
      { feature_key: "human-resources:leave-management", type: "feature", label: "Leave Management", path: "/human-resources/leave-management" },
      { feature_key: "human-resources:payroll", type: "feature", label: "Payroll Processing", path: "/human-resources/payroll" },
      { feature_key: "human-resources:payslips", type: "feature", label: "Payslips", path: "/human-resources/payslips" },
      { feature_key: "human-resources:salary-config", type: "feature", label: "Salary Configurations", path: "/human-resources/salary-config" },
      { feature_key: "human-resources:tax-config", type: "feature", label: "Statutory Contributions", path: "/human-resources/tax-config" },
      { feature_key: "human-resources:allowances", type: "feature", label: "Allowances", path: "/human-resources/allowances" },
      { feature_key: "human-resources:loans", type: "feature", label: "Employee Loans", path: "/human-resources/loans" },
      { feature_key: "human-resources:promotions", type: "feature", label: "Promotions", path: "/human-resources/promotions" },
      { feature_key: "human-resources:medical-policies", type: "feature", label: "Medical Policies", path: "/human-resources/medical-policies" },
      { feature_key: "human-resources:policies", type: "feature", label: "Policies", path: "/human-resources/policies" },
      { feature_key: "human-resources:setup", type: "feature", label: "HR Setup", path: "/human-resources/setup" },
      { feature_key: "human-resources:hr-reports", type: "feature", label: "HR Reports", path: "/human-resources/hr-reports" },
    ],
    dashboards: [



    ],
  },

  // Maintenance Module: Contains features for asset management, equipment, and maintenance schedules
  maintenance: {
    features: [
      { feature_key: "maintenance:assets", type: "feature", label: "Asset Management", path: "/maintenance/assets" },
      { feature_key: "maintenance:equipment", type: "feature", label: "Equipment", path: "/maintenance/equipment" },
      { feature_key: "maintenance:contracts", type: "feature", label: "Maintenance Contracts", path: "/maintenance/contracts" },
      { feature_key: "maintenance:maintenance-requests", type: "feature", label: "Maintenance Requests", path: "/maintenance/maintenance-requests" },
      { feature_key: "maintenance:job-orders", type: "feature", label: "Job Orders", path: "/maintenance/job-orders" },
      { feature_key: "maintenance:pm-schedules", type: "feature", label: "PM Schedules", path: "/maintenance/pm-schedules" },
      { feature_key: "maintenance:schedules", type: "feature", label: "Maintenance Schedules", path: "/maintenance/schedules" },
      { feature_key: "maintenance:rosters", type: "feature", label: "Maintenance Rosters", path: "/maintenance/rosters" },
      { feature_key: "maintenance:maintenance-reports", type: "feature", label: "Maintenance Reports", path: "/maintenance/maintenance-reports" },
      { feature_key: "maintenance:setup", type: "feature", label: "Maintenance Setup", path: "/maintenance/setup" },
      { feature_key: "maintenance:material-receipts", type: "feature", label: "Material Receipts", path: "/maintenance/material-receipts" },
    ],
    dashboards: [
          { feature_key: "maintenance:maint-open-work-orders", type: "dashboard", label: "Open Work Orders", path: "/maintenance/reports/maint-open-work-orders" },
      { feature_key: "maintenance:maint-assets-in-maint", type: "dashboard", label: "Assets in Maintenance", path: "/maintenance/reports/maint-assets-in-maint" },
      { feature_key: "maintenance:maint-total-assets", type: "dashboard", label: "Total Assets", path: "/maintenance/reports/maint-total-assets" },
],
  },

  // Production Module: Contains features for manufacturing processes, BOMs, routings, and work orders
  production: {
    features: [
      { feature_key: "production:stock", type: "feature", label: "Production Stock Overview", path: "/production/stock" },
      { feature_key: "production:boms", type: "feature", label: "Bills of Materials", path: "/production/boms" },
      { feature_key: "production:routings", type: "feature", label: "Routing & Operations", path: "/production/routings" },
      { feature_key: "production:work-orders", type: "feature", label: "Work Orders", path: "/production/work-orders" },
      { feature_key: "production:production-planning", type: "feature", label: "Production Planning", path: "/production/production-planning" },
      { feature_key: "production:job-cards", type: "feature", label: "Job Cards", path: "/production/job-cards" },
      { feature_key: "production:warehouse-stock-report", type: "feature", label: "Production Warehouse Stock Report", path: "/production/reports/warehouse-stock" },

      { feature_key: "production:setup", type: "feature", label: "Manufacturing Setup", path: "/production/setup" },
    ],
    dashboards: [
          { feature_key: "production:prod-active-orders", type: "dashboard", label: "Active Production Orders", path: "/production/reports/prod-active-orders" },
      { feature_key: "production:prod-completed-orders", type: "dashboard", label: "Completed Orders", path: "/production/reports/prod-completed-orders" },
      { feature_key: "production:prod-yield", type: "dashboard", label: "Production Yield", path: "/production/reports/prod-yield" },
],
  },

  // Project Management Module: Contains features for project tracking, task management, and resource allocation
  "project-management": {
    features: [
      { feature_key: "project-management:projects", type: "feature", label: "Projects", path: "/project-management/projects" },
      { feature_key: "project-management:tasks", type: "feature", label: "Task Management", path: "/project-management/tasks" },
      { feature_key: "project-management:milestones", type: "feature", label: "Milestones", path: "/project-management/milestones" },
      { feature_key: "project-management:resources", type: "feature", label: "Resource Management", path: "/project-management/resources" },
      { feature_key: "project-management:timesheets", type: "feature", label: "Timesheets", path: "/project-management/timesheets" },
      { feature_key: "project-management:expenses", type: "feature", label: "Project Expenses", path: "/project-management/expenses" },
      { feature_key: "project-management:setup", type: "feature", label: "Project Setup", path: "/project-management/setup" },
      { feature_key: "project-management:material-requisitions", type: "feature", label: "Material Requisitions", path: "/project-management/material-requisitions" },
      { feature_key: "project-management:material-utilizations", type: "feature", label: "Material Utilizations", path: "/project-management/material-utilizations" },
      { feature_key: "project-management:material-receipts", type: "feature", label: "Material Receipts", path: "/project-management/material-receipts" },
      { feature_key: "project-management:project-orders", type: "feature", label: "Project Orders", path: "/project-management/project-orders" },
      { feature_key: "project-management:purchase-requisition", type: "feature", label: "Purchase Requisition", path: "/project-management/purchase-requisition" },
      { feature_key: "project-management:project-reports", type: "feature", label: "Project Reports", path: "/project-management/project-reports" },
      { feature_key: "project-management:project-status-report", type: "feature", label: "Project Status Report", path: "/project-management/reports/project-status" },
      { feature_key: "project-management:project-income-report", type: "feature", label: "Project Income Report", path: "/project-management/reports/project-income" },
      { feature_key: "project-management:project-expense-report", type: "feature", label: "Project Expense Report", path: "/project-management/reports/project-expense" },
    ],
    dashboards: [


    ],
  },

  // Point of Sale (POS) Module: Contains features for retail operations, cash collection, and day management
  pos: {
    features: [
      { feature_key: "pos:sales-entry", type: "feature", label: "Sales Entry", path: "/pos/sales-entry" },
      { feature_key: "pos:day-management", type: "feature", label: "Start/End Business Day", path: "/pos/day-management" },
      { feature_key: "pos:cash-collection", type: "feature", label: "Cash Collection", path: "/pos/cash-collection" },
      { feature_key: "pos:invoices", type: "feature", label: "POS Invoices", path: "/pos/invoices" },
      { feature_key: "pos:post-to-finance", type: "feature", label: "Post to Finance", path: "/pos/post-to-finance" },
      { feature_key: "pos:returns", type: "feature", label: "POS Returns", path: "/pos/returns" },
      { feature_key: "pos:register", type: "feature", label: "POS Register", path: "/pos/register" },


      { feature_key: "pos:customer-history", type: "feature", label: "Customer Accounts", path: "/pos/customer-history" },
      { feature_key: "pos:on-hold", type: "feature", label: "On-Hold Sales", path: "/pos/holds" },
      { feature_key: "pos:reconciliation", type: "feature", label: "Sync Reconciliation", path: "/pos/reconciliation" },
      { feature_key: "pos:setup", type: "feature", label: "POS Setup", path: "/pos/setup" },
    ],
    dashboards: [
          { feature_key: "pos:pos-today-sales", type: "dashboard", label: "Today Sales", path: "/pos/reports/pos-today-sales" },
      { feature_key: "pos:pos-total-transactions", type: "dashboard", label: "Total Transactions", path: "/pos/reports/pos-total-transactions" },
      { feature_key: "pos:pos-avg-order", type: "dashboard", label: "Average Order Value", path: "/pos/reports/pos-avg-order" },
],
  },

  // Business Intelligence Module: Contains features for ETL, custom reports, dashboards, and analytics
  "business-intelligence": {
    features: [
      { feature_key: "business-intelligence:executive-dashboard", type: "feature", label: "Executive Dashboard", path: "/business-intelligence/executive-dashboard" },
      { feature_key: "business-intelligence:data-sources", type: "feature", label: "Data Sources & Ingestion", path: "/business-intelligence/data-sources" },
      { feature_key: "business-intelligence:datasets", type: "feature", label: "Analytical Datasets", path: "/business-intelligence/datasets" },
      { feature_key: "business-intelligence:data-prep", type: "feature", label: "Data Preparation Studio", path: "/business-intelligence/data-prep" },
      { feature_key: "business-intelligence:data-models", type: "feature", label: "Data Models & Star Schema", path: "/business-intelligence/data-models" },
      { feature_key: "business-intelligence:etl-pipelines", type: "feature", label: "ETL Pipelines Manager", path: "/business-intelligence/etl-pipelines" },
      { feature_key: "business-intelligence:data-quality", type: "feature", label: "Data Quality & Quarantine", path: "/business-intelligence/data-quality" },
      { feature_key: "business-intelligence:multidimensional", type: "feature", label: "Multidimensional Slicing", path: "/business-intelligence/multidimensional" },
      { feature_key: "business-intelligence:insights", type: "feature", label: "Automated Exceptions", path: "/business-intelligence/insights" },
      { feature_key: "business-intelligence:dashboard-builder", type: "feature", label: "Dashboard Builder", path: "/business-intelligence/dashboard-builder" },
      { feature_key: "business-intelligence:dashboards", type: "feature", label: "Custom Dashboards", path: "/business-intelligence/dashboards" },
      { feature_key: "business-intelligence:financial", type: "feature", label: "Financial Analytics", path: "/business-intelligence/financial" },
      { feature_key: "business-intelligence:inventory", type: "feature", label: "Inventory Analytics", path: "/business-intelligence/inventory" },
      { feature_key: "business-intelligence:purchase", type: "feature", label: "Purchase Analytics", path: "/business-intelligence/purchase" },
      { feature_key: "business-intelligence:hr", type: "feature", label: "HR Analytics", path: "/business-intelligence/hr" },
      { feature_key: "business-intelligence:maintenance", type: "feature", label: "Maintenance Analytics", path: "/business-intelligence/maintenance" },
      { feature_key: "business-intelligence:production", type: "feature", label: "Production Analytics", path: "/business-intelligence/production" },
      { feature_key: "business-intelligence:projects", type: "feature", label: "Project Analytics", path: "/business-intelligence/projects" },
      { feature_key: "business-intelligence:transport", type: "feature", label: "Transport Analytics", path: "/business-intelligence/transport" },
      { feature_key: "business-intelligence:service", type: "feature", label: "Service Analytics", path: "/business-intelligence/service" },
      { feature_key: "business-intelligence:pos", type: "feature", label: "POS Analytics", path: "/business-intelligence/pos" },
      { feature_key: "business-intelligence:administration", type: "feature", label: "Administration Analytics", path: "/business-intelligence/administration" },
      { feature_key: "business-intelligence:cross-module", type: "feature", label: "Cross Module Analytics", path: "/business-intelligence/cross-module" },
      { feature_key: "business-intelligence:kpi-center", type: "feature", label: "KPI Center", path: "/business-intelligence/kpi-center" },
      { feature_key: "business-intelligence:data-explorer", type: "feature", label: "Data Explorer", path: "/business-intelligence/data-explorer" },
      { feature_key: "business-intelligence:ai-insights", type: "feature", label: "AI Insights", path: "/business-intelligence/ai-insights" },
      { feature_key: "business-intelligence:banks-ai", type: "feature", label: "Ask Banks AI", path: "/business-intelligence/banks-ai" },
      { feature_key: "business-intelligence:alerts", type: "feature", label: "Alerts Center", path: "/business-intelligence/alerts" },
      { feature_key: "business-intelligence:report-center", type: "feature", label: "Report Center", path: "/business-intelligence/report-center" },
      { feature_key: "business-intelligence:settings", type: "feature", label: "BI Settings", path: "/business-intelligence/settings" },
    ],
    dashboards: [
      { feature_key: "business-intelligence:bi-executive-summary", type: "dashboard", label: "Executive Summary Dashboard", path: "/business-intelligence/executive-dashboard" },
      { feature_key: "business-intelligence:bi-revenue-performance", type: "dashboard", label: "Revenue & Sales Performance", path: "/business-intelligence/multidimensional" },
      { feature_key: "business-intelligence:bi-procurement-spend", type: "dashboard", label: "Procurement & Spend Dashboard", path: "/business-intelligence/purchase" },
      { feature_key: "business-intelligence:bi-inventory-valuation", type: "dashboard", label: "Inventory Valuation & Stock", path: "/business-intelligence/inventory" },
      { feature_key: "business-intelligence:bi-manufacturing-yield", type: "dashboard", label: "Manufacturing Yield & Scrap", path: "/business-intelligence/production" },
      { feature_key: "business-intelligence:bi-financial-gl", type: "dashboard", label: "General Ledger Financials", path: "/business-intelligence/financial" }
    ],
  },

  // Executive Overview Module: Contains features for high-level KPIs and executive dashboards
  "executive-overview": {
    features: [
      { feature_key: "executive-overview:kpi-reports", type: "feature", label: "KPI Reports", path: "/executive-overview/kpi-reports" },
    ],
    dashboards: [
    ],
  },

  // Service Management Module: Contains features for customer/supplier service requests and service orders
  "service-management": {
    features: [
      { feature_key: "service-management:customer-service-requests", type: "feature", label: "Customer Service Requests", path: "/service-management/customer-service-requests" },
      { feature_key: "service-management:supplier-service-requests", type: "feature", label: "Supplier Service Requests", path: "/service-management/supplier-service-requests" },
      { feature_key: "service-management:service-requests", type: "feature", label: "Service Requests", path: "/service-management/service-requests" },
      { feature_key: "service-management:service-orders", type: "feature", label: "Service Orders", path: "/service-management/service-orders" },
      { feature_key: "service-management:service-executions", type: "feature", label: "Service Execution", path: "/service-management/service-executions" },
      { feature_key: "service-management:service-confirmations", type: "feature", label: "Service Confirmations", path: "/service-management/service-confirmations" },
      { feature_key: "service-management:service-bills", type: "feature", label: "Service Bills", path: "/service-management/service-bills" },
      { feature_key: "service-management:service-invoices", type: "feature", label: "Service Invoices", path: "/service-management/service-invoices" },
      { feature_key: "service-management:billing", type: "feature", label: "Service Billing", path: "/service-management/billing" },
      { feature_key: "service-management:service-reports", type: "feature", label: "Service Reports", path: "/service-management/service-reports" },
      { feature_key: "service-management:visitors-log", type: "feature", label: "Visitors Log Book", path: "/service-management/visitors-log" },
      { feature_key: "service-management:setup", type: "feature", label: "Service Setup", path: "/service-management/setup" },
    ],
    dashboards: [


    ],
  },
  
  // Transport Module
  transport: {
    features: [
      { feature_key: "transport:requests", type: "feature", label: "Transport Requests", path: "/transport/requests" },
      { feature_key: "transport:trips", type: "feature", label: "Trips & Dispatch", path: "/transport/trips" },
      { feature_key: "transport:fuel", type: "feature", label: "Refuelling", path: "/transport/fuel" },
      { feature_key: "transport:bills", type: "feature", label: "Transportation Bills", path: "/transport/transportation-bills" },
      { feature_key: "transport:billing", type: "feature", label: "Billing", path: "/transport/billing" },
      { feature_key: "transport:income", type: "feature", label: "Transportation Income", path: "/transport/income" },
      { feature_key: "transport:expenses", type: "feature", label: "Transportation Expenses", path: "/transport/expenses" },
      { feature_key: "transport:routes", type: "feature", label: "Routes", path: "/transport/routes" },
      { feature_key: "transport:inspections", type: "feature", label: "Inspections", path: "/transport/inspections" },
      { feature_key: "transport:maintenance", type: "feature", label: "Maintenance Requests", path: "/transport/maintenance" },
      { feature_key: "transport:settings", type: "feature", label: "Transport Settings", path: "/transport/settings" },
      { feature_key: "transport:reports", type: "feature", label: "Reports & Analytics", path: "/transport/reports" }
    ],
    dashboards: [
          { feature_key: "transport:trans-active-vehicles", type: "dashboard", label: "Active Vehicles", path: "/transport/reports/trans-active-vehicles" },
      { feature_key: "transport:trans-ongoing-trips", type: "dashboard", label: "Ongoing Trips", path: "/transport/reports/trans-ongoing-trips" },
      { feature_key: "transport:trans-pending-maint", type: "dashboard", label: "Pending Fleet Maintenance", path: "/transport/reports/trans-pending-maint" },
],
  },
};

/**
 * Utility function to extract a flat list of all normal features across all modules.
 * Used for flattening the registry to assign permissions or list available features.
 * 
 * @returns {Array} A flat array of feature objects, each tagged with its parent module_key
 */
export function getAllFeatures() {
  const features = []; // Array to collect all flattened features
  
  // Iterate over each module in the registry
  Object.entries(FEATURES_REGISTRY).forEach(([moduleKey, moduleData]) => {
    // Check if the module has a features array, defaulting to empty array if missing
    (moduleData.features || []).forEach(feature => {
      // Map and push the feature data, injecting the parent module_key
      features.push({
        module_key: moduleKey,
        feature_key: feature.feature_key,
        type: feature.type,
        label: feature.label,
        path: feature.path,
      });
    });
  });
  
  return features;
}

/**
 * Utility function to extract a flat list of all dashboard features across all modules.
 * Used similarly to getAllFeatures but strictly for dashboard-type elements.
 * 
 * @returns {Array} A flat array of dashboard objects, each tagged with its parent module_key
 */
export function getAllDashboardFeatures() {
  const dashboards = []; // Array to collect all flattened dashboards
  
  // Iterate over each module in the registry
  Object.entries(FEATURES_REGISTRY).forEach(([moduleKey, moduleData]) => {
    // Check if the module has a dashboards array, defaulting to empty array if missing
    (moduleData.dashboards || []).forEach(d => {
      // Map and push the dashboard data, injecting the parent module_key
      dashboards.push({
        module_key: moduleKey,
        feature_key: d.feature_key,
        type: d.type,
        label: d.label,
        path: d.path,
      });
    });
  });
  
  return dashboards;
}
