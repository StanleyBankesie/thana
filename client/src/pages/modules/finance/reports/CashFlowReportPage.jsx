/**
 * @fileoverview CashFlowReportPage component.
 * Provides functionality for CashFlowReportPage.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import {
  fetchReportHeader,
  applyPdfHeader,
  applyPdfFooter,
  buildExcelHeaderRows,
} from "../../../../utils/pdfUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CashFlowReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState({ inflow: 0, outflow: 0, net: 0 });
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/cash-flow", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
      setTotals(res.data?.totals || { inflow: 0, outflow: 0, net: 0 });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load cash flow");
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

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(items, "bank_name", "asc");

  return (
    <div className="space-y-6 p-4">
      {/* Modern Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <button onClick={() => window.history.back()} className="font-sans text-xs font-bold text-brand uppercase tracking-wider hover:text-brand-600 transition-colors"
          >
            ← Back to Finance
          </button>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">
            Cash Flow
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Summary of cash movements in bank and cash accounts
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => window.print()}
          >
            🖨️ Print
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={async () => {
              const rows = Array.isArray(items) ? items : [];
              if (!rows.length) return;
              const headerInfo = await fetchReportHeader(api);
              const headerRows = buildExcelHeaderRows(headerInfo, {
                title: "STATEMENT OF CASH FLOWS",
                period: `${from || "Beginning"} to ${to || "Today"}`,
              });
              const ws = XLSX.utils.json_to_sheet([...headerRows, ...rows]);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "CashFlow");
              XLSX.writeFile(wb, `cash-flow-${headerInfo.currCode}-${from || "all"}-to-${to || "today"}.xlsx`);
            }}
            disabled={!items.length}
          >
            📊 Excel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm shadow-sm"
            onClick={async () => {
              const rows = Array.isArray(items) ? items : [];
              if (!rows.length) return;
              const headerInfo = await fetchReportHeader(api);
              const doc = new jsPDF("p", "mm", "a4");
              const margin = 14;
              const pageW = 210;

              let y = applyPdfHeader(doc, headerInfo, {
                title: "STATEMENT OF CASH FLOWS",
                subtitle: `Period: ${from || "Beginning"} to ${to || "Today"}`,
                kpis: [
                  { label: "TOTAL INFLOW", value: `${headerInfo.currPrefix}${fmt(totals.inflow)}`, color: [16, 185, 129] },
                  { label: "TOTAL OUTFLOW", value: `${headerInfo.currPrefix}${fmt(totals.outflow)}`, color: [239, 68, 68] },
                  { label: "NET CASH FLOW", value: `${headerInfo.currPrefix}${fmt(totals.net)}`, color: totals.net >= 0 ? [16, 185, 129] : [239, 68, 68] },
                ],
              });

              // Table header
              doc.setFillColor(30, 41, 59);
              doc.rect(margin, y, pageW - margin * 2, 6, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(255, 255, 255);
              doc.text("BANK / CASH ACCOUNT", margin + 2, y + 4.2);
              doc.text("ACCOUNT CODE", 80, y + 4.2);
              doc.text(`INFLOW (${headerInfo.currCode})`, 130, y + 4.2, { align: "right" });
              doc.text(`OUTFLOW (${headerInfo.currCode})`, 160, y + 4.2, { align: "right" });
              doc.text(`NET (${headerInfo.currCode})`, pageW - margin - 2, y + 4.2, { align: "right" });
              y += 8.5;
              doc.setTextColor(51, 65, 85);

              rows.forEach((r) => {
                if (y > 270) {
                  doc.addPage();
                  y = 15;
                }
                const bank = String(r.bank_name || "-").slice(0, 32);
                const acct = `${String(r.account_code || "-")} ${String(r.account_name || "").slice(0, 20)}`.trim();
                const inflow = Number(r.inflow || 0) > 0 ? fmt(r.inflow) : "—";
                const outflow = Number(r.outflow || 0) > 0 ? fmt(r.outflow) : "—";
                const net = fmt(r.net);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                doc.text(bank, margin + 2, y);
                doc.text(acct, 80, y);
                doc.text(inflow, 130, y, { align: "right" });
                doc.text(outflow, 160, y, { align: "right" });
                doc.text(net, pageW - margin - 2, y, { align: "right" });
                y += 4.5;
              });

              // Totals
              if (y > 260) {
                doc.addPage();
                y = 15;
              }
              y += 2;
              doc.setFillColor(241, 245, 249);
              doc.rect(margin, y, pageW - margin * 2, 7, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(15, 23, 42);
              doc.text("TOTAL CASH MOVEMENTS", margin + 2, y + 4.5);
              doc.text(`${headerInfo.currPrefix}${fmt(totals.inflow)}`, 130, y + 4.5, { align: "right" });
              doc.text(`${headerInfo.currPrefix}${fmt(totals.outflow)}`, 160, y + 4.5, { align: "right" });
              doc.text(`${headerInfo.currPrefix}${fmt(totals.net)}`, pageW - margin - 2, y + 4.5, { align: "right" });

              applyPdfFooter(doc);
              doc.save(`cash-flow-${headerInfo.currCode}-${from || "all"}-to-${to || "today"}.pdf`);
            }}
            disabled={!items.length}
          >
            📄 PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-emerald-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Inflow</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {Number(totals.inflow || 0).toLocaleString()}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-rose-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Outflow</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {Number(totals.outflow || 0).toLocaleString()}
          </h3>
        </div>
        <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-y border-r border-slate-200 dark:border-slate-700 ${totals.net >= 0 ? 'border-emerald-500' : 'border-rose-500'}`}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Cash Flow</p>
          <h3 className={`text-2xl font-black mt-1 ${totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {Number(totals.net || 0).toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Filter & Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">From:</span>
            <input
              className="input input-bordered input-sm focus:ring-brand focus:border-brand"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">To:</span>
            <input
              className="input input-bordered input-sm focus:ring-brand focus:border-brand"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm text-brand font-bold"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            disabled={loading}
          >
            Reset
          </button>
          <div className="flex-grow"></div>
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>

        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <SortableHeader label="Bank / Institution" sortKey="bank_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-xs font-bold uppercase tracking-wider text-slate-500" />
                  <SortableHeader label="Account Details" sortKey="account_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-xs font-bold uppercase tracking-wider text-slate-500" />
                  <SortableHeader label="Inflow" sortKey="inflow" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right text-xs font-bold uppercase tracking-wider text-emerald-600" />
                  <SortableHeader label="Outflow" sortKey="outflow" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right text-xs font-bold uppercase tracking-wider text-rose-600" />
                  <SortableHeader label="Net Flow" sortKey="net" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right text-xs font-bold uppercase tracking-wider text-slate-500" />
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((r, idx) => (
                  <tr key={`${r.bank_account_id}-${r.account_id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="font-bold text-slate-700 dark:text-slate-200 py-4">{r.bank_name}</td>
                    <td>
                      <div className="font-medium text-slate-900 dark:text-slate-100">{r.account_code}</div>
                      <div className="text-xs text-slate-500">{r.account_name}</div>
                    </td>
                    <td className="text-right font-mono font-bold text-emerald-600">
                      {Number(r.inflow || 0).toLocaleString()}
                    </td>
                    <td className="text-right font-mono font-bold text-rose-600">
                      {Number(r.outflow || 0).toLocaleString()}
                    </td>
                    <td className={`text-right font-mono font-black ${r.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {Number(r.net || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-900/40">
                <tr>
                  <td className="font-black text-slate-700 dark:text-slate-200">GRAND TOTALS</td>
                  <td />
                  <td className="text-right font-black text-emerald-700 dark:text-emerald-400 text-lg">
                    {Number(totals.inflow || 0).toLocaleString()}
                  </td>
                  <td className="text-right font-black text-rose-700 dark:text-rose-400 text-lg">
                    {Number(totals.outflow || 0).toLocaleString()}
                  </td>
                  <td className={`text-right font-black text-lg ${totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {Number(totals.net || 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {items.length === 0 && !loading && (
            <div className="text-center py-20 text-slate-400 italic">
              No cash flow entries found for the selected period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
