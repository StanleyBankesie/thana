import React, { useState, useEffect } from "react";
import {
  AlertTriangle, CheckCircle2, Info, ArrowUpRight,
  TrendingDown, TrendingUp, AlertCircle, Sparkles, ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";

export default function BIInsightsPanel({ onDrillDown, onFilterFocus }) {
  const navigate = useNavigate();
  const [diagnostics, setDiagnostics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const loadDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await api.get("/bi/diagnostics");
      setDiagnostics(res.data?.data?.items || []);
    } catch {
      setDiagnostics([]);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityStyle = (sev) => {
    if (sev === "critical") {
      return {
        card: "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10",
        badge: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300",
        icon: AlertTriangle,
        iconColor: "text-red-600 dark:text-red-400",
      };
    }
    if (sev === "positive") {
      return {
        card: "border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/10",
        badge: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300",
        icon: CheckCircle2,
        iconColor: "text-green-600 dark:text-green-400",
      };
    }
    return {
      card: "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10",
      badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300",
      icon: AlertCircle,
      iconColor: "text-amber-600 dark:text-amber-400",
    };
  };

  const handleAction = (item) => {
    if (item.targetLink) {
      navigate(item.targetLink);
    } else if (onDrillDown) {
      onDrillDown(item.recommendedDimension || "summary");
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-erp-sm mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-brand-600 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Business Intelligence Insights & Exceptions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!diagnostics.length) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-erp-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
            <Sparkles size={14} className="text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Business Intelligence Insights & Exceptions</h3>
            <p className="text-xs text-slate-400">Automated exception analysis & operational opportunity detection</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 uppercase tracking-wider">
          {diagnostics.length} Active Findings
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {diagnostics.map((item) => {
          const style = getSeverityStyle(item.severity);
          const Icon = style.icon;
          return (
            <div
              key={item.id}
              className={`border rounded-xl p-4 flex flex-col justify-between transition-all hover:shadow-erp-sm ${style.card}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${style.badge}`}>
                    {item.category}
                  </span>
                  <Icon size={16} className={style.iconColor} />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                  {item.message}
                </p>
              </div>

              <button
                onClick={() => handleAction(item)}
                className="inline-flex items-center justify-between text-xs font-bold text-brand-700 dark:text-brand-300 hover:underline pt-2 border-t border-slate-200/60 dark:border-slate-800"
              >
                <span>View Analysis</span>
                <ChevronRight size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
