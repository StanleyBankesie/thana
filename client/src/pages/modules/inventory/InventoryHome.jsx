/**
 * @fileoverview InventoryHome component.
 * Provides functionality for InventoryHome.
 */

import React from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";

import StockAdjustmentList from "./StockAdjustmentList.jsx";
import StockAdjustmentForm from "./StockAdjustmentForm.jsx";
import StockTransferList from "./StockTransferList.jsx";
import StockTransferForm from "./StockTransferForm.jsx";
import MaterialRequisitionList from "./MaterialRequisitionList.jsx";
import MaterialRequisitionForm from "./MaterialRequisitionForm.jsx";
import ItemsList from "./ItemsList.jsx";
import ItemForm from "./ItemForm.jsx";
import WarehousesList from "./WarehousesList.jsx";
import WarehouseForm from "./WarehouseForm.jsx";
import GRNLocalList from "./GRNLocalList.jsx";
import GRNLocalForm from "./GRNLocalForm.jsx";
import GRNImportList from "./GRNImportList.jsx";
import GRNImportForm from "./GRNImportForm.jsx";
import TransferAcceptanceList from "./TransferAcceptanceList.jsx";
import TransferAcceptanceForm from "./TransferAcceptanceForm.jsx";
import StockTakeList from "./StockTakeList.jsx";
import StockTakeForm from "./StockTakeForm.jsx";
import DailyStockTakeList from "./DailyStockTakeList.jsx";
import DailyStockTakeForm from "./DailyStockTakeForm.jsx";
import PhysicalStockTakeList from "./PhysicalStockTakeList.jsx";
import PhysicalStockTakeForm from "./PhysicalStockTakeForm.jsx";
import ItemGroupsList from "./ItemGroupsList.jsx";
import ItemGroupForm from "./ItemGroupForm.jsx";
import UnitConversionsList from "./UnitConversionsList.jsx";
import ItemBatchesList from "./ItemBatchesList.jsx";

import StockUpdationList from "./StockUpdationList.jsx";
import StockUpdationForm from "./StockUpdationForm.jsx";
import StockVerificationList from "./StockVerificationList.jsx";
import StockVerificationForm from "./StockVerificationForm.jsx";
import ReturnToStoresList from "./ReturnToStoresList.jsx";
import ReturnToStoresForm from "./ReturnToStoresForm.jsx";
import IssueToRequirementList from "./IssueToRequirementList.jsx";
import IssueToRequirementForm from "./IssueToRequirementForm.jsx";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import { api } from "../../../api/client.js";
import StockReorderPage from "./StockReorderPage.jsx";
import StockUploadPage from "./StockUploadPage.jsx";
import InventoryHealthMonitorPage from "./reports/InventoryHealthMonitorPage.jsx";
import PeriodicalStockSummaryPage from "./reports/PeriodicalStockSummaryPage.jsx";
import PeriodicalStockStatementPage from "./reports/PeriodicalStockStatementPage.jsx";
import IssueRegisterReportPage from "./reports/IssueRegisterReportPage.jsx";
import StockTransferRegisterReportPage from "./reports/StockTransferRegisterReportPage.jsx";
import StockVerificationReportPage from "./reports/StockVerificationReportPage.jsx";
import StockAgingAnalysisReportPage from "./reports/StockAgingAnalysisReportPage.jsx";
import SlowMovingReportPage from "./reports/SlowMovingReportPage.jsx";
import FastMovingReportPage from "./reports/FastMovingReportPage.jsx";
import NonMovingReportPage from "./reports/NonMovingReportPage.jsx";
import StockBalancesReportPage from "./reports/StockBalancesReportPage.jsx";
import StockValueReportPage from "./reports/StockValueReportPage.jsx";
import MaterialReturnReportPage from "./reports/MaterialReturnReportPage.jsx";
import StockAdjustmentReportPage from "./reports/StockAdjustmentReportPage.jsx";
import LowStockNotificationsPage from "./LowStockNotificationsPage.jsx";
import InventoryReportsPage from "./reports/InventoryReportsPage.jsx";
import StockBalancesPage from "./StockBalancesPage.jsx";
import StockJournalList from "./StockJournalList.jsx";
import StockJournalForm from "./StockJournalForm.jsx";
// Removed Sales Return from Inventory, and moved Purchase Return to Purchase module

function InventoryFeaturePage({ title, description }) {
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

export const inventorySections = [
  {
    title: "Stock Operations",
    features: [
      {
        name: "Stock Balances & Overview",
        path: "/inventory/stock",
        actions: [
          { label: "View Stock", path: "/inventory/stock", type: "primary" }
        ],
        description: "Live warehouse stock balances, valuation & ledger",
        icon: "📦",
      },
      {
        name: "Material Requisition",
        path: "/inventory/material-requisitions",
        actions: [
          { label: "View", path: "/inventory/material-requisitions", type: "outline" },
          { label: "New", path: "/inventory/material-requisitions/new", type: "primary" }
        ],
        description: "Request materials from warehouse",
        icon: "📝",
      },
      {
        name: "Stock Journal",
        path: "/inventory/stock-journal",
        actions: [
          { label: "View", path: "/inventory/stock-journal", type: "outline" },
          { label: "New", path: "/inventory/stock-journal/new", type: "primary" }
        ],
        description: "Register stock movements and consumption entries",
        icon: "📖",
      },
      {
        name: "Stock Transfers",
        path: "/inventory/stock-transfers",
        actions: [
          { label: "View", path: "/inventory/stock-transfers", type: "outline" },
          { label: "New", path: "/inventory/stock-transfers/new", type: "primary" }
        ],
        description: "Transfer stock between warehouses/branches",
        icon: "🔄",
      },
      {
        name: "Stock Adjustments",
        path: "/inventory/stock-adjustments",
        actions: [
          { label: "View", path: "/inventory/stock-adjustments", type: "outline" },
          { label: "New", path: "/inventory/stock-adjustments/new", type: "primary" }
        ],
        description: "Adjust stock levels manually",
        icon: "⚖️",
      },
      {
        name: "Physical Inventory (Stock Take)",
        path: "/inventory/physical-stock-take",
        actions: [
          { label: "View", path: "/inventory/physical-stock-take", type: "outline" },
          { label: "New", path: "/inventory/physical-stock-take/new", type: "primary" }
        ],
        description: "Formal comprehensive physical stock takes & audit controls",
        icon: "📋",
      },
      {
        name: "Daily Stock Take",
        path: "/inventory/daily-stock-take",
        actions: [
          { label: "View", path: "/inventory/daily-stock-take", type: "outline" },
          { label: "New", path: "/inventory/daily-stock-take/new", type: "primary" }
        ],
        description: "Routine daily operational verification & tolerance tracking",
        icon: "📅",
      },
      {
        name: "Stock Updation",
        path: "/inventory/stock-updation",
        actions: [
          { label: "View", path: "/inventory/stock-updation", type: "outline" },
          { label: "New", path: "/inventory/stock-updation/new", type: "primary" }
        ],
        description: "Fast-track stock increases",
        icon: "📈",
      },
      {
        name: "Stock Verification",
        path: "/inventory/stock-verification",
        actions: [
          { label: "View", path: "/inventory/stock-verification", type: "outline" },
          { label: "New", path: "/inventory/stock-verification/new", type: "primary" }
        ],
        description: "Verify physical stock levels",
        icon: "✅",
      },
      {
        name: "Stock Updation & Verification",
        path: "/inventory/stock-ops",
        actions: [
          { label: "View", path: "/inventory/stock-ops", type: "outline" },
          { label: "New", path: "/inventory/stock-ops/new", type: "primary" }
        ],
        description: "Manage stock adjustments and verifications",
        icon: "⚖️",
      },
      {
        name: "Return to Stores Advice",
        path: "/inventory/return-to-stores",
        actions: [
          { label: "View", path: "/inventory/return-to-stores", type: "outline" },
          { label: "New", path: "/inventory/return-to-stores/new", type: "primary" }
        ],
        description: "Process returned materials",
        icon: "🔙",
      },
      {
        name: "Issue to Requirement Area",
        path: "/inventory/issue-to-requirement",
        actions: [
          { label: "View", path: "/inventory/issue-to-requirement", type: "outline" },
          { label: "New", path: "/inventory/issue-to-requirement/new", type: "primary" }
        ],
        description: "Issue materials to specific areas",
        icon: "📤",
      },
      {
        name: "Transfer Acceptance",
        path: "/inventory/transfer-acceptance",
        actions: [
          { label: "View", path: "/inventory/transfer-acceptance", type: "outline" },
          { label: "New", path: "/inventory/transfer-acceptance/new", type: "primary" }
        ],
        description: "Accept incoming stock transfers",
        icon: "📥",
      },
      {
        name: "Stock Reorder",
        path: "/inventory/stock-reorder",
        actions: [
          { label: "View", path: "/inventory/stock-reorder", type: "outline" },
          { label: "New", path: "/inventory/stock-reorder/new", type: "primary" }
        ],
        description: "Generate stock reorder requests",
        icon: "🛒",
      },
    ],
  },
  {
    title: "Goods Receipt",
    features: [
      {
        name: "Material Receipt (GRN) - Local",
        path: "/inventory/grn-local",
        actions: [
          { label: "View", path: "/inventory/grn-local", type: "outline" },
          { label: "New", path: "/inventory/grn-local/new", type: "primary" }
        ],
        description: "Receive local purchases",
        icon: "📦",
      },
      {
        name: "Material Receipt (GRN) - Import",
        path: "/inventory/grn-import",
        actions: [
          { label: "View", path: "/inventory/grn-import", type: "outline" },
          { label: "New", path: "/inventory/grn-import/new", type: "primary" }
        ],
        description: "Receive import purchases",
        icon: "🚢",
      },
      {
        name: "Goods Issue",
        path: "/inventory/issue-to-requirement",
        actions: [
          { label: "View", path: "/inventory/issue-to-requirement", type: "outline" },
          { label: "New", path: "/inventory/issue-to-requirement/new", type: "primary" }
        ],
        description: "Issue goods for production or consumption",
        icon: "📤",
      },
    ],
  },
  {
    title: "Setup & Parameters",
    features: [
      {
        name: "Items / Master Data",
        path: "/inventory/items",
        actions: [
          { label: "View", path: "/inventory/items", type: "outline" },
          { label: "New", path: "/inventory/items/new", type: "primary" }
        ],
        description: "Manage items catalog and SKUs",
        icon: "📦",
      },
      {
        name: "Item Groups & Sub Groups",
        path: "/inventory/item-groups",
        actions: [
          { label: "View", path: "/inventory/item-groups", type: "outline" },
          { label: "New", path: "/inventory/item-groups/new", type: "primary" }
        ],
        description: "Categorize items into groups",
        icon: "🗂️",
      },
      {
        name: "Warehouses / Locations",
        path: "/inventory/warehouses",
        actions: [
          { label: "View", path: "/inventory/warehouses", type: "outline" },
          { label: "New", path: "/inventory/warehouses/new", type: "primary" }
        ],
        description: "Manage warehouses, bins, and storage locations",
        icon: "🏬",
      },
      {
        name: "Stock Upload",
        path: "/inventory/stock-upload",
        actions: [
          { label: "View", path: "/inventory/stock-upload", type: "outline" },
          { label: "New", path: "/inventory/stock-upload/new", type: "primary" }
        ],
        description: "Bulk update stock via Excel",
        icon: "⬆️",
      },
      {
        name: "Unit Conversion",
        path: "/inventory/unit-conversions",
        actions: [
          { label: "View", path: "/inventory/unit-conversions", type: "outline" },
          { label: "New", path: "/inventory/unit-conversions/new", type: "primary" }
        ],
        description: "Define unit conversion rates",
        icon: "🔄",
      },
      {
        name: "Item Batches",
        path: "/inventory/batches",
        actions: [
          { label: "View", path: "/inventory/batches", type: "outline" },
          { label: "New", path: "/inventory/batches/new", type: "primary" }
        ],
        description: "Manage inventory item batches",
        icon: "📦",
      },
    ],
  },
  {
    title: "Reports & Valuation",
    features: [
      {
        name: "Inventory Dashboard",
        path: "/inventory/dashboard",
        actions: [
          { label: "View", path: "/inventory/dashboard", type: "outline" }
        ],
        description: "Key inventory metrics and visual charts",
        icon: "📈",
      },
      {
        name: "Health Monitor",
        path: "/inventory/reports/health-monitor",
        actions: [
          { label: "View", path: "/inventory/reports/health-monitor", type: "outline" }
        ],
        description: "Overall stock health and KPIs",
        icon: "🏥",
      },
      {
        name: "Stock Balances",
        path: "/inventory/reports/stock-balances",
        actions: [
          { label: "View", path: "/inventory/reports/stock-balances", type: "outline" }
        ],
        description: "Current stock quantity in all locations",
        icon: "⚖️",
      },
      {
        name: "Stock Value",
        path: "/inventory/reports/stock-value",
        actions: [
          { label: "View", path: "/inventory/reports/stock-value", type: "outline" }
        ],
        description: "Valuation of current inventory",
        icon: "💰",
      },
      {
        name: "Stock Aging Analysis",
        path: "/inventory/reports/stock-aging-analysis",
        actions: [
          { label: "View", path: "/inventory/reports/stock-aging-analysis", type: "outline" }
        ],
        description: "Age of current stock holdings",
        icon: "⏳",
      },
      {
        name: "Fast Moving Items",
        path: "/inventory/reports/fast-moving",
        actions: [
          { label: "View", path: "/inventory/reports/fast-moving", type: "outline" }
        ],
        description: "High velocity inventory items",
        icon: "🚀",
      },
      {
        name: "Slow Moving Items",
        path: "/inventory/reports/slow-moving",
        actions: [
          { label: "View", path: "/inventory/reports/slow-moving", type: "outline" }
        ],
        description: "Low velocity inventory items",
        icon: "🐢",
      },
      {
        name: "Non Moving Items",
        path: "/inventory/reports/non-moving",
        actions: [
          { label: "View", path: "/inventory/reports/non-moving", type: "outline" }
        ],
        description: "Stagnant inventory items",
        icon: "🛑",
      },
      {
        name: "Periodical Stock Summary",
        path: "/inventory/reports/periodical-stock-summary",
        actions: [
          { label: "View", path: "/inventory/reports/periodical-stock-summary", type: "outline" }
        ],
        description: "Summary of stock movements over a period",
        icon: "📅",
      },
      {
        name: "Periodical Stock Statement",
        path: "/inventory/reports/periodical-stock-statement",
        actions: [
          { label: "View", path: "/inventory/reports/periodical-stock-statement", type: "outline" }
        ],
        description: "Detailed stock statement over a period",
        icon: "📃",
      },
      {
        name: "Issue Register",
        path: "/inventory/reports/issue-register",
        actions: [
          { label: "View", path: "/inventory/reports/issue-register", type: "outline" }
        ],
        description: "Log of all issued materials",
        icon: "📤",
      },
      {
        name: "Stock Transfer Register",
        path: "/inventory/reports/stock-transfer-register",
        actions: [
          { label: "View", path: "/inventory/reports/stock-transfer-register", type: "outline" }
        ],
        description: "Log of stock transfers between locations",
        icon: "🔄",
      },
      {
        name: "Stock Verification Report",
        path: "/inventory/reports/stock-verification",
        actions: [
          { label: "View", path: "/inventory/reports/stock-verification", type: "outline" }
        ],
        description: "Results of physical stock verifications",
        icon: "📋",
      },
      {
        name: "Stock Adjustment Report",
        path: "/inventory/reports/stock-adjustments",
        actions: [
          { label: "View", path: "/inventory/reports/stock-adjustments", type: "outline" }
        ],
        description: "Log of manual stock adjustments",
        icon: "⚖️",
      },
      {
        name: "Material Return Report",
        path: "/inventory/reports/material-returns",
        actions: [
          { label: "View", path: "/inventory/reports/material-returns", type: "outline" }
        ],
        description: "Log of returned materials",
        icon: "🔙",
      },
    ],
  },
];

function InventoryHomeIndex() {
  const [stats, setStats] = React.useState([
    {
      rbac_key: "items-tracked",
      value: "—",
      label: "Items Tracked",
      change: "Loading…",
      changeType: "neutral",
      path: "/inventory/items",
        actions: [
          { label: "View", path: "/inventory/items", type: "outline" },
          { label: "New", path: "/inventory/items/new", type: "primary" }
        ],
    },
    {
      rbac_key: "stock-quantity",
      value: "—",
      label: "Stock Quantity",
      change: "Loading…",
      changeType: "neutral",
      path: "/inventory/reports/stock-balances",
        actions: [
          { label: "View", path: "/inventory/reports/stock-balances", type: "outline" }
        ],
    },
    {
      rbac_key: "pending-requisitions",
      value: "—",
      label: "Pending Requisitions",
      change: "Loading…",
      changeType: "neutral",
      path: "/inventory/material-requisitions",
        actions: [
          { label: "View", path: "/inventory/material-requisitions", type: "outline" },
          { label: "New", path: "/inventory/material-requisitions/new", type: "primary" }
        ],
    },
    {
      rbac_key: "low-stock-items",
      value: "—",
      label: "Low Stock Items",
      change: "Loading…",
      changeType: "neutral",
      path: "/inventory/alerts/low-stock",
        actions: [
          { label: "View", path: "/inventory/alerts/low-stock", type: "outline" },
          { label: "New", path: "/inventory/alerts/low-stock/new", type: "primary" }
        ],
    },
  ]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/inventory/dashboard-stats");
        const d = resp?.data?.data;
        if (d && mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: String(d.totalItems ?? "—"),
              change: `${d.activeItems ?? 0} active`,
              changeType: "positive",
            };
            next[1] = {
              ...next[1],
              value: Number(d.totalStockQty || 0).toLocaleString(),
              change: `across ${d.locationsCount ?? 0} locations`,
              changeType: "neutral",
            };
            next[2] = {
              ...next[2],
              value: String(d.pendingRequisitions ?? "—"),
              change:
                d.pendingRequisitions > 0 ? "Awaiting approval" : "All cleared",
              changeType: d.pendingRequisitions > 0 ? "warning" : "positive",
            };
            next[3] = {
              ...next[3],
              value: String(d.lowStockItems ?? "—"),
              change:
                d.lowStockItems > 0 ? "Needs replenishment" : "Stock healthy",
              changeType: d.lowStockItems > 0 ? "negative" : "positive",
            };
            return next;
          });
        }
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ModuleDashboard
      moduleKey="inventory"
      useSectionNavigation={true}
      title="Inventory Management"
      description="Stock management, warehouse operations, and inventory control"
      stats={stats}
      headerActions={[
        { label: "Dashboard", path: "/inventory/dashboard",
        actions: [
          { label: "View", path: "/inventory/dashboard", type: "outline" }
        ], icon: "📊" },
      ]}
      sections={inventorySections}
      features={inventoryFeatures}
    />
  );
}

function StockUpdationAndVerificationPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [updations, setUpdations] = React.useState([]);
  const [verifications, setVerifications] = React.useState([]);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    Promise.all([
      api
        .get("/inventory/stock-updation")
        .catch(() => ({ data: { items: [] } })),
      api
        .get("/inventory/stock-verification")
        .catch(() => ({ data: { items: [] } })),
    ])
      .then(([updRes, verRes]) => {
        if (!mounted) return;
        const upd = Array.isArray(updRes.data?.items) ? updRes.data.items : [];
        const ver = Array.isArray(verRes.data?.items) ? verRes.data.items : [];
        setUpdations(upd.slice(0, 8));
        setVerifications(ver.slice(0, 8));
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load data");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Stock Operations
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Select a module to manage inventory additions or perform stock
            verifications and adjustments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Stock Updation Card */}
          <Link
            to="/inventory/stock-updation"
            className="group relative bg-white rounded-2xl shadow-sm border border-slate-200 p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors" />
            <div className="flex flex-col h-full space-y-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors duration-300">
                <svg
                  className="w-8 h-8 text-indigo-600 group-hover:text-white transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Stock Updation
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  Fast-track stock increases and manual inventory additions.
                  Update balances directly for incoming items.
                </p>
              </div>
              <div className="pt-4 flex items-center text-indigo-600 font-semibold group-hover:translate-x-2 transition-transform">
                Go to Updation List
                <svg
                  className="w-5 h-5 ml-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </div>
            </div>
          </Link>

          {/* Stock Verification Card */}
          <Link
            to="/inventory/stock-verification"
            className="group relative bg-white rounded-2xl shadow-sm border border-slate-200 p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors" />
            <div className="flex flex-col h-full space-y-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 transition-colors duration-300">
                <svg
                  className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Stock Verification
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  Audit physical inventory against system records. Record
                  variances and reconcile stock levels.
                </p>
              </div>
              <div className="pt-4 flex items-center text-emerald-600 font-semibold group-hover:translate-x-2 transition-transform">
                Go to Verification List
                <svg
                  className="w-5 h-5 ml-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        <div className="flex justify-center pt-6">
          <Link
            to="/inventory"
            className="inline-flex items-center px-6 py-3 border border-slate-300 shadow-sm text-base font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            <svg
              className="mr-2 -ml-1 h-5 w-5 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Return to Inventory Menu
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function InventoryHome() {
  return (
    <ModuleLayout sections={inventorySections} moduleKey="inventory">
      <Routes>
        <Route index element={<InventoryHomeIndex />} />
        <Route path="stock" element={<StockBalancesPage />} />
        <Route path="stock-balances" element={<StockBalancesPage />} />
        <Route path="stock-journal" element={<StockJournalList />} />
        <Route path="stock-journal/new" element={<StockJournalForm />} />
        <Route path="stock-journal/:id" element={<StockJournalForm />} />
        <Route path="inventory/journal" element={<StockJournalList />} />
        <Route path="inventory/journal/new" element={<StockJournalForm />} />
        <Route path="inventory/journal/:id" element={<StockJournalForm />} />
      <Route path="stock-ops" element={<StockUpdationAndVerificationPage />} />
      <Route
        path="dashboard"
        element={
          <React.Suspense fallback={<div className="p-4">Loading...</div>}>
            {React.createElement(
              React.lazy(() => import("./InventoryDashboardPage.jsx")),
            )}
          </React.Suspense>
        }
      />
      <Route
        path="material-requisitions"
        element={<MaterialRequisitionList />}
      />
      <Route
        path="material-requisitions/:id"
        element={<MaterialRequisitionForm />}
      />
      <Route path="stock-updation" element={<StockUpdationList />} />
      <Route path="stock-verification" element={<StockVerificationList />} />
      <Route path="stock-updation/:id" element={<StockUpdationForm />} />
      <Route
        path="stock-verification/:id"
        element={<StockVerificationForm />}
      />
      <Route path="return-to-stores" element={<ReturnToStoresList />} />
      <Route path="return-to-stores/new" element={<ReturnToStoresForm />} />
      <Route path="return-to-stores/:id" element={<ReturnToStoresForm />} />
      <Route path="stock-adjustments" element={<StockAdjustmentList />} />
      <Route path="stock-adjustments/new" element={<StockAdjustmentForm />} />
      <Route path="stock-adjustments/:id" element={<StockAdjustmentForm />} />
      <Route path="issue-to-requirement" element={<IssueToRequirementList />} />
      <Route
        path="issue-to-requirement/new"
        element={<IssueToRequirementForm />}
      />
      <Route
        path="issue-to-requirement/:id"
        element={<IssueToRequirementForm />}
      />
      <Route path="stock-transfers" element={<StockTransferList />} />
      <Route path="stock-transfers/:id" element={<StockTransferForm />} />
      <Route path="transfer-acceptance" element={<TransferAcceptanceList />} />
      <Route
        path="transfer-acceptance/:id"
        element={<TransferAcceptanceForm />}
      />
      <Route path="stock-reorder" element={<StockReorderPage />} />
      <Route path="stock-upload" element={<StockUploadPage />} />
      <Route path="daily-stock-take" element={<DailyStockTakeList />} />
      <Route path="daily-stock-take/:id" element={<DailyStockTakeForm />} />
      <Route path="physical-stock-take" element={<PhysicalStockTakeList />} />
      <Route path="physical-stock-take/:id" element={<PhysicalStockTakeForm />} />
      <Route path="stock-take" element={<StockTakeList />} />
      <Route path="stock-take/:id" element={<StockTakeForm />} />
      <Route path="grn-local" element={<GRNLocalList />} />
      <Route path="grn-local/:id" element={<GRNLocalForm />} />
      <Route path="grn-import" element={<GRNImportList />} />
      <Route path="grn-import/:id" element={<GRNImportForm />} />
      {/* Sales Return and Purchase Return routes removed from Inventory */}
      <Route path="batches" element={<ItemBatchesList />} />
      <Route path="items" element={<ItemsList />} />

      <Route path="items/:id" element={<ItemForm />} />
      <Route path="item-groups" element={<ItemGroupsList />} />
      <Route path="item-groups/:id" element={<ItemGroupForm />} />
      <Route path="unit-conversions" element={<UnitConversionsList />} />
      <Route path="warehouses" element={<WarehousesList />} />
      <Route path="warehouses/:id" element={<WarehouseForm />} />

      <Route path="reports" element={<InventoryReportsPage />} />
      <Route
        path="reports/health-monitor"
        element={<InventoryHealthMonitorPage />}
      />
      <Route
        path="reports/periodical-stock-summary"
        element={<PeriodicalStockSummaryPage />}
      />
      <Route
        path="reports/periodical-stock-statement"
        element={<PeriodicalStockStatementPage />}
      />
      <Route
        path="reports/issue-register"
        element={<IssueRegisterReportPage />}
      />
      <Route
        path="reports/stock-transfer-register"
        element={<StockTransferRegisterReportPage />}
      />
      <Route
        path="reports/stock-balances"
        element={<StockBalancesReportPage />}
      />
      <Route
        path="reports/stock-value"
        element={<StockValueReportPage />}
      />
      <Route
        path="reports/stock-adjustments"
        element={<StockAdjustmentReportPage />}
      />
      <Route
        path="reports/material-returns"
        element={<MaterialReturnReportPage />}
      />
      <Route
        path="reports/stock-verification"
        element={<StockVerificationReportPage />}
      />
      <Route
        path="reports/stock-aging-analysis"
        element={<StockAgingAnalysisReportPage />}
      />
      <Route path="reports/slow-moving" element={<SlowMovingReportPage />} />
      <Route path="reports/fast-moving" element={<FastMovingReportPage />} />
      <Route path="reports/non-moving" element={<NonMovingReportPage />} />
      <Route path="*" element={<Navigate to="/inventory" replace />} />
      </Routes>
    </ModuleLayout>
  );
}

export const inventoryFeatures = [
  {
    module_key: "inventory",
    label: "Material Requisition",
    path: "/inventory/material-requisitions",
        actions: [
          { label: "View", path: "/inventory/material-requisitions", type: "outline" },
          { label: "New", path: "/inventory/material-requisitions/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Upload",
    path: "/inventory/stock-upload",
        actions: [
          { label: "View", path: "/inventory/stock-upload", type: "outline" },
          { label: "New", path: "/inventory/stock-upload/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Updation",
    path: "/inventory/stock-updation",
        actions: [
          { label: "View", path: "/inventory/stock-updation", type: "outline" },
          { label: "New", path: "/inventory/stock-updation/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Verification",
    path: "/inventory/stock-verification",
        actions: [
          { label: "View", path: "/inventory/stock-verification", type: "outline" },
          { label: "New", path: "/inventory/stock-verification/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Updation & Verification",
    path: "/inventory/stock-ops",
        actions: [
          { label: "View", path: "/inventory/stock-ops", type: "outline" },
          { label: "New", path: "/inventory/stock-ops/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Return to Stores Advice",
    path: "/inventory/return-to-stores",
        actions: [
          { label: "View", path: "/inventory/return-to-stores", type: "outline" },
          { label: "New", path: "/inventory/return-to-stores/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Adjustment",
    path: "/inventory/stock-adjustments",
        actions: [
          { label: "View", path: "/inventory/stock-adjustments", type: "outline" },
          { label: "New", path: "/inventory/stock-adjustments/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Issue to Requirement Area",
    path: "/inventory/issue-to-requirement",
        actions: [
          { label: "View", path: "/inventory/issue-to-requirement", type: "outline" },
          { label: "New", path: "/inventory/issue-to-requirement/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Warehouse Stock Transfer",
    path: "/inventory/stock-transfers",
        actions: [
          { label: "View", path: "/inventory/stock-transfers", type: "outline" },
          { label: "New", path: "/inventory/stock-transfers/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Transfer Acceptance",
    path: "/inventory/transfer-acceptance",
        actions: [
          { label: "View", path: "/inventory/transfer-acceptance", type: "outline" },
          { label: "New", path: "/inventory/transfer-acceptance/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Stock Reorder",
    path: "/inventory/stock-reorder",
        actions: [
          { label: "View", path: "/inventory/stock-reorder", type: "outline" },
          { label: "New", path: "/inventory/stock-reorder/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Physical Stock Take",
    path: "/inventory/physical-stock-take",
    actions: [
      { label: "View", path: "/inventory/physical-stock-take", type: "outline" },
      { label: "New", path: "/inventory/physical-stock-take/new", type: "primary" }
    ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Daily Stock Take",
    path: "/inventory/daily-stock-take",
    actions: [
      { label: "View", path: "/inventory/daily-stock-take", type: "outline" },
      { label: "New", path: "/inventory/daily-stock-take/new", type: "primary" }
    ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Material Receipt (GRN) - Local",
    path: "/inventory/grn-local",
        actions: [
          { label: "View", path: "/inventory/grn-local", type: "outline" },
          { label: "New", path: "/inventory/grn-local/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Material Receipt (GRN) - Import",
    path: "/inventory/grn-import",
        actions: [
          { label: "View", path: "/inventory/grn-import", type: "outline" },
          { label: "New", path: "/inventory/grn-import/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Items Setup",
    path: "/inventory/items",
        actions: [
          { label: "View", path: "/inventory/items", type: "outline" },
          { label: "New", path: "/inventory/items/new", type: "primary" }
        ],
    type: "feature",
  },

  {
    module_key: "inventory",
    label: "Unit Conversion",
    path: "/inventory/unit-conversions",
        actions: [
          { label: "View", path: "/inventory/unit-conversions", type: "outline" },
          { label: "New", path: "/inventory/unit-conversions/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Warehouse Setup",
    path: "/inventory/warehouses",
        actions: [
          { label: "View", path: "/inventory/warehouses", type: "outline" },
          { label: "New", path: "/inventory/warehouses/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Item Batches",
    path: "/inventory/batches",
        actions: [
          { label: "View", path: "/inventory/batches", type: "outline" },
          { label: "New", path: "/inventory/batches/new", type: "primary" }
        ],
    type: "feature",
  },
  {
    module_key: "inventory",
    label: "Health Monitor",
    path: "/inventory/reports/health-monitor",
        actions: [
          { label: "View", path: "/inventory/reports/health-monitor", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Stock Summary",
    path: "/inventory/reports/periodical-stock-summary",
        actions: [
          { label: "View", path: "/inventory/reports/periodical-stock-summary", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Stock Statement",
    path: "/inventory/reports/periodical-stock-statement",
        actions: [
          { label: "View", path: "/inventory/reports/periodical-stock-statement", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Issue Register",
    path: "/inventory/reports/issue-register",
        actions: [
          { label: "View", path: "/inventory/reports/issue-register", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Stock Transfer Register",
    path: "/inventory/reports/stock-transfer-register",
        actions: [
          { label: "View", path: "/inventory/reports/stock-transfer-register", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Stock Verification",
    path: "/inventory/reports/stock-verification",
        actions: [
          { label: "View", path: "/inventory/reports/stock-verification", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Stock Aging Analysis",
    path: "/inventory/reports/stock-aging-analysis",
        actions: [
          { label: "View", path: "/inventory/reports/stock-aging-analysis", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Slow Moving Items",
    path: "/inventory/reports/slow-moving",
        actions: [
          { label: "View", path: "/inventory/reports/slow-moving", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Fast Moving Items",
    path: "/inventory/reports/fast-moving",
        actions: [
          { label: "View", path: "/inventory/reports/fast-moving", type: "outline" }
        ],
    type: "dashboard",
  },
  {
    module_key: "inventory",
    label: "Non Moving Items",
    path: "/inventory/reports/non-moving",
        actions: [
          { label: "View", path: "/inventory/reports/non-moving", type: "outline" }
        ],
    type: "dashboard",
  },
];
