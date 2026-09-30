/**
 * @fileoverview Material Usage Variance Report component.
 * Conforms strictly to standard OmniSuite General Ledger report UI design.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function MaterialVarianceReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/reports/variance", { 
        params: { start_date: from || undefined, end_date: to || undefined } 
      });
      setData(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      toast.error("Failed to load material usage variance report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [from, to]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(item => 
      (item.item_name && item.item_name.toLowerCase().includes(q)) || 
      (item.item_code && item.item_code.toLowerCase().includes(q))
    );
  }, [data, search]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "item_name", "asc");

  function exportExcel() {
    if (!sortedItems.length) return;
    const ws = XLSX.utils.json_to_sheet(sortedItems);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MaterialVariance");
    XLSX.writeFile(wb, "material-variance.xlsx");
  }

  function exportPDF() {
    if (!sortedItems.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(14);
    doc.text("Material Usage Variance Report", 10, 15);
    doc.setFontSize(8);
    let y = 25;
    sortedItems.forEach((r, idx) => {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.text(`${idx + 1}. ${r.item_code || ''} - ${r.item_name || ''} | Standard: ${r.std_qty} | Actual: ${r.actual_qty} | Var: ${r.variance_qty} (${r.status})`, 10, y);
      y += 6;
    });
    doc.save("material-variance.pdf");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => navigate("/production?section=Reports%20%26%20Costing")} 
            className="font-sans text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Reports & Costing
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Material Usage Variance Report
          </h1>
          <p className="text-sm mt-1 text-slate-500">Analyze gaps between standard BOM material issues vs actual shop floor utilization logs</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap items-end gap-6 mb-6">
            <div className="w-48">
              <label className="label">From Date</label>
              <input 
                type="date" 
                className="input w-full"
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
            </div>
            <div className="w-48">
              <label className="label">To Date</label>
              <input 
                type="date" 
                className="input w-full"
                value={to}
                onChange={e => setTo(e.target.value)}
              />
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="label">Search</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Search material code or item name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-3 shrink-0 ml-auto">
              <button
                type="button"
                className="btn-secondary px-4 whitespace-nowrap"
                onClick={exportExcel}
                disabled={!sortedItems.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary px-4 whitespace-nowrap"
                onClick={exportPDF}
                disabled={!sortedItems.length}
              >
                Export PDF
              </button>
              <button
                type="button"
                className="btn-primary px-4 whitespace-nowrap"
                onClick={() => window.print()}
              >
                Print
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <SortableHeader label="Item Code" sortKey="item_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Material Name" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">UOM</th>
                  <SortableHeader label="Standard Issued Qty" sortKey="std_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Actual Utilized Qty" sortKey="actual_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Variance Qty" sortKey="variance_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">Variance %</th>
                  <th className="text-center">Usage Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 font-bold animate-pulse">
                      Loading material usage variance report...
                    </td>
                  </tr>
                ) : sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 font-medium">
                      No material variance records found.
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((r, idx) => {
                    const varPct = Number(r.variance_pct || 0);
                    const isOver = r.status === "Over Consumption";
                    const isUnder = r.status === "Under Consumption";
                    return (
                      <tr key={idx}>
                        <td className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                          {r.item_code || "-"}
                        </td>
                        <td className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          {r.item_name}
                        </td>
                        <td className="text-center text-xs font-bold text-slate-500">
                          {r.uom || "PCS"}
                        </td>
                        <td className="text-right font-mono text-sm text-slate-700 dark:text-slate-300">
                          {Number(r.std_qty || 0).toLocaleString()}
                        </td>
                        <td className="text-right font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                          {Number(r.actual_qty || 0).toLocaleString()}
                        </td>
                        <td className={`text-right font-mono font-bold text-sm ${isOver ? 'text-red-500' : isUnder ? 'text-blue-500' : 'text-emerald-600'}`}>
                          {isOver ? `+${r.variance_qty}` : isUnder ? `-${r.variance_qty}` : "0"}
                        </td>
                        <td className="text-center font-mono font-bold text-xs">
                          {varPct > 0 ? `+${varPct}%` : `${varPct}%`}
                        </td>
                        <td className="text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${isOver ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : isUnder ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                            {r.status || "Exact Usage"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
