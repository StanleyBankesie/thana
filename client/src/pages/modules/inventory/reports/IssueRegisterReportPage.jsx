/**
 * @fileoverview IssueRegisterReportPage component.
 * Provides functionality for IssueRegisterReportPage.
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
export default function IssueRegisterReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const today = new Date().toISOString().slice(0, 10);
  const jan1 = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(jan1);
  const [to, setTo] = useState(today);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/inventory/reports/issue-register", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, [from, to, pollingCounter]);


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
            Issue Register
          </h1>
          <p className="text-sm mt-1">
            Items issued to departments or projects
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
            <div className="md:col-span-2 flex items-end gap-2">
              
              
              
              
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-fixed">
              <thead className="sticky top-0 z-10">
                <tr>
                  <SortableHeader label="Date" sortKey="date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Issue No" sortKey="issue_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Department" sortKey="department_id" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Item" sortKey="item" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Qty Issued" sortKey="qty_issued" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Returned" sortKey="returned" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Remaining" sortKey="remaining" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.issue_date
                        ? new Date(r.issue_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="font-medium">{r.issue_no || "-"}</td>
                    <td>{r.department_id || "-"}</td>
                    <td>{r.item_name || r.item_code}</td>
                    <td className="text-right">
                      {Number(r.qty_issued || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.returned_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.remaining_qty || 0).toLocaleString()}
                    </td>
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
