/**
 * @fileoverview Alerts Center — real-time threshold alerts across all modules.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Bell, AlertTriangle, Info, XCircle, RefreshCw, CheckCircle } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, ErrorAlert } from "./bi.shared.jsx";

const SEV_CONFIG = {
  critical: { icon: XCircle,       bg: "bg-red-50 dark:bg-red-900/20",     border: "border-red-200 dark:border-red-800",   text: "text-red-700 dark:text-red-400",    badge: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300",    label: "Critical" },
  warning:  { icon: AlertTriangle,  bg: "bg-primary-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-400", badge: "bg-orange-100 dark:bg-orange-900/30 text-primary",               label: "Warning" },
  info:     { icon: Info,           bg: "bg-brand-50 dark:bg-brand-900/20", border: "border-brand-200 dark:border-brand-800", text: "text-brand-700 dark:text-brand-300", badge: "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300", label: "Info" },
};

function AlertRow({ alert, onDismiss }) {
  const cfg = SEV_CONFIG[alert.severity] || SEV_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-start gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.badge}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
          <span className="text-[10px] font-medium text-slate-400">{alert.category}</span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300">{alert.message}</p>
      </div>
      {onDismiss && (
        <button onClick={() => onDismiss(alert)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors">
          <XCircle size={13} />
        </button>
      )}
    </div>
  );
}

export default function AlertsCenter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState([]);
  const [filterSev, setFilterSev] = useState("All");
  const [filterCat, setFilterCat] = useState("All");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api.get("/bi/alerts"); setData(res.data?.data || null); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load alerts."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const allAlerts = (data?.alerts || []).filter((a, i) => !dismissed.includes(i));
  const categories = ["All", ...new Set(allAlerts.map(a => a.category))];
  const severities = ["All", "critical", "warning", "info"];

  const filtered = allAlerts.filter(a =>
    (filterSev === "All" || a.severity === filterSev) &&
    (filterCat === "All" || a.category === filterCat)
  );

  const counts = {
    critical: allAlerts.filter(a => a.severity === "critical").length,
    warning: allAlerts.filter(a => a.severity === "warning").length,
    info: allAlerts.filter(a => a.severity === "info").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Alerts Center" description="Threshold-based alerts from all ERP modules requiring attention" onRefresh={load} loading={loading}>
        {data?.generatedAt && <span className="text-xs text-white/60 hidden md:block">Updated {new Date(data.generatedAt).toLocaleTimeString()}</span>}
      </PageHeader>
      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Critical", count: counts.critical, color: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800" },
          { label: "Warning",  count: counts.warning,  color: "bg-primary-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-800" },
          { label: "Info",     count: counts.info,     color: "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border-brand-100 dark:border-brand-800" },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-4 text-center ${c.color}`}>
            <div className="text-2xl font-extrabold">{loading ? "..." : c.count}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {severities.map(s => (
          <button key={s} onClick={() => setFilterSev(s)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${filterSev === s ? "bg-brand-900 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"}`}>
            {s}
          </button>
        ))}
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
        {categories.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterCat === c ? "bg-brand-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i) => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center"><CheckCircle size={24} className="text-secondary" /></div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">No active alerts</div>
            <div className="text-xs text-slate-400">All systems are within normal operating thresholds.</div>
          </div>
        ) : (
          <div>
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{filtered.length} alert{filtered.length !== 1 ? "s" : ""}</span>
              {dismissed.length > 0 && <button onClick={() => setDismissed([])} className="text-xs text-brand-600 hover:underline">Restore dismissed ({dismissed.length})</button>}
            </div>
            {filtered.map((alert, i) => (
              <AlertRow key={i} alert={alert} onDismiss={() => setDismissed(d => [...d, allAlerts.indexOf(alert)])} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
