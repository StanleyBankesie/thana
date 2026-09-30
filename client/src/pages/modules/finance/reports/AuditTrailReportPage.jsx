/**
 * @fileoverview AuditTrailReportPage component.
 * Standard Modern UI Audit Trail report for system activity tracking.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  RefreshCw, 
  History,
  ShieldCheck,
  UserCheck,
  Activity,
  Filter
} from "lucide-react";

export default function AuditTrailReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/audit-trail", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const jan1 = new Date(year, 0, 1);
    setFrom(jan1.toISOString().slice(0, 10));
    setTo(today.toISOString().slice(0, 10));
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingCounter]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, pollingCounter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <Link
                to="/finance?section=Reports%20%26%20Analysis"
                className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors mb-2"
              >
                <ArrowLeft size={14} /> Back to Finance
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <History className="w-6 h-6" /> Audit Trail Report
              </h1>
              <p className="text-sm mt-0.5 opacity-90">
                System activity, user modifications & transaction logs for finance module
              </p>
            </div>

            {/* Export Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "AuditTrail");
                  XLSX.writeFile(wb, "audit-trail.xlsx");
                }}
                disabled={!items.length}
              >
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const doc = new jsPDF("p", "mm", "a4");
                  let y = 15;
                  doc.setFontSize(14);
                  doc.text("Audit Trail", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Date/Time", 10, y);
                  doc.text("User", 60, y);
                  doc.text("Action", 95, y);
                  doc.text("Entity", 130, y);
                  doc.text("Ref", 165, y);
                  doc.text("Details", 190, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const dt = r.action_time
                      ? new Date(r.action_time).toLocaleString()
                      : "-";
                    const user = String(r.user_name || "-").slice(0, 25);
                    const act = String(r.action || "-").slice(0, 25);
                    const ent = String(r.entity || "-").slice(0, 25);
                    const ref = String(r.ref_no || "-").slice(0, 25);
                    const det = String(r.details || "-").slice(0, 60);
                    doc.text(dt, 10, y);
                    doc.text(user, 60, y);
                    doc.text(act, 95, y);
                    doc.text(ent, 130, y);
                    doc.text(ref, 165, y);
                    doc.text(det, 190, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("audit-trail.pdf");
                }}
                disabled={!items.length}
              >
                <FileText size={14} /> PDF
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-1.5"
                onClick={() => window.print()}
              >
                <Printer size={14} /> Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl">
            <Activity size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Total Logged Actions</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {items.length} Events
            </span>
          </div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Active Audit Users</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {new Set(items.map((i) => i.user_name || "System")).size} Users
            </span>
          </div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Audited Entities</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {new Set(items.map((i) => i.entity).filter(Boolean)).size} Entities
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-end justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full sm:w-auto">
            <div>
              <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">From Date</label>
              <input
                className="input w-full text-sm"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">To Date</label>
              <input
                className="input w-full text-sm"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
            onClick={() => { setFrom(""); setTo(""); }}
            disabled={loading}
          >
            <Filter size={14} /> Clear Filter
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="card shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                <th className="py-3 px-4 text-left">Date / Time</th>
                <th className="py-3 px-4 text-left">User</th>
                <th className="py-3 px-4 text-left">Action</th>
                <th className="py-3 px-4 text-left">Entity</th>
                <th className="py-3 px-4 text-left">Reference</th>
                <th className="py-3 px-4 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    <RefreshCw className="animate-spin w-6 h-6 mx-auto mb-2" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {r.action_time ? new Date(r.action_time).toLocaleString() : "—"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                      {r.user_name || "System"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md uppercase">
                        {r.action || "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300 font-semibold">
                      {r.entity || "—"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs font-bold text-brand dark:text-brand-300">
                      {r.ref_no || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {r.details || "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    No audit activity logs recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
