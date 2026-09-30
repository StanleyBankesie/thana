/**
 * @fileoverview Production StockJournalList component.
 * Lists manufacturing stock journals for raw material consumption and production outputs.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  BookText, 
  Plus, 
  Search, 
  RotateCcw, 
  Download, 
  Calendar, 
  ClipboardList, 
  ChevronRight, 
  ArrowLeft, 
  Factory, 
  Layers, 
  Warehouse,
  ArrowRight,
  ArrowUpRight, 
  ArrowDownLeft,
  Eye 
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import useSort from "@/hooks/useSort";
import SortableHeader from "@/components/SortableHeader";

export default function ProductionStockJournalList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const fetchJournals = async () => {
    try {
      setLoading(true);
      const res = await api.get("/production/inventory/stock-journal");
      setItems(res.data?.items || []);
    } catch {
      toast.error("Failed to load production journals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== "ALL" && item.journal_type !== typeFilter) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesNo = (item.journal_no || "").toLowerCase().includes(term);
        const matchesPlan = (item.plan_no || "").toLowerCase().includes(term);
        const matchesRemarks = (item.remarks || "").toLowerCase().includes(term);
        const matchesSrc = (item.source_warehouse_name || "").toLowerCase().includes(term);
        const matchesDst = (item.destination_warehouse_name || "").toLowerCase().includes(term);
        if (!matchesNo && !matchesPlan && !matchesRemarks && !matchesSrc && !matchesDst) return false;
      }
      return true;
    });
  }, [items, typeFilter, searchTerm]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "journal_date", "desc");

  const exportToCSV = () => {
    if (!sortedItems.length) return toast.info("No production journals to export");
    const headers = ["Journal No", "Type", "Associated Plan", "Posting Date", "Source Warehouse", "Destination Warehouse", "Remarks"];
    const rows = sortedItems.map((i) => [
      `"${i.journal_no || ""}"`,
      `"${i.journal_type || "MANUFACTURING"}"`,
      `"${i.plan_no || "Manual Shift Run"}"`,
      `"${i.journal_date ? new Date(i.journal_date).toISOString().split("T")[0] : ""}"`,
      `"${i.source_warehouse_name || "—"}"`,
      `"${i.destination_warehouse_name || "—"}"`,
      `"${i.remarks || ""}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Production_Stock_Journals_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getJournalTypeBadge = (type) => {
    switch (type) {
      case "TRANSFER":
        return <span className="px-2.5 py-1 text-xs font-bold rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">PRODUCTION FLOOR WAREHOUSE TRANSFER</span>;
      case "CONVERSION":
        return <span className="px-2.5 py-1 text-xs font-bold rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">SECONDARY CONVERSION</span>;
      case "ADJUSTMENT":
        return <span className="px-2.5 py-1 text-xs font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">VARIANCE ADJUSTMENT</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">MANUFACTURING RUN</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="card">
        <div className="card-header bg-brand-900 text-white dark:bg-brand-950 rounded-t-lg flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300 flex items-center gap-2">
              <Factory className="h-7 w-7 text-amber-400" />
              Production Stock Journals
            </h1>
            <p className="text-sm mt-1 text-slate-100">
              Manufacturing floor logs for raw material consumption (OUT) and finished goods production output (IN).
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link to="/production?section=Shop%20Floor%20%26%20Execution" className="font-sans btn btn-secondary text-sm">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn-success flex items-center gap-1.5 text-sm font-bold"
              onClick={fetchJournals}
              disabled={loading}
            >
              <RotateCcw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <Link to="/production/inventory/journal/new" className="btn-success flex items-center gap-1.5 text-sm font-bold">
              <Plus size={15} /> Create Production Journal
            </Link>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by journal no, plan no, remarks, warehouse..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full text-sm font-medium"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input text-sm font-semibold"
            >
              <option value="ALL">All Journal Types</option>
              <option value="MANUFACTURING">Manufacturing Run</option>
              <option value="TRANSFER">Production Floor Warehouse Transfer</option>
              <option value="CONVERSION">Secondary Conversion</option>
              <option value="ADJUSTMENT">Variance Adjustment</option>
            </select>

          </div>

          <div className="flex items-center gap-2">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="overflow-x-auto">
          <table className={"w-full text-left text-sm " + (viewMode === "grid" ? "table-grid-mode" : "")}>
            <thead className="bg-brand-900 text-white dark:bg-brand-950 font-bold uppercase tracking-wider border-b border-brand-800 text-xs">
              <tr>
                <SortableHeader label="Journal No" sortKey="journal_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-white font-extrabold" />
                <SortableHeader label="Type" sortKey="journal_type" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-white font-extrabold" />
                <SortableHeader label="Associated Daily Plan" sortKey="plan_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-white font-extrabold" />
                <SortableHeader label="Posting Date" sortKey="journal_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-white font-extrabold" />
                <th className="px-4 py-3.5 text-white font-extrabold">Warehouse Location</th>
                <th className="px-4 py-3.5 text-white font-extrabold">Remarks & Notes</th>
                <th className="px-4 py-3.5 text-center text-white font-extrabold">Status</th>
                <th className="px-4 py-3.5 text-right text-white font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest text-sm">
                    Loading production stock journals...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? (
                sortedItems.map((item) => (
                  <tr key={item.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    
                    {/* Journal No */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-brand-700 dark:text-brand-300 font-mono text-sm flex items-center gap-1.5">
                        <BookText size={15} className="text-brand-600 shrink-0" />
                        <span>{item.journal_no}</span>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getJournalTypeBadge(item.journal_type)}
                    </td>

                    {/* Associated Plan */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <ClipboardList size={14} className="text-brand-600" />
                        {item.plan_no ? (
                          <span className="text-slate-800 dark:text-slate-200 font-bold">{item.plan_no}</span>
                        ) : (
                          <span className="text-slate-400 italic">Manual Shift Run</span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 font-semibold text-sm">
                        <Calendar size={14} className="text-slate-400" />
                        <span>{item.journal_date ? new Date(item.journal_date).toLocaleDateString() : "—"}</span>
                      </div>
                    </td>

                    {/* Warehouses */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {item.journal_type === "TRANSFER" ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.source_warehouse_name || "Floor"}
                          </span>
                          <ArrowRight size={13} className="text-slate-400" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.destination_warehouse_name || "Floor"}
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Warehouse size={14} className="text-slate-400" />
                          <span>{item.source_warehouse_name || item.destination_warehouse_name || "Production Floor"}</span>
                        </div>
                      )}
                    </td>

                    {/* Remarks */}
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 text-sm max-w-xs truncate">
                      {item.remarks || "—"}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200">
                        ✓ {item.status || "POSTED"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link
                        to={`/production/inventory/journal/${item.id}?mode=view`}
                        className="btn btn-secondary text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Eye size={13} /> View
                      </Link>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center text-slate-400">
                    <BookText className="mx-auto h-12 w-12 opacity-30 mb-3" />
                    <p className="font-bold text-base text-slate-600 dark:text-slate-300">No production stock journals recorded</p>
                    <p className="text-sm text-slate-400 mt-1">Create a new production journal to log consumption and output.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
