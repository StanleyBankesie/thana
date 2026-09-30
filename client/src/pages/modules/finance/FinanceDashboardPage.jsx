/**
 * @fileoverview FinanceDashboardPage component.
 * Provides functionality for FinanceDashboardPage.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../api/client.js";

function AreaLineChart({ title, data, colorArea, colorLine }) {
  const { points, areaPath, maxY, labels } = useMemo(() => {
    const xs = data.map((d, i) => i);
    const ys = data.map((d) => Number(d.value || 0));
    const max = Math.max(...ys, 1);
    const w = 720;
    const h = 280;
    const pad = 40;
    const step = (w - pad * 2) / Math.max(xs.length - 1, 1);
    const scaleY = (v) => h - pad - (v / max) * (h - pad * 2);
    const scaleX = (i) => pad + i * step;
    const pts = ys.map((v, i) => [scaleX(i), scaleY(v)]);
    const dPath =
      "M " +
      pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ") +
      ` L ${scaleX(xs.length - 1).toFixed(1)} ${h - pad} L ${scaleX(0).toFixed(1)} ${h - pad} Z`;
    const lbls = data.map((d) => d.label);
    return { points: pts, areaPath: dPath, maxY: max, labels: lbls };
  }, [data]);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-erp p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {title}
        </div>
      </div>
      <svg
        width="100%"
        height="320"
        viewBox="0 0 760 320"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id={title.replace(/\s+/g, "_") + "_fill"}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={colorArea} stopOpacity="0.35" />
            <stop offset="100%" stopColor={colorArea} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <g>
          <rect x="0" y="0" width="760" height="320" fill="transparent" />
          <line x1="40" y1="280" x2="720" y2="280" stroke="#cbd5e1" />
          <line x1="40" y1="40" x2="40" y2="280" stroke="#cbd5e1" />
          {[0.25, 0.5, 0.75].map((t, i) => {
            const y = 280 - t * (280 - 40);
            return (
              <line key={i} x1="40" y1={y} x2="720" y2={y} stroke="#e2e8f0" />
            );
          })}
          <path
            d={areaPath}
            fill={`url(#${title.replace(/\s+/g, "_") + "_fill"})`}
          />
          <polyline
            fill="none"
            stroke={colorLine}
            strokeWidth="2.5"
            points={points.map(([x, y]) => `${x},${y}`).join(" ")}
          />
          {points.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill={colorLine} />
          ))}
          {labels.map((lbl, idx) => (
            <text
              key={idx}
              x={40 + idx * ((720 - 80) / Math.max(labels.length - 1, 1))}
              y={300}
              fontSize="10"
              textAnchor="middle"
              fill="#64748b"
            >
              {lbl}
            </text>
          ))}
          <text x="16" y="18" fontSize="10" fill="#94a3b8">
            0
          </text>
          <text x="16" y="48" fontSize="10" fill="#94a3b8">
            {Math.round((maxY * 3) / 4).toLocaleString()}
          </text>
          <text x="16" y="88" fontSize="10" fill="#94a3b8">
            {Math.round(maxY / 2).toLocaleString()}
          </text>
          <text x="16" y="128" fontSize="10" fill="#94a3b8">
            {Math.round(maxY / 4).toLocaleString()}
          </text>
        </g>
      </svg>
    </div>
  );
}

function fmtShort(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(1) + "T";
  if (abs >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toLocaleString();
}

function SimpleBarChart({ title, data, color = "#10b981", palette = [] }) {
  const max = Math.max(...data.map((d) => Number(d.value || 0)), 1);
  const w = 760;
  const h = 320;
  const pad = 40;
  const barW = Math.max(12, (w - pad * 2) / Math.max(data.length * 1.6, 1));
  const step = (w - pad * 2) / Math.max(data.length, 1);
  const depth = 6;
  const colors =
    palette && palette.length
      ? palette
      : [
          "#4f46e5",
          "#06b6d4",
          "#22c55e",
          "#f59e0b",
          "#a855f7",
          "#ef4444",
          "#14b8a6",
          "#8b5cf6",
          "#f97316",
          "#0ea5e9",
          "#10b981",
        ];
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-erp p-4">
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
        {title}
      </div>
      <svg width="100%" height="320" viewBox="0 0 760 320">
        <line
          x1={pad}
          y1={h - pad}
          x2={w - pad}
          y2={h - pad}
          stroke="#cbd5e1"
        />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#cbd5e1" />
        {[0.25, 0.5, 0.75].map((t, i) => {
          const y = h - pad - t * (h - pad * 2);
          return (
            <line
              key={i}
              x1={pad}
              y1={y}
              x2={w - pad}
              y2={y}
              stroke="#e2e8f0"
            />
          );
        })}
        {data.map((d, i) => {
          const x = pad + i * step + (step - barW) / 2;
          const vh = ((Number(d.value || 0) / max) * (h - pad * 2)) | 0;
          const y = h - pad - vh;
          return (
            <g key={i}>
              <polygon
                points={`${x + barW},${y} ${x + barW + depth},${y - depth} ${x + barW + depth},${y - depth + vh} ${x + barW},${y + vh}`}
                fill="#0f172a20"
              />
              <rect
                x={x}
                y={y}
                width={barW}
                height={vh}
                fill={
                  palette && palette.length ? colors[i % colors.length] : color
                }
                rx="2"
              />
              <polygon
                points={`${x},${y} ${x + barW},${y} ${x + barW + depth},${y - depth} ${x + depth},${y - depth}`}
                fill="#ffffff40"
              />
              <text
                x={x + barW / 2}
                y={y - 6}
                fontSize="10"
                textAnchor="middle"
                fill="#334155"
              >
                {fmtShort(d.value)}
              </text>
              <text
                x={x + barW / 2}
                y={h - pad + 12}
                fontSize="10"
                textAnchor="middle"
                fill="#64748b"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TwoSeriesBarChart({
  title,
  aLabel,
  bLabel,
  data,
  colorA = "#16a34a",
  colorB = "#ef4444",
}) {
  const max = Math.max(
    ...data.flatMap((d) => [Number(d.a || 0), Number(d.b || 0)]),
    1,
  );
  const w = 760;
  const h = 320;
  const pad = 40;
  const step = (w - pad * 2) / Math.max(data.length, 1);
  const groupW = Math.max(20, step * 0.65);
  const barW = Math.max(10, groupW / 2 - 6);
  const depth = 6;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-erp p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {title}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ background: colorA }}
            />
            {aLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ background: colorB }}
            />
            {bLabel}
          </span>
        </div>
      </div>
      <svg width="100%" height="320" viewBox="0 0 760 320">
        <line
          x1={pad}
          y1={h - pad}
          x2={w - pad}
          y2={h - pad}
          stroke="#cbd5e1"
        />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#cbd5e1" />
        {[0.25, 0.5, 0.75].map((t, i) => {
          const y = h - pad - t * (h - pad * 2);
          return (
            <line
              key={i}
              x1={pad}
              y1={y}
              x2={w - pad}
              y2={y}
              stroke="#e2e8f0"
            />
          );
        })}
        {data.map((d, i) => {
          const x0 = pad + i * step + (step - groupW) / 2;
          const aVal = Number(d.a || 0);
          const bVal = Number(d.b || 0);
          const aH = ((aVal / max) * (h - pad * 2)) | 0;
          const bH = ((bVal / max) * (h - pad * 2)) | 0;
          const aY = h - pad - aH;
          const bY = h - pad - bH;
          return (
            <g key={i}>
              <polygon
                points={`${x0 + barW},${aY} ${x0 + barW + depth},${aY - depth} ${x0 + barW + depth},${aY - depth + aH} ${x0 + barW},${aY + aH}`}
                fill="#0f172a20"
              />
              <rect
                x={x0}
                y={aY}
                width={barW}
                height={aH}
                fill={colorA}
                rx="2"
              />
              <polygon
                points={`${x0},${aY} ${x0 + barW},${aY} ${x0 + barW + depth},${aY - depth} ${x0 + depth},${aY - depth}`}
                fill="#ffffff40"
              />
              <polygon
                points={`${x0 + barW + 6 + barW},${bY} ${x0 + barW + 6 + barW + depth},${bY - depth} ${x0 + barW + 6 + barW + depth},${bY - depth + bH} ${x0 + barW + 6 + barW},${bY + bH}`}
                fill="#0f172a20"
              />
              <rect
                x={x0 + barW + 6}
                y={bY}
                width={barW}
                height={bH}
                fill={colorB}
                rx="2"
              />
              <polygon
                points={`${x0 + barW + 6},${bY} ${x0 + barW + 6 + barW},${bY} ${x0 + barW + 6 + barW + depth},${bY - depth} ${x0 + barW + 6 + depth},${bY - depth}`}
                fill="#ffffff40"
              />
              <text
                x={x0 + barW / 2}
                y={aY - 6}
                fontSize="10"
                textAnchor="middle"
                fill="#334155"
              >
                {fmtShort(aVal)}
              </text>
              <text
                x={x0 + barW + 6 + barW / 2}
                y={bY - 6}
                fontSize="10"
                textAnchor="middle"
                fill="#334155"
              >
                {fmtShort(bVal)}
              </text>
              <text
                x={x0 + groupW / 2}
                y={h - pad + 12}
                fontSize="10"
                textAnchor="middle"
                fill="#64748b"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function FinanceDashboardPage() {
  const location = useLocation();
  const backTo =
    location.state?.fromExecutiveOverview === true
      ? "/executive-overview"
      : "/finance";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cards, setCards] = useState([
    {
      label: "YTD Customers (Debtors)",
      value: "—",
      color: "from-sky-500 to-sky-600",
    },
    {
      label: "YTD Suppliers (Creditors)",
      value: "—",
      color: "from-cyan-500 to-cyan-600",
    },
    {
      label: "YTD Cash In Hand",
      value: "—",
      color: "from-emerald-500 to-emerald-600",
    },
    {
      label: "YTD Bank Accounts",
      value: "—",
      color: "from-blue-500 to-blue-600",
    },
    {
      label: "YTD Indirect Expenses",
      value: "—",
      color: "from-rose-500 to-rose-600",
    },
    { label: "YTD Sales", value: "—", color: "from-purple-500 to-purple-600" },
  ]);
  const [ar, setAr] = useState([]);
  const [ap, setAp] = useState([]);
  const [arBreak, setArBreak] = useState([]);
  const [apBreak, setApBreak] = useState([]);
  const [bankTrend, setBankTrend] = useState([]);
  const [cashTrend, setCashTrend] = useState([]);
  const [cashflow, setCashflow] = useState([]); // [{label, a: inflow, b: outflow}]
  const [incomeExpense, setIncomeExpense] = useState([]); // [{label, a: income, b: expense}]
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = {};
        if (from) params.from = from;
        if (to) params.to = to;
        const resp = await api.get("/finance/dashboard/metrics", { params });
        const ytd = resp?.data?.ytd || {};
        const fmt = (n) =>
          `₵${Number(n || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        if (mounted) {
          setCards((prev) => {
            const next = [...prev];
            const fmtSide = (n, side) =>
              `${fmt(n)} ${String(side || "").toUpperCase()}`;
            next[0] = {
              ...next[0],
              value: fmtSide(ytd.debtors, ytd.debtors_side),
            };
            next[1] = {
              ...next[1],
              value: fmtSide(ytd.creditors, ytd.creditors_side),
            };
            next[2] = { ...next[2], value: fmt(ytd.cash_in_hand) };
            next[3] = { ...next[3], value: fmt(ytd.bank_total) };
            next[4] = { ...next[4], value: fmt(ytd.indirect_expenses) };
            next[5] = { ...next[5], value: fmt(ytd.sales) };
            return next;
          });
          const toSeries = (series) => {
            const map = new Map();
            (series || []).forEach((r) => {
              const ym = String(r.ym || "");
              const parts = ym.split("-");
              const month = parts.length >= 2 ? Number(parts[1]) : 0;
              const label =
                [
                  "JAN",
                  "FEB",
                  "MAR",
                  "APR",
                  "MAY",
                  "JUN",
                  "JUL",
                  "AUG",
                  "SEP",
                  "OCT",
                  "NOV",
                  "DEC",
                ][month - 1] || ym;
              map.set(label, Number(r.value || r.mov || 0));
            });
            const labels = [
              "JAN",
              "FEB",
              "MAR",
              "APR",
              "MAY",
              "JUN",
              "JUL",
              "AUG",
              "SEP",
              "OCT",
              "NOV",
              "DEC",
            ];
            return labels.map((lbl) => ({
              label: lbl,
              value: map.get(lbl) || 0,
            }));
          };
          setAr(toSeries(resp?.data?.ar_trend || []));
          setAp(toSeries(resp?.data?.ap_trend || []));
          // Breakdown bars
          const toBars = (rows) =>
            (rows || []).map((r) => ({
              label: String(r.label || r.name || "").slice(0, 16),
              value: Number(r.value || 0),
            }));
          setArBreak(toBars(resp?.data?.ar_breakdown || []));
          setApBreak(toBars(resp?.data?.ap_breakdown || []));
          // Bank/Cash trend (line)
          const toLine = (rows) =>
            (rows || []).map((r) => ({
              label: (() => {
                const ym = String(r.ym || "");
                const m = Number(ym.split("-")[1] || 0);
                return (
                  [
                    "JAN",
                    "FEB",
                    "MAR",
                    "APR",
                    "MAY",
                    "JUN",
                    "JUL",
                    "AUG",
                    "SEP",
                    "OCT",
                    "NOV",
                    "DEC",
                  ][m - 1] || ym
                );
              })(),
              value: Number(r.value || r.net || 0),
            }));
          setBankTrend(toLine(resp?.data?.bank_trend || []));
          setCashTrend(toLine(resp?.data?.cash_trend || []));
          // Cashflow inflow/outflow monthly bars
          const toDual = (rows) =>
            (rows || []).map((r) => ({
              label: (() => {
                const ym = String(r.ym || "");
                const m = Number(ym.split("-")[1] || 0);
                return (
                  [
                    "JAN",
                    "FEB",
                    "MAR",
                    "APR",
                    "MAY",
                    "JUN",
                    "JUL",
                    "AUG",
                    "SEP",
                    "OCT",
                    "NOV",
                    "DEC",
                  ][m - 1] || ym
                );
              })(),
              a: Number(r.inflow || 0),
              b: Number(r.outflow || 0),
            }));
          setCashflow(toDual(resp?.data?.cashflow_trend || []));
          const toIncomeExpense = (rows) =>
            (rows || []).map((r) => ({
              label: (() => {
                const ym = String(r.ym || "");
                const m = Number(ym.split("-")[1] || 0);
                return (
                  [
                    "JAN",
                    "FEB",
                    "MAR",
                    "APR",
                    "MAY",
                    "JUN",
                    "JUL",
                    "AUG",
                    "SEP",
                    "OCT",
                    "NOV",
                    "DEC",
                  ][m - 1] || ym
                );
              })(),
              a: Number(r.income || 0),
              b: Number(r.expense || 0),
            }));
          setIncomeExpense(
            toIncomeExpense(resp?.data?.income_expense_trend || []),
          );
        }
      } catch {
        // leave placeholders
      }
    })();
    return () => {
      mounted = false;
    };
  }, [from, to]);
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex items-center justify-between">
          <div className="font-bold text-lg">Finance Dashboard</div>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              className="input input-sm w-36"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              title="From"
            />
            <input
              type="date"
              className="input input-sm w-36"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              title="To"
            />
            <Link to={backTo} className="font-sans btn btn-secondary">
              Return to Finance
            </Link>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((c, i) => (
          <div
            key={i}
            className={`p-5 rounded-xl shadow-erp bg-gradient-to-r ${c.color} text-white`}
          >
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-sm opacity-90">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AreaLineChart
          title="Accounts Receivable Trend"
          data={ar}
          colorArea="#22c55e"
          colorLine="#16a34a"
        />
        <AreaLineChart
          title="Accounts Payable Trend"
          data={ap}
          colorArea="#ef4444"
          colorLine="#b91c1c"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleBarChart
          title="Account Receivables"
          data={arBreak}
          palette={[
            "#4f46e5",
            "#06b6d4",
            "#22c55e",
            "#f59e0b",
            "#a855f7",
            "#ef4444",
            "#14b8a6",
            "#8b5cf6",
            "#f97316",
            "#0ea5e9",
            "#10b981",
          ]}
        />
        <SimpleBarChart
          title="Account Payable"
          data={apBreak}
          palette={[
            "#ec4899",
            "#f97316",
            "#22c55e",
            "#0ea5e9",
            "#a855f7",
            "#ef4444",
            "#14b8a6",
            "#8b5cf6",
            "#4f46e5",
            "#06b6d4",
            "#f59e0b",
          ]}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AreaLineChart
          title="Bank Trend by Month"
          data={bankTrend}
          colorArea="#6366f1"
          colorLine="#4338ca"
        />
        <AreaLineChart
          title="Cash Trend by Month"
          data={cashTrend}
          colorArea="#06b6d4"
          colorLine="#0e7490"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TwoSeriesBarChart
          title="Inflow vs Outflow"
          aLabel="Inflow"
          bLabel="Outflow"
          data={cashflow}
          colorA="#16a34a"
          colorB="#ef4444"
        />
        <TwoSeriesBarChart
          title="Incomes vs Expense"
          aLabel="Revenue"
          bLabel="Expenses"
          data={incomeExpense}
          colorA="#16a34a"
          colorB="#ef4444"
        />
      </div>
    </div>
  );
}
