/**
 * @fileoverview Production Efficiency Report component.
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

export default function EfficiencyReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/reports/efficiency", { 
        params: { start_date: from || undefined, end_date: to || undefined } 
      });
      setData(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      toast.error("Failed to load production efficiency report");
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
      (item.item_code && item.item_code.toLowerCase().includes(q)) ||
      (item.plan_no && item.plan_no.toLowerCase().includes(q))
    );
  }, [data, search]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "plan_date", "desc");

  function exportExcel() {
    if (!sortedItems.length) return;
    const ws = XLSX.utils.json_to_sheet(sortedItems);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "EfficiencyReport");
    XLSX.writeFile(wb, "production-efficiency.xlsx");
  }

  function exportPDF() {
    if (!sortedItems.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(14);
    doc.text("Production Efficiency Analysis", 10, 15);
    doc.setFontSize(8);
    let y = 25;
    sortedItems.forEach((r, idx) => {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.text(`${idx + 1}. Plan #${r.plan_no || 'PLAN'} | ${r.item_code || ''} - ${r.item_name || ''} | Planned: ${r.planned_qty} | Actual: ${r.actual_qty} | Eff: ${r.efficiency_pct}%`, 10, y);
      y += 6;
    });
    doc.save("production-efficiency.pdf");
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
            Production Efficiency Analysis
          </h1>
          <p className="text-sm mt-1 text-slate-500">Comparison of planned production targets vs actual shop floor output</p>
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
                placeholder="Search plan no, item code or name..."
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
                  <SortableHeader label="Plan No" sortKey="plan_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="plan_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Item Code" sortKey="item_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Item Name" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Planned Qty" sortKey="planned_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Actual Output" sortKey="actual_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Rejected Qty" sortKey="rejected_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">Efficiency %</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400 font-bold animate-pulse">
                      Loading production efficiency report...
                    </td>
                  </tr>
                ) : sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400 font-medium">
                      No production efficiency records found.
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((r, idx) => {
                    const eff = Number(r.efficiency_pct || 0);
                    return (
                      <tr key={idx}>
                        <td className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                          {r.plan_no || "PLAN"}
                        </td>
                        <td className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          {r.plan_date ? String(r.plan_date).split('T')[0] : 'Today'}
                        </td>
                        <td className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                          {r.item_code || "-"}
                        </td>
                        <td className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          {r.item_name}
                        </td>
                        <td className="text-right font-mono text-sm text-slate-700 dark:text-slate-300">
                          {Number(r.planned_qty || 0).toLocaleString()}
                        </td>
                        <td className="text-right font-mono font-bold text-sm text-brand-600 dark:text-brand-400">
                          {Number(r.actual_qty || 0).toLocaleString()}
                        </td>
                        <td className="text-right font-mono text-sm text-red-500">
                          {Number(r.rejected_qty || 0).toLocaleString()}
                        </td>
                        <td className="text-center font-mono font-bold text-xs">
                          {eff}%
                        </td>
                        <td className="text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${eff >= 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : eff >= 75 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                            {eff >= 100 ? "Target Achieved" : eff >= 75 ? "In Progress" : "Lagging"}
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
