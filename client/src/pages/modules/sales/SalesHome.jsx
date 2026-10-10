/**
 * @fileoverview SalesHome module routing and dashboard landing page.
 * Acts as the entry point for all sales-related features and analytics.
 */

import React from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import { usePermission } from "../../../auth/PermissionContext";
import ModuleDashboard from "../../../components/ModuleDashboard";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import { api } from "../../../api/client.js";

// Import list pages
import QuotationList from "./quotations/QuotationList.jsx";
import QuotationForm from "./quotations/QuotationForm.jsx";
import SalesOrderList from "./sales-orders/SalesOrderList.jsx";
import SalesOrderForm from "./sales-orders/SalesOrderForm.jsx";
import InvoiceList from "./invoices/InvoiceList.jsx";
import InvoiceForm from "./invoices/InvoiceForm.jsx";
import DeliveryList from "./delivery/DeliveryList.jsx";
import DeliveryForm from "./delivery/DeliveryForm.jsx";
import PriceSetup from "./price-setup/PriceSetup.jsx";
import CampaignHub from "./discount-schemes/CampaignHub.jsx";
import DiscountSchemeList from "./discount-schemes/DiscountSchemeList.jsx";
import CampaignForm from "./discount-schemes/CampaignForm.jsx";
import PurchaseRewardCampaignList from "./discount-schemes/PurchaseRewardCampaignList.jsx";
import PurchaseRewardCampaignForm from "./discount-schemes/PurchaseRewardCampaignForm.jsx";
import CustomerCreditList from "./customer-credit/CustomerCreditList.jsx";
import CustomerCreditForm from "./customer-credit/CustomerCreditForm.jsx";
import CustomerList from "./customers/CustomerList.jsx";
import CustomerForm from "./customers/CustomerForm.jsx";
import PotentialCustomerList from "./potential-customers/PotentialCustomerList.jsx";
import PotentialCustomerForm from "./potential-customers/PotentialCustomerForm.jsx";
import ProspectConversion from "./potential-customers/ProspectConversion.jsx";
import BulkCustomerUpload from "./bulk-upload/BulkCustomerUpload.jsx";
import SalesReturnList from "./returns/SalesReturnList.jsx";
import SalesReturnForm from "./returns/SalesReturnForm.jsx";
import SalesSetupPage from "./setup/SalesSetupPage.jsx";
import SalesReturnReportPage from "./reports/SalesReturnReportPage.jsx";
import SalesRegisterReportPage from "./reports/SalesRegisterReportPage.jsx";
import DeliveryRegisterReportPage from "./reports/DeliveryRegisterReportPage.jsx";
import DebtorsBalanceReportPage from "./reports/DebtorsBalanceReportPage.jsx";
import SalesProfitabilityReportPage from "./reports/SalesProfitabilityReportPage.jsx";
import SalesTrackingReportPage from "./reports/SalesTrackingReportPage.jsx";
import SalesUploadPage from "./SalesUploadPage.jsx";

/**
 * ActionButton component
 * Renders a standardized link button for module actions.
 * Checks permissions before rendering the button.
 * 
 * @param {Object} props
 * @param {string} props.label - Button text.
 * @param {string} props.path - Navigation target path.
 * @param {string} props.type - Button style type ("primary" or "outline").
 * @param {string} props.featureKey - RBAC feature key for permission check.
 * @param {string} props.action - Specific action required (e.g., "view", "create").
 * @returns {JSX.Element|null} The button element or null if unauthorized.
 */
const ActionButton = ({ label, path, type, featureKey, action }) => {
  const { canPerformAction } = usePermission();
  const hasPermission = canPerformAction(featureKey, action);

  if (!hasPermission) return null;

  const baseClasses =
    type === "primary" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm";

  return (
    <Link to={path} className={baseClasses}>
      {label}
    </Link>
  );
};

export const salesFeatures = [
  {
    module_key: "sales",
    label: "Quotations",
    path: "/sales/quotations",
    actions: [
      { label: "View", path: "/sales/quotations", type: "outline" },
      { label: "New", path: "/sales/quotations/new", type: "primary" }
    ],
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Sales Orders",
    path: "/sales/sales-orders",
        actions: [
          { label: "View", path: "/sales/sales-orders", type: "outline" },
          { label: "New", path: "/sales/sales-orders/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Invoices",
    path: "/sales/invoices",
        actions: [
          { label: "View", path: "/sales/invoices", type: "outline" },
          { label: "New", path: "/sales/invoices/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Delivery Notes",
    path: "/sales/delivery",
        actions: [
          { label: "View", path: "/sales/delivery", type: "outline" },
          { label: "New", path: "/sales/delivery/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Price Setup",
    path: "/sales/price-setup",
        actions: [
          { label: "View", path: "/sales/price-setup", type: "outline" }
        ],
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Promotional Campaigns",
    path: "/sales/discount-schemes",
        actions: [
          { label: "View", path: "/sales/discount-schemes", type: "outline" },
          { label: "New", path: "/sales/discount-schemes/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Sales Setup",
    path: "/sales/setup",
        actions: [
          { label: "View", path: "/sales/setup", type: "outline" }
        ],
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Customer Setup",
    path: "/sales/customers",
        actions: [
          { label: "View", path: "/sales/customers", type: "outline" },
          { label: "New", path: "/sales/customers/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "sales",
    label: "Sales Register",
    path: "/sales/reports/sales-register",
        actions: [
          { label: "View", path: "/sales/reports/sales-register", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Delivery Register",
    path: "/sales/reports/delivery-register",
        actions: [
          { label: "View", path: "/sales/reports/delivery-register", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Sales Return Report",
    path: "/sales/reports/sales-return",
        actions: [
          { label: "View", path: "/sales/reports/sales-return", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Debtors Balance",
    path: "/sales/reports/debtors-balance",
        actions: [
          { label: "View", path: "/sales/reports/debtors-balance", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Sales Profitability",
    path: "/sales/reports/sales-profitability",
        actions: [
          { label: "View", path: "/sales/reports/sales-profitability", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Sales Tracking",
    path: "/sales/reports/sales-tracking",
        actions: [
          { label: "View", path: "/sales/reports/sales-tracking", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "sales",
    label: "Sales Returns",
    path: "/sales/returns",
        actions: [
          { label: "View", path: "/sales/returns", type: "outline" },
          { label: "New", path: "/sales/returns/new", type: "primary" }
        ],
    type: "feature",
  },
];

/**
        ],
    type: "feature",
  },
];

/**
 * SalesModuleHome component
 * Displays the main sales dashboard, including key statistics and module navigation sections.
 * 
 * @returns {JSX.Element} The sales module landing view.
 */
const SalesModuleHome = () => {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "sales-this-month",
      icon: "🟢",
      value: "GH₵0.00",
      label: "Total Sales This Month",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/invoice-summary",
      actions: [{ label: "View", path: "/sales/reports/invoice-summary", type: "outline" }],
    },
    {
      rbac_key: "average-sales-this-month",
      icon: "📊",
      value: "GH₵0.00",
      label: "Average Sales This Month",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/invoice-summary",
      actions: [{ label: "View", path: "/sales/reports/invoice-summary", type: "outline" }],
    },
    {
      rbac_key: "open-quotations",
      icon: "🔵",
      value: "0",
      label: "Open Quotations",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/quotation-summary",
      actions: [{ label: "View", path: "/sales/reports/quotation-summary", type: "outline" }],
    },
    {
      rbac_key: "pending-deliveries",
      icon: "🟠",
      value: "0",
      label: "Pending Deliveries",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/delivery-register",
      actions: [{ label: "View", path: "/sales/reports/delivery-register", type: "outline" }],
    },
    {
      rbac_key: "overdue-invoices",
      icon: "🔴",
      value: "0",
      label: "Overdue Invoices",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/ar-aging",
      actions: [{ label: "View", path: "/sales/reports/ar-aging", type: "outline" }],
    },
    {
      rbac_key: "total-revenue",
      icon: "💰",
      value: "GH₵0.00",
      label: "Total Revenue",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/invoice-summary",
      actions: [{ label: "View", path: "/sales/reports/invoice-summary", type: "outline" }],
    },
    {
      rbac_key: "sales-growth",
      icon: "📈",
      value: "0%",
      label: "Sales Growth %",
      change: "",
      changeType: "neutral",
      path: "/sales/reports/monthly-sales-trend",
      actions: [{ label: "View", path: "/sales/reports/monthly-sales-trend", type: "outline" }],
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await api.get("/sales/dashboard-stats");
        const data = res?.data?.data || res?.data || {};
        if (mounted) {
          const totalThisMonth = Number(data.salesThisMonth || 0);
          const avgSalesThisMonth = Number(data.avgSalesThisMonth || 0);
          const openQuotes = Number(data.openQuotations || 0);
          const pendingDelivs = Number(data.pendingDeliveries || 0);
          const overdueInvs = Number(data.overdueInvoices || 0);
          const totalRev = Number(data.totalRevenue || 0);
          const growth = String(data.salesGrowth || "0%");

          setStats((prev) => {
            return prev.map((s) => {
              if (s.rbac_key === "sales-this-month") {
                return {
                  ...s,
                  value: `GH₵${totalThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                };
              }
              if (s.rbac_key === "average-sales-this-month" || s.rbac_key === "sales-avg-sales-this-month") {
                return {
                  ...s,
                  value: `GH₵${avgSalesThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                };
              }
              if (s.rbac_key === "open-quotations") return { ...s, value: String(openQuotes) };
              if (s.rbac_key === "pending-deliveries") return { ...s, value: String(pendingDelivs) };
              if (s.rbac_key === "overdue-invoices") return { ...s, value: String(overdueInvs) };
              if (s.rbac_key === "total-revenue") {
                return {
                  ...s,
                  value: `GH₵${totalRev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                };
              }
              if (s.rbac_key === "sales-growth") return { ...s, value: growth };
              return s;
            });
          });
        }
      } catch (err) {
        console.error("Failed loading sales dashboard stats:", err);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ModuleDashboard
      moduleKey="sales"
      useSectionNavigation={true}
      title="Sales Module"
      description="Customer orders, quotations, invoicing, and sales analytics"
      stats={stats}
      headerActions={[
        { label: "Dashboard", path: "/sales/dashboard", icon: "📊" },
      ]}
      sections={salesModuleSections}
      features={salesFeatures}
    />
  );
};

export const salesModuleSections = [
  {
    icon: "💳",
    title: "Sales Transactions",
    badge: "Operations",
    items: [
      {
        title: "Quotations",
        path: "/sales/quotations",
        feature_key: "quotations",
        description: "Create and manage customer quotations",
        icon: "📋",
        actions: [
          <ActionButton
            key="view"
            label="View"
            path="/sales/quotations"
            type="outline"
            featureKey="sales:quotations"
            action="view"
          />,
          <ActionButton
            key="new"
            label="New"
            path="/sales/quotations/new"
            type="primary"
            featureKey="sales:quotations"
            action="create"
          />,
        ],
      },
      {
        title: "Sales Orders",
        path: "/sales/sales-orders",
        feature_key: "sales-orders",
          description: "Process customer orders and track fulfillment",
          icon: "🛒",
          actions: [
            <ActionButton
              key="view"
              label="View"
              path="/sales/sales-orders"
              type="outline"
              featureKey="sales:sales-orders"
              action="view"
            />,
            <ActionButton
              key="new"
              label="New"
              path="/sales/sales-orders/new"
              type="primary"
              featureKey="sales:sales-orders"
              action="create"
            />,
          ],
        },
        {
          title: "Invoices",
          path: "/sales/invoices",
        
          feature_key: "invoices",
          description: "Generate and manage sales invoices",
          icon: "🧾",
          actions: [
            <ActionButton
              key="view"
              label="View"
              path="/sales/invoices"
              type="outline"
              featureKey="sales:invoices"
              action="view"
            />,
            <ActionButton
              key="new"
              label="New"
              path="/sales/invoices/new"
              type="primary"
              featureKey="sales:invoices"
              action="create"
            />,
          ],
        },
        {
          title: "Sales Upload",
          path: "/sales/sales-upload",
          feature_key: "sales-upload",
          description: "Download template and bulk upload sales invoices into the system",
          icon: "📥",
          actions: [
            <ActionButton
              key="view"
              label="View"
              path="/sales/sales-upload"
              type="outline"
              featureKey="sales:sales-upload"
              action="view"
            />,
            <ActionButton
              key="upload"
              label="Upload"
              path="/sales/sales-upload"
              type="primary"
              featureKey="sales:sales-upload"
              action="create"
            />,
          ],
        },
        {
          title: "Sales Returns",
          path: "/sales/returns",
          icon: "🔙",
          actions: [
            <ActionButton
              key="view"
              label="View"
              path="/sales/returns"
              type="outline"
              featureKey="sales:returns"
              action="view"
            />,
            <ActionButton
              key="new"
              label="New"
              path="/sales/returns/new"
              type="primary"
              featureKey="sales:returns"
              action="create"
            />,
          ],
        },
        {
          title: "Delivery Notes",
          path: "/sales/delivery",
        
          feature_key: "delivery",
          description: "Track product deliveries to customers",
          icon: "🚚",
          actions: [
            <ActionButton
              key="view"
              label="View"
              path="/sales/delivery"
              type="outline"
              featureKey="sales:delivery"
              action="view"
            />,
            <ActionButton
              key="new"
              label="New"
              path="/sales/delivery/new"
              type="primary"
              featureKey="sales:delivery"
              action="create"
            />,
          ],
        },
      ],
    },
    {
      title: "Pricing & Discounts",
      badge: "Configuration",
      items: [
        {
          title: "Price Setup",
          path: "/sales/price-setup",
          description: "Manage standard and customer pricing",
          icon: "💰",
          actions: [
            { label: "View", path: "/sales/price-setup", type: "outline" }
          ],
        },
        {
          title: "Promotional Campaigns",
          path: "/sales/discount-schemes",
          description: "Discount campaigns, purchase reward schemes, and promotions",
          icon: "🏷️",
          actions: [
            { label: "View", path: "/sales/discount-schemes", type: "outline" },
            { label: "New", path: "/sales/discount-schemes/discount/new", type: "primary" }
          ],
        },
        {
          title: "Sales Setup",
          path: "/sales/setup",
          description: "Configure sales return reasons and return workflows",
          icon: "⚙️",
          actions: [
            { label: "View", path: "/sales/setup", type: "outline" }
          ],
        },
      ],
    },
    {
      title: "Customer Management",
      items: [
        {
          title: "Customers",
          path: "/sales/customers",
        
          feature_key: "customers",
          description: "Manage customer information and credit limits",
          icon: "👥",
          actions: [
            <ActionButton
              key="view"
              label="View"
              path="/sales/customers"
              type="outline"
              featureKey="sales:customers"
              action="view"
            />,
            <ActionButton
              key="add"
              label="Add"
              path="/sales/customers/new"
              type="primary"
              featureKey="sales:customers"
              action="create"
            />,
          ],
        },
        {
          title: "Prospective Customers",
          path: "/sales/prospect-customers",
        
          feature_key: "prospect-customers",
          description: "Manage prospective customer (leads) information",
          icon: "🔮",
          actions: [
            <ActionButton
              key="view"
              label="View"
              path="/sales/prospect-customers"
              type="outline"
              featureKey="sales:prospect-customers"
              action="view"
            />,
            <ActionButton
              key="add"
              label="Add"
              path="/sales/prospect-customers/new"
              type="primary"
              featureKey="sales:prospect-customers"
              action="create"
            />,
          ],
        },
        {
          title: "Prospect Conversion",
          path: "/sales/prospect-conversion",
        
          feature_key: "prospect-conversion",
          description:
            "Convert prospective customers into full customer accounts",
          icon: "🔄",
          actions: [
            <ActionButton
              key="convert"
              label="Convert"
              path="/sales/prospect-conversion"
              type="primary"
              featureKey="sales:customers"
              action="create"
            />,
          ],
        },
      ],
    },
    {
      title: "Analytics & Reports",
      items: [
        {
          title: "Sales Register",
          path: "/sales/reports/sales-register",
        
          description: "Invoices within the selected period",
          icon: "🧾",
        },
        {
          title: "Delivery Register",
          path: "/sales/reports/delivery-register",
        
          description: "Deliveries made to customers",
          icon: "🚚",
        },
        {
          title: "Sales Return Report",
          path: "/sales/reports/sales-return",
        
          description: "Items returned by customers",
          icon: "↩️",
        },
        {
          title: "Debtors Balance",
          path: "/sales/reports/debtors-balance",
        
          description: "Customer balances and outstanding",
          icon: "👤",
        },
        {
          title: "Sales Profitability",
          path: "/sales/reports/sales-profitability",
        
          description: "Margins and profitability by invoice",
          icon: "💹",
        },
        {
          title: "Sales Tracking",
          path: "/sales/reports/sales-tracking",
        
          description: "Track quotations → orders → deliveries → invoices",
          icon: "🔎",
        },
        {
          title: "Customer List",
          path: "/sales/reports/customer-list",
        
          description: "Export all active customers to Excel",
          icon: "👥",
        },
        {
          title: "Prospective Customer List",
          path: "/sales/reports/prospect-customer-list",
        
          description: "Export all prospective customers to Excel",
          icon: "🔮",
        },
        {
          title: "Quotation Summary",
          path: "/sales/reports/quotation-summary",
        
          description: "Track quotes",
          icon: "📋",
        },
        {
          title: "Quotation Conversion",
          path: "/sales/reports/quotation-conversion",
        
          description: "Sales effectiveness",
          icon: "✅",
        },
        {
          title: "Sales Order Status",
          path: "/sales/reports/sales-order-status",
        
          description: "Monitor active orders",
          icon: "📦",
        },
        {
          title: "Invoice Summary",
          path: "/sales/reports/invoice-summary",
        
          description: "Revenue tracking",
          icon: "🧾",
        },
        {
          title: "A/R Aging",
          path: "/sales/reports/ar-aging",
        
          description: "Overdue payments",
          icon: "⏱️",
        },
        {
          title: "Revenue by Customer",
          path: "/sales/reports/revenue-by-customer",
        
          description: "Top customers",
          icon: "👥",
        },
        {
          title: "Revenue by Product",
          path: "/sales/reports/revenue-by-product",
        
          description: "Best sellers",
          icon: "📦",
        },
        {
          title: "Discount Utilization",
          path: "/sales/reports/discount-utilization",
        
          description: "Discount control",
          icon: "🏷️",
        },
        {
          title: "Price List",
          path: "/sales/reports/price-list",
        
          description: "Monitor pricing",
          icon: "💰",
        },
        {
          title: "Monthly Sales Trend",
          path: "/sales/reports/monthly-sales-trend",
        
          description: "Executive overview",
          icon: "📈",
        },
        {
          title: "Customer Order History",
          path: "/sales/reports/customer-order-history",
        
        
          description: "Per-customer timeline",
          icon: "🗂️",
        },
        {
          title: "Customer Accounts",
          path: "/sales/reports/customer-history",
        
          description: "Complete customer transaction history including returns",
          icon: "📋",
        },
        {
          title: "Cancelled / Rejected Orders",
          path: "/sales/reports/cancelled-orders",
          description: "Identify revenue loss",
          icon: "🛑",
        },
      ],
    },
  ];

/**
 * SalesHome component
 * Root router for the Sales module. Maps URL paths to specific sales components.
 * 
 * @returns {JSX.Element} The nested routes for the sales module.
 */
export default function SalesHome() {
  return (
    <ModuleLayout sections={salesModuleSections} moduleKey="sales">
      <Routes>
        <Route path="/" element={<SalesModuleHome />} />
        <Route
          path="/dashboard"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(() => import("./SalesDashboardPage.jsx")),
              )}
            </React.Suspense>
          }
        />
        <Route path="/quotations" element={<QuotationList />} />
        <Route path="/quotations/new" element={<QuotationForm />} />
        <Route path="/quotations/:id" element={<QuotationForm />} />
        <Route path="/sales-orders" element={<SalesOrderList />} />
        <Route path="/sales-orders/new" element={<SalesOrderForm />} />
        <Route path="/sales-orders/:id" element={<SalesOrderForm />} />
        <Route path="/invoices" element={<InvoiceList />} />
        <Route path="/invoices/new" element={<InvoiceForm />} />
        <Route path="/invoices/:id" element={<InvoiceForm />} />
        <Route path="/sales-upload" element={<SalesUploadPage />} />
        <Route path="sales-upload" element={<SalesUploadPage />} />
        <Route path="/delivery" element={<DeliveryList />} />
        <Route path="/delivery/new" element={<DeliveryForm />} />
        <Route path="/delivery/:id" element={<DeliveryForm />} />
        <Route path="/price-setup" element={<PriceSetup />} />
        <Route path="/discount-schemes" element={<CampaignHub />} />
        <Route path="/discount-schemes/list" element={<DiscountSchemeList />} />
        <Route path="/discount-schemes/discount" element={<DiscountSchemeList />} />
        <Route path="/discount-schemes/discount/new" element={<CampaignForm />} />
        <Route path="/discount-schemes/discount/edit/:id" element={<CampaignForm />} />
        <Route path="/discount-schemes/discount/:id" element={<CampaignForm />} />
        <Route path="/discount-schemes/new" element={<CampaignForm />} />
        <Route path="/discount-schemes/edit/:id" element={<CampaignForm />} />
        <Route path="/discount-schemes/purchase-reward" element={<PurchaseRewardCampaignList />} />
        <Route path="/discount-schemes/purchase-reward/new" element={<PurchaseRewardCampaignForm />} />
        <Route path="/discount-schemes/purchase-reward/edit/:id" element={<PurchaseRewardCampaignForm />} />
        <Route path="/discount-schemes/purchase-reward/:id" element={<PurchaseRewardCampaignForm />} />
        <Route path="/discount-schemes/purchase-rewards" element={<PurchaseRewardCampaignList />} />
        <Route path="/discount-schemes/purchase-rewards/new" element={<PurchaseRewardCampaignForm />} />
        <Route path="/discount-schemes/purchase-rewards/edit/:id" element={<PurchaseRewardCampaignForm />} />
        <Route path="/customer-credit" element={<CustomerCreditList />} />
        <Route path="/customer-credit/new" element={<CustomerCreditForm />} />
        <Route path="/customer-credit/:id" element={<CustomerCreditForm />} />
        <Route path="/customers" element={<CustomerList />} />
        <Route path="/customers/new" element={<CustomerForm />} />
        <Route path="/customers/:id" element={<CustomerForm />} />
        <Route path="/prospect-customers" element={<PotentialCustomerList />} />
        <Route path="/prospect-customers/new" element={<PotentialCustomerForm />} />
        <Route path="/prospect-customers/:id" element={<PotentialCustomerForm />} />
        <Route path="/prospect-conversion" element={<ProspectConversion />} />
        <Route path="/bulk-upload" element={<BulkCustomerUpload />} />
        <Route path="/setup" element={<SalesSetupPage />} />
        <Route
          path="/reports/prospect-customer-list"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(() => import("./reports/CustomerListReportPage.jsx")),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/quotation-summary"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/QuotationSummaryReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/quotation-conversion"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/QuotationConversionReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/sales-order-status"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/SalesOrderStatusReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/invoice-summary"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/InvoiceSummaryReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/ar-aging"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/AccountsReceivableAgingReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/revenue-by-customer"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/RevenueByCustomerReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/revenue-by-product"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/RevenueByProductReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/discount-utilization"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/DiscountUtilizationReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/price-list"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(() => import("./reports/PriceListReportPage.jsx")),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/monthly-sales-trend"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/MonthlySalesTrendReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/customer-order-history"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/CustomerOrderHistoryReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/cancelled-orders"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/CancelledOrdersReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route
          path="/reports/customer-history"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(
                  () => import("./reports/CustomerHistoryReportPage.jsx"),
                ),
              )}
            </React.Suspense>
          }
        />
        <Route path="/reports/sales-return" element={<SalesReturnReportPage />} />
        <Route
          path="/reports/sales-register"
          element={<SalesRegisterReportPage />}
        />
        <Route
          path="/reports/delivery-register"
          element={<DeliveryRegisterReportPage />}
        />
        <Route
          path="/reports/debtors-balance"
          element={<DebtorsBalanceReportPage />}
        />
        <Route
          path="/reports/sales-profitability"
          element={<SalesProfitabilityReportPage />}
        />
        <Route
          path="/reports/sales-tracking"
          element={<SalesTrackingReportPage />}
        />
        <Route path="/returns" element={<SalesReturnList />} />
        <Route path="/returns/new" element={<SalesReturnForm />} />
        <Route path="/returns/:id" element={<SalesReturnForm />} />
        <Route path="/sales-entry" element={<Navigate to="/pos/sales-entry" replace />} />
        <Route path="/sales-entry/*" element={<Navigate to="/pos/sales-entry" replace />} />
      </Routes>
    </ModuleLayout>
  );
}
