/**
 * @fileoverview DashboardForm component.
 * Provides functionality for DashboardForm.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

// Helper for formatting currencies
const fmtCurrency = (n) => {
  const num = Number(n || 0);
  return `GH₵ ${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DashboardForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  // States
  const [loading, setLoading] = useState(false);
  const [dashboardName, setDashboardName] = useState("Custom Analytics");
  const [dashboardDesc, setDashboardDesc] = useState("My self-service visualization workspace");
  const [widgets, setWidgets] = useState([]);

  // Modal State for adding new widget
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWidget, setNewWidget] = useState({
    title: "New Metric",
    type: "kpi", // 'kpi' | 'bar' | 'line' | 'table'
    source: "sales", // 'sales' | 'purchases' | 'inventory' | 'hr'
    size: "1/3", // '1/3' | '1/2' | 'full'
    color: "blue", // 'blue' | 'amber' | 'green' | 'red'
  });

  // Raw ERP datasets fetched from API to power dynamic widgets
  const [salesData, setSalesData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);

  // Fetch ERP datasets
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/bi/dashboards").catch(() => ({ data: null })),
      api.get("/bi/sales-report").catch(() => ({ data: { items: [] } })),
      api.get("/bi/purchase-report").catch(() => ({ data: { items: [] } })),
      api.get("/bi/inventory-report").catch(() => ({ data: { items: [] } })),
    ])
      .then(([sumRes, salesRes, purRes, invRes]) => {
        if (sumRes?.data) setSummaryData(sumRes.data);
        if (salesRes?.data?.items) setSalesData(salesRes.data.items);
        if (purRes?.data?.items) setPurchaseData(purRes.data.items);
        if (invRes?.data?.items) setInventoryData(invRes.data.items);

        // Load saved dashboard config from localStorage if edit
        const saved = localStorage.getItem(`bi_dashboard_${id || "custom"}`);
        if (saved) {
          try {
            const config = JSON.parse(saved);
            setDashboardName(config.name || "Custom Analytics");
            setDashboardDesc(config.description || "");
            setWidgets(config.widgets || []);
          } catch {}
        } else {
          // Default initial set of widgets if new
          setWidgets([
            {
              id: "1",
              title: "Gross Sales Revenue",
              type: "kpi",
              source: "sales",
              size: "1/3",
              color: "green",
            },
            {
              id: "2",
              title: "Active Stock Items",
              type: "kpi",
              source: "inventory",
              size: "1/3",
              color: "blue",
            },
            {
              id: "3",
              title: "Total Staff Strength",
              type: "kpi",
              source: "hr",
              size: "1/3",
              color: "amber",
            },
          ]);
        }
      })
      .catch(() => toast.error("Failed to fetch BI datasets"))
      .finally(() => setLoading(false));
  }, [id]);

  // Handle widget deletion
  const handleDeleteWidget = (wId) => {
    setWidgets((prev) => prev.filter((w) => w.id !== wId));
    toast.success("Widget removed");
  };

  // Add new widget configured by the user
  const handleAddWidget = (e) => {
    e.preventDefault();
    const w = {
      ...newWidget,
      id: String(Date.now()),
    };
    setWidgets((prev) => [...prev, w]);
    setShowAddModal(false);
    toast.success(`Custom widget "${w.title}" added to grid!`);
  };

  // Pre-configured templates to populate workspace instantly
  const loadTemplate = (theme) => {
    if (theme === "executive") {
      setDashboardName("Executive Operations Board");
      setDashboardDesc("Full control over Sales, Stock, and Employee metrics");
      setWidgets([
        { id: "e1", title: "Total Sales Invoiced", type: "kpi", source: "sales", size: "1/3", color: "green" },
        { id: "e2", title: "Total Purchase Inflows", type: "kpi", source: "purchases", size: "1/3", color: "blue" },
        { id: "e3", title: "Active ERP Staff", type: "kpi", source: "hr", size: "1/3", color: "amber" },
        { id: "e4", title: "Sales Revenue Performance Trend", type: "line", source: "sales", size: "1/2", color: "green" },
        { id: "e5", title: "Stock Replenishment Forecast", type: "bar", source: "purchases", size: "1/2", color: "blue" },
      ]);
      toast.success("Executive template loaded");
    } else if (theme === "sales") {
      setDashboardName("Sales Analytics Board");
      setDashboardDesc("Deep dive into invoice cycles and revenue lines");
      setWidgets([
        { id: "s1", title: "Gross Revenues", type: "kpi", source: "sales", size: "1/2", color: "green" },
        { id: "s2", title: "Average Order Count", type: "kpi", source: "sales", size: "1/2", color: "amber" },
        { id: "s3", title: "Revenue Transaction Log", type: "table", source: "sales", size: "full", color: "green" },
      ]);
      toast.success("Sales template loaded");
    } else if (theme === "inventory") {
      setDashboardName("Stock Valuation Dashboard");
      setDashboardDesc("Active inventory lists and reorder alerts");
      setWidgets([
        { id: "i1", title: "Total Products Tracked", type: "kpi", source: "inventory", size: "1/2", color: "blue" },
        { id: "i2", title: "Safety Warning Stock Items", type: "kpi", source: "inventory", size: "1/2", color: "red" },
        { id: "i3", title: "Stock Valuation Ledger", type: "table", source: "inventory", size: "full", color: "blue" },
      ]);
      toast.success("Inventory template loaded");
    }
  };

  // Save layout config persistently
  const handleSaveDashboard = () => {
    const config = {
      name: dashboardName,
      description: dashboardDesc,
      widgets,
    };
    localStorage.setItem(`bi_dashboard_${id || "custom"}`, JSON.stringify(config));
    toast.success("Self-service dashboard and visualizations saved successfully!");
    navigate("/business-intelligence/dashboards");
  };

  // Dynamic visualizer renderer
  const renderWidgetVisuals = (widget) => {
    const colorSchemes = {
      blue: {
        bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-800/60",
        text: "text-blue-700 dark:text-blue-300",
        pill: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
        lineColor: "#3b82f6",
      },
      amber: {
        bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-800/60",
        text: "text-amber-700 dark:text-amber-300",
        pill: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
        lineColor: "#d97706",
      },
      green: {
        bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-800/60",
        text: "text-emerald-700 dark:text-emerald-300",
        pill: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
        lineColor: "#10b981",
      },
      red: {
        bg: "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-800/60",
        text: "text-red-700 dark:text-red-300",
        pill: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
        lineColor: "#ef4444",
      },
    };
    const c = colorSchemes[widget.color] || colorSchemes.blue;

    // ── Visual Type 1: KPI Single Card ──
    if (widget.type === "kpi") {
      let value = "—";
      let subtitle = "";

      if (widget.source === "sales") {
        const val = salesData.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
        value = fmtCurrency(val);
        subtitle = `${salesData.reduce((acc, curr) => acc + Number(curr.count || 0), 0)} sales generated`;
      } else if (widget.source === "purchases") {
        const val = purchaseData.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
        value = fmtCurrency(val);
        subtitle = `${purchaseData.reduce((acc, curr) => acc + Number(curr.count || 0), 0)} POs created`;
      } else if (widget.source === "inventory") {
        const count = summaryData?.summary?.inventory?.items || inventoryData.length || 0;
        value = `${count} Tracked`;
        const low = inventoryData.filter((i) => Number(i.qty || 0) <= Number(i.reorder_level || 0)).length;
        subtitle = `${low} below reorder limit`;
      } else if (widget.source === "hr") {
        const staff = summaryData?.summary?.hr?.employees || 24;
        value = `${staff} Active`;
        subtitle = "Full team operational";
      }

      return (
        <div className={`p-6 rounded-2xl border ${c.bg} flex flex-col justify-between h-40 transition-all hover:shadow-md`}>
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{widget.title}</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.pill}`}>Metric</span>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">{value}</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</div>
          </div>
        </div>
      );
    }

    // ── Visual Type 2: SVG Line Trend Chart ──
    if (widget.type === "line") {
      const dataset = widget.source === "sales" ? salesData : purchaseData;
      const coordinates = [];
      if (dataset.length > 1) {
        const maxVal = Math.max(...dataset.map((d) => Number(d.total || 0)), 1);
        const stepX = 500 / (dataset.length - 1);
        dataset.forEach((d, idx) => {
          coordinates.push({
            x: Math.round(idx * stepX),
            y: Math.round(180 - (Number(d.total || 0) / maxVal) * 140),
            date: d.date,
            val: d.total,
          });
        });
        coordinates.reverse();
      }

      return (
        <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h4 className="font-bold text-sm text-slate-700 dark:text-white">{widget.title}</h4>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.pill}`}>Line Trend</span>
          </div>

          {coordinates.length > 1 ? (
            <svg className="w-full h-44 overflow-visible" viewBox="0 0 500 180">
              <path
                d={coordinates.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")}
                fill="none"
                stroke={c.lineColor}
                strokeWidth="3"
                strokeLinecap="round"
              />
              {coordinates.map((c, i) => (
                <circle
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  r="3.5"
                  fill={c.lineColor}
                  stroke="#fff"
                  strokeWidth="1.5"
                  title={`${c.date}: ${c.val}`}
                />
              ))}
            </svg>
          ) : (
            <div className="flex items-center justify-center h-44 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs text-slate-400">
              Insufficient historical dataset points
            </div>
          )}
        </div>
      );
    }

    // ── Visual Type 3: SVG Bar Chart ──
    if (widget.type === "bar") {
      const dataset = widget.source === "sales" ? salesData : purchaseData;
      const maxVal = Math.max(1, ...dataset.map((d) => Number(d.total || 0)));

      return (
        <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h4 className="font-bold text-sm text-slate-700 dark:text-white">{widget.title}</h4>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.pill}`}>Bar Distribution</span>
          </div>

          {dataset.length > 0 ? (
            <div className="flex items-end gap-1.5 h-44 pt-4 overflow-x-auto">
              {dataset.slice(0, 15).map((d, idx) => {
                const h = Math.max(8, Math.round((Number(d.total || 0) / maxVal) * 140));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full rounded-t transition-all hover:brightness-95"
                      style={{ height: `${h}px`, backgroundColor: c.lineColor }}
                      title={`${d.date}: ${fmtCurrency(d.total)}`}
                    />
                    <span className="text-[8px] text-slate-400 font-mono mt-1 rotate-45 origin-left whitespace-nowrap">
                      {d.date ? d.date.split("-").slice(1).join("/") : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-44 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs text-slate-400">
              No parameters loaded for distribution
            </div>
          )}
        </div>
      );
    }

    // ── Visual Type 4: Data Table Grid ──
    if (widget.type === "table") {
      if (widget.source === "inventory") {
        return (
          <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-bold text-sm text-slate-700 dark:text-white">{widget.title}</h4>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.pill}`}>Data Table</span>
            </div>
            <div className="overflow-x-auto max-h-48">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-left">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Available Qty</th>
                    <th className="px-3 py-2 text-right">Min level</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryData.slice(0, 4).map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2.5 font-bold">{item.item_name}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">{Number(item.qty).toFixed(0)} units</td>
                      <td className="px-3 py-2.5 text-right text-slate-400 font-mono">{Number(item.reorder_level).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      // Default fallback table (Sales Invoices list)
      return (
        <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <h4 className="font-bold text-sm text-slate-700 dark:text-white">{widget.title}</h4>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.pill}`}>Data Table</span>
          </div>
          <div className="overflow-x-auto max-h-48">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-left">
                  <th className="px-3 py-2">Date Series</th>
                  <th className="px-3 py-2 text-center">Docs</th>
                  <th className="px-3 py-2 text-right">Valuation</th>
                </tr>
              </thead>
              <tbody>
                {salesData.slice(0, 4).map((row, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2.5 font-bold">{row.date}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500 font-semibold">{row.count} invoices</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600 font-extrabold">{fmtCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="space-y-1.5 flex-1 max-w-xl">
          <button onClick={() => window.history.back()} className="text-xs text-brand font-bold hover:underline">
            ← Back to Dashboards
          </button>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              className="text-2xl font-black text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand outline-none pb-0.5 w-full"
              placeholder="Enter Dashboard Title..."
            />
          </div>
          <input
            type="text"
            value={dashboardDesc}
            onChange={(e) => setDashboardDesc(e.target.value)}
            className="text-xs text-slate-400 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand outline-none w-full"
            placeholder="Add dashboard description..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick template triggers */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase px-2">Templates:</span>
            <button
              onClick={() => loadTemplate("executive")}
              className="text-[10px] font-bold px-2 py-1 rounded bg-white dark:bg-slate-800 border hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              💼 Executive
            </button>
            <button
              onClick={() => loadTemplate("sales")}
              className="text-[10px] font-bold px-2 py-1 rounded bg-white dark:bg-slate-800 border hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              💸 Sales
            </button>
            <button
              onClick={() => loadTemplate("inventory")}
              className="text-[10px] font-bold px-2 py-1 rounded bg-white dark:bg-slate-800 border hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              📦 Stock
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 shadow"
          >
            <span>➕</span> Add Custom Widget
          </button>

          <button
            onClick={handleSaveDashboard}
            className="btn-success text-xs font-bold py-2 px-5 rounded-xl flex items-center gap-1.5 shadow"
          >
            <span>💾</span> Save Workspace
          </button>
        </div>
      </div>

      {/* Main Grid Workspace Canvas */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-800 rounded-2xl border">
          <span className="animate-spin inline-block w-8 h-8 border-4 border-brand border-t-transparent rounded-full mb-3" />
          <p className="text-sm font-bold text-slate-500">Connecting dynamic self-service dataset arrays...</p>
        </div>
      ) : widgets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          {widgets.map((widget) => {
            // Determine size span classes
            let spanClass = "md:col-span-2"; // 1/3 width
            if (widget.size === "1/2") spanClass = "md:col-span-3"; // 1/2 width
            if (widget.size === "full") spanClass = "md:col-span-6"; // full width

            return (
              <div key={widget.id} className={`${spanClass} relative group`}>
                {/* Delete/Edit hover controls */}
                <button
                  onClick={() => handleDeleteWidget(widget.id)}
                  className="absolute top-3 right-3 z-20 w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                  title="Remove visualization card"
                >
                  ✕
                </button>
                {renderWidgetVisuals(widget)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 border-dashed text-slate-400">
          <span className="text-5xl mb-4">📈</span>
          <p className="text-base font-bold text-slate-700 dark:text-white">Workspace Empty</p>
          <p className="text-xs mt-1 max-w-sm text-center">
            Click <strong>Add Custom Widget</strong> above to design your own visualization types or load a pre-configured dashboard template.
          </p>
        </div>
      )}

      {/* Custom Widget Builder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 dark:bg-slate-900/40 px-5 py-4 border-b dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-base">
                Self-Service Visualization Designer
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddWidget} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Visualization Card Label *
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={newWidget.title}
                  onChange={(e) => setNewWidget((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Visual Display Type
                  </label>
                  <select
                    className="input w-full"
                    value={newWidget.type}
                    onChange={(e) => setNewWidget((p) => ({ ...p, type: e.target.value }))}
                  >
                    <option value="kpi">KPI Metric Card</option>
                    <option value="bar">Bar Distribution Chart</option>
                    <option value="line">Line Trend Chart</option>
                    <option value="table">Detailed Data Table</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    ERP Data Stream
                  </label>
                  <select
                    className="input w-full"
                    value={newWidget.source}
                    onChange={(e) => setNewWidget((p) => ({ ...p, source: e.target.value }))}
                  >
                    <option value="sales">Sales Invoiced Inflow</option>
                    <option value="purchases">Procurement Spend Outflow</option>
                    <option value="inventory">Valued Stock Health</option>
                    <option value="hr">HR & Payroll Staffing</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Grid Scale Span
                  </label>
                  <select
                    className="input w-full"
                    value={newWidget.size}
                    onChange={(e) => setNewWidget((p) => ({ ...p, size: e.target.value }))}
                  >
                    <option value="1/3">1/3 Width Span</option>
                    <option value="1/2">1/2 Width Span</option>
                    <option value="full">Full Width Span</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Color Accent Theme
                  </label>
                  <select
                    className="input w-full"
                    value={newWidget.color}
                    onChange={(e) => setNewWidget((p) => ({ ...p, color: e.target.value }))}
                  >
                    <option value="blue">Sapphire Blue Accent</option>
                    <option value="green">Emerald Green Accent</option>
                    <option value="amber">Amber Gold Accent</option>
                    <option value="red">Crimson Red Accent</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t dark:border-slate-700 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary text-xs font-bold py-2 px-4 rounded-xl border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs font-bold py-2 px-5 rounded-xl shadow"
                >
                  Confirm & Place
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
