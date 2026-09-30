/**
 * @fileoverview MaterialReturnReportPage component.
 * Provides functionality for MaterialReturnReportPage.
 */

import React, { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { Link } from "react-router-dom";
import { api } from "api/client";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaterialReturnReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadFilters() {
    try {
      const [whRes, depRes] = await Promise.all([
        api.get("/inventory/warehouses"),
        api.get("/admin/departments"),
      ]);
      setWarehouses(whRes.data?.items || []);
      setDepartments(depRes.data?.items || []);
    } catch {}
  }

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/inventory/reports/material-returns", {
        params: {
          from: from || null,
          to: to || null,
          warehouseId: warehouseId || null,
          departmentId: departmentId || null,
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
  }, [from, to, warehouseId, departmentId, pollingCounter]);


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
            Material Return Report
          </h1>
          <p className="text-sm mt-1">Returns recorded in Return to Stores</p>
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
            <div>
              <label className="label">Department</label>
              <select
                className="input"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">All</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.dept_name || d.department_name}
                  </option>
                ))}
              </select>
            </div>
            </div>

          <div className="overflow-x-auto">
            <table className="table table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="RTS No" sortKey="rts_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Warehouse" sortKey="warehouse" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Department" sortKey="department" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Item" sortKey="item" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Qty" sortKey="quantity" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="UOM" sortKey="uom" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r, i) => (
                  <tr key={`${r.rts_id}-${i}`}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {r.rts_no}
                    </td>
                    <td>{r.rts_date ? String(r.rts_date).slice(0, 10) : "-"}</td>
                    <td>{r.warehouse_name || r.warehouse_id || "-"}</td>
                    <td>{r.department_name || r.department_id || "-"}</td>
                    <td>{r.item_name || r.item_code || r.item_id}</td>
                    <td className="text-right">
                      {Number(r.qty || 0).toLocaleString()}
                    </td>
                    <td>{r.uom || "PCS"}</td>
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
