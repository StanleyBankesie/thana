/**
 * @fileoverview Executive Dashboard for the BI module.
 * Enhanced with complete workflow: Filter -> Analyze -> Drill Down -> Identify Issue -> Export/Share.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  DollarSign, ShoppingCart, Package, Users, Truck, Wrench,
  CheckSquare, Zap, TrendingUp, TrendingDown, Target, RefreshCw, ArrowRight,
  Layers, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, MiniBar, SectionCard, fmtCurrency, fmtNum, ErrorAlert } from "./bi.shared.jsx";
import BIFilterBar from "./components/BIFilterBar.jsx";
import BIAnalysisToolbar from "./components/BIAnalysisToolbar.jsx";
import BIInsightsPanel from "./components/BIInsightsPanel.jsx";
import BIDrillDownModal from "./components/BIDrillDownModal.jsx";
import BIExportModal from "./components/BIExportModal.jsx";
import BIShareModal from "./components/BIShareModal.jsx";
import BISavedAnalysesModal from "./components/BISavedAnalysesModal.jsx";

function KpiTile({ label, value, sub, growth, icon: Icon, color = "brand", onClick }) {
  const colors = {
    brand:   "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-300",
    primary: "bg-primary-50 dark:bg-orange-900/20 text-primary dark:text-orange-400",
    success: "bg-secondary-50 dark:bg-green-900/20 text-secondary dark:text-green-400",
    danger:  "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    slate:   "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  };
  const isPositive = growth == null || Number(growth) >= 0;
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-erp-sm hover:shadow-erp transition-all ${onClick ? "cursor-pointer group hover:border-brand-300 dark:hover:border-brand-700" : ""}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-tight">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none mb-2">{value}</p>
      <div className="flex items-center gap-2">
        {growth != null && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isPositive ? "text-secondary" : "text-red-500"}`}>
            {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isPositive ? "+" : ""}{Number(growth || 0).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

function StatusPie({ data = [] }) {
  const total = data.reduce((s, d) => s + Number(d.count || 0), 0);
  const barColors = ["#0E3646", "#F57C00", "#2E8B1F", "#ef4444", "#3b86a8", "#5fa2c4"];
  return (
    <div className="space-y-3 mt-1">
      {data.map((d, i) => {
        const count = Number(d.count || 0);
        const w = total > 0 ? (count / total * 100).toFixed(0) : 0;
        return (
          <div key={d.status}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">{d.status}</span>
              <span className="text-slate-500">{fmtNum(count)} ({w}%)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: barColors[i % barColors.length] }} />
            </div>
          </div>
        );
      })}
      {!data.length && <div className="text-xs text-slate-400 text-center py-4">No data</div>}
    </div>
  );
}

export default function ExecutiveDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Workflow Filters & Dimensions
  const [filters, setFilters] = useState({
    datePreset: "THIS_MONTH",
    compareWith: "PREVIOUS_PERIOD",
    branchId: "",
  });
  const [activeDimension, setActiveDimension] = useState("overview");

  // Workflow Modals State
  const [drillModal, setDrillModal] = useState({ isOpen: false, module: "sales", dimension: "branch", title: "Revenue Analysis" });
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

      const res = await api.get(`/bi/executive-dashboard?${q.toString()}`);
      setData(res.data?.data || null);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};

  const skeleton = (n = 1) => Array.from({ length: n }, (_, i) => (
    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 animate-pulse">
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded mb-4 w-2/3" />
      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded mb-2 w-1/2" />
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
    </div>
  ));

  const kpisForExport = [
    { label: "Revenue (This Month)", value: fmtCurrency(kpis.revenue?.thisMonth), sub: `${kpis.revenue?.growth || 0}% vs last month` },
    { label: "Purchase Spend", value: fmtCurrency(kpis.expenses?.thisMonth), sub: "This month" },
    { label: "Gross Profit", value: fmtCurrency(kpis.grossProfit?.thisMonth), sub: "This month" },
    { label: "Active Projects", value: fmtNum(kpis.projects?.active), sub: `${fmtNum(kpis.projects?.total)} total` },
    { label: "Production Output", value: `${fmtNum(kpis.production?.totalProduced || 0)} units`, sub: `${kpis.production?.inProgressOrders || 0} active runs` },
    { label: "Active Employees", value: fmtNum(kpis.hr?.active), sub: "Headcount" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Intelligence Dashboard"
        description="Enterprise decision-support & cross-module performance — Revenue, Inventory, Production, Projects & Fleet"
        onRefresh={load}
        loading={loading}
      >
        {lastUpdated && (
          <span className="text-xs text-white/60 hidden md:block">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </PageHeader>

      {/* 1. Multi-Dimensional Filter Bar */}
      <BIFilterBar
        moduleKey="executive"
        filters={filters}
        onFilterChange={setFilters}
        onApply={load}
        onReset={() => setFilters({ datePreset: "THIS_MONTH", compareWith: "PREVIOUS_PERIOD", branchId: "" })}
        loading={loading}
      />

      {/* 2. Automated Business Insights & Exceptions */}
      <BIInsightsPanel
        onDrillDown={(dim) => setDrillModal({ isOpen: true, module: "sales", dimension: dim, title: "Executive Drill Down" })}
      />

      {/* 3. Analysis & Workflow Toolbar */}
      <BIAnalysisToolbar
        moduleKey="executive"
        dimensions={[
          { label: "Overview", value: "overview" },
          { label: "Revenue & Purchases", value: "finance" },
          { label: "Operations & Projects", value: "operations" },
        ]}
        activeDimension={activeDimension}
        onDimensionChange={setActiveDimension}
        onOpenDrillDown={() => setDrillModal({ isOpen: true, module: "sales", dimension: "branch", title: "Revenue by Branch Drill-Down" })}
        onOpenExport={() => setExportOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        onOpenSaved={() => setSavedOpen(true)}
      />

      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* 4. Interactive KPI Grid with Click-to-Drill */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading ? skeleton(12) : <>
          <KpiTile
            label="Revenue (This Month)"
            value={fmtCurrency(kpis.revenue?.thisMonth)}
            sub="vs last month"
            growth={kpis.revenue?.growth}
            icon={DollarSign}
            color="success"
            onClick={() => setDrillModal({ isOpen: true, module: "sales", dimension: "branch", title: "Revenue Breakdown by Branch" })}
          />
          <KpiTile
            label="Purchase Spend"
            value={fmtCurrency(kpis.expenses?.thisMonth)}
            sub="This month"
            icon={ShoppingCart}
            color="primary"
            onClick={() => setDrillModal({ isOpen: true, module: "purchase", dimension: "supplier", title: "Spend Breakdown by Supplier" })}
          />
          <KpiTile
            label="Gross Profit"
            value={fmtCurrency(kpis.grossProfit?.thisMonth)}
            sub="This month"
            icon={TrendingUp}
            color="brand"
            onClick={() => setDrillModal({ isOpen: true, module: "sales", dimension: "customer", title: "Customer Margin Drill-Down" })}
          />
          <KpiTile
            label="Inventory Items"
            value={fmtNum(kpis.inventory?.itemCount)}
            sub={`${fmtNum(kpis.inventory?.belowReorder)} below reorder`}
            icon={Package}
            color="brand"
            onClick={() => setDrillModal({ isOpen: true, module: "inventory", dimension: "category", title: "Inventory Value by Category" })}
          />
          <KpiTile
            label="Active Projects"
            value={fmtNum(kpis.projects?.active)}
            sub={`${fmtNum(kpis.projects?.total)} total`}
            icon={CheckSquare}
            color="brand"
            onClick={() => setDrillModal({ isOpen: true, module: "projects", dimension: "summary", title: "Project Portfolios & Budgets" })}
          />
          <KpiTile
            label="Production Output"
            value={`${fmtNum(kpis.production?.totalProduced || 0)} units`}
            sub={`${kpis.production?.inProgressOrders || 0} active runs`}
            icon={Zap}
            color="success"
            onClick={() => setDrillModal({ isOpen: true, module: "production", dimension: "summary", title: "Production Work Orders & Output" })}
          />
          <KpiTile label="Active Employees" value={fmtNum(kpis.hr?.active)} sub={`${fmtNum(kpis.hr?.total)} headcount`} icon={Users} color="brand" />
          <KpiTile label="POS Sales Today" value={fmtCurrency(kpis.pos?.todaySales)} sub={`${fmtNum(kpis.pos?.todayTxns)} transactions`} icon={Zap} color="primary" />
          <KpiTile label="Fleet Available" value={`${fmtNum(kpis.fleet?.available)} / ${fmtNum(kpis.fleet?.total)}`} sub={`${fmtNum(kpis.fleet?.inUse)} in use`} icon={Truck} color="brand" />
          <KpiTile label="Open Maintenance" value={fmtNum(kpis.maintenance?.openJobs)} sub="Jobs pending" icon={Wrench} color="danger" />
          <KpiTile label="All-Time Revenue" value={fmtCurrency(kpis.revenue?.allTime)} sub="Cumulative" icon={Target} color="slate" />
        </>}
      </div>

      {/* 5. Interactive Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Revenue Trend (6 Months)">
          <div className="p-5">
            {loading
              ? <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              : <MiniBar data={charts.revenueTrend || []} valueKey="revenue" labelKey="month" color="#0E3646" height={100} />}
          </div>
        </SectionCard>

        <SectionCard title="Purchase Spend Trend (6 Months)">
          <div className="p-5">
            {loading
              ? <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              : <MiniBar data={charts.purchaseTrend || []} valueKey="spend" labelKey="month" color="#F57C00" height={100} />}
          </div>
        </SectionCard>

        <SectionCard title="Project Portfolio by Status">
          <div className="p-5">
            {loading
              ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}</div>
              : <StatusPie data={charts.projectsByStatus || []} />}
          </div>
        </SectionCard>
      </div>

      {/* Quick Navigation Links */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-erp-sm">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
          Direct Module Analytics Portals
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Financial", path: "/business-intelligence/financial", icon: DollarSign, color: "text-secondary" },
            { label: "Production", path: "/business-intelligence/production", icon: Zap, color: "text-brand-600" },
            { label: "Projects", path: "/business-intelligence/projects", icon: CheckSquare, color: "text-brand-600" },
            { label: "Inventory", path: "/business-intelligence/inventory", icon: Package, color: "text-brand-600" },
            { label: "Purchase", path: "/business-intelligence/purchase", icon: ShoppingCart, color: "text-primary" },
            { label: "Cross Module", path: "/business-intelligence/cross-module", icon: Layers, color: "text-brand-600" },
          ].map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 border border-slate-200 dark:border-slate-700 hover:border-brand-300 transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-brand-700"
            >
              <item.icon size={15} className={item.color} />
              <span>{item.label}</span>
              <ArrowRight size={11} className="ml-auto text-slate-400" />
            </Link>
          ))}
        </div>
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
        title="Executive Business Intelligence Summary"
        moduleName="Executive"
        filters={filters}
        kpis={kpisForExport}
        columns={[
          { key: "metric", label: "KPI Dimension" },
          { key: "value", label: "Current Metric Value" },
          { key: "notes", label: "Operational Context" },
        ]}
        rows={kpisForExport.map(k => ({ metric: k.label, value: k.value, notes: k.sub }))}
      />

      <BIShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Executive Performance & Cross-Module Intelligence"
        moduleKey="executive"
        filters={filters}
      />

      <BISavedAnalysesModal
        isOpen={savedOpen}
        onClose={() => setSavedOpen(false)}
        moduleKey="executive"
        onLoadAnalysis={(a) => {
          setFilters(a.filters || {});
        }}
      />
    </div>
  );
}
