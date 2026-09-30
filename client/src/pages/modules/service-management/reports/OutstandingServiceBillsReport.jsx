/**
 * @fileoverview OutstandingServiceBillsReport component.
 * Provides functionality for OutstandingServiceBillsReport.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function OutstandingServiceBillsReport() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(
        "/service-management/reports/outstanding-bills",
      );
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        bill_no: r.bill_no,
        service_order_no: r.service_order_no,
        customer: r.customer,
        bill_date: r.bill_date,
        due_date: r.due_date,
        total_amount: Number(r.total_amount || 0),
        paid_amount: Number(r.paid_amount || 0),
        balance: Number(r.balance || 0),
        aging: r.aging,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OutstandingServiceBills");
    XLSX.writeFile(wb, "outstanding-service-bills.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Outstanding Service Bills", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Bill No", 10, y);
    doc.text("Order", 40, y);
    doc.text("Customer", 70, y);
    doc.text("Bill", 120, y);
    doc.text("Due", 145, y);
    doc.text("Bal", 190, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.bill_no || "-").slice(0, 18), 10, y);
      doc.text(String(r.service_order_no || "-").slice(0, 18), 40, y);
      doc.text(String(r.customer || "-").slice(0, 36), 70, y);
      doc.text(String(r.bill_date || "-"), 120, y);
      doc.text(String(r.due_date || "-"), 145, y);
      doc.text(String(Number(r.balance || 0).toFixed(2)), 190, y, {
        align: "right",
      });
      y += 5;
    });
    doc.save("outstanding-service-bills.pdf");
  }

  useEffect(() => {
    run();
  }, [pollingCounter]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Outstanding Service Bills
            </h1>
            <p className="text-sm mt-1">Accounts receivable tracking</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            
            <button
              className="btn-secondary"
              onClick={exportExcel}
              disabled={loading || items.length === 0}
            >
              Export Excel
            </button>
            <button
              className="btn-primary"
              onClick={exportPDF}
              disabled={loading || items.length === 0}
            >
              Export PDF
            </button>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Service Order No</th>
                  <th>Customer</th>
                  <th>Bill Date</th>
                  <th>Due Date</th>
                  <th className="text-right">Total Amount</th>
                  <th className="text-right">Paid Amount</th>
                  <th className="text-right">Balance</th>
                  <th>Aging</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.bill_no}</td>
                    <td>{r.service_order_no || "-"}</td>
                    <td>{r.customer || "-"}</td>
                    <td>{r.bill_date || "-"}</td>
                    <td>{r.due_date || "-"}</td>
                    <td className="text-right">{r.total_amount || "-"}</td>
                    <td className="text-right">{r.paid_amount || "-"}</td>
                    <td className="text-right">{r.balance || "-"}</td>
                    <td>{r.aging || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-slate-500">
                      No records
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
