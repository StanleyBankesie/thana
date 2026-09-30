import React, { useState, useEffect, useCallback } from "react";
import {
  Factory, Layers, Cpu, ShieldCheck, TrendingUp, AlertTriangle,
  CheckCircle2, Box, ArrowRight, ExternalLink
} from "lucide-react";
import { api } from "../../../api/client.js";
import {
  PageHeader, KpiCard, SectionCard, MiniBar, StatusBar,
  DataTable, ErrorAlert, fmtNum
} from "./bi.shared.jsx";
import BIFilterBar from "./components/BIFilterBar.jsx";
import BIAnalysisToolbar from "./components/BIAnalysisToolbar.jsx";
import BIDrillDownModal from "./components/BIDrillDownModal.jsx";
import BIExportModal from "./components/BIExportModal.jsx";
import BIShareModal from "./components/BIShareModal.jsx";
import BISavedAnalysesModal from "./components/BISavedAnalysesModal.jsx";

const STAT_COLORS = {
  COMPLETED: "#10b981",
  IN_PROGRESS: "#3b82f6",
  PENDING: "#f59e0b",
  DRAFT: "#94a3b8",
  RELEASED: "#8b5cf6",
  CANCELLED: "#ef4444",
};

export default function ProductionAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Workflow Filters & Dimensions
  const [filters, setFilters] = useState({
    datePreset: "THIS_MONTH",
    compareWith: "NONE",
    branchId: "",
    status: "",
  });
  const [activeDimension, setActiveDimension] = useState("products");

  // Workflow Modals State
  const [drillModal, setDrillModal] = useState({ isOpen: false, module: "production", dimension: "summary", title: "Production Work Orders" });
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filters.from) q.append("from", filters.from);
      if (filters.to) q.append("to", filters.to);
      if (filters.branchId) q.append("branchId", filters.branchId);
      if (filters.status) q.append("status", filters.status);

      const res = await api.get(`/bi/production?${q.toString()}`);
      setData(res.data?.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load production analytics.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.summary || {};
  const totalOrders = Number(s.total || 0);

  const kpisForExport = [
    { label: "Total Work Orders", value: fmtNum(s.total), sub: `${s.inProgress || 0} active, ${s.completed || 0} completed` },
    { label: "Finished Output", value: `${fmtNum(s.totalProduced)} units`, sub: "Manufactured goods" },
    { label: "Plant Yield", value: `${s.yieldRate ?? 100}%`, sub: "Efficiency ratio" },
    { label: "Scrap Rate", value: `${s.scrapRate ?? 0}%`, sub: "Material scrap ratio" },
    { label: "Machine Uptime", value: `${s.machineUptime ?? 0}%`, sub: `${s.activeMachines || 0} / ${s.totalMachines || 0} operational` },
    { label: "QC Pass Rate", value: `${s.qcPassRate ?? 100}%`, sub: `${s.totalQc || 0} inspections` },
  ];

  const exportTableColumns = [
    { key: "item_name", label: "Product / BOM" },
    { key: "item_code", label: "Item Code" },
    { key: "runs", label: "Production Runs" },
    { key: "total_qty", label: "Produced Qty" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Intelligence & Analytics"
        description="Comprehensive analysis of shop floor outputs, recipe utilization, plant yield, scrap rate, and QC compliance"
        onRefresh={load}
        loading={loading}
      />

      {/* 1. Multi-Dimensional Filter Bar */}
      <BIFilterBar
        moduleKey="production"
        filters={filters}
        onFilterChange={setFilters}
        onApply={load}
        onReset={() => setFilters({ datePreset: "THIS_MONTH", compareWith: "NONE", branchId: "", status: "" })}
        loading={loading}
        extraDimensions={[
          {
            key: "status",
            label: "Status",
            options: [
              { label: "Completed", value: "COMPLETED" },
              { label: "In Progress", value: "IN_PROGRESS" },
              { label: "Pending / Released", value: "PENDING" },
            ]
          }
        ]}
      />

      {/* 2. Analysis & Workflow Toolbar */}
      <BIAnalysisToolbar
        moduleKey="production"
        dimensions={[
          { label: "Top Products", value: "products" },
          { label: "Status Breakdown", value: "status" },
          { label: "Monthly Trends", value: "trends" },
        ]}
        activeDimension={activeDimension}
        onDimensionChange={setActiveDimension}
        onOpenDrillDown={() => setDrillModal({ isOpen: true, module: "production", dimension: "summary", title: "Production Work Orders Drill-Down" })}
        onOpenExport={() => setExportOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        onOpenSaved={() => setSavedOpen(true)}
      />

      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* 3. Executive KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div
          onClick={() => setDrillModal({ isOpen: true, module: "production", dimension: "summary", title: "Work Orders Overview" })}
          className="cursor-pointer"
        >
          <KpiCard
            label="Total Work Orders"
            value={loading ? "..." : fmtNum(s.total)}
            sub={`${s.inProgress || 0} in progress, ${s.completed || 0} done`}
            icon={Factory}
            color="brand"
          />
        </div>
        <div
          onClick={() => setDrillModal({ isOpen: true, module: "production", dimension: "summary", title: "Produced Finished Goods" })}
          className="cursor-pointer"
        >
          <KpiCard
            label="Produced Output"
            value={loading ? "..." : fmtNum(s.totalProduced)}
            sub="Finished good units"
            icon={CheckCircle2}
            color="success"
          />
        </div>
        <KpiCard
          label="Plant Yield"
          value={loading ? "..." : `${s.yieldRate ?? 100}%`}
          sub="Efficiency ratio"
          icon={TrendingUp}
          color={Number(s.yieldRate || 100) >= 95 ? "success" : "warning"}
        />
        <KpiCard
          label="Scrap Rate"
          value={loading ? "..." : `${s.scrapRate ?? 0}%`}
          sub="Material loss ratio"
          icon={AlertTriangle}
          color={Number(s.scrapRate || 0) <= 3 ? "success" : "danger"}
        />
        <KpiCard
          label="Machine Uptime"
          value={loading ? "..." : `${s.machineUptime ?? 0}%`}
          sub={`${s.activeMachines || 0} / ${s.totalMachines || 0} active`}
          icon={Cpu}
          color="primary"
        />
        <KpiCard
          label="QC Pass Rate"
          value={loading ? "..." : `${s.qcPassRate ?? 100}%`}
          sub={`${s.totalQc || 0} inspections`}
          icon={ShieldCheck}
          color="brand"
        />
      </div>

      {/* 4. Charts & Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Monthly Finished Goods Output Trend">
          <div className="p-5">
            {loading ? (
              <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <MiniBar
                data={data?.outputTrend || []}
                valueKey="produced"
                labelKey="month"
                color="#0E3646"
                height={130}
              />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Work Orders Distribution by Status">
          <div className="p-5 space-y-3.5">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))
            ) : !data?.byStatus?.length ? (
              <div className="py-6 text-center text-slate-400 text-xs">No work orders recorded</div>
            ) : (
              data.byStatus.map((st) => (
                <StatusBar
                  key={st.status}
                  label={st.status}
                  value={st.count}
                  total={totalOrders}
                  color={STAT_COLORS[st.status] || "#94a3b8"}
                />
              ))
            )}
          </div>
        </SectionCard>
      </div>

      {/* 5. Top Manufactured Goods with Drill-Down */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Top Manufactured Products (Click to Drill In)" className="lg:col-span-2">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={[
                { key: "idx", label: "#", className: "text-slate-400 font-bold w-8", render: (_, __, i) => i + 1 },
                {
                  key: "item_name",
                  label: "Product Name",
                  className: "font-semibold text-slate-800 dark:text-slate-200",
                  render: (v) => (
                    <button
                      onClick={() => setDrillModal({ isOpen: true, module: "production", dimension: "summary", title: `Work Orders for ${v}` })}
                      className="font-semibold text-left text-brand-700 dark:text-brand-300 hover:underline flex items-center gap-1.5"
                    >
                      <span>{v}</span>
                      <Layers size={11} className="text-slate-400" />
                    </button>
                  )
                },
                { key: "item_code", label: "Item / BOM Code", className: "text-slate-400 font-mono text-xs" },
                { key: "runs", label: "Runs", className: "text-slate-600 dark:text-slate-400 text-right", render: v => fmtNum(v) },
                { key: "total_qty", label: "Produced Qty", className: "text-brand-700 dark:text-brand-300 font-bold text-right", render: v => `${fmtNum(v)} units` },
              ]}
              rows={(data?.topProducts || []).map((r, i) => ({ ...r, idx: i + 1 }))}
              emptyMessage="No production runs recorded yet."
            />
          )}
        </SectionCard>

        {/* Shop Floor Health Card */}
        <SectionCard title="Shop Floor Health">
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-medium">Active Recipes (BOMs)</span>
              <span className="text-sm font-bold text-slate-800 dark:text-white">
                {s.activeBoms ?? 0} active
              </span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-medium">Total Machines Online</span>
              <span className="text-sm font-bold text-slate-800 dark:text-white">
                {s.activeMachines ?? 0} / {s.totalMachines ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-medium">QC Pass Rate</span>
              <span className="text-sm font-bold text-green-600">
                {s.qcPassRate ?? 100}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Material Scrap Loss</span>
              <span className={`text-sm font-bold ${Number(s.scrapRate || 0) > 3 ? "text-red-600" : "text-slate-800 dark:text-white"}`}>
                {s.scrapRate ?? 0}%
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Workflow Modals */}
      <BIDrillDownModal
        isOpen={drillModal.isOpen}
        onClose={() => setDrillModal({ ...drillModal, isOpen: false })}
        initialModule={drillModal.module}
        initialDimension={drillModal.dimension}
        initialTitle={drillModal.title}
        filters={drillModal.filters || filters}
      />

      <BIExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Production Intelligence & Shop Floor Analytics"
        moduleName="Production"
        filters={filters}
        kpis={kpisForExport}
        columns={exportTableColumns}
        rows={data?.topProducts || []}
      />

      <BIShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Production Intelligence & Shop Floor Analytics"
        moduleKey="production"
        filters={filters}
      />

      <BISavedAnalysesModal
        isOpen={savedOpen}
        onClose={() => setSavedOpen(false)}
        moduleKey="production"
        onLoadAnalysis={(a) => {
          setFilters(a.filters || {});
        }}
      />
    </div>
  );
}
