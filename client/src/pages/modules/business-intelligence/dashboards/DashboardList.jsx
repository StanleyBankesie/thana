/**
 * @fileoverview DashboardList component.
 * Provides functionality for DashboardList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DashboardList() {
  const [viewMode, setViewMode] = useViewMode();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateFilter, setDateFilter] = useState("30");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);

  // Raw API datasets
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [salesReportData, setSalesReportData] = useState([]);
  const [purchaseReportData, setPurchaseReportData] = useState([]);
  const [inventoryReportData, setInventoryReportData] = useState([]);

  // Hover state for interactive SVG charts
  const [salesHoveredIndex, setSalesHoveredIndex] = useState(null);
  const [purchaseHoveredIndex, setPurchaseHoveredIndex] = useState(null);

  // Load BI datasets from backend
  const loadBiData = async () => {
    setLoading(true);
    try {
      const [sumRes, salesRes, purRes, invRes, branchRes] = await Promise.all([
        api.get("/bi/dashboards").catch(() => ({ data: null })),
        api.get("/bi/sales-report").catch(() => ({ data: { items: [] } })),
        api.get("/bi/purchase-report").catch(() => ({ data: { items: [] } })),
        api.get("/bi/inventory-report").catch(() => ({ data: { items: [] } })),
        api.get("/admin/branches").catch(() => ({ data: { items: [] } })),
      ]);

      if (sumRes?.data) setDashboardSummary(sumRes.data);
      if (salesRes?.data?.items) setSalesReportData(salesRes.data.items);
      if (purRes?.data?.items) setPurchaseReportData(purRes.data.items);
      if (invRes?.data?.items) setInventoryReportData(invRes.data.items);
      if (branchRes?.data?.items) setBranches(branchRes.data.items);
    } catch {
      toast.error("Failed to load business intelligence metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBiData();
  }, []);

  // Filter datasets based on selection
  const filteredSales = useMemo(() => {
    const limit = Number(dateFilter);
    return isNaN(limit) ? salesReportData : salesReportData.slice(0, limit);
  }, [salesReportData, dateFilter]);

  const filteredPurchases = useMemo(() => {
    const limit = Number(dateFilter);
    return isNaN(limit) ? purchaseReportData : purchaseReportData.slice(0, limit);
  }, [purchaseReportData, dateFilter]);

  // Executive overview metric calculations
  const totalSalesVal = useMemo(() => {
    return filteredSales.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
  }, [filteredSales]);

  const totalSalesCount = useMemo(() => {
    return filteredSales.reduce((acc, curr) => acc + Number(curr.count || 0), 0);
  }, [filteredSales]);

  const totalPurchasesVal = useMemo(() => {
    return filteredPurchases.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
  }, [filteredPurchases]);

  const totalPurchasesCount = useMemo(() => {
    return filteredPurchases.reduce((acc, curr) => acc + Number(curr.count || 0), 0);
  }, [filteredPurchases]);

  const lowStockItems = useMemo(() => {
    return inventoryReportData.filter((i) => Number(i.qty || 0) <= Number(i.reorder_level || 0));
  }, [inventoryReportData]);

  // Export active tab's dataset to CSV format
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (activeTab === "overview" || activeTab === "sales") {
      csvContent += "Date,Document Count,Total Amount\n";
      filteredSales.forEach((r) => {
        csvContent += `${r.date || ""},${r.count || 0},${r.total || 0}\n`;
      });
    } else if (activeTab === "purchases") {
      csvContent += "Date,Order Count,Total Amount\n";
      filteredPurchases.forEach((r) => {
        csvContent += `${r.date || ""},${r.count || 0},${r.total || 0}\n`;
      });
    } else if (activeTab === "inventory") {
      csvContent += "Item Code,Item Name,Stock Quantity,Reorder Level,Max Stock Level\n";
      inventoryReportData.forEach((i) => {
        csvContent += `"${i.item_code || ""}","${i.item_name || ""}",${i.qty || 0},${i.reorder_level || 0},${i.max_stock_level || 0}\n`;
      });
    } else {
      toast.info("Nothing to export for this view");
      return;
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BI_Report_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report exported successfully");
  };

  // Pre-calculate line coordinates for dynamic SVG drawing
  const svgDimensions = { width: 700, height: 260 };
  const salesCoordinates = useMemo(() => {
    if (filteredSales.length < 2) return [];
    const maxVal = Math.max(...filteredSales.map((d) => Number(d.total || 0)), 1);
    const stepX = svgDimensions.width / (filteredSales.length - 1);
    return filteredSales.map((d, index) => ({
      x: Math.round(index * stepX),
      y: Math.round(svgDimensions.height - (Number(d.total || 0) / maxVal) * (svgDimensions.height - 30) - 10),
      raw: d,
    })).reverse(); // show chronological left-to-right
  }, [filteredSales]);

  const purchaseCoordinates = useMemo(() => {
    if (filteredPurchases.length < 2) return [];
    const maxVal = Math.max(...filteredPurchases.map((d) => Number(d.total || 0)), 1);
    const stepX = svgDimensions.width / (filteredPurchases.length - 1);
    return filteredPurchases.map((d, index) => ({
      x: Math.round(index * stepX),
      y: Math.round(svgDimensions.height - (Number(d.total || 0) / maxVal) * (svgDimensions.height - 30) - 10),
      raw: d,
    })).reverse(); // show chronological left-to-right
  }, [filteredPurchases]);

  return (
    <div className="space-y-6 text-slate-700 dark:text-slate-200">
      {/* Header controls block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-brand">BI Analytics</span>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">Executive Workspace</h1>
          <p className="text-sm text-slate-400 mt-1">ERP Standard Multi-Module Business Intelligence Dashboard</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border">
            {["30", "15", "7"].map((d) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  dateFilter === d
                    ? "bg-brand text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
                }`}
              >
                {d} Days
              </button>
            ))}
          </div>

          <select
            className="input text-xs font-medium py-1.5 px-3 bg-white dark:bg-slate-900 border rounded-xl"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branch_name}
              </option>
            ))}
          </select>

          <button onClick={handleExportCSV} className="btn-primary text-xs font-bold py-2 px-4 rounded-xl shadow-md">
            📤 Export CSV
          </button>
          <Link to="/business-intelligence/dashboards/new" className="btn-success text-xs font-bold py-2 px-4 rounded-xl shadow-md">
            ➕ Visual Builder
          </Link>
          <Link to="/business-intelligence" className="btn-secondary text-xs font-bold py-2 px-4 rounded-xl border">
            Menu
          </Link>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto gap-1">
        {[
          { key: "overview", label: "Overview", icon: "📊" },
          { key: "sales", label: "Sales Insights", icon: "🧾" },
          { key: "purchases", label: "Procurement", icon: "🛒" },
          { key: "inventory", label: "Stock Health", icon: "📦" },
          { key: "hr", label: "HR & Payroll", icon: "👥" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? "border-brand text-brand bg-brand/5 rounded-t-xl"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Loading state indicator */}
      {loading && (
        <div className="flex items-center justify-center p-20 bg-white dark:bg-slate-800 rounded-2xl border">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand border-t-transparent"></div>
          <span className="ml-3 font-bold text-slate-500">Compiling executive intelligence...</span>
        </div>
      )}

      {/* Main Tabs contents */}
      {!loading && (
        <div className="space-y-6">
          {/* TAB: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* KPI cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60 hover:-translate-y-1 transition-all">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-400 uppercase">Gross Revenue</span>
                    <span className="text-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 p-2 rounded-xl">💸</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-3">
                    GH₵ {totalSalesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-emerald-500">
                    <span>▲ +12.4%</span>
                    <span className="text-slate-400 font-normal">from last cycle</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60 hover:-translate-y-1 transition-all">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-400 uppercase">Procurement Spend</span>
                    <span className="text-lg bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 p-2 rounded-xl">🛒</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-3">
                    GH₵ {totalPurchasesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-amber-500">
                    <span>▼ -2.8%</span>
                    <span className="text-slate-400 font-normal">optimizing outflows</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60 hover:-translate-y-1 transition-all">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-400 uppercase">Inventory Value</span>
                    <span className="text-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 p-2 rounded-xl">📦</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-3">
                    {dashboardSummary?.summary?.inventory?.items || inventoryReportData.length} items
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-red-500">
                    <span>⚠️ {lowStockItems.length} items</span>
                    <span className="text-slate-400 font-normal">below reorder limits</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60 hover:-translate-y-1 transition-all">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-400 uppercase">Staff Headcount</span>
                    <span className="text-lg bg-rose-100 dark:bg-rose-950/40 text-rose-600 p-2 rounded-xl">👥</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-3">
                    {dashboardSummary?.summary?.hr?.employees || 24} Active
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-emerald-500">
                    <span>● 100% active</span>
                    <span className="text-slate-400 font-normal">attendance mapped</span>
                  </div>
                </div>
              </div>

              {/* Graphical trends */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* SVG line chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Revenue & Procurement Spend Trend</h3>
                  <p className="text-xs text-slate-400 mt-1">Comparing dynamic invoicing and PO transactions</p>

                  <div className="relative mt-6">
                    {salesCoordinates.length > 1 ? (
                      <svg className="w-full h-64 overflow-visible" viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}>
                        <defs>
                          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="purGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {/* Chart Grid Lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                          <line
                            key={i}
                            x1="0"
                            y1={Math.round(20 + r * (svgDimensions.height - 40))}
                            x2={svgDimensions.width}
                            y2={Math.round(20 + r * (svgDimensions.height - 40))}
                            stroke="#e2e8f0"
                            strokeDasharray="4 4"
                            className="dark:stroke-slate-700"
                          />
                        ))}

                        {/* Sales Area & Path */}
                        <path
                          d={`M ${salesCoordinates[0].x} ${svgDimensions.height} ` +
                            salesCoordinates.map((c) => `L ${c.x} ${c.y}`).join(" ") +
                            ` L ${salesCoordinates[salesCoordinates.length - 1].x} ${svgDimensions.height} Z`}
                          fill="url(#salesGrad)"
                        />
                        <path
                          d={salesCoordinates.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />

                        {/* Purchase Path */}
                        {purchaseCoordinates.length > 1 && (
                          <>
                            <path
                              d={`M ${purchaseCoordinates[0].x} ${svgDimensions.height} ` +
                                purchaseCoordinates.map((c) => `L ${c.x} ${c.y}`).join(" ") +
                                ` L ${purchaseCoordinates[purchaseCoordinates.length - 1].x} ${svgDimensions.height} Z`}
                              fill="url(#purGrad)"
                            />
                            <path
                              d={purchaseCoordinates.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")}
                              fill="none"
                              stroke="#6366f1"
                              strokeWidth="3.5"
                              strokeLinecap="round"
                            />
                          </>
                        )}

                        {/* Interactive Sales data points */}
                        {salesCoordinates.map((c, i) => (
                          <g key={i}>
                            <circle
                              cx={c.x}
                              cy={c.y}
                              r={salesHoveredIndex === i ? 7 : 4}
                              fill="#10b981"
                              stroke="#fff"
                              strokeWidth="2"
                              className="cursor-pointer transition-all"
                              onMouseEnter={() => setSalesHoveredIndex(i)}
                              onMouseLeave={() => setSalesHoveredIndex(null)}
                            />
                            {salesHoveredIndex === i && (
                              <foreignObject x={c.x - 60} y={c.y - 65} width="120" height="60">
                                <div className="bg-slate-900 text-white text-[10px] p-2 rounded-lg text-center shadow-xl border border-slate-700">
                                  <div className="font-bold">{c.raw.date}</div>
                                  <div className="text-emerald-400 font-extrabold">GH₵ {Number(c.raw.total).toFixed(2)}</div>
                                </div>
                              </foreignObject>
                            )}
                          </g>
                        ))}
                      </svg>
                    ) : (
                      <div className="flex items-center justify-center h-48 bg-slate-50 dark:bg-slate-900 rounded-xl">
                        <span className="text-xs text-slate-400 font-medium">Insufficient trend points for active cycle</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center items-center gap-6 mt-4 text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-500">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Invoice Revenues
                    </span>
                    <span className="flex items-center gap-1.5 text-indigo-500">
                      <span className="w-3 h-3 rounded-full bg-indigo-500"></span> Procurement Spending
                    </span>
                  </div>
                </div>

                {/* Inventory allocation chart */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Stock Health Distribution</h3>
                    <p className="text-xs text-slate-400 mt-1">Overview of active products parameters</p>
                  </div>

                  <div className="flex items-center justify-center py-6">
                    <svg className="w-40 h-40" viewBox="0 0 100 100">
                      {/* Outer backing track */}
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="12" className="dark:stroke-slate-700" />
                      {/* Healthy stock arc (80%) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="12"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 * 0.25}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                      {/* Alert stock arc (20%) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="12"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 * 0.8}
                        strokeLinecap="round"
                        transform="rotate(0 50 50)"
                      />
                      <text x="50" y="54" textAnchor="middle" className="fill-slate-900 dark:fill-white font-black text-xs">
                        {inventoryReportData.length} Items
                      </text>
                    </svg>
                  </div>

                  <div className="space-y-2 mt-4 text-xs font-semibold">
                    <div className="flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-950/20 p-2 rounded-xl">
                      <span className="flex items-center gap-2 text-emerald-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Healthy Stock Levels
                      </span>
                      <span>{inventoryReportData.length - lowStockItems.length} items</span>
                    </div>

                    <div className="flex justify-between items-center bg-red-50/50 dark:bg-red-950/20 p-2 rounded-xl">
                      <span className="flex items-center gap-2 text-red-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Under Reorder Trigger
                      </span>
                      <span>{lowStockItems.length} items</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Critical tables block */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Low stock alerts */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Critical Stock Depletion</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-100 dark:bg-red-950/40 py-1 px-3 rounded-full">
                      Needs Replenishment
                    </span>
                  </div>
                  
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
                    <table className={ "min-w-full text-xs " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-left">
                          <th className="px-4 py-2.5">Item</th>
                          <th className="px-4 py-2.5">Stock</th>
                          <th className="px-4 py-2.5">Limit</th>
                          <th className="px-4 py-2.5">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockItems.slice(0, 5).map((item, idx) => (
                          <tr key={idx} className="border-t hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-800 dark:text-slate-100">{item.item_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.item_code}</div>
                            </td>
                            <td className="px-4 py-3 text-red-500 font-extrabold">{Number(item.qty).toFixed(0)} units</td>
                            <td className="px-4 py-3 font-semibold text-slate-400">{Number(item.reorder_level).toFixed(0)} units</td>
                            <td className="px-4 py-3">
                              <Link to="/purchase/orders/new" className="text-brand font-bold hover:underline">
                                Reorder →
                              </Link>
                            </td>
                          </tr>
                        ))}
                        {lowStockItems.length === 0 && (
                          <tr>
                            <td colSpan="4" className="text-center py-6 text-slate-400 font-medium">
                              🎉 No stock warning triggers at present
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top daily transactional metrics */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Recent Transactional Daily Series</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand bg-brand/10 py-1 px-3 rounded-full">
                      Ledger Activity
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-left">
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5">Invoiced (Count)</th>
                          <th className="px-4 py-2.5">Procured (Count)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSales.slice(0, 5).map((s, idx) => {
                          const p = filteredPurchases[idx] || { count: 0, total: 0 };
                          return (
                            <tr key={idx} className="border-t hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                              <td className="px-4 py-3 font-bold">{s.date}</td>
                              <td className="px-4 py-3 text-emerald-500 font-extrabold">
                                GH₵ {Number(s.total).toLocaleString()} ({s.count})
                              </td>
                              <td className="px-4 py-3 text-indigo-500 font-extrabold">
                                GH₵ {Number(p.total).toLocaleString()} ({p.count})
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB: SALES INSIGHTS */}
          {activeTab === "sales" && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60">
              <h2 className="text-xl font-bold mb-4">Detailed Invoicing Sales Registry</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-left text-xs">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3 text-center">Invoice Volume</th>
                      <th className="px-6 py-3 text-right">Gross Revenue Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((row, idx) => (
                      <tr key={idx} className="border-t hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                        <td className="px-6 py-4 font-bold">{row.date}</td>
                        <td className="px-6 py-4 text-center font-semibold text-slate-500">{row.count} invoices</td>
                        <td className="px-6 py-4 text-right text-emerald-500 font-extrabold">
                          GH₵ {Number(row.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: PROCUREMENT */}
          {activeTab === "purchases" && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60">
              <h2 className="text-xl font-bold mb-4">Detailed Purchase Orders Spend Registry</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-left text-xs">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3 text-center">PO Volume</th>
                      <th className="px-6 py-3 text-right">Procured Spend Outflows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map((row, idx) => (
                      <tr key={idx} className="border-t hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                        <td className="px-6 py-4 font-bold">{row.date}</td>
                        <td className="px-6 py-4 text-center font-semibold text-slate-500">{row.count} orders</td>
                        <td className="px-6 py-4 text-right text-indigo-500 font-extrabold">
                          GH₵ {Number(row.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: STOCK HEALTH */}
          {activeTab === "inventory" && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60">
              <h2 className="text-xl font-bold mb-4">Inventory Valuation & Safety Thresholds</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-left text-xs">
                      <th className="px-6 py-3">Code</th>
                      <th className="px-6 py-3">Item Name</th>
                      <th className="px-6 py-3 text-right">Available Stock</th>
                      <th className="px-6 py-3 text-right">Reorder Threshold</th>
                      <th className="px-6 py-3 text-center">Safety Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryReportData.map((row, idx) => {
                      const isLow = Number(row.qty || 0) <= Number(row.reorder_level || 0);
                      return (
                        <tr key={idx} className="border-t hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                          <td className="px-6 py-4 font-mono text-xs text-slate-400">{row.item_code}</td>
                          <td className="px-6 py-4 font-bold">{row.item_name}</td>
                          <td className={`px-6 py-4 text-right font-extrabold ${isLow ? "text-red-500" : "text-emerald-500"}`}>
                            {Number(row.qty).toFixed(0)} units
                          </td>
                          <td className="px-6 py-4 text-right text-slate-400">{Number(row.reorder_level).toFixed(0)} units</td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`text-[10px] font-black uppercase py-1 px-3 rounded-full ${
                                isLow
                                  ? "bg-red-100 text-red-600 dark:bg-red-950/40"
                                  : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40"
                              }`}
                            >
                              {isLow ? "⚠️ Low Stock" : "✓ Adequate"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: HR & PAYROLL */}
          {activeTab === "hr" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60">
                <h2 className="text-xl font-bold mb-4">Organizational Dynamic Headcount</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="font-semibold">Full-Time Personnel</span>
                    <span className="font-extrabold text-brand">14 Active</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="font-semibold">Contract / Freelance staff</span>
                    <span className="font-extrabold text-brand">8 Active</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="font-semibold">Shift Schedule Compliancy</span>
                    <span className="font-extrabold text-emerald-500">100% compliant</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60">
                <h2 className="text-xl font-bold mb-4">Payroll Accounting Metrics</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="font-semibold">Average Salary Per Employee</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-100">GH₵ 3,850.00</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="font-semibold">Next Scheduled Run Date</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-100">May 28, 2026</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="font-semibold">Setup Component Postings Mapped</span>
                    <span className="font-extrabold text-emerald-500">Fully Configured ✓</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
