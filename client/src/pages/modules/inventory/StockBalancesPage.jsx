/**
 * @fileoverview StockBalancesPage component.
 * Comprehensive Stock Balances & Inventory Overview with multi-warehouse tracking,
 * valuation, batch traceability, and transaction ledger.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  Package, 
  Warehouse, 
  Search, 
  RotateCcw, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Boxes, 
  Layers, 
  History, 
  Filter, 
  Calendar, 
  DollarSign, 
  FileText,
  X,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  Truck
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import useSort from "@/hooks/useSort";
import SortableHeader from "@/components/SortableHeader";

export default function StockBalancesPage() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    total_items: 0,
    total_qty: 0,
    total_value: 0,
    low_stock_count: 0,
    out_of_stock_count: 0
  });
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [warehouseTypeTab, setWarehouseTypeTab] = useState("ALL"); // ALL, INVENTORY, PRODUCTION
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");

  // Metadata dropdowns
  const [warehouses, setWarehouses] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);

  // Ledger Modal State
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [selectedItemForLedger, setSelectedItemForLedger] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const fetchStockData = async () => {
    try {
      setLoading(true);
      const [stockRes, whSummaryRes, groupRes] = await Promise.all([
        api.get("/inventory/stock").catch(() => ({ data: { items: [], stats: {} } })),
        api.get("/inventory/stock/summary").catch(() => ({ data: { all: [] } })),
        api.get("/inventory/item-groups").catch(() => ({ data: { items: [] } }))
      ]);

      const stockItems = stockRes.data?.items || [];
      setItems(stockItems);
      if (stockRes.data?.stats) {
        setStats(stockRes.data.stats);
      }

      setWarehouses(whSummaryRes.data?.all || []);
      setItemGroups(groupRes.data?.items || []);
    } catch {
      toast.error("Failed to load inventory stock balances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  const openLedgerModal = async (item) => {
    setSelectedItemForLedger(item);
    setLedgerModalOpen(true);
    setLedgerLoading(true);
    try {
      const res = await api.get(`/inventory/stock/ledger/${item.item_id}`);
      setLedgerEntries(res.data?.items || []);
    } catch {
      toast.error("Failed to load transaction ledger");
      setLedgerEntries([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Warehouse Type Tab
      if (warehouseTypeTab !== "ALL" && item.warehouse_type !== warehouseTypeTab) {
        return false;
      }

      // Warehouse Specific Filter
      if (warehouseFilter !== "ALL" && String(item.warehouse_id) !== String(warehouseFilter)) {
        return false;
      }

      // Item Group Filter
      if (groupFilter !== "ALL" && item.group_name !== groupFilter) {
        return false;
      }

      // Stock Health Status
      if (statusFilter !== "ALL" && item.health_status !== statusFilter) {
        return false;
      }

      // Search term
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
  }, [items, warehouseTypeTab, warehouseFilter, groupFilter, statusFilter, searchTerm]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "updated_at", "desc");

  const exportToCSV = () => {
    if (!sortedItems.length) return toast.info("No stock data to export");
    const headers = ["Item Code", "Item Name", "Group", "Warehouse", "Warehouse Type", "Batch No", "Expiry Date", "Qty On-Hand", "Reserved Qty", "Available Qty", "UOM", "Cost Price", "Stock Value", "Status"];
    const rows = sortedItems.map(i => [
      `"${i.item_code || ""}"`,
      `"${(i.item_name || "").replace(/"/g, '""')}"`,
      `"${i.group_name || "General"}"`,
      `"${i.warehouse_name || ""}"`,
      `"${i.warehouse_type || ""}"`,
      `"${i.batch_no || ""}"`,
      `"${i.expiry_date ? new Date(i.expiry_date).toISOString().split('T')[0] : ""}"`,
      Number(i.qty || 0).toFixed(2),
      Number(i.reserved_qty || 0).toFixed(2),
      Number(i.available_qty || 0).toFixed(2),
      `"${i.uom || "PCS"}"`,
      Number(i.cost_price || 0).toFixed(2),
      Number(i.total_stock_value || 0).toFixed(2),
      `"${i.health_status || "ADEQUATE"}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Stock_Balances_${new Date().toISOString().split('T')[0]}.csv`);
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
              <Boxes className="h-7 w-7 text-amber-400" />
              Stock Balances & Overview
            </h1>
            <p className="text-sm mt-1 text-slate-100">
              Live inventory on-hand balances, valuation, batch tracking, and warehouse distribution across branches.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/inventory?section=Stock%20Operations" className="font-sans btn btn-secondary text-xs">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn btn-secondary text-xs flex items-center gap-1.5"
              onClick={exportToCSV}
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              type="button"
              className="btn-success flex items-center gap-1.5 text-xs font-bold"
              onClick={fetchStockData}
              disabled={loading}
            >
              <RotateCcw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <Link to="/inventory/stock-transfers/new" className="btn-success flex items-center gap-1.5 text-xs">
              <Truck size={15} /> Transfer Stock
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-slate-800 border-l-4 border-l-brand-600 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Stocked Items</p>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {stats.total_items.toLocaleString()}
              </h3>
            </div>
            <div className="p-3 bg-brand-50 dark:bg-brand-950/60 rounded-xl text-brand-600">
              <Package size={22} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Active catalog SKUs tracked</p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-800 border-l-4 border-l-emerald-500 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Quantity On-Hand</p>
              <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {Number(stats.total_qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600">
              <Layers size={22} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Across all warehouses</p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-800 border-l-4 border-l-blue-500 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Stock Valuation</p>
              <h3 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                ${Number(stats.total_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600">
              <DollarSign size={22} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Valued at standard cost price</p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-800 border-l-4 border-l-amber-500 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock Alerts</p>
              <h3 className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                {stats.low_stock_count}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-amber-600">
              <AlertTriangle size={22} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Items at or below reorder level</p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="card p-4 space-y-4">
        
        {/* Top Filter Row: Warehouse Tabs & Search */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Warehouse Type Tabs */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setWarehouseTypeTab("ALL")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                warehouseTypeTab === "ALL"
                  ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All Warehouses ({items.length})
            </button>
            <button
              onClick={() => setWarehouseTypeTab("INVENTORY")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                warehouseTypeTab === "INVENTORY"
                  ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Commercial Inventory
            </button>
            <button
              onClick={() => setWarehouseTypeTab("PRODUCTION")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                warehouseTypeTab === "PRODUCTION"
                  ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Production Staging
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>

        {/* Bottom Filter Row: Search, Warehouse Select, Group, Health Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by code, item name, batch #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full text-xs font-medium"
            />
          </div>

          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="input text-xs font-semibold"
          >
            <option value="ALL">All Storage Locations</option>
            {warehouses.map((wh) => (
              <option key={`${wh.warehouse_type}-${wh.id}`} value={wh.id}>
                {wh.warehouse_name} ({wh.warehouse_code || wh.code}) [{wh.warehouse_type}]
              </option>
            ))}
          </select>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="input text-xs font-semibold"
          >
            <option value="ALL">All Item Groups</option>
            {itemGroups.map((g) => (
              <option key={g.id} value={g.group_name}>
                {g.group_name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs font-semibold"
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="ADEQUATE">Adequate / In Stock</option>
            <option value="LOW_STOCK">⚠️ Low Stock (At Reorder)</option>
            <option value="OUT_OF_STOCK">⛔ Out of Stock (Depleted)</option>
          </select>
        </div>

      </div>

      {/* Main Stock Table */}
      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="overflow-x-auto">
          <table className={"w-full text-left text-xs " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="bg-brand-900 text-white dark:bg-brand-950 font-bold uppercase tracking-wider border-b border-brand-800">
              <tr>
                <SortableHeader label="Item Code & Name" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-white font-extrabold" />
                <SortableHeader label="Category / Group" sortKey="group_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-white font-extrabold" />
                <SortableHeader label="Warehouse / Location" sortKey="warehouse_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-white font-extrabold" />
                <SortableHeader label="Batch / Expiry" sortKey="batch_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-white font-extrabold" />
                <SortableHeader label="On-Hand Qty" sortKey="qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-right text-white font-extrabold" />
                <SortableHeader label="Available Qty" sortKey="available_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-right text-white font-extrabold" />
                <SortableHeader label="Valuation" sortKey="total_stock_value" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-right text-white font-extrabold" />
                <SortableHeader label="Status" sortKey="health_status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-center text-white font-extrabold" />
                <th className="px-4 py-3 text-right text-white font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">
                    Syncing live inventory stock balances...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? (
                sortedItems.map((item) => {
                  const qtyVal = Number(item.qty || 0);
                  const availVal = Number(item.available_qty || 0);
                  const costVal = Number(item.cost_price || 0);
                  const totalVal = Number(item.total_stock_value || (qtyVal * costVal));

                  return (
                    <tr key={item.balance_id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      
                      {/* Item Code & Name */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Package size={14} className="text-brand-600 shrink-0" />
                          <span>{item.item_name}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {item.item_code || `ITM-${item.item_id}`}
                        </div>
                      </td>

                      {/* Group / Category */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded">
                          {item.group_name || "General"}
                        </span>
                        {item.item_type && (
                          <div className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">
                            {item.item_type.replace(/_/g, ' ')}
                          </div>
                        )}
                      </td>

                      {/* Warehouse */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Warehouse size={13} className="text-slate-400" />
                          <span>{item.warehouse_name}</span>
                        </div>
                        <span className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                          item.warehouse_type === 'PRODUCTION'
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                            : "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        }`}>
                          {item.warehouse_type}
                        </span>
                      </td>

                      {/* Batch No & Expiry */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        <div className="font-mono text-xs font-semibold">
                          {item.batch_no || "—"}
                        </div>
                        {item.expiry_date && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={10} /> {new Date(item.expiry_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* On Hand Qty */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {qtyVal.toFixed(2)}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1 font-semibold">
                          {item.uom}
                        </span>
                      </td>

                      {/* Available Qty */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {availVal.toFixed(2)}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1 font-semibold">
                          {item.uom}
                        </span>
                      </td>

                      {/* Valuation */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          ${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          @ ${costVal.toFixed(2)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {item.health_status === 'OUT_OF_STOCK' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200">
                            ⛔ Out of Stock
                          </span>
                        ) : item.health_status === 'LOW_STOCK' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200">
                            ⚠️ Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200">
                            ✓ Adequate
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openLedgerModal(item)}
                          className="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 ml-auto font-semibold"
                          title="View Transaction Ledger History"
                        >
                          <History size={13} className="text-brand-600" />
                          Ledger
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="px-6 py-16 text-center text-slate-400">
                    <Boxes className="mx-auto h-12 w-12 opacity-30 mb-3" />
                    <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No stock balances match your filter</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting your search query or warehouse selection.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Transaction Ledger Modal */}
      {ledgerModalOpen && selectedItemForLedger && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 bg-brand-900 text-white dark:bg-brand-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="h-6 w-6 text-amber-400" />
                <div>
                  <h3 className="font-bold text-lg">Stock Movement Ledger</h3>
                  <p className="text-xs text-slate-200 mt-0.5">
                    {selectedItemForLedger.item_name} ({selectedItemForLedger.item_code})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLedgerModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 block">Warehouse</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItemForLedger.warehouse_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Current On-Hand</span>
                  <span className="font-bold text-emerald-600 font-mono text-sm">{Number(selectedItemForLedger.qty).toFixed(2)} {selectedItemForLedger.uom}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Standard Unit Cost</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">${Number(selectedItemForLedger.cost_price).toFixed(2)}</span>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900 font-bold uppercase text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Transaction Type</th>
                      <th className="px-3.5 py-2.5">Ref / Document</th>
                      <th className="px-3.5 py-2.5">Batch</th>
                      <th className="px-3.5 py-2.5 text-right">Qty Change</th>
                      <th className="px-3.5 py-2.5">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {ledgerLoading ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center text-slate-400 animate-pulse font-bold">
                          Loading transaction movements...
                        </td>
                      </tr>
                    ) : ledgerEntries.length > 0 ? (
                      ledgerEntries.map((log) => {
                        const changeNum = Number(log.qty_change || 0);
                        return (
                          <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="px-3.5 py-2.5 text-slate-500">
                              {log.transaction_date ? new Date(log.transaction_date).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {log.transaction_type}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                              {log.source_ref || "—"}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-slate-500">
                              {log.batch_no || "—"}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-bold">
                              <span className={changeNum > 0 ? "text-emerald-600" : changeNum < 0 ? "text-rose-600" : "text-slate-600"}>
                                {changeNum > 0 ? `+${changeNum.toFixed(2)}` : changeNum.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-500">
                              {log.created_by_name || "System"}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                          No transaction history ledger entries recorded for this item.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setLedgerModalOpen(false)}
                className="btn btn-secondary text-xs px-4 py-2"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
