/**
 * @fileoverview StockBalancesReportPage component.
 * Modernized report for real-time inventory stock balances across all warehouses.
 */

import React, { useEffect, useMemo, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { api } from "../../../../api/client.js";
import { Link } from "react-router-dom";
import { Package, Layers, ShieldAlert, CheckCircle2, Download, Printer, RefreshCw, Search, Boxes } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { formatPackagingBreakdown } from "@/utils/uomConversion.js";

export default function StockBalancesReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [unitConversions, setUnitConversions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [q, setQ] = useState("");
  const [itemOptions, setItemOptions] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/inventory/warehouses"),
      api.get("/inventory/stock-balances"),
      api.get("/inventory/items"),
      api.get("/inventory/unit-conversions").catch(() => ({ data: { items: [] } })),
    ])
      .then(([whRes, sbRes, itRes, ucRes]) => {
        if (!mounted) return;
        setWarehouses(Array.isArray(whRes?.data?.items) ? whRes.data.items : []);
        setItems(Array.isArray(sbRes?.data?.items) ? sbRes.data.items : []);
        setItemOptions(Array.isArray(itRes?.data?.items) ? itRes.data.items : []);
        setUnitConversions(Array.isArray(ucRes?.data?.items) ? ucRes.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load stock balances");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [pollingCounter]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (warehouseId && String(it.warehouse_id) !== String(warehouseId)) {
        return false;
      }
      if (q) {
        const query = q.toLowerCase();
        const code = String(it.item_code || "").toLowerCase();
        const name = String(it.item_name || "").toLowerCase();
        if (!code.includes(query) && !name.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [items, warehouseId, q]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filtered, {
    key: "item_code",
    dir: "asc",
  });

  const totalStockItems = filtered.length;
  const totalStockQty = filtered.reduce((acc, it) => acc + Number(it.total_qty || 0), 0);
  const totalReserveQty = filtered.reduce((acc, it) => acc + Number(it.reserve_qty || 0), 0);
  const totalAvailableQty = filtered.reduce((acc, it) => acc + Number(it.available_qty || 0), 0);

  async function exportExcel() {
    const headerInfo = await fetchReportHeader(api);
    const headerRows = buildExcelHeaderRows(headerInfo, {
      title: "STOCK BALANCES REPORT",
      period: `Generated: ${new Date().toLocaleDateString()}`,
    });

    const exportData = sortedItems.map((r) => ({
      "Item Code": r.item_code || "-",
      "Item Name": r.item_name || "-",
      Warehouse: r.warehouse_name || "All",
      "Total Qty": Number(r.total_qty || 0),
      "Reserved Qty": Number(r.reserve_qty || 0),
      "Available Qty": Number(r.available_qty || 0),
    }));
    const ws = XLSX.utils.json_to_sheet([...headerRows, ...exportData]);
    ws["!cols"] = [{ wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "StockBalances");
    XLSX.writeFile(wb, `stock-balances-${headerInfo.currCode}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportPDF() {
    const headerInfo = await fetchReportHeader(api);
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 14;
    const pageW = 210;

    let y = applyPdfHeader(doc, headerInfo, {
      title: "STOCK BALANCES REPORT",
      subtitle: `Warehouse: ${warehouseId ? warehouses.find(w => String(w.id) === String(warehouseId))?.name || warehouseId : "All Warehouses"}`,
      kpis: [
        { label: "TRACKED ITEMS", value: String(totalStockItems), color: [59, 130, 246] },
        { label: "TOTAL QUANTITY", value: Number(totalStockQty).toLocaleString(), color: [16, 185, 129] },
        { label: "TOTAL RESERVED", value: Number(totalReserveQty).toLocaleString(), color: [234, 88, 12] },
        { label: "NET AVAILABLE", value: Number(totalAvailableQty).toLocaleString(), color: [16, 185, 129] },
      ],
    });

    // Table header
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, pageW - margin * 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("ITEM CODE", margin + 2, y + 4.2);
    doc.text("ITEM NAME", 52, y + 4.2);
    doc.text("TOTAL QTY", 125, y + 4.2, { align: "right" });
    doc.text("RESERVE QTY", 155, y + 4.2, { align: "right" });
    doc.text("AVAILABLE QTY", pageW - margin - 2, y + 4.2, { align: "right" });
    y += 8.5;
    doc.setTextColor(51, 65, 85);

    sortedItems.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(String(r.item_code || "-"), margin + 2, y);
      doc.text(String(r.item_name || "-").slice(0, 32), 52, y);
      doc.text(Number(r.total_qty || 0).toLocaleString(), 125, y, { align: "right" });
      doc.text(Number(r.reserve_qty || 0).toLocaleString(), 155, y, { align: "right" });
      doc.text(Number(r.available_qty || 0).toLocaleString(), pageW - margin - 2, y, { align: "right" });
      y += 4.5;
    });

    applyPdfFooter(doc);
    doc.save(`stock-balances-${headerInfo.currCode}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header Banner */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-7 h-7" /> Stock Balances Report
              </h1>
              <p className="text-sm mt-1 opacity-90">
                Real-time inventory levels, reserved stock, and net available quantities across warehouses
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary text-xs">Back</button></div>
              <button onClick={exportExcel} disabled={!sortedItems.length} className="btn btn-outline btn-sm text-white border-white/30 hover:bg-white/10 flex items-center gap-1.5 text-xs">
                <Download size={14} /> Excel
              </button>
              <button onClick={exportPDF} disabled={!sortedItems.length} className="btn btn-outline btn-sm text-white border-white/30 hover:bg-white/10 flex items-center gap-1.5 text-xs">
                <Download size={14} /> PDF
              </button>
              
            </div>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-brand bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tracked Stock Items</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">{totalStockItems}</h3>
          </div>
          <Package className="w-8 h-8 text-brand opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-indigo-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Stock Qty</p>
            <h3 className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{totalStockQty.toLocaleString()}</h3>
          </div>
          <Layers className="w-8 h-8 text-indigo-500 opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-amber-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reserved Qty</p>
            <h3 className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{totalReserveQty.toLocaleString()}</h3>
          </div>
          <ShieldAlert className="w-8 h-8 text-amber-500 opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-emerald-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available Qty</p>
            <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{totalAvailableQty.toLocaleString()}</h3>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-80" />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Search Item (Code / Name)</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search item code or name..."
                className="input w-full text-xs pl-8"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                list="stock_bal_item_options"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
            <datalist id="stock_bal_item_options">
              {itemOptions.slice(0, 500).map((it) => (
                <option key={it.id} value={it.item_code}>
                  {it.item_name}
                </option>
              ))}
            </datalist>
          </div>

          <div className="w-full md:w-72">
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Warehouse Filter</label>
            <select
              className="input w-full text-xs"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.warehouse_name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary text-xs flex items-center justify-center gap-1 py-2 px-4 shrink-0"
            onClick={() => { setQ(""); setWarehouseId(""); }}
          >
            <RefreshCw size={13} /> Clear
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="card">
        <div className="card-body p-0">
          {error && <div className="p-4 text-rose-600 text-xs font-semibold">{error}</div>}
          <div className="overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <SortableHeader label="Item Code" sortKey="item_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Item Name" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-300">Packaging Breakdown (Boxes + Pcs)</th>
                  <SortableHeader label="Total Qty" sortKey="total_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Reserve Qty" sortKey="reserve_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Available Qty" sortKey="available_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="text-center py-8 text-slate-400">Loading stock balances...</td></tr>
                ) : sortedItems.length > 0 ? (
                  sortedItems.map((it) => {
                    const itConvs = unitConversions.filter((c) => String(c.item_id) === String(it.item_id));
                    const packInfo = formatPackagingBreakdown(it.available_qty, it.uom || "PCS", itConvs);
                    return (
                      <tr key={it.id || it.item_code} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs font-bold text-brand">{it.item_code}</td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">{it.item_name}</td>
                        <td className="py-3 px-4 text-xs font-medium">
                          {packInfo.breakdownText ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                              <Boxes size={13} />
                              {packInfo.breakdownText}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono font-bold text-right text-slate-900 dark:text-slate-100">
                          {Number(it.total_qty || 0).toLocaleString()} {it.uom || "PCS"}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono font-semibold text-right text-amber-600 dark:text-amber-400">
                          {Number(it.reserve_qty || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono font-bold text-right text-emerald-600 dark:text-emerald-400">
                          {Number(it.available_qty || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan="6" className="text-center py-10 text-slate-400">No stock balance records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
