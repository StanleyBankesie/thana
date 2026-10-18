import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Download, RefreshCw, Calendar, ShieldCheck, 
  AlertTriangle, Clock, CheckCircle2, XCircle, Building2, Filter, Layers
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function FMSLAComplianceReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    propertyId: "",
    priority: "",
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
    } catch {
      // Ignore
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get("/facilities/reports/sla-compliance", { params: filters });
      setReportData(res.data?.data || null);
    } catch (err) {
      toast.error("Failed to load SLA compliance report");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData?.detailed_tickets?.length) {
      toast.warn("No tickets to export");
      return;
    }
    const headers = ["Ticket #", "Subject", "Priority", "Status", "Service Line", "Property", "Client", "Created At", "Resolved At", "SLA Status"];
    const rows = reportData.detailed_tickets.map(t => [
      t.request_no || `REQ-${t.id}`,
      `"${(t.subject || "").replace(/"/g, '""')}"`,
      t.priority || "",
      t.status || "",
      t.service_line || "",
      `"${(t.property_name || "").replace(/"/g, '""')}"`,
      `"${(t.client_name || "").replace(/"/g, '""')}"`,
      t.created_at || "",
      t.resolved_at || "",
      t.computed_sla_status || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FM_SLA_Compliance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("SLA Compliance Report exported successfully");
  };

  const summary = reportData?.summary || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header with Back Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm"
            title="Go Back"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Facilities SLA Compliance & Performance Report
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Response and resolution adherence benchmarks, breach audits, and critical priority performance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="btn btn-secondary inline-flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="btn btn-primary inline-flex items-center gap-1.5"
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

        <div className="flex items-center gap-2">
          <select
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            className="input py-1 px-2 text-xs"
          >
            <option value="">All Priorities</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
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
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Overall SLA Compliance</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-extrabold ${summary.sla_compliance_pct >= 95 ? "text-emerald-600" : summary.sla_compliance_pct >= 85 ? "text-amber-500" : "text-rose-600"}`}>
                  {summary.sla_compliance_pct ?? 100}%
                </span>
                <span className="text-xs text-slate-400 font-medium">Target 95%</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                {summary.resolved_count || 0} of {summary.total_requests || 0} tickets resolved within SLA
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Response Compliance</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-blue-600">
                  {summary.response_compliance_pct ?? 100}%
                </span>
                <span className="text-xs text-slate-400">on-time first contact</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Avg Response: <span className="font-bold text-slate-700 dark:text-slate-300">{summary.avg_response_hours || 0} hrs</span>
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Breached SLA Tickets</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-extrabold ${summary.resolution_breached_count > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {summary.resolution_breached_count || 0}
                </span>
                <span className="text-xs text-rose-500 font-medium">Breaches</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Active unresolved breaches: <span className="font-bold text-rose-600">{summary.open_count || 0} open</span>
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mean Time To Resolve</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-indigo-600">
                  {summary.avg_resolution_hours || 0}
                </span>
                <span className="text-xs text-slate-400">hours average</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Calculated across all closed tickets
              </p>
            </div>
          </div>

          {/* Breakdown by Priority & Property */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Priority Matrix */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} className="text-indigo-500" />
                Performance by Priority Tier
              </h3>
              <div className="overflow-x-auto">
                <table className="table w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                      <th>Priority</th>
                      <th>Total</th>
                      <th>Resolved</th>
                      <th>Breached</th>
                      <th>Avg Hours</th>
                      <th>Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData?.priority_breakdown?.map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            p.priority_level === 'EMERGENCY' ? 'bg-rose-100 text-rose-700' :
                            p.priority_level === 'CRITICAL' ? 'bg-orange-100 text-orange-700' :
                            p.priority_level === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {p.priority_level}
                          </span>
                        </td>
                        <td>{p.total_count}</td>
                        <td>{p.resolved_count}</td>
                        <td className={p.breached_count > 0 ? "font-bold text-rose-600" : ""}>{p.breached_count}</td>
                        <td>{p.avg_resolution_hours} hrs</td>
                        <td>
                          <span className={`font-bold ${p.compliance_pct >= 90 ? "text-emerald-600" : "text-rose-600"}`}>
                            {p.compliance_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Property Breakdown */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Building2 size={16} className="text-emerald-500" />
                Top Properties SLA Compliance
              </h3>
              <div className="overflow-x-auto">
                <table className="table w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                      <th>Property</th>
                      <th>Requests</th>
                      <th>Open</th>
                      <th>Breaches</th>
                      <th>Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData?.property_breakdown?.map((prop, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="font-semibold text-slate-800 dark:text-slate-200">{prop.property_name}</td>
                        <td>{prop.total_requests}</td>
                        <td>{prop.open_requests}</td>
                        <td className={prop.breached_requests > 0 ? "font-bold text-rose-600" : ""}>{prop.breached_requests}</td>
                        <td>
                          <span className={`font-bold ${prop.compliance_pct >= 90 ? "text-emerald-600" : "text-rose-600"}`}>
                            {prop.compliance_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detailed Request Audit Table */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Recent Service Requests & SLA Audit Trail
            </h3>
            <div className="overflow-x-auto">
              <table className="table w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                    <th>Ticket #</th>
                    <th>Subject</th>
                    <th>Priority</th>
                    <th>Property</th>
                    <th>Client</th>
                    <th>Created</th>
                    <th>SLA Target</th>
                    <th>Status</th>
                    <th>SLA Result</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.detailed_tickets?.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {t.request_no || `REQ-${t.id}`}
                      </td>
                      <td className="font-medium max-w-xs truncate">{t.subject}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.priority === 'EMERGENCY' ? 'bg-rose-100 text-rose-700' :
                          t.priority === 'CRITICAL' ? 'bg-orange-100 text-orange-700' :
                          t.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {t.priority}
                        </span>
                      </td>
                      <td>{t.property_name || "—"}</td>
                      <td>{t.client_name || "—"}</td>
                      <td>{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td>
                      <td>{t.sla_resolution_due ? new Date(t.sla_resolution_due).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "—"}</td>
                      <td>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {t.status}
                        </span>
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.computed_sla_status === 'MET' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' :
                          t.computed_sla_status === 'BREACHED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400' :
                          t.computed_sla_status === 'AT_RISK' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                        }`}>
                          {t.computed_sla_status}
                        </span>
                      </td>
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
