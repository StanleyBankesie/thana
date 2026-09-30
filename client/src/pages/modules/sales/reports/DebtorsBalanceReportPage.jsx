/**
 * @fileoverview DebtorsBalanceReportPage component.
 * Provides functionality for DebtorsBalanceReportPage.
 */

import React, { useEffect, useMemo, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DebtorsBalanceReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [asOf, setAsOf] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const totals = useMemo(() => {
    const opening = items.reduce((s, r) => s + Number(r.opening || 0), 0);
    const invoiced = items.reduce((s, r) => s + Number(r.invoiced || 0), 0);
    const received = items.reduce((s, r) => s + Number(r.received || 0), 0);
    const outstanding = items.reduce(
      (s, r) => s + Number(r.outstanding || 0),
      0,
    );
    return { opening, invoiced, received, outstanding };
  }, [items]);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/sales/reports/debtors-balance", {
        params: { asOf: asOf || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const headers = [
      "Customer",
      "Opening",
      "Invoiced",
      "Received",
      "Outstanding",
    ];
    const rows = (Array.isArray(items) ? items : []).map((r) => [
      r.customer_name || "-",
      Number(r.opening || 0).toFixed(2),
      Number(r.invoiced || 0).toFixed(2),
      Number(r.received || 0).toFixed(2),
      Number(r.outstanding || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "debtors_balance.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const rows = (Array.isArray(items) ? items : []).map((r) => ({
      customer: r.customer_name || "-",
      opening: Number(r.opening || 0),
      invoiced: Number(r.invoiced || 0),
      received: Number(r.received || 0),
      outstanding: Number(r.outstanding || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DebtorsBalance");
    XLSX.writeFile(wb, "debtors-balance.xlsx");
  }

  function exportPDF() {
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Debtors Balance", 10, y);
    y += 8;
    doc.setFontSize(10);
    const headers = [
      "Customer",
      "Opening",
      "Invoiced",
      "Received",
      "Outstanding",
    ];
    doc.text(headers[0], 10, y);
    doc.text(headers[1], 80, y);
    doc.text(headers[2], 110, y);
    doc.text(headers[3], 140, y);
    doc.text(headers[4], 190, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    (Array.isArray(items) ? items : []).forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      const cust = String(r.customer_name || "-");
      const opening = Number(r.opening || 0).toFixed(2);
      const invoiced = Number(r.invoiced || 0).toFixed(2);
      const received = Number(r.received || 0).toFixed(2);
      const outstanding = Number(r.outstanding || 0).toFixed(2);
      doc.text(cust.slice(0, 60), 10, y);
      doc.text(opening, 80, y);
      doc.text(invoiced, 110, y);
      doc.text(received, 140, y);
      doc.text(outstanding, 190, y, { align: "right" });
      y += 5;
    });
    doc.save("debtors-balance.pdf");
  }
  useEffect(() => {
    run();
  }, [pollingCounter]);


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "date", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Debtors Balance
            </h1>
            <p className="text-sm mt-1">Customer balances as of a date</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            <button
              type="button"
              className="btn-success"
              onClick={exportCSV}
              disabled={loading || items.length === 0}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={exportExcel}
              disabled={loading || items.length === 0}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={exportPDF}
              disabled={loading || items.length === 0}
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="label">As of Date</label>
              <input
                className="input"
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <button
                type="button"
                className="btn-success"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run Report"}
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={() => {
                  setAsOf("");
                }}
                disabled={loading}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table w-full table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Opening" sortKey="opening" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Invoiced" sortKey="invoiced" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Received" sortKey="received" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Outstanding" sortKey="outstanding" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r, idx) => (
                  <tr key={r.id || idx}>
                    <td className="font-medium">{r.customer_name || "-"}</td>
                    <td className="text-right">
                      {Number(r.opening || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.invoiced || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.received || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.outstanding || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="text-right font-medium">Totals</td>
                  <td className="text-right font-medium">
                    {totals.opening.toLocaleString()}
                  </td>
                  <td className="text-right font-medium">
                    {totals.invoiced.toLocaleString()}
                  </td>
                  <td className="text-right font-medium">
                    {totals.received.toLocaleString()}
                  </td>
                  <td className="text-right font-medium">
                    {totals.outstanding.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {items.length === 0 && !loading ? (
            <div className="text-center py-10">No rows.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
