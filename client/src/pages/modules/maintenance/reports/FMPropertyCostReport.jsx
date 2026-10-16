import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, Download, RefreshCw, Calendar, DollarSign, 
  Building2, Wrench, Layers, BarChart2, TrendingUp, Filter
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function FMPropertyCostReport() {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    propertyId: "",
    serviceLine: ""
  });

  useEffect(() => {
    fetchProperties();
    fetchReport();
  }, []);

  const fetchProperties = async () => {
    try {
      const res = await api.get("/facilities/properties");
      setProperties(res.data?.data || []);
    } catch {}
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get("/facilities/reports/property-costs", { params: filters });
      setReportData(res.data?.data || null);
    } catch {
      toast.error("Failed to load property maintenance cost report");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData?.cost_records?.length) {
      toast.warn("No cost records to export");
      return;
    }
    const headers = ["Work Order #", "Subject", "Service Line", "Property", "Client", "Labor Hours", "Material Cost", "Total Cost", "Completed Date"];
    const rows = reportData.cost_records.map(r => [
      r.job_order_no || `WO-${r.id}`,
      `"${(r.subject || "").replace(/"/g, '""')}"`,
      r.service_line || "",
      `"${(r.property_name || "").replace(/"/g, '""')}"`,
      `"${(r.client_name || "").replace(/"/g, '""')}"`,
      r.actual_hours || 0,
      r.material_cost || 0,
      r.total_cost || 0,
      r.created_at || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FM_Property_Cost_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Cost Report exported successfully");
  };

  const summary = reportData?.summary || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header with Back Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            to="/maintenance/reports"
            className="btn btn-secondary p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title="Back to Reports Hub"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Property Maintenance Cost & Expense Allocation Report
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Financial cost tracking across property portfolios: labor vs material expenses, service line splits, and cost per square meter.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="btn-outline px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="btn-primary px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Calendar size={15} className="text-indigo-500" />
          <span>From</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="input py-1 px-2 text-xs w-36"
          />
          <span>To</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="input py-1 px-2 text-xs w-36"
          />
        </div>

        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-slate-400" />
          <select
            value={filters.propertyId}
            onChange={(e) => setFilters({ ...filters, propertyId: e.target.value })}
            className="input py-1 px-2 text-xs"
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.property_name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchReport}
          className="btn-primary px-4 py-1.5 text-xs font-semibold rounded-lg ml-auto"
        >
          Apply Filters
        </button>
      </div>

      {loading ? (
        <div className="p-16 flex justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Cost Overview KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Operational Cost</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  ${Number(summary.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Across {summary.total_work_orders || 0} executed work orders
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Labor Cost</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-indigo-600">
                  ${Number(summary.total_labor_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-slate-400">({summary.total_labor_hours || 0} hrs)</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Technician field hours & on-site repairs
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Material & Parts Cost</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-600">
                  ${Number(summary.total_material_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Spare parts, filters, consumables & supplies
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cost / Square Meter</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600">
                  ${summary.cost_per_sqm || 0}
                </span>
                <span className="text-xs text-slate-400">/ sqm</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Across {Number(summary.total_managed_sqm || 0).toLocaleString()} sqm portfolio area
              </p>
            </div>
          </div>

          {/* Breakdown by Service Line & Property */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Service Line Cost Distribution */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Wrench size={16} className="text-indigo-500" />
                Cost by Service Line
              </h3>
              <div className="overflow-x-auto">
                <table className="table w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                      <th>Service Line</th>
                      <th>Jobs</th>
                      <th>Labor Hrs</th>
                      <th>Materials</th>
                      <th>Total Cost</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData?.service_lines?.map((s, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="font-semibold text-slate-800 dark:text-slate-200">
                          {s.service_line.replace(/_/g, " ")}
                        </td>
                        <td>{s.job_count}</td>
                        <td>{s.labor_hours}h</td>
                        <td>${Number(s.material_cost).toFixed(2)}</td>
                        <td className="font-bold text-slate-900 dark:text-white">
                          ${Number(s.line_total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {s.cost_share_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Property Cost Breakdown */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Building2 size={16} className="text-emerald-500" />
                Cost by Property Portfolio
              </h3>
              <div className="overflow-x-auto">
                <table className="table w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                      <th>Property</th>
                      <th>Type</th>
                      <th>Jobs</th>
                      <th>Area</th>
                      <th>Total Cost</th>
                      <th>Cost/sqm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData?.property_costs?.map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="font-semibold text-slate-800 dark:text-slate-200">{p.property_name}</td>
                        <td className="text-[10px] text-slate-400">{p.property_type?.replace(/_/g, " ")}</td>
                        <td>{p.job_count}</td>
                        <td>{p.total_area_sqm ? `${Number(p.total_area_sqm).toLocaleString()} sqm` : "—"}</td>
                        <td className="font-bold text-slate-900 dark:text-white">
                          ${Number(p.property_total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="font-semibold text-emerald-600">
                          {p.cost_per_sqm > 0 ? `$${p.cost_per_sqm}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detailed Job Cost Audit Table */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Detailed Work Order Cost Records
            </h3>
            <div className="overflow-x-auto">
              <table className="table w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                    <th>Work Order #</th>
                    <th>Subject</th>
                    <th>Service Line</th>
                    <th>Property</th>
                    <th>Client</th>
                    <th>Hours</th>
                    <th>Materials</th>
                    <th>Total Cost</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.cost_records?.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {r.job_order_no || `WO-${r.id}`}
                      </td>
                      <td className="font-medium max-w-xs truncate">{r.subject}</td>
                      <td>
                        <span className="font-mono text-[10px] text-slate-500">
                          {r.service_line?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>{r.property_name || "—"}</td>
                      <td>{r.client_name || "—"}</td>
                      <td>{r.actual_hours || 0}h</td>
                      <td>${Number(r.material_cost || 0).toFixed(2)}</td>
                      <td className="font-bold text-slate-900 dark:text-white">
                        ${Number(r.total_cost || 0).toFixed(2)}
                      </td>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
