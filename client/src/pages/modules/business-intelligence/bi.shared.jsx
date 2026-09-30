/**
 * @fileoverview Shared page wrapper for all BI analytics pages.
 * Uses app brand colors consistently.
 */
import React from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

export function PageHeader({ title, description, onRefresh, loading, children }) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 p-6 text-white mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/business-intelligence"
            className="inline-flex items-center gap-1 text-sm text-brand-300 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft size={13} /> Business Intelligence
          </Link>
          <h1 className="text-xl font-bold">{title}</h1>
          {description && <p className="text-brand-200 text-sm mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {children}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="btn-secondary text-sm px-3 py-1.5 gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function KpiCard({ label, value, sub, icon: Icon, color = "brand" }) {
  const colorMap = {
    brand:   { bg: "bg-brand-50 dark:bg-brand-900/20",   text: "text-brand-700 dark:text-brand-300",   icon: "text-brand-600 dark:text-brand-400" },
    primary: { bg: "bg-primary-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", icon: "text-primary dark:text-orange-400" },
    success: { bg: "bg-secondary-50 dark:bg-green-900/20",text: "text-green-700 dark:text-green-300",   icon: "text-secondary dark:text-green-400" },
    danger:  { bg: "bg-red-50 dark:bg-red-900/20",        text: "text-red-700 dark:text-red-300",       icon: "text-red-600 dark:text-red-400" },
    slate:   { bg: "bg-slate-100 dark:bg-slate-800",      text: "text-slate-700 dark:text-slate-200",   icon: "text-slate-500 dark:text-slate-400" },
  };
  const c = colorMap[color] || colorMap.brand;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-erp-sm hover:shadow-erp transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em]">{label}</span>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
            <Icon size={16} className={c.icon} />
          </div>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">{value}</p>
      {sub && <p className="text-sm text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export function SectionCard({ title, children, className = "" }) {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-erp-sm overflow-hidden ${className}`}>
      {title && (
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

export function MiniBar({ data = [], valueKey, labelKey, color = "#0E3646", height = 100 }) {
  if (!data.length) return <div className="text-xs text-slate-400 italic py-6 text-center">No data available</div>;
  const max = Math.max(...data.map((d) => Number(d[valueKey] || 0)), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey] || 0);
        const h = Math.max(4, (val / max) * height);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div
              className="w-full rounded-t hover:opacity-75 transition-opacity cursor-default"
              style={{ height: h, backgroundColor: color }}
              title={`${d[labelKey]}: ${val.toLocaleString()}`}
            />
            <span className="text-[9px] text-slate-400 truncate max-w-full">{String(d[labelKey] || "").slice(-5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StatusBar({ label, value, total, color = "#0E3646" }) {
  const w = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-slate-500">{Number(value || 0).toLocaleString()} ({w.toFixed(0)}%)</span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${w}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function DataTable({ columns = [], rows = [], emptyMessage = "No data found." }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-brand-50 dark:bg-brand-900/20 border-b border-slate-100 dark:border-slate-800">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="py-3 px-4 text-brand-800 dark:text-brand-300 font-semibold uppercase tracking-wider text-xs">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="text-center py-8 text-slate-400 text-sm">{emptyMessage}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={`py-3 px-4 text-sm ${col.className || "text-slate-700 dark:text-slate-300"}`}>
                  {col.render ? col.render(row[col.key], row) : row[col.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ErrorAlert({ message, onRetry }) {
  return (
    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center justify-between">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry} className="text-sm underline font-semibold ml-4">Retry</button>}
    </div>
  );
}

export const fmtCurrency = (n) => {
  n = Number(n || 0);
  if (n >= 1_000_000) return `GHS ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `GHS ${(n / 1_000).toFixed(1)}K`;
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const fmtNum = (n) => Number(n || 0).toLocaleString();
