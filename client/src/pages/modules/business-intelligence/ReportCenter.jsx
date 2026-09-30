/**
 * @fileoverview Report Center — consolidated links to all module reports with search and export.
 */
import React, { useState } from "react";
import { FileText, Search, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "./bi.shared.jsx";

const REPORTS = [
  { module: "Sales", label: "Sales Register", path: "/sales/reports/sales-register", icon: "📊" },
  { module: "Sales", label: "Revenue by Customer", path: "/sales/reports/revenue-by-customer", icon: "📊" },
  { module: "Sales", label: "Revenue by Product", path: "/sales/reports/revenue-by-product", icon: "📊" },
  { module: "Sales", label: "Invoice Summary", path: "/sales/reports/invoice-summary", icon: "📄" },
  { module: "Sales", label: "Sales Order Status", path: "/sales/reports/sales-order-status", icon: "📄" },
  { module: "Sales", label: "Monthly Sales Trend", path: "/sales/reports/monthly-sales-trend", icon: "📈" },
  { module: "Purchase", label: "Supplier Performance", path: "/purchase/reports/supplier-performance", icon: "📊" },
  { module: "Purchase", label: "Purchase Aging", path: "/purchase/reports/purchase-aging", icon: "📄" },
  { module: "Purchase", label: "Lead Time Analysis", path: "/purchase/reports/lead-time-analysis", icon: "📈" },
  { module: "Purchase", label: "Price Variance", path: "/purchase/reports/price-variance", icon: "📊" },
  { module: "Finance", label: "Accounts Receivable Aging", path: "/finance/reports/accounts-receivable-aging", icon: "📄" },
  { module: "Finance", label: "Supplier Outstanding Payables", path: "/purchase/reports/supplier-outstanding-payables", icon: "📄" },
  { module: "Inventory", label: "Stock Balances", path: "/inventory/reports/stock-balances", icon: "📦" },
  { module: "Inventory", label: "Stock Movement", path: "/inventory/reports/stock-movement", icon: "📦" },
  { module: "HR", label: "Employee List", path: "/hr/reports/employee-list", icon: "👥" },
  { module: "HR", label: "Attendance Report", path: "/hr/reports/attendance", icon: "👥" },
  { module: "Projects", label: "Task Management & Execution", path: "/project-management/reports/task-management-execution", icon: "✅" },
  { module: "Projects", label: "Project Status", path: "/project-management/reports/project-status", icon: "✅" },
  { module: "Service", label: "Service Request Summary", path: "/service-management/reports/service-request-summary", icon: "🔧" },
  { module: "Service", label: "Technician Utilization", path: "/service-management/reports/technician-utilization", icon: "🔧" },
  { module: "Service", label: "SLA Compliance", path: "/service-management/reports/sla-compliance", icon: "🔧" },
  { module: "POS", label: "POS Sales Report", path: "/pos/reports/sales", icon: "⚡" },
  { module: "Transport", label: "Trip Report", path: "/transport/reports/trips", icon: "🚛" },
  { module: "Maintenance", label: "Job Order Report", path: "/maintenance/reports/job-orders", icon: "⚙️" },
];

const MODULES = ["All", ...new Set(REPORTS.map(r => r.module))];

export default function ReportCenter() {
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("All");
  const navigate = useNavigate();

  const filtered = REPORTS.filter(r => {
    const matchModule = module === "All" || r.module === module;
    const matchSearch = !search.trim() || r.label.toLowerCase().includes(search.toLowerCase()) || r.module.toLowerCase().includes(search.toLowerCase());
    return matchModule && matchSearch;
  });

  const grouped = MODULES.filter(m => m !== "All").reduce((acc, m) => {
    const items = filtered.filter(r => r.module === m);
    if (items.length) acc[m] = items;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader title="Report Center" description="Access all module reports in one place — search, filter, and navigate" />

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input w-full pl-8 text-sm"
            placeholder="Search reports..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {MODULES.map(m => (
            <button key={m} onClick={() => setModule(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${module === m ? "bg-brand-900 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Report grid */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No reports match your search.</div>
      ) : (
        Object.entries(grouped).map(([mod, reports]) => (
          <div key={mod}>
            <h3 className="text-xs font-bold text-brand-800 dark:text-brand-300 uppercase tracking-wider mb-3">{mod}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {reports.map((report) => (
                <button
                  key={report.path}
                  onClick={() => navigate(`${report.path}?from=/business-intelligence/report-center`)}
                  className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-400 hover:shadow-erp-sm text-left transition-all group"
                >
                  <span className="text-xl flex-shrink-0">{report.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-300 truncate transition-colors">{report.label}</div>
                    <div className="text-[10px] text-slate-400">{mod}</div>
                  </div>
                  <ExternalLink size={12} className="text-slate-300 group-hover:text-brand-400 flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
