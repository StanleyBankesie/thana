/**
 * @fileoverview PosHome module routing and dashboard landing page.
 * Self-contained POS module encompassing counter operations, direct purchases,
 * store inventory, finance vouchers, and relevant analytics & reports.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";

// Core POS Components
import PosReports from "./reports/PosReports.jsx";
import PosCustomerHistory from "./reports/PosCustomerHistory.jsx";
import PosSetup from "./setup/PosSetup.jsx";
import PosReturnForm from "./returns/PosReturnForm.jsx";
import PosRegister from "./register/PosRegister.jsx";
import PosSalesEntry from "./entry/PosSalesEntry.jsx";
import CashCollectionDetails from "./cash/CashCollectionDetails.jsx";
import PosInvoiceList from "./invoices/PosInvoiceList.jsx";
import PosPostToFinance from "./finance/PosPostToFinance.jsx";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import api from "../../../api/client.js";
import PosDayManagement from "./day/PosDayManagement.jsx";
import PosDashboard from "./dashboard/PosDashboard.jsx";
import { useAuth } from "../../../auth/AuthContext.jsx";
import useOfflineQueue from "../../../offline/useOfflineQueue.js";
import { preloadPosData } from "../../../offline/posPreloader.js";
import PosReconciliation from "./PosReconciliation.jsx";
import PosOnHold from "./PosOnHold.jsx";

// Lazy-loaded Shared Procurement Components (Direct Purchases Only)
const DirectPurchaseList = React.lazy(() =>
  import("../purchase/direct-purchase/DirectPurchaseList.jsx"),
);
const DirectPurchase = React.lazy(() =>
  import("../purchase/direct-purchase/DirectPurchase.jsx"),
);

// Lazy-loaded Shared Inventory Components
const ItemsList = React.lazy(() => import("../inventory/ItemsList.jsx"));
const ItemForm = React.lazy(() => import("../inventory/ItemForm.jsx"));
const ItemGroupsList = React.lazy(() => import("../inventory/ItemGroupsList.jsx"));
const ItemGroupForm = React.lazy(() => import("../inventory/ItemGroupForm.jsx"));
const StockBalancesPage = React.lazy(() =>
  import("../inventory/StockBalancesPage.jsx"),
);
const DailyStockTakeList = React.lazy(() =>
  import("../inventory/DailyStockTakeList.jsx"),
);
const DailyStockTakeForm = React.lazy(() =>
  import("../inventory/DailyStockTakeForm.jsx"),
);
const StockTransferList = React.lazy(() =>
  import("../inventory/StockTransferList.jsx"),
);
const StockTransferForm = React.lazy(() =>
  import("../inventory/StockTransferForm.jsx"),
);
const TransferAcceptanceList = React.lazy(() =>
  import("../inventory/TransferAcceptanceList.jsx"),
);
const TransferAcceptanceForm = React.lazy(() =>
  import("../inventory/TransferAcceptanceForm.jsx"),
);
const StockAdjustmentList = React.lazy(() =>
  import("../inventory/StockAdjustmentList.jsx"),
);
const StockAdjustmentForm = React.lazy(() =>
  import("../inventory/StockAdjustmentForm.jsx"),
);
const StockReorderPage = React.lazy(() =>
  import("../inventory/StockReorderPage.jsx"),
);
const ItemBatchesList = React.lazy(() =>
  import("../inventory/ItemBatchesList.jsx"),
);

// Lazy-loaded Shared Finance Voucher Components
const PaymentVoucherList = React.lazy(() =>
  import("../finance/vouchers/PaymentVoucherList.jsx"),
);
const PaymentVoucherForm = React.lazy(() =>
  import("../finance/vouchers/PaymentVoucherForm.jsx"),
);
const ReceiptVoucherList = React.lazy(() =>
  import("../finance/vouchers/ReceiptVoucherList.jsx"),
);
const ReceiptVoucherForm = React.lazy(() =>
  import("../finance/vouchers/ReceiptVoucherForm.jsx"),
);
const ContraVoucherList = React.lazy(() =>
  import("../finance/vouchers/ContraVoucherList.jsx"),
);
const ContraVoucherForm = React.lazy(() =>
  import("../finance/vouchers/ContraVoucherForm.jsx"),
);
const PosCustomerList = React.lazy(() =>
  import("./customers/CustomerList.jsx"),
);
const PosCustomerForm = React.lazy(() =>
  import("./customers/CustomerForm.jsx"),
);
const PosSuppliersList = React.lazy(() =>
  import("./suppliers/SuppliersList.jsx"),
);
const PosSupplierForm = React.lazy(() =>
  import("./suppliers/SupplierForm.jsx"),
);

// Lazy-loaded Reports
// 1. Finance Reports
const ProfitAndLossReportPage = React.lazy(() =>
  import("../finance/reports/ProfitAndLossReportPage.jsx"),
);
const CustomerOutstandingReportPage = React.lazy(() =>
  import("../finance/reports/CustomerOutstandingReportPage.jsx"),
);
const DebtorsLedgerReportPage = React.lazy(() =>
  import("../finance/reports/DebtorsLedgerReportPage.jsx"),
);
const OutstandingReceivableReportPage = React.lazy(() =>
  import("../finance/reports/OutstandingReceivableReportPage.jsx"),
);
const VoucherRegisterReportPage = React.lazy(() =>
  import("../finance/reports/VoucherRegisterReportPage.jsx"),
);
const SupplierOutstandingReportPage = React.lazy(() =>
  import("../finance/reports/SupplierOutstandingReportPage.jsx"),
);

// 2. Purchase Reports
const PurchaseRegisterReportPage = React.lazy(() =>
  import("../purchase/reports/PurchaseRegisterReportPage.jsx"),
);
const ItemPurchaseHistoryReportPage = React.lazy(() =>
  import("../purchase/reports/ItemPurchaseHistoryReportPage.jsx"),
);
const SupplierOutstandingPayablesReportPage = React.lazy(() =>
  import("../purchase/reports/SupplierOutstandingPayablesReportPage.jsx"),
);
const PurchaseReturnsAnalysisReportPage = React.lazy(() =>
  import("../purchase/reports/PurchaseReturnsAnalysisReportPage.jsx"),
);
const PriceVarianceReportPage = React.lazy(() =>
  import("../purchase/reports/PriceVarianceReportPage.jsx"),
);

// 3. Inventory Reports
const StockBalancesReportPage = React.lazy(() =>
  import("../inventory/reports/StockBalancesReportPage.jsx"),
);
const FastMovingReportPage = React.lazy(() =>
  import("../inventory/reports/FastMovingReportPage.jsx"),
);
const SlowMovingReportPage = React.lazy(() =>
  import("../inventory/reports/SlowMovingReportPage.jsx"),
);
const ExpiredItemsReportPage = React.lazy(() =>
  import("../inventory/reports/ExpiredItemsReportPage.jsx"),
);
const StockAdjustmentReportPage = React.lazy(() =>
  import("../inventory/reports/StockAdjustmentReportPage.jsx"),
);
const StockTransferRegisterReportPage = React.lazy(() =>
  import("../inventory/reports/StockTransferRegisterReportPage.jsx"),
);

/**
 * PosLanding component
 * Displays the main Point of Sale dashboard, daily statistics, and quick navigation.
 * 
 * @returns {JSX.Element} The POS module landing view.
 */
function PosLanding() {
  const [overview, setOverview] = useState(null);
  const [now, setNow] = useState(new Date());
  const { token } = useAuth();

  useEffect(() => {
    let cancelled = false;
    api
      .get("/pos/analytics/overview")
      .then((res) => {
        if (cancelled) return;
        setOverview(res.data || null);
      })
      .catch(() => {
        if (cancelled) return;
        setOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (n) =>
    `GH₵${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const stats = [
    {
      rbac_key: "today-sales",
      icon: "💵",
      value: fmt(overview?.todaySales || 0),
      label: "Today Sales",
      path: "/pos/reports",
      actions: [{ label: "View", path: "/pos/reports", type: "outline" }],
    },
    {
      rbac_key: "total-customers",
      icon: "👥",
      value: String(overview?.totalCustomers ?? 0),
      label: "Total Customers",
      path: "/pos/customers",
      actions: [
        { label: "View", path: "/pos/customers", type: "outline" },
        { label: "New", path: "/pos/customers/new", type: "primary" },
      ],
    },
    {
      rbac_key: "average-order",
      icon: "🧾",
      value: fmt(overview?.averageOrder || 0),
      label: "Average Order",
      path: "/pos/reports",
      actions: [{ label: "View", path: "/pos/reports", type: "outline" }],
    },
    {
      rbac_key: "monthly-revenue",
      icon: "📊",
      value: fmt(overview?.monthlyRevenue || 0),
      label: "Monthly Revenue",
      path: "/pos/reports/profit-and-loss",
      actions: [
        { label: "View", path: "/pos/reports/profit-and-loss", type: "outline" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PosSyncStatus />
      <ModuleDashboard
        useSectionNavigation={true}
        title="Point of Sale (POS)"
        description="Self-contained counter sales, direct procurement, store inventory, cash desk, and financial reporting"
        stats={stats}
        headerActions={[
          {
            label: "Dashboard",
            path: "/pos/dashboard",
            actions: [{ label: "View", path: "/pos/dashboard", type: "outline" }],
            icon: "📊",
          },
        ]}
        sections={posSections}
        features={posFeatures}
      />
    </div>
  );
}

/**
 * Sections configuration for the POS Module navigation and dashboard cards.
 */
export const posSections = [
  {
    icon: "💳",
    title: "Transactions & Register",
    features: [
      {
        name: "Sales Entry",
        path: "/pos/sales-entry",
        actions: [
          { label: "View", path: "/pos/sales-entry", type: "outline" },
          { label: "New", path: "/pos/sales-entry/new", type: "primary" },
        ],
        description: "Quick retail checkout and counter sales",
        icon: "🛒",
      },
      {
        name: "Start/End Business Day",
        path: "/pos/day-management",
        actions: [
          { label: "View", path: "/pos/day-management", type: "outline" },
          { label: "New", path: "/pos/day-management/new", type: "primary" },
        ],
        description: "Open/close POS business day and cashier reconciliation",
        icon: "📅",
      },
      {
        name: "Cash Collection",
        path: "/pos/cash-collection",
        actions: [
          { label: "View", path: "/pos/cash-collection", type: "outline" },
          { label: "New", path: "/pos/cash-collection/new", type: "primary" },
        ],
        description: "View and record cash collected per cashier session",
        icon: "💵",
      },
      {
        name: "POS Invoices",
        path: "/pos/invoices",
        actions: [
          { label: "View", path: "/pos/invoices", type: "outline" },
          { label: "New", path: "/pos/invoices/new", type: "primary" },
        ],
        description: "View, filter, and reprint sales invoices/receipts",
        icon: "📜",
      },
      {
        name: "On-Hold Sales",
        path: "/pos/holds",
        actions: [
          { label: "View", path: "/pos/holds", type: "outline" },
          { label: "New", path: "/pos/holds/new", type: "primary" },
        ],
        description: "Resume and complete held draft sales",
        icon: "⏸️",
      },
      {
        name: "POS Returns",
        path: "/pos/returns",
        actions: [
          { label: "View", path: "/pos/returns", type: "outline" },
          { label: "New", path: "/pos/returns/new", type: "primary" },
        ],
        description: "Process customer returns and issue refunds",
        icon: "↩️",
      },
      {
        name: "POS Register",
        path: "/pos/register",
        actions: [
          { label: "View", path: "/pos/register", type: "outline" },
          { label: "New", path: "/pos/register/new", type: "primary" },
        ],
        description: "Full transaction ledger and item details",
        icon: "📒",
      },
      {
        name: "Post to Finance",
        path: "/pos/post-to-finance",
        actions: [
          { label: "View", path: "/pos/post-to-finance", type: "outline" },
          { label: "New", path: "/pos/post-to-finance/new", type: "primary" },
        ],
        description: "Post aggregated POS sales to the General Ledger",
        icon: "📤",
      },
      {
        name: "Customers",
        path: "/pos/customers",
        actions: [
          { label: "View", path: "/pos/customers", type: "outline" },
          { label: "New", path: "/pos/customers/new", type: "primary" },
        ],
        description: "Customer accounts, pricing, credit limits, and contact profiles",
        icon: "👥",
      },
    ],
  },
  {
    icon: "📦",
    title: "Direct Procurement",
    features: [
      {
        name: "Direct Purchases",
        path: "/pos/direct-purchases",
        actions: [
          { label: "View", path: "/pos/direct-purchases", type: "outline" },
          { label: "New", path: "/pos/direct-purchases/new", type: "primary" },
        ],
        description: "Record single-step direct purchases into store stock",
        icon: "🛍️",
      },
      {
        name: "Suppliers",
        path: "/pos/suppliers",
        actions: [
          { label: "View", path: "/pos/suppliers", type: "outline" },
          { label: "New", path: "/pos/suppliers/new", type: "primary" },
        ],
        description: "Manage direct store suppliers and vendor contacts",
        icon: "🏢",
      },
    ],
  },
  {
    icon: "🏬",
    title: "Store Inventory",
    features: [
      {
        name: "Items Master",
        path: "/pos/items",
        actions: [
          { label: "View", path: "/pos/items", type: "outline" },
          { label: "New", path: "/pos/items/new", type: "primary" },
        ],
        description: "Product catalog, SKU details, barcodes, and pricing",
        icon: "🏷️",
      },
      {
        name: "Item Classification",
        path: "/pos/inventory/item-groups",
        actions: [
          { label: "View", path: "/pos/inventory/item-groups", type: "outline" },
          { label: "New", path: "/pos/inventory/item-groups/new", type: "primary" },
        ],
        description: "Categories and product groupings",
        icon: "🗂️",
      },
      {
        name: "Stock Balances",
        path: "/pos/inventory/stock-balances",
        actions: [
          { label: "View", path: "/pos/inventory/stock-balances", type: "outline" },
        ],
        description: "Current on-hand quantities across shop locations/bins",
        icon: "⚖️",
      },
      {
        name: "Stock Transfers",
        path: "/pos/inventory/stock-transfers",
        actions: [
          { label: "View", path: "/pos/inventory/stock-transfers", type: "outline" },
          { label: "New", path: "/pos/inventory/stock-transfers/new", type: "primary" },
        ],
        description: "Transfer stock between branches or warehouses",
        icon: "🔄",
      },
      {
        name: "Transfer Acceptance",
        path: "/pos/inventory/transfer-acceptance",
        actions: [
          { label: "View", path: "/pos/inventory/transfer-acceptance", type: "outline" },
        ],
        description: "Acknowledge and receive shipments from central warehouse",
        icon: "📥",
      },
      {
        name: "Stock Adjustments",
        path: "/pos/stock-adjustments",
        actions: [
          { label: "View", path: "/pos/stock-adjustments", type: "outline" },
          { label: "New", path: "/pos/stock-adjustments/new", type: "primary" },
        ],
        description: "Write off damaged goods, spoilage, or shrinkage",
        icon: "📉",
      },
      {
        name: "Stock Reorder",
        path: "/pos/inventory/stock-reorder",
        actions: [
          { label: "View", path: "/pos/inventory/stock-reorder", type: "outline" },
        ],
        description: "Automated replenishment and low stock alerts",
        icon: "🛒",
      },
      {
        name: "Item Batches",
        path: "/pos/inventory/batches",
        actions: [
          { label: "View", path: "/pos/inventory/batches", type: "outline" },
        ],
        description: "Batch tracking, lot numbers, and expiry management",
        icon: "📦",
      },
    ],
  },
  {
    icon: "💰",
    title: "Finance & Cash Desk",
    features: [
      {
        name: "Make Payment (Petty Cash)",
        path: "/pos/finance/payment-voucher",
        actions: [
          { label: "View", path: "/pos/finance/payment-voucher", type: "outline" },
          { label: "New", path: "/pos/finance/payment-voucher/create", type: "primary" },
        ],
        description: "Record store expenses, transport, and petty cash payouts",
        icon: "💸",
      },
      {
        name: "Receive Payment (Debt Collection)",
        path: "/pos/finance/receipt-voucher",
        actions: [
          { label: "View", path: "/pos/finance/receipt-voucher", type: "outline" },
          { label: "New", path: "/pos/finance/receipt-voucher/create", type: "primary" },
        ],
        description: "Record customer account payments and credit settlements",
        icon: "💰",
      },
      {
        name: "Bank Deposit (Contra)",
        path: "/pos/finance/contra-voucher",
        actions: [
          { label: "View", path: "/pos/finance/contra-voucher", type: "outline" },
          { label: "New", path: "/pos/finance/contra-voucher/create", type: "primary" },
        ],
        description: "Record cash drops from drawer into the bank account",
        icon: "🏦",
      },
    ],
  },
  {
    icon: "📊",
    title: "Reports & Analytics",
    features: [
      {
        name: "Profit and Loss Report",
        path: "/pos/reports/profit-and-loss",
        actions: [
          { label: "View", path: "/pos/reports/profit-and-loss", type: "outline" },
        ],
        description: "Store revenue, cost of goods, expenses, and net profit",
        icon: "📈",
      },
      {
        name: "POS Reports",
        path: "/pos/reports",
        actions: [{ label: "View", path: "/pos/reports", type: "outline" }],
        description: "Daily sales, payment breakdowns, and top items",
        icon: "📊",
      },
      {
        name: "Dashboard",
        path: "/pos/dashboard",
        actions: [{ label: "View", path: "/pos/dashboard", type: "outline" }],
        description: "Charts and visual analytics for POS",
        icon: "📉",
      },
      {
        name: "Customer Accounts",
        path: "/pos/customer-history",
        actions: [
          { label: "View", path: "/pos/customer-history", type: "outline" },
          { label: "New", path: "/pos/customer-history/new", type: "primary" },
        ],
        description: "Customer purchase history, balances, and profiles",
        icon: "👥",
      },
      {
        name: "Customer Outstanding",
        path: "/pos/reports/customer-outstanding",
        actions: [
          { label: "View", path: "/pos/reports/customer-outstanding", type: "outline" },
        ],
        description: "Outstanding balances owed by credit customers",
        icon: "👤",
      },
      {
        name: "Debtors Ledger",
        path: "/pos/reports/debtors-ledger",
        actions: [
          { label: "View", path: "/pos/reports/debtors-ledger", type: "outline" },
        ],
        description: "Customer account statement with running debit/credit balance",
        icon: "📗",
      },
      {
        name: "Outstanding Receivables",
        path: "/pos/reports/outstanding-receivables",
        actions: [
          { label: "View", path: "/pos/reports/outstanding-receivables", type: "outline" },
        ],
        description: "Overdue and upcoming customer payment aging",
        icon: "📆",
      },
      {
        name: "Voucher Register",
        path: "/pos/reports/voucher-register",
        actions: [
          { label: "View", path: "/pos/reports/voucher-register", type: "outline" },
        ],
        description: "Log of all payments, receipts, and contra vouchers",
        icon: "📋",
      },
      {
        name: "Supplier Outstanding",
        path: "/pos/reports/supplier-outstanding",
        actions: [
          { label: "View", path: "/pos/reports/supplier-outstanding", type: "outline" },
        ],
        description: "Outstanding debts owed to direct store suppliers",
        icon: "🤝",
      },
      {
        name: "Purchase Register",
        path: "/pos/reports/purchase-register",
        actions: [
          { label: "View", path: "/pos/reports/purchase-register", type: "outline" },
        ],
        description: "Log of direct purchases recorded at the store",
        icon: "🧾",
      },
      {
        name: "Item Purchase History",
        path: "/pos/reports/item-purchase-history",
        actions: [
          { label: "View", path: "/pos/reports/item-purchase-history", type: "outline" },
        ],
        description: "Cost trends, purchase prices, and supplier history per item",
        icon: "🔍",
      },
      {
        name: "Purchase Returns Analysis",
        path: "/pos/reports/purchase-returns",
        actions: [
          { label: "View", path: "/pos/reports/purchase-returns", type: "outline" },
        ],
        description: "Analysis of items returned to suppliers",
        icon: "🔙",
      },
      {
        name: "Price Variance",
        path: "/pos/reports/price-variance",
        actions: [
          { label: "View", path: "/pos/reports/price-variance", type: "outline" },
        ],
        description: "Direct purchase cost variance vs. standard valuation",
        icon: "🏷️",
      },
      {
        name: "Stock Balances Report",
        path: "/pos/reports/stock-balances",
        actions: [
          { label: "View", path: "/pos/reports/stock-balances", type: "outline" },
        ],
        description: "Current stock quantities across all store locations",
        icon: "⚖️",
      },
      {
        name: "Fast Moving Items",
        path: "/pos/reports/fast-moving",
        actions: [
          { label: "View", path: "/pos/reports/fast-moving", type: "outline" },
        ],
        description: "Top volume products to keep well-stocked",
        icon: "⚡",
      },
      {
        name: "Slow Moving Items",
        path: "/pos/reports/slow-moving",
        actions: [
          { label: "View", path: "/pos/reports/slow-moving", type: "outline" },
        ],
        description: "Low velocity stock for discount promotions or bundling",
        icon: "🐢",
      },
      {
        name: "Expired Items",
        path: "/pos/reports/expired-items",
        actions: [
          { label: "View", path: "/pos/reports/expired-items", type: "outline" },
        ],
        description: "Expired or near-expiry items to remove from shelves",
        icon: "⚠️",
      },
      {
        name: "Stock Adjustment Report",
        path: "/pos/reports/stock-adjustments",
        actions: [
          { label: "View", path: "/pos/reports/stock-adjustments", type: "outline" },
        ],
        description: "Audit trail of inventory write-offs and quantity corrections",
        icon: "📝",
      },
      {
        name: "Stock Transfer Register",
        path: "/pos/reports/stock-transfers",
        actions: [
          { label: "View", path: "/pos/reports/stock-transfers", type: "outline" },
        ],
        description: "Log of goods dispatched and received between branches",
        icon: "🚚",
      },
      {
        name: "Sync Reconciliation",
        path: "/pos/reconciliation",
        actions: [
          { label: "View", path: "/pos/reconciliation", type: "outline" },
          { label: "New", path: "/pos/reconciliation/new", type: "primary" },
        ],
        description: "Manage offline sales that haven't synced to server",
        icon: "🔄",
      },
    ],
  },
  {
    icon: "⚙️",
    title: "Setup",
    features: [
      {
        name: "POS Setup",
        path: "/pos/setup",
        actions: [{ label: "View", path: "/pos/setup", type: "outline" }],
        description: "Configure terminals, shifts, payment methods, and hardware",
        icon: "⚙️",
      },
    ],
  },
];

/**
 * PosSyncStatus component
 * Displays an offline/online indicator and the number of pending/failed POS transactions in the sync queue.
 * 
 * @returns {JSX.Element|null} The status banner or null if online with no pending queue.
 */
function PosSyncStatus() {
  const { pending, failed, items } = useOfflineQueue();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  const posItems = useMemo(
    () => (items || []).filter((i) => String(i.url || "").includes("/pos/")),
    [items],
  );
  const posPending = useMemo(
    () => posItems.filter((i) => i.status === "pending").length,
    [posItems],
  );
  const posFailed = useMemo(
    () => posItems.filter((i) => i.status === "failed").length,
    [posItems],
  );
  if (online && posPending === 0 && posFailed === 0) return null;
  return (
    <div
      className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
        online ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <span>{online ? "\u26A0\uFE0F" : "\uD83D\uDD34"}</span>
        <span>
          {online
            ? `${posPending} item${posPending !== 1 ? "s" : ""} pending sync`
            : "You are offline — sales saved locally, will sync when reconnected"}
        </span>
        {posFailed > 0 && (
          <span className="font-semibold text-red-600">({posFailed} failed)</span>
        )}
      </div>
      {(posFailed > 0 || posPending > 0) && (
        <Link
          to="/pos/reconciliation"
          className="text-brand hover:text-brand-600 text-xs font-medium underline"
        >
          View Sync Queue
        </Link>
      )}
    </div>
  );
}

/**
 * LoadingFallback component for lazy-loaded routes
 */
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[300px] p-6 text-sm text-slate-500">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  );
}

/**
 * PosHome component
 * Root router for the self-contained Point of Sale module.
 * 
 * @returns {JSX.Element} The nested routes for the POS module.
 */
export default function PosHome() {
  useEffect(() => {
    preloadPosData();
  }, []);

  return (
    <ModuleLayout sections={posSections} moduleKey="pos">
      <React.Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<PosLanding />} />

          {/* Core POS Sales Entry routes and aliases */}
          <Route path="/sales-entry" element={<PosSalesEntry />} />
          <Route path="/sales-entry/new" element={<PosSalesEntry />} />
          <Route path="/sales-entry/:id" element={<PosSalesEntry />} />
          <Route path="/sales-entry/*" element={<PosSalesEntry />} />
          <Route path="/sales" element={<PosSalesEntry />} />
          <Route path="/sales/new" element={<PosSalesEntry />} />
          <Route path="/sales/:id" element={<PosSalesEntry />} />
          <Route path="/sales/*" element={<PosSalesEntry />} />
          <Route path="/entry" element={<PosSalesEntry />} />
          <Route path="/entry/new" element={<PosSalesEntry />} />
          <Route path="/entry/*" element={<PosSalesEntry />} />

          {/* Core POS Operations */}
          <Route path="/returns" element={<PosReturnForm />} />
          <Route path="/returns/new" element={<PosReturnForm />} />
          <Route path="/returns/:id" element={<PosReturnForm />} />
          <Route path="/register" element={<PosRegister />} />
          <Route path="/register/new" element={<PosRegister />} />
          <Route path="/cash-collection" element={<CashCollectionDetails />} />
          <Route path="/cash-collection/new" element={<CashCollectionDetails />} />
          <Route path="/invoices" element={<PosInvoiceList />} />
          <Route path="/invoices/new" element={<PosInvoiceList />} />
          <Route path="/receipt-reprint" element={<PosInvoiceList />} />
          <Route path="/post-to-finance" element={<PosPostToFinance />} />
          <Route path="/post-to-finance/new" element={<PosPostToFinance />} />
          <Route path="/day-management" element={<PosDayManagement />} />
          <Route path="/day-management/new" element={<PosDayManagement />} />
          <Route path="/day" element={<PosDayManagement />} />
          <Route path="/day/new" element={<PosDayManagement />} />
          <Route path="/holds" element={<PosOnHold />} />
          <Route path="/holds/new" element={<PosOnHold />} />
          <Route path="/setup" element={<PosSetup />} />
          <Route path="/setup/*" element={<PosSetup />} />
          <Route path="/dashboard" element={<PosDashboard />} />
          <Route path="/reconciliation" element={<PosReconciliation />} />
          <Route path="/reconciliation/new" element={<PosReconciliation />} />
          <Route path="/customer-history" element={<PosCustomerHistory />} />
          <Route path="/customer-history/new" element={<PosCustomerHistory />} />

          {/* Procurement: Direct Purchases */}
          <Route path="/direct-purchases" element={<DirectPurchaseList />} />
          <Route path="/direct-purchases/new" element={<DirectPurchase />} />
          <Route path="/direct-purchases/:id" element={<DirectPurchase />} />
          <Route path="/direct-purchase" element={<DirectPurchaseList />} />
          <Route path="/direct-purchase/new" element={<DirectPurchase />} />
          <Route path="/direct-purchase/:id" element={<DirectPurchase />} />

          {/* Store Inventory Operations */}
          <Route path="/inventory/items" element={<ItemsList />} />
          <Route path="/inventory/items/new" element={<ItemForm />} />
          <Route path="/inventory/items/:id" element={<ItemForm />} />
          <Route path="/items" element={<ItemsList />} />
          <Route path="/items/new" element={<ItemForm />} />
          <Route path="/items/:id" element={<ItemForm />} />
          <Route path="/stock-transfers" element={<StockTransferList />} />
          <Route path="/stock-transfers/new" element={<StockTransferForm />} />
          <Route path="/stock-transfers/:id" element={<StockTransferForm />} />
          <Route path="/transfer-acceptance" element={<TransferAcceptanceList />} />
          <Route path="/transfer-acceptance/:id" element={<TransferAcceptanceForm />} />
          <Route path="/stock-balances" element={<StockBalancesPage />} />
          <Route path="/stock-reorder" element={<StockReorderPage />} />
          <Route path="/inventory/item-groups" element={<ItemGroupsList />} />
          <Route path="/inventory/item-groups/new" element={<ItemGroupForm />} />
          <Route path="/inventory/item-groups/:id" element={<ItemGroupForm />} />
          <Route path="/inventory/item-classification" element={<ItemGroupsList />} />
          <Route path="/inventory/item-classification/new" element={<ItemGroupForm />} />
          <Route path="/inventory/item-classification/:id" element={<ItemGroupForm />} />
          <Route path="/item-classification" element={<ItemGroupsList />} />
          <Route path="/item-classification/new" element={<ItemGroupForm />} />
          <Route path="/item-classification/:id" element={<ItemGroupForm />} />
          <Route path="/inventory/stock-balances" element={<StockBalancesPage />} />
          <Route path="/inventory/stock-transfers" element={<StockTransferList />} />
          <Route path="/inventory/stock-transfers/new" element={<StockTransferForm />} />
          <Route path="/inventory/stock-transfers/:id" element={<StockTransferForm />} />
          <Route path="/inventory/transfer-acceptance" element={<TransferAcceptanceList />} />
          <Route path="/inventory/transfer-acceptance/:id" element={<TransferAcceptanceForm />} />
          <Route path="/inventory/stock-adjustments" element={<StockAdjustmentList />} />
          <Route path="/inventory/stock-adjustments/new" element={<StockAdjustmentForm />} />
          <Route path="/inventory/stock-adjustments/:id" element={<StockAdjustmentForm />} />
          <Route path="/stock-adjustments" element={<StockAdjustmentList />} />
          <Route path="/stock-adjustments/new" element={<StockAdjustmentForm />} />
          <Route path="/stock-adjustments/:id" element={<StockAdjustmentForm />} />
          <Route path="/stock-adjustment" element={<StockAdjustmentList />} />
          <Route path="/stock-adjustment/new" element={<StockAdjustmentForm />} />
          <Route path="/stock-adjustment/:id" element={<StockAdjustmentForm />} />
          <Route path="/inventory/stock-reorder" element={<StockReorderPage />} />
          <Route path="/inventory/batches" element={<ItemBatchesList />} />

          {/* Finance & Vouchers */}
          <Route path="/finance/payment-voucher" element={<PaymentVoucherList />} />
          <Route path="/finance/payment-voucher/create" element={<PaymentVoucherForm />} />
          <Route path="/finance/payment-voucher/edit/:id" element={<PaymentVoucherForm />} />
          <Route path="/finance/payment-voucher/:id" element={<PaymentVoucherForm />} />
          <Route path="/finance/receipt-voucher" element={<ReceiptVoucherList />} />
          <Route path="/finance/receipt-voucher/create" element={<ReceiptVoucherForm />} />
          <Route path="/finance/receipt-voucher/edit/:id" element={<ReceiptVoucherForm />} />
          <Route path="/finance/receipt-voucher/:id" element={<ReceiptVoucherForm />} />
          <Route path="/finance/contra-voucher" element={<ContraVoucherList />} />
          <Route path="/finance/contra-voucher/create" element={<ContraVoucherForm />} />
          <Route path="/finance/contra-voucher/edit/:id" element={<ContraVoucherForm />} />
          <Route path="/finance/contra-voucher/:id" element={<ContraVoucherForm />} />
          {/* Customers */}
          <Route path="/customers" element={<PosCustomerList />} />
          <Route path="/customers/new" element={<PosCustomerForm />} />
          <Route path="/customers/:id" element={<PosCustomerForm />} />

          {/* Suppliers */}
          <Route path="/suppliers" element={<PosSuppliersList />} />
          <Route path="/suppliers/new" element={<PosSupplierForm />} />
          <Route path="/suppliers/:id" element={<PosSupplierForm />} />

          {/* Non-prefixed aliases for finance vouchers within POS */}
          <Route path="/payment-voucher" element={<PaymentVoucherList />} />
          <Route path="/payment-voucher/create" element={<PaymentVoucherForm />} />
          <Route path="/payment-voucher/edit/:id" element={<PaymentVoucherForm />} />
          <Route path="/payment-voucher/:id" element={<PaymentVoucherForm />} />
          <Route path="/receipt-voucher" element={<ReceiptVoucherList />} />
          <Route path="/receipt-voucher/create" element={<ReceiptVoucherForm />} />
          <Route path="/receipt-voucher/edit/:id" element={<ReceiptVoucherForm />} />
          <Route path="/receipt-voucher/:id" element={<ReceiptVoucherForm />} />
          <Route path="/contra-voucher" element={<ContraVoucherList />} />
          <Route path="/contra-voucher/create" element={<ContraVoucherForm />} />
          <Route path="/contra-voucher/edit/:id" element={<ContraVoucherForm />} />
          <Route path="/contra-voucher/:id" element={<ContraVoucherForm />} />

          {/* Reports & Analytics */}
          <Route path="/reports" element={<PosReports />} />
          <Route path="/reports/*" element={<PosReports />} />
          <Route path="/reports/profit-and-loss" element={<ProfitAndLossReportPage />} />
          <Route path="/reports/customer-outstanding" element={<CustomerOutstandingReportPage />} />
          <Route path="/reports/debtors-ledger" element={<DebtorsLedgerReportPage />} />
          <Route path="/reports/outstanding-receivables" element={<OutstandingReceivableReportPage />} />
          <Route path="/reports/voucher-register" element={<VoucherRegisterReportPage />} />
          <Route path="/reports/supplier-outstanding" element={<SupplierOutstandingReportPage />} />
          <Route path="/reports/purchase-register" element={<PurchaseRegisterReportPage />} />
          <Route path="/reports/item-purchase-history" element={<ItemPurchaseHistoryReportPage />} />
          <Route path="/reports/supplier-payables" element={<SupplierOutstandingPayablesReportPage />} />
          <Route path="/reports/purchase-returns" element={<PurchaseReturnsAnalysisReportPage />} />
          <Route path="/reports/price-variance" element={<PriceVarianceReportPage />} />
          <Route path="/reports/stock-balances" element={<StockBalancesReportPage />} />
          <Route path="/reports/fast-moving" element={<FastMovingReportPage />} />
          <Route path="/reports/slow-moving" element={<SlowMovingReportPage />} />
          <Route path="/reports/expired-items" element={<ExpiredItemsReportPage />} />
          <Route path="/reports/stock-adjustments" element={<StockAdjustmentReportPage />} />
          <Route path="/reports/stock-transfers" element={<StockTransferRegisterReportPage />} />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </React.Suspense>
    </ModuleLayout>
  );
}

/**
 * Feature registry items for POS module search and overview.
 */
export const posFeatures = [
  // Transactions
  {
    module_key: "pos",
    label: "Sales Entry",
    path: "/pos/sales-entry",
    actions: [
      { label: "View", path: "/pos/sales-entry", type: "outline" },
      { label: "New", path: "/pos/sales-entry/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Start/End Business Day",
    path: "/pos/day-management",
    actions: [
      { label: "View", path: "/pos/day-management", type: "outline" },
      { label: "New", path: "/pos/day-management/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Cash Collection",
    path: "/pos/cash-collection",
    actions: [
      { label: "View", path: "/pos/cash-collection", type: "outline" },
      { label: "New", path: "/pos/cash-collection/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "POS Invoices",
    path: "/pos/invoices",
    actions: [
      { label: "View", path: "/pos/invoices", type: "outline" },
      { label: "New", path: "/pos/invoices/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Post to Finance",
    path: "/pos/post-to-finance",
    actions: [
      { label: "View", path: "/pos/post-to-finance", type: "outline" },
      { label: "New", path: "/pos/post-to-finance/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "POS Returns",
    path: "/pos/returns",
    actions: [
      { label: "View", path: "/pos/returns", type: "outline" },
      { label: "New", path: "/pos/returns/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "POS Register",
    path: "/pos/register",
    actions: [
      { label: "View", path: "/pos/register", type: "outline" },
      { label: "New", path: "/pos/register/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "On-Hold Sales",
    path: "/pos/holds",
    actions: [
      { label: "View", path: "/pos/holds", type: "outline" },
      { label: "New", path: "/pos/holds/new", type: "primary" },
    ],
    type: "feature",
  },

  // Procurement
  {
    module_key: "pos",
    label: "Direct Purchases",
    path: "/pos/direct-purchases",
    actions: [
      { label: "View", path: "/pos/direct-purchases", type: "outline" },
      { label: "New", path: "/pos/direct-purchases/new", type: "primary" },
    ],
    type: "feature",
  },

  // Inventory
  {
    module_key: "pos",
    label: "Items Master",
    path: "/pos/items",
    actions: [
      { label: "View", path: "/pos/items", type: "outline" },
      { label: "New", path: "/pos/items/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Item Classification",
    path: "/pos/inventory/item-groups",
    actions: [
      { label: "View", path: "/pos/inventory/item-groups", type: "outline" },
      { label: "New", path: "/pos/inventory/item-groups/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Stock Balances",
    path: "/pos/inventory/stock-balances",
    actions: [
      { label: "View", path: "/pos/inventory/stock-balances", type: "outline" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Stock Transfers",
    path: "/pos/inventory/stock-transfers",
    actions: [
      { label: "View", path: "/pos/inventory/stock-transfers", type: "outline" },
      { label: "New", path: "/pos/inventory/stock-transfers/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Transfer Acceptance",
    path: "/pos/inventory/transfer-acceptance",
    actions: [
      { label: "View", path: "/pos/inventory/transfer-acceptance", type: "outline" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Stock Adjustments",
    path: "/pos/stock-adjustments",
    actions: [
      { label: "View", path: "/pos/stock-adjustments", type: "outline" },
      { label: "New", path: "/pos/stock-adjustments/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Stock Reorder",
    path: "/pos/inventory/stock-reorder",
    actions: [
      { label: "View", path: "/pos/inventory/stock-reorder", type: "outline" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Item Batches",
    path: "/pos/inventory/batches",
    actions: [
      { label: "View", path: "/pos/inventory/batches", type: "outline" },
    ],
    type: "feature",
  },

  // Finance Vouchers
  {
    module_key: "pos",
    label: "Make Payment (Petty Cash)",
    path: "/pos/finance/payment-voucher",
    actions: [
      { label: "View", path: "/pos/finance/payment-voucher", type: "outline" },
      { label: "New", path: "/pos/finance/payment-voucher/create", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Receive Payment (Debt Collection)",
    path: "/pos/finance/receipt-voucher",
    actions: [
      { label: "View", path: "/pos/finance/receipt-voucher", type: "outline" },
      { label: "New", path: "/pos/finance/receipt-voucher/create", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Bank Deposit (Contra)",
    path: "/pos/finance/contra-voucher",
    actions: [
      { label: "View", path: "/pos/finance/contra-voucher", type: "outline" },
      { label: "New", path: "/pos/finance/contra-voucher/create", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Customers",
    path: "/pos/customers",
    actions: [
      { label: "View", path: "/pos/customers", type: "outline" },
      { label: "New", path: "/pos/customers/new", type: "primary" },
    ],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Suppliers",
    path: "/pos/suppliers",
    actions: [
      { label: "View", path: "/pos/suppliers", type: "outline" },
      { label: "New", path: "/pos/suppliers/new", type: "primary" },
    ],
    type: "feature",
  },

  // Setup & Reconciliation
  {
    module_key: "pos",
    label: "POS Setup",
    path: "/pos/setup",
    actions: [{ label: "View", path: "/pos/setup", type: "outline" }],
    type: "feature",
  },
  {
    module_key: "pos",
    label: "Sync Reconciliation",
    path: "/pos/reconciliation",
    actions: [
      { label: "View", path: "/pos/reconciliation", type: "outline" },
      { label: "New", path: "/pos/reconciliation/new", type: "primary" },
    ],
    type: "feature",
  },

  // Reports
  {
    module_key: "pos",
    label: "Profit and Loss Report",
    path: "/pos/reports/profit-and-loss",
    actions: [
      { label: "View", path: "/pos/reports/profit-and-loss", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "POS Reports",
    path: "/pos/reports",
    actions: [{ label: "View", path: "/pos/reports", type: "outline" }],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Dashboard",
    path: "/pos/dashboard",
    actions: [{ label: "View", path: "/pos/dashboard", type: "outline" }],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Customer Accounts",
    path: "/pos/customer-history",
    actions: [
      { label: "View", path: "/pos/customer-history", type: "outline" },
      { label: "New", path: "/pos/customer-history/new", type: "primary" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Customer Outstanding",
    path: "/pos/reports/customer-outstanding",
    actions: [
      { label: "View", path: "/pos/reports/customer-outstanding", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Debtors Ledger",
    path: "/pos/reports/debtors-ledger",
    actions: [
      { label: "View", path: "/pos/reports/debtors-ledger", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Outstanding Receivables",
    path: "/pos/reports/outstanding-receivables",
    actions: [
      { label: "View", path: "/pos/reports/outstanding-receivables", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Voucher Register",
    path: "/pos/reports/voucher-register",
    actions: [
      { label: "View", path: "/pos/reports/voucher-register", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Supplier Outstanding",
    path: "/pos/reports/supplier-outstanding",
    actions: [
      { label: "View", path: "/pos/reports/supplier-outstanding", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Purchase Register",
    path: "/pos/reports/purchase-register",
    actions: [
      { label: "View", path: "/pos/reports/purchase-register", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Item Purchase History",
    path: "/pos/reports/item-purchase-history",
    actions: [
      { label: "View", path: "/pos/reports/item-purchase-history", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Purchase Returns Analysis",
    path: "/pos/reports/purchase-returns",
    actions: [
      { label: "View", path: "/pos/reports/purchase-returns", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Price Variance",
    path: "/pos/reports/price-variance",
    actions: [
      { label: "View", path: "/pos/reports/price-variance", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Stock Balances Report",
    path: "/pos/reports/stock-balances",
    actions: [
      { label: "View", path: "/pos/reports/stock-balances", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Fast Moving Items",
    path: "/pos/reports/fast-moving",
    actions: [
      { label: "View", path: "/pos/reports/fast-moving", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Slow Moving Items",
    path: "/pos/reports/slow-moving",
    actions: [
      { label: "View", path: "/pos/reports/slow-moving", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Expired Items",
    path: "/pos/reports/expired-items",
    actions: [
      { label: "View", path: "/pos/reports/expired-items", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Stock Adjustment Report",
    path: "/pos/reports/stock-adjustments",
    actions: [
      { label: "View", path: "/pos/reports/stock-adjustments", type: "outline" },
    ],
    type: "dashboard",
  },
  {
    module_key: "pos",
    label: "Stock Transfer Register",
    path: "/pos/reports/stock-transfers",
    actions: [
      { label: "View", path: "/pos/reports/stock-transfers", type: "outline" },
    ],
    type: "dashboard",
  },
];
