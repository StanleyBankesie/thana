/**
 * @fileoverview ServiceReportsPage component.
 * Modernized Analytics & Reports hub for Service Management module listing all service performance, SLA, and revenue reports.
 */

import React from "react";
import { Link } from "react-router-dom";
import { 
  Wrench, 
  Clock, 
  CheckCircle2, 
  DollarSign, 
  Users, 
  BarChart3, 
  FileText, 
  AlertTriangle, 
  Repeat, 
  ArrowUpRight,
  ChevronRight
} from "lucide-react";

export default function ServiceReportsPage() {
  const reportCategories = [
    {
      category: "Service Demand & Execution Reports",
      description: "Track incoming service requests, technician productivity, and job order status",
      reports: [
        {
          title: "Service Request Summary",
          description: "Monitor customer and supplier incoming service request volumes",
          path: "/service-management/reports/service-request-summary",
          icon: FileText,
          color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40",
        },
        {
          title: "Service Order Status",
          description: "Track progress, pending orders, and completion milestones",
          path: "/service-management/reports/service-order-status",
          icon: Clock,
          color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40",
        },
        {
          title: "Execution Performance",
          description: "Measure technician efficiency and execution turnaround times",
          path: "/service-management/reports/execution-performance",
          icon: Wrench,
          color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
        },
        {
          title: "SLA Compliance",
          description: "Monitor Service Level Agreement adherence and overdue SLA tickets",
          path: "/service-management/reports/sla-compliance",
          icon: AlertTriangle,
          color: "text-rose-500 bg-rose-50 dark:bg-rose-950/40",
        },
      ],
    },
    {
      category: "Workforce & Quality Performance",
      description: "Technician utilization, customer confirmation, and recurring service request analysis",
      reports: [
        {
          title: "Technician Utilization",
          description: "Workforce productivity, hours logged, and job distribution",
          path: "/service-management/reports/technician-utilization",
          icon: Users,
          color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
        },
        {
          title: "Service Confirmation Report",
          description: "Customer sign-off and service delivery confirmation logs",
          path: "/service-management/reports/service-confirmation",
          icon: CheckCircle2,
          color: "text-teal-500 bg-teal-50 dark:bg-teal-950/40",
        },
        {
          title: "Repeat Service Requests",
          description: "Identify recurring equipment issues and rework requests",
          path: "/service-management/reports/repeat-requests",
          icon: Repeat,
          color: "text-purple-500 bg-purple-50 dark:bg-purple-950/40",
        },
        {
          title: "Visitors Log Report",
          description: "Summary of facility visitors, site entries, and host check-ins",
          path: "/service-management/reports/visitors-log",
          icon: FileText,
          color: "text-sky-500 bg-sky-50 dark:bg-sky-950/40",
        },
      ],
    },
    {
      category: "Financial & Billing Reports",
      description: "Revenue tracking, outstanding bills, and job cost profitability analysis",
      reports: [
        {
          title: "Service Revenue Report",
          description: "Total revenue generated per period, branch, and service category",
          path: "/service-management/reports/service-revenue",
          icon: DollarSign,
          color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
        },
        {
          title: "Outstanding Service Bills",
          description: "Unpaid service invoices and accounts receivable collection tracking",
          path: "/service-management/reports/outstanding-bills",
          icon: BarChart3,
          color: "text-orange-500 bg-orange-50 dark:bg-orange-950/40",
        },
        {
          title: "Service Cost Analysis",
          description: "Profitability per service job comparing labor and parts costs to billed revenue",
          path: "/service-management/reports/service-cost-analysis",
          icon: DollarSign,
          color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
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
                <Wrench className="w-7 h-7" /> Service Management Reports Hub
              </h1>
              <p className="text-sm mt-1 opacity-90">
                Analytics suite for service executions, technician utilization, SLA compliance, and billing
              </p>
            </div>
            <Link to="/service-management?section=Reports%20%26%20Parameters" className="btn btn-secondary text-xs">
              Return to Service Menu
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-brand bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Service Reports</p>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">11 Reports</h3>
          </div>
          <Wrench className="w-7 h-7 text-brand opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-emerald-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">SLA Tracking</p>
            <h3 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">Active</h3>
          </div>
          <Clock className="w-7 h-7 text-emerald-500 opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-indigo-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue Analytics</p>
            <h3 className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">Real-Time</h3>
          </div>
          <DollarSign className="w-7 h-7 text-indigo-500 opacity-80" />
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
