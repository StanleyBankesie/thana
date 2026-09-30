/**
 * @fileoverview Data Explorer — self-service query builder for BI module.
 */
import React, { useState } from "react";
import { Database, Play, Download } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, SectionCard, MiniBar, DataTable } from "./bi.shared.jsx";

const MODULES_CONFIG = [
  { label: "Sales (Invoices)", endpoint: "/bi/financial", resultKey: "revenueTrend", chartValueKey: "revenue", chartLabelKey: "month", columns: [{ key: "month", label: "Month" }, { key: "revenue", label: "Revenue (GHS)" }, { key: "invoices", label: "# Invoices" }] },
  { label: "Purchase (Orders)", endpoint: "/bi/purchase", resultKey: "spendTrend", chartValueKey: "spend", chartLabelKey: "month", columns: [{ key: "month", label: "Month" }, { key: "spend", label: "Spend (GHS)" }, { key: "orders", label: "# Orders" }] },
  { label: "Inventory (by Category)", endpoint: "/bi/inventory", resultKey: "byCategory", chartValueKey: "totalQty", chartLabelKey: "category_name", columns: [{ key: "category_name", label: "Category" }, { key: "itemCount", label: "Items" }, { key: "totalQty", label: "Total Qty" }] },
  { label: "Projects (by Status)", endpoint: "/bi/projects", resultKey: "byStatus", chartValueKey: "count", chartLabelKey: "status", columns: [{ key: "status", label: "Status" }, { key: "count", label: "Count" }] },
  { label: "Transport (Trips Trend)", endpoint: "/bi/transport", resultKey: "tripsTrend", chartValueKey: "trips", chartLabelKey: "month", columns: [{ key: "month", label: "Month" }, { key: "trips", label: "Trips" }] },
  { label: "POS (Daily Sales)", endpoint: "/bi/pos", resultKey: "dailyTrend", chartValueKey: "sales", chartLabelKey: "day", columns: [{ key: "day", label: "Day" }, { key: "sales", label: "Sales (GHS)" }, { key: "txns", label: "Txns" }] },
  { label: "HR (by Department)", endpoint: "/bi/hr", resultKey: "byDepartment", chartValueKey: "count", chartLabelKey: "department_name", columns: [{ key: "department_name", label: "Department" }, { key: "count", label: "Headcount" }] },
];

const CHART_TYPES = ["Bar Chart", "Data Table", "Both"];
const BAR_COLORS = ["#0E3646", "#F57C00", "#2E8B1F", "#3b86a8", "#ef4444", "#5fa2c4"];

export default function DataExplorer() {
  const [selectedModule, setSelectedModule] = useState(null);
  const [chartType, setChartType] = useState(CHART_TYPES[2]);
  const [colorIdx, setColorIdx] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    if (!selectedModule) return;
    setLoading(true); setError(null); setData(null);
    try {
      const cfg = MODULES_CONFIG.find(m => m.label === selectedModule);
      const res = await api.get(cfg.endpoint);
      const raw = res.data?.data?.[cfg.resultKey] || [];
      setData({ rows: raw, cfg });
    } catch (e) { setError(e?.response?.data?.message || "Query failed."); }
    finally { setLoading(false); }
  };

  const exportCsv = () => {
    if (!data?.rows?.length) return;
    const headers = data.cfg.columns.map(c => c.label).join(",");
    const rows = data.rows.map(r => data.cfg.columns.map(c => JSON.stringify(r[c.key] ?? "")).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${selectedModule}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Data Explorer" description="Self-service analytics — select a dataset, visualize, and export" />

      <SectionCard title="Query Builder">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Dataset</label>
              <select className="input w-full text-sm" value={selectedModule || ""} onChange={e => { setSelectedModule(e.target.value); setData(null); }}>
                <option value="">Select a dataset...</option>
                {MODULES_CONFIG.map(m => <option key={m.label}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Display As</label>
              <select className="input w-full text-sm" value={chartType} onChange={e => setChartType(e.target.value)}>
                {CHART_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Bar Color</label>
              <div className="flex items-center gap-2 mt-1">
                {BAR_COLORS.map((c, i) => (
                  <button key={c} onClick={() => setColorIdx(i)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${colorIdx === i ? "border-brand-900 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={run} disabled={!selectedModule || loading} className="btn-primary text-sm px-5 gap-2">
              <Play size={13} /> Run Query
            </button>
            {data?.rows?.length > 0 && (
              <button onClick={exportCsv} className="btn-secondary text-sm px-4 gap-2">
                <Download size={13} /> Export CSV
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 text-sm">{error}</div>}

      {loading && (
        <SectionCard>
          <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i) => <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
        </SectionCard>
      )}

      {data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-900 dark:text-white">{selectedModule} — {data.rows.length} rows</h3>
          </div>

          {(chartType === "Bar Chart" || chartType === "Both") && (
            <SectionCard title="Chart View">
              <div className="p-5">
                <MiniBar data={data.rows} valueKey={data.cfg.chartValueKey} labelKey={data.cfg.chartLabelKey} color={BAR_COLORS[colorIdx]} height={120} />
              </div>
            </SectionCard>
          )}

          {(chartType === "Data Table" || chartType === "Both") && (
            <SectionCard title="Table View">
              <DataTable columns={data.cfg.columns} rows={data.rows} emptyMessage="No data returned." />
            </SectionCard>
          )}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-14 gap-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
            <Database size={22} className="text-brand-600 dark:text-brand-400" />
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Select a dataset and run your query</div>
            <div className="text-xs text-slate-400">Results will appear here as a chart and/or table</div>
          </div>
        </div>
      )}
    </div>
  );
}
