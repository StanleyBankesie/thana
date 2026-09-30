import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart, Layers, ExternalLink, ArrowRight, TrendingUp, CheckCircle2, Clock
} from "lucide-react";
import { api } from "../../../api/client.js";
import {
  PageHeader, KpiCard, SectionCard, MiniBar, DataTable, StatusBar,
  ErrorAlert, fmtCurrency, fmtNum
} from "./bi.shared.jsx";
import BIFilterBar from "./components/BIFilterBar.jsx";
import BIAnalysisToolbar from "./components/BIAnalysisToolbar.jsx";
import BIDrillDownModal from "./components/BIDrillDownModal.jsx";
import BIExportModal from "./components/BIExportModal.jsx";
import BIShareModal from "./components/BIShareModal.jsx";
import BISavedAnalysesModal from "./components/BISavedAnalysesModal.jsx";

export default function PurchaseAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Workflow Filters & Dimensions
  const [filters, setFilters] = useState({
    datePreset: "THIS_MONTH",
    compareWith: "NONE",
    branchId: "",
  });
  const [activeDimension, setActiveDimension] = useState("suppliers");

  // Workflow Modals State
  const [drillModal, setDrillModal] = useState({ isOpen: false, module: "purchase", dimension: "supplier", title: "Spend by Supplier" });
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

      const res = await api.get(`/bi/purchase?${q.toString()}`);
      setData(res.data?.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load purchase analytics.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.summary || {};
  const total = Number(s.total || 0);

  const kpisForExport = [
    { label: "Total Purchase Orders", value: fmtNum(s.total), sub: "Total volume" },
    { label: "Approved / Received", value: fmtNum(s.approved), sub: "Fulfilled" },
    { label: "Pending Approval", value: fmtNum(s.pending), sub: "In workflow" },
    { label: "Total Spend", value: fmtCurrency(s.totalSpend), sub: "Procurement capital" },
  ];

  const exportTableColumns = [
    { key: "supplier_name", label: "Supplier" },
    { key: "orders", label: "Orders" },
    { key: "spend", label: "Total Spend (GHS)" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase & Procurement Intelligence"
        description="Supplier spend analysis, PO approval status distribution, and procurement volume trends"
        onRefresh={load}
        loading={loading}
      />

      {/* 1. Multi-Dimensional Filter Bar */}
      <BIFilterBar
        moduleKey="purchase"
        filters={filters}
        onFilterChange={setFilters}
        onApply={load}
        onReset={() => setFilters({ datePreset: "THIS_MONTH", compareWith: "NONE", branchId: "" })}
        loading={loading}
      />

      {/* 2. Analysis & Workflow Toolbar */}
      <BIAnalysisToolbar
        moduleKey="purchase"
        dimensions={[
          { label: "Top Suppliers", value: "suppliers" },
          { label: "Status Breakdown", value: "status" },
          { label: "Spend Trends", value: "trends" },
        ]}
        activeDimension={activeDimension}
        onDimensionChange={setActiveDimension}
        onOpenDrillDown={() => setDrillModal({ isOpen: true, module: "purchase", dimension: "supplier", title: "Spend by Supplier Drill-Down" })}
        onOpenExport={() => setExportOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        onOpenSaved={() => setSavedOpen(true)}
      />

      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* 3. Executive KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => setDrillModal({ isOpen: true, module: "purchase", dimension: "orders", title: "Purchase Orders Overview" })}
          className="cursor-pointer"
        >
          <KpiCard
            label="Total Orders"
            value={loading ? "..." : fmtNum(s.total)}
            sub="All active purchase records"
            icon={ShoppingCart}
            color="brand"
          />
        </div>
        <KpiCard
          label="Approved / Received"
          value={loading ? "..." : fmtNum(s.approved)}
          sub="Fulfilled orders"
          icon={CheckCircle2}
          color="success"
        />
        <KpiCard
          label="Pending Approval"
          value={loading ? "..." : fmtNum(s.pending)}
          sub="Requires authorization"
          icon={Clock}
          color="primary"
        />
        <div
          onClick={() => setDrillModal({ isOpen: true, module: "purchase", dimension: "supplier", title: "Spend Breakdown by Supplier" })}
          className="cursor-pointer"
        >
          <KpiCard
            label="Total Spend"
            value={loading ? "..." : fmtCurrency(s.totalSpend)}
            sub={`Avg: ${fmtCurrency(s.avgOrder || 0)}`}
            icon={TrendingUp}
            color="brand"
          />
        </div>
      </div>

      {/* 4. Charts & Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Spend Trend (Selected Period)">
          <div className="p-5">
            {loading ? (
              <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <MiniBar
                data={data?.spendTrend || []}
                valueKey="spend"
                labelKey="month"
                color="#F57C00"
                height={120}
              />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Orders by Lifecycle Status">
          <div className="p-5 space-y-3.5">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))
            ) : (
              (data?.byStatus || []).map((st) => (
                <StatusBar
                  key={st.status}
                  label={st.status}
                  value={st.count}
                  total={total}
                  color="#0E3646"
                />
              ))
            )}
          </div>
        </SectionCard>

        {/* Top Suppliers Table with Drill Down */}
        <SectionCard title="Top Suppliers by Spend (Click to Drill In)" className="lg:col-span-2">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={[
                { key: "idx", label: "#", className: "text-slate-400 font-bold w-8" },
                {
                  key: "supplier_name",
                  label: "Supplier Name",
                  className: "font-semibold text-slate-800 dark:text-slate-200",
                  render: (v, row) => (
                    <button
                      onClick={() => setDrillModal({ isOpen: true, module: "purchase", dimension: "orders", title: `Purchase Orders for ${v}`, filters: { supplierId: row.id } })}
                      className="font-semibold text-left text-brand-700 dark:text-brand-300 hover:underline flex items-center gap-1.5"
                    >
                      <span>{v}</span>
                      <Layers size={11} className="text-slate-400" />
                    </button>
                  )
                },
                { key: "orders", label: "Orders", className: "text-slate-600 dark:text-slate-300 text-right", render: v => fmtNum(v) },
                { key: "spend", label: "Total Spend", className: "text-primary font-bold text-right", render: v => fmtCurrency(v) },
              ]}
              rows={(data?.topSuppliers || []).map((r, i) => ({ ...r, idx: i + 1 }))}
              emptyMessage="No supplier records found for selected filters."
            />
          )}
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
        title="Purchase & Procurement Spend Analytics"
        moduleName="Purchase"
        filters={filters}
        kpis={kpisForExport}
        columns={exportTableColumns}
        rows={data?.topSuppliers || []}
      />

      <BIShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Purchase & Procurement Analytics"
        moduleKey="purchase"
        filters={filters}
      />

      <BISavedAnalysesModal
        isOpen={savedOpen}
        onClose={() => setSavedOpen(false)}
        moduleKey="purchase"
        onLoadAnalysis={(a) => {
          setFilters(a.filters || {});
        }}
      />
    </div>
  );
}
