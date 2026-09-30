/**
 * @fileoverview ProductionDetailReportPage component.
 * Provides detailed Production Report with Production Date, Unit, Machine, Shift, Process, Manufacturing Date, Item, Qty Planned, Qty Produced, Unit.
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

export default function ProductionDetailReportPage() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shifts, setShifts] = useState([]);
  const [machines, setMachines] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [selectedProcess, setSelectedProcess] = useState("");

  useEffect(() => {
    const fetchSetup = async () => {
      try {
        const [sRes, mRes, pRes] = await Promise.allSettled([
          api.get("/production/setup/shifts"),
          api.get("/production/setup/machines"),
          api.get("/production/setup/processes")
        ]);
        if (sRes.status === "fulfilled") setShifts(sRes.value?.data?.items || []);
        if (mRes.status === "fulfilled") setMachines(mRes.value?.data?.items || []);
        if (pRes.status === "fulfilled") setProcesses(pRes.value?.data?.items || []);
      } catch {
        // Fallback gracefully
      }
    };
    fetchSetup();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/reports/production-detail", {
        params: {
          start_date: from || undefined,
          end_date: to || undefined,
          shift_id: selectedShift || undefined,
          machine_id: selectedMachine || undefined,
          process_id: selectedProcess || undefined,
          search: search || undefined
        }
      });
      setData(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      toast.error("Failed to load production report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [from, to, selectedShift, selectedMachine, selectedProcess]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(item => 
      (item.item_name && item.item_name.toLowerCase().includes(q)) || 
      (item.item_code && item.item_code.toLowerCase().includes(q)) ||
      (item.machine_name && item.machine_name.toLowerCase().includes(q)) ||
      (item.process_name && item.process_name.toLowerCase().includes(q)) ||
      (item.production_unit && item.production_unit.toLowerCase().includes(q))
    );
  }, [data, search]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "production_date", "desc");

  const formatDate = (val) => {
    if (!val) return "—";
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return String(val).split("T")[0];
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  function exportExcel() {
    if (!sortedItems.length) return;
    const rows = sortedItems.map(r => ({
      "Production Date": formatDate(r.production_date),
      "Production Unit": r.production_unit || "Main Unit",
      "Machine Name": r.machine_name || "N/A",
      "Shift": r.shift_name || "General Shift",
      "Process": r.process_name || "Manufacturing",
      "Manufacturing Date": formatDate(r.manufacturing_date),
      "Item Code": r.item_code || "",
      "Item Name": r.item_name || "",
      "Qty Planned": r.planned_qty || 0,
      "Qty Produced": r.produced_qty || 0,
      "Unit": r.unit || "PCS"
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ProductionReport");
    XLSX.writeFile(wb, "production-report.xlsx");
  }

  function exportPDF() {
    if (!sortedItems.length) return;
    const doc = new jsPDF("l", "mm", "a4");
    doc.setFontSize(14);
    doc.text("Production Report", 10, 15);
    doc.setFontSize(8);
    let y = 25;
    sortedItems.forEach((r, idx) => {
      if (y > 180) { doc.addPage(); y = 15; }
      doc.text(`${idx + 1}. Date: ${formatDate(r.production_date)} | Unit: ${r.production_unit} | Machine: ${r.machine_name} | Shift: ${r.shift_name} | Process: ${r.process_name} | Item: ${r.item_name} | Planned: ${r.planned_qty} | Produced: ${r.produced_qty} ${r.unit}`, 10, y);
      y += 6;
    });
    doc.save("production-report.pdf");
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
            Production Report
          </h1>
          <p className="text-sm mt-1 text-slate-500">Comprehensive daily production run breakdown by unit, machine, shift, process, item, planned and produced quantities</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div className="w-40">
              <label className="label">From Date</label>
              <input 
                type="date" 
                className="input w-full"
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
            </div>

            <div className="w-40">
              <label className="label">To Date</label>
              <input 
                type="date" 
                className="input w-full"
                value={to}
                onChange={e => setTo(e.target.value)}
              />
            </div>

            <div className="w-40">
              <label className="label">Shift</label>
              <select
                className="input w-full"
                value={selectedShift}
                onChange={e => setSelectedShift(e.target.value)}
              >
                <option value="">All Shifts</option>
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>{s.shift_name}</option>
                ))}
              </select>
            </div>

            <div className="w-44">
              <label className="label">Machine</label>
              <select
                className="input w-full"
                value={selectedMachine}
                onChange={e => setSelectedMachine(e.target.value)}
              >
                <option value="">All Machines</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>{m.machine_name}</option>
                ))}
              </select>
            </div>

            <div className="w-44">
              <label className="label">Process</label>
              <select
                className="input w-full"
                value={selectedProcess}
                onChange={e => setSelectedProcess(e.target.value)}
              >
                <option value="">All Processes</option>
                {processes.map(p => (
                  <option key={p.id} value={p.id}>{p.process_name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="label">Search</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Search item, machine, process, unit..."
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
                  <SortableHeader label="Production Date" sortKey="production_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Production Unit" sortKey="production_unit" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Machine Name" sortKey="machine_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Shift" sortKey="shift_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Process" sortKey="process_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Manufacturing Date" sortKey="manufacturing_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Item" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Qty Planned" sortKey="planned_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Qty Produced" sortKey="produced_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loading ? (
                  <tr>
                    <td colSpan="10" className="py-12 text-center text-slate-400 font-bold animate-pulse">
                      Loading production report details...
                    </td>
                  </tr>
                ) : sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="py-12 text-center text-slate-400 font-medium">
                      No production report records found.
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((r, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(r.production_date)}
                      </td>
                      <td className="font-semibold text-sm text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {r.production_unit || "Main Unit"}
                      </td>
                      <td className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {r.machine_name || "N/A"}
                      </td>
                      <td className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {r.shift_name || "General Shift"}
                      </td>
                      <td className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {r.process_name || "Manufacturing"}
                      </td>
                      <td className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(r.manufacturing_date)}
                      </td>
                      <td className="font-medium text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-400 mr-2">{r.item_code}</span>
                        {r.item_name}
                      </td>
                      <td className="text-right font-mono text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {Number(r.planned_qty || 0).toLocaleString()}
                      </td>
                      <td className="text-right font-mono font-bold text-sm text-brand-600 dark:text-brand-400 whitespace-nowrap">
                        {Number(r.produced_qty || 0).toLocaleString()}
                      </td>
                      <td className="text-center font-bold text-xs text-slate-500 whitespace-nowrap">
                        {r.unit || "PCS"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
