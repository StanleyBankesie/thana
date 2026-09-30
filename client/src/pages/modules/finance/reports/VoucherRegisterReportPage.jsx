/**
 * @fileoverview VoucherRegisterReportPage component.
 * Standard Modern UI Voucher Register report for finance module.
 */

import React, { useEffect, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  RefreshCw, 
  Receipt,
  TrendingUp,
  TrendingDown,
  FileCheck,
  Filter
} from "lucide-react";

export default function VoucherRegisterReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/voucher-register", {
        params: { from: from || null, to: to || null, type: type || null },
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
  }, [from, to, type, pollingCounter]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(items, "voucher_date", "desc");

  // Summaries
  const totals = useMemo(() => {
    return items.reduce(
      (acc, r) => {
        acc.debit += Number(r.total_debit || 0);
        acc.credit += Number(r.total_credit || 0);
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [items]);

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
                <Receipt className="w-6 h-6" /> Voucher Register
              </h1>
              <p className="text-sm mt-0.5 opacity-90">
                Complete listing of financial vouchers, type classifications & status tracking
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
                  XLSX.utils.book_append_sheet(wb, ws, "VoucherRegister");
                  XLSX.writeFile(wb, "voucher-register.xlsx");
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
                  doc.text("Voucher Register", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Date", 10, y);
                  doc.text("Voucher No", 45, y);
                  doc.text("Type", 95, y);
                  doc.text("Description", 125, y);
                  doc.text("Debit", 160, y);
                  doc.text("Credit", 180, y);
                  doc.text("Status", 200, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const dt = r.voucher_date
                      ? new Date(r.voucher_date).toLocaleDateString()
                      : "-";
                    const no = String(r.voucher_no || "-");
                    const typeCode = String(r.voucher_type_code || "-");
                    const desc = String(r.description || "-").slice(0, 35);
                    const dr = String(
                      Number(r.total_debit || 0).toLocaleString(),
                    );
                    const cr = String(
                      Number(r.total_credit || 0).toLocaleString(),
                    );
                    const st = String(r.status || "-");
                    doc.text(dt, 10, y);
                    doc.text(no, 45, y);
                    doc.text(typeCode, 95, y);
                    doc.text(desc, 125, y);
                    doc.text(dr, 160, y);
                    doc.text(cr, 180, y);
                    doc.text(st, 200, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("voucher-register.pdf");
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

      {/* KPI Summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
            <FileCheck size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Total Vouchers</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {items.length} Vouchers
            </span>
          </div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Total Debit Volume</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
              GHS {totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
            <TrendingDown size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Total Credit Volume</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
              GHS {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
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
          <div>
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Voucher Type</label>
            <select
              className="input w-full text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">All Voucher Types</option>
              <option value="JV">JV - Journal Voucher</option>
              <option value="PV">PV - Payment Voucher</option>
              <option value="SV">SV - Sales Voucher</option>
              <option value="CV">CV - Contra Voucher</option>
              <option value="RV">RV - Receipt Voucher</option>
              <option value="PAYV">PAYV - Payroll Voucher</option>
              <option value="CN">CN - Credit Note</option>
              <option value="DN">DN - Debit Note</option>
            </select>
          </div>
          <button
            type="button"
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            onClick={() => { setFrom(""); setTo(""); setType(""); }}
            disabled={loading}
          >
            <Filter size={14} /> Clear Filters
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="card shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                <SortableHeader label="Date" sortKey="voucher_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Voucher No" sortKey="voucher_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Type" sortKey="voucher_type_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Description" sortKey="description" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Debit (GHS)" sortKey="total_debit" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <SortableHeader label="Credit (GHS)" sortKey="total_credit" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">
                    <RefreshCw className="animate-spin w-6 h-6 mx-auto mb-2" />
                    Loading voucher register...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? (
                sortedItems.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {r.voucher_date ? new Date(r.voucher_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-semibold text-brand dark:text-brand-300">
                      {r.voucher_no}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-xs">
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                        {r.voucher_type_code || r.voucher_type_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                      {r.description || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                      {Number(r.total_debit || 0) > 0 ? Number(r.total_debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                      {Number(r.total_credit || 0) > 0 ? Number(r.total_credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                        r.status === "POSTED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}>
                        {r.status || "DRAFT"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">
                    No vouchers found for selected criteria.
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
