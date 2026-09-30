/**
 * @fileoverview AI Insights — Rules-based intelligent business insights.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw, Lightbulb } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, ErrorAlert } from "./bi.shared.jsx";

const TYPE_CONFIG = {
  positive: { icon: TrendingUp, bg: "bg-secondary-50 dark:bg-green-900/20", border: "border-secondary/30", text: "text-secondary", badge: "bg-secondary/10 text-secondary", label: "Positive" },
  warning:  { icon: AlertTriangle, bg: "bg-primary-50 dark:bg-orange-900/20", border: "border-primary/30", text: "text-primary", badge: "bg-primary/10 text-primary", label: "Warning" },
  critical: { icon: AlertTriangle, bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-300 dark:border-red-700", text: "text-red-600 dark:text-red-400", badge: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400", label: "Critical" },
  info:     { icon: Lightbulb, bg: "bg-brand-50 dark:bg-brand-900/20", border: "border-brand-200 dark:border-brand-700", text: "text-brand-700 dark:text-brand-300", badge: "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300", label: "Info" },
};

function InsightCard({ insight }) {
  const cfg = TYPE_CONFIG[insight.type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div className={`rounded-xl border p-5 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.badge}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${cfg.badge}`}>{cfg.label}</span>
            <span className="text-[10px] text-slate-400 font-medium">{insight.category}</span>
          </div>
          <h4 className={`text-sm font-bold mb-1.5 ${cfg.text}`}>{insight.title}</h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{insight.description}</p>
          {insight.recommendation && (
            <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <CheckCircle size={11} className="text-brand-500 flex-shrink-0 mt-0.5" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">{insight.recommendation}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AIInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("All");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api.get("/bi/insights"); setData(res.data?.data || null); }
    catch (e) { setError(e?.response?.data?.message || "Failed to generate insights."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const insights = data?.insights || [];
  const categories = ["All", ...new Set(insights.map(i => i.category))];
  const filtered = filter === "All" ? insights : insights.filter(i => i.category === filter);

  const counts = { total: insights.length, critical: insights.filter(i => i.type === "critical").length, warning: insights.filter(i => i.type === "warning").length, positive: insights.filter(i => i.type === "positive").length };

  return (
    <div className="space-y-6">
      <PageHeader title="AI Insights" description="Automated rules-based analysis of cross-module data patterns" onRefresh={load} loading={loading}>
        {data?.generatedAt && <span className="text-xs text-white/60 hidden md:block">Generated {new Date(data.generatedAt).toLocaleTimeString()}</span>}
      </PageHeader>
      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Insights", value: counts.total, color: "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300" },
          { label: "Critical", value: counts.critical, color: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" },
          { label: "Warnings", value: counts.warning, color: "bg-primary-50 dark:bg-orange-900/20 text-primary dark:text-orange-400" },
          { label: "Positive", value: counts.positive, color: "bg-secondary-50 dark:bg-green-900/20 text-secondary dark:text-green-400" },
        ].map(c => (
          <div key={c.label} className={`rounded-xl p-4 text-center ${c.color}`}>
            <div className="text-2xl font-extrabold">{loading ? "..." : c.value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      {categories.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filter === c ? "bg-brand-900 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Insights */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({length:4}).map((_,i) => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center"><CheckCircle size={24} className="text-secondary" /></div>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">All clear!</div>
            <div className="text-xs text-slate-400">No actionable insights detected at this time.</div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((insight, i) => <InsightCard key={i} insight={insight} />)}
        </div>
      )}

      <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100 dark:border-slate-800">
        AI Insights are generated using rules-based analysis of your live ERP data. Refresh to update.
      </div>
    </div>
  );
}
