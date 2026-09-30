/**
 * @fileoverview Main entry point and router for the Purchase module.
 * Configures all sub-routes for purchase orders, requisitions, bills, and reports.
 */

import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import api from "../../../api/client.js";
import { useAuth } from "../../../auth/AuthContext.jsx";

import RequestForQuotationList from "./rfq/RequestForQuotationList.jsx";
import RequestForQuotationForm from "./rfq/RequestForQuotationForm.jsx";
import SupplierQuotationsList from "./supplier-quotations/SupplierQuotationsList.jsx";
import SupplierQuotationForm from "./supplier-quotations/SupplierQuotationForm.jsx";
import QuotationAnalysis from "./quotation-analysis/QuotationAnalysis.jsx";
import PurchaseOrdersLocalList from "./purchase-orders-local/PurchaseOrdersLocalList.jsx";
import PurchaseOrdersLocalForm from "./purchase-orders-local/PurchaseOrdersLocalForm.jsx";
import PurchaseOrdersImportList from "./purchase-orders-import/PurchaseOrdersImportList.jsx";
import PurchaseOrdersImportForm from "./purchase-orders-import/PurchaseOrdersImportForm.jsx";
import ShippingAdviceList from "./shipping-advice/ShippingAdviceList.jsx";
import ShippingAdviceForm from "./shipping-advice/ShippingAdviceForm.jsx";
import PortClearancesList from "./port-clearances/PortClearancesList.jsx";
import PortClearancesForm from "./port-clearances/PortClearancesForm.jsx";
import PurchaseBillsList from "./purchase-bills/PurchaseBillsList.jsx";
import PurchaseBillsForm from "./purchase-bills/PurchaseBillsForm.jsx";
import SuppliersList from "./suppliers/SuppliersList.jsx";
import SupplierForm from "./suppliers/SupplierForm.jsx";
import ImportOrderTrackingReportPage from "./reports/ImportOrderTrackingReportPage.jsx";
import LocalOrderTrackingReportPage from "./reports/LocalOrderTrackingReportPage.jsx";
import PurchaseTrackingReportPage from "./reports/PurchaseTrackingReportPage.jsx";
import SupplierQuotationAnalysisReportPage from "./reports/SupplierQuotationAnalysisReportPage.jsx";
import PendingGrnToBillLocalReportPage from "./reports/PendingGrnToBillLocalReportPage.jsx";
import PendingGrnToBillImportReportPage from "./reports/PendingGrnToBillImportReportPage.jsx";
import ImportOrderListReportPage from "./reports/ImportOrderListReportPage.jsx";
import PendingShipmentDetailsReportPage from "./reports/PendingShipmentDetailsReportPage.jsx";
import PurchaseRegisterReportPage from "./reports/PurchaseRegisterReportPage.jsx";
import ServiceBillsList from "../service-management/service-bills/ServiceBillsList.jsx";
import ServiceBillForm from "../service-management/service-bills/ServiceBillForm.jsx";
import ServiceConfirmationsList from "../service-management/service-confirmations/ServiceConfirmationsList.jsx";
import ServiceConfirmationForm from "../service-management/service-confirmations/ServiceConfirmationForm.jsx";
import DirectPurchase from "./direct-purchase/DirectPurchase.jsx";
import DirectPurchaseList from "./direct-purchase/DirectPurchaseList.jsx";
import GeneralRequisitionList from "./general-requisitions/GeneralRequisitionList.jsx";
import GeneralRequisitionForm from "./general-requisitions/GeneralRequisitionForm.jsx";
import PurchaseReturnList from "../inventory/purchase-returns/PurchaseReturnList.jsx";
import PurchaseReturnForm from "../inventory/purchase-returns/PurchaseReturnForm.jsx";
import PurchaseSetupPage from "./setup/PurchaseSetupPage.jsx";
import PurchaseUploadPage from "./PurchaseUploadPage.jsx";

function PurchaseFeaturePage({ title, description }) {
  return (
    <div className="card">
      <div className="card-header bg-brand text-white rounded-t-lg">
        <h1 className="text-2xl font-bold dark:text-brand-300">{title}</h1>
        {description ? <p className="text-sm mt-1">{description}</p> : null}
      </div>
      <div className="card-body">
        <div className="text-sm">This page is ready to be implemented.</div>
      </div>
    </div>
  );
}

export const purchaseSections = [
  {
    icon: "🛒",
    title: "Procurement",
    features: [
      {
        name: "Direct Purchase",
        path: "/purchase/direct-purchase",
        actions: [
          { label: "View", path: "/purchase/direct-purchase", type: "outline" },
          { label: "New", path: "/purchase/direct-purchase/new", type: "primary" }
        ],
        description: "Create quick single-step purchases",
        icon: "⚡",
      },
      {
        name: "Purchase Requisition",
        path: "/purchase/general-requisitions",
        actions: [
          { label: "View", path: "/purchase/general-requisitions", type: "outline" },
          { label: "New", path: "/purchase/general-requisitions/new", type: "primary" }
        ],
        description: "Request items or services to be purchased",
        icon: "📋",
      },
      {
        name: "Request for Quotation",
        path: "/purchase/rfqs",
        actions: [
          { label: "View", path: "/purchase/rfqs", type: "outline" },
          { label: "New", path: "/purchase/rfqs/new", type: "primary" }
        ],
        description: "Create and manage RFQs",
        icon: "📝",
      },
      {
        name: "Supplier Quotations",
        path: "/purchase/supplier-quotations",
        actions: [
          { label: "View", path: "/purchase/supplier-quotations", type: "outline" },
          { label: "New", path: "/purchase/supplier-quotations/new", type: "primary" }
        ],
        description: "Capture and compare supplier quotations",
        icon: "📨",
      },
      {
        name: "Quotation Analysis",
        path: "/purchase/quotation-analysis",
        actions: [
          { label: "View", path: "/purchase/quotation-analysis", type: "outline" },
          { label: "New", path: "/purchase/quotation-analysis/new", type: "primary" }
        ],
        description: "Analyze quotation options and decisions",
        icon: "📊",
      },
    ],
  },
  {
    title: "Purchase Orders",
    features: [
      {
        name: "Local Purchase Orders",
        path: "/purchase/purchase-orders-local",
        actions: [
          { label: "View", path: "/purchase/purchase-orders-local", type: "outline" },
          { label: "New", path: "/purchase/purchase-orders-local/new", type: "primary" }
        ],
        description: "Manage local POs",
        icon: "📦",
      },
      {
        name: "Import Purchase Orders",
        path: "/purchase/purchase-orders-import",
        actions: [
          { label: "View", path: "/purchase/purchase-orders-import", type: "outline" },
          { label: "New", path: "/purchase/purchase-orders-import/new", type: "primary" }
        ],
        description: "Manage import POs",
        icon: "🚢",
      },
    ],
  },
  {
    title: "Logistics",
    features: [
      {
        name: "Shipping Advice",
        path: "/purchase/shipping-advice",
        actions: [
          { label: "View", path: "/purchase/shipping-advice", type: "outline" },
          { label: "New", path: "/purchase/shipping-advice/new", type: "primary" }
        ],
        description: "Manage shipping advice documents",
        icon: "🚚",
      },
      {
        name: "Port Clearances",
        path: "/purchase/port-clearances",
        actions: [
          { label: "View", path: "/purchase/port-clearances", type: "outline" },
          { label: "New", path: "/purchase/port-clearances/new", type: "primary" }
        ],
        description: "Track port clearance records",
        icon: "🛃",
      },
    ],
  },
  {
    title: "Billing",
    features: [
      {
        name: "Local Purchase Bills",
        path: "/purchase/purchase-bills-local",
        actions: [
          { label: "View", path: "/purchase/purchase-bills-local", type: "outline" },
          { label: "New", path: "/purchase/purchase-bills-local/new", type: "primary" }
        ],
        description: "Create and manage local purchase bills",
        icon: "🧾",
      },
      {
        name: "Import Purchase Bills",
        path: "/purchase/purchase-bills-import",
        actions: [
          { label: "View", path: "/purchase/purchase-bills-import", type: "outline" },
          { label: "New", path: "/purchase/purchase-bills-import/new", type: "primary" }
        ],
        description: "Create and manage import purchase bills",
        icon: "🧾",
      },
      {
        name: "Purchase Upload",
        path: "/purchase/purchase-upload",
        actions: [
          { label: "View", path: "/purchase/purchase-upload", type: "outline", featureKey: "purchase:purchase-upload" },
          { label: "Upload", path: "/purchase/purchase-upload", type: "primary", featureKey: "purchase:purchase-upload" }
        ],
        description: "Download template and bulk upload purchase bills into the system",
        icon: "📥",
      },
    ],
  },
  {
    title: "Returns",
    features: [
      {
        name: "Purchase Returns",
        path: "/purchase/purchase-returns",
        actions: [
          { label: "View", path: "/purchase/purchase-returns", type: "outline" },
          { label: "New", path: "/purchase/purchase-returns/new", type: "primary" }
        ],
        description: "Manage returned items",
        icon: "↩",
      },
    ],
  },
  {
    icon: "🗂️",
    title: "Master Data",
    features: [
      {
        name: "Suppliers",
        path: "/purchase/suppliers",
        actions: [
          { label: "View", path: "/purchase/suppliers", type: "outline" },
          { label: "New", path: "/purchase/suppliers/new", type: "primary" }
        ],
        description: "Manage suppliers and contacts",
        icon: "🏭",
      },
      {
        name: "Setup",
        path: "/purchase/setup",
        actions: [
          { label: "View", path: "/purchase/setup", type: "outline" }
        ],
        description: "Configure accounts and purchase rules",
        icon: "⚙️",
      },
    ],
  },
  {
    title: "Analytics & Reports",
    features: [
      {
        name: "Purchase Register",
        path: "/purchase/reports/purchase-register",
        actions: [
          { label: "View", path: "/purchase/reports/purchase-register", type: "outline" }
        ],
        description: "All purchases registered",
        icon: "📊",
      },
      {
        name: "Purchase Tracking",
        path: "/purchase/reports/purchase-tracking",
        actions: [
          { label: "View", path: "/purchase/reports/purchase-tracking", type: "outline" }
        ],
        description: "Track all purchase status",
        icon: "🔎",
      },
      {
        name: "Supplier Quotation Analysis",
        path: "/purchase/reports/supplier-quotation-analysis",
        actions: [
          { label: "View", path: "/purchase/reports/supplier-quotation-analysis", type: "outline" }
        ],
        description: "Analyze supplier quotations",
        icon: "📑",
      },
      {
        name: "Supplier Performance",
        path: "/purchase/reports/supplier-performance",
        actions: [
          { label: "View", path: "/purchase/reports/supplier-performance", type: "outline" }
        ],
        description: "Evaluate supplier performance",
        icon: "📈",
      },
      {
        name: "Supplier Outstanding Payables",
        path: "/purchase/reports/supplier-outstanding-payables",
        actions: [
          { label: "View", path: "/purchase/reports/supplier-outstanding-payables", type: "outline" }
        ],
        description: "Track outstanding supplier balances",
        icon: "💰",
      },
      {
        name: "Item Purchase History",
        path: "/purchase/reports/item-purchase-history",
        actions: [
          { label: "View", path: "/purchase/reports/item-purchase-history", type: "outline" }
        ],
        description: "History of item purchases",
        icon: "📋",
      },
      {
        name: "Price Variance",
        path: "/purchase/reports/price-variance",
        actions: [
          { label: "View", path: "/purchase/reports/price-variance", type: "outline" }
        ],
        description: "Analyze price variations",
        icon: "📉",
      },
      {
        name: "Purchase Aging",
        path: "/purchase/reports/purchase-aging",
        actions: [
          { label: "View", path: "/purchase/reports/purchase-aging", type: "outline" }
        ],
        description: "Aging analysis of purchases",
        icon: "📅",
      },
      {
        name: "Lead Time Analysis",
        path: "/purchase/reports/lead-time-analysis",
        actions: [
          { label: "View", path: "/purchase/reports/lead-time-analysis", type: "outline" }
        ],
        description: "Analyze delivery lead times",
        icon: "⏳",
      },
      {
        name: "Cancelled POs",
        path: "/purchase/reports/cancelled-pos",
        actions: [
          { label: "View", path: "/purchase/reports/cancelled-pos", type: "outline" }
        ],
        description: "List of cancelled orders",
        icon: "🚫",
      },
      {
        name: "Import Order Tracking",
        path: "/purchase/reports/import-order-tracking",
        actions: [
          { label: "View", path: "/purchase/reports/import-order-tracking", type: "outline" }
        ],
        description: "Track import orders",
        icon: "🚢",
      },
      {
        name: "Local Order Tracking",
        path: "/purchase/reports/local-order-tracking",
        actions: [
          { label: "View", path: "/purchase/reports/local-order-tracking", type: "outline" }
        ],
        description: "Track local orders",
        icon: "🚚",
      },
      {
        name: "Pending GRN to Bill (Local)",
        path: "/purchase/reports/pending-grn-to-bill-local",
        actions: [
          { label: "View", path: "/purchase/reports/pending-grn-to-bill-local", type: "outline" }
        ],
        description: "Pending local GRN to bill",
        icon: "📝",
      },
      {
        name: "Pending GRN to Bill (Import)",
        path: "/purchase/reports/pending-grn-to-bill-import",
        actions: [
          { label: "View", path: "/purchase/reports/pending-grn-to-bill-import", type: "outline" }
        ],
        description: "Pending import GRN to bill",
        icon: "📝",
      },
      {
        name: "Import Order List",
        path: "/purchase/reports/import-order-list",
        actions: [
          { label: "View", path: "/purchase/reports/import-order-list", type: "outline" }
        ],
        description: "List of import orders",
        icon: "📑",
      },
      {
        name: "Pending Shipments",
        path: "/purchase/reports/pending-shipments",
        actions: [
          { label: "View", path: "/purchase/reports/pending-shipments", type: "outline" }
        ],
        description: "Track pending shipments",
        icon: "📦",
      },
      {
        name: "Department Analysis",
        path: "/purchase/reports/department-analysis",
        actions: [
          { label: "View", path: "/purchase/reports/department-analysis", type: "outline" }
        ],
        description: "Purchase analysis by department",
        icon: "📊",
      },
      {
        name: "Import Cost Breakdown",
        path: "/purchase/reports/import-cost-breakdown",
        actions: [
          { label: "View", path: "/purchase/reports/import-cost-breakdown", type: "outline" }
        ],
        description: "Breakdown of import costs",
        icon: "💰",
      },
      {
        name: "Purchase Returns Analysis",
        path: "/purchase/reports/purchase-returns-analysis",
        actions: [
          { label: "View", path: "/purchase/reports/purchase-returns-analysis", type: "outline" }
        ],
        description: "Analyze purchase returns",
        icon: "↩️",
      },
    ],
  },
];

function PurchaseHomeIndex() {
  const { token } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer;
    async function load() {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await api.get("/purchase/analytics/overview");
        if (!cancelled) setOverview(res.data || null);
      } catch {
        if (!cancelled) setOverview(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const fmt = (n) =>
    `GH₵${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const stats = [
    {
      rbac_key: "total-purchases",
      icon: "🧾",
      value: loading ? "..." : fmt(overview?.totalPurchases || 0),
      label: "Purchases (Last 30 Days)",
      change: loading
        ? ""
        : `${Number(overview?.totalPurchaseOrders || 0)} bills`,
      path: "/purchase/reports",
        actions: [
          { label: "View", path: "/purchase/reports", type: "outline" }
        ],
    },
    {
      rbac_key: "active-purchase-orders",
      icon: "📦",
      value: loading ? "..." : String(overview?.activePurchaseOrders ?? 0),
      label: "Active Purchase Orders",
      path: "/purchase/purchase-orders-local",
        actions: [
          { label: "View", path: "/purchase/purchase-orders-local", type: "outline" },
          { label: "New", path: "/purchase/purchase-orders-local/new", type: "primary" }
        ],
    },
    {
      rbac_key: "active-suppliers",
      icon: "🏭",
      value: loading ? "..." : String(overview?.activeSuppliers ?? 0),
      label: "Active Suppliers",
      path: "/purchase/suppliers",
        actions: [
          { label: "View", path: "/purchase/suppliers", type: "outline" },
          { label: "New", path: "/purchase/suppliers/new", type: "primary" }
        ],
    },
    {
      rbac_key: "pending-approvals",
      icon: "⏳",
      value: loading ? "..." : String(overview?.pendingApprovals ?? 0),
      label: "Pending Approvals",
      path: "/administration/workflows/approvals",
        actions: [
          { label: "View", path: "/administration/workflows/approvals", type: "outline" },
          { label: "New", path: "/administration/workflows/approvals/new", type: "primary" }
        ],
    },
    {
      rbac_key: "outstanding-payables",
      icon: "💳",
      value: loading ? "..." : fmt(overview?.outstandingPayables || 0),
      label: "Outstanding Payables",
      path: "/purchase/purchase-bills-local",
        actions: [
          { label: "View", path: "/purchase/purchase-bills-local", type: "outline" },
          { label: "New", path: "/purchase/purchase-bills-local/new", type: "primary" }
        ],
    },
  ];

  return (
    <ModuleDashboard
      useSectionNavigation={true}
      title="🛒 Purchase"
      description="Purchase management and procurement workflows"
      stats={stats}
      moduleKey="purchase"
      headerActions={[
        {
          label: "Dashboard",
          path: "/purchase/dashboard",
          actions: [
            { label: "View", path: "/purchase/dashboard", type: "outline" }
          ],
          icon: "📊"
        },
      ]}
      sections={purchaseSections}
    />
  );
}

export default function PurchaseHome() {
  return (
    <ModuleLayout sections={purchaseSections} moduleKey="purchase">
      <Routes>
        <Route index element={<PurchaseHomeIndex />} />
        <Route path="direct-purchase" element={<DirectPurchaseList />} />
        <Route path="direct-purchase/new" element={<DirectPurchase />} />
        <Route path="direct-purchase/:id" element={<DirectPurchase />} />
        <Route
          path="general-requisitions"
          element={<GeneralRequisitionList />}
        />
        <Route
          path="general-requisitions/new"
          element={<GeneralRequisitionForm />}
        />
        <Route
          path="general-requisitions/:id"
          element={<GeneralRequisitionForm />}
        />
        <Route path="rfqs" element={<RequestForQuotationList />} />
        <Route path="rfqs/new" element={<RequestForQuotationForm />} />
        <Route path="rfqs/:id" element={<RequestForQuotationForm />} />
        <Route
          path="supplier-quotations"
          element={<SupplierQuotationsList />}
        />
        <Route
          path="supplier-quotations/new"
          element={<SupplierQuotationForm />}
        />
        <Route
          path="supplier-quotations/:id"
          element={<SupplierQuotationForm />}
        />
        <Route path="quotation-analysis" element={<QuotationAnalysis />} />
        <Route
          path="purchase-orders-local"
          element={<PurchaseOrdersLocalList />}
        />
        <Route
          path="purchase-orders-local/new"
          element={<PurchaseOrdersLocalForm />}
        />
        <Route
          path="purchase-orders-local/:id"
          element={<PurchaseOrdersLocalForm />}
        />
        <Route
          path="purchase-orders-import"
          element={<PurchaseOrdersImportList />}
        />
        <Route
          path="purchase-orders-import/new"
          element={<PurchaseOrdersImportForm />}
        />
        <Route
          path="purchase-orders-import/:id"
          element={<PurchaseOrdersImportForm />}
        />
        <Route path="shipping-advice" element={<ShippingAdviceList />} />
        <Route path="shipping-advice/new" element={<ShippingAdviceForm />} />
        <Route path="shipping-advice/:id" element={<ShippingAdviceForm />} />
        <Route path="port-clearances" element={<PortClearancesList />} />
        <Route path="port-clearances/new" element={<PortClearancesForm />} />
        <Route path="port-clearances/:id" element={<PortClearancesForm />} />
        <Route path="purchase-bills-local" element={<PurchaseBillsList />} />
        <Route
          path="purchase-bills-local/new"
          element={<PurchaseBillsForm />}
        />
        <Route
          path="purchase-bills-local/:id"
          element={<PurchaseBillsForm />}
        />
        <Route path="purchase-bills-import" element={<PurchaseBillsList />} />
        <Route
          path="purchase-bills-import/new"
          element={<PurchaseBillsForm />}
        />
        <Route
          path="purchase-bills-import/:id"
          element={<PurchaseBillsForm />}
        />
        <Route path="purchase-upload" element={<PurchaseUploadPage />} />
        <Route path="upload" element={<PurchaseUploadPage />} />
        <Route path="purchase-returns" element={<PurchaseReturnList />} />
        <Route path="purchase-returns/new" element={<PurchaseReturnForm />} />
        <Route path="purchase-returns/:id" element={<PurchaseReturnForm />} />
        <Route path="suppliers" element={<SuppliersList />} />
        <Route path="suppliers/new" element={<SupplierForm />} />
        <Route path="suppliers/:id" element={<SupplierForm />} />
        <Route path="setup" element={<PurchaseSetupPage />} />
        <Route
          path="service-bills"
          element={<ServiceBillsList />}
        />
        <Route
          path="service-bills/new"
          element={<ServiceBillForm />}
        />
        <Route
          path="service-bills/:id"
          element={<ServiceBillForm />}
        />
        <Route
          path="service-confirmation"
          element={<ServiceConfirmationsList />}
        />
        <Route
          path="service-confirmation/new"
          element={<ServiceConfirmationForm />}
        />
        <Route
          path="service-confirmation/:id"
          element={<ServiceConfirmationForm />}
        />
        <Route
          path="reports/import-order-tracking"
          element={<ImportOrderTrackingReportPage />}
        />
        <Route
          path="reports/local-order-tracking"
          element={<LocalOrderTrackingReportPage />}
        />
        <Route
          path="reports/purchase-tracking"
          element={<PurchaseTrackingReportPage />}
        />
        <Route
          path="reports/supplier-quotation-analysis"
          element={<SupplierQuotationAnalysisReportPage />}
        />
        <Route
          path="reports/pending-grn-to-bill-local"
          element={<PendingGrnToBillLocalReportPage />}
        />
        <Route
          path="reports/pending-grn-to-bill-import"
          element={<PendingGrnToBillImportReportPage />}
        />
        <Route
          path="reports/import-order-list"
          element={<ImportOrderListReportPage />}
        />
        <Route
          path="reports/pending-shipments"
          element={<PendingShipmentDetailsReportPage />}
        />
        <Route
          path="reports/purchase-register"
          element={<PurchaseRegisterReportPage />}
        />
        <Route
          path="reports/department-analysis"
          element={React.createElement(
            React.lazy(
              () =>
                import("./reports/DepartmentPurchaseAnalysisReportPage.jsx"),
            ),
          )}
        />
        <Route
          path="reports/import-cost-breakdown"
          element={React.createElement(
            React.lazy(
              () => import("./reports/ImportCostBreakdownReportPage.jsx"),
            ),
          )}
        />
        <Route
          path="reports/lead-time-analysis"
          element={React.createElement(
            React.lazy(
              () => import("./reports/LeadTimeAnalysisReportPage.jsx"),
            ),
          )}
        />
        <Route
          path="reports/cancelled-pos"
          element={React.createElement(
            React.lazy(
              () => import("./reports/CancelledPurchaseOrdersReportPage.jsx"),
            ),
          )}
        />
        <Route
          path="reports/purchase-returns-analysis"
          element={React.createElement(
            React.lazy(
              () => import("./reports/PurchaseReturnsAnalysisReportPage.jsx"),
            ),
          )}
        />
        <Route
          path="reports/item-purchase-history"
          element={React.createElement(
            React.lazy(
              () => import("./reports/ItemPurchaseHistoryReportPage.jsx"),
            ),
          )}
        />
        <Route
          path="reports/price-variance"
          element={React.createElement(
            React.lazy(() => import("./reports/PriceVarianceReportPage.jsx")),
          )}
        />
        <Route
          path="reports/supplier-performance"
          element={React.createElement(
            React.lazy(
              () => import("./reports/SupplierPerformanceReportPage.jsx"),
            ),
          )}
        />
        <Route
          path="reports/supplier-outstanding-payables"
          element={React.createElement(
            React.lazy(
              () =>
                import("./reports/SupplierOutstandingPayablesReportPage.jsx"),
            ),
          )}
        />
        <Route
          path="reports/purchase-aging"
          element={React.createElement(
            React.lazy(() => import("./reports/PurchaseAgingReportPage.jsx")),
          )}
        />
        <Route
          path="dashboard"
          element={
            <React.Suspense fallback={<div className="p-4">Loading...</div>}>
              {React.createElement(
                React.lazy(() => import("./PurchaseDashboardPage.jsx")),
              )}
            </React.Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/purchase" replace />} />
      </Routes>
    </ModuleLayout>
  );
}

export const purchaseFeatures = [
  {
    module_key: "purchase",
    label: "Purchase Requisition",
    path: "/purchase/general-requisitions",
        actions: [
          { label: "View", path: "/purchase/general-requisitions", type: "outline" },
          { label: "New", path: "/purchase/general-requisitions/new", type: "primary" }
        ],
    type: "feature",
    icon: "📋",
  },
  {
    module_key: "purchase",
    label: "Purchase Returns",
    path: "/purchase/purchase-returns",
        actions: [
          { label: "View", path: "/purchase/purchase-returns", type: "outline" },
          { label: "New", path: "/purchase/purchase-returns/new", type: "primary" }
        ],
    type: "feature",
    icon: "↩",
  },
  {
    module_key: "purchase",
    label: "Direct Purchase",
    path: "/purchase/direct-purchase",
        actions: [
          { label: "View", path: "/purchase/direct-purchase", type: "outline" },
          { label: "New", path: "/purchase/direct-purchase/new", type: "primary" }
        ],
    type: "feature",
    icon: "⚡",
  },
  {
    module_key: "purchase",
    label: "Request for Quotation",
    path: "/purchase/rfqs",
        actions: [
          { label: "View", path: "/purchase/rfqs", type: "outline" },
          { label: "New", path: "/purchase/rfqs/new", type: "primary" }
        ],
    type: "feature",
    icon: "📝",
  },
  {
    module_key: "purchase",
    label: "Supplier Quotations",
    path: "/purchase/supplier-quotations",
        actions: [
          { label: "View", path: "/purchase/supplier-quotations", type: "outline" },
          { label: "New", path: "/purchase/supplier-quotations/new", type: "primary" }
        ],
    type: "feature",
    icon: "📨",
  },
  {
    module_key: "purchase",
    label: "Quotation Analysis",
    path: "/purchase/quotation-analysis",
        actions: [
          { label: "View", path: "/purchase/quotation-analysis", type: "outline" },
          { label: "New", path: "/purchase/quotation-analysis/new", type: "primary" }
        ],
    type: "feature",
    icon: "📊",
  },
  {
    module_key: "purchase",
    label: "Local Purchase Orders",
    path: "/purchase/purchase-orders-local",
        actions: [
          { label: "View", path: "/purchase/purchase-orders-local", type: "outline" },
          { label: "New", path: "/purchase/purchase-orders-local/new", type: "primary" }
        ],
    type: "feature",
    icon: "📦",
  },
  {
    module_key: "purchase",
    label: "Import Purchase Orders",
    path: "/purchase/purchase-orders-import",
        actions: [
          { label: "View", path: "/purchase/purchase-orders-import", type: "outline" },
          { label: "New", path: "/purchase/purchase-orders-import/new", type: "primary" }
        ],
    type: "feature",
    icon: "🚢",
  },
  {
    module_key: "purchase",
    label: "Shipping Advice",
    path: "/purchase/shipping-advice",
        actions: [
          { label: "View", path: "/purchase/shipping-advice", type: "outline" },
          { label: "New", path: "/purchase/shipping-advice/new", type: "primary" }
        ],
    type: "feature",
    icon: "🚚",
  },
  {
    module_key: "purchase",
    label: "Port Clearances",
    path: "/purchase/port-clearances",
        actions: [
          { label: "View", path: "/purchase/port-clearances", type: "outline" },
          { label: "New", path: "/purchase/port-clearances/new", type: "primary" }
        ],
    type: "feature",
    icon: "🛃",
  },
  {
    module_key: "purchase",
    label: "Local Purchase Bills",
    path: "/purchase/purchase-bills-local",
        actions: [
          { label: "View", path: "/purchase/purchase-bills-local", type: "outline" },
          { label: "New", path: "/purchase/purchase-bills-local/new", type: "primary" }
        ],
    type: "feature",
    icon: "🧾",
  },
  {
    module_key: "purchase",
    label: "Import Purchase Bills",
    path: "/purchase/purchase-bills-import",
        actions: [
          { label: "View", path: "/purchase/purchase-bills-import", type: "outline" },
          { label: "New", path: "/purchase/purchase-bills-import/new", type: "primary" }
        ],
    type: "feature",
    icon: "🧾",
  },
  {
    module_key: "purchase",
    label: "Suppliers",
    path: "/purchase/suppliers",
        actions: [
          { label: "View", path: "/purchase/suppliers", type: "outline" },
          { label: "New", path: "/purchase/suppliers/new", type: "primary" }
        ],
    type: "feature",
    icon: "🏭",
  },
  {
    module_key: "purchase",
    label: "Purchase Setup",
    path: "/purchase/setup",
        actions: [
          { label: "View", path: "/purchase/setup", type: "outline" }
        ],
    type: "feature",
    icon: "⚙️",
  },
];
