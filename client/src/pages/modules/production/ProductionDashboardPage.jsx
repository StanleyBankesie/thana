/**
 * @fileoverview Production & Manufacturing Dashboard.
 * Displays real-time manufacturing KPIs, work order progress, machine utilization,
 * quality inspection yield, scrap metrics, and production output trends.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../api/client.js";
import { useAuth } from "../../../auth/AuthContext.jsx";
import ChartPie from "@/components/charts/ChartPie.jsx";
import {
  Factory,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Clock,
  Cpu,
  FileText,
  Plus,
  Play,
  ArrowUpRight,
  ShieldCheck,
  Box,
  Calendar,
  RefreshCw,
  Printer,
  ChevronRight,
  Sparkles,
  Zap,
  Gauge,
  Sliders,
  Check,
  AlertCircle,
  Truck,
  RotateCcw,
} from "lucide-react";
import { toast } from "react-toastify";

function fmtShort(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toLocaleString();
}

function fmtPercent(val) {
  const n = Number(val || 0);
  return `${n.toFixed(1)}%`;
}

// ─── Interactive 3D Bar Chart Component ─────────────────────────────
function OutputBarChart({ data = [], loading = false }) {
  const chartData = useMemo(() => {
    if (!data.length) {
      return [
        { month_label: "Jan", produced_volume: 0, planned_volume: 0 },
        { month_label: "Feb", produced_volume: 0, planned_volume: 0 },
        { month_label: "Mar", produced_volume: 0, planned_volume: 0 },
        { month_label: "Apr", produced_volume: 0, planned_volume: 0 },
        { month_label: "May", produced_volume: 0, planned_volume: 0 },
        { month_label: "Jun", produced_volume: 0, planned_volume: 0 },
      ];
    }
    return data;
  }, [data]);

  const maxVal = Math.max(
    ...chartData.map((d) => Math.max(Number(d.produced_volume || 0), Number(d.planned_volume || 0))),
    10,
  );

  const w = 720;
  const h = 280;
  const padLeft = 50;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;
  const step = plotW / Math.max(chartData.length, 1);
  const barW = Math.max(16, Math.min(36, step * 0.45));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxVal * t));

  return (
    <div className="w-full">
      <svg width="100%" height="280" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        {/* Grid lines */}
        {ticks.map((t, idx) => {
          const y = padTop + plotH - (t / maxVal) * plotH;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={w - padRight}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={idx > 0 ? "4 4" : "none"}
                className="dark:stroke-slate-700/60"
              />
              <text
                x={padLeft - 10}
                y={y + 4}
                fontSize="11"
                textAnchor="end"
                className="fill-slate-400 font-medium select-none"
              >
                {fmtShort(t)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {chartData.map((d, i) => {
          const prodVal = Number(d.produced_volume || 0);
          const planVal = Number(d.planned_volume || 0);
          const x = padLeft + i * step + (step - barW) / 2;
          const prodH = (prodVal / maxVal) * plotH;
          const prodY = padTop + plotH - prodH;

          return (
            <g key={i} className="group cursor-pointer">
              {/* Tooltip on hover */}
              <title>{`${d.month_label}: ${prodVal.toLocaleString()} units produced (Planned: ${planVal.toLocaleString()})`}</title>

              {/* Background slot */}
              <rect
                x={x - 4}
                y={padTop}
                width={barW + 8}
                height={plotH}
                fill="currentColor"
                className="text-slate-500/5 group-hover:text-slate-500/10 transition-colors"
                rx="6"
              />

              {/* Produced Bar (Gradient fill) */}
              <rect
                x={x}
                y={prodY}
                width={barW}
                height={Math.max(prodH, 3)}
                fill="url(#prodGradient)"
                rx="4"
                className="transition-all duration-300 group-hover:brightness-110"
              />

              {/* Top value badge */}
              {prodVal > 0 && (
                <text
                  x={x + barW / 2}
                  y={prodY - 6}
                  fontSize="11"
                  textAnchor="middle"
                  className="fill-slate-700 dark:fill-slate-300 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {fmtShort(prodVal)}
                </text>
              )}

              {/* X Axis Label */}
              <text
                x={x + barW / 2}
                y={h - 12}
                fontSize="11"
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 font-medium select-none"
              >
                {d.month_label}
              </text>
            </g>
          );
        })}

        {/* Gradient Definition */}
        <defs>
          <linearGradient id="prodGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function ProductionDashboardPage() {
  const navigate = useNavigate();
  const { scope } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [timeRange, setTimeRange] = useState("30D");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");

  // Load branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await api.get("/admin/branches");
        setBranches(Array.isArray(res.data?.items) ? res.data.items : []);
      } catch {}
    }
    loadBranches();
  }, []);

  // Compute date filters
  const dateParams = useMemo(() => {
    const now = new Date();
    let from = "";
    let to = now.toISOString().slice(0, 10);

    if (timeRange === "TODAY") {
      from = to;
    } else if (timeRange === "7D") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      from = d.toISOString().slice(0, 10);
    } else if (timeRange === "30D") {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      from = d.toISOString().slice(0, 10);
    } else if (timeRange === "YEAR") {
      from = `${now.getFullYear()}-01-01`;
    } else if (timeRange === "CUSTOM") {
      from = customFrom;
      to = customTo;
    }

    return { from: from || undefined, to: to || undefined };
  }, [timeRange, customFrom, customTo]);

  // Load dashboard analytics
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...dateParams,
        branchId: selectedBranch || undefined,
      };
      const res = await api.get("/production/dashboard/analytics", { params });
      setData(res.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load production analytics");
    } finally {
      setLoading(false);
    }
  }, [dateParams, selectedBranch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const kpis = data?.kpis || {};
  const machines = data?.machines || {};
  const qc = data?.qc || {};
  const monthlyTrend = data?.monthlyTrend || [];
  const statusDistribution = data?.statusDistribution || [];
  const recentWorkOrders = data?.recentWorkOrders || [];
  const topProducts = data?.topProducts || [];

  // Pie / Donut Chart formatting for Work Orders
  const pieData = useMemo(() => {
    return statusDistribution
      .filter((s) => s.count > 0)
      .map((s) => ({
        label: s.status,
        value: s.count,
        color: s.color,
      }));
  }, [statusDistribution]);

  const totalWO = kpis.totalOrders || 0;

  function getStatusBadge(status) {
    const s = String(status || "").toUpperCase();
    if (s === "COMPLETED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 size={12} />
          Completed
        </span>
      );
    }
    if (s === "IN_PROGRESS") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <Activity size={12} className="animate-spin text-blue-600" />
          In Progress
        </span>
      );
    }
    if (s === "RELEASED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          <Play size={12} />
          Released
        </span>
      );
    }
    if (s === "CANCELLED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <AlertCircle size={12} />
          Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
        <Clock size={12} />
        Draft
      </span>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Top Header & Controls ─────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Factory size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Production Dashboard
                <span className="text-xs px-2 py-0.5 rounded-md bg-brand-100 text-brand-700 dark:bg-brand-950/80 dark:text-brand-300 font-bold uppercase tracking-wider">
                  Live Operations
                </span>
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Real-time manufacturing plant metrics, work orders progress, and quality yield
              </p>
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Range Pills */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            {[
              { key: "TODAY", label: "Today" },
              { key: "7D", label: "7 Days" },
              { key: "30D", label: "30 Days" },
              { key: "YEAR", label: "This Year" },
              { key: "CUSTOM", label: "Custom" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTimeRange(tab.key)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeRange === tab.key
                    ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          {timeRange === "CUSTOM" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="input input-sm text-xs rounded-lg py-1 px-2 border-slate-300"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="input input-sm text-xs rounded-lg py-1 px-2 border-slate-300"
              />
            </div>
          )}

          {/* Branch Filter */}
          {branches.length > 1 && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="select select-sm text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {/* Refresh button */}
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="btn btn-sm btn-outline border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-1.5"
            title="Refresh analytics data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-brand-600" : ""} />
            <span>Refresh</span>
          </button>

          {/* Print/Export */}
          <button
            onClick={() => window.print()}
            className="btn btn-sm btn-outline border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-1.5"
            title="Print summary"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ─── Executive KPI Cards Grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Active Work Orders */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Orders
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Activity size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {loading ? "..." : (kpis.inProgressOrders || 0) + (kpis.pendingOrders || 0)}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>{kpis.inProgressOrders || 0} in progress</span>
              <span>{kpis.pendingOrders || 0} queued</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Units Produced */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Produced Output
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {loading ? "..." : fmtShort(kpis.totalProducedQty || 0)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Units finished & verified
            </div>
          </div>
        </div>

        {/* KPI 3: Production Yield Rate */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Plant Yield
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {loading ? "..." : fmtPercent(kpis.yieldPercent ?? 100)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Live efficiency output
            </div>
          </div>
        </div>

        {/* KPI 4: Quality Pass Rate */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              QC Pass Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {loading ? "..." : fmtPercent(kpis.qualityPassRate ?? 100)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {qc.total_inspections || 0} inspections logged
            </div>
          </div>
        </div>

        {/* KPI 5: Machine Utilization */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Machine Uptime
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Cpu size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {loading ? "..." : fmtPercent(machines.avg_utilization ?? 0)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {machines.active_machines || 0} of {machines.total_machines || 0} units active
            </div>
          </div>
        </div>

        {/* KPI 6: Active BOM Recipes */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-pink-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active BOMs
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Layers size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {loading ? "..." : (kpis.activeBoms ?? kpis.totalBoms ?? 0)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Live Bill of Materials
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Visual Charts & Analytics ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Monthly Production Output Trend */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-600" />
                Monthly Production Output Trends
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manufactured finished goods output volume over the last 6 months
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-sky-600 inline-block" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">Completed Output</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
            </div>
          ) : (
            <OutputBarChart data={monthlyTrend} loading={loading} />
          )}
        </div>

        {/* Right 1 Col: Work Orders Status Distribution */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PieChartIcon size={18} className="text-brand-600" />
                  Work Order Breakdown
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Status distribution across pipeline
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                Total: {totalWO}
              </span>
            </div>

            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
              </div>
            ) : pieData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
                <Box size={32} className="mb-2 opacity-40" />
                No work orders recorded in this timeframe
              </div>
            ) : (
              <div className="py-2 flex items-center justify-center">
                <ChartPie data={pieData} size={170} cutout="65%" />
              </div>
            )}
          </div>

          {/* Status Breakdown Legend */}
          <div className="mt-4 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            {statusDistribution.map((item) => {
              const pct = totalWO > 0 ? Math.round((item.count / totalWO) * 100) : 0;
              return (
                <div key={item.status} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{item.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{item.count}</span>
                    <span className="text-slate-400 text-[11px]">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Shop Floor Execution & Top Products ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Work Orders Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders size={18} className="text-brand-600" />
                Recent Work Orders & Shop Floor Status
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time completion progress and manufacturing milestones
              </p>
            </div>
            <Link
              to="/production/work-orders"
              className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1"
            >
              View All Work Orders
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Order #</th>
                  <th className="pb-3">Product / BOM</th>
                  <th className="pb-3">Target Qty</th>
                  <th className="pb-3">Progress</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {!recentWorkOrders.length ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400 text-xs">
                      No active work orders found. Create a work order to begin manufacturing.
                    </td>
                  </tr>
                ) : (
                  recentWorkOrders.map((wo) => (
                    <tr key={wo.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 font-semibold text-brand-600 dark:text-brand-400">
                        <Link to={`/production/work-orders/${wo.id}`} className="hover:underline">
                          {wo.work_order_no}
                        </Link>
                      </td>
                      <td className="py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {wo.item_name || wo.bom_name || "Manufacturing Run"}
                        </div>
                        {wo.item_code && (
                          <div className="text-[11px] text-slate-400">{wo.item_code}</div>
                        )}
                      </td>
                      <td className="py-3 font-medium text-slate-700 dark:text-slate-300">
                        {Number(wo.qty_to_produce || 0).toLocaleString()} units
                      </td>
                      <td className="py-3 w-40">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {wo.progress || 0}%
                            </span>
                            <span className="text-slate-400">
                              {Number(wo.completed_qty || 0).toLocaleString()} / {Number(wo.qty_to_produce || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                (wo.progress || 0) >= 100
                                  ? "bg-emerald-500"
                                  : (wo.progress || 0) > 0
                                  ? "bg-brand-500"
                                  : "bg-slate-300"
                              }`}
                              style={{ width: `${Math.min(100, wo.progress || 0)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3">{getStatusBadge(wo.status)}</td>
                      <td className="py-3 text-right">
                        <Link
                          to={`/production/work-orders/${wo.id}`}
                          className="px-2.5 py-1 text-xs rounded-lg font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Top Manufactured Products & Machine Health */}
        <div className="space-y-6">
          {/* Top Products */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Box size={18} className="text-brand-600" />
              Top Manufactured Products
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Products with highest output quantity
            </p>

            <div className="space-y-3.5">
              {!topProducts.length ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No manufacturing history yet
                </div>
              ) : (
                topProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                          {p.item_name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {p.total_runs} production run(s)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {Number(p.total_quantity || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">units</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Plant Efficiency & Scrap Ratio */}
          <div className="bg-gradient-to-br from-slate-900 to-brand-950 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
                  Shop Floor Health
                </span>
                <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
                  <Zap size={14} />
                  Operational
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="text-xs text-slate-400">Scrap Rate</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {fmtPercent(kpis.scrapRate ?? 0)}
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">Live shop floor wastage</div>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="text-xs text-slate-400">Avg Job Yield</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {fmtPercent(kpis.yieldPercent ?? 100)}
                  </div>
                  <div className="text-[10px] text-brand-300 mt-0.5">Verified output ratio</div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400">QC Defect Rate:</span>
                <span className="font-bold text-white">
                  {fmtPercent(Math.max(0, 100 - Number(kpis.qualityPassRate ?? 100)))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Quick Actions & Workflow Hub ──────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          Manufacturing Quick Actions & Workflow Hub
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Fast shortcuts for production management, shop floor execution, and inventory handoffs
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <Link
            to="/production/work-orders/new"
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-all text-center group"
          >
            <div className="w-10 h-10 mx-auto rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Plus size={20} />
            </div>
            <div className="font-bold text-xs text-slate-800 dark:text-slate-200">New Work Order</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Schedule production</div>
          </Link>

          <Link
            to="/production/boms/new"
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-all text-center group"
          >
            <div className="w-10 h-10 mx-auto rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Layers size={20} />
            </div>
            <div className="font-bold text-xs text-slate-800 dark:text-slate-200">Create BOM</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Define recipes</div>
          </Link>

          <Link
            to="/production/planning/daily"
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-all text-center group"
          >
            <div className="w-10 h-10 mx-auto rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Calendar size={20} />
            </div>
            <div className="font-bold text-xs text-slate-800 dark:text-slate-200">Daily Planning</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Shift & machine plan</div>
          </Link>

          <Link
            to="/production/execution/job-cards"
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-all text-center group"
          >
            <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Play size={20} />
            </div>
            <div className="font-bold text-xs text-slate-800 dark:text-slate-200">Job Cards</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Shop floor execution</div>
          </Link>

          <Link
            to="/production/execution/qc"
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-all text-center group"
          >
            <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ShieldCheck size={20} />
            </div>
            <div className="font-bold text-xs text-slate-800 dark:text-slate-200">Quality Control</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Verify specifications</div>
          </Link>

          <Link
            to="/production/execution/fg-transfer"
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-all text-center group"
          >
            <div className="w-10 h-10 mx-auto rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Truck size={20} />
            </div>
            <div className="font-bold text-xs text-slate-800 dark:text-slate-200">FG Transfer</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Handoff to warehouse</div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function PieChartIcon(props) {
  return (
    <svg
      {...props}
      width={props.size || 24}
      height={props.size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}
