/**
 * @fileoverview Dashboard page for the Sales module.
 * Displays key sales metrics, recent orders, and performance charts.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../api/client.js";
import ChartPie from "@/components/charts/ChartPie.jsx";

function fmtShort(n) {
  const v = Number(n || 0);
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(1) + "T";
  if (a >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toLocaleString();
}

function SimpleBar({ title, data, palette, legend }) {
  const max = Math.max(...data.map((d) => Number(d.value || 0)), 1);
  const w = 760;
  const h = 320;
  const pad = 40;
  const step = (w - pad * 2) / Math.max(data.length, 1);
  const barW = Math.max(12, step * 0.6);
  const colors = palette || [
    "#4f46e5",
    "#06b6d4",
    "#22c55e",
    "#f59e0b",
    "#a855f7",
    "#ef4444",
    "#14b8a6",
    "#8b5cf6",
  ];
  const depth = 6;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-erp p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {title}
        </div>
        {legend}
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
          const v = Number(d.value || 0);
          const x = pad + i * step + (step - barW) / 2;
          const vh = ((v / max) * (h - pad * 2)) | 0;
          const y = h - pad - vh;
          const fill = colors[i % colors.length];
          return (
            <g key={i}>
              <polygon
                points={`${x + barW},${y} ${x + barW + depth},${y - depth} ${x + barW + depth},${y - depth + vh} ${x + barW},${y + vh}`}
                fill="#0f172a20"
              />
              <rect x={x} y={y} width={barW} height={vh} fill={fill} rx="2" />
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
                {fmtShort(v)}
              </text>
              <text
                x={x + barW / 2}
                y={h - pad + 12}
                fontSize="10"
                textAnchor="middle"
                fill="#64748b"
              >
                {String(d.label || "").slice(0, 14)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AreaLine({ title, data, colorArea, colorLine }) {
  const { points, areaPath, maxY, labels } = useMemo(() => {
    const xs = data.map((_, i) => i);
    const ys = data.map((d) => Number(d.value || 0));
    const max = Math.max(...ys, 1);
    const w = 720;
    const h = 280;
    const pad = 40;
    const step = (w - pad * 2) / Math.max(xs.length - 1, 1);
    const sy = (v) => h - pad - (v / max) * (h - pad * 2);
    const sx = (i) => pad + i * step;
    const pts = ys.map((v, i) => [sx(i), sy(v)]);
    const dPath =
      "M " +
      pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ") +
      ` L ${sx(xs.length - 1)} ${h - pad} L ${sx(0)} ${h - pad} Z`;
    const lbls = data.map((d) => d.label);
    return { points: pts, areaPath: dPath, maxY: max, labels: lbls };
  }, [data]);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-erp p-4">
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
        {title}
      </div>
      <svg width="100%" height="320" viewBox="0 0 760 320">
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

function Pie({ title, data, donut }) {
  const prepared = useMemo(() => {
    const rows = (data || [])
      .map((d) => ({
        label: String(d?.label || "Unassigned"),
        value: Number(d?.value || 0),
      }))
      .filter((d) => Number.isFinite(d.value) && d.value > 0)
      .sort((a, b) => b.value - a.value);
    const MAX = 7;
    const top = rows.slice(0, MAX);
    const rest = rows.slice(MAX).reduce((s, r) => s + r.value, 0);
    if (rest > 0) top.push({ label: "Others", value: rest });
    return top;
  }, [data]);
  const total = prepared.reduce((s, d) => s + d.value, 0);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-erp p-4">
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
        {title}
      </div>
      {total <= 0 ? (
        <div className="p-10 text-center text-slate-500">No data</div>
      ) : (
        <ChartPie data={prepared} donut={donut} />
      )}
    </div>
  );
}

export default function SalesDashboardPage() {
  const location = useLocation();
  const backTo =
    location.state?.fromExecutiveOverview === true
      ? "/executive-overview"
      : "/sales";
  const [topProductsN, setTopProductsN] = useState(10);
  const [topCustomersN, setTopCustomersN] = useState(10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cards, setCards] = useState([
    { label: "YTD Sales", value: "—", color: "from-indigo-500 to-indigo-600" },
    { label: "MTD Sales", value: "—", color: "from-blue-500 to-blue-600" },
    { label: "WTD Sales", value: "—", color: "from-cyan-500 to-cyan-600" },
    {
      label: "Today Sales",
      value: "—",
      color: "from-emerald-500 to-emerald-600",
    },
    {
      label: "YTD Gross Profit",
      value: "—",
      color: "from-rose-500 to-rose-600",
    },
    {
      label: "MTD Gross Profit",
      value: "—",
      color: "from-pink-500 to-pink-600",
    },
    {
      label: "WTD Gross Profit",
      value: "—",
      color: "from-amber-500 to-amber-600",
    },
    {
      label: "Today Gross Profit",
      value: "—",
      color: "from-purple-500 to-purple-600",
    },
  ]);
  const [topProducts, setTopProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [prodGroupPie, setProdGroupPie] = useState([]);
  const [customerTypeDonut, setCustomerTypeDonut] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [halfYearRevenue, setHalfYearRevenue] = useState([]);
  const [quarterRevenue, setQuarterRevenue] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("topProducts", String(topProductsN));
        params.set("topCustomers", String(topCustomersN));
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const resp = await api.get(
          `/sales/dashboard/metrics?${params.toString()}`,
        );
        const fmtC = (n) =>
          `₵${Number(n || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        const c = resp?.data?.cards || {};
        if (mounted) {
          setCards((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: fmtC(c.ytd_sales) };
            next[1] = { ...next[1], value: fmtC(c.mtd_sales) };
            next[2] = { ...next[2], value: fmtC(c.wtd_sales) };
            next[3] = { ...next[3], value: fmtC(c.today_sales) };
            next[4] = { ...next[4], value: fmtC(c.ytd_gross_profit) };
            next[5] = { ...next[5], value: fmtC(c.mtd_gross_profit) };
            next[6] = { ...next[6], value: fmtC(c.wtd_gross_profit) };
            next[7] = { ...next[7], value: fmtC(c.today_gross_profit) };
            return next;
          });
          setTopProducts(
            Array.isArray(resp?.data?.top_products)
              ? resp.data.top_products
              : [],
          );
          setTopCustomers(
            Array.isArray(resp?.data?.top_customers)
              ? resp.data.top_customers
              : [],
          );
          setProdGroupPie(
            Array.isArray(resp?.data?.product_group_pie)
              ? resp.data.product_group_pie
              : [],
          );
          setCustomerTypeDonut(
            Array.isArray(resp?.data?.customer_type_donut)
              ? resp.data.customer_type_donut
              : [],
          );
          const toSeries = (rows) =>
            (rows || []).map((r) => ({
              label: r.label,
              value: Number(r.value || 0),
            }));
          setMonthlyRevenue(toSeries(resp?.data?.monthly_revenue || []));
          setHalfYearRevenue(toSeries(resp?.data?.half_year_revenue || []));
          setQuarterRevenue(toSeries(resp?.data?.quarter_revenue || []));
          const toTrend = (rows) =>
            (rows || []).map((r) => ({
              label: r.label,
              value: Number(r.value || 0),
            }));
          setSalesTrend(toTrend(resp?.data?.sales_trend || []));
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [topProductsN, topCustomersN, from, to]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex items-center justify-between">
          <div className="font-bold text-lg">Sales Dashboard</div>
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
            <Link to={backTo} className="btn btn-secondary">
              Return to Sales
            </Link>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
        <SimpleBar
          title="Top Product Sales"
          data={topProducts}
          palette={[
            "#4f46e5",
            "#06b6d4",
            "#22c55e",
            "#f59e0b",
            "#a855f7",
            "#ef4444",
            "#14b8a6",
            "#8b5cf6",
          ]}
          legend={
            <select
              className="select select-sm select-bordered"
              value={topProductsN}
              onChange={(e) => setTopProductsN(Number(e.target.value))}
              title="Top N products"
            >
              {[1, 4, 5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          }
        />
        <SimpleBar
          title="Top Customers"
          data={topCustomers}
          palette={[
            "#06b6d4",
            "#4f46e5",
            "#22c55e",
            "#f59e0b",
            "#a855f7",
            "#ef4444",
            "#14b8a6",
            "#8b5cf6",
          ]}
          legend={
            <select
              className="select select-sm select-bordered"
              value={topCustomersN}
              onChange={(e) => setTopCustomersN(Number(e.target.value))}
              title="Top N customers"
            >
              {[1, 4, 5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          }
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Pie title="Product Group Sales" data={prodGroupPie} />
        <Pie title="Customer Type Sales" data={customerTypeDonut} donut />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleBar title="Monthly Revenue" data={monthlyRevenue} />
        <SimpleBar title="Half-Yearly Revenue" data={halfYearRevenue} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleBar title="Quarter-wise Revenue" data={quarterRevenue} />
        <AreaLine
          title="Sales Trend"
          data={salesTrend}
          colorArea="#22c55e"
          colorLine="#16a34a"
        />
      </div>
    </div>
  );
}
