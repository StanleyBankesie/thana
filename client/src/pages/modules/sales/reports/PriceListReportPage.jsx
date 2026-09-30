/**
 * @fileoverview PriceListReportPage component.
 * Provides functionality for PriceListReportPage.
 */

import React, { useEffect, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import { autosizeWorksheetColumns } from "../../../../utils/xlsxUtils.js";
import jsPDF from "jspdf";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PriceListReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState("");
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/price-list", {
        params: { product: product || null },
      });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, [product, pollingCounter]);

  function exportCSV() {
    if (!items.length) return;
    const headers = [
      "Product",
      "Standard Price",
      "Customer-Specific Price",
      "Effective Date",
      "Last Updated By",
    ];
    const rows = items.map((r) => [
      r.product || "-",
      Number(r.standard_price || 0).toFixed(2),
      r.customer_specific_price == null
        ? "-"
        : Number(r.customer_specific_price || 0).toFixed(2),
      r.effective_date || "-",
      r.last_updated_by || "-",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "price-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        product: r.product,
        standard_price: Number(r.standard_price || 0),
        customer_price:
          r.customer_specific_price == null
            ? null
            : Number(r.customer_specific_price || 0),
        effective_date: r.effective_date,
        last_updated_by: r.last_updated_by,
      })),
    );
    autosizeWorksheetColumns(ws);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PriceList");
    XLSX.writeFile(wb, "price-list.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Price List / Price Setup", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Product", 10, y);
    doc.text("Std Price", 120, y);
    doc.text("Cust Price", 160, y);
    doc.text("Eff Date", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.product || "-").slice(0, 90), 10, y);
      doc.text(String(Number(r.standard_price || 0).toFixed(2)), 120, y);
      doc.text(
        r.customer_specific_price == null
          ? "-"
          : String(Number(r.customer_specific_price || 0).toFixed(2)),
        160,
        y,
      );
      doc.text(String(r.effective_date || "-"), 200, y, { align: "right" });
      y += 5;
    });
    doc.save("price-list.pdf");
  }


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "date", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Price List / Price Setup
            </h1>
            <p className="text-sm mt-1">Monitor product pricing</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            <button
              className="btn-success"
              onClick={exportCSV}
              disabled={loading || items.length === 0}
            >
              Export CSV
            </button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="label">Product</label>
              <input className="input" type="text" placeholder="Search product..." value={product} onChange={(e) => setProduct(e.target.value)} />
            </div>
          </div>
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="table w-full table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="Product" sortKey="product" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Standard Price" sortKey="standard_price" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Customer-Specific Price" sortKey="customerspecific_price" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Effective Date" sortKey="effective_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Last Updated By" sortKey="last_updated_by" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.product}</td>
                    <td className="text-right">
                      {Number(r.standard_price || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {r.customer_specific_price == null
                        ? "-"
                        : Number(r.customer_specific_price || 0).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                    </td>
                    <td>{r.effective_date || "-"}</td>
                    <td>{r.last_updated_by || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
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
