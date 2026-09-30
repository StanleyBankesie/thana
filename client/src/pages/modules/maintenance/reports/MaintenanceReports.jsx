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
  Clock
} from "lucide-react";
import { Link } from "react-router-dom";

const ReportCard = ({ title, description, icon, path, color }) => (
  <Link 
    to={path}
    className="group bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900 transition-all duration-300 flex items-start gap-5"
  >
    <div className={`p-4 rounded-2xl ${color} shadow-sm group-hover:scale-110 transition-transform`}>
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

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceReports() {
  const reports = [
    {
      title: "Asset Downtime Analysis",
      description: "Analyze unplanned downtime by asset, category, and root cause impact.",
      icon: <ZapOff className="text-rose-600" />,
      path: "/maintenance/reports/downtime",
      color: "bg-rose-50 dark:bg-rose-900/30"
    },
    {
      title: "PM Compliance Tracker",
      description: "Monitor preventive maintenance completion rates versus scheduled due dates.",
      icon: <ShieldCheck className="text-emerald-600" />,
      path: "/maintenance/reports/compliance",
      color: "bg-emerald-50 dark:bg-emerald-900/30"
    },
    {
      title: "Reliability & MTBF",
      description: "Mean Time Between Failures and Mean Time To Repair performance metrics.",
      icon: <TrendingUp className="text-blue-600" />,
      path: "/maintenance/reports/reliability",
      color: "bg-blue-50 dark:bg-blue-900/30"
    },
    {
      title: "Maintenance Cost Summary",
      description: "Detailed breakdown of labor and material costs across maintenance activities.",
      icon: <Activity className="text-amber-600" />,
      path: "/maintenance/reports/costs",
      color: "bg-amber-50 dark:bg-amber-900/30"
    }
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div className="flex items-center gap-6">
        <Link to="/maintenance?section=Reports %26 Setup" className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 transition-all text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Maintenance Analytics</h1>
          <p className="text-slate-500 font-medium">Strategic KPIs for asset longevity and operational excellence</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report, idx) => (
          <ReportCard key={idx} {...report} />
        ))}
      </div>

      <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 space-y-4 max-w-lg">
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl w-fit">
            <Clock size={32} />
          </div>
          <h2 className="text-3xl font-bold">Predictive Maintenance Insights</h2>
          <p className="text-indigo-100 font-medium leading-relaxed">
            Harness the power of data to shift from reactive repairs to predictive maintenance. 
            Reduce emergency downtime by up to 30% through trend analysis.
          </p>
        </div>
        
        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-400/20 rounded-full translate-y-1/2 blur-3xl group-hover:translate-y-1/3 transition-transform duration-1000"></div>
      </div>
    </div>
  );
}
