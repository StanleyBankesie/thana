/**
 * @fileoverview Dashboard page for the Purchase module.
 * Displays key purchasing metrics, order trends, and top suppliers.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../api/client.js";

function Card({ title, value }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-erp">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-2xl font-bold mt-1">{Number(value || 0).toLocaleString()}</div>
    </div>
  );
}

function TwoSeriesLineChart({ title, data }) {
  const w = 780;
  const h = 300;
  const pad = 40;
  const max = Math.max(...data.flatMap((d) => [d.a || 0, d.b || 0]), 1);
  const pointsFor = (key) =>
    data
      .map((d, i) => {
        const x = pad + (i * (w - pad * 2)) / Math.max(data.length - 1, 1);
        const y = h - pad - ((Number(d[key] || 0) / max) * (h - pad * 2));
        return `${x},${y}`;
      })
      .join(" ");
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-erp">
      <div className="text-lg font-bold mb-3">{title}</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[300px]">
        <rect x="0" y="0" width={w} height={h} fill="transparent" />
        <polyline
          points={pointsFor("a")}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="2"
        />
        <polyline
          points={pointsFor("b")}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
        />
        {data.map((d, i) => {
          const x = pad + (i * (w - pad * 2)) / Math.max(data.length - 1, 1);
          return (
            <text key={i} x={x} y={h - 8} fontSize="10" textAnchor="middle" fill="#64748b">
              {(d.label || "").slice(5)}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 text-xs text-slate-500">Blue: Orders | Green: Purchases</div>
    </div>
  );
}

function SimpleBarChart({ title, data, palette = [] }) {
  const max = Math.max(...data.map((d) => Number(d.value || 0)), 1);
  const w = 760;
  const h = 300;
  const pad = 40;
  const barW = Math.max(18, (w - pad * 2) / Math.max(data.length * 1.6, 1));
  const step = (w - pad * 2) / Math.max(data.length, 1);
  const colors =
    palette.length
      ? palette
      : ["#4f46e5","#06b6d4","#22c55e","#f59e0b","#a855f7","#ef4444","#14b8a6","#8b5cf6","#f97316","#0ea5e9","#10b981"];
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-erp">
      <div className="text-lg font-bold mb-3">{title}</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[300px]">
        {data.map((d, i) => {
          const x = pad + i * step + (step - barW) / 2;
          const vh = ((Number(d.value || 0) / max) * (h - pad * 2)) | 0;
          const y = h - pad - vh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={vh} fill={colors[i % colors.length]} rx="2" />
              <text x={x + barW / 2} y={h - 8} fontSize="10" textAnchor="middle" fill="#64748b">
                {String(d.label || "").slice(0, 10)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * PurchaseDashboardPage component
 * Renders the primary analytics view for the purchasing department.
 * 
 * @returns {JSX.Element} The rendered dashboard.
 */
export default function PurchaseDashboardPage() {
  const location = useLocation();
  const backTo =
    location.state?.fromExecutiveOverview === true
      ? "/executive-overview"
      : "/purchase";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [topN, setTopN] = useState(10);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = { top: topN };
        if (from) params.from = from;
        if (to) params.to = to;
        const res = await api.get("/purchase/dashboard/metrics", { params });
        if (!mounted) return;
        setData(res.data || {});
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load dashboard");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [from, to, topN]);

  const cards = data?.cards || {};
  const monthTrend = data?.month_wise_trend || [];
  const topSuppliers = data?.top_suppliers || [];

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold">Purchase Dashboard</h1>
              <p className="text-sm mt-1">Overview of purchases and orders</p>
            </div>
            <div className="flex gap-2">
              <Link to={backTo} className="btn btn-secondary">Back</Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input type="date" className="input w-full md:w-48" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
            <input type="date" className="input w-full md:w-48" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Top Suppliers</label>
              <select className="input w-28" value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
                {[1,2,3,5,10,15,20,25,30].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          {loading ? <div className="text-slate-500">Loading...</div> : null}
          {!loading && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                <Card title="YTD Purchase Order Value" value={cards.ytd_po_value} />
                <Card title="MTD Purchase Order Value" value={cards.mtd_po_value} />
                <Card title="WTD Purchase Order Value" value={cards.wtd_po_value} />
                <Card title="YTD Purchase Value" value={cards.ytd_purchase_value} />
                <Card title="MTD Purchase Value" value={cards.mtd_purchase_value} />
                <Card title="WTD Purchase Value" value={cards.wtd_purchase_value} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TwoSeriesLineChart
                  title="Month-wise Purchase Trend (Orders vs Purchases)"
                  data={monthTrend}
                />
                <SimpleBarChart
                  title={`Top ${topN} Suppliers`}
                  data={topSuppliers}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
