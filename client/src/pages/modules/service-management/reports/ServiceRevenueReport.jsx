/**
 * @fileoverview ServiceRevenueReport component.
 * Provides functionality for ServiceRevenueReport.
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
export default function ServiceRevenueReport() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({
    total_service_bills: 0,
    total_revenue: 0,
    paid_amount: 0,
    outstanding_amount: 0,
    vat_collected: 0,
  });

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/service-management/reports/service-revenue", {
        params: {
          from: from || null,
          to: to || null,
          serviceType: serviceType || null,
          customer: customer || null,
        },
      });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
      setMetrics(res?.data?.metrics || metrics);
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
        bill_date: r.bill_date
          ? new Date(r.bill_date).toLocaleDateString()
          : "-",
        customer: r.customer_name,
        service_type: r.service_type,
        total_amount: Number(r.total_amount || 0),
        amount_paid: Number(r.amount_paid || 0),
        outstanding: Number(r.outstanding || 0),
        vat_collected: Number(r.vat_collected || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ServiceRevenue");
    XLSX.writeFile(wb, "service-revenue.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Service Revenue", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Bill No", 10, y);
    doc.text("Date", 40, y);
    doc.text("Customer", 70, y);
    doc.text("Service", 120, y);
    doc.text("Total", 160, y);
    doc.text("Paid", 180, y);
    doc.text("Outst.", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.bill_no || "-").slice(0, 20), 10, y);
      doc.text(
        r.bill_date ? new Date(r.bill_date).toLocaleDateString() : "-",
        40,
        y,
      );
      doc.text(String(r.customer_name || "-").slice(0, 40), 70, y);
      doc.text(String(r.service_type || "-").slice(0, 20), 120, y);
      doc.text(String(Number(r.total_amount || 0).toFixed(2)), 160, y);
      doc.text(String(Number(r.amount_paid || 0).toFixed(2)), 180, y);
      doc.text(String(Number(r.outstanding || 0).toFixed(2)), 200, y, {
        align: "right",
      });
      y += 5;
    });
    doc.save("service-revenue.pdf");
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
              Service Revenue
            </h1>
            <p className="text-sm mt-1">Financial performance tracking</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            
            <button
              className="btn-secondary"
              type="button"
              onClick={exportExcel}
              disabled={loading || items.length === 0}
            >
              Export Excel
            </button>
            <button
              className="btn-primary"
              type="button"
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="label">From</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Service Type</label>
              <input
                className="input"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder="Type..."
              />
            </div>
            <div>
              <label className="label">Customer</label>
              <input
                className="input"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Customer..."
              />
            </div>
            <div className="md:col-span-4 flex items-end gap-2">
              <button
                type="button"
                className="btn"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Total Service Bills</div>
              <div className="text-2xl font-bold">
                {metrics.total_service_bills || 0}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Total Revenue</div>
              <div className="text-2xl font-bold">
                {Number(metrics.total_revenue || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Paid Amount</div>
              <div className="text-2xl font-bold">
                {Number(metrics.paid_amount || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Outstanding Amount</div>
              <div className="text-2xl font-bold">
                {Number(metrics.outstanding_amount || 0).toLocaleString(
                  undefined,
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                )}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">VAT Collected</div>
              <div className="text-2xl font-bold">
                {Number(metrics.vat_collected || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.bill_no}</td>
                    <td>
                      {r.bill_date
                        ? new Date(r.bill_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{r.customer_name || "-"}</td>
                    <td>{r.service_type || "-"}</td>
                    <td className="text-right">
                      {Number(r.total_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {Number(r.amount_paid || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {Number(r.outstanding || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">
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
