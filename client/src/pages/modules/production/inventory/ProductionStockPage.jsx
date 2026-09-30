/**
 * @fileoverview ProductionStockPage component.
 * Manufacturing stock overview highlighting Raw Materials, WIP, and Finished Goods
 * across production warehouses with material availability and transfer shortcuts.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  Factory, 
  Warehouse, 
  Search, 
  RotateCcw, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  History, 
  Boxes, 
  Calendar, 
  Truck, 
  ArrowRight,
  PackageCheck,
  FileSpreadsheet,
  Plus
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import useSort from "@/hooks/useSort";
import SortableHeader from "@/components/SortableHeader";

export default function ProductionStockPage() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouseTab, setSelectedWarehouseTab] = useState("ALL"); // ALL, RAW, WIP, FG, QA
  const [itemTypeFilter, setItemTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [warehouses, setWarehouses] = useState([]);

  const fetchProductionStock = async () => {
    try {
      setLoading(true);
      const [stockRes, whRes] = await Promise.all([
        api.get("/production/stock?module=production").catch(() => ({ data: { items: [] } })),
        api.get("/production/setup/warehouses").catch(() => ({ data: { items: [] } }))
      ]);

      const stockData = stockRes.data?.items || [];
      setItems(stockData);
      setWarehouses(whRes.data?.items || []);
    } catch {
      toast.error("Failed to load production stock balances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductionStock();
  }, []);

  // Compute production-specific statistics
  const stats = useMemo(() => {
    let rawQty = 0;
    let wipQty = 0;
    let fgQty = 0;
    let totalItems = new Set();

    items.forEach((item) => {
      const q = Number(item.qty || 0);
      const type = (item.item_type || "").toUpperCase();
      const whCode = (item.warehouse_code || "").toUpperCase();
      const whName = (item.warehouse_name || "").toUpperCase();

      totalItems.add(item.item_id);

      if (type.includes("RAW") || whCode.includes("RAW") || whName.includes("RAW")) {
        rawQty += q;
      } else if (type.includes("WIP") || whCode.includes("WIP") || whName.includes("WIP") || whName.includes("PROGRESS")) {
        wipQty += q;
      } else if (type.includes("FINISH") || whCode.includes("FG") || whName.includes("FINISHED")) {
        fgQty += q;
      }
    });

    return {
      total_items: totalItems.size,
      raw_qty: rawQty,
      wip_qty: wipQty,
      fg_qty: fgQty
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const whCode = (item.warehouse_code || "").toUpperCase();
      const whName = (item.warehouse_name || "").toUpperCase();
      const itemType = (item.item_type || "").toUpperCase();

      // Warehouse Stage Tab
      if (selectedWarehouseTab === "RAW") {
        if (!whCode.includes("RAW") && !whName.includes("RAW") && !itemType.includes("RAW")) return false;
      } else if (selectedWarehouseTab === "WIP") {
        if (!whCode.includes("WIP") && !whName.includes("WIP") && !whName.includes("PROGRESS") && !itemType.includes("WIP")) return false;
      } else if (selectedWarehouseTab === "FG") {
        if (!whCode.includes("FG") && !whName.includes("FINISHED") && !itemType.includes("FINISH")) return false;
      } else if (selectedWarehouseTab === "QA") {
        if (!whCode.includes("QA") && !whName.includes("QUARANTINE") && !whName.includes("TESTING")) return false;
      }

      // Item Type Dropdown
      if (itemTypeFilter !== "ALL" && item.item_type !== itemTypeFilter) {
        return false;
      }

      // Status Filter
      if (statusFilter !== "ALL" && item.health_status !== statusFilter) {
        return false;
      }

      // Search Term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesCode = (item.item_code || "").toLowerCase().includes(term);
        const matchesName = (item.item_name || "").toLowerCase().includes(term);
        const matchesBatch = (item.batch_no || "").toLowerCase().includes(term);
        const matchesWh = (item.warehouse_name || "").toLowerCase().includes(term);
        if (!matchesCode && !matchesName && !matchesBatch && !matchesWh) {
          return false;
        }
      }

      return true;
    });
  }, [items, selectedWarehouseTab, itemTypeFilter, statusFilter, searchTerm]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "updated_at", "desc");

  const exportToCSV = () => {
    if (!sortedItems.length) return toast.info("No production stock data to export");
    const headers = ["Item Code", "Item Name", "Item Type", "Production Warehouse", "Batch #", "On-Hand Qty", "Reserved Qty", "Available Qty", "UOM", "Status"];
    const rows = sortedItems.map(i => [
      `"${i.item_code || ""}"`,
      `"${(i.item_name || "").replace(/"/g, '""')}"`,
      `"${i.item_type || "PRODUCTION_ITEM"}"`,
      `"${i.warehouse_name || ""}"`,
      `"${i.batch_no || ""}"`,
      Number(i.qty || 0).toFixed(2),
      Number(i.reserved_qty || 0).toFixed(2),
      Number(i.available_qty || 0).toFixed(2),
      `"${i.uom || "PCS"}"`,
      `"${i.health_status || "ADEQUATE"}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Production_Stock_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="card">
        <div className="card-header bg-brand-900 text-white dark:bg-brand-950 rounded-t-lg flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300 flex items-center gap-2">
              <Factory className="h-7 w-7 text-amber-400" />
              Production Stock & Warehouse Balances
            </h1>
            <p className="text-sm mt-1 text-slate-100">
              Live floor stock monitoring across Raw Materials, WIP Staging, Quarantine, and Finished Goods Production Stores.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/production?section=Shop%20Floor%20%26%20Execution" className="font-sans btn btn-secondary text-sm">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn btn-secondary text-sm flex items-center gap-1.5"
              onClick={exportToCSV}
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              type="button"
              className="btn-success flex items-center gap-1.5 text-sm font-bold"
              onClick={fetchProductionStock}
              disabled={loading}
            >
              <RotateCcw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <Link to="/production/execution/fg-transfer/new" className="btn-success flex items-center gap-1.5 text-sm font-bold">
              <Truck size={15} /> Transfer FG to Inventory
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="card p-4 bg-white dark:bg-slate-800 border-l-4 border-l-brand-600 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Manufacturing SKUs</p>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {stats.total_items}
              </h3>
            </div>
            <div className="p-3 bg-brand-50 dark:bg-brand-950/60 rounded-xl text-brand-600">
              <Boxes size={22} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Active production materials & outputs</p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-800 border-l-4 border-l-blue-500 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Raw Material Store</p>
              <h3 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                {stats.raw_qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600">
              <Warehouse size={22} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Available for daily work orders</p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-800 border-l-4 border-l-amber-500 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Work-in-Progress (WIP)</p>
              <h3 className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                {stats.wip_qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-amber-600">
              <Layers size={22} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">In-process floor staging inventory</p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-800 border-l-4 border-l-emerald-500 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Finished Goods Stock</p>
              <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.fg_qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600">
              <PackageCheck size={22} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Ready for inventory transfer</p>
        </div>

      </div>

      {/* Production Warehouse Stage Tabs & Controls */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Stage Tabs */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex-wrap">
            <button
              onClick={() => setSelectedWarehouseTab("ALL")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedWarehouseTab === "ALL"
                  ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All Production Stock ({items.length})
            </button>
            <button
              onClick={() => setSelectedWarehouseTab("RAW")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedWarehouseTab === "RAW"
                  ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Raw Material Store
            </button>
            <button
              onClick={() => setSelectedWarehouseTab("WIP")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedWarehouseTab === "WIP"
                  ? "bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              WIP Staging Area
            </button>
            <button
              onClick={() => setSelectedWarehouseTab("FG")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedWarehouseTab === "FG"
                  ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Finished Goods Production WH
            </button>
            <button
              onClick={() => setSelectedWarehouseTab("QA")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedWarehouseTab === "QA"
                  ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Quarantine / QA Bay
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>

        {/* Filter Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search production items, codes, batches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full text-xs font-medium"
            />
          </div>

          <select
            value={itemTypeFilter}
            onChange={(e) => setItemTypeFilter(e.target.value)}
            className="input text-xs font-semibold"
          >
            <option value="ALL">All Item Material Types</option>
            <option value="RAW_MATERIAL">Raw Material</option>
            <option value="WIP">Work-In-Progress (WIP)</option>
            <option value="FINISHED_GOOD">Finished Good</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs font-semibold"
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="ADEQUATE">Adequate / In Stock</option>
            <option value="LOW_STOCK">⚠️ Low Stock Alert</option>
            <option value="OUT_OF_STOCK">⛔ Depleted (Zero Qty)</option>
          </select>
        </div>
      </div>

      {/* Production Stock Table */}
      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="overflow-x-auto">
          <table className={"w-full text-left text-xs " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="bg-brand-900 text-white dark:bg-brand-950 font-bold uppercase tracking-wider border-b border-brand-800">
              <tr>
                <SortableHeader label="Product / Material" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-white font-extrabold" />
                <SortableHeader label="Stage / Type" sortKey="item_type" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-white font-extrabold" />
                <SortableHeader label="Production Warehouse" sortKey="warehouse_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-white font-extrabold" />
                <SortableHeader label="Batch / Lot #" sortKey="batch_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-white font-extrabold" />
                <SortableHeader label="Floor On-Hand" sortKey="qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-right text-white font-extrabold" />
                <SortableHeader label="Available Qty" sortKey="available_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-right text-white font-extrabold" />
                <SortableHeader label="Stock Status" sortKey="health_status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-center text-white font-extrabold" />
                <th className="px-4 py-3 text-right text-white font-extrabold">Shortcuts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">
                    Syncing live production warehouse balances...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? (
                sortedItems.map((item) => {
                  const qtyVal = Number(item.qty || 0);
                  const availVal = Number(item.available_qty || 0);

                  return (
                    <tr key={item.balance_id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      
                      {/* Product Name & Code */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Factory size={14} className="text-brand-600 shrink-0" />
                          <span>{item.item_name}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {item.item_code || `ITM-${item.item_id}`}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {item.item_type ? item.item_type.replace(/_/g, ' ') : "MATERIAL"}
                        </span>
                      </td>

                      {/* Warehouse */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Warehouse size={13} className="text-slate-400 shrink-0" />
                          <span>{item.warehouse_name}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {item.warehouse_code}
                        </div>
                      </td>

                      {/* Batch */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                        {item.batch_no || "—"}
                      </td>

                      {/* On-Hand */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {qtyVal.toFixed(2)}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1 font-semibold">
                          {item.uom}
                        </span>
                      </td>

                      {/* Available */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {availVal.toFixed(2)}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1 font-semibold">
                          {item.uom}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {item.health_status === 'OUT_OF_STOCK' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200">
                            ⛔ Depleted
                          </span>
                        ) : item.health_status === 'LOW_STOCK' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200">
                            ⚠️ Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200">
                            ✓ Ready
                          </span>
                        )}
                      </td>

                      {/* Shortcuts */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.item_type === 'FINISHED_GOOD' ? (
                            <Link
                              to="/production/execution/fg-transfer/new"
                              className="btn-success text-xs px-2 py-1 flex items-center gap-1"
                              title="Transfer to Inventory Warehouse"
                            >
                              <Truck size={12} /> Transfer
                            </Link>
                          ) : (
                            <Link
                              to="/production/execution/material-requisition"
                              className="btn btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                              title="Requisition Material"
                            >
                              <ArrowRight size={12} /> Requisition
                            </Link>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center text-slate-400">
                    <Factory className="mx-auto h-12 w-12 opacity-30 mb-3" />
                    <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No production stock records found</p>
                    <p className="text-xs text-slate-400 mt-1">Try switching stage tabs or clearing your search filter.</p>
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
