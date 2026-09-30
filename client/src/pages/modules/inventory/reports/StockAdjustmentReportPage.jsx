/**
 * @fileoverview StockAdjustmentReportPage component.
 * Provides functionality for StockAdjustmentReportPage.
 */

import React, { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function StockAdjustmentReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [items, setItems] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadFilters() {
    try {
      const [whRes] = await Promise.all([api.get("/inventory/warehouses")]);
      setWarehouses(whRes.data?.items || []);
    } catch {}
  }

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/inventory/reports/stock-adjustments", {
        params: {
          from: from || null,
          to: to || null,
          warehouseId: warehouseId || null,
        },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFilters();
    run();
  }, [pollingCounter]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, warehouseId, pollingCounter]);


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "date", "desc");


  function exportExcel() {
    const rows = Array.isArray(items) ? items : (typeof sortedItems !== 'undefined' && Array.isArray(sortedItems) ? sortedItems : (typeof sorted_items !== 'undefined' && Array.isArray(sorted_items) ? sorted_items : []));
    if (!rows || !rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "inventory-report.xlsx");
  }

  function exportPDF() {
    const rows = Array.isArray(items) ? items : (typeof sortedItems !== 'undefined' && Array.isArray(sortedItems) ? sortedItems : (typeof sorted_items !== 'undefined' && Array.isArray(sorted_items) ? sorted_items : []));
    if (!rows || !rows.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(16);
    doc.text("Inventory Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 22);
    
    // Fallback simple PDF generation
    const headers = Object.keys(rows[0] || {}).slice(0, 8);
    const data = rows.map(r => headers.map(h => String(r[h] || "")));
    
    try {
      doc.autoTable({
        startY: 30,
        head: [headers],
        body: data,
        styles: { fontSize: 8 }
      });
    } catch (e) {
      doc.text("Data table (see Excel for full details)", 14, 30);
    }
    doc.save("inventory-report.pdf");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Inventory
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Stock Adjustment Report
          </h1>
          <p className="text-sm mt-1">
            Movements recorded via stock adjustments
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="btn btn-outline btn-sm border-brand text-brand hover:bg-brand hover:text-white flex items-center gap-1.5 text-xs">
            <Download size={14} /> Excel
          </button>
          <button onClick={exportPDF} className="btn btn-outline btn-sm border-brand text-brand hover:bg-brand hover:text-white flex items-center gap-1.5 text-xs">
            <Download size={14} /> PDF
          </button>
          
        </div>

      </div>

      <div className="card">
        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-3">{error}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div>
              <label className="label">From</label>
              <input
                type="date"
                className="input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                className="input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Warehouse</label>
              <select
                className="input"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">All</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex items-end gap-2">
              
              
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="Date" sortKey="date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Adjustment No" sortKey="adjustment_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Warehouse" sortKey="warehouse" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Item" sortKey="item" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Qty" sortKey="quantity" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="UOM" sortKey="uom" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Reason" sortKey="reason" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r, idx) => (
                  <tr key={`${r.adjustment_id}-${idx}`}>
                    <td>
                      {r.adjustment_date
                        ? new Date(r.adjustment_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="font-medium">{r.adjustment_no}</td>
                    <td>{r.warehouse_name || "-"}</td>
                    <td>{r.item_name || r.item_code || r.item_id}</td>
                    <td className="text-right">
                      {Number(r.qty || 0).toLocaleString()}
                    </td>
                    <td>{r.uom || "PCS"}</td>
                    <td>{r.status || "-"}</td>
                    <td>{r.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!items.length && !loading ? (
            <div className="text-center py-10">No rows.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
