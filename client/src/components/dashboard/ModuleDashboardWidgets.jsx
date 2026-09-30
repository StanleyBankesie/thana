import React from "react";
import { Link, useLocation } from "react-router-dom";

const toneMap = {
  // App brand colors
  brand: {
    card: "from-brand-800 to-brand-900",
    badge: "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
    bar: "bg-brand-600",
  },
  primary: {
    card: "from-primary to-primary-dark",
    badge: "bg-primary-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    bar: "bg-primary",
  },
  secondary: {
    card: "from-secondary to-secondary-dark",
    badge: "bg-secondary-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    bar: "bg-secondary",
  },
  // Legacy tones kept for backward compat
  indigo: {
    card: "from-brand-700 to-brand-900",
    badge: "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
    bar: "bg-brand-600",
  },
  emerald: {
    card: "from-secondary to-secondary-dark",
    badge: "bg-secondary-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    bar: "bg-secondary",
  },
  amber: {
    card: "from-primary to-primary-dark",
    badge: "bg-primary-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    bar: "bg-primary",
  },
  rose: {
    card: "from-red-500 to-red-600",
    badge: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    bar: "bg-red-500",
  },
  teal: {
    card: "from-brand-700 to-brand-900",
    badge: "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
    bar: "bg-brand-500",
  },
  slate: {
    card: "from-slate-700 to-slate-800",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    bar: "bg-slate-500",
  },
};

export function getCurrentDateRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    from: toInputDate(from),
    to: toInputDate(today),
  };
}

export function toInputDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatNumber(value, options = {}) {
  return Number(value || 0).toLocaleString(undefined, options);
}

export function formatCurrency(value, prefix = "GHS") {
  return `${prefix} ${formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export function groupCounts(items, getter) {
  const map = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = String(getter(item) || "Unspecified").trim() || "Unspecified";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function sumBy(items, getter) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Number(getter(item) || 0),
    0,
  );
}

export function DashboardPageShell({
  title,
  subtitle,
  backTo,
  backLabel = "Back",
  filters = null,
  actions = [],
  children,
}) {
  // If the user navigated here from a specific page (e.g. BI Report Center),
  // use that as the back destination instead of the module default.
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const fromPath = params.get("from");
  const resolvedBackTo = fromPath || backTo;
  const resolvedBackLabel = fromPath ? "← Report Center" : backLabel;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="rounded-[28px] bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 text-white p-6 shadow-erp-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Link to={resolvedBackTo} className="btn btn-secondary">
                {resolvedBackLabel}
              </Link>
              <span className="text-xs uppercase tracking-[0.3em] text-white/60">
                Dashboard
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/75">{subtitle}</p>
            </div>
          </div>
          {(filters || actions.length > 0) && (
            <div className="flex flex-col gap-3 xl:min-w-[380px]">
              {filters ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  {filters}
                </div>
              ) : null}
              {actions.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {actions.map((action) => (
                    <Link
                      key={`${action.path}-${action.label}`}
                      to={action.path}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <span>{action.icon || "→"}</span>
                        <span>{action.label}</span>
                      </div>
                      {action.description ? (
                        <div className="mt-1 text-xs font-normal text-white/65">
                          {action.description}
                        </div>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export function MetricCard({
  title,
  value,
  helper,
  icon = "📊",
  tone = "indigo",
}) {
  const palette = toneMap[tone] || toneMap.indigo;
  return (
    <div className={`rounded-3xl bg-gradient-to-br ${palette.card} p-5 text-white shadow-lg`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
            {title}
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
          <div className="mt-2 text-sm text-white/80">{helper || "Live data"}</div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export function HorizontalBarList({
  items,
  emptyText = "No data available",
  tone = "indigo",
  valueFormatter = (value) => formatNumber(value),
}) {
  const palette = toneMap[tone] || toneMap.indigo;
  const rows = Array.isArray(items) ? items : [];
  const max = Math.max(...rows.map((item) => Number(item.value || 0)), 1);

  if (!rows.length) {
    return <div className="py-6 text-sm text-slate-500 dark:text-slate-400">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      {rows.map((item) => {
        const value = Number(item.value || 0);
        const width = Math.max((value / max) * 100, value > 0 ? 8 : 0);
        return (
          <div key={`${item.label}-${value}`} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {item.label}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${palette.badge}`}>
                {valueFormatter(value)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className={`h-full rounded-full ${palette.bar}`}
                style={{ width: `${Math.min(width, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LineTrendChart({
  data,
  series,
  emptyText = "No trend data available",
}) {
  const rows = Array.isArray(data) ? data : [];
  const defs = Array.isArray(series) ? series : [];

  if (!rows.length || !defs.length) {
    return <div className="py-6 text-sm text-slate-500 dark:text-slate-400">{emptyText}</div>;
  }

  const width = 760;
  const height = 260;
  const padding = 36;
  const colors = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b"];
  const max = Math.max(
    ...rows.flatMap((row) => defs.map((def) => Number(row[def.key] || 0))),
    1,
  );
  const step = (width - padding * 2) / Math.max(rows.length - 1, 1);
  const getX = (index) => padding + index * step;
  const getY = (value) =>
    height - padding - (Number(value || 0) / max) * (height - padding * 2);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
        {defs.map((def, index) => (
          <div key={def.key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span>{def.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full">
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#cbd5e1"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#cbd5e1"
        />
        {[0.25, 0.5, 0.75].map((fraction) => {
          const y = height - padding - fraction * (height - padding * 2);
          return (
            <line
              key={fraction}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#e2e8f0"
            />
          );
        })}
        {defs.map((def, index) => {
          const points = rows
            .map((row, rowIndex) => `${getX(rowIndex)},${getY(row[def.key])}`)
            .join(" ");
          return (
            <polyline
              key={def.key}
              points={points}
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {rows.map((row, index) => (
          <text
            key={`${row.label}-${index}`}
            x={getX(index)}
            y={height - 10}
            fontSize="10"
            textAnchor="middle"
            fill="#64748b"
          >
            {String(row.label || "").slice(-5)}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function RecordsTable({ columns, rows, emptyText = "No records found" }) {
  const items = Array.isArray(rows) ? rows : [];
  const cols = Array.isArray(columns) ? columns : [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {cols.map((column) => (
              <th
                key={column.key}
                className={`px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                  column.align === "right" ? "text-right" : ""
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(cols.length, 1)}
                className="px-3 py-6 text-sm text-slate-500 dark:text-slate-400"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            items.map((row, index) => (
              <tr
                key={row.id || row.key || index}
                className="border-b border-slate-100 text-sm last:border-0 dark:border-slate-700/60"
              >
                {cols.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-3 text-slate-700 dark:text-slate-200 ${
                      column.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {column.render ? column.render(row) : row[column.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ShortcutGrid({ items }) {
  const links = Array.isArray(items) ? items : [];
  if (!links.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {links.map((item) => (
        <Link
          key={`${item.path}-${item.label}`}
          to={item.path}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-brand-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/30 dark:hover:border-brand-700"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl shadow-sm dark:bg-slate-800">
              {item.icon || "📄"}
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {item.label}
              </div>
              {item.description ? (
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {item.description}
                </div>
              ) : null}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
