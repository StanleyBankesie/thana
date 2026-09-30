/**
 * @fileoverview Production StockJournalForm component.
 * Dual-entry manufacturing stock journal for recording raw material consumption (OUT)
 * and finished goods production output (IN) with dynamic warehouse routing,
 * live available stock balances, and standard application typography.
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
  Factory,
  Warehouse,
  ClipboardList,
  FileText,
  BookOpenCheck
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import { usePermission } from "@/auth/PermissionContext.jsx";
import { filterByPrefix } from "@/utils/searchUtils.js";

export default function ProductionStockJournalForm() {
  const { id } = useParams();
  const isViewMode = Boolean(id);
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [itemsCatalog, setItemsCatalog] = useState([]);
  const [itemQueries, setItemQueries] = useState({});
  const [plans, setPlans] = useState([]);
  const [jobCards, setJobCards] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [stockBalances, setStockBalances] = useState([]);
  
  const [formData, setFormData] = useState({
    journal_no: "",
    journal_type: "MANUFACTURING",
    source_warehouse_id: "",
    destination_warehouse_id: "",
    plan_id: "",
    job_card_id: "",
    journal_date: new Date().toISOString().split("T")[0],
    remarks: "",
    items: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [itemsRes, plansRes, jcRes, prodWhRes, stockRes, nextNoRes, cfgRes] = await Promise.all([
          api.get("/inventory/items").catch(() => ({ data: { items: [] } })),
          api.get("/production/planning/daily").catch(() => ({ data: { items: [] } })),
          api.get("/production/execution/job-cards").catch(() => ({ data: { items: [] } })),
          api.get("/production/setup/warehouses").catch(() => ({ data: { items: [] } })),
          api.get("/production/reports/warehouse-stock").catch(() => ({ data: { items: [] } })),
          !isViewMode ? api.get("/production/inventory/stock-journal/next-no").catch(() => ({ data: { next_no: "" } })) : Promise.resolve({ data: {} }),
          api.get("/production/setup/config").catch(() => ({ data: { settings: {} } }))
        ]);

        const prodWarehouses = prodWhRes.data?.items || [];
        const cfgSettings = cfgRes.data?.settings || {};

        let defaultWhId = "";
        if (cfgSettings.default_warehouse_id && prodWarehouses.some(w => String(w.id) === String(cfgSettings.default_warehouse_id))) {
          defaultWhId = String(cfgSettings.default_warehouse_id);
        } else {
          const defaultWh = prodWarehouses.find((w) => w.is_default) || prodWarehouses[0];
          defaultWhId = defaultWh ? String(defaultWh.id) : "";
        }

        setItemsCatalog(itemsRes.data?.items || []);
        setPlans(plansRes.data?.items || []);
        setJobCards(jcRes.data?.items || []);
        setWarehouses(prodWarehouses);
        setStockBalances(stockRes.data?.items || []);

        if (!isViewMode) {
          setFormData((prev) => ({
            ...prev,
            journal_no: nextNoRes.data?.next_no || prev.journal_no,
            source_warehouse_id: prev.source_warehouse_id || defaultWhId,
            destination_warehouse_id: prev.destination_warehouse_id || defaultWhId
          }));
        }
      } catch {
        toast.error("Failed to load dependency data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Helper to compute available stock quantity for an item in a specific warehouse
  const getAvailableQty = (itemId, warehouseId, itemType) => {
    if (!itemId) return "—";
    
    // Resolve attached/selected warehouse: line warehouse -> top-level selected warehouse
    let effectiveWh = warehouseId;
    if (!effectiveWh) {
      if (formData.journal_type === "TRANSFER") {
        effectiveWh = itemType === "CONSUMPTION" 
          ? formData.source_warehouse_id 
          : formData.destination_warehouse_id;
      } else {
        effectiveWh = formData.source_warehouse_id || formData.destination_warehouse_id || "";
      }
    }

    if (effectiveWh) {
      const match = stockBalances.find(
        (b) => String(b.item_id) === String(itemId) && String(b.warehouse_id) === String(effectiveWh)
      );
      if (match) {
        const qtyVal = Number(match.available_qty !== undefined && match.available_qty !== null ? match.available_qty : (match.qty || 0));
        return qtyVal.toFixed(2);
      }
      return "0.00";
    }

    const matches = stockBalances.filter((b) => String(b.item_id) === String(itemId));
    if (matches.length > 0) {
      const total = matches.reduce((acc, m) => acc + Number(m.available_qty !== undefined && m.available_qty !== null ? m.available_qty : (m.qty || 0)), 0);
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
      const targetWh = item.type === "CONSUMPTION" ? newSourceWh : newDestWh;
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

  // Handle single Production Warehouse change (Non-transfer mode)
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
      if (item.type === "CONSUMPTION") {
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
      if (item.type === "PRODUCTION") {
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

  // Bi-directional sync: When Production Execution (Job Card) changes
  const handleJobCardChange = (jcId) => {
    const selectedJc = jobCards.find((j) => String(j.id) === String(jcId));
    setFormData((prev) => ({
      ...prev,
      job_card_id: jcId,
      plan_id: selectedJc?.plan_id ? String(selectedJc.plan_id) : prev.plan_id
    }));
  };

  // Bi-directional sync: When Production Plan changes
  const handlePlanChange = (planId) => {
    const matchingJc = jobCards.find((j) => String(j.plan_id) === String(planId));
    setFormData((prev) => ({
      ...prev,
      plan_id: planId,
      job_card_id: matchingJc ? String(matchingJc.id) : (prev.plan_id === planId ? prev.job_card_id : "")
    }));
  };

  // Add Item with automatic warehouse pre-population
  const addItem = (type) => {
    let defaultWh = "";
    if (formData.journal_type === "TRANSFER") {
      defaultWh = type === "CONSUMPTION" 
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
          item_id: "", 
          warehouse_id: defaultWh || "", 
          qty: 1, 
          uom: "PCS", 
          batch_no: "",
          type 
        }
      ]
    }));
  };

  const removeItem = (index) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData((prev) => ({ ...prev, items: newItems }));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    if (field === "item_id") {
      const selected = itemsCatalog.find((i) => String(i.id) === String(value));
      if (selected) {
        newItems[index].uom = selected.uom || selected.unit_name || "PCS";
        if (selected.warehouse_id && !newItems[index].warehouse_id) {
          newItems[index].warehouse_id = String(selected.warehouse_id);
        }
      }
      if (!newItems[index].warehouse_id) {
        if (formData.journal_type === "TRANSFER") {
          newItems[index].warehouse_id = newItems[index].type === "CONSUMPTION" 
            ? formData.source_warehouse_id 
            : formData.destination_warehouse_id;
        } else {
          newItems[index].warehouse_id = formData.source_warehouse_id || formData.destination_warehouse_id || "";
        }
      }
    }
    
    setFormData((prev) => ({ ...prev, items: newItems }));
  };

  const totalConsumptionQty = useMemo(() => {
    return formData.items
      .filter((i) => i.type === "CONSUMPTION")
      .reduce((acc, cur) => acc + Number(cur.qty || 0), 0);
  }, [formData.items]);
  const totalProductionQty = useMemo(() => {
    return formData.items
      .filter((i) => i.type === "PRODUCTION")
      .reduce((acc, cur) => acc + Number(cur.qty || 0), 0);
  }, [formData.items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) return toast.error("Add at least one entry in the journal");
    
    const missingItem = formData.items.some((i) => !i.item_id);
    if (missingItem) return toast.error("Select an item for every line");

    // Check available quantity left based on selected warehouse
    for (const item of formData.items) {
      if (item.type === "CONSUMPTION") {
        const avail = Number(getAvailableQty(item.item_id, item.warehouse_id));
        if (Number(item.qty) > avail) {
          const itName = itemsCatalog.find((i) => String(i.id) === String(item.item_id))?.item_name || "Item";
          const whName = warehouses.find((w) => String(w.id) === String(item.warehouse_id))?.warehouse_name || "warehouse";
          return toast.error(`Insufficient stock for "${itName}": Entered ${item.qty}, but only ${avail} available in ${whName}`);
        }
      }
    }

    setSaving(true);
    try {
      const res = await api.post("/production/inventory/stock-journal", formData);
      toast.success(res.data?.message || "Production stock journal posted");
      navigate("/production/inventory/journal");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to post production journal");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 font-bold flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-brand-600" size={32} />
        Loading production stock journal...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner & Header */}
      <div className="card border-l-4 border-l-brand-600 bg-linear-to-r from-brand-50/60 via-slate-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-600 text-white rounded-xl shadow-md">
              <Factory size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {isViewMode ? `Production Stock Journal: ${formData.journal_no}` : "New Production Stock Journal"}
                </h1>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-300">
                  {formData.journal_type}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-500 mt-0.5">
                Log and balance factory floor raw material consumption (OUT) and finished goods production output (IN)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/production/inventory/journal" className="font-sans btn btn-secondary text-sm">
              <ArrowLeft size={16} className="mr-1.5" /> Back to Journals
            </Link>
            {!isViewMode && (
              <button
                type="submit"
                form="stockJournalForm"
                disabled={saving}
                className="btn-success flex items-center gap-1.5 text-sm font-bold shadow-md"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Post Stock Journal
              </button>
            )}
          </div>
        </div>
      </div>

      <form id="stockJournalForm" onSubmit={handleSubmit} className="space-y-6">
        
        {/* Document Header Fields */}
        <div className="card p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <FileText size={18} className="text-brand-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Journal Details</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Journal Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Journal Type *
              </label>
              <select
                disabled={isViewMode}
                className="input font-semibold text-sm w-full"
                value={formData.journal_type}
                onChange={(e) => handleJournalTypeChange(e.target.value)}
              >
                <option value="MANUFACTURING">Manufacturing Run</option>
                <option value="TRANSFER">Production Floor Warehouse Transfer</option>
                <option value="CONVERSION">Secondary Conversion</option>
                <option value="ADJUSTMENT">Variance Adjustment</option>
              </select>
            </div>

            {/* Production Execution (Job Card) */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <ClipboardList size={15} className="text-brand-600" /> Production Execution (Job Card)
              </label>
              <select
                disabled={isViewMode}
                className="input font-semibold text-sm w-full"
                value={formData.job_card_id}
                onChange={(e) => handleJobCardChange(e.target.value)}
              >
                <option value="">Select Production Execution (Optional)...</option>
                {jobCards.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.job_card_no || `JC-${j.id}`} ({j.item_name || "Batch"})
                  </option>
                ))}
              </select>
            </div>

            {/* Production Plan */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <BookOpenCheck size={15} className="text-brand-600" /> Production Plan
              </label>
              <select
                disabled={isViewMode}
                className="input font-semibold text-sm w-full"
                value={formData.plan_id}
                onChange={(e) => handlePlanChange(e.target.value)}
              >
                <option value="">Select Production Plan (Optional)...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.plan_no || `PLAN-${p.id}`} ({p.item_name || "Plan"})
                  </option>
                ))}
              </select>
            </div>

            {/* Posting Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Calendar size={15} className="text-brand-600" /> Posting Date *
              </label>
              <input
                type="date"
                required
                disabled={isViewMode}
                className="input font-semibold text-sm w-full"
                value={formData.journal_date}
                onChange={(e) => setFormData({ ...formData, journal_date: e.target.value })}
              />
            </div>

          </div>

          {/* Conditional Warehouse Layout */}
          {formData.journal_type === "TRANSFER" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              
              {/* Source Warehouse */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Warehouse size={15} className="text-rose-600" /> Source Warehouse
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
                  <Warehouse size={15} className="text-emerald-600" /> Destination Warehouse
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
                  <Warehouse size={15} className="text-brand-600" /> Production Warehouse Location
                </label>
                <select
                  disabled={isViewMode}
                  className="input font-semibold text-sm w-full"
                  value={formData.source_warehouse_id || formData.destination_warehouse_id || ""}
                  onChange={(e) => handleSingleWarehouseChange(e.target.value)}
                >
                  <option value="">Select Production Warehouse...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="card p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers size={18} className="text-brand-600" />
            Manufacturing Journal Entries
          </h2>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={() => addItem("CONSUMPTION")}
              className="btn btn-secondary text-sm flex items-center gap-1.5 font-bold text-rose-700 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <ArrowUpRight size={15} /> Add Raw Material Consumption (OUT)
            </button>
            <button 
              type="button" 
              onClick={() => addItem("PRODUCTION")}
              className="btn btn-secondary text-sm flex items-center gap-1.5 font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <ArrowDownLeft size={15} /> Add Production Output (IN)
            </button>
          </div>
        </div>

        {/* Entries List */}
        <div className="space-y-3">
          {formData.items.map((item, index) => {
            const avail = getAvailableQty(item.item_id, item.warehouse_id, item.type);
            return (
              <div 
                key={index} 
                className={`grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-xl border transition-all card ${
                  item.type === "CONSUMPTION" 
                    ? "bg-rose-50/20 border-l-4 border-l-rose-500 border-rose-100 dark:border-rose-900/20" 
                    : "bg-emerald-50/20 border-l-4 border-l-emerald-500 border-emerald-100 dark:border-emerald-900/20"
                }`}
              >
                {/* Type Badge */}
                <div className="md:col-span-2 flex items-center">
                  <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                    item.type === "CONSUMPTION" 
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" 
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  }`}>
                    {item.type === "CONSUMPTION" ? "CONSUMPTION (OUT)" : "OUTPUT (IN)"}
                  </span>
                </div>

                {/* Item Search & Select */}
                <div className="md:col-span-3 space-y-1 relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Item</label>
                  {isViewMode ? (
                    <input
                      disabled
                      className="input text-sm font-semibold w-full bg-slate-100 dark:bg-slate-800"
                      value={(() => {
                        const found = itemsCatalog.find((i) => String(i.id) === String(item.item_id));
                        return found ? `${found.item_code} - ${found.item_name}` : (item.item_name || item.item_code || "—");
                      })()}
                    />
                  ) : (
                    <>
                      <input
                        id={`sj-item-search-${index}`}
                        autoComplete="off"
                        required
                        className="input text-sm font-semibold w-full"
                        placeholder="Scan barcode or type item name / code..."
                        value={
                          itemQueries[index] !== undefined 
                            ? itemQueries[index] 
                            : (item.item_id ? (() => {
                                const found = itemsCatalog.find((i) => String(i.id) === String(item.item_id));
                                return found ? `${found.item_code} - ${found.item_name}` : "";
                              })() : "")
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          setItemQueries((prev) => ({ ...prev, [index]: val }));
                          if (item.item_id) {
                            updateItem(index, "item_id", "");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const queryStr = (itemQueries[index] || "").trim();
                            if (!queryStr) return;
                            const searchResults = filterByPrefix(itemsCatalog, {
                              query: queryStr,
                              searchFields: ["item_code", "item_name", "barcode"]
                            });
                            if (searchResults.length > 0) {
                              const o = searchResults[0];
                              updateItem(index, "item_id", String(o.id));
                              setItemQueries((prev) => ({
                                ...prev,
                                [index]: `${o.item_code} - ${o.item_name}`
                              }));
                            }
                          }
                        }}
                      />
                      {(() => {
                        const queryStr = (itemQueries[index] || "").trim();
                        const searchResults = (queryStr && !item.item_id)
                          ? filterByPrefix(itemsCatalog, {
                              query: queryStr,
                              searchFields: ["item_code", "item_name", "barcode"]
                            })
                          : [];
                        if (searchResults.length === 0 || item.item_id) return null;
                        return (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-52 overflow-auto">
                            {searchResults.map((o) => (
                              <button
                                type="button"
                                key={o.id}
                                className="block w-full text-left px-3 py-2 hover:bg-brand-50 dark:hover:bg-brand-950/50 text-xs border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                                onClick={() => {
                                  updateItem(index, "item_id", String(o.id));
                                  setItemQueries((prev) => ({
                                    ...prev,
                                    [index]: `${o.item_code} - ${o.item_name}`
                                  }));
                                }}
                              >
                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                  <span className="font-mono text-brand-600 dark:text-brand-400 mr-1.5">{o.item_code}</span>
                                  {o.item_name}
                                </div>
                                {o.uom && <div className="text-[11px] text-slate-400">UOM: {o.uom}</div>}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                {/* Warehouse Location (Auto-populated) */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Warehouse</label>
                  <select
                    disabled={isViewMode}
                    className="input text-sm w-full"
                    value={item.warehouse_id}
                    onChange={(e) => updateItem(index, "warehouse_id", e.target.value)}
                  >
                    <option value="">Select Warehouse...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                    ))}
                  </select>
                </div>

                {/* Available Qty */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Available Qty</label>
                  <div className="px-3 py-2 bg-slate-100/80 dark:bg-slate-900/80 rounded-lg text-sm font-mono font-bold text-brand-700 dark:text-brand-300">
                    {avail}
                  </div>
                </div>

                {/* Quantity */}
                <div className="md:col-span-1 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Quantity</label>
                  <input 
                    type="number" 
                    step="0.001"
                    required
                    disabled={isViewMode}
                    className={`input text-sm font-mono font-bold w-full ${item.type === "CONSUMPTION" ? "text-rose-600" : "text-emerald-600"}`}
                    value={item.qty}
                    onChange={(e) => updateItem(index, "qty", e.target.value)}
                  />
                </div>

                {/* UOM */}
                <div className="md:col-span-1 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">UOM</label>
                  <input 
                    type="text" 
                    disabled
                    className="input text-sm font-bold text-slate-500 bg-slate-100 dark:bg-slate-900 w-full"
                    value={item.uom || "PCS"}
                  />
                </div>

                {/* Remove Action */}
                {!isViewMode && (
                  <div className="md:col-span-1 flex items-end justify-end pb-1">
                    <button 
                      type="button" 
                      onClick={() => removeItem(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {formData.items.length === 0 && (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-medium text-sm">
              No entries in this journal. Use the buttons above to add Consumption (OUT) or Production Output (IN).
            </div>
          )}
        </div>

        {/* Section 3: Journal Remarks / Document Reference */}
        <div className="card p-6 bg-white dark:bg-slate-800 space-y-2 shadow-xs">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <FileText size={16} className="text-brand-600" />
            Journal Remarks / Shift Notes / Document Reference
          </label>
          <textarea
            rows={3}
            disabled={isViewMode}
            className="input w-full text-sm leading-relaxed p-3"
            placeholder="e.g. Shift 1 production run consumption and output, machine batch notes, operator details..."
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          />
        </div>

        {/* Voucher Summary Bar */}
        <div className="card p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-8 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold block">Total Consumption Qty (OUT):</span>
              <span className="font-bold text-rose-600 font-mono text-base">
                {totalConsumptionQty.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold block">Total Production Output Qty (IN):</span>
              <span className="font-bold text-emerald-600 font-mono text-base">
                {totalProductionQty.toFixed(2)}
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
              Post Production Stock Journal
            </button>
          )}
        </div>

      </form>
    </div>
  );
}
