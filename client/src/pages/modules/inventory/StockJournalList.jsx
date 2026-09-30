/**
 * @fileoverview Inventory StockJournalList component.
 * Lists inventory stock journal vouchers for stock transfers, repackaging,
 * item reclassifications, and balanced stock adjustments.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  BookText, 
  Plus, 
  Search, 
  RotateCcw, 
  Download, 
  Warehouse, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  Layers, 
  ChevronRight,
  Filter,
  ArrowRight,
  DollarSign
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import useSort from "@/hooks/useSort";
import SortableHeader from "@/components/SortableHeader";

export default function InventoryStockJournalList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [currencySymbol, setCurrencySymbol] = useState("$");

  const [warehouses, setWarehouses] = useState([]);

  const fetchJournals = async () => {
    try {
      setLoading(true);
      const [res, whRes] = await Promise.all([
        api.get("/inventory/stock-journal").catch(() => ({ data: { items: [] } })),
        api.get("/inventory/warehouses").catch(() => ({ data: { items: [] } }))
      ]);

      setItems(res.data?.items || []);
      setWarehouses(whRes.data?.items || []);
      if (res.data?.currency?.symbol) {
        setCurrencySymbol(res.data.currency.symbol);
      }
    } catch {
      toast.error("Failed to load inventory stock journals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  const stats = useMemo(() => {
    let totalIssues = 0;
    let totalReceipts = 0;
    let totalVal = 0;

    items.forEach((item) => {
      totalIssues += Number(item.total_issue_qty || 0);
      totalReceipts += Number(item.total_receipt_qty || 0);
      totalVal += Number(item.total_valuation || 0);
    });

    return {
      total_journals: items.length,
      total_issues: totalIssues,
      total_receipts: totalReceipts,
      total_valuation: totalVal
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== "ALL" && item.journal_type !== typeFilter) {
        return false;
      }
      if (warehouseFilter !== "ALL" && 
          String(item.source_warehouse_id) !== String(warehouseFilter) && 
          String(item.destination_warehouse_id) !== String(warehouseFilter)) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesNo = (item.journal_no || "").toLowerCase().includes(term);
        const matchesRemarks = (item.remarks || "").toLowerCase().includes(term);
        const matchesSrc = (item.source_warehouse_name || "").toLowerCase().includes(term);
        const matchesDst = (item.destination_warehouse_name || "").toLowerCase().includes(term);
        if (!matchesNo && !matchesRemarks && !matchesSrc && !matchesDst) return false;
      }
      return true;
    });
  }, [items, typeFilter, warehouseFilter, searchTerm]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "journal_date", "desc");

  const exportToCSV = () => {
    if (!sortedItems.length) return toast.info("No journal records to export");
    const headers = ["Journal No", "Type", "Posting Date", "Source Warehouse", "Destination Warehouse", "Items Count", "Issue Qty", "Receipt Qty", `Valuation (${currencySymbol})`, "Status"];
    const rows = sortedItems.map(i => [
      `"${i.journal_no || ""}"`,
      `"${i.journal_type || "GENERAL"}"`,
      `"${i.journal_date ? new Date(i.journal_date).toISOString().split('T')[0] : ""}"`,
      `"${i.source_warehouse_name || "—"}"`,
      `"${i.destination_warehouse_name || "—"}"`,
      i.item_count || 0,
      Number(i.total_issue_qty || 0).toFixed(2),
      Number(i.total_receipt_qty || 0).toFixed(2),
      Number(i.total_valuation || 0).toFixed(2),
      `"${i.status || "POSTED"}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventory_Stock_Journals_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getJournalTypeBadge = (type) => {
    switch (type) {
      case "TRANSFER":
        return <span className="px-2.5 py-1 text-xs font-bold rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">WAREHOUSE TRANSFER</span>;
      case "REPACKAGING":
        return <span className="px-2.5 py-1 text-xs font-bold rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">REPACKAGING / CONVERSION</span>;
      case "RECLASSIFICATION":
        return <span className="px-2.5 py-1 text-xs font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">RECLASSIFICATION</span>;
      case "ADJUSTMENT":
        return <span className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">ADJUSTMENT / CORRECTION</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">GENERAL JOURNAL</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="card">
        <div className="card-header bg-brand-900 text-white dark:bg-brand-950 rounded-t-lg flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300 flex items-center gap-2">
              <BookText className="h-7 w-7 text-amber-400" />
              Inventory Stock Journals
            </h1>
            <p className="text-sm mt-1 text-slate-100">
              Vouchers for inter-warehouse stock movements, repackaging conversions, and balanced stock issue/receipt transactions.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link to="/inventory?section=Stock%20Operations" className="font-sans btn btn-secondary text-sm">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn-success flex items-center gap-1.5 text-sm font-bold"
              onClick={fetchJournals}
              disabled={loading}
            >
              <RotateCcw size={15} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <Link to="/inventory/stock-journal/new" className="btn-success flex items-center gap-1.5 text-sm font-bold">
              <Plus size={16} /> New Stock Journal
            </Link>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by journal no, remarks, warehouse..."
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
              <option value="TRANSFER">Warehouse Transfer</option>
              <option value="REPACKAGING">Repackaging / Assembly</option>
              <option value="RECLASSIFICATION">Item Reclassification</option>
              <option value="ADJUSTMENT">Adjustment / Correction</option>
              <option value="GENERAL">General Movement</option>
            </select>

            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="input text-sm font-semibold"
            >
              <option value="ALL">All Storage Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.warehouse_name} ({wh.warehouse_code})
                </option>
              ))}
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
          <table className={"w-full text-left text-sm " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="bg-brand-900 text-white dark:bg-brand-950 font-bold uppercase tracking-wider border-b border-brand-800 text-xs">
              <tr>
                <SortableHeader label="Journal No" sortKey="journal_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-white font-extrabold" />
                <SortableHeader label="Journal Type" sortKey="journal_type" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-white font-extrabold" />
                <SortableHeader label="Posting Date" sortKey="journal_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-white font-extrabold" />
                <th className="px-4 py-3.5 text-white font-extrabold">Warehouses (Source &rarr; Dest)</th>
                <SortableHeader label="Issue Qty (Out)" sortKey="total_issue_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-right text-white font-extrabold" />
                <SortableHeader label="Receipt Qty (In)" sortKey="total_receipt_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-right text-white font-extrabold" />
                <SortableHeader label={`Valuation (${currencySymbol})`} sortKey="total_valuation" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-right text-white font-extrabold" />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-center text-white font-extrabold" />
                <th className="px-4 py-3.5 text-right text-white font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest text-sm">
                    Loading inventory stock journals...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? (
                sortedItems.map((item) => (
                  <tr key={item.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    
                    {/* Journal No */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-brand-700 dark:text-brand-300 font-mono text-sm flex items-center gap-1.5">
                        <BookText size={16} className="text-brand-600 shrink-0" />
                        <span>{item.journal_no}</span>
                      </div>
                      {item.remarks && (
                        <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                          {item.remarks}
                        </div>
                      )}
                    </td>

                    {/* Journal Type */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getJournalTypeBadge(item.journal_type)}
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
                            {item.source_warehouse_name || "Any / Floor"}
                          </span>
                          <ArrowRight size={13} className="text-slate-400" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.destination_warehouse_name || "Any / Floor"}
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Warehouse size={14} className="text-slate-400" />
                          <span>{item.source_warehouse_name || item.destination_warehouse_name || "General Floor"}</span>
                        </div>
                      )}
                    </td>

                    {/* Issue Qty */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                        {Number(item.total_issue_qty || 0).toFixed(2)}
                      </span>
                    </td>

                    {/* Receipt Qty */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {Number(item.total_receipt_qty || 0).toFixed(2)}
                      </span>
                    </td>

                    {/* Valuation */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {currencySymbol}{Number(item.total_valuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200">
                        ✓ POSTED
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link
                        to={`/inventory/stock-journal/${item.id}`}
                        className="btn btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5 ml-auto font-semibold"
                      >
                        <FileText size={14} className="text-brand-600" />
                        View Voucher
                      </Link>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-6 py-16 text-center text-slate-400">
                    <BookText className="mx-auto h-12 w-12 opacity-30 mb-3" />
                    <p className="font-bold text-base text-slate-600 dark:text-slate-300">No inventory stock journals recorded</p>
                    <p className="text-sm text-slate-400 mt-1">Create a new stock journal voucher to record movements or adjustments.</p>
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
