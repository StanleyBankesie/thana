/**
 * @fileoverview ExecOutstandingReceivablesPage component.
 * Modernized Executive report for Outstanding Customer Receivables.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { CreditCard, AlertCircle, Download, Printer, RefreshCw, Calendar, Search } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import {
  fetchReportHeader,
  applyPdfHeader,
  applyPdfFooter,
  buildExcelHeaderRows,
} from "../../../../utils/pdfUtils.js";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExecOutstandingReceivablesPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

  const [from, setFrom] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/executive-overview/reports/outstanding-receivables", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load receivables");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, [from, to, pollingCounter]);

  const filteredItems = items.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.party_name?.toLowerCase().includes(term) ||
      r.ref_no?.toLowerCase().includes(term)
    );
  });

  const totalOutstanding = filteredItems.reduce((acc, curr) => acc + Number(curr.outstanding || 0), 0);
  const totalInvoiced = filteredItems.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  async function exportExcel() {
    if (!filteredItems.length) return;
    const headerInfo = await fetchReportHeader(api);
    const headerRows = buildExcelHeaderRows(headerInfo, {
      title: "EXECUTIVE OUTSTANDING RECEIVABLES REPORT",
      period: `${from} to ${to}`,
    });

    const data = filteredItems.map((r) => ({
      "Due Date": r.due_date ? new Date(r.due_date).toLocaleDateString() : "—",
      Reference: r.ref_no || "—",
      Party: r.party_name || "—",
      Amount: Number(r.amount || 0),
      Outstanding: Number(r.outstanding || 0),
      Status: r.status || "—",
    }));
    const ws = XLSX.utils.json_to_sheet([...headerRows, ...data]);
    ws["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Outstanding Receivables");
    XLSX.writeFile(wb, `outstanding-receivables-${headerInfo.currCode}-${from}-to-${to}.xlsx`);
  }

  async function exportPDF() {
    if (!filteredItems.length) return;
    const headerInfo = await fetchReportHeader(api);
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 14;
    const pageW = 210;

    let y = applyPdfHeader(doc, headerInfo, {
      title: "OUTSTANDING RECEIVABLES REPORT",
      subtitle: `Period: ${from} to ${to}`,
      kpis: [
        { label: "TOTAL INVOICED", value: `${headerInfo.currPrefix}${fmt(totalInvoiced)}`, color: [59, 130, 246] },
        { label: "TOTAL OUTSTANDING", value: `${headerInfo.currPrefix}${fmt(totalOutstanding)}`, color: [239, 68, 68] },
      ],
    });

    // Table header
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, pageW - margin * 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("DUE DATE", margin + 2, y + 4.2);
    doc.text("REFERENCE", 45, y + 4.2);
    doc.text("PARTY / CUSTOMER", 80, y + 4.2);
    doc.text(`AMOUNT (${headerInfo.currCode})`, 145, y + 4.2, { align: "right" });
    doc.text(`OUTSTANDING (${headerInfo.currCode})`, pageW - margin - 2, y + 4.2, { align: "right" });
    y += 8.5;
    doc.setTextColor(51, 65, 85);

    filteredItems.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(r.due_date ? new Date(r.due_date).toLocaleDateString() : "—", margin + 2, y);
      doc.text(String(r.ref_no || "—").slice(0, 15), 45, y);
      doc.text(String(r.party_name || "—").slice(0, 26), 80, y);
      doc.text(fmt(r.amount), 145, y, { align: "right" });
      doc.text(fmt(r.outstanding), pageW - margin - 2, y, { align: "right" });
      y += 4.5;
    });

    applyPdfFooter(doc);
    doc.save(`outstanding-receivables-${headerInfo.currCode}-${from}-to-${to}.pdf`);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header Banner */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <CreditCard className="w-7 h-7" /> Outstanding Receivables Executive Summary
              </h1>
              <p className="text-sm mt-1 opacity-90">
                Customer accounts receivable tracking, due balances, and overdue invoices
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/executive-overview" className="btn btn-secondary text-xs">
                Return to Overview
              </Link>
              <button onClick={exportExcel} disabled={!filteredItems.length} className="btn btn-outline btn-sm text-white border-white/30 hover:bg-white/10 flex items-center gap-1.5 text-xs">
                <Download size={14} /> Excel
              </button>
              <button onClick={exportPDF} disabled={!filteredItems.length} className="btn btn-outline btn-sm text-white border-white/30 hover:bg-white/10 flex items-center gap-1.5 text-xs">
                <Download size={14} /> PDF
              </button>
              <button onClick={() => window.print()} className="btn btn-secondary text-xs flex items-center gap-1.5">
                <Printer size={14} /> Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 border-l-4 border-emerald-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Outstanding</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">₵{fmt(totalOutstanding)}</h3>
          </div>
          <CreditCard className="w-8 h-8 text-emerald-500 opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-rose-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Overdue</p>
            <h3 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">₵{fmt(totalOverdue)}</h3>
          </div>
          <AlertCircle className="w-8 h-8 text-rose-500 opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-blue-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Receivable Invoices</p>
            <h3 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{filteredItems.length}</h3>
          </div>
          <Calendar className="w-8 h-8 text-blue-500 opacity-80" />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Search Party or Ref No.</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search party name or ref number..."
                className="input w-full text-xs pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
          <div>
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">From Date</label>
            <input className="input w-full text-xs" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">To Date</label>
            <input className="input w-full text-xs" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button
            type="button"
            className="btn btn-secondary text-xs flex items-center justify-center gap-1 py-2 px-4 shrink-0"
            onClick={() => { setSearchTerm(""); setFrom(""); setTo(""); }}
          >
            <RefreshCw size={13} /> Reset
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="card">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Due Date</th>
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Reference</th>
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Customer / Party</th>
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300 text-right">Amount (₵)</th>
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300 text-right">Outstanding (₵)</th>
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading receivables data...</td></tr>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((r, i) => {
                    const isOverdue = String(r.status || "").toUpperCase() === "OVERDUE";
                    return (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 transition-colors">
                        <td className="py-3 px-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                          {r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-brand">{r.ref_no || "—"}</td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">{r.party_name || "—"}</td>
                        <td className="py-3 px-4 text-xs font-mono font-medium text-right text-slate-700 dark:text-slate-300">
                          ₵{fmt(r.amount)}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono font-bold text-right text-slate-900 dark:text-slate-100">
                          ₵{fmt(r.outstanding)}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isOverdue
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          }`}>
                            {r.status || "PENDING"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">No outstanding receivable records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
