import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, Download, RefreshCw, ShieldCheck, Calendar, 
  DollarSign, TrendingUp, AlertCircle, Clock, Building2, User
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function FMContractsReport() {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [clients, setClients] = useState([]);
  const [filters, setFilters] = useState({
    clientId: "",
    status: ""
  });

  useEffect(() => {
    fetchClients();
    fetchReport();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await api.get("/sales/customers");
      setClients(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch {}
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get("/facilities/reports/contract-profitability", { params: filters });
      setReportData(res.data?.data || null);
    } catch {
      toast.error("Failed to load FM contract profitability report");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData?.contracts?.length) {
      toast.warn("No contracts to export");
      return;
    }
    const headers = ["Contract #", "Title", "Client", "Start Date", "End Date", "Billing Frequency", "Billing Amount", "Total Value", "Operational Cost", "Gross Profit", "Margin %", "Renewal Status"];
    const rows = reportData.contracts.map(c => [
      c.contract_no || "",
      `"${(c.contract_title || "").replace(/"/g, '""')}"`,
      `"${(c.client_name || "").replace(/"/g, '""')}"`,
      c.start_date || "",
      c.end_date || "",
      c.billing_frequency || "",
      c.billing_amount || 0,
      c.contract_value || 0,
      c.total_operational_cost || 0,
      c.gross_profit || 0,
      `${c.gross_margin_pct || 0}%`,
      c.renewal_status || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FM_Contracts_Profitability_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Contract Report exported successfully");
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
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              FM Contracts Portfolio & Margin Profitability Report
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Service agreement financial health, recurring revenues, operational delivery costs, and contract renewal pipeline.
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
        <div className="flex items-center gap-2">
          <User size={15} className="text-slate-400" />
          <select
            value={filters.clientId}
            onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}
            className="input py-1 px-2 text-xs"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.customer_name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input py-1 px-2 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="EXPIRED">Expired</option>
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
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Contract Value (TCV)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  ${Number(summary.total_contract_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Across {summary.total_contracts || 0} client contracts
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monthly Recurring Revenue</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600">
                  ${Number(summary.monthly_recurring_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                ARR Run Rate: <span className="font-bold text-slate-700 dark:text-slate-300">${Number(summary.annualized_run_rate || 0).toLocaleString()}</span>
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Profit Margin</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-indigo-600">
                  {summary.overall_gross_margin_pct || 0}%
                </span>
                <span className="text-xs text-slate-400">margin</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Net Profit: <span className="font-bold text-emerald-600">${Number(summary.total_gross_profit || 0).toLocaleString()}</span>
              </p>
            </div>

            <div className="card p-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Upcoming Expirations</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-extrabold ${summary.expiring_30_days > 0 ? "text-amber-500" : "text-slate-700 dark:text-slate-200"}`}>
                  {summary.expiring_30_days || 0}
                </span>
                <span className="text-xs text-amber-500 font-medium">Within 30 Days</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Within 60 days: {summary.expiring_60_days || 0} • Within 90 days: {summary.expiring_90_days || 0}
              </p>
            </div>
          </div>

          {/* Contracts Portfolio & Profitability Table */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Service Contract Financial Margins & Renewal Pipeline
            </h3>
            <div className="overflow-x-auto">
              <table className="table w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                    <th>Contract #</th>
                    <th>Title & Client</th>
                    <th>Properties</th>
                    <th>Billing Cycle</th>
                    <th>Contract Value</th>
                    <th>Delivery Cost</th>
                    <th>Gross Margin</th>
                    <th>End Date</th>
                    <th>Renewal Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.contracts?.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {c.contract_no}
                      </td>
                      <td>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{c.contract_title}</div>
                        <div className="text-[11px] text-slate-400">{c.client_name || "—"}</div>
                      </td>
                      <td>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-mono">
                          {c.properties_covered_count || 1} Sites
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold">{c.billing_frequency}</span>
                        <div className="text-[10px] text-slate-400">${Number(c.billing_amount).toLocaleString()}/cycle</div>
                      </td>
                      <td className="font-bold text-slate-900 dark:text-white">
                        ${Number(c.contract_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-slate-600 dark:text-slate-300">
                        ${Number(c.total_operational_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <div className="text-[10px] text-slate-400">{c.job_orders_count || 0} jobs</div>
                      </td>
                      <td>
                        <span className={`font-bold ${c.gross_margin_pct >= 40 ? "text-emerald-600" : c.gross_margin_pct >= 20 ? "text-amber-500" : "text-rose-600"}`}>
                          {c.gross_margin_pct}%
                        </span>
                        <div className="text-[10px] text-slate-400">(${Number(c.gross_profit).toLocaleString()})</div>
                      </td>
                      <td>{c.end_date ? new Date(c.end_date).toLocaleDateString() : "—"}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.renewal_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' :
                          c.renewal_status === 'EXPIRING_30_DAYS' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 animate-pulse' :
                          c.renewal_status === 'EXPIRING_60_DAYS' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400' :
                          c.renewal_status === 'EXPIRING_90_DAYS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {c.renewal_status.replace(/_/g, " ")}
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
