/**
 * @fileoverview ProductionReports component.
 * Provides functionality for ProductionReports.
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
  Layers,
  Activity,
  ChevronRight,
  Warehouse
} from "lucide-react";
import { Link } from "react-router-dom";

const ReportCard = ({ title, description, icon, path, color }) => (
  <Link 
    to={path}
    className="card p-6 group flex items-start gap-5 hover:border-brand-500 transition-all shadow-sm"
  >
    <div className={`p-4 rounded-2xl ${color} shadow-sm group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <div className="flex-1 space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-brand-900 dark:text-brand-300 group-hover:text-brand-600 transition-colors">{title}</h3>
        <ChevronRight size={18} className="text-slate-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1.5">{description}</p>
    </div>
  </Link>
);

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProductionReports() {
  const reports = [
    {
      title: "Detailed Production Report",
      description: "Breakdown by Production Date, Unit, Machine, Shift, Process, Manufacturing Date, Item, Planned and Produced Qty.",
      icon: <BarChart3 className="text-emerald-600" />,
      path: "/production/reports/production-detail",
      color: "bg-emerald-50 dark:bg-emerald-900/30"
    },
    {
      title: "Production & Material Executive Summary",
      description: "Comprehensive summary covering total production output, consumption, completed and pending orders.",
      icon: <FileText className="text-purple-600" />,
      path: "/production/reports/summary",
      color: "bg-purple-50 dark:bg-purple-900/30"
    },
    {
      title: "Warehouse Stock Availability",
      description: "Real-time available quantities of raw materials and WIP across all production warehouses.",
      icon: <Warehouse className="text-emerald-600" />,
      path: "/production/reports/warehouse-stock",
      color: "bg-emerald-50 dark:bg-emerald-900/30"
    },
    {
      title: "Production Efficiency",
      description: "Comparison of planned quantities versus actual production output by item.",
      icon: <TrendingUp className="text-brand-600" />,
      path: "/production/reports/efficiency",
      color: "bg-brand-50 dark:bg-brand-900/30"
    },
    {
      title: "Material Usage Variance",
      description: "Analyze the gap between estimated BOM consumption and actual material logs.",
      icon: <Activity className="text-amber-600" />,
      path: "/production/reports/variance",
      color: "bg-amber-50 dark:bg-amber-900/30"
    },
    {
      title: "BOM Explosion Analysis",
      description: "Detailed breakdown of all levels of multi-stage Bill of Materials.",
      icon: <Layers className="text-blue-600" />,
      path: "/production/reports/bom-explosion",
      color: "bg-blue-50 dark:bg-blue-900/30"
    },
    {
      title: "Machine Utilization",
      description: "Insights into which equipment is most active across production cycles.",
      icon: <Settings className="text-indigo-600" />,
      path: "/production/reports/machines",
      color: "bg-indigo-50 dark:bg-indigo-900/30"
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link to="/production?section=Reports%20%26%20Costing" className="btn btn-secondary p-2">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Production Analytics</h1>
          <p className="text-slate-500 text-sm">Strategic insights for manufacturing performance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report, idx) => (
          <ReportCard key={idx} {...report} />
        ))}
      </div>

      <div className="bg-brand-900 dark:bg-brand-950 rounded-3xl p-10 text-white relative overflow-hidden shadow-2xl shadow-brand-200 dark:shadow-none group">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl w-fit border border-white/10">
            <PieChart size={36} className="text-brand-300" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Comprehensive Manufacturing Intelligence</h2>
          <p className="text-brand-200 text-base leading-relaxed max-w-xl">
            Our reports combine shop floor execution data with inventory movements to give you a 360° view of your factory's health.
          </p>
        </div>
        
        {/* Abstract background shapes */}
        <div className="absolute -top-10 -right-10 w-80 h-80 bg-brand-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
        <div className="absolute -bottom-10 left-1/4 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl group-hover:translate-y-4 transition-transform duration-700"></div>
      </div>
    </div>
  );
}
