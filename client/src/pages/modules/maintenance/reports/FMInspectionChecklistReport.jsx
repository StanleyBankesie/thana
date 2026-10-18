import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Download, RefreshCw, ClipboardList, CheckSquare, 
  AlertTriangle, CheckCircle2, XCircle, Building2, User, Layers
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function FMInspectionChecklistReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [filters, setFilters] = useState({
    templateId: ""
  });

  useEffect(() => {
    fetchTemplates();
    fetchReport();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await api.get("/facilities/checklists/templates");
      setTemplates(res.data?.data || []);
    } catch {}
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get("/facilities/reports/checklist-inspections", { params: filters });
      setReportData(res.data?.data || null);
    } catch {
      toast.error("Failed to load checklist inspections report");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData?.execution_logs?.length) {
      toast.warn("No checklist logs to export");
      return;
    }
    const headers = ["Execution ID", "Work Order #", "Property", "Template Name", "Overall Result", "Completed By", "Completed Date", "Notes"];
    const rows = reportData.execution_logs.map(log => [
      log.id,
      log.job_order_no || `WO-${log.work_order_id}`,
      `"${(log.property_name || "").replace(/"/g, '""')}"`,
      `"${(log.template_name || "").replace(/"/g, '""')}"`,
      log.overall_result || "",
      `"${(log.completed_by_name || "").replace(/"/g, '""')}"`,
      log.completed_at || "",
      `"${(log.overall_notes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Checklist_Inspections_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Inspection Report exported successfully");
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
              <ClipboardList className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Equipment PPM & Inspection Checklists Compliance Report
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Digital operating procedure execution logs, quality pass/fail rates, critical out-of-range sensor readings, and corrective actions.
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
        <div className="flex items-center gap-2">
          <CheckSquare size={15} className="text-slate-400" />
          <select
            value={filters.templateId}
            onChange={(e) => setFilters({ ...filters, templateId: e.target.value })}
            className="input py-1 px-2 text-xs"
          >
            <option value="">All Inspection Templates</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.template_name}</option>
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
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Checklists Executed</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {summary.total_executions || 0}
                </span>
                <span className="text-xs text-slate-400">audits</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Completed by on-site field technicians
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Inspection Pass Rate</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-extrabold ${summary.pass_rate_pct >= 90 ? "text-emerald-600" : summary.pass_rate_pct >= 75 ? "text-amber-500" : "text-rose-600"}`}>
                  {summary.pass_rate_pct ?? 100}%
                </span>
                <span className="text-xs text-slate-400">passed</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                {summary.passed_count || 0} passed • {summary.failed_count || 0} failed
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Critical Out-of-Range Flags</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-extrabold ${summary.out_of_range_items > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {summary.out_of_range_items || 0}
                </span>
                <span className="text-xs text-rose-500 font-medium">Readings</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Voltages, pressures, temperatures beyond thresholds
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Standard Templates</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-indigo-600">
                  {reportData?.templates?.length || 0}
                </span>
                <span className="text-xs text-slate-400">SOP forms</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Across electrical, HVAC, plumbing, safety lines
              </p>
            </div>
          </div>

          {/* Breakdown by Checklist Template */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare size={16} className="text-emerald-500" />
              Performance by Checklist SOP Template
            </h3>
            <div className="overflow-x-auto">
              <table className="table w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                    <th>Template Code</th>
                    <th>Template Name</th>
                    <th>Service Line</th>
                    <th>Times Executed</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Pass Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.templates?.map((t) => (
                    <tr key={t.template_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {t.template_code}
                      </td>
                      <td className="font-semibold text-slate-800 dark:text-slate-200">{t.template_name}</td>
                      <td>
                        <span className="font-mono text-[10px] text-slate-500">
                          {t.service_line?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>{t.times_executed}</td>
                      <td className="text-emerald-600 font-bold">{t.passed_count}</td>
                      <td className={t.failed_count > 0 ? "text-rose-600 font-bold" : ""}>{t.failed_count}</td>
                      <td>
                        <span className={`font-bold ${t.pass_rate >= 90 ? "text-emerald-600" : "text-amber-500"}`}>
                          {t.pass_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Execution Logs */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Recent On-Site Inspection Execution Logs
            </h3>
            <div className="overflow-x-auto">
              <table className="table w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                    <th>Execution ID</th>
                    <th>Work Order #</th>
                    <th>Property</th>
                    <th>Inspection Template</th>
                    <th>Completed By</th>
                    <th>Completed At</th>
                    <th>Overall Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.execution_logs?.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="font-mono text-slate-500">#{log.id}</td>
                      <td className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {log.job_order_no || `WO-${log.work_order_id}`}
                      </td>
                      <td>{log.property_name || "—"}</td>
                      <td className="font-medium text-slate-800 dark:text-slate-200">{log.template_name}</td>
                      <td>{log.completed_by_name || "Technician"}</td>
                      <td>{log.completed_at ? new Date(log.completed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "—"}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.overall_result === 'PASS' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' :
                          log.overall_result === 'FAIL' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                        }`}>
                          {log.overall_result}
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
