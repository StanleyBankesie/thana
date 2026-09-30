/**
 * @fileoverview Inventory StockJournalForm component.
 * Dual-entry Inventory Stock Journal Voucher for recording Stock Issues (Outflow)
 * and Stock Receipts (Inflow) with dynamic warehouse routing, available stock tracking,
 * base currency from fin_currencies, and standard application typography.
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Loader2, 
  Calendar, 
  Layers, 
  ChevronDown, 
  ArrowUpRight, 
  ArrowDownLeft,
  Warehouse,
  BookText,
  DollarSign,
  Package,
  CheckCircle2,
  FileText
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import { usePermission } from "@/auth/PermissionContext.jsx";

export default function InventoryStockJournalForm() {
  const { id } = useParams();
  const isViewMode = Boolean(id);
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [itemsCatalog, setItemsCatalog] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [stockBalances, setStockBalances] = useState([]);
  const [currencySymbol, setCurrencySymbol] = useState("$");

  const [formData, setFormData] = useState({
    journal_no: "",
    journal_type: "GENERAL",
    journal_date: new Date().toISOString().split("T")[0],
    source_warehouse_id: "",
    destination_warehouse_id: "",
    remarks: "",
    items: []
  });

  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        setLoading(true);
        const [itemsRes, whRes, currRes, stockRes, nextNoRes] = await Promise.all([
          api.get("/inventory/items").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/warehouses").catch(() => ({ data: { items: [] } })),
          api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/stock").catch(() => ({ data: { items: [] } })),
          !isViewMode ? api.get("/inventory/stock-journal/next-no").catch(() => ({ data: { next_no: "" } })) : Promise.resolve({ data: {} })
        ]);

        setItemsCatalog(itemsRes.data?.items || []);
        setWarehouses(whRes.data?.items || []);
        setStockBalances(stockRes.data?.items || []);

        // Find active base currency from fin_currencies
        const currs = currRes.data?.items || currRes.data?.currencies || [];
        const baseCurr = currs.find((c) => c.is_base === 1 || c.is_base === true || c.is_base === "1");
        if (baseCurr?.symbol) {
          setCurrencySymbol(baseCurr.symbol);
        } else if (baseCurr?.code) {
          setCurrencySymbol(baseCurr.code);
        }

        if (isViewMode) {
          const detailRes = await api.get(`/inventory/stock-journal/${id}`);
          const j = detailRes.data?.journal;
          if (detailRes.data?.currency?.symbol) {
            setCurrencySymbol(detailRes.data.currency.symbol);
          }
          if (j) {
            setFormData({
              journal_no: j.journal_no,
              journal_type: j.journal_type || "GENERAL",
              journal_date: j.journal_date ? new Date(j.journal_date).toISOString().split("T")[0] : "",
              source_warehouse_id: j.source_warehouse_id || "",
              destination_warehouse_id: j.destination_warehouse_id || "",
              remarks: j.remarks || "",
              items: j.items || []
            });
          }
        } else {
          setFormData((prev) => ({
            ...prev,
            journal_no: nextNoRes.data?.next_no || ""
          }));
        }
      } catch {
        toast.error("Failed to load stock journal dependencies");
      } finally {
        setLoading(false);
      }
    };

    fetchDependencies();
  }, [id, isViewMode]);

  // Helper to compute available stock quantity for an item in a specific warehouse
  const getAvailableQty = (itemId, warehouseId) => {
    if (!itemId) return "—";
    if (warehouseId) {
      const match = stockBalances.find(
        (b) => String(b.item_id) === String(itemId) && String(b.warehouse_id) === String(warehouseId)
      );
      return match ? Number(match.available_qty !== undefined ? match.available_qty : (match.qty || 0)).toFixed(2) : "0.00";
    }
    const matches = stockBalances.filter((b) => String(b.item_id) === String(itemId));
    if (matches.length > 0) {
      const total = matches.reduce((acc, m) => acc + Number(m.available_qty !== undefined ? m.available_qty : (m.qty || 0)), 0);
      return total.toFixed(2);
    }
    return "0.00";
  };

  // Handle Journal Type change with warehouse synchronization
  const handleJournalTypeChange = (newType) => {
    let newSourceWh = formData.source_warehouse_id;
    let newDestWh = formData.destination_warehouse_id;

    if (newType !== "TRANSFER") {
      const unified = newSourceWh || newDestWh || "";
      newSourceWh = unified;
      newDestWh = unified;
    }

    const updatedItems = formData.items.map((item) => {
      const targetWh = item.entry_type === "ISSUE" ? newSourceWh : newDestWh;
      return { ...item, warehouse_id: targetWh || item.warehouse_id };
    });

    setFormData((prev) => ({
      ...prev,
      journal_type: newType,
      source_warehouse_id: newSourceWh,
      destination_warehouse_id: newDestWh,
      items: updatedItems
    }));
  };

  // Handle single Warehouse Location change (Non-transfer mode)
  const handleSingleWarehouseChange = (whId) => {
    const updatedItems = formData.items.map((item) => ({
      ...item,
      warehouse_id: whId
    }));

    setFormData((prev) => ({
      ...prev,
      source_warehouse_id: whId,
      destination_warehouse_id: whId,
      items: updatedItems
    }));
  };

  // Handle Source Warehouse change (Transfer mode)
  const handleSourceWarehouseChange = (whId) => {
    const updatedItems = formData.items.map((item) => {
      if (item.entry_type === "ISSUE") {
        return { ...item, warehouse_id: whId };
      }
      return item;
    });

    setFormData((prev) => ({
      ...prev,
      source_warehouse_id: whId,
      items: updatedItems
    }));
  };

  // Handle Destination Warehouse change (Transfer mode)
  const handleDestinationWarehouseChange = (whId) => {
    const updatedItems = formData.items.map((item) => {
      if (item.entry_type === "RECEIPT") {
        return { ...item, warehouse_id: whId };
      }
      return item;
    });

    setFormData((prev) => ({
      ...prev,
      destination_warehouse_id: whId,
      items: updatedItems
    }));
  };

  // Add Item with automatic warehouse pre-population
  const addItem = (entryType) => {
    let defaultWh = "";
    if (formData.journal_type === "TRANSFER") {
      defaultWh = entryType === "ISSUE" 
        ? formData.source_warehouse_id 
        : formData.destination_warehouse_id;
    } else {
      defaultWh = formData.source_warehouse_id || formData.destination_warehouse_id || "";
    }

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          entry_type: entryType,
          item_id: "",
          warehouse_id: defaultWh || "",
          qty: 1,
          uom: "PCS",
          batch_no: "",
          expiry_date: "",
          unit_cost: 0,
          total_cost: 0,
          remarks: ""
        }
      ]
    }));
  };

  const removeItem = (index) => {
    const updated = [...formData.items];
    updated.splice(index, 1);
    setFormData((prev) => ({ ...prev, items: updated }));
  };

  const updateItemField = (index, field, value) => {
    const updated = [...formData.items];
    updated[index][field] = value;

    if (field === "item_id") {
      const selected = itemsCatalog.find((i) => String(i.id) === String(value));
      if (selected) {
        updated[index].uom = selected.uom || selected.unit_name || "PCS";
        updated[index].unit_cost = Number(selected.cost_price || 0);
        updated[index].total_cost = Number(updated[index].qty || 0) * Number(selected.cost_price || 0);
      }
    }

    if (field === "qty" || field === "unit_cost") {
      const q = Number(updated[index].qty || 0);
      const c = Number(updated[index].unit_cost || 0);
      updated[index].total_cost = q * c;
    }

    setFormData((prev) => ({ ...prev, items: updated }));
  };

  const issuesList = useMemo(() => {
    return formData.items
      .map((item, idx) => ({ ...item, originalIndex: idx }))
      .filter((i) => i.entry_type === "ISSUE");
  }, [formData.items]);

  const receiptsList = useMemo(() => {
    return formData.items
      .map((item, idx) => ({ ...item, originalIndex: idx }))
      .filter((i) => i.entry_type === "RECEIPT");
  }, [formData.items]);

  const totalIssueQty = useMemo(() => {
    return issuesList.reduce((acc, cur) => acc + Number(cur.qty || 0), 0);
  }, [issuesList]);

  const totalReceiptQty = useMemo(() => {
    return receiptsList.reduce((acc, cur) => acc + Number(cur.qty || 0), 0);
  }, [receiptsList]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      return toast.error("Please add at least one Stock Issue or Stock Receipt line item.");
    }

    const missingItem = formData.items.some((i) => !i.item_id);
    if (missingItem) {
      return toast.error("Please select an item for every line in the journal.");
    }

    setSaving(true);
    try {
      const res = await api.post("/inventory/stock-journal", formData);
      toast.success(res.data?.message || "Stock journal voucher posted successfully!");
      navigate("/inventory/stock-journal");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to post stock journal");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-20 text-center animate-pulse font-bold text-slate-400 text-sm">
        Loading inventory stock journal voucher...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="card">
        <div className="card-header bg-brand-900 text-white dark:bg-brand-950 rounded-t-lg flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300 flex items-center gap-2">
              <BookText className="h-7 w-7 text-amber-400" />
              {isViewMode ? `Stock Journal Voucher: ${formData.journal_no}` : "New Inventory Stock Journal"}
            </h1>
            <p className="text-sm mt-1 text-slate-100">
              Balanced dual-entry stock voucher for location transfers, repackaging, and inventory reclassification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/inventory/stock-journal" className="font-sans btn btn-secondary text-sm">
              Return to Journal List
            </Link>
            {!isViewMode && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="btn-success flex items-center gap-1.5 text-sm font-bold"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Post Stock Journal
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Journal Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Voucher Meta Card (Journal Document No is hidden per user specification) */}
        <div className="card p-6 bg-white dark:bg-slate-800 space-y-4 shadow-xs">
          {/* Row 1: Purpose and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Journal Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Journal Purpose / Type
              </label>
              <select
                disabled={isViewMode}
                className="input font-semibold text-sm w-full"
                value={formData.journal_type}
                onChange={(e) => handleJournalTypeChange(e.target.value)}
              >
                <option value="GENERAL">General Stock Journal</option>
                <option value="TRANSFER">Warehouse Location Transfer</option>
                <option value="REPACKAGING">Repackaging / Conversion</option>
                <option value="RECLASSIFICATION">Item Reclassification</option>
                <option value="ADJUSTMENT">Stock Adjustment / Balance Correction</option>
              </select>
            </div>

            {/* Posting Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar size={15} className="text-brand-600" /> Posting Date
              </label>
              <input
                type="date"
                required
                disabled={isViewMode && !hasExceptional("DOCUMENT.EDIT_DATE")}
                className="input font-semibold text-sm w-full"
                value={formData.journal_date}
                onChange={(e) => setFormData({ ...formData, journal_date: e.target.value })}
              />
            </div>

          </div>

          {/* Row 2: Warehouse Location Selection (Side by side when Transfer) */}
          {formData.journal_type === "TRANSFER" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              
              {/* Source Warehouse */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Warehouse size={15} className="text-rose-600" /> Source Warehouse (Outflow)
                </label>
                <select
                  disabled={isViewMode}
                  className="input font-semibold text-sm w-full"
                  value={formData.source_warehouse_id}
                  onChange={(e) => handleSourceWarehouseChange(e.target.value)}
                >
                  <option value="">Select Source Warehouse...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                  ))}
                </select>
              </div>

              {/* Destination Warehouse */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Warehouse size={15} className="text-emerald-600" /> Destination Warehouse (Inflow)
                </label>
                <select
                  disabled={isViewMode}
                  className="input font-semibold text-sm w-full"
                  value={formData.destination_warehouse_id}
                  onChange={(e) => handleDestinationWarehouseChange(e.target.value)}
                >
                  <option value="">Select Destination Warehouse...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                  ))}
                </select>
              </div>

            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Warehouse size={15} className="text-brand-600" /> Warehouse Location
                </label>
                <select
                  disabled={isViewMode}
                  className="input font-semibold text-sm w-full"
                  value={formData.source_warehouse_id || formData.destination_warehouse_id || ""}
                  onChange={(e) => handleSingleWarehouseChange(e.target.value)}
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Section 1: Stock Issue / Outflow (Source Reduction) */}
        <div className="card p-6 bg-white dark:bg-slate-800 space-y-4 border-l-4 border-l-rose-500 shadow-xs">
          <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowUpRight className="text-rose-600 h-5 w-5" />
                Stock Issue / Outflow (Source Reduction)
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Items and quantities being deducted, transferred out, or consumed for conversion.
              </p>
            </div>
            {!isViewMode && (
              <button
                type="button"
                onClick={() => addItem("ISSUE")}
                className="btn btn-secondary text-sm flex items-center gap-1.5 font-bold text-rose-700 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Plus size={15} /> Add Stock Issue (Outflow)
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold uppercase text-slate-600 dark:text-slate-300 text-xs">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Issue Warehouse</th>
                  <th className="px-4 py-3">Batch #</th>
                  <th className="px-4 py-3 text-right">Available Qty</th>
                  <th className="px-4 py-3 text-right">Quantity to Issue</th>
                  <th className="px-4 py-3">UOM</th>
                  {!isViewMode && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {issuesList.length > 0 ? (
                  issuesList.map((item) => {
                    const avail = getAvailableQty(item.item_id, item.warehouse_id);
                    return (
                      <tr key={item.originalIndex} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        
                        {/* Item Select */}
                        <td className="px-4 py-3 min-w-[240px]">
                          <select
                            required
                            disabled={isViewMode}
                            className="input text-sm font-semibold w-full"
                            value={item.item_id}
                            onChange={(e) => updateItemField(item.originalIndex, "item_id", e.target.value)}
                          >
                            <option value="">Select Item to Issue...</option>
                            {itemsCatalog.map((i) => (
                              <option key={i.id} value={i.id}>{i.item_code} - {i.item_name}</option>
                            ))}
                          </select>
                        </td>

                        {/* Warehouse (Auto-populated) */}
                        <td className="px-4 py-3 min-w-[190px]">
                          <select
                            disabled={isViewMode}
                            className="input text-sm w-full"
                            value={item.warehouse_id}
                            onChange={(e) => updateItemField(item.originalIndex, "warehouse_id", e.target.value)}
                          >
                            <option value="">Select Warehouse...</option>
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                            ))}
                          </select>
                        </td>

                        {/* Batch # */}
                        <td className="px-4 py-3 min-w-[130px]">
                          <input
                            type="text"
                            disabled={isViewMode}
                            className="input text-sm font-mono w-full"
                            placeholder="Batch (optional)"
                            value={item.batch_no || ""}
                            onChange={(e) => updateItemField(item.originalIndex, "batch_no", e.target.value)}
                          />
                        </td>

                        {/* Available Qty */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`font-mono font-bold text-sm ${Number(avail) > 0 ? "text-brand-700 dark:text-brand-300" : "text-amber-600"}`}>
                            {avail}
                          </span>
                        </td>

                        {/* Qty to Issue */}
                        <td className="px-4 py-3 text-right min-w-[110px]">
                          <input
                            type="number"
                            step="0.001"
                            required
                            disabled={isViewMode}
                            className="input text-sm font-mono font-bold text-right w-full text-rose-600"
                            value={item.qty}
                            onChange={(e) => updateItemField(item.originalIndex, "qty", e.target.value)}
                          />
                        </td>

                        {/* UOM */}
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-500">
                          {item.uom}
                        </td>

                        {/* Action */}
                        {!isViewMode && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(item.originalIndex)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        )}

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isViewMode ? 6 : 7} className="px-4 py-8 text-center text-slate-400">
                      No stock issue items added. Click "+ Add Stock Issue (Outflow)" to deduct items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Stock Receipt / Inflow (Destination Addition) */}
        <div className="card p-6 bg-white dark:bg-slate-800 space-y-4 border-l-4 border-l-emerald-500 shadow-xs">
          <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowDownLeft className="text-emerald-600 h-5 w-5" />
                Stock Receipt / Inflow (Destination Addition)
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Items and quantities being credited, transferred in, or repackaged into inventory.
              </p>
            </div>
            {!isViewMode && (
              <button
                type="button"
                onClick={() => addItem("RECEIPT")}
                className="btn btn-secondary text-sm flex items-center gap-1.5 font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <Plus size={15} /> Add Stock Receipt (Inflow)
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold uppercase text-slate-600 dark:text-slate-300 text-xs">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Receipt Warehouse</th>
                  <th className="px-4 py-3">Batch #</th>
                  <th className="px-4 py-3 text-right">Available Qty</th>
                  <th className="px-4 py-3 text-right">Quantity to Receive</th>
                  <th className="px-4 py-3">UOM</th>
                  {!isViewMode && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {receiptsList.length > 0 ? (
                  receiptsList.map((item) => {
                    const avail = getAvailableQty(item.item_id, item.warehouse_id);
                    return (
                      <tr key={item.originalIndex} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        
                        {/* Item Select */}
                        <td className="px-4 py-3 min-w-[240px]">
                          <select
                            required
                            disabled={isViewMode}
                            className="input text-sm font-semibold w-full"
                            value={item.item_id}
                            onChange={(e) => updateItemField(item.originalIndex, "item_id", e.target.value)}
                          >
                            <option value="">Select Item to Receive...</option>
                            {itemsCatalog.map((i) => (
                              <option key={i.id} value={i.id}>{i.item_code} - {i.item_name}</option>
                            ))}
                          </select>
                        </td>

                        {/* Warehouse (Auto-populated) */}
                        <td className="px-4 py-3 min-w-[190px]">
                          <select
                            disabled={isViewMode}
                            className="input text-sm w-full"
                            value={item.warehouse_id}
                            onChange={(e) => updateItemField(item.originalIndex, "warehouse_id", e.target.value)}
                          >
                            <option value="">Select Warehouse...</option>
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                            ))}
                          </select>
                        </td>

                        {/* Batch # */}
                        <td className="px-4 py-3 min-w-[130px]">
                          <input
                            type="text"
                            disabled={isViewMode}
                            className="input text-sm font-mono w-full"
                            placeholder="Batch (optional)"
                            value={item.batch_no || ""}
                            onChange={(e) => updateItemField(item.originalIndex, "batch_no", e.target.value)}
                          />
                        </td>

                        {/* Available Qty */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`font-mono font-bold text-sm ${Number(avail) > 0 ? "text-brand-700 dark:text-brand-300" : "text-slate-400"}`}>
                            {avail}
                          </span>
                        </td>

                        {/* Qty to Receive */}
                        <td className="px-4 py-3 text-right min-w-[110px]">
                          <input
                            type="number"
                            step="0.001"
                            required
                            disabled={isViewMode}
                            className="input text-sm font-mono font-bold text-right w-full text-emerald-600"
                            value={item.qty}
                            onChange={(e) => updateItemField(item.originalIndex, "qty", e.target.value)}
                          />
                        </td>

                        {/* UOM */}
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-500">
                          {item.uom}
                        </td>

                        {/* Action */}
                        {!isViewMode && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(item.originalIndex)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        )}

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isViewMode ? 6 : 7} className="px-4 py-8 text-center text-slate-400">
                      No stock receipt items added. Click "+ Add Stock Receipt (Inflow)" to add incoming items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Journal Remarks / Document Reference (Textarea placed below Stock Receipt section) */}
        <div className="card p-6 bg-white dark:bg-slate-800 space-y-2 shadow-xs">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <FileText size={16} className="text-brand-600" />
            Journal Remarks / Document Reference
          </label>
          <textarea
            rows={3}
            disabled={isViewMode}
            className="input w-full text-sm leading-relaxed p-3"
            placeholder={
              formData.journal_type === "TRANSFER"
                ? "Enter transfer reasons, dispatch handling notes, vehicle / driver details, or authorization references..."
                : "Enter conversion details, repackaging ratios, batch/lot notes, or reconciliation reference..."
            }
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          />
        </div>

        {/* Voucher Summary Bar */}
        <div className="card p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-8 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold block">Total Issue Qty:</span>
              <span className="font-bold text-rose-600 font-mono text-base">
                {totalIssueQty.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold block">Total Receipt Qty:</span>
              <span className="font-bold text-emerald-600 font-mono text-base">
                {totalReceiptQty.toFixed(2)}
              </span>
            </div>
          </div>

          {!isViewMode && (
            <button
              type="submit"
              disabled={saving}
              className="btn-success flex items-center gap-1.5 text-sm font-bold ml-auto px-5 py-2.5"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Post Stock Journal Voucher
            </button>
          )}
        </div>

      </form>

    </div>
  );
}
