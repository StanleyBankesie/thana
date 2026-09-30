import React, { useState, useEffect } from "react";
import {
  Filter, Calendar, ChevronDown, RefreshCw, Bookmark,
  BookmarkPlus, X, Check, ArrowRightLeft, Building2, Layers, Search
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const DATE_PRESETS = [
  { label: "This Month", value: "THIS_MONTH" },
  { label: "Last Month", value: "LAST_MONTH" },
  { label: "This Quarter", value: "THIS_QUARTER" },
  { label: "Last Quarter", value: "LAST_QUARTER" },
  { label: "This Year", value: "THIS_YEAR" },
  { label: "Last Year", value: "LAST_YEAR" },
  { label: "Year to Date (YTD)", value: "YTD" },
  { label: "Last 30 Days", value: "LAST_30" },
  { label: "Last 90 Days", value: "LAST_90" },
  { label: "Custom Range", value: "CUSTOM" },
];

const COMPARISON_OPTIONS = [
  { label: "No Comparison", value: "NONE" },
  { label: "vs. Previous Period", value: "PREVIOUS_PERIOD" },
  { label: "vs. Previous Year (YoY)", value: "PREVIOUS_YEAR" },
  { label: "vs. Budget / Target", value: "BUDGET" },
];

export default function BIFilterBar({
  moduleKey = "general",
  filters = {},
  onFilterChange,
  onApply,
  onReset,
  loading = false,
  extraDimensions = [],
}) {
  const [branches, setBranches] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Load branches and saved filters
  useEffect(() => {
    api.get("/admin/branches").then(res => {
      setBranches(res.data?.items || res.data?.data || []);
    }).catch(() => {});

    loadSavedFilters();
  }, [moduleKey]);

  const loadSavedFilters = () => {
    api.get(`/bi/saved-filters?moduleKey=${moduleKey}`).then(res => {
      setSavedFilters(res.data?.data || []);
    }).catch(() => {});
  };

  const handlePresetSelect = (presetVal) => {
    const now = new Date();
    let from = "";
    let to = now.toISOString().slice(0, 10);

    if (presetVal === "THIS_MONTH") {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    } else if (presetVal === "LAST_MONTH") {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    } else if (presetVal === "THIS_QUARTER") {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), qStartMonth, 1).toISOString().slice(0, 10);
    } else if (presetVal === "LAST_QUARTER") {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3 - 3;
      from = new Date(now.getFullYear(), qStartMonth, 1).toISOString().slice(0, 10);
      to = new Date(now.getFullYear(), qStartMonth + 3, 0).toISOString().slice(0, 10);
    } else if (presetVal === "THIS_YEAR") {
      from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    } else if (presetVal === "LAST_YEAR") {
      from = new Date(now.getFullYear() - 1, 0, 1).toISOString().slice(0, 10);
      to = new Date(now.getFullYear() - 1, 11, 31).toISOString().slice(0, 10);
    } else if (presetVal === "YTD") {
      from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    } else if (presetVal === "LAST_30") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      from = d.toISOString().slice(0, 10);
    } else if (presetVal === "LAST_90") {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      from = d.toISOString().slice(0, 10);
    }

    onFilterChange({
      ...filters,
      datePreset: presetVal,
      from: presetVal === "CUSTOM" ? filters.from : from,
      to: presetVal === "CUSTOM" ? filters.to : to,
    });
  };

  const handleSaveFilter = async () => {
    if (!filterName.trim()) {
      toast.error("Please enter a filter name");
      return;
    }
    try {
      await api.post("/bi/saved-filters", {
        filter_name: filterName.trim(),
        module_key: moduleKey,
        filter_payload: filters,
        is_default: isDefault,
      });
      toast.success("Filter configuration saved!");
      setShowSaveModal(false);
      setFilterName("");
      loadSavedFilters();
    } catch {
      toast.error("Failed to save filter");
    }
  };

  const handleLoadSavedFilter = (f) => {
    if (!f) return;
    onFilterChange(f.filter_payload || {});
    toast.info(`Loaded filter: ${f.filter_name}`);
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => v !== undefined && v !== "" && v !== null && k !== "compareWith" && v !== "NONE" && v !== "all"
  ).length;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-erp-sm mb-6 transition-all">
      {/* Top Main Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-900 dark:text-brand-300 uppercase tracking-wider mr-1">
            <Filter size={14} className="text-brand-600 dark:text-brand-400" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-brand-700 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </div>

          {/* Date Presets Dropdown */}
          <select
            value={filters.datePreset || "LAST_30"}
            onChange={(e) => handlePresetSelect(e.target.value)}
            className="input text-xs py-1.5 px-2.5 font-medium bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {/* Comparison Selector */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
            <ArrowRightLeft size={12} className="text-slate-400" />
            <select
              value={filters.compareWith || "PREVIOUS_PERIOD"}
              onChange={(e) => onFilterChange({ ...filters, compareWith: e.target.value })}
              className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              {COMPARISON_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
            <Building2 size={12} className="text-slate-400" />
            <select
              value={filters.branchId || "all"}
              onChange={(e) => onFilterChange({ ...filters, branchId: e.target.value === "all" ? "" : e.target.value })}
              className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Inputs if Custom Range */}
          {filters.datePreset === "CUSTOM" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.from || ""}
                onChange={(e) => onFilterChange({ ...filters, from: e.target.value })}
                className="input text-xs py-1 px-2"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={filters.to || ""}
                onChange={(e) => onFilterChange({ ...filters, to: e.target.value })}
                className="input text-xs py-1 px-2"
              />
            </div>
          )}

          {/* Extra Dimension Filters (e.g. Category, Status) */}
          {extraDimensions.map((dim) => (
            <select
              key={dim.key}
              value={filters[dim.key] || "all"}
              onChange={(e) => onFilterChange({ ...filters, [dim.key]: e.target.value === "all" ? "" : e.target.value })}
              className="input text-xs py-1.5 px-2.5 font-medium bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
            >
              <option value="all">{dim.label}: All</option>
              {(dim.options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Saved Filters Selector */}
          {savedFilters.length > 0 && (
            <select
              onChange={(e) => {
                const found = savedFilters.find((f) => String(f.id) === e.target.value);
                if (found) handleLoadSavedFilter(found);
              }}
              defaultValue=""
              className="input text-xs py-1.5 px-2.5 font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-800 dark:text-brand-300 border-brand-200 dark:border-brand-800 rounded-lg cursor-pointer"
            >
              <option value="" disabled>Saved Filters...</option>
              {savedFilters.map((sf) => (
                <option key={sf.id} value={sf.id}>{sf.filter_name} {sf.is_default ? "★" : ""}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowSaveModal(true)}
            title="Save this filter"
            className="p-1.5 text-slate-500 hover:text-brand-700 dark:hover:text-brand-300 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          >
            <BookmarkPlus size={14} />
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={onReset}
              className="btn-secondary text-xs px-2.5 py-1 text-slate-500 hover:text-red-600 gap-1 border-slate-200 dark:border-slate-700"
            >
              <X size={12} /> Clear
            </button>
          )}

          <button
            onClick={onApply}
            disabled={loading}
            className="btn-primary text-xs px-3.5 py-1.5 gap-1.5"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Apply Filters
          </button>
        </div>
      </div>

      {/* Save Filter Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-erp-lg animate-in fade-in">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Save Filter Preset</h3>
            <p className="text-xs text-slate-500 mb-4">Save the current filter configuration for quick access anytime.</p>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Filter Name *</label>
                <input
                  type="text"
                  className="input w-full text-xs"
                  placeholder="e.g., Q2 Accra Production Runs"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  autoFocus
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded text-brand-600"
                />
                <span>Set as default filter for this dashboard</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowSaveModal(false)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFilter}
                className="btn-primary text-xs px-4 py-1.5"
              >
                Save Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
