/**
 * @fileoverview Automated Business Insights & Operational Exceptions Center
 * Displays rule-based and statistical anomaly alerts, variance triggers,
 * and 1-click drill-down actions into underlying analytical datasets.
 */
import React, { useState, useEffect } from "react";
import {
  Brain, AlertTriangle, TrendingUp, TrendingDown, Sparkles,
  ArrowRight, CheckCircle2, XCircle, RefreshCw, ShieldAlert,
  ChevronRight, Lightbulb, Zap
} from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, SectionCard, KpiCard, ErrorAlert } from "./bi.shared.jsx";
import BIDrillDownModal from "./components/BIDrillDownModal.jsx";
import { toast } from "react-toastify";

export default function BusinessInsightsPage() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Drill-down Modal State
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillModule, setDrillModule] = useState("sales");
  const [drillDimension, setDrillDimension] = useState("summary");

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/bi/insights/automated");
      setInsights(res.data?.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load automated insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleDrillAction = (insight) => {
    const payload = insight.drill_down_payload || {};
    setDrillModule(payload.module || "sales");
    setDrillDimension(payload.dimension || "summary");
    setDrillModalOpen(true);
  };

  const criticalCount = insights.filter(i => i.severity === 'CRITICAL').length;
  const warningCount = insights.filter(i => i.severity === 'WARNING').length;
  const positiveCount = insights.filter(i => i.severity === 'POSITIVE').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automated Business Insights & Exceptions"
        description="Machine-driven anomaly detection and operational exception monitoring scanning enterprise trends, variances, scrap rates, and margin drops."
        onRefresh={fetchInsights}
        loading={loading}
      />

      {error && <ErrorAlert message={error} onRetry={fetchInsights} />}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Total Insights"
          value={insights.length}
          sub="Active business observations"
          icon={Brain}
          color="brand"
        />
        <KpiCard
          label="Critical Exceptions"
          value={criticalCount}
          sub="Requires immediate executive review"
          icon={ShieldAlert}
          color={criticalCount > 0 ? "danger" : "slate"}
        />
        <KpiCard
          label="Warning Alerts"
          value={warningCount}
          sub="Approaching tolerance thresholds"
          icon={AlertTriangle}
          color={warningCount > 0 ? "primary" : "slate"}
        />
        <KpiCard
          label="Positive Momentum"
          value={positiveCount}
          sub="Exceeding growth benchmarks"
          icon={TrendingUp}
          color="success"
        />
      </div>

      {/* Insights Stream */}
      <SectionCard title="Live Anomaly & Exception Stream">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
            Analyzing enterprise data models and evaluating anomaly rules...
          </div>
        ) : insights.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 italic">
            No active business exceptions detected. All operations are within normal parameters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {insights.map((ins, idx) => {
              const isCritical = ins.severity === 'CRITICAL';
              const isPositive = ins.severity === 'POSITIVE';

              return (
                <div key={idx} className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isCritical ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600' :
                        isPositive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' :
                        'bg-amber-50 dark:bg-amber-900/30 text-amber-600'
                      }`}>
                        {isCritical ? <ShieldAlert size={18} /> :
                         isPositive ? <TrendingUp size={18} /> :
                         <AlertTriangle size={18} />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isCritical ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' :
                            isPositive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' :
                            'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                          }`}>
                            {ins.category} • {ins.insight_type}
                          </span>
                          {ins.change_pct !== null && ins.change_pct !== undefined && (
                            <span className={`text-[10px] font-bold font-mono ${
                              Number(ins.change_pct) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {Number(ins.change_pct) >= 0 ? '+' : ''}{ins.change_pct}%
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {ins.title}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {ins.explanation}
                        </p>
                      </div>
                    </div>

                    {/* Drill-down action button */}
                    <button
                      onClick={() => handleDrillAction(ins)}
                      className="btn-secondary text-xs px-3 py-1.5 gap-1.5 flex items-center flex-shrink-0"
                    >
                      Investigate <ChevronRight size={13} />
                    </button>
                  </div>

                  {/* Actionable Recommendation Box */}
                  {ins.recommendation && (
                    <div className="ml-12 p-3 bg-brand-50/50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/50 rounded-xl text-xs flex items-start gap-2 text-brand-900 dark:text-brand-200">
                      <Lightbulb size={15} className="text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Recommended Action: </span>
                        <span>{ins.recommendation}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Interactive Drill-down Modal */}
      <BIDrillDownModal
        isOpen={drillModalOpen}
        onClose={() => setDrillModalOpen(false)}
        initialModule={drillModule}
        initialDimension={drillDimension}
      />
    </div>
  );
}
