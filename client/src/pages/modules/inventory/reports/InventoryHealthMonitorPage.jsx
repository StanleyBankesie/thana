/**
 * @fileoverview InventoryHealthMonitorPage component.
 * Provides functionality for InventoryHealthMonitorPage.
 */

import React, { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
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
export default function InventoryHealthMonitorPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [warehouseId, setWarehouseId] = useState("");
  const [thresholdDays, setThresholdDays] = useState(30);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadWarehouses() {
    try {
      const res = await api.get("/inventory/warehouses");
      setWarehouses(res.data?.items || []);
    } catch {}
  }

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/inventory/reports/health-monitor", {
        params: {
          warehouseId: warehouseId || null,
          thresholdDays: thresholdDays || null,
        },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses();
    run();
  }, [warehouseId, thresholdDays, pollingCounter]);


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "id", "desc");


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
            Inventory Health Monitor
          </h1>
          <p className="text-sm mt-1">
            Coverage days, low stock, and reorder risks
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                    {w.name || w.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Threshold Days</label>
              <input
                className="input"
                type="number"
                min={1}
                value={thresholdDays}
                onChange={(e) => setThresholdDays(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              
              
              
              
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-fixed">
              <thead className="sticky top-0 z-10">
                <tr>
                  <SortableHeader label="Item" sortKey="item" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Available" sortKey="available" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Reorder Level" sortKey="reorder_level" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Days of Cover" sortKey="days_of_cover" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r) => (
                  <tr key={r.item_id}>
                    <td className="font-medium">
                      {r.item_name || r.item_code}
                    </td>
                    <td className="text-right">
                      {Number(r.available_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.reorder_level || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.days_of_cover || 0).toLocaleString()}
                    </td>
                    <td>{r.status || "-"}</td>
                  </tr>
                ))}
              </tbody>
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
