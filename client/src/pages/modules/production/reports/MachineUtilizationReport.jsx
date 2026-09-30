/**
 * @fileoverview Machine Utilization Report component.
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

export default function MachineUtilizationReport() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/reports/machines");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      toast.error("Failed to load machine utilization report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(item => 
      (item.machine_name && item.machine_name.toLowerCase().includes(q)) || 
      (item.machine_code && item.machine_code.toLowerCase().includes(q))
    );
  }, [items, search]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "machine_name", "asc");

  function exportExcel() {
    if (!sortedItems.length) return;
    const ws = XLSX.utils.json_to_sheet(sortedItems);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MachineUtilization");
    XLSX.writeFile(wb, "machine-utilization.xlsx");
  }

  function exportPDF() {
    if (!sortedItems.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(14);
    doc.text("Machine Utilization Report", 10, 15);
    doc.setFontSize(8);
    let y = 25;
    sortedItems.forEach((r, idx) => {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.text(`${idx + 1}. ${r.machine_code || ''} - ${r.machine_name || ''} | Jobs: ${r.total_job_cards || 0} | Done: ${r.completed_job_cards || 0} | Util: ${r.utilization_pct || 0}%`, 10, y);
      y += 6;
    });
    doc.save("machine-utilization.pdf");
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
            Machine Utilization Report
          </h1>
          <p className="text-sm mt-1 text-slate-500">Monitor equipment throughput, active job cards, and capacity utilization across shop floor machinery</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap items-end gap-6 mb-6">
            <div className="flex-1 min-w-[250px]">
              <label className="label">Search</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Search machine code or equipment name..."
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
                  <SortableHeader label="Machine Code" sortKey="machine_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Machine Name" sortKey="machine_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Assigned Job Cards" sortKey="total_job_cards" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Completed Job Cards" sortKey="completed_job_cards" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Good Output Qty" sortKey="total_good_output" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">Utilization %</th>
                  <th className="text-center">Operating Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 font-bold animate-pulse">
                      Loading machine utilization report...
                    </td>
                  </tr>
                ) : sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 font-medium">
                      No equipment utilization records found.
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((r, idx) => {
                    const utilPct = Number(r.utilization_pct || 0);
                    const isOperating = r.is_active;
                    return (
                      <tr key={idx}>
                        <td className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                          {r.machine_code || "-"}
                        </td>
                        <td className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          {r.machine_name}
                        </td>
                        <td className="text-right font-mono text-sm text-slate-700 dark:text-slate-300">
                          {Number(r.total_job_cards || 0).toLocaleString()}
                        </td>
                        <td className="text-right font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {Number(r.completed_job_cards || 0).toLocaleString()}
                        </td>
                        <td className="text-right font-mono font-bold text-sm text-brand-600 dark:text-brand-400">
                          {Number(r.total_good_output || 0).toLocaleString()}
                        </td>
                        <td className="text-center font-mono font-bold text-xs">
                          {utilPct}%
                        </td>
                        <td className="text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${isOperating ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                            {isOperating ? "Operating / Active" : "Maintenance / Inactive"}
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
