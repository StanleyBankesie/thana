import React, { useState, useEffect } from "react";
import {
  X, ChevronRight, ExternalLink, ArrowDownRight,
  TrendingUp, Layers, Building2, Package, ShoppingCart, FolderKanban, Factory, CheckSquare
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { fmtCurrency, fmtNum } from "../bi.shared.jsx";

export default function BIDrillDownModal({
  isOpen,
  onClose,
  initialModule = "sales",
  initialDimension = "branch",
  initialTitle = "Revenue Breakdown",
  filters = {},
}) {
  const navigate = useNavigate();
  const [history, setHistory] = useState([
    { module: initialModule, dimension: initialDimension, title: initialTitle, filters: { ...filters } }
  ]);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeStep = history[history.length - 1];

  useEffect(() => {
    if (isOpen && activeStep) {
      loadDrillData(activeStep);
    }
  }, [isOpen, history.length]);

  const loadDrillData = async (step) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/bi/drill-down", {
        module: step.module,
        dimension: step.dimension,
        filters: step.filters,
      });
      setCurrentLevel(res.data?.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load drill-down data.");
    } finally {
      setLoading(false);
    }
  };

  const handleDrillDeeper = (item, nextDim) => {
    if (!nextDim || nextDim === "detail") return;

    let subFilters = { ...activeStep.filters };
    if (activeStep.dimension === "branch") subFilters.branchId = item.id;
    if (activeStep.dimension === "customer") subFilters.customerId = item.id;
    if (activeStep.dimension === "supplier") subFilters.supplierId = item.id;
    if (activeStep.dimension === "category") subFilters.categoryId = item.id;
    if (activeStep.dimension === "warehouse") subFilters.warehouseId = item.id;

    const newStep = {
      module: activeStep.module,
      dimension: nextDim,
      title: item.label || item.name || "Drill Down Detail",
      filters: subFilters,
    };

    setHistory([...history, newStep]);
  };

  const handleStepClick = (index) => {
    if (index === history.length - 1) return;
    setHistory(history.slice(0, index + 1));
  };

  const handleDrillThrough = (url) => {
    if (!url) return;
    onClose();
    navigate(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-erp-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-brand-900 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-300 uppercase tracking-wider mb-1">
              <Layers size={14} />
              <span>Interactive Drill-Down Engine</span>
            </div>
            <h2 className="text-lg font-bold text-white">
              {currentLevel?.levelTitle || activeStep?.title || "Analytical Drill Down"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-brand-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-slate-400">Hierarchy:</span>
          {history.map((step, idx) => {
            const isLast = idx === history.length - 1;
            return (
              <React.Fragment key={idx}>
                <button
                  onClick={() => handleStepClick(idx)}
                  disabled={isLast}
                  className={`font-semibold transition-colors ${
                    isLast
                      ? "text-brand-700 dark:text-brand-300 cursor-default"
                      : "text-slate-500 hover:text-brand-600 underline"
                  }`}
                >
                  {step.title}
                </button>
                {!isLast && <ChevronRight size={12} className="text-slate-300" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3 py-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : currentLevel?.items?.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No detailed records found for this dimension.
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold text-brand-700 dark:text-brand-400 uppercase tracking-wider">
                    Total Aggregate Value
                  </span>
                  <p className="text-xl font-bold text-brand-900 dark:text-brand-200 mt-1">
                    {activeStep.module === "production"
                      ? `${fmtNum(currentLevel?.totalAmount)} units`
                      : fmtCurrency(currentLevel?.totalAmount)}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Item / Record Count
                  </span>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {fmtNum(currentLevel?.totalCount)} records
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        Dimension / Record
                      </th>
                      <th className="py-2.5 px-4 text-slate-500 font-semibold text-xs uppercase tracking-wider text-right">
                        Metric Value
                      </th>
                      <th className="py-2.5 px-4 text-slate-500 font-semibold text-xs uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentLevel?.items?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                            {item.label}
                          </div>
                          {item.subLabel && (
                            <div className="text-xs text-slate-400 mt-0.5">{item.subLabel}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-bold text-sm text-brand-700 dark:text-brand-300">
                            {activeStep.module === "production"
                              ? `${fmtNum(item.metricValue)} units`
                              : fmtCurrency(item.metricValue)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {item.canDrillThrough && item.sourceRecordUrl ? (
                            <button
                              onClick={() => handleDrillThrough(item.sourceRecordUrl)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 dark:text-brand-300 transition-colors"
                            >
                              <span>Open in ERP</span>
                              <ExternalLink size={12} />
                            </button>
                          ) : currentLevel?.nextDimension ? (
                            <button
                              onClick={() => handleDrillDeeper(item, currentLevel.nextDimension)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
                            >
                              <span>Drill In</span>
                              <ChevronRight size={12} />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-slate-500">
          <span>Click any line item to drill into sub-dimensions or view underlying source records.</span>
          <button onClick={onClose} className="btn-secondary text-xs px-4 py-1.5">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
