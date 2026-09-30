import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Layers, ExternalLink
} from "lucide-react";
import { api } from "../../../api/client.js";
import {
  PageHeader, KpiCard, SectionCard, MiniBar, DataTable,
  ErrorAlert, fmtCurrency, fmtNum
} from "./bi.shared.jsx";
import BIFilterBar from "./components/BIFilterBar.jsx";
import BIAnalysisToolbar from "./components/BIAnalysisToolbar.jsx";
import BIInsightsPanel from "./components/BIInsightsPanel.jsx";
import BIDrillDownModal from "./components/BIDrillDownModal.jsx";
import BIExportModal from "./components/BIExportModal.jsx";
import BIShareModal from "./components/BIShareModal.jsx";
import BISavedAnalysesModal from "./components/BISavedAnalysesModal.jsx";

export default function FinancialAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Workflow Filters & Dimensions
  const [filters, setFilters] = useState({
    datePreset: "LAST_90",
    compareWith: "PREVIOUS_PERIOD",
    branchId: "",
  });
  const [activeDimension, setActiveDimension] = useState("customers");

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
      if (filters.compareWith) q.append("compareWith", filters.compareWith);

      const res = await api.get(`/bi/financial?${q.toString()}`);
      setData(res.data?.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load financial analytics.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Period Comparison Metrics Calculation
  const compMetrics = useMemo(() => {
    const revTrend = data?.revenueTrend || [];
    const purchTrend = data?.purchaseTrend || [];
    
    const currRev = revTrend.length > 0 ? Number(revTrend[revTrend.length - 1]?.revenue || 0) : 0;
    const prevRev = revTrend.length > 1 ? Number(revTrend[revTrend.length - 2]?.revenue || 0) : 0;
    const revDiff = currRev - prevRev;
    const revGrowth = prevRev > 0 ? (revDiff / prevRev) * 100 : 0;

    const currSpend = purchTrend.length > 0 ? Number(purchTrend[purchTrend.length - 1]?.spend || 0) : 0;
    const prevSpend = purchTrend.length > 1 ? Number(purchTrend[purchTrend.length - 2]?.spend || 0) : 0;
    const spendDiff = currSpend - prevSpend;
    const spendGrowth = prevSpend > 0 ? (spendDiff / prevSpend) * 100 : 0;

    const grossMargin = currRev > 0 ? ((currRev - currSpend) / currRev) * 100 : 0;

    return {
      currRev, prevRev, revDiff, revGrowth,
      currSpend, prevSpend, spendDiff, spendGrowth,
      grossMargin
    };
  }, [data]);

  const openDrillForCustomer = (row) => {
    setDrillModal({
      isOpen: true,
      module: "sales",
      dimension: "invoices",
      title: `Revenue Drill-Down: ${row.customer_name}`,
      filters: { ...filters, customerId: row.id },
    });
  };

  const openDrillForSupplier = (row) => {
    setDrillModal({
      isOpen: true,
      module: "purchase",
      dimension: "orders",
      title: `Spend Drill-Down: ${row.supplier_name}`,
      filters: { ...filters, supplierId: row.id },
    });
  };

  const kpisForExport = [
    { label: "Current Period Revenue", value: fmtCurrency(compMetrics.currRev), sub: `${compMetrics.revGrowth >= 0 ? "+" : ""}${compMetrics.revGrowth.toFixed(1)}% vs prior` },
    { label: "Purchase Spend", value: fmtCurrency(compMetrics.currSpend), sub: `${compMetrics.spendGrowth >= 0 ? "+" : ""}${compMetrics.spendGrowth.toFixed(1)}% vs prior` },
    { label: "Gross Margin", value: `${compMetrics.grossMargin.toFixed(1)}%`, sub: "Estimated operational margin" },
  ];

  const exportTableColumns = [
    { key: "name", label: "Party Name" },
    { key: "type", label: "Type" },
    { key: "amount", label: "Amount (GHS)" },
    { key: "txns", label: "Transactions" },
  ];

  const exportTableRows = [
    ...(data?.topCustomers || []).map(c => ({ name: c.customer_name, type: "Customer Revenue", amount: Number(c.revenue || 0), txns: c.invoices })),
    ...(data?.topSuppliers || []).map(s => ({ name: s.supplier_name, type: "Supplier Spend", amount: Number(s.spend || 0), txns: s.orders })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Intelligence & Analytics"
        description="Comprehensive revenue variance, spend analysis, profit contribution, and transaction drill-down"
        onRefresh={load}
        loading={loading}
      />

      {/* 1. Multi-Dimensional Filter Bar */}
      <BIFilterBar
        moduleKey="financial"
        filters={filters}
        onFilterChange={setFilters}
        onApply={load}
        onReset={() => setFilters({ datePreset: "LAST_90", compareWith: "PREVIOUS_PERIOD", branchId: "" })}
        loading={loading}
      />

      {/* 2. Automated Business Insights & Opportunity Panel */}
      <BIInsightsPanel
        onDrillDown={(dim) => setDrillModal({ isOpen: true, module: "sales", dimension: dim, title: "Drill Down Analysis" })}
      />

      {/* 3. Analysis & Dimension Toolbar */}
      <BIAnalysisToolbar
        moduleKey="financial"
        dimensions={[
          { label: "Top Customers", value: "customers" },
          { label: "Top Suppliers", value: "suppliers" },
          { label: "Monthly Trends", value: "trends" },
        ]}
        activeDimension={activeDimension}
        onDimensionChange={setActiveDimension}
        onOpenDrillDown={() => setDrillModal({ isOpen: true, module: "sales", dimension: "branch", title: "Revenue by Branch Drill-Down" })}
        onOpenExport={() => setExportOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        onOpenSaved={() => setSavedOpen(true)}
      />

      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* 4. Comparative Period Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Revenue Card with Variance Badge */}
        <div
          onClick={() => setDrillModal({ isOpen: true, module: "sales", dimension: "branch", title: "Revenue by Branch Drill-Down" })}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-erp-sm hover:shadow-erp transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue (Filtered Period)</span>
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
            {fmtCurrency(compMetrics.currRev)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-md ${
              compMetrics.revGrowth >= 0 ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300" : "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300"
            }`}>
              {compMetrics.revGrowth >= 0 ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
              {compMetrics.revGrowth >= 0 ? "+" : ""}{compMetrics.revGrowth.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400">
              {compMetrics.revDiff >= 0 ? "+" : ""}{fmtCurrency(compMetrics.revDiff)} vs prior
            </span>
          </div>
        </div>

        {/* Purchase Spend Card with Variance */}
        <div
          onClick={() => setDrillModal({ isOpen: true, module: "purchase", dimension: "supplier", title: "Spend by Supplier Drill-Down" })}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-erp-sm hover:shadow-erp transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Purchase Spend</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 flex items-center justify-center">
              <ShoppingCart size={16} />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
            {fmtCurrency(compMetrics.currSpend)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-md ${
              compMetrics.spendGrowth <= 0 ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300" : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
            }`}>
              {compMetrics.spendGrowth >= 0 ? "+" : ""}{compMetrics.spendGrowth.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400">vs prior period</span>
          </div>
        </div>

        {/* Gross Margin Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-erp-sm hover:shadow-erp transition-all">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimated Gross Margin</span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
            {compMetrics.grossMargin.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Net Revenue: {fmtCurrency(compMetrics.currRev - compMetrics.currSpend)}
          </p>
        </div>
      </div>

      {/* 5. Analytical Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Revenue Trend (Period Comparison)">
          <div className="p-5">
            {loading ? (
              <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <MiniBar data={data?.revenueTrend || []} valueKey="revenue" labelKey="month" color="#2E8B1F" height={120} />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Purchase Spend Trend (Period Comparison)">
          <div className="p-5">
            {loading ? (
              <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <MiniBar data={data?.purchaseTrend || []} valueKey="spend" labelKey="month" color="#F57C00" height={120} />
            )}
          </div>
        </SectionCard>

        {/* Top Customers with Direct Click-to-Drill */}
        <SectionCard title="Top Customers by Revenue (Click to Drill Down)">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={[
                { key: "idx", label: "#", className: "text-slate-400 font-bold w-8", render: (_, __, i) => i + 1 },
                {
                  key: "customer_name",
                  label: "Customer",
                  className: "font-semibold text-slate-800 dark:text-slate-200",
                  render: (v, row) => (
                    <button
                      onClick={() => openDrillForCustomer(row)}
                      className="font-semibold text-left text-brand-700 dark:text-brand-300 hover:underline flex items-center gap-1.5"
                    >
                      <span>{v}</span>
                      <Layers size={11} className="text-slate-400" />
                    </button>
                  )
                },
                { key: "revenue", label: "Revenue", className: "text-secondary font-bold text-right", render: v => fmtCurrency(v) },
                { key: "invoices", label: "Invoices", className: "text-slate-500 text-right", render: v => fmtNum(v) },
              ]}
              rows={(data?.topCustomers || []).map((r, i) => ({ ...r, idx: i + 1 }))}
              emptyMessage="No customer data found for current filters."
            />
          )}
        </SectionCard>

        {/* Top Suppliers with Direct Click-to-Drill */}
        <SectionCard title="Top Suppliers by Spend (Click to Drill Down)">
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
                  label: "Supplier",
                  className: "font-semibold text-slate-800 dark:text-slate-200",
                  render: (v, row) => (
                    <button
                      onClick={() => openDrillForSupplier(row)}
                      className="font-semibold text-left text-brand-700 dark:text-brand-300 hover:underline flex items-center gap-1.5"
                    >
                      <span>{v}</span>
                      <Layers size={11} className="text-slate-400" />
                    </button>
                  )
                },
                { key: "spend", label: "Spend", className: "text-primary font-bold text-right", render: v => fmtCurrency(v) },
                { key: "orders", label: "Orders", className: "text-slate-500 text-right", render: v => fmtNum(v) },
              ]}
              rows={(data?.topSuppliers || []).map((r, i) => ({ ...r, idx: i + 1 }))}
              emptyMessage="No supplier data found for current filters."
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
        title="Financial Performance & Revenue Variance Analysis"
        moduleName="Financial"
        filters={filters}
        kpis={kpisForExport}
        columns={exportTableColumns}
        rows={exportTableRows}
      />

      <BIShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Financial Revenue & Variance Analysis"
        moduleKey="financial"
        filters={filters}
      />

      <BISavedAnalysesModal
        isOpen={savedOpen}
        onClose={() => setSavedOpen(false)}
        moduleKey="financial"
        onLoadAnalysis={(a) => {
          setFilters(a.filters || {});
        }}
      />
    </div>
  );
}
