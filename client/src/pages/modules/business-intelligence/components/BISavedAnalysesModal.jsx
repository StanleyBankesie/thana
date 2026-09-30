import React, { useState, useEffect } from "react";
import {
  X, Bookmark, Trash2, ArrowRight, Clock, User
} from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../../api/client.js";

export default function BISavedAnalysesModal({
  isOpen,
  onClose,
  moduleKey = "general",
  onLoadAnalysis,
}) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadAnalyses();
    }
  }, [isOpen, moduleKey]);

  const loadAnalyses = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/bi/saved-analyses?moduleKey=${moduleKey}`);
      setAnalyses(res.data?.data || []);
    } catch {
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this saved analysis?")) return;
    try {
      await api.delete(`/bi/saved-analyses/${id}`);
      toast.success("Analysis deleted");
      loadAnalyses();
    } catch {
      toast.error("Failed to delete analysis");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-erp-xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <Bookmark size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Saved Analyses</h3>
              <p className="text-xs text-slate-400">Custom analysis views and metric snapshots</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No saved analyses for this module yet. Save your current analysis via the top action bar.
            </div>
          ) : (
            analyses.map((a) => (
              <div
                key={a.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between hover:border-brand-300 dark:hover:border-brand-800 transition-all group"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {a.title}
                  </h4>
                  {a.description && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{a.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                    {a.creator_name && (
                      <span className="flex items-center gap-1">
                        <User size={10} />
                        {a.creator_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete saved analysis"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={() => {
                      onLoadAnalysis(a);
                      onClose();
                    }}
                    className="btn-secondary text-xs px-3 py-1.5 gap-1.5 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/20"
                  >
                    <span>Load</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end">
          <button onClick={onClose} className="btn-secondary text-xs px-4 py-1.5">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
