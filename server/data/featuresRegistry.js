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

      // Procurement (Direct Purchases)
      { feature_key: "pos:customers", type: "feature", label: "Customers", path: "/pos/customers" },
      { feature_key: "pos:direct-purchase", type: "feature", label: "Direct Purchases", path: "/pos/direct-purchases" },
      { feature_key: "pos:suppliers", type: "feature", label: "Suppliers", path: "/pos/suppliers" },

      // Store Inventory Operations
      { feature_key: "pos:items", type: "feature", label: "Items Master", path: "/pos/items" },
      { feature_key: "pos:item-groups", type: "feature", label: "Item Classification", path: "/pos/item-groups" },
      { feature_key: "pos:stock-balances", type: "feature", label: "Stock Balances", path: "/pos/stock-balances" },
      { feature_key: "pos:stock-transfers", type: "feature", label: "Stock Transfers", path: "/pos/stock-transfers" },
      { feature_key: "pos:transfer-acceptance", type: "feature", label: "Transfer Acceptance", path: "/pos/transfer-acceptance" },
      { feature_key: "pos:daily-stock-take", type: "feature", label: "Daily Stock Take", path: "/pos/daily-stock-take" },
      { feature_key: "pos:stock-adjustments", type: "feature", label: "Stock Adjustments", path: "/pos/stock-adjustments" },
      { feature_key: "pos:stock-reorder", type: "feature", label: "Stock Reorder", path: "/pos/stock-reorder" },
      { feature_key: "pos:batches", type: "feature", label: "Item Batches", path: "/pos/batches" },

      // Finance & Cash Desk
      { feature_key: "pos:payment-voucher", type: "feature", label: "Store Expenses (Payment Voucher)", path: "/pos/payment-voucher" },
      { feature_key: "pos:receipt-voucher", type: "feature", label: "Customer Payments (Receipt Voucher)", path: "/pos/receipt-voucher" },
      { feature_key: "pos:contra-voucher", type: "feature", label: "Bank Deposit (Contra Voucher)", path: "/pos/contra-voucher" },

      // Reports (Purchase, Finance, Inventory)
      { feature_key: "pos:purchaseregisterreport", type: "feature", label: "Purchase Register Report", path: "/pos/reports/purchase-register" },
      { feature_key: "pos:itempurchasehistoryreport", type: "feature", label: "Item Purchase History Report", path: "/pos/reports/item-purchase-history" },
      { feature_key: "pos:supplieroutstandingreport", type: "feature", label: "Supplier Outstanding Report", path: "/pos/reports/supplier-outstanding" },
      { feature_key: "pos:purchasereturnsanalysisreport", type: "feature", label: "Purchase Returns Analysis Report", path: "/pos/reports/purchase-returns-analysis" },
      { feature_key: "pos:customeroutstandingreport", type: "feature", label: "Customer Outstanding Report", path: "/pos/reports/customer-outstanding" },
      { feature_key: "pos:debtorsledgerreport", type: "feature", label: "Debtors Ledger Report", path: "/pos/reports/debtors-ledger" },
      { feature_key: "pos:cashflowreport", type: "feature", label: "Cash Flow Report", path: "/pos/reports/cash-flow" },
      { feature_key: "pos:voucherregisterreport", type: "feature", label: "Voucher Register Report", path: "/pos/reports/voucher-register" },
      { feature_key: "pos:outstandingreceivablereport", type: "feature", label: "Outstanding Receivables Report", path: "/pos/reports/outstanding-receivables" },
      { feature_key: "pos:paymentduereport", type: "feature", label: "Payment Due Report", path: "/pos/reports/payment-due" },
      { feature_key: "pos:stockbalancesreport", type: "feature", label: "Stock Balances Report", path: "/pos/reports/stock-balances" },
      { feature_key: "pos:fastmovingreport", type: "feature", label: "Fast Moving Report", path: "/pos/reports/fast-moving" },
      { feature_key: "pos:slowmovingreport", type: "feature", label: "Slow Moving Report", path: "/pos/reports/slow-moving" },
      { feature_key: "pos:expireditemsreport", type: "feature", label: "Expired Items Report", path: "/pos/reports/expired-items" },
      { feature_key: "pos:stockadjustmentsreport", type: "feature", label: "Stock Adjustments Report", path: "/pos/reports/stock-adjustments" },
      { feature_key: "pos:stocktransferreport", type: "feature", label: "Stock Transfer Register Report", path: "/pos/reports/stock-transfer-register" },
      { feature_key: "pos:inventoryhealthmonitorreport", type: "feature", label: "Inventory Health Monitor", path: "/pos/reports/health-monitor" },
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
