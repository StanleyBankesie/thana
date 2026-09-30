/**
 * @fileoverview BI Multidimensional Analysis & OLAP Slicing Tool
 * Allows selecting Measure + Dimension + Comparison (Period-over-Period, Year-over-Year, Target)
 * with dynamic multi-chart rendering, pivot aggregation grids, drill-downs, and advanced Excel export.
 */
import React, { useState, useEffect } from "react";
import {
  BarChart3, LineChart, PieChart, Table as TableIcon, Download,
  Filter, Play, ArrowUpRight, ArrowDownRight, RefreshCw, Layers,
  ChevronRight, Sparkles, TrendingUp
} from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, SectionCard, MiniBar, DataTable, fmtCurrency, ErrorAlert } from "./bi.shared.jsx";
import BIDrillDownModal from "./components/BIDrillDownModal.jsx";
import { toast } from "react-toastify";

const MEASURES = [
  { key: "revenue", label: "Revenue (GHS)", unit: "GHS" },
  { key: "cost", label: "Cost of Goods (GHS)", unit: "GHS" },
  { key: "gross_profit", label: "Gross Profit (GHS)", unit: "GHS" },
  { key: "margin_pct", label: "Profit Margin (%)", unit: "%" },
  { key: "quantity", label: "Units Sold (Qty)", unit: "Units" },
  { key: "transactions", label: "Transaction Count", unit: "Count" },
];

const DIMENSIONS = [
  { key: "month", label: "Time (Month)" },
  { key: "quarter", label: "Time (Quarter)" },
  { key: "year", label: "Time (Year)" },
  { key: "branch", label: "Branch Location" },
  { key: "customer", label: "Customer" },
  { key: "product", label: "Product / Item" },
  { key: "category", label: "Product Category" },
];

const COMPARISONS = [
  { key: "PREVIOUS_PERIOD", label: "vs. Previous Period" },
  { key: "TARGET", label: "vs. Target / Benchmark" },
  { key: "NONE", label: "No Comparison" },
];

const VIEW_MODES = ["Both", "Chart Only", "Table Only"];

export default function MultidimensionalAnalysisPage() {
  const [selectedMeasure, setSelectedMeasure] = useState("revenue");
  const [selectedDimension, setSelectedDimension] = useState("branch");
  const [selectedComparison, setSelectedComparison] = useState("PREVIOUS_PERIOD");
  const [viewMode, setViewMode] = useState("Both");
  const [chartStyle, setChartStyle] = useState("bar"); // bar, line

  // Filters
  const [filters, setFilters] = useState({
    from: "",
    to: ""
  });

  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Drill-down Modal State
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDimension, setDrillDimension] = useState("summary");

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/bi/multidimensional-analysis", {
        measure: selectedMeasure,
        dimension: selectedDimension,
        comparison: selectedComparison,
        filters
      });
      setAnalysisData(res.data?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Analysis query failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, [selectedMeasure, selectedDimension, selectedComparison]);

  const handleExport = async (format) => {
    if (!analysisData?.items?.length) {
      toast.warn("No analysis data to export.");
      return;
    }

    try {
      const columns = [
        { key: "dimValue", label: analysisData.dimension.toUpperCase() },
        { key: "metricValue", label: analysisData.measureLabel },
        { key: "comparisonValue", label: "Comparison Value" },
        { key: "varianceAmount", label: "Variance" },
        { key: "growthPercentage", label: "Growth %" }
      ];

      const res = await api.post("/bi/export-custom", {
        format,
        title: `Multidimensional_Analysis_${selectedMeasure}_by_${selectedDimension}`,
        columns,
        rows: analysisData.items,
        summary: analysisData.summary
      }, { responseType: "blob" });

      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Analysis_${selectedMeasure}_by_${selectedDimension}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export generated successfully!");
    } catch (err) {
      toast.error("Failed to export analysis.");
    }
  };

  const handleRowDrill = (row) => {
    setDrillDimension(selectedDimension === "branch" ? "customer" : "invoices");
    setDrillDownOpen(true);
  };

  const tableColumns = [
    {
      key: "dimValue",
      label: analysisData?.dimension?.toUpperCase() || "DIMENSION",
      render: (v) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{v}</span>
      )
    },
    {
      key: "metricValue",
      label: analysisData?.measureLabel || "CURRENT VALUE",
      render: (v, row) => (
        <span className="font-mono font-semibold text-slate-900 dark:text-white text-xs">
          {analysisData?.unit === 'GHS' ? fmtCurrency(v) : `${Number(v).toLocaleString()} ${analysisData?.unit || ''}`}
        </span>
      )
    },
    {
      key: "comparisonValue",
      label: "PRIOR / BENCHMARK",
      render: (v) => (
        <span className="font-mono text-slate-500 text-xs">
          {analysisData?.unit === 'GHS' ? fmtCurrency(v) : `${Number(v).toLocaleString()} ${analysisData?.unit || ''}`}
        </span>
      )
    },
    {
      key: "growthPercentage",
      label: "VARIANCE & GROWTH",
      render: (v, row) => {
        const isPos = Number(v || 0) >= 0;
        return (
          <span className={`inline-flex items-center gap-1 font-bold text-xs font-mono ${
            isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {isPos ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {isPos ? '+' : ''}{v}%
          </span>
        );
      }
    },
    {
      key: "actions",
      label: "DRILL DOWN",
      className: "text-right",
      render: (_, row) => (
        <button
          onClick={() => handleRowDrill(row)}
          className="btn-secondary text-[11px] px-2.5 py-1 gap-1"
        >
          Drill <ChevronRight size={12} />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Multidimensional Data Analytics (OLAP)"
        description="Dynamically select business measures, dimensional hierarchies, and period-over-period comparisons to explore trends and variances."
        onRefresh={runAnalysis}
        loading={loading}
      >
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("xlsx")}
            className="btn-secondary text-xs px-3 py-1.5 gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <Download size={13} /> Export Excel
          </button>
          <button
            onClick={() => handleExport("csv")}
            className="btn-secondary text-xs px-3 py-1.5 gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </PageHeader>

      {/* Analytics Configuration Toolbar */}
      <SectionCard title="Multidimensional Query Controls">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Measure Selector */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                1. Analytical Measure
              </label>
              <select
                value={selectedMeasure}
                onChange={(e) => setSelectedMeasure(e.target.value)}
                className="input w-full text-xs font-semibold text-brand-900 dark:text-brand-300"
              >
                {MEASURES.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Dimension Selector */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                2. Primary Dimension
              </label>
              <select
                value={selectedDimension}
                onChange={(e) => setSelectedDimension(e.target.value)}
                className="input w-full text-xs font-semibold"
              >
                {DIMENSIONS.map(d => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Comparison Selector */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                3. Comparison Period
              </label>
              <select
                value={selectedComparison}
                onChange={(e) => setSelectedComparison(e.target.value)}
                className="input w-full text-xs font-semibold"
              >
                {COMPARISONS.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* View Mode */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                4. Visualization Layout
              </label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="input w-full text-xs font-semibold"
              >
                {VIEW_MODES.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </SectionCard>

      {error && <ErrorAlert message={error} onRetry={runAnalysis} />}

      {/* Analysis Results Summary */}
      {analysisData && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Aggregation</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {analysisData.unit === 'GHS' ? fmtCurrency(analysisData.summary?.total) : `${Number(analysisData.summary?.total || 0).toLocaleString()} ${analysisData.unit}`}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Group Average</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {analysisData.unit === 'GHS' ? fmtCurrency(analysisData.summary?.average) : `${Number(analysisData.summary?.average || 0).toLocaleString()} ${analysisData.unit}`}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Peak Value</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {analysisData.unit === 'GHS' ? fmtCurrency(analysisData.summary?.max) : `${Number(analysisData.summary?.max || 0).toLocaleString()} ${analysisData.unit}`}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dimensional Slices</div>
              <div className="text-2xl font-bold text-brand-700 dark:text-brand-300 mt-1">
                {analysisData.summary?.count}
              </div>
            </div>
          </div>

          {/* Chart View */}
          {(viewMode === "Chart Only" || viewMode === "Both") && (
            <SectionCard title={`${analysisData.measureLabel} by ${analysisData.dimension.toUpperCase()}`}>
              <div className="p-5">
                <MiniBar
                  data={analysisData.items}
                  valueKey="metricValue"
                  labelKey="dimValue"
                  color="#0E3646"
                  height={140}
                />
              </div>
            </SectionCard>
          )}

          {/* Pivot Table View */}
          {(viewMode === "Table Only" || viewMode === "Both") && (
            <SectionCard title="Dimensional Aggregation Grid">
              <DataTable
                columns={tableColumns}
                rows={analysisData.items}
                emptyMessage="No analysis records found."
              />
            </SectionCard>
          )}
        </div>
      )}

      {/* Drill-down Modal */}
      <BIDrillDownModal
        isOpen={drillDownOpen}
        onClose={() => setDrillDownOpen(false)}
        initialModule="sales"
        initialDimension={drillDimension}
      />
    </div>
  );
}
