/**
 * @fileoverview PosHome module routing and dashboard landing page.
 * Handles POS analytics overview, offline sync status, and routing for POS operations.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";

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

/**
 * PosLanding component
 * Displays the main Point of Sale dashboard, including daily statistics and module navigation.
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
        actions: [
          { label: "View", path: "/pos/reports", type: "outline" }
        ],
    },
    {
      rbac_key: "total-customers",
      icon: "👥",
      value: String(overview?.totalCustomers ?? 0),
      label: "Total Customers",
      path: "/sales/customers",
        actions: [
          { label: "View", path: "/sales/customers", type: "outline" },
          { label: "New", path: "/sales/customers/new", type: "primary" }
        ],
    },
    {
      rbac_key: "average-order",
      icon: "🧾",
      value: fmt(overview?.averageOrder || 0),
      label: "Average Order",
      path: "/pos/reports",
        actions: [
          { label: "View", path: "/pos/reports", type: "outline" }
        ],
    },
    {
      rbac_key: "monthly-revenue",
      icon: "📊",
      value: fmt(overview?.monthlyRevenue || 0),
      label: "Monthly Revenue",
      path: "/finance/reports",
        actions: [
          { label: "View", path: "/finance/reports", type: "outline" }
        ],
    },
  ];

  return (
    <div className="space-y-6">
      <PosSyncStatus />
      <ModuleDashboard
      useSectionNavigation={true}
        title="Point of Sale (POS)"
        description="Retail sales, register operations, and day management"
        stats={stats}
        headerActions={[
          { label: "Dashboard", path: "/pos/dashboard",
        actions: [
          { label: "View", path: "/pos/dashboard", type: "outline" }
        ], icon: "📊" },
        ]}
        sections={posSections}
        features={posFeatures}
      />
    </div>
  );
}

export const posSections = [
  {
    icon: "💳",
    title: "Transactions",
    features: [
      {
        name: "Sales Entry",
        path: "/pos/sales-entry",
        actions: [
          { label: "View", path: "/pos/sales-entry", type: "outline" },
          { label: "New", path: "/pos/sales-entry/new", type: "primary" }
        ],
        description: "Quick sales entry",
        icon: "🛒",
      },
      {
        name: "Start/End Business Day",
        path: "/pos/day-management",
        actions: [
          { label: "View", path: "/pos/day-management", type: "outline" },
          { label: "New", path: "/pos/day-management/new", type: "primary" }
        ],
        description: "Open/close POS business day and reconciliation",
        icon: "📅",
      },
      {
        name: "Cash Collection",
        path: "/pos/cash-collection",
        actions: [
          { label: "View", path: "/pos/cash-collection", type: "outline" },
          { label: "New", path: "/pos/cash-collection/new", type: "primary" }
        ],
        description: "View and record cash collected per session",
        icon: "💵",
      },
      {
        name: "POS Invoices",
        path: "/pos/invoices",
        actions: [
          { label: "View", path: "/pos/invoices", type: "outline" },
          { label: "New", path: "/pos/invoices/new", type: "primary" }
        ],
        description: "View and reprint invoices",
        icon: "📜",
      },
      {
        name: "Post to Finance",
        path: "/pos/post-to-finance",
        actions: [
          { label: "View", path: "/pos/post-to-finance", type: "outline" },
          { label: "New", path: "/pos/post-to-finance/new", type: "primary" }
        ],
        description: "Post aggregated POS sales to G/L",
        icon: "📤",
      },
      {
        name: "POS Returns",
        path: "/pos/returns",
        actions: [
          { label: "View", path: "/pos/returns", type: "outline" },
          { label: "New", path: "/pos/returns/new", type: "primary" }
        ],
        description: "Process sales returns and refunds",
        icon: "↩️",
      },
      {
        name: "POS Register",
        path: "/pos/register",
        actions: [
          { label: "View", path: "/pos/register", type: "outline" },
          { label: "New", path: "/pos/register/new", type: "primary" }
        ],
        description: "Transactions listing and details",
        icon: "📒",
      },
      {
        name: "On-Hold Sales",
        path: "/pos/holds",
        actions: [
          { label: "View", path: "/pos/holds", type: "outline" },
          { label: "New", path: "/pos/holds/new", type: "primary" }
        ],
        description: "Complete held (draft) sales",
        icon: "⏸️",
      },
    ],
  },
  {
    title: "Setup",
    features: [
      {
        name: "POS Setup",
        path: "/pos/setup",
        actions: [
          { label: "View", path: "/pos/setup", type: "outline" }
        ],
        description: "Configure terminals, shifts, payments, and settings",
        icon: "⚙️",
      },
    ],
  },
  {
    title: "Reports",
    features: [
      {
        name: "POS Reports",
        path: "/pos/reports",
        actions: [
          { label: "View", path: "/pos/reports", type: "outline" }
        ],
        description: "Daily sales and performance reports",
        icon: "📊",
      },
      {
        name: "Dashboard",
        path: "/pos/dashboard",
        actions: [
          { label: "View", path: "/pos/dashboard", type: "outline" }
        ],
        description: "Charts and analytics for POS",
        icon: "📈",
      },
      {
        name: "Customer Accounts",
        path: "/pos/customer-history",
        actions: [
          { label: "View", path: "/pos/customer-history", type: "outline" },
          { label: "New", path: "/pos/customer-history/new", type: "primary" }
        ],
        description: "View customer transactions and balances",
        icon: "📋",
      },
      {
        name: "Sync Reconciliation",
        path: "/pos/reconciliation",
        actions: [
          { label: "View", path: "/pos/reconciliation", type: "outline" },
          { label: "New", path: "/pos/reconciliation/new", type: "primary" }
        ],
        description: "Manage offline sales that haven't synced",
        icon: "🔄",
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
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const posItems = useMemo(() => (items || []).filter((i) => String(i.url || "").includes("/pos/")), [items]);
  const posPending = useMemo(() => posItems.filter((i) => i.status === "pending").length, [posItems]);
  const posFailed = useMemo(() => posItems.filter((i) => i.status === "failed").length, [posItems]);
  if (online && posPending === 0 && posFailed === 0) return null;
  return (
    <div className={`p-3 rounded-lg border text-sm flex items-center justify-between ${online ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
      <div className="flex items-center gap-2">
        <span>{online ? "\u26A0\uFE0F" : "\uD83D\uDD34"}</span>
        <span>
          {online
            ? `${posPending} item${posPending !== 1 ? "s" : ""} pending sync`
            : "You are offline — sales saved locally, will sync when reconnected"}
        </span>
        {posFailed > 0 && <span className="font-semibold text-red-600">({posFailed} failed)</span>}
      </div>
      {(posFailed > 0 || posPending > 0) && (
        <Link to="/pos/reconciliation" className="text-brand hover:text-brand-600 text-xs font-medium underline">View Sync Queue</Link>
      )}
    </div>
  );
}

/**
 * PosHome component
 * Root router for the Point of Sale module. Maps URL paths to specific POS components.
 * Also preloads POS data on mount for offline support.
 * 
 * @returns {JSX.Element} The nested routes for the POS module.
 */
export default function PosHome() {
  useEffect(() => { preloadPosData(); }, []);
  return (
    <ModuleLayout sections={posSections} moduleKey="pos">
      <Routes>
        <Route path="/" element={<PosLanding />} />

        <Route path="/returns" element={<PosReturnForm />} />
        <Route path="/returns/new" element={<PosReturnForm />} />
        <Route path="/register" element={<PosRegister />} />
        <Route path="/sales-entry" element={<PosSalesEntry />} />
        <Route path="/cash-collection" element={<CashCollectionDetails />} />
        <Route path="/invoices" element={<PosInvoiceList />} />
        <Route path="/post-to-finance" element={<PosPostToFinance />} />
        <Route path="/day-management" element={<PosDayManagement />} />
        <Route path="/day" element={<PosDayManagement />} />

        <Route path="/reports" element={<PosReports />} />
        <Route path="/customer-history" element={<PosCustomerHistory />} />
        <Route path="/holds" element={<PosOnHold />} />
        <Route path="/setup" element={<PosSetup />} />
        <Route path="/dashboard" element={<PosDashboard />} />
        <Route path="/reconciliation" element={<PosReconciliation />} />
      </Routes>
    </ModuleLayout>
  );
}

export const posFeatures = [
  { module_key: "pos", label: "Sales Entry", path: "/pos/sales-entry",
        actions: [
          { label: "View", path: "/pos/sales-entry", type: "outline" },
          { label: "New", path: "/pos/sales-entry/new", type: "primary" }
        ], type: "feature" },
  { module_key: "pos", label: "Start/End Business Day", path: "/pos/day-management",
        actions: [
          { label: "View", path: "/pos/day-management", type: "outline" },
          { label: "New", path: "/pos/day-management/new", type: "primary" }
        ], type: "feature" },
  { module_key: "pos", label: "Cash Collection", path: "/pos/cash-collection",
        actions: [
          { label: "View", path: "/pos/cash-collection", type: "outline" },
          { label: "New", path: "/pos/cash-collection/new", type: "primary" }
        ], type: "feature" },
  { module_key: "pos", label: "POS Invoices", path: "/pos/invoices",
        actions: [
          { label: "View", path: "/pos/invoices", type: "outline" },
          { label: "New", path: "/pos/invoices/new", type: "primary" }
        ], type: "feature" },
  { module_key: "pos", label: "Post to Finance", path: "/pos/post-to-finance",
        actions: [
          { label: "View", path: "/pos/post-to-finance", type: "outline" },
          { label: "New", path: "/pos/post-to-finance/new", type: "primary" }
        ], type: "feature" },
  { module_key: "pos", label: "POS Returns", path: "/pos/returns",
        actions: [
          { label: "View", path: "/pos/returns", type: "outline" },
          { label: "New", path: "/pos/returns/new", type: "primary" }
        ], type: "feature" },
  { module_key: "pos", label: "POS Register", path: "/pos/register",
        actions: [
          { label: "View", path: "/pos/register", type: "outline" },
          { label: "New", path: "/pos/register/new", type: "primary" }
        ], type: "feature" },
  { module_key: "pos", label: "On-Hold Sales", path: "/pos/holds",
        actions: [
          { label: "View", path: "/pos/holds", type: "outline" },
          { label: "New", path: "/pos/holds/new", type: "primary" }
        ], type: "feature" },
  { module_key: "pos", label: "POS Setup", path: "/pos/setup",
        actions: [
          { label: "View", path: "/pos/setup", type: "outline" }
        ], type: "feature" },
  { module_key: "pos", label: "Sync Reconciliation", path: "/pos/reconciliation",
        actions: [
          { label: "View", path: "/pos/reconciliation", type: "outline" },
          { label: "New", path: "/pos/reconciliation/new", type: "primary" }
        ], type: "feature" },
  { module_key: "pos", label: "POS Reports", path: "/pos/reports",
        actions: [
          { label: "View", path: "/pos/reports", type: "outline" }
        ], type: "dashboard" },
  { module_key: "pos", label: "Dashboard", path: "/pos/dashboard",
        actions: [
          { label: "View", path: "/pos/dashboard", type: "outline" }
        ], type: "dashboard" },
  { module_key: "pos", label: "Customer Accounts", path: "/pos/customer-history",
        actions: [
          { label: "View", path: "/pos/customer-history", type: "outline" },
          { label: "New", path: "/pos/customer-history/new", type: "primary" }
        ], type: "dashboard" },
];
