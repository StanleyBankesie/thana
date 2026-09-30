/**
 * @fileoverview ProductionHome component.
 * Provides functionality for ProductionHome with clean title "Production"
 * and comprehensive routing for manufacturing masters and setup.
 */

import React, { useState, useEffect } from "react";
import { Link, Route, Routes, Navigate } from "react-router-dom";
import ModuleDashboard from "../../../components/ModuleDashboard.jsx";
import ModuleLayout from "../../../components/ModuleLayout.jsx";
import { api } from "api/client";

import BomList from "./bom/BomList";
import BomForm from "./bom/BomForm";
import WorkOrderList from "./work-orders/WorkOrderList";
import WorkOrderForm from "./work-orders/WorkOrderForm";

import ProcessList from "./setup/ProcessList";
import MachineList from "./setup/MachineList";
import ShiftList from "./setup/ShiftList";
import DepartmentList from "./setup/DepartmentList";
import BomOutputTypeList from "./setup/BomOutputTypeList";

import RoutingList from "./routings/RoutingList";
import RoutingForm from "./routings/RoutingForm";

import DailyPlanList from "./planning/DailyPlanList";
import DailyPlanForm from "./planning/DailyPlanForm";

import JobCardList from "./execution/JobCardList";
import JobCardExecution from "./execution/JobCardExecution";

import MaterialReceiptList from "./execution/MaterialReceiptList";
import MaterialReceiptForm from "./execution/MaterialReceiptForm";

import MaterialRequisitionList from "./execution/MaterialRequisitionList";
import MaterialRequisitionForm from "./execution/MaterialRequisitionForm";

import MaterialUtilizationList from "./execution/MaterialUtilizationList";
import MaterialUtilizationForm from "./execution/MaterialUtilizationForm";
import MaterialRequirementPage from "./planning/MaterialRequirementPage";
import ProductionOutputPage from "./execution/ProductionOutputPage";
import QualityControlList from "./execution/QualityControlList";
import ProductionCostingPage from "./reports/ProductionCostingPage";

import ProductionTransferList from "./execution/ProductionTransferList";
import ProductionTransferForm from "./execution/ProductionTransferForm";
import FinishedGoodsTransferList from "./execution/FinishedGoodsTransferList";
import FinishedGoodsTransferForm from "./execution/FinishedGoodsTransferForm";

import ProductionReports from "./reports/ProductionReports";
import EfficiencyReport from "./reports/EfficiencyReport";
import ProductionWarehouseStockReport from "./reports/ProductionWarehouseStockReport";
import MaterialVarianceReport from "./reports/MaterialVarianceReport";
import BomExplosionReport from "./reports/BomExplosionReport";
import MachineUtilizationReport from "./reports/MachineUtilizationReport";
import ProductionSummaryReport from "./reports/ProductionSummaryReport";
import ProductionDetailReportPage from "./reports/ProductionDetailReportPage";

import StockJournalList from "./inventory/StockJournalList";
import StockJournalForm from "./inventory/StockJournalForm";
import ProductionStockPage from "./inventory/ProductionStockPage";

import ProductionSetup from "./setup/ProductionSetup";
import ProductionDashboardPage from "./ProductionDashboardPage";

export const productionSections = [
  {
    icon: "🏗️",
    title: "Manufacturing Masters & Setup",
    features: [
      {
        name: "Manufacturing Setup",
        path: "/production/setup",
        actions: [
          { label: "Configure", path: "/production/setup", type: "primary" }
        ],
        description:
          "Setup global parameters, default warehouses, WIP staging, costing methods & resources",
        icon: "🔧",
      },
      {
        name: "Manufacturing Processes",
        path: "/production/setup/processes",
        actions: [
          { label: "View", path: "/production/setup/processes", type: "outline" }
        ],
        description:
          "Configure manufacturing processes, department scope, output types, inputs, outputs, by-products & overheads",
        icon: "⚙️",
      },
      {
        name: "BOM / Specification",
        path: "/production/boms",
        actions: [
          { label: "View", path: "/production/boms", type: "outline" },
          { label: "New", path: "/production/boms/new", type: "primary" }
        ],
        description:
          "Define product recipes, required materials, scrap allowances, and operation sequences",
        icon: "📜",
      },
      {
        name: "Routing & Operations",
        path: "/production/routings",
        actions: [
          { label: "View", path: "/production/routings", type: "outline" },
          { label: "New", path: "/production/routings/new", type: "primary" }
        ],
        description:
          "Standardize process sequences, departments, and setup/cycle durations",
        icon: "📋",
      },
    ],
  },
  {
    icon: "🗓️",
    title: "Planning & Requirements",
    features: [
      {
        name: "Production Planning",
        path: "/production/planning/daily",
        actions: [
          { label: "View", path: "/production/planning/daily", type: "outline" },
          { label: "New", path: "/production/planning/daily/new", type: "primary" }
        ],
        description:
          "Schedule manufacturing throughput, targets, and shift allocations across daily, weekly, and monthly periods",
        icon: "📅",
      },
      {
        name: "Material Requirements (MRP)",
        path: "/production/planning/requirements",
        actions: [
          { label: "Check Shortages", path: "/production/planning/requirements", type: "primary" }
        ],
        description:
          "Required vs Available stock comparison & shortage calculation per order",
        icon: "📊",
      },
    ],
  },
  {
    icon: "⚡",
    title: "Shop Floor & Execution",
    features: [
      {
        name: "Production Stock Overview",
        path: "/production/stock",
        actions: [
          { label: "View Stock", path: "/production/stock", type: "primary" }
        ],
        description:
          "Floor stock balances across Raw Materials, WIP, and Finished Goods",
        icon: "🏭",
      },
      {
        name: "Production Orders",
        path: "/production/work-orders",
        actions: [
          { label: "View Orders", path: "/production/work-orders", type: "outline" },
          { label: "Create Order", path: "/production/work-orders/new", type: "primary" }
        ],
        description:
          "Track order lifecycle (Draft → Released → In Progress → Completed → Closed)",
        icon: "📋",
      },
      {
        name: "Material Requisitions",
        path: "/production/execution/material-requisition",
        actions: [
          { label: "View Requests", path: "/production/execution/material-requisition", type: "outline" },
          { label: "New Request", path: "/production/execution/material-requisition/new", type: "primary" }
        ],
        description:
          "Request raw materials from Central Store based on Order BOM requirements",
        icon: "📦",
      },
      {
        name: "Material Receipts",
        path: "/production/execution/material-receipt",
        actions: [
          { label: "View Receipts", path: "/production/execution/material-receipt", type: "outline" },
          { label: "Record Issue", path: "/production/execution/material-receipt/new", type: "primary" }
        ],
        description:
          "Issue raw materials from Central Store to Production WIP Staging",
        icon: "📥",
      },
      {
        name: "Material Utilization",
        path: "/production/execution/material-utilization",
        actions: [
          { label: "View Log", path: "/production/execution/material-utilization", type: "outline" },
          { label: "Record Consumed", path: "/production/execution/material-utilization/new", type: "primary" }
        ],
        description:
          "Record actual consumed materials (Strictly ≤ Available Received Quantity)",
        icon: "♻️",
      },
      {
        name: "Job Cards Execution",
        path: "/production/execution/job-cards",
        actions: [
          { label: "View Job Cards", path: "/production/execution/job-cards", type: "primary" }
        ],
        description:
          "Manage shop floor job tickets, process runtime tracking, machine allocation, and shift execution",
        icon: "🎟️",
      },
      {
        name: "Quality Control",
        path: "/production/execution/qc",
        actions: [
          { label: "New QC Inspection", path: "/production/execution/output", type: "primary" },
          { label: "View QC List", path: "/production/execution/qc", type: "secondary" }
        ],
        description:
          "Perform quality control inspection, checklist criteria scoring, batch/lot shelf life verification, and finished goods warehouse stock transfer",
        icon: "🛡️",
      },
      {
        name: "Finished Goods Transfer",
        path: "/production/execution/fg-transfer",
        actions: [
          { label: "New FG Transfer", path: "/production/execution/fg-transfer/new", type: "primary" },
          { label: "View Transfers", path: "/production/execution/fg-transfer", type: "secondary" }
        ],
        description:
          "Transfer inspected products from FG warehouse to target inventory warehouse for Transfer Acceptance receipt",
        icon: "🚚",
      },
      {
        name: "Stock Journal",
        path: "/production/inventory/journal",
        actions: [
          { label: "View", path: "/production/inventory/journal", type: "outline" },
          { label: "New", path: "/production/inventory/journal/new", type: "primary" }
        ],
        description:
          "Register material consumption and finished goods stock journal entries",
        icon: "📖",
      },
    ],
  },
  {
    icon: "📊",
    title: "Reports & Costing",
    features: [
      {
        name: "Detailed Production Report",
        path: "/production/reports/production-detail",
        actions: [
          { label: "View Report", path: "/production/reports/production-detail", type: "primary" }
        ],
        description: "Breakdown by Production Date, Unit, Machine, Shift, Process, Manufacturing Date, Item, Planned and Produced Qty",
        icon: "📊",
      },
      {
        name: "Executive Summary Report",
        path: "/production/reports/summary",
        actions: [
          { label: "View Summary", path: "/production/reports/summary", type: "primary" }
        ],
        description: "High-level summary covering production output, material consumption, completed and pending orders",
        icon: "📄",
      },
      {
        name: "Warehouse Stock Availability",
        path: "/production/reports/warehouse-stock",
        actions: [
          { label: "View Availability", path: "/production/reports/warehouse-stock", type: "primary" }
        ],
        description: "Real-time available quantities of raw materials and WIP across all production warehouses",
        icon: "🏬",
      },
      {
        name: "Production Costing",
        path: "/production/reports/costing",
        actions: [
          { label: "Cost Breakdown", path: "/production/reports/costing", type: "primary" }
        ],
        description:
          "Material Cost + Direct Labor + Machine Cost + Overhead = Production Valuation",
        icon: "💲",
      },
      {
        name: "Efficiency Analysis",
        path: "/production/reports/efficiency",
        actions: [
          { label: "View Efficiency", path: "/production/reports/efficiency", type: "outline" }
        ],
        description: "Monitor planned vs actual performance and line throughput",
        icon: "📈",
      },
      {
        name: "Material Usage Variance",
        path: "/production/reports/variance",
        actions: [
          { label: "View Variance", path: "/production/reports/variance", type: "outline" }
        ],
        description: "Analyze the gap between estimated BOM consumption and actual material logs",
        icon: "📉",
      },
      {
        name: "BOM Explosion Analysis",
        path: "/production/reports/bom-explosion",
        actions: [
          { label: "View Explosion", path: "/production/reports/bom-explosion", type: "outline" }
        ],
        description: "Detailed breakdown of all levels of multi-stage Bill of Materials and material valuation",
        icon: "🌿",
      },
      {
        name: "Machine Utilization",
        path: "/production/reports/machines",
        actions: [
          { label: "View Equipment", path: "/production/reports/machines", type: "outline" }
        ],
        description: "Equipment throughput, active job cards, and capacity utilization across shop floor machines",
        icon: "⚙️",
      },
    ],
  },
];

function ProductionHomeIndex() {
  const [stats, setStats] = useState([
    {
      label: "Active Production Orders",
      value: "0",
      change: "Execution",
      icon: "📋",
      path: "/production/work-orders",
      actions: [
        { label: "View", path: "/production/work-orders", type: "outline" },
        { label: "New", path: "/production/work-orders/new", type: "primary" }
      ],
      color: "from-blue-600 to-blue-700",
    },
    {
      label: "Open Job Cards",
      value: "0",
      change: "Shop Floor",
      icon: "📑",
      path: "/production/execution/job-cards",
      actions: [
        { label: "View", path: "/production/execution/job-cards", type: "outline" },
        { label: "New", path: "/production/execution/job-cards/new", type: "primary" }
      ],
      color: "from-amber-600 to-amber-700",
    },
    {
      label: "Pending Requisitions",
      value: "0",
      change: "Warehouse",
      icon: "📦",
      path: "/production/execution/material-requisition",
      actions: [
        { label: "View", path: "/production/execution/material-requisition", type: "outline" },
        { label: "New", path: "/production/execution/material-requisition/new", type: "primary" }
      ],
      color: "from-purple-600 to-purple-700",
    },
    {
      label: "Active BOMs",
      value: "0",
      change: "Engineering",
      icon: "📜",
      path: "/production/boms",
      actions: [
        { label: "View", path: "/production/boms", type: "outline" },
        { label: "New", path: "/production/boms/new", type: "primary" }
      ],
      color: "from-emerald-600 to-emerald-700",
    },
  ]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await api.get("/production/dashboard/stats");
        const d = resp?.data?.data || resp?.data || {};
        if (d && mounted) {
          setStats((prev) => {
            const next = [...prev];
            next[0] = {
              ...next[0],
              value: String(d.activeOrders ?? d.activeWorkOrders ?? "0"),
            };
            next[1] = {
              ...next[1],
              value: String(d.jobCards ?? d.openJobCards ?? "0"),
            };
            next[2] = {
              ...next[2],
              value: String(d.pendingRequisitions ?? "0"),
            };
            next[3] = { ...next[3], value: String(d.boms ?? "0") };
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
      moduleKey="production"
      useSectionNavigation={true}
      title="Production"
      description="Modern industrial suite for end-to-end manufacturing control, from design and planning to shop floor execution."
      headerActions={[
        { label: "Dashboard", path: "/production/dashboard", icon: "📊" },
      ]}
      stats={stats}
      sections={productionSections}
      features={productionFeatures}
      showAll={true}
    />
  );
}

function ProductionPlaceholder({ title }) {
  return (
    <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 max-w-2xl mx-auto mt-10">
      <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-3xl">🏗️</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        {title}
      </h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">
        This module is currently being initialized. Full industrial-grade
        features for this section are coming online.
      </p>
      <Link
        to="/production"
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}

export default function ProductionHome() {
  return (
    <ModuleLayout sections={productionSections} moduleKey="production">
      <Routes>
        <Route index element={<ProductionHomeIndex />} />
        <Route path="dashboard" element={<ProductionDashboardPage />} />
        <Route path="dashboards" element={<ProductionDashboardPage />} />

        {/* Existing Modules */}
        <Route path="boms" element={<BomList />} />
        <Route path="boms/new" element={<BomForm />} />
        <Route path="boms/edit/:id" element={<BomForm />} />
        <Route path="work-orders" element={<WorkOrderList />} />
        <Route path="work-orders/new" element={<WorkOrderForm />} />
        <Route path="work-orders/:id" element={<WorkOrderForm />} />

        {/* Planning Routes */}
        {/* Planning & Requirements Routes */}
        <Route path="planning/daily" element={<DailyPlanList />} />
        <Route path="planning/daily/new" element={<DailyPlanForm />} />
        <Route path="planning/daily/edit/:id" element={<DailyPlanForm />} />
        <Route path="planning/daily/view/:id" element={<DailyPlanForm />} />
        <Route path="planning/daily/:id" element={<DailyPlanForm />} />
        <Route path="planning/requirements" element={<MaterialRequirementPage />} />
        <Route
          path="planning/schedule"
          element={<ProductionPlaceholder title="Production Schedule" />}
        />
        <Route path="routings" element={<RoutingList />} />
        <Route path="routings/new" element={<RoutingForm />} />
        <Route path="routings/edit/:id" element={<RoutingForm />} />

        {/* Execution Routes */}
        <Route path="execution/job-cards" element={<JobCardList />} />
        <Route path="execution/job-cards/:id" element={<JobCardExecution />} />
        <Route path="execution/qc" element={<QualityControlList />} />
        <Route path="execution/output" element={<ProductionOutputPage />} />
        <Route path="execution/qc/new" element={<ProductionOutputPage />} />
        <Route
          path="execution/material-receipt"
          element={<MaterialReceiptList />}
        />
        <Route
          path="execution/material-receipt/new"
          element={<MaterialReceiptForm />}
        />
        <Route
          path="execution/material-requisition"
          element={<MaterialRequisitionList />}
        />
        <Route
          path="execution/material-requisition/new"
          element={<MaterialRequisitionForm />}
        />
        <Route
          path="execution/material-utilization"
          element={<MaterialUtilizationList />}
        />
        <Route
          path="execution/material-utilization/new"
          element={<MaterialUtilizationForm />}
        />
        <Route
          path="execution/material-utilization/:id"
          element={<MaterialUtilizationForm />}
        />
        <Route
          path="execution/transfer"
          element={<ProductionTransferList />}
        />
        <Route
          path="execution/transfer/new"
          element={<ProductionTransferForm />}
        />
        <Route
          path="execution/fg-transfer"
          element={<FinishedGoodsTransferList />}
        />
        <Route
          path="execution/fg-transfer/new"
          element={<FinishedGoodsTransferForm />}
        />

        {/* Reports Routes */}
        <Route path="reports" element={<ProductionReports />} />
        <Route path="reports/production-detail" element={<ProductionDetailReportPage />} />
        <Route path="reports/efficiency" element={<EfficiencyReport />} />
        <Route path="reports/warehouse-stock" element={<ProductionWarehouseStockReport />} />
        <Route path="reports/costing" element={<ProductionCostingPage />} />
        <Route path="reports/variance" element={<MaterialVarianceReport />} />
        <Route path="reports/bom-explosion" element={<BomExplosionReport />} />
        <Route path="reports/machines" element={<MachineUtilizationReport />} />
        <Route path="reports/summary" element={<ProductionSummaryReport />} />

        {/* Inventory & Setup Routes */}
        <Route path="stock" element={<ProductionStockPage />} />
        <Route path="warehouse-stock" element={<ProductionStockPage />} />
        <Route path="inventory/journal" element={<StockJournalList />} />
        <Route path="inventory/journal/new" element={<StockJournalForm />} />
        <Route path="inventory/journal/:id" element={<StockJournalForm />} />
        <Route path="stock-journal" element={<StockJournalList />} />
        <Route path="stock-journal/new" element={<StockJournalForm />} />
        <Route path="stock-journal/:id" element={<StockJournalForm />} />
        <Route path="inventory/stock-journal" element={<StockJournalList />} />
        <Route path="inventory/stock-journal/new" element={<StockJournalForm />} />
        <Route path="inventory/stock-journal/:id" element={<StockJournalForm />} />
        <Route
          path="inventory/updation"
          element={<ProductionPlaceholder title="Inventory Updation" />}
        />
        <Route path="setup" element={<ProductionSetup />} />
        <Route path="setup/processes" element={<ProcessList />} />
        <Route path="setup/departments" element={<DepartmentList />} />
        <Route path="setup/bom-output-types" element={<BomOutputTypeList />} />
        <Route path="setup/machines" element={<MachineList />} />
        <Route path="setup/shifts" element={<ShiftList />} />

        <Route path="*" element={<Navigate to="/production" replace />} />
      </Routes>
    </ModuleLayout>
  );
}

export const productionFeatures = [
  {
    module_key: "production",
    label: "Work Orders",
    path: "/production/work-orders",
    actions: [
      { label: "View", path: "/production/work-orders", type: "outline" },
      { label: "New", path: "/production/work-orders/new", type: "primary" }
    ],
  },
  {
    module_key: "production",
    label: "BOMs",
    path: "/production/boms",
    actions: [
      { label: "View", path: "/production/boms", type: "outline" },
      { label: "New", path: "/production/boms/new", type: "primary" }
    ],
  },
  {
    module_key: "production",
    label: "Manufacturing Setup",
    path: "/production/setup",
    actions: [
      { label: "Configure", path: "/production/setup", type: "primary" }
    ],
  },
];
