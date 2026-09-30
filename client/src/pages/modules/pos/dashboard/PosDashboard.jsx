/**
 * @fileoverview PosDashboard component.
 * Provides functionality for PosDashboard.
 */

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";
import ChartPie from "@/components/charts/ChartPie.jsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

function shade(c, pct) {
  const n = c.replace("#", "");
  const num = parseInt(
    n.length === 3
      ? n
          .split("")
          .map((x) => x + x)
          .join("")
      : n,
    16,
  );
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  const nr = Math.round((t - r) * p + r);
  const ng = Math.round((t - g) * p + g);
  const nb = Math.round((t - b) * p + b);
  return `rgb(${nr},${ng},${nb})`;
}

function BarChart({
  data,
  xKey,
  yKey,
  height = 160,
  xLabel,
  yLabel,
  formatY,
  color = "#3b82f6",
  colors,
  horizontal,
}) {
  const max = Math.max(1, ...data.map((d) => Number(d[yKey] || 0)));
  const palette = Array.isArray(colors) && colors.length ? colors : null;

  if (horizontal) {
    return (
      <div className="w-full space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase w-24 shrink-0 text-right">
            Amount Total
          </div>
        </div>
        {data.map((d, idx) => {
          const barColor = palette ? palette[idx % palette.length] : color;
          const val = Number(d[yKey] || 0);
          const pct = (val / max) * 100;
          return (
            <div key={idx} className="flex items-center gap-2">
              <div className="text-xs font-bold text-slate-800 w-24 shrink-0 text-right">
                {formatY ? formatY(val) : val.toLocaleString()}
              </div>
              <div className="flex-1 h-6 rounded bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{
                    width: `${Math.max(2, pct)}%`,
                    backgroundImage: `linear-gradient(90deg, ${shade(barColor, 0.35)}, ${barColor})`,
                    boxShadow:
                      "inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.15)",
                  }}
                  title={`${String(d[xKey])} • ${formatY ? formatY(val) : val.toLocaleString()}`}
                />
              </div>
              <div className="text-xs font-medium text-slate-600 shrink-0 text-left truncate max-w-[140px]">
                {String(d[xKey])}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const topPad = 28;
  const bars = data.map((d) => ({
    label: String(d[xKey]),
    value: Number(d[yKey] || 0),
    h: Math.round((Number(d[yKey] || 0) / max) * (height - topPad)),
  }));
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-4" style={{ height, minWidth: `${Math.max(bars.length * 72, 200)}px` }}>
        {bars.map((b, idx) => {
          const barColor = palette ? palette[idx % palette.length] : color;
          return (
            <div key={idx} className="flex flex-col items-center w-14 shrink-0">
              <div
                className="w-full max-w-[48px] rounded relative flex items-end justify-center"
                style={{
                  height: `${Math.max(28, b.h)}px`,
                  backgroundImage: `linear-gradient(${shade(barColor, 0.35)}, ${barColor})`,
                  boxShadow:
                    "inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.15)",
                }}
                title={`${b.label} • ${formatY ? formatY(b.value) : b.value.toLocaleString()}`}
              >
                <span className="text-[11px] font-bold text-white leading-none pb-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
                  {formatY
                    ? formatY(b.value)
                    : Number(b.value || 0).toLocaleString()}
                </span>
              </div>
              <div className="text-xs font-medium text-slate-600 mt-1 text-center w-full truncate px-1">
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineChart({
  points,
  height = 220,
  xLabel,
  yLabel,
  formatY,
  color = "#ef4444",
  areaColor = "rgba(239,68,68,0.2)",
  showXLabels = false,
  showAmounts = true,
  scrollX = false,
}) {
  const maxY = Math.max(1, ...points.map((p) => Number(p.y || 0)));
  const xLabelH = showXLabels ? 56 : 0;
  const chartH = height - xLabelH;
  const w = Math.max(720, points.length * 92);
  const stepX = w / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = Math.round(i * stepX);
    const y = Math.round(chartH - (Number(p.y || 0) / maxY) * chartH);
    return { x, y, label: p.x, value: Number(p.y || 0) };
  });
  const path = coords.length
    ? coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")
    : `M 0 ${chartH}`;
  const area = coords.length
    ? `${path} L ${coords[coords.length - 1].x} ${chartH} L 0 ${chartH} Z`
    : `M 0 ${chartH} L ${w} ${chartH}`;
  const svg = (
    <svg
      width={scrollX ? "100%" : "100%"}
      style={scrollX ? { minWidth: `${w}px` } : undefined}
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio={scrollX ? "xMinYMin" : "none"}
    >
      <path d={area} fill={areaColor} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {coords.map((c, idx) => (
        <g key={idx}>
          <circle cx={c.x} cy={c.y} r="3" fill={color} />
          {showAmounts ? (
            <text
              x={c.x}
              y={Math.max(10, c.y - 6)}
              fontSize="13"
              textAnchor="middle"
              fill="#0f172a"
              fontWeight="600"
            >
              {formatY ? formatY(c.value) : c.value.toLocaleString()}
            </text>
          ) : null}
          {showXLabels ? (
            <text
              x={c.x}
              y={height - 16}
              fontSize="13"
              textAnchor="end"
              transform={`rotate(-20 ${c.x} ${height - 16})`}
              fill="#334155"
              fontWeight="600"
            >
              {c.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
  return (
    <div className="w-full">
      {scrollX ? <div className="overflow-x-auto pb-2">{svg}</div> : svg}
    </div>
  );
}

const PIE_PALETTE = [
  "#6366f1", "#22c55e", "#ef4444", "#f59e0b",
  "#06b6d4", "#a855f7", "#0ea5e9", "#84cc16",
  "#fb7185", "#f97316",
];

function PieChart({ data, label }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[240px] text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
        <div className="text-2xl mb-2">📊</div>
        <div className="text-sm">No data available for this period</div>
      </div>
    );
  }
  const total = data.reduce((s, d) => s + Number(d.value || 0), 0);
  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
      <div className="w-full max-w-[260px] h-[260px] relative">
        <ChartPie data={data} donut={data.length > 1} height={260} />
      </div>
      <div className="flex-1 w-full min-w-0">
        <div className="space-y-1.5">
          {label ? (
            <div className="text-xs font-bold text-slate-700 mb-2 pb-1.5 border-b border-slate-100 uppercase tracking-wider">
              {label}
            </div>
          ) : null}
          {data.map((d, idx) => {
            const color = PIE_PALETTE[idx % PIE_PALETTE.length];
            const val = Number(d.value || 0);
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
            return (
              <div
                key={idx}
                className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-slate-50 rounded-md transition-all duration-150 cursor-default"
              >
                <span className="inline-block w-3 h-3 rounded-full ring-1 ring-white/50"
                      style={{ backgroundColor: color }} />
                <span className="flex-1 text-xs font-medium text-slate-600 truncate">
                  {d.label}
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {val.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-400 min-w-[3.5rem] text-right">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GroupedBarChart({
  categories,
  series,
  height = 160,
  xLabel,
  yLabel,
  formatY,
}) {
  const maxVal = Math.max(
    1,
    ...series.flatMap((s) => categories.map((c) => Number(s.data[c] || 0))),
  );
  const w = Math.max(240, categories.length * 80);
  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-2">
        <div className="flex items-end gap-6" style={{ height, minWidth: w }}>
          {categories.map((cat, idx) => (
            <div key={idx} className="flex flex-col items-center flex-1 px-1">
              <div className="flex items-end gap-3">
                {series.map((s, j) => {
                  const val = Number(s.data[cat] || 0);
                  const h = Math.round((val / maxVal) * height);
                  return (
                    <div
                      key={j}
                      className="rounded-t"
                      style={{
                        width: 16,
                        height: `${Math.max(4, h)}px`,
                        backgroundImage: `linear-gradient(${shade(s.color, 0.35)}, ${s.color})`,
                        boxShadow:
                          "inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.15), 2px -2px 0 rgba(0,0,0,0.08)",
                      }}
                      title={`${s.label} @ ${cat} • ${formatY ? formatY(val) : val.toLocaleString()}`}
                    />
                  );
                })}
              </div>
              <div className="text-[13px] font-semibold text-slate-600 text-center w-full truncate">
                {cat}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UserBarChart({
  data,
  formatY,
  color = "#3b82f6",
}) {
  const max = Math.max(1, ...data.map((d) => Number(d.total || 0)));
  const sorted = [...data].sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
  return (
    <div className="w-full space-y-2">
      {sorted.map((d, idx) => {
        const v = Number(d.total || 0);
        const pct = Math.round((v / max) * 100);
        return (
          <div key={idx} className="flex items-center gap-3">
            <div className="text-sm font-semibold text-slate-700 w-24 truncate shrink-0">
              {String(d.label || "")}
            </div>
            <div className="flex-1 h-6 rounded bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${Math.max(1, pct)}%`,
                  backgroundImage: `linear-gradient(90deg, ${color}, ${shade(color, -0.3)})`,
                }}
              />
            </div>
            <div className="text-sm font-bold text-slate-800 w-24 text-right shrink-0">
              {formatY ? formatY(v) : v.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChartViewerModal({ chart, onClose }) {
  const chartRef = useRef(null);

  const downloadImage = useCallback(async () => {
    try {
      const canvas = await html2canvas(chartRef.current, { scale: 2 });
      const link = document.createElement("a");
      link.download = `${chart.title.replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Download as Image failed", e);
    }
  }, [chart.title]);

  const downloadPdf = useCallback(async () => {
    try {
      const canvas = await html2canvas(chartRef.current, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(`${chart.title.replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      console.error("Download as PDF failed", e);
    }
  }, [chart.title]);

  if (!chart) return null;

  const ChartComponent = chart.component;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/70" onClick={onClose}>
      <div className="flex items-center justify-between bg-white px-6 py-4 shrink-0" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-900">{chart.title}</h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={downloadImage} className="btn btn-sm btn-secondary">
            Download as Image
          </button>
          <button type="button" onClick={downloadPdf} className="btn btn-sm btn-secondary">
            Download as PDF
          </button>
          <button type="button" onClick={onClose} className="btn btn-sm btn-ghost text-xl leading-none px-2" aria-label="Close">
            ✕
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-8" onClick={(e) => e.stopPropagation()}>
        <div ref={chartRef} className="bg-white rounded-xl p-6 inline-block min-w-full shadow-lg">
          <ChartComponent {...chart.props} />
        </div>
      </div>
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PosDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [daySummary, setDaySummary] = useState(null);
  const [terminalMethod, setTerminalMethod] = useState([]);
  const [userDaySales, setUserDaySales] = useState([]);
  const [sales30, setSales30] = useState([]);
  const [salesMonthly, setSalesMonthly] = useState([]);
  const [weekdaySales, setWeekdaySales] = useState([]);
  const [hourlyToday, setHourlyToday] = useState([]);
  const [busyHours, setBusyHours] = useState([]);
  const [categoryShare, setCategoryShare] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [profitByGroup, setProfitByGroup] = useState([]);
  const [profitByItem, setProfitByItem] = useState([]);
  const [topItemsRange, setTopItemsRange] = useState(7);
  const [topItemsPage, setTopItemsPage] = useState(1);
  const [daysRange, setDaysRange] = useState(30);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [showTrendAmounts, setShowTrendAmounts] = useState(true);
  const [showMonthlyAmounts, setShowMonthlyAmounts] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [modalChart, setModalChart] = useState(null);

  const dateLabel = useMemo(() => {
    if (startDate && endDate) return `${startDate} – ${endDate}`;
    return "Today";
  }, [startDate, endDate]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    const dateParams = { startDate, endDate };
    const trendParams = { days: daysRange };
    Promise.all([
      api.get("/pos/analytics/day-summary", { params: dateParams }),
      api.get("/pos/analytics/day-terminal-methods", { params: dateParams }),
      api.get("/pos/analytics/day-user-sales", { params: dateParams }),
      api.get("/pos/analytics/sales-30-days", { params: trendParams }),
      api.get("/pos/analytics/sales-monthly"),
      api.get("/pos/analytics/weekday-current-week"),
      api.get("/pos/analytics/hourly-today", { params: dateParams }),
      api.get("/pos/analytics/busy-hours"),
      api.get("/pos/analytics/category-share", { params: dateParams }),
      api.get("/pos/analytics/profit-by-group", { params: dateParams }),
      api.get("/pos/analytics/profit-by-item", { params: dateParams }),
      api.get("/pos/reports/top-items", {
        params: { ...dateParams, limit: 10 },
      }),
    ])
      .then(
        ([
          daySummaryRes,
          terminalMethodRes,
          userDayRes,
          sales30Res,
          salesMonthlyRes,
          weekdayRes,
          hourlyRes,
          busyRes,
          categoryRes,
          profitRes,
          profitItemRes,
          topRes,
        ]) => {
          if (!mounted) return;
          setDaySummary(daySummaryRes.data?.summary || null);
          setTerminalMethod(
            Array.isArray(terminalMethodRes.data?.items)
              ? terminalMethodRes.data.items
              : [],
          );
          setUserDaySales(
            Array.isArray(userDayRes.data?.items) ? userDayRes.data.items : [],
          );
          setSales30(
            Array.isArray(sales30Res.data?.items) ? sales30Res.data.items : [],
          );
          setSalesMonthly(
            Array.isArray(salesMonthlyRes.data?.items)
              ? salesMonthlyRes.data.items
              : [],
          );
          setWeekdaySales(
            Array.isArray(weekdayRes.data?.items) ? weekdayRes.data.items : [],
          );
          setHourlyToday(
            Array.isArray(hourlyRes.data?.items) ? hourlyRes.data.items : [],
          );
          setBusyHours(
            Array.isArray(busyRes.data?.items) ? busyRes.data.items : [],
          );
          setCategoryShare(
            Array.isArray(categoryRes.data?.items)
              ? categoryRes.data.items
              : [],
          );
          setProfitByGroup(
            Array.isArray(profitRes.data?.items)
              ? profitRes.data.items
              : [],
          );
          setProfitByItem(
            Array.isArray(profitItemRes.data?.items)
              ? profitItemRes.data.items
              : [],
          );
          setTopItems(
            Array.isArray(topRes.data?.items)
              ? [...topRes.data.items].sort(
                  (a, b) => Number(b.qty || 0) - Number(a.qty || 0),
                )
              : [],
          );
        },
      )
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load dashboard");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [startDate, endDate, daysRange]);

  const paymentBars = useMemo(() => {
    const s = daySummary || {};
    return [
      { method: "Cash", amount: Number(s.cashAmount || 0) },
      { method: "Card", amount: Number(s.cardAmount || 0) },
      { method: "Mobile", amount: Number(s.mobileAmount || 0) },
      { method: "Credit", amount: Number(s.creditAmount || 0) },
    ];
  }, [daySummary]);

  const topItemsTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(topItems.length / topItemsRange));
  }, [topItems, topItemsRange]);

  const paginatedTopItems = useMemo(() => {
    const start = (topItemsPage - 1) * topItemsRange;
    return topItems.slice(start, start + topItemsRange);
  }, [topItems, topItemsPage, topItemsRange]);

  const terminalPieData = useMemo(() => {
    let cash = 0, card = 0, mobile = 0, credit = 0;
    for (const row of terminalMethod) {
      cash += Number(row.cash_total || 0);
      card += Number(row.card_total || 0);
      mobile += Number(row.mobile_total || 0);
      credit += Number(row.credit_total || 0);
    }
    return [
      { label: "Cash", value: cash },
      { label: "Card", value: card },
      { label: "Mobile", value: mobile },
      { label: "Credit", value: credit },
    ].filter((d) => d.value > 0);
  }, [terminalMethod]);

  const userBars = useMemo(
    () =>
      userDaySales.map((u) => ({
        label: String(u.user_label || ""),
        total: Number(u.total || 0),
      })),
    [userDaySales],
  );

  const sales30Points = useMemo(
    () =>
      sales30.map((d) => {
        const dateStr = String(d.date || "");
        return { x: dateStr.split("T")[0], y: Number(d.total || 0) };
      }),
    [sales30],
  );
  const salesMonthlyPoints = useMemo(
    () =>
      salesMonthly.map((d) => ({ x: String(d.ym), y: Number(d.total || 0) })),
    [salesMonthly],
  );
  const monthOptions = useMemo(
    () => [...new Set(salesMonthlyPoints.map((p) => p.x))].sort(),
    [salesMonthlyPoints],
  );

  useEffect(() => {
    if (selectedMonth !== "all" && !monthOptions.includes(selectedMonth)) {
      setSelectedMonth("all");
    }
  }, [monthOptions, selectedMonth]);
  const filteredMonthlyPoints = useMemo(
    () =>
      selectedMonth === "all"
        ? salesMonthlyPoints
        : salesMonthlyPoints.filter((p) => p.x === selectedMonth),
    [salesMonthlyPoints, selectedMonth],
  );
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const formatMonth = (ym) => {
    if (!ym || !ym.includes("-")) return ym;
    const [y, m] = ym.split("-");
    return `${monthNames[parseInt(m, 10) - 1] || m} ${y}`;
  };
  const formattedMonthlyPoints = useMemo(
    () => filteredMonthlyPoints.map((p) => ({ ...p, x: formatMonth(p.x) })),
    [filteredMonthlyPoints],
  );

  const weekdayLabels = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const weekdayBars = useMemo(() => {
    const map = new Map();
    for (const r of weekdaySales)
      map.set(Number(r.dow || 0), Number(r.total || 0));
    return weekdayLabels.map((label, idx) => ({
      label,
      total: Number(map.get(((idx + 1) % 7) + 1) || 0),
    }));
  }, [weekdaySales]);

  const hourlyPoints = useMemo(() => {
    const map = new Map();
    for (const r of hourlyToday) {
      map.set(Number(r.hr || 0), Number(r.total || 0));
    }
    return Array.from({ length: 16 }, (_, i) => {
      const h = i + 7;
      return {
        x: `${String(h).padStart(2, "0")}-${String(h + 1).padStart(2, "0")}`,
        y: Number(map.get(h) || 0),
      };
    });
  }, [hourlyToday]);

  const busyHourPoints = useMemo(() => {
    const map = new Map();
    for (const r of busyHours) {
      map.set(Number(r.hr || 0), Number(r.total || 0));
    }
    return Array.from({ length: 16 }, (_, i) => {
      const h = i + 7;
      return {
        x: `${String(h).padStart(2, "0")}-${String(h + 1).padStart(2, "0")}`,
        y: Number(map.get(h) || 0),
      };
    });
  }, [busyHours]);

  const pieData = useMemo(() => {
    const totals = new Map();
    for (const row of categoryShare) {
      const label = String(row.category || "Uncategorized");
      const value = Number(row.total || 0);
      if (value <= 0) continue;
      totals.set(label, Number(totals.get(label) || 0) + value);
    }
    return Array.from(totals.entries()).map(([label, value]) => ({
      label,
      value,
    }));
  }, [categoryShare]);
  const fmtCurrency = (n) =>
    `GH₵${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to POS
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            POS Dashboard
          </h1>
          <p className="text-sm mt-1">{dateLabel} sales analytics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input text-xs py-1 px-2 w-36"
          />
          <span className="text-xs text-slate-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input text-xs py-1 px-2 w-36"
          />
          <span className="badge">{loading ? "Loading" : "Updated"}</span>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
          <div className="text-xs uppercase text-slate-500 mb-1">Daily Sales</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {fmtCurrency(Number(daySummary?.cashAmount || 0) + Number(daySummary?.cardAmount || 0) + Number(daySummary?.mobileAmount || 0) + Number(daySummary?.creditAmount || 0))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card shadow-sm border-slate-200/60 cursor-pointer" onClick={() => setModalChart({ title: "Terminal Collection", component: PieChart, props: { data: terminalPieData, label: "Terminal Collection" } })}>
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="text-xl font-bold text-slate-800">
              Terminal Collection
            </div>
            <div className="text-sm text-slate-500">
              Collection per terminal ({dateLabel})
            </div>
          </div>
          <div className="card-body p-4">
            <PieChart data={terminalPieData} label="Terminal Collection" />
          </div>
        </div>

        <div className="card shadow-sm border-slate-200/60 cursor-pointer" onClick={() => setModalChart({ title: "Users Sales", component: UserBarChart, props: { data: userBars, xLabel: "User", yLabel: "Sales (GH₵)", formatY: fmtCurrency } })}>
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="text-xl font-bold text-slate-800">Users Sales</div>
            <div className="text-sm text-slate-500">
              By cashier ({dateLabel})
            </div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <UserBarChart
              data={userBars}
              xLabel="User"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card shadow-sm border-slate-200/60 cursor-pointer" onClick={() => setModalChart({ title: "Sales Trend", component: LineChart, props: { points: sales30Points, xLabel: "Date", yLabel: "Sales (GH₵)", formatY: fmtCurrency, showXLabels: true, showAmounts: showTrendAmounts, scrollX: true, color: "#2563eb", areaColor: "rgba(37,99,235,0.15)", height: 400 } })}>
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60 flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-slate-800">
                Sales Trend
              </div>
              <div className="text-sm text-slate-500">
                Last {daysRange} days
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none font-medium text-slate-600" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={showTrendAmounts}
                onChange={(e) => setShowTrendAmounts(e.target.checked)}
                className="accent-brand"
              />
              Amounts
            </label>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <div className="flex items-center gap-3 mb-4 bg-slate-50 p-2 rounded-lg">
              <span className="text-sm font-semibold text-slate-600">
                Days Range:
              </span>
              <input
                type="range"
                min={7}
                max={60}
                value={daysRange}
                onChange={(e) => setDaysRange(Number(e.target.value))}
                className="flex-1 accent-brand"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="badge-primary text-xs px-2 py-0.5">
                {daysRange}d
              </span>
            </div>
            <LineChart
              points={sales30Points}
              xLabel="Date"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              showXLabels
              showAmounts={showTrendAmounts}
              scrollX
              color="#2563eb"
              areaColor="rgba(37,99,235,0.15)"
            />
          </div>
        </div>
        <div className="card shadow-sm border-slate-200/60 cursor-pointer" onClick={() => setModalChart({ title: "Month-to-Month Sales", component: LineChart, props: { points: formattedMonthlyPoints, xLabel: "Month", yLabel: "Sales (GH₵)", formatY: fmtCurrency, showXLabels: true, showAmounts: showMonthlyAmounts, scrollX: true, color: "#2563eb", areaColor: "rgba(37,99,235,0.15)", height: 400 } })}>
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60 flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-slate-800">
                Month-to-Month Sales
              </div>
              <div className="text-sm text-slate-500">{dateLabel}</div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input text-sm py-1 px-2 w-36 border-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="all">All Months</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none font-medium text-slate-600" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={showMonthlyAmounts}
                  onChange={(e) => setShowMonthlyAmounts(e.target.checked)}
                  className="accent-brand"
                />
                Amounts
              </label>
            </div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <LineChart
              points={formattedMonthlyPoints}
              xLabel="Month"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              showXLabels
              showAmounts={showMonthlyAmounts}
              scrollX
              color="#2563eb"
              areaColor="rgba(37,99,235,0.15)"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card shadow-sm border-slate-200/60 cursor-pointer" onClick={() => setModalChart({ title: "Weekday Sales", component: BarChart, props: { data: weekdayBars, xKey: "label", yKey: "total", xLabel: "Weekday", yLabel: "Sales (GH₵)", formatY: fmtCurrency, colors: ["#6366f1","#22c55e","#f59e0b","#06b6d4","#a855f7","#0ea5e9","#84cc16"], height: 400 } })}>
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="font-bold text-slate-800">Weekday Sales</div>
            <div className="text-[11px] text-slate-500">
              Monday to Sunday performance
            </div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <BarChart
              data={weekdayBars}
              xKey="label"
              yKey="total"
              xLabel="Weekday"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              colors={["#6366f1","#22c55e","#f59e0b","#06b6d4","#a855f7","#0ea5e9","#84cc16"]}
            />
          </div>
        </div>
        <div className="card shadow-sm border-slate-200/60 cursor-pointer" onClick={() => setModalChart({ title: "Hourly Sales", component: LineChart, props: { points: hourlyPoints, xLabel: "Hour", yLabel: "Sales (GH₵)", formatY: fmtCurrency, color: "#2563eb", areaColor: "rgba(37,99,235,0.15)", showXLabels: true, scrollX: true, height: 400 } })}>
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="font-bold text-slate-800">Hourly Sales</div>
            <div className="text-[11px] text-slate-500">
              07:00 to 23:00 ({dateLabel})
            </div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <LineChart
              points={hourlyPoints}
              xLabel="Hour"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              color="#2563eb"
              areaColor="rgba(37,99,235,0.15)"
              showXLabels
              scrollX
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1">
        <div className="card shadow-sm border-slate-200/60 cursor-pointer" onClick={() => setModalChart({ title: "Busy Sales Hours", component: LineChart, props: { points: busyHourPoints, xLabel: "Hour", yLabel: "Avg Sales (GH₵)", formatY: fmtCurrency, color: "#22c55e", areaColor: "rgba(34,197,94,0.2)", showXLabels: true, scrollX: true, height: 400 } })}>
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="font-bold text-slate-800">Busy Sales Hours</div>
            <div className="text-[11px] text-slate-500">
              Average sales by hour (all time)
            </div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <LineChart
              points={busyHourPoints}
              xLabel="Hour"
              yLabel="Avg Sales (GH₵)"
              formatY={fmtCurrency}
              color="#22c55e"
              areaColor="rgba(34,197,94,0.2)"
              showXLabels
              scrollX
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card shadow-sm border-slate-200/60 cursor-pointer" onClick={() => setModalChart({ title: "Sales by Item Category", component: BarChart, props: { data: pieData, xKey: "label", yKey: "value", xLabel: "Category", yLabel: "Sales (GH₵)", formatY: fmtCurrency, colors: ["#14b8a6","#f43f5e","#8b5cf6","#eab308","#0ea5e9","#ec4899","#84cc16","#f97316"], height: 400 } })}>
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800">
                Sales by Item Category
              </div>
              <div className="text-[11px] text-slate-500">{dateLabel}</div>
            </div>
            {pieData.length > 0 && (
              <div className="text-xs font-bold text-slate-700">
                Total: {fmtCurrency(pieData.reduce((s, d) => s + d.value, 0))}
              </div>
            )}
          </div>
          <div className="card-body overflow-x-auto p-4" style={{ height: 350 }}>
            <BarChart
              data={pieData}
              xKey="label"
              yKey="value"
              xLabel="Category"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              colors={["#14b8a6","#f43f5e","#8b5cf6","#eab308","#0ea5e9","#ec4899","#84cc16","#f97316"]}
              height={300}
            />
          </div>
        </div>
        <div className="card shadow-sm border-slate-200/60">
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="font-bold text-slate-800">Top Selling Items</div>
            <div className="text-[11px] text-slate-500">
              Best performers by quantity ({dateLabel})
            </div>
          </div>
          <div className="card-body p-0" style={{ height: 380 }}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <span className="text-xs text-slate-500">Top</span>
              <select
                className="input text-xs py-1 px-2 w-20"
                value={String(topItemsRange)}
                onChange={(e) => { setTopItemsRange(Number(e.target.value)); setTopItemsPage(1); }}
              >
                {[5, 7, 10, 15, 20, 25, 50].map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
            </div>
            <div className="overflow-y-auto" style={{ height: 290 }}>
              <table className="table table-compact w-full">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-bold text-slate-600 w-2/3">
                      Item
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-bold text-slate-600 w-[60px]">
                      Qty
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-bold text-slate-600 w-28">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedTopItems.length > 0 ? (
                    paginatedTopItems.map((t, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-1.5 px-3 text-sm text-slate-700 font-medium truncate max-w-0">
                          {String(t.item || "")}
                        </td>
                        <td className="text-right py-1.5 px-3 text-sm font-bold text-brand">
                          {Number(t.qty || 0).toLocaleString()}
                        </td>
                        <td className="text-right py-1.5 px-3 text-sm font-semibold text-slate-600">
                          {fmtCurrency(t.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-8 text-center text-slate-400 text-sm"
                      >
                        No items found for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Page {topItemsPage} of {topItemsTotalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-xs btn-secondary"
                  disabled={topItemsPage <= 1}
                  onClick={() => setTopItemsPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-secondary"
                  disabled={topItemsPage >= topItemsTotalPages}
                  onClick={() => setTopItemsPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card shadow-sm border-slate-200/60 cursor-pointer" onClick={() => setModalChart({ title: "Profitable Groups", component: BarChart, props: { data: profitByGroup, xKey: "item_group", yKey: "profit", formatY: fmtCurrency, colors: ["#22c55e","#14b8a6","#6366f1","#f59e0b","#ef4444"], horizontal: true, height: 400 } })}>
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="font-bold text-slate-800">Profitable Groups</div>
            <div className="text-[11px] text-slate-500">{dateLabel}</div>
          </div>
          <div className="card-body p-0">
            <div className="overflow-y-auto p-4" style={{ maxHeight: 340 }}>
              <BarChart
                data={profitByGroup}
                xKey="item_group"
                yKey="profit"
                formatY={fmtCurrency}
                colors={["#22c55e","#14b8a6","#6366f1","#f59e0b","#ef4444"]}
                horizontal
              />
            </div>
          </div>
        </div>
        <div className="card shadow-sm border-slate-200/60 cursor-pointer" onClick={() => setModalChart({ title: "Profitable Items", component: BarChart, props: { data: profitByItem, xKey: "item", yKey: "profit", formatY: fmtCurrency, colors: ["#6366f1","#f59e0b","#ef4444","#22c55e","#14b8a6"], horizontal: true, height: 400 } })}>
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="font-bold text-slate-800">Profitable Items</div>
            <div className="text-[11px] text-slate-500">{dateLabel}</div>
          </div>
          <div className="card-body p-0">
            <div className="overflow-y-auto p-4" style={{ maxHeight: 340 }}>
              <BarChart
                data={profitByItem}
                xKey="item"
                yKey="profit"
                formatY={fmtCurrency}
                colors={["#6366f1","#f59e0b","#ef4444","#22c55e","#14b8a6"]}
                horizontal
              />
            </div>
          </div>
        </div>
      </div>

      {modalChart && <ChartViewerModal chart={modalChart} onClose={() => setModalChart(null)} />}
    </div>
  );
}
