/**
 * @fileoverview ProjectIncomeReport component.
 * Provides functionality for ProjectIncomeReport.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, RefreshCw, Search, TrendingUp, Receipt, FolderOpen } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const statusStyles = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  POSTED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  REVERSED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProjectIncomeReport() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total: 0 });
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `/projects/reports/project-income?`;
      if (selectedProjectId) url += `project_id=${selectedProjectId}&`;
      if (dateFrom) url += `from=${dateFrom}&`;
      if (dateTo) url += `to=${dateTo}&`;
      
      const res = await api.get(url);
      setProjects(res.data?.projects || []);
      setItems(res.data?.items || []);
      setSummary(res.data?.summary || { count: 0, total: 0 });
    } catch { toast.error("Failed to load report"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [selectedProjectId, dateFrom, dateTo]);

  const handleProjectChange = (e) => {
    setSelectedProjectId(e.target.value);
  };

  const exportExcel = () => {
    const headers = ["Voucher No", "Date", "Description", "Amount", "Status"];
    const rows = items.map(v => [
      v.voucher_no, v.voucher_date, (v.description || ""),
      Number(v.amount || 0).toFixed(2), v.status
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `project-income-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportPdf = () => {
    const headers = ["Voucher No", "Date", "Description", "Amount", "Status"];
    const rows = items.map(v => [
      v.voucher_no, v.voucher_date, (v.description || ""),
      Number(v.amount || 0).toFixed(2), v.status
    ]);
    const doc = new jsPDF();
    doc.autoTable({
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    doc.save(`project-income-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const selectedProject = projects.find(p => String(p.id) === String(selectedProjectId));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management?section=Reports%20%26%20Analytics" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Project Income Report</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">View all receipt vouchers linked to a project</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="btn btn-secondary p-2" title="Refresh"><RefreshCw size={18} /></button>
          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={exportExcel} className="btn-success flex items-center gap-2"><Download size={18} /> Excel</button>
              <button onClick={exportPdf} className="btn-error flex items-center gap-2 text-white bg-rose-600 hover:bg-rose-700"><Download size={18} /> PDF</button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-3 w-full md:flex-1">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
              <Search size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <select value={selectedProjectId} onChange={handleProjectChange} className="input w-full bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-900/50 focus:border-emerald-400 dark:focus:border-emerald-600">
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-900/50 focus:border-emerald-400 dark:focus:border-emerald-600" />
            <span className="text-slate-500 font-medium">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-900/50 focus:border-emerald-400 dark:focus:border-emerald-600" />
          </div>
        </div>
      </div>

      {selectedProjectId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 shadow-lg text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-xl"><Receipt size={20} /></div>
            </div>
            <div className="text-3xl font-bold">{summary.count}</div>
            <div className="text-emerald-100 text-xs uppercase tracking-wider font-semibold mt-1">Total Receipts</div>
          </div>
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-5 shadow-lg text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-xl"><TrendingUp size={20} /></div>
            </div>
            <div className="text-3xl font-bold">{Number(summary.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-teal-100 text-xs uppercase tracking-wider font-semibold mt-1">Total Income</div>
          </div>
          <div className="bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-700 dark:to-slate-800 rounded-2xl p-5 shadow-lg text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-xl"><FolderOpen size={20} /></div>
            </div>
            <div className="text-lg font-bold truncate">{selectedProject?.project_name || "-"}</div>
            <div className="text-slate-300 text-xs uppercase tracking-wider font-semibold mt-1">Project</div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Voucher No</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Currency</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-20 text-center animate-pulse text-slate-400 dark:text-slate-500 font-semibold">Loading...</td></tr>
              ) : items.length > 0 ? items.map(v => (
                <tr key={v.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all duration-200">
                  <td className="px-6 py-4 font-bold text-sm text-emerald-700 dark:text-emerald-400">{v.voucher_no}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{v.voucher_date ? new Date(v.voucher_date).toLocaleDateString() : "-"}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-xs">{v.description || "—"}</div>
                    <div className="text-xs text-slate-500 truncate max-w-xs">{v.project_name || "—"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1 rounded-lg">{v.voucher_type_name || "-"}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400">{v.currency_code || "GHS"}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{Number(v.amount || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${statusStyles[v.status] || "bg-slate-100 text-slate-700"}`}>{v.status}</span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="px-6 py-20 text-center text-slate-400 dark:text-slate-500 italic">No receipt vouchers found for this project.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
