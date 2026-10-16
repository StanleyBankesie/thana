/**
 * @fileoverview MaintenanceReports component.
 * Provides functionality for MaintenanceReports.
 */

import React from "react";
import { 
  BarChart3, 
  PieChart, 
  FileText, 
  TrendingUp, 
  ArrowLeft, 
  Settings, 
  Calendar, 
  ZapOff, 
  Activity, 
  ChevronRight, 
  ShieldCheck, 
  Clock,
  DollarSign,
  Building2,
  ClipboardList,
  Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";

const ReportCard = ({ title, description, icon, path, color }) => (
  <Link 
    to={path}
    className="group bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-xs hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900 transition-all duration-300 flex items-start gap-5"
  >
    <div className={`p-4 rounded-2xl ${color} shadow-xs group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <div className="flex-1 space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{title}</h3>
        <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
  </Link>
);

export default function MaintenanceReports() {
  const fmReports = [
    {
      title: "FM SLA Compliance & Performance",
      description: "Measure helpdesk ticket response times, resolution benchmarks, and breach root causes.",
      icon: <ShieldCheck className="text-emerald-600" />,
      path: "/maintenance/reports/sla-compliance",
      color: "bg-emerald-50 dark:bg-emerald-900/30"
    },
    {
      title: "Property Maintenance Cost & Allocation",
      description: "Financial tracking of labor vs materials, cost per square meter, and service line expenses.",
      icon: <DollarSign className="text-blue-600" />,
      path: "/maintenance/reports/property-costs",
      color: "bg-blue-50 dark:bg-blue-900/30"
    },
    {
      title: "FM Contracts & Recurring Revenue Margins",
      description: "Track contract profitability, delivery cost margins, and 30/60/90-day renewal pipelines.",
      icon: <TrendingUp className="text-indigo-600" />,
      path: "/maintenance/reports/contract-profitability",
      color: "bg-indigo-50 dark:bg-indigo-900/30"
    },
    {
      title: "Soft Services Compliance Audit",
      description: "Janitorial hygiene scores, security patrol checkpoints, pest control risks, and waste volumes.",
      icon: <Sparkles className="text-amber-600" />,
      path: "/maintenance/reports/soft-services",
      color: "bg-amber-50 dark:bg-amber-900/30"
    },
    {
      title: "Equipment PPM & Inspection Checklists",
      description: "Audit completed SOP inspection checklists, pass/fail rates, and critical out-of-range sensor readings.",
      icon: <ClipboardList className="text-purple-600" />,
      path: "/maintenance/reports/checklist-inspections",
      color: "bg-purple-50 dark:bg-purple-900/30"
    }
  ];

  const plantReports = [
    {
      title: "Asset Downtime Analysis",
      description: "Analyze unplanned downtime by asset, category, and root cause impact.",
      icon: <ZapOff className="text-rose-600" />,
      path: "/maintenance/reports/downtime",
      color: "bg-rose-50 dark:bg-rose-900/30"
    },
    {
      title: "Maintenance Cost Summary",
      description: "Detailed breakdown of labor and material costs across plant maintenance activities.",
      icon: <Activity className="text-amber-600" />,
      path: "/maintenance/reports/costs",
      color: "bg-amber-50 dark:bg-amber-900/30"
    }
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700">
      {/* Header with Back Button */}
      <div className="flex items-center gap-6">
        <Link 
          to="/maintenance?section=Setup %26 Reports" 
          className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-700 hover:bg-slate-50 transition-all text-slate-500"
          title="Back to Maintenance"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Maintenance & Facilities Analytics</h1>
          <p className="text-slate-500 font-medium">Strategic intelligence for facility operations, SLA compliance, cost control, and asset longevity</p>
        </div>
      </div>

      {/* Facilities Management Reports Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Facilities Management Industry Reports
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fmReports.map((report, idx) => (
            <ReportCard key={idx} {...report} />
          ))}
        </div>
      </div>

      {/* Equipment & Plant Reports Section */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Equipment & Plant Reliability Reports
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plantReports.map((report, idx) => (
            <ReportCard key={idx} {...report} />
          ))}
        </div>
      </div>

      {/* Predictive Maintenance Banner */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 space-y-4 max-w-lg">
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl w-fit">
            <Clock size={32} />
          </div>
          <h2 className="text-3xl font-bold">Predictive Maintenance & SLA Insights</h2>
          <p className="text-indigo-100 font-medium leading-relaxed">
            Harness real ERP operational data to shift from reactive fixes to predictive facility management.
            Eliminate SLA breach penalties, optimize subcontractor margins, and preserve asset life cycles.
          </p>
        </div>
        
        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-400/20 rounded-full translate-y-1/2 blur-3xl group-hover:translate-y-1/3 transition-transform duration-1000"></div>
      </div>
    </div>
  );
}
