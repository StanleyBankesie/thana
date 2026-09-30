/**
 * @fileoverview Dashboard page for the Inventory module.
 * Displays stock levels, recent movements, and low stock warnings.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../api/client.js";
import ChartPie from "@/components/charts/ChartPie.jsx";

function fmtShort(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(1) + "T";
  if (abs >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toLocaleString();
}

function SimpleBarChart({ title, data, palette, legend }) {
  const max = Math.max(...data.map((d) => Number(d.value || 0)), 1);
  const w = 760;
  const h = 320;
  const pad = 40;
  const step = (w - pad * 2) / Math.max(data.length, 1);
  const barW = Math.max(12, step * 0.6);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const colors =
    Array.isArray(palette) && palette.length
      ? palette
      : ["#0ea5e9", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"];
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
        {ticks.map((t, idx) => {
          const y = h - pad - ((t / max) * (h - pad * 2) || 0);
          return (
            <g key={idx}>
              <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="#e2e8f0" />
              <text
                x={pad - 8}
                y={y + 4}
                fontSize="10"
                textAnchor="end"
                fill="#64748b"
              >
                {fmtShort(t)}
              </text>
            </g>
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
              <title>{`${d.label}: ${v.toLocaleString()}`}</title>
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

function PieChart({
  title,
  data,
  colors = [
    "#6366f1",
    "#22c55e",
    "#ef4444",
    "#f59e0b",
    "#06b6d4",
    "#a855f7",
    "#0ea5e9",
    "#84cc16",
    "#fb7185",
    "#f97316",
  ],
}) {
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
    const restSum = rows.slice(MAX).reduce((s, r) => s + r.value, 0);
    if (restSum > 0) top.push({ label: "Others", value: restSum });
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
        <ChartPie data={prepared} />
      )}
    </div>
  );
}

export default function InventoryDashboardPage() {
  const location = useLocation();
  const backTo =
    location.state?.fromExecutiveOverview === true
      ? "/executive-overview"
      : "/inventory";
  const [topN, setTopN] = useState(10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cards, setCards] = useState([
    {
      label: "Total Stock Value",
      value: "—",
      color: "from-indigo-500 to-indigo-600",
    },
    {
      label: "YTD GRN Value",
      value: "—",
      color: "from-emerald-500 to-emerald-600",
    },
    { label: "MTD GRN Value", value: "—", color: "from-teal-500 to-teal-600" },
    {
      label: "Items Below Minimum",
      value: "—",
      color: "from-rose-500 to-rose-600",
    },
    {
      label: "Items Above Maximum",
      value: "—",
      color: "from-amber-500 to-amber-600",
    },
  ]);
  const [topItems, setTopItems] = useState([]);
  const [topGroups, setTopGroups] = useState([]);
  const [warehousePie, setWarehousePie] = useState([]);
  const [typePie, setTypePie] = useState([]);
  const [groupPie, setGroupPie] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("top", String(topN));
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const resp = await api.get(
          `/inventory/dashboard/metrics?${params.toString()}`,
        );
        const fmt = (n) =>
          `₵${Number(n || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        const c = resp?.data?.cards || {};
        if (mounted) {
          setCards((prev) => {
            const next = [...prev];
            next[0] = { ...next[0], value: fmt(c.total_stock_value) };
            next[1] = { ...next[1], value: fmt(c.ytd_grn_value) };
            next[2] = { ...next[2], value: fmt(c.mtd_grn_value) };
            next[3] = { ...next[3], value: String(c.items_below_min || 0) };
            next[4] = { ...next[4], value: String(c.items_above_max || 0) };
            return next;
          });
          setTopItems(
            Array.isArray(resp?.data?.top_items) ? resp.data.top_items : [],
          );
          setTopGroups(
            Array.isArray(resp?.data?.top_groups) ? resp.data.top_groups : [],
          );
          setWarehousePie(
            Array.isArray(resp?.data?.warehouse_pie)
              ? resp.data.warehouse_pie
              : [],
          );
          setTypePie(
            Array.isArray(resp?.data?.type_pie) ? resp.data.type_pie : [],
          );
          setGroupPie(
            Array.isArray(resp?.data?.group_pie) ? resp.data.group_pie : [],
          );
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [topN, from, to]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex items-center justify-between">
          <div className="font-bold text-lg">Inventory Dashboard</div>
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
              Return to Inventory
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
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
        <SimpleBarChart
          title="Top Items (by Stock Value)"
          data={topItems}
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
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
            >
              {[5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          }
        />
        <SimpleBarChart
          title="Top Groups (by Stock Value)"
          data={topGroups}
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
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
            >
              {[5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PieChart title="Warehouse Wise Stock" data={warehousePie} />
        <PieChart title="Item Type Wise Stock" data={typePie} />
        <PieChart title="Item Group Wise Stock" data={groupPie} />
      </div>
    </div>
  );
}
