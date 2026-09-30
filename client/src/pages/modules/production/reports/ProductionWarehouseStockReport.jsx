/**
 * @fileoverview ProductionWarehouseStockReport component.
 * Displays available stock quantities of items across all production warehouses.
 * Conforms strictly to standard OmniSuite General Ledger report UI design.
 */

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { Boxes } from "lucide-react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { formatPackagingBreakdown } from "@/utils/uomConversion.js";

export default function ProductionWarehouseStockReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [unitConversions, setUnitConversions] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stockRes, whRes, prodWhRes, convRes] = await Promise.allSettled([
        api.get("/production/reports/warehouse-stock", {
          params: {
            warehouse_id: selectedWarehouse || undefined,
            search: search || undefined,
            status: statusFilter !== "all" ? statusFilter : undefined,
            from: from || undefined,
            to: to || undefined,
          },
        }),
        api.get("/inventory/warehouses"),
        api.get("/production/setup/warehouses"),
        api.get("/inventory/unit-conversions"),
      ]);

      if (stockRes.status === "fulfilled") {
        setItems(Array.isArray(stockRes.value?.data?.items) ? stockRes.value.data.items : []);
      } else {
        toast.error("Failed to load warehouse stock report");
      }

      if (convRes.status === "fulfilled") {
        setUnitConversions(Array.isArray(convRes.value?.data?.items) ? convRes.value.data.items : []);
      }

      const invWh = whRes.status === "fulfilled" && Array.isArray(whRes.value?.data?.items) ? whRes.value.data.items : [];
      const prodWh = prodWhRes.status === "fulfilled" && Array.isArray(prodWhRes.value?.data?.items) ? prodWhRes.value.data.items : [];
      
      const combinedWh = [...prodWh];
      invWh.forEach(iw => {
        if (!combinedWh.some(w => String(w.id) === String(iw.id))) {
          combinedWh.push(iw);
        }
      });
      setWarehouses(combinedWh);
    } catch {
      toast.error("Failed to load production warehouse stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWarehouse, statusFilter, from, to]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(r => 
      (r.item_name && r.item_name.toLowerCase().includes(q)) ||
      (r.item_code && r.item_code.toLowerCase().includes(q)) ||
      (r.warehouse_name && r.warehouse_name.toLowerCase().includes(q))
    );
  }, [items, search]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "warehouse_name", "asc");

  function exportExcel() {
    if (!sortedItems.length) return;
    const ws = XLSX.utils.json_to_sheet(sortedItems);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "WarehouseStock");
    XLSX.writeFile(wb, "production-warehouse-stock.xlsx");
  }

  function exportPDF() {
    if (!sortedItems.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(14);
    doc.text("Production Warehouse Stock Availability", 10, 15);
    doc.setFontSize(8);
    let y = 25;
    sortedItems.forEach((r, idx) => {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.text(`${idx + 1}. ${r.warehouse_name || 'WH'} | ${r.item_code || ''} - ${r.item_name || ''} | Avail: ${r.available_qty || 0} ${r.uom || ''}`, 10, y);
      y += 6;
    });
    doc.save("production-warehouse-stock.pdf");
  }

  if (loading && !items.length) {
    return (
      <div className="p-20 text-center animate-pulse font-bold text-slate-400 text-sm">
        Loading warehouse stock availability report...
      </div>
    );
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
            Warehouse Stock Availability
          </h1>
          <p className="text-sm mt-1 text-slate-500">Real-time available quantities of raw materials and WIP across all production warehouses</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap items-end gap-4 sm:gap-6 mb-6">
            <div className="w-full sm:w-56 space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">Warehouse</label>
              <select
                className="input w-full"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                <option value="">All Warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.warehouse_name || wh.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-40 space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">Stock Status</label>
              <select
                className="input w-full"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="in_stock">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>

            <div className="w-full sm:w-40 space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">From Date</label>
              <input
                type="date"
                className="input w-full"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>

            <div className="w-full sm:w-40 space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">To Date</label>
              <input
                type="date"
                className="input w-full"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>

            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">Search</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Search item code or name..."
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
                  <SortableHeader label="Warehouse" sortKey="warehouse_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Item Code" sortKey="item_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Item Name" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">Packaging Breakdown</th>
                  <th className="text-center">Base UOM</th>
                  <SortableHeader label="Total Received" sortKey="total_received" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Total Utilized" sortKey="total_utilized" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Available Qty" sortKey="available_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400 font-bold animate-pulse">
                      Loading production warehouse stock...
                    </td>
                  </tr>
                ) : sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400 font-medium">
                      No production stock records found.
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((r, idx) => {
                    const isAvailable = Number(r.available_qty || 0) > 0;
                    const itConvs = unitConversions.filter((c) => String(c.item_id) === String(r.item_id));
                    const packInfo = formatPackagingBreakdown(r.available_qty, r.uom || "PCS", itConvs);
                    return (
                      <tr key={idx}>
                        <td className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                          {r.warehouse_name || "Production Store"}
                        </td>
                        <td className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                          {r.item_code || "-"}
                        </td>
                        <td className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          {r.item_name}
                        </td>
                        <td className="text-center text-xs font-medium">
                          {packInfo.breakdownText ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                              <Boxes size={13} />
                              {packInfo.breakdownText}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="text-center text-xs font-bold text-slate-500">
                          {r.uom || "PCS"}
                        </td>
                        <td className="text-right font-mono text-sm text-slate-700 dark:text-slate-300">
                          {Number(r.total_received || 0).toLocaleString()}
                        </td>
                        <td className="text-right font-mono text-sm text-slate-700 dark:text-slate-300">
                          {Number(r.total_utilized || 0).toLocaleString()}
                        </td>
                        <td className="text-right font-mono font-bold text-sm text-brand-600 dark:text-brand-400">
                          {Number(r.available_qty || 0).toLocaleString()}
                        </td>
                        <td className="text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${isAvailable ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                            {isAvailable ? "In Stock" : "Out of Stock"}
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
