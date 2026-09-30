import React from "react";
import {
  Download, Share2, Bookmark, Layers, TrendingUp,
  ArrowRightLeft, Sparkles, SlidersHorizontal
} from "lucide-react";

export default function BIAnalysisToolbar({
  moduleKey = "general",
  dimensions = [],
  activeDimension,
  onDimensionChange,
  onOpenExport,
  onOpenShare,
  onOpenSaved,
  onOpenDrillDown,
  recordCount = 0,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 mb-6 text-xs">
      {/* Left: Dimension switchers */}
      <div className="flex items-center gap-2 flex-wrap">
        {dimensions.length > 0 && (
          <>
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <SlidersHorizontal size={12} /> Dimension:
            </span>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
              {dimensions.map((dim) => (
                <button
                  key={dim.value}
                  onClick={() => onDimensionChange(dim.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    activeDimension === dim.value
                      ? "bg-brand-900 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-brand-900 dark:hover:text-white"
                  }`}
                >
                  {dim.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {onOpenDrillDown && (
          <button
            type="button"
            onClick={onOpenDrillDown}
            className="btn-secondary text-xs px-3 py-1.5 gap-1.5 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 bg-brand-50/50 dark:bg-brand-900/20 hover:bg-brand-100"
          >
            <Layers size={13} />
            <span>Interactive Drill-Down</span>
          </button>
        )}

        {onOpenSaved && (
          <button
            type="button"
            onClick={onOpenSaved}
            className="btn-secondary text-xs px-2.5 py-1.5 gap-1.5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
          >
            <Bookmark size={13} />
            <span>Saved Views</span>
          </button>
        )}

        {onOpenShare && (
          <button
            type="button"
            onClick={onOpenShare}
            className="btn-secondary text-xs px-2.5 py-1.5 gap-1.5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
          >
            <Share2 size={13} />
            <span>Share</span>
          </button>
        )}

        {onOpenExport && (
          <button
            type="button"
            onClick={onOpenExport}
            className="btn-secondary text-xs px-3 py-1.5 gap-1.5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 font-semibold"
          >
            <Download size={13} />
            <span>Export</span>
          </button>
        )}
      </div>
    </div>
  );
}
