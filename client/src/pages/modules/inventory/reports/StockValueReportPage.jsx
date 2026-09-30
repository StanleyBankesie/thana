import React, { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { api } from "../../../../api/client.js";
import { Link } from "react-router-dom";

export default function StockValueReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [itemGroupId, setItemGroupId] = useState("");
  const [q, setQ] = useState("");
  const [itemOptions, setItemOptions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/inventory/warehouses"),
      api.get("/inventory/item-groups").catch(() => ({ data: { items: [] } })),
      api.get("/inventory/stock-value"),
      api.get("/inventory/items"),
    ])
      .then(([whRes, igRes, svRes, itRes]) => {
        if (!mounted) return;
        setWarehouses(
          Array.isArray(whRes?.data?.items) ? whRes.data.items : [],
        );
        setItemGroups(
          Array.isArray(igRes?.data?.items) ? igRes.data.items : [],
        );
        setItems(Array.isArray(svRes?.data?.items) ? svRes.data.items : []);
        setItemOptions(
          Array.isArray(itRes?.data?.items) ? itRes.data.items : [],
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load stock value report",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [pollingCounter]);

  useEffect(() => {
    let cancelled = false;
    async function fetchReport() {
      try {
        setLoading(true);
        const params = {};
        if (warehouseId) params.warehouseId = warehouseId;
        if (itemGroupId) params.itemGroupId = itemGroupId;
        if (q.trim()) params.q = q.trim();
        const res = await api.get("/inventory/stock-value", { params });
        if (!cancelled) {
          setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e?.response?.data?.message || "Failed to load stock value report",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchReport();
    return () => {
      cancelled = true;
    };
  }, [warehouseId, itemGroupId, q, pollingCounter]);

  const itemSelectOptions = React.useMemo(() => {
    if (!itemOptions) return [];
    return itemOptions.map((p) => ({
      value: String(p.id),
      label: `${p.item_code} - ${p.item_name}`,
      barcode: p.barcode,
      item_code: p.item_code,
      item_name: p.item_name,
    }));
  }, [itemOptions]);

  const itemSearchResults = React.useMemo(() => {
    if (!searchVal) return [];
    const lower = searchVal.toLowerCase();
    return itemSelectOptions.filter(
      (o) =>
        (o.barcode && o.barcode.toLowerCase() === lower) ||
        (o.item_code && o.item_code.toLowerCase().includes(lower)) ||
        (o.item_name && o.item_name.toLowerCase().includes(lower)),
    );
  }, [searchVal, itemSelectOptions]);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    return items.filter((r) => {
      if (!key) return true;
      return (
        String(r.item_code || "")
          .toLowerCase()
          .includes(key) ||
        String(r.item_name || "")
          .toLowerCase()
          .includes(key)
      );
    });
  }, [items, q]);

  const {
    sorted: sorted_filtered,
    sortKey,
    sortDir,
    toggle,
  } = useSort(filtered, "item_name", "asc");

  const totalReportValue = useMemo(() => {
    return sorted_filtered.reduce(
      (sum, item) => sum + (Number(item.value) || 0),
      0,
    );
  }, [sorted_filtered]);


  function exportExcel() {
    const rows = Array.isArray(items) ? items : (typeof sortedItems !== 'undefined' && Array.isArray(sortedItems) ? sortedItems : (typeof sorted_items !== 'undefined' && Array.isArray(sorted_items) ? sorted_items : []));
    if (!rows || !rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "inventory-report.xlsx");
  }

  function exportPDF() {
    const rows = Array.isArray(items) ? items : (typeof sortedItems !== 'undefined' && Array.isArray(sortedItems) ? sortedItems : (typeof sorted_items !== 'undefined' && Array.isArray(sorted_items) ? sorted_items : []));
    if (!rows || !rows.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(16);
    doc.text("Inventory Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 22);
    
    // Fallback simple PDF generation
    const headers = Object.keys(rows[0] || {}).slice(0, 8);
    const data = rows.map(r => headers.map(h => String(r[h] || "")));
    
    try {
      doc.autoTable({
        startY: 30,
        head: [headers],
        body: data,
        styles: { fontSize: 8 }
      });
    } catch (e) {
      doc.text("Data table (see Excel for full details)", 14, 30);
    }
    doc.save("inventory-report.pdf");
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Stock Value Report
              </h1>
              <p className="text-sm mt-1">
                Value of stock based on current quantities and cost price
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            </div>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <div className="relative w-full">
                <input
                  className="input pr-10 w-full"
                  type="text"
                  placeholder="Scan barcode or type..."
                  value={searchVal}
                  onChange={(e) => {
                    setSearchVal(e.target.value);
                    if (!e.target.value) setQ("");
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!searchVal) {
                        setQ("");
                      } else if (itemSearchResults.length) {
                        setQ(itemSearchResults[0].item_code);
                        setSearchVal(itemSearchResults[0].item_name);
                        setShowDropdown(false);
                      }
                    }
                  }}
                />
                <div className="absolute right-3 top-3 text-slate-400">
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
              {showDropdown && searchVal && itemSearchResults.length > 0 ? (
                <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                  {itemSearchResults.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-brand-50 dark:hover:bg-brand-900/20 border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                      onClick={() => {
                        setQ(o.item_code);
                        setSearchVal(o.item_name);
                        setShowDropdown(false);
                      }}
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {o.item_name}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <select
              className="input w-full md:w-64"
              value={itemGroupId}
              onChange={(e) => setItemGroupId(e.target.value)}
              title="Item Group"
            >
              <option value="">All Item Groups</option>
              {itemGroups.map((ig) => (
                <option key={ig.id} value={ig.id}>
                  {ig.group_name}
                </option>
              ))}
            </select>
            <select
              className="input w-full md:w-64"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              title="Warehouse"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.warehouse_name}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-fixed w-full">
              <thead>
                <tr>
                  <SortableHeader
                    label="Item Code"
                    sortKey="item_code"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="w-[14.3%] font-bold"
                  />
                  <SortableHeader
                    label="Item Name"
                    sortKey="item_name"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="w-[14.3%] font-bold"
                  />
                  <SortableHeader
                    label="Item Group"
                    sortKey="item_group"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="w-[14.3%] font-bold"
                  />
                  <SortableHeader
                    label="Quantity"
                    sortKey="qty"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="w-[14.3%] font-bold text-right"
                  />
                  <SortableHeader
                    label="UOM"
                    sortKey="uom"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="w-[14.3%] font-bold"
                  />
                  <SortableHeader
                    label="Cost Price"
                    sortKey="cost_price"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="w-[14.3%] font-bold text-right"
                  />
                  <SortableHeader
                    label="Total Value"
                    sortKey="value"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="w-[14.3%] font-bold text-right"
                  />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : null}
                {!loading && !filtered.length ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">
                      No records
                    </td>
                  </tr>
                ) : null}
                {sorted_filtered.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {r.item_code}
                    </td>
                    <td>{r.item_name}</td>
                    <td>{r.item_group || "-"}</td>
                    <td className="text-right">
                      {Number(r.qty || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>{r.uom || "-"}</td>
                    <td className="text-right">
                      {Number(r.cost_price || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right font-semibold">
                      {Number(r.value || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              {!loading && filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold">
                    <td colSpan="6" className="text-right py-3">
                      Total Value:
                    </td>
                    <td className="text-right text-brand-600 dark:text-brand-400 py-3">
                      {totalReportValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
