/**
 * @fileoverview InventoryReportsPage component.
 * Modernized Analytics & Reports hub for Inventory module listing all stock balances, aging, movement, and valuation reports.
 */

import React from "react";
import { Link } from "react-router-dom";
import { 
  Package, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  FileText, 
  Activity, 
  ArrowUpRight,
  ChevronRight,
  ArrowLeftRight,
  ShieldCheck
} from "lucide-react";

export default function InventoryReportsPage() {
  const reportCategories = [
    {
      category: "Stock Balances & Valuation Reports",
      description: "Monitor current warehouse stock levels, valuation, and periodical statements",
      reports: [
        {
          title: "Stock Balances Summary",
          description: "Real-time stock quantities across all warehouses and bins",
          path: "/inventory/reports/stock-balances",
          icon: Package,
          color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40",
        },
        {
          title: "Stock Valuation Report",
          description: "Inventory valuation calculated by weighted average and FIFO unit costs",
          path: "/inventory/reports/stock-value",
          icon: DollarSign,
          color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
        },
        {
          title: "Periodical Stock Summary",
          description: "Opening balance, receipts, issues, and closing balance per period",
          path: "/inventory/reports/periodical-stock-summary",
          icon: FileText,
          color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40",
        },
        {
          title: "Periodical Stock Statement",
          description: "Detailed chronological stock ledger movements and transaction refs",
          path: "/inventory/reports/periodical-stock-statement",
          icon: Layers,
          color: "text-purple-500 bg-purple-50 dark:bg-purple-950/40",
        },
        {
          title: "Inventory Health Monitor",
          description: "Stock coverage, safety stock levels, and days-of-inventory-on-hand",
          path: "/inventory/reports/health-monitor",
          icon: Activity,
          color: "text-rose-500 bg-rose-50 dark:bg-rose-950/40",
        },
      ],
    },
    {
      category: "Stock Movement & Item Velocity",
      description: "Analyze fast, slow, non-moving stock items and aging analysis",
      reports: [
        {
          title: "Fast Moving Items",
          description: "High-velocity inventory items with rapid turnover rates",
          path: "/inventory/reports/fast-moving",
          icon: TrendingUp,
          color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
        },
        {
          title: "Slow Moving Items",
          description: "Items with low consumption rates requiring stock monitoring",
          path: "/inventory/reports/slow-moving",
          icon: TrendingDown,
          color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
        },
        {
          title: "Non-Moving Items",
          description: "Dead stock analysis for items with zero movements over 90+ days",
          path: "/inventory/reports/non-moving",
          icon: AlertTriangle,
          color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40",
        },
        {
          title: "Stock Aging Analysis",
          description: "Inventory age distribution grouped into 30, 60, 90, 180+ day brackets",
          path: "/inventory/reports/aging-analysis",
          icon: Clock,
          color: "text-red-500 bg-red-50 dark:bg-red-950/40",
        },
      ],
    },
    {
      category: "Operations & Transaction Registers",
      description: "Registers for material issues, stock transfers, adjustments, and verification",
      reports: [
        {
          title: "Issue Register Report",
          description: "Log of store material issues to departments and projects",
          path: "/inventory/reports/issue-register",
          icon: FileText,
          color: "text-sky-500 bg-sky-50 dark:bg-sky-950/40",
        },
        {
          title: "Stock Transfer Register",
          description: "Warehouse-to-warehouse stock transfer dispatches and receipts",
          path: "/inventory/reports/transfer-register",
          icon: ArrowLeftRight,
          color: "text-teal-500 bg-teal-50 dark:bg-teal-950/40",
        },
        {
          title: "Stock Adjustment Register",
          description: "Audit trail of physical stock count adjustments and variance postings",
          path: "/inventory/reports/adjustment-register",
          icon: Layers,
          color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
        },
        {
          title: "Stock Verification Report",
          description: "Physical audit comparison vs system stock balances",
          path: "/inventory/reports/verification-report",
          icon: ShieldCheck,
          color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header Banner */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-7 h-7" /> Inventory Reports & Valuation Hub
              </h1>
              <p className="text-sm mt-1 opacity-90">
                Complete analytics suite for warehouse stock balances, valuation, item velocity, and operations
              </p>
            </div>
            <Link to="/inventory?section=Reports%20%26%20Valuation" className="btn btn-secondary text-xs">
              Return to Inventory Menu
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-brand bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory Reports</p>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">13 Active</h3>
          </div>
          <Package className="w-7 h-7 text-brand opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-emerald-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Valuation Engine</p>
            <h3 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">Weighted Avg</h3>
          </div>
          <DollarSign className="w-7 h-7 text-emerald-500 opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-indigo-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Velocity Analysis</p>
            <h3 className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">Fast / Slow / Dead</h3>
          </div>
          <TrendingUp className="w-7 h-7 text-indigo-500 opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-amber-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Export Formats</p>
            <h3 className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">Excel & PDF</h3>
          </div>
          <FileText className="w-7 h-7 text-amber-500 opacity-80" />
        </div>
      </div>

      {/* Report Categories & Cards */}
      <div className="space-y-8">
        {reportCategories.map((cat, idx) => (
          <div key={idx} className="space-y-3">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                {cat.category}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cat.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.reports.map((r, rIdx) => {
                const IconComponent = r.icon;
                return (
                  <Link
                    key={rIdx}
                    to={r.path}
                    className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand dark:hover:border-brand-500 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={`p-2.5 rounded-xl ${r.color}`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-brand transition-colors">
                        {r.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {r.description}
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-brand">
                      <span>Generate Report</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
