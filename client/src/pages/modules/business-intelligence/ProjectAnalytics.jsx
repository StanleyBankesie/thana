import React, { useState, useEffect, useCallback } from "react";
import {
  FolderKanban, CheckCircle2, Clock, DollarSign, TrendingUp,
  AlertCircle, Calendar, Layers, ExternalLink, ArrowRight
} from "lucide-react";
import { api } from "../../../api/client.js";
import {
  PageHeader, KpiCard, SectionCard, MiniBar, StatusBar,
  DataTable, ErrorAlert, fmtCurrency, fmtNum
} from "./bi.shared.jsx";
import BIFilterBar from "./components/BIFilterBar.jsx";
import BIAnalysisToolbar from "./components/BIAnalysisToolbar.jsx";
import BIDrillDownModal from "./components/BIDrillDownModal.jsx";
import BIExportModal from "./components/BIExportModal.jsx";
import BIShareModal from "./components/BIShareModal.jsx";
import BISavedAnalysesModal from "./components/BISavedAnalysesModal.jsx";

const STAT_COLORS = {
  COMPLETED: "#10b981",
  DONE: "#10b981",
  IN_PROGRESS: "#0E3646",
  "IN PROGRESS": "#0E3646",
  EXECUTION: "#0E3646",
  active: "#0E3646",
  PLANNING: "#3b82f6",
  PENDING: "#f59e0b",
  ON_HOLD: "#94a3b8",
  HOLD: "#94a3b8",
  CANCELLED: "#ef4444",
};

function StatusBadge({ status }) {
  const norm = String(status || "PLANNING").toUpperCase();
  const color = STAT_COLORS[norm] || STAT_COLORS[status] || "#94a3b8";
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-block"
      style={{ backgroundColor: color + "18", color }}
    >
      {status || "PLANNING"}
    </span>
  );
}

export default function ProjectAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Workflow Filters & Dimensions
  const [filters, setFilters] = useState({
    datePreset: "THIS_YEAR",
    compareWith: "NONE",
    branchId: "",
  });
  const [activeDimension, setActiveDimension] = useState("portfolio");

  // Workflow Modals State
  const [drillModal, setDrillModal] = useState({ isOpen: false, module: "projects", dimension: "summary", title: "Project Portfolios" });
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

      const res = await api.get(`/bi/projects?${q.toString()}`);
      setData(res.data?.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load project analytics.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.summary || {};
  const totalProjects = Number(s.total || 0);

  const kpisForExport = [
    { label: "Total Projects", value: fmtNum(s.total), sub: `${s.active || 0} active, ${s.completed || 0} completed` },
    { label: "Total Budget", value: fmtCurrency(s.totalBudget), sub: "Allocated capital" },
    { label: "Total Spend", value: fmtCurrency(s.totalExpenses), sub: "Actual expenditures" },
    { label: "Total Income", value: fmtCurrency(s.totalIncome), sub: `Net: ${fmtCurrency(s.netProfit || 0)}` },
    { label: "Task Milestones", value: `${s.completedTasks || 0} / ${s.totalTasks || 0}`, sub: `${s.overdueTasks || 0} overdue` },
    { label: "Timesheet Hours", value: `${fmtNum(s.totalHours || 0)} hrs`, sub: "Tracked labor" },
  ];

  const exportTableColumns = [
    { key: "project_name", label: "Project Name" },
    { key: "project_code", label: "Code" },
    { key: "client_name", label: "Client" },
    { key: "status", label: "Status" },
    { key: "budget", label: "Budget" },
    { key: "spent", label: "Spend" },
    { key: "income", label: "Income" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Management Intelligence & Analytics"
        description="Real-time analysis of project portfolios, task delivery milestones, budget burn rates, expenses, and profitability"
        onRefresh={load}
        loading={loading}
      />

      {/* 1. Multi-Dimensional Filter Bar */}
      <BIFilterBar
        moduleKey="projects"
        filters={filters}
        onFilterChange={setFilters}
        onApply={load}
        onReset={() => setFilters({ datePreset: "THIS_YEAR", compareWith: "NONE", branchId: "" })}
        loading={loading}
      />

      {/* 2. Analysis & Workflow Toolbar */}
      <BIAnalysisToolbar
        moduleKey="projects"
        dimensions={[
          { label: "Portfolio Table", value: "portfolio" },
          { label: "Budget Burn Rate", value: "burn" },
          { label: "Lifecycle Status", value: "status" },
        ]}
        activeDimension={activeDimension}
        onDimensionChange={setActiveDimension}
        onOpenDrillDown={() => setDrillModal({ isOpen: true, module: "projects", dimension: "summary", title: "Project Portfolios Drill-Down" })}
        onOpenExport={() => setExportOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        onOpenSaved={() => setSavedOpen(true)}
      />

      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* 3. Executive KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div
          onClick={() => setDrillModal({ isOpen: true, module: "projects", dimension: "summary", title: "Project Portfolios Overview" })}
          className="cursor-pointer"
        >
          <KpiCard
            label="Total Projects"
            value={loading ? "..." : fmtNum(s.total)}
            sub={`${s.active || 0} active, ${s.completed || 0} done`}
            icon={FolderKanban}
            color="brand"
          />
        </div>
        <KpiCard
          label="Total Budget"
          value={loading ? "..." : fmtCurrency(s.totalBudget)}
          sub="Allocated capital"
          icon={DollarSign}
          color="primary"
        />
        <KpiCard
          label="Total Expenses"
          value={loading ? "..." : fmtCurrency(s.totalExpenses)}
          sub="Actual spend to date"
          icon={TrendingUp}
          color="warning"
        />
        <KpiCard
          label="Project Income"
          value={loading ? "..." : fmtCurrency(s.totalIncome)}
          sub={`Net: ${fmtCurrency(s.netProfit || 0)}`}
          icon={DollarSign}
          color="success"
        />
        <KpiCard
          label="Task Milestones"
          value={loading ? "..." : `${s.completedTasks || 0} / ${s.totalTasks || 0}`}
          sub={`${s.overdueTasks || 0} overdue task(s)`}
          icon={CheckCircle2}
          color={Number(s.overdueTasks || 0) > 0 ? "danger" : "success"}
        />
        <KpiCard
          label="Timesheet Hours"
          value={loading ? "..." : `${fmtNum(s.totalHours || 0)} hrs`}
          sub={`${s.loggedDays || 0} active log days`}
          icon={Clock}
          color="brand"
        />
      </div>

      {/* 4. Charts & Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Projects by Lifecycle Status">
          <div className="p-5 space-y-3.5">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))
            ) : !data?.byStatus?.length ? (
              <div className="py-6 text-center text-slate-400 text-xs">No projects logged</div>
            ) : (
              data.byStatus.map((st) => (
                <StatusBar
                  key={st.status}
                  label={st.status}
                  value={st.count}
                  total={totalProjects}
                  color={STAT_COLORS[st.status] || "#94a3b8"}
                />
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Budget Burn Rate (Active Projects)">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : !data?.budgetAnalysis?.length ? (
            <div className="p-5 text-center text-slate-400 text-xs py-8">No active project budget tracking found.</div>
          ) : (
            <div className="p-5 space-y-4">
              {data.budgetAnalysis.map((p) => {
                const pct = Math.min(150, Number(p.budgetUsedPct || 0));
                const isOver = pct > 100;
                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{p.project_name}</span>
                      <span className={isOver ? "text-red-600 font-bold" : "text-slate-600 dark:text-slate-400"}>
                        {fmtCurrency(p.spent)} / {fmtCurrency(p.budget)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor: isOver ? "#ef4444" : pct > 80 ? "#f59e0b" : "#10b981",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 5. Project Portfolio Table with Direct Drill-Down */}
      <SectionCard title="Project Portfolio Performance (Click to Drill In)">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={[
              {
                key: "project_name",
                label: "Project",
                className: "font-semibold text-slate-800 dark:text-slate-200",
                render: (v, row) => (
                  <button
                    onClick={() => setDrillModal({ isOpen: true, module: "projects", dimension: "summary", title: `Project Detail: ${v}` })}
                    className="font-semibold text-left text-brand-700 dark:text-brand-300 hover:underline flex items-center gap-1.5"
                  >
                    <span>{v}</span>
                    <Layers size={11} className="text-slate-400" />
                  </button>
                )
              },
              { key: "project_code", label: "Code", className: "text-slate-400 font-mono text-xs" },
              { key: "client_name", label: "Client", className: "text-slate-600 dark:text-slate-400 text-xs" },
              {
                key: "status",
                label: "Status",
                render: v => <StatusBadge status={v} />
              },
              { key: "budget", label: "Budget", className: "text-right font-medium", render: v => fmtCurrency(v) },
              { key: "spent", label: "Expenses", className: "text-right font-medium text-amber-700 dark:text-amber-400", render: v => fmtCurrency(v) },
              { key: "income", label: "Income", className: "text-right font-bold text-green-600", render: v => fmtCurrency(v) },
              {
                key: "completion_percent",
                label: "Progress",
                className: "text-right font-semibold",
                render: v => `${Number(v || 0).toFixed(0)}%`
              },
            ]}
            rows={data?.recentProjects || []}
            emptyMessage="No projects found."
          />
        )}
      </SectionCard>

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
        title="Project Management Intelligence & Portfolio Analytics"
        moduleName="Projects"
        filters={filters}
        kpis={kpisForExport}
        columns={exportTableColumns}
        rows={data?.recentProjects || []}
      />

      <BIShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Project Portfolio Intelligence & Budget Analytics"
        moduleKey="projects"
        filters={filters}
      />

      <BISavedAnalysesModal
        isOpen={savedOpen}
        onClose={() => setSavedOpen(false)}
        moduleKey="projects"
        onLoadAnalysis={(a) => {
          setFilters(a.filters || {});
        }}
      />
    </div>
  );
}
