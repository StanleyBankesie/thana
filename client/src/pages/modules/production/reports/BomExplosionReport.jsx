/**
 * @fileoverview BOM Explosion Analysis Report component.
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

export default function BomExplosionReport() {
  const navigate = useNavigate();
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedBoms, setExpandedBoms] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/reports/bom-explosion");
      setBoms(Array.isArray(res.data?.boms) ? res.data.boms : []);
    } catch {
      toast.error("Failed to load BOM explosion analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleExpand = (id) => {
    setExpandedBoms(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredBoms = useMemo(() => {
    if (!search.trim()) return boms;
    const q = search.toLowerCase();
    return boms.filter(b => 
      (b.bom_name && b.bom_name.toLowerCase().includes(q)) || 
      (b.bom_no && b.bom_no.toLowerCase().includes(q)) ||
      (b.fg_item_name && b.fg_item_name.toLowerCase().includes(q))
    );
  }, [boms, search]);

  const { sorted: sortedBoms, sortKey, sortDir, toggle } = useSort(filteredBoms, "bom_name", "asc");

  function exportExcel() {
    if (!sortedBoms.length) return;
    const rows = [];
    sortedBoms.forEach(b => {
      if (b.components?.length) {
        b.components.forEach(c => {
          rows.push({
            "BOM No": b.bom_no,
            "BOM Name": b.bom_name,
            "Finished Good": b.fg_item_name,
            "Batch Size": b.batch_size,
            "Component Code": c.item_code,
            "Component Name": c.item_name,
            "Qty per Batch": c.quantity,
            "UOM": c.uom,
            "Unit Cost": c.unit_cost,
            "Extended Cost": c.extended_cost
          });
        });
      }
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOMExplosion");
    XLSX.writeFile(wb, "bom-explosion-analysis.xlsx");
  }

  function exportPDF() {
    if (!sortedBoms.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(14);
    doc.text("BOM Explosion Analysis Report", 10, 15);
    doc.setFontSize(8);
    let y = 25;
    sortedBoms.forEach((b, idx) => {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.text(`${idx + 1}. BOM #${b.bom_no || 'BOM'} | ${b.bom_name} | FG: ${b.fg_item_name || 'FG'} | Valuation: $${Number(b.total_valuation || 0).toFixed(2)}`, 10, y);
      y += 6;
    });
    doc.save("bom-explosion-analysis.pdf");
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
            BOM Explosion Analysis
          </h1>
          <p className="text-sm mt-1 text-slate-500">Multi-level component explosion, standard quantities, scrap allowances, and valuation per BOM</p>
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
                placeholder="Search BOM no, BOM name, or finished good..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-3 shrink-0 ml-auto">
              <button
                type="button"
                className="btn-secondary px-4 whitespace-nowrap"
                onClick={exportExcel}
                disabled={!sortedBoms.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary px-4 whitespace-nowrap"
                onClick={exportPDF}
                disabled={!sortedBoms.length}
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
                  <SortableHeader label="BOM No" sortKey="bom_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="BOM Name" sortKey="bom_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Finished Good" sortKey="fg_item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">Batch Size</th>
                  <th className="text-center">Components</th>
                  <th className="text-right">Total Valuation</th>
                  <th className="text-center w-px whitespace-nowrap">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 font-bold animate-pulse">
                      Loading BOM explosion analysis...
                    </td>
                  </tr>
                ) : sortedBoms.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 font-medium">
                      No Bill of Materials specifications found.
                    </td>
                  </tr>
                ) : (
                  sortedBoms.map((b) => {
                    const isExpanded = !!expandedBoms[b.id];
                    return (
                      <React.Fragment key={b.id}>
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          <td className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                            {b.bom_no || "BOM"}
                          </td>
                          <td className="font-medium text-sm text-slate-900 dark:text-slate-100">
                            {b.bom_name}
                          </td>
                          <td className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {b.fg_item_name || "Finished Good"}
                          </td>
                          <td className="text-center font-mono text-xs font-bold text-slate-600">
                            {b.batch_size || 1}
                          </td>
                          <td className="text-center font-mono font-bold text-xs">
                            {b.components_count || 0}
                          </td>
                          <td className="text-right font-mono font-bold text-sm text-brand-600 dark:text-brand-400">
                            ${Number(b.total_valuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-center w-px whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleExpand(b.id)}
                              className="btn btn-xs btn-secondary font-bold"
                            >
                              {isExpanded ? "Hide Components" : "View Breakdown"}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan="7" className="bg-slate-50/60 dark:bg-slate-800/40 p-4">
                              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Component Recipe Breakdown for {b.bom_name}</h4>
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-700/50 text-[11px] font-bold text-slate-500 uppercase">
                                      <th className="p-2">Code</th>
                                      <th className="p-2">Component Item</th>
                                      <th className="p-2 text-center">UOM</th>
                                      <th className="p-2 text-right">Qty per Batch</th>
                                      <th className="p-2 text-right">Scrap %</th>
                                      <th className="p-2 text-right">Unit Cost</th>
                                      <th className="p-2 text-right">Extended Cost</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-xs">
                                    {b.components?.length ? (
                                      b.components.map((c, idx) => (
                                        <tr key={idx}>
                                          <td className="p-2 font-mono text-slate-500">{c.item_code || '-'}</td>
                                          <td className="p-2 font-bold text-slate-800 dark:text-slate-200">{c.item_name}</td>
                                          <td className="p-2 text-center text-slate-500">{c.uom || 'PCS'}</td>
                                          <td className="p-2 text-right font-mono font-bold">{c.quantity}</td>
                                          <td className="p-2 text-right font-mono text-amber-600">{c.scrap_pct}%</td>
                                          <td className="p-2 text-right font-mono">${Number(c.unit_cost || 0).toFixed(2)}</td>
                                          <td className="p-2 text-right font-mono font-bold text-brand-600">${Number(c.extended_cost || 0).toFixed(2)}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr><td colSpan="7" className="p-3 text-center text-slate-400 italic">No components linked.</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
