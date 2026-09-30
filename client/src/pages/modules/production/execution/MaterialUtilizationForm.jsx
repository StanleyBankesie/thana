/**
 * @fileoverview MaterialUtilizationForm component.
 * Production Material Utilization entry form linked to:
 * - Production Plan and Production Execution (Job Card) with bidirectional auto-population
 * - Production Warehouses (from prod_warehouses)
 * - Dynamic live Available Qty per selected Warehouse & Item
 * - Real-time stock balance deduction from the specified warehouse upon submission
 */

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Loader2, 
  Package, 
  Info, 
  AlertTriangle,
  Calendar,
  Layers,
  Warehouse,
  ClipboardList,
  FileCheck
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import { filterByPrefix } from "@/utils/searchUtils.js";

export default function MaterialUtilizationForm() {
  const { id } = useParams();
  const isViewMode = Boolean(id && id !== "new");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [inventoryItems, setInventoryItems] = useState([]);
  const [itemQueries, setItemQueries] = useState({});
  const [plans, setPlans] = useState([]);
  const [jobCards, setJobCards] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [stockBalances, setStockBalances] = useState([]);

  const [formData, setFormData] = useState({
    plan_id: "",
    job_card_id: "",
    receipt_id: "",
    warehouse_id: "",
    utilization_date: new Date().toISOString().split("T")[0],
    remarks: "",
    items: []
  });

  // Calculate available qty for an item in a specific warehouse
  const getItemWarehouseStock = (itemId, warehouseId, currentStockBalances = stockBalances) => {
    if (!itemId || !warehouseId) return 0;
    const balance = currentStockBalances.find(
      (b) => String(b.item_id) === String(itemId) && String(b.warehouse_id) === String(warehouseId)
    );
    if (balance) {
      if (balance.available_qty !== undefined && balance.available_qty !== null) {
        return Number(balance.available_qty);
      }
      const qty = Number(balance.qty || 0);
      const res = Number(balance.reserved_qty || 0);
      return Math.max(0, qty - res);
    }
    return 0;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Exclusively fetch production warehouses and real-time production stock balances
        const [itemsRes, plansRes, jcRes, recRes, prodWhRes, stockRes, cfgRes] = await Promise.all([
          api.get("/inventory/items?all=1").catch(() => ({ data: { items: [] } })),
          api.get("/production/planning/daily").catch(() => ({ data: { items: [] } })),
          api.get("/production/execution/job-cards").catch(() => ({ data: { items: [] } })),
          api.get("/production/execution/material-receipt").catch(() => ({ data: { items: [] } })),
          api.get("/production/setup/warehouses").catch(() => ({ data: { items: [] } })),
          api.get("/production/reports/warehouse-stock").catch(() => ({ data: { items: [] } })),
          api.get("/production/setup/config").catch(() => ({ data: { settings: {} } }))
        ]);

        const rawProdWh = prodWhRes.data?.items || [];
        const rawStock = stockRes.data?.items || [];
        const cfgSettings = cfgRes.data?.settings || {};

        setInventoryItems(itemsRes.data?.items || []);
        setPlans(plansRes.data?.items || []);
        setJobCards(jcRes.data?.items || []);
        setReceipts(recRes.data?.items || []);
        setWarehouses(rawProdWh);
        setStockBalances(rawStock);

        // Auto-select default production warehouse from setup config, then is_default flag, then first warehouse
        let initialWhId = "";
        if (cfgSettings.default_warehouse_id && rawProdWh.some(w => String(w.id) === String(cfgSettings.default_warehouse_id))) {
          initialWhId = String(cfgSettings.default_warehouse_id);
        } else {
          const defaultWh = rawProdWh.find((w) => w.is_default) || rawProdWh[0];
          initialWhId = defaultWh ? String(defaultWh.id) : "";
        }

        if (id && id !== "new") {
          const detailRes = await api.get(`/production/execution/material-utilization/${id}`);
          const data = detailRes.data;
          setFormData({
            plan_id: data.plan_id ? String(data.plan_id) : "",
            job_card_id: data.job_card_id ? String(data.job_card_id) : "",
            receipt_id: data.receipt_id ? String(data.receipt_id) : "",
            warehouse_id: data.warehouse_id ? String(data.warehouse_id) : initialWhId,
            utilization_date: data.utilization_date ? data.utilization_date.split("T")[0] : new Date().toISOString().split("T")[0],
            remarks: data.remarks || "",
            items: data.items || []
          });
        } else {
          setFormData((prev) => ({
            ...prev,
            warehouse_id: prev.warehouse_id || initialWhId
          }));
        }
      } catch {
        toast.error("Failed to load utilization metadata");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Bi-directional sync & Auto-populate: When Production Execution (Job Card) changes
  const handleJobCardChange = async (jcId) => {
    const selectedJc = jobCards.find((j) => String(j.id) === String(jcId));
    setFormData((prev) => ({
      ...prev,
      job_card_id: jcId,
      plan_id: selectedJc?.plan_id ? String(selectedJc.plan_id) : prev.plan_id
    }));

    if (!jcId) return;

    try {
      const res = await api.get(`/production/execution/job-cards/${jcId}`);
      const jcData = res.data;
      const consumptionItems = jcData?.consumption_details || jcData?.inputs || [];

      if (consumptionItems.length > 0) {
        const targetWh = formData.warehouse_id;
        const mappedItems = consumptionItems.map((c) => {
          const cQty = Number(c.actual_qty !== undefined && c.actual_qty !== null ? c.actual_qty : (c.qty || 1));
          const whStock = getItemWarehouseStock(c.item_id, targetWh, stockBalances);
          return {
            item_id: c.item_id,
            qty_required: Number(c.qty || cQty),
            qty_received: cQty,
            available_qty: whStock,
            qty_utilized: cQty,
            uom: c.uom || "Pcs",
            batch_no: c.batch_no || jcData.batch_no || ""
          };
        });

        setFormData((prev) => ({
          ...prev,
          job_card_id: jcId,
          items: mappedItems
        }));
        toast.info(`Populated ${mappedItems.length} consumption item(s) from Production Execution`);
      }
    } catch (err) {
      console.error("Failed to load consumption details from job card:", err);
    }
  };

  const handleWarehouseChange = (newWarehouseId) => {
    setFormData((prev) => {
      const updatedItems = prev.items.map((row) => {
        const avail = getItemWarehouseStock(row.item_id, newWarehouseId, stockBalances);
        return {
          ...row,
          available_qty: avail
        };
      });
      return {
        ...prev,
        warehouse_id: newWarehouseId,
        items: updatedItems
      };
    });
  };

  const handleReceiptChange = async (receiptId) => {
    setFormData((prev) => ({ ...prev, receipt_id: receiptId }));
    if (!receiptId) return;

    try {
      const res = await api.get(`/production/execution/material-receipt/${receiptId}`);
      const recData = res.data;

      const targetWh = recData.warehouse_id ? String(recData.warehouse_id) : formData.warehouse_id;

      const mappedItems = (recData.items || []).map((i) => {
        const receiptRemaining = Math.max(0, Number(i.qty_received || 0) - Number(i.qty_utilized || 0));
        return {
          item_id: i.item_id,
          qty_required: Number(i.qty_received || 0),
          qty_received: Number(i.qty_received || 0),
          available_qty: receiptRemaining,
          qty_utilized: receiptRemaining > 0 ? receiptRemaining : 1,
          uom: i.uom || "Pcs",
          batch_no: i.batch_no || ""
        };
      });

      setFormData((prev) => ({
        ...prev,
        receipt_id: receiptId,
        warehouse_id: targetWh,
        items: mappedItems
      }));
      toast.info("Materials loaded from Material Receipt");
    } catch {
      toast.error("Failed to fetch receipt items");
    }
  };

  const addItemRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          item_id: "",
          qty_required: 1,
          qty_received: 1,
          available_qty: 0,
          qty_utilized: 1,
          uom: "Pcs",
          batch_no: ""
        }
      ]
    }));
  };

  const removeItemRow = (index) => {
    const updated = [...formData.items];
    updated.splice(index, 1);
    setFormData((prev) => ({ ...prev, items: updated }));
  };

  const updateItemRow = (index, field, value) => {
    const updated = [...formData.items];
    updated[index][field] = value;

    if (field === "item_id") {
      const selected = inventoryItems.find((i) => String(i.id) === String(value));
      if (selected) {
        updated[index].uom = selected.uom || "Pcs";
        let avail = getItemWarehouseStock(value, formData.warehouse_id, stockBalances);
        if (formData.receipt_id) {
          const recObj = receipts.find((r) => String(r.id) === String(formData.receipt_id));
          const recItem = (recObj?.items || []).find((ri) => String(ri.item_id) === String(value));
          if (recItem) {
            avail = Math.max(0, Number(recItem.qty_received || 0) - Number(recItem.qty_utilized || 0));
          }
        }
        updated[index].available_qty = avail;
      }
    }

    setFormData((prev) => ({ ...prev, items: updated }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      return toast.error("Please add at least one material item");
    }

    for (const it of formData.items) {
      if (!it.item_id) {
        return toast.error("Item selection is required for all rows");
      }
      if (Number(it.qty_utilized) <= 0) {
        return toast.error("Utilized quantity must be greater than zero");
      }
      const avail = Number(it.available_qty || 0);
      if (avail > 0 && Number(it.qty_utilized) > avail) {
        const itemObj = inventoryItems.find((i) => String(i.id) === String(it.item_id));
        return toast.error(
          `Utilized quantity (${it.qty_utilized}) for "${itemObj?.item_name || 'Item'}" exceeds available stock (${avail}) in selected warehouse.`
        );
      }
    }

    try {
      setSaving(true);
      if (id && id !== "new") {
        await api.put(`/production/execution/material-utilization/${id}`, formData);
        toast.success("Material utilization updated successfully");
      } else {
        await api.post("/production/execution/material-utilization", formData);
        toast.success("Material utilization created and warehouse stock deducted successfully");
      }
      navigate("/production/execution/material-utilization");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save material utilization");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-20 text-center animate-pulse font-bold text-slate-400 text-sm">
        Loading utilization data...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="card">
        <div className="card-header bg-brand-900 text-white dark:bg-brand-950 rounded-t-lg flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300 flex items-center gap-2">
              <Package className="h-7 w-7 text-amber-400" />
              {isViewMode ? "View Material Utilization" : "New Material Utilization"}
            </h1>
            <p className="text-sm mt-1 text-slate-100">
              Record consumed raw materials against Shop Floor Execution with live warehouse stock deduction.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/production/execution/material-utilization" className="font-sans btn btn-secondary text-sm">
              Return to List
            </Link>
            {!isViewMode && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="btn-success flex items-center gap-1.5 text-sm font-bold"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Material Utilization
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Main Details Card */}
        <div className="card p-6 bg-white dark:bg-slate-800 space-y-4 shadow-xs">
          
          {/* Header Fields: Execution (Job Card), Material Receipt (Auto-hidden if Job Card selected), Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Production Execution / Job Card */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileCheck size={15} className="text-indigo-600" /> Production Execution (Job Card)
              </label>
              <select
                disabled={isViewMode}
                className="input font-semibold text-sm w-full"
                value={formData.job_card_id}
                onChange={(e) => handleJobCardChange(e.target.value)}
              >
                <option value="">Select Production Execution...</option>
                {jobCards.map((jc) => (
                  <option key={jc.id} value={jc.id}>
                    {jc.job_card_no} - {jc.item_name || `Item #${jc.item_id}`} ({jc.status || 'ACTIVE'})
                  </option>
                ))}
              </select>
            </div>

            {/* Material Receipt (Auto-hidden if Job Card is selected) */}
            {!formData.job_card_id && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Package size={15} className="text-emerald-600" /> Material Receipt
                </label>
                <select
                  disabled={isViewMode}
                  className="input font-semibold text-sm w-full"
                  value={formData.receipt_id}
                  onChange={(e) => handleReceiptChange(e.target.value)}
                >
                  <option value="">Select Material Receipt...</option>
                  {receipts.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.receipt_no} ({new Date(r.receipt_date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Utilization Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar size={15} className="text-brand-600" /> Utilization Date
              </label>
              <input
                type="date"
                required
                disabled={isViewMode}
                className="input font-semibold text-sm w-full"
                value={formData.utilization_date}
                onChange={(e) => setFormData({ ...formData, utilization_date: e.target.value })}
              />
            </div>

          </div>

          {/* Row 2: Production Warehouse (Stock Deduction) - Exclusively from prod_warehouses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Warehouse size={15} className="text-rose-600" /> Production Warehouse (Stock Deduction)
              </label>
              <select
                required
                disabled={isViewMode}
                className="input font-semibold text-sm w-full"
                value={formData.warehouse_id}
                onChange={(e) => handleWarehouseChange(e.target.value)}
              >
                <option value="">Select Production Warehouse...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Only production floor warehouses from the Production module are listed.
              </p>
            </div>
          </div>

        </div>

        {/* Utilized Materials Section */}
        <div className="card p-6 bg-white dark:bg-slate-800 space-y-4 border-l-4 border-l-brand-600 shadow-xs">
          <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="text-brand-600 h-5 w-5" />
                Utilized Material Items
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Available quantity is calculated live based on the selected Production Warehouse.
              </p>
            </div>
            {!isViewMode && (
              <button
                type="button"
                onClick={addItemRow}
                className="btn btn-secondary text-sm flex items-center gap-1.5 font-bold text-brand-700"
              >
                <Plus size={15} /> Add Material Line
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-900 text-white dark:bg-brand-950 font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-4 py-3.5 text-white">Item</th>
                  <th className="px-4 py-3.5 text-white">Batch #</th>
                  {!formData.job_card_id && (
                    <th className="px-4 py-3.5 text-right text-white">Receipt Qty</th>
                  )}
                  <th className="px-4 py-3.5 text-right text-white">Available Qty (In Warehouse)</th>
                  <th className="px-4 py-3.5 text-right text-white">Qty Utilized</th>
                  <th className="px-4 py-3.5 text-white">UOM</th>
                  {!isViewMode && <th className="px-4 py-3.5 text-right text-white">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {formData.items.length > 0 ? (
                  formData.items.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      
                      {/* Item Search & Select */}
                      <td className="px-4 py-3 min-w-[280px] relative">
                        {isViewMode ? (
                          <input
                            disabled
                            className="input text-sm font-semibold w-full bg-slate-100 dark:bg-slate-800"
                            value={(() => {
                              const found = inventoryItems.find((it) => String(it.id) === String(row.item_id));
                              return found ? `${found.item_code} - ${found.item_name}` : (row.item_name || row.item_code || "—");
                            })()}
                          />
                        ) : (
                          <>
                            <input
                              id={`mu-item-search-${index}`}
                              autoComplete="off"
                              required
                              className="input text-sm font-semibold w-full"
                              placeholder="Scan barcode or type item name / code..."
                              value={
                                itemQueries[index] !== undefined
                                  ? itemQueries[index]
                                  : (row.item_id ? (() => {
                                      const found = inventoryItems.find((it) => String(it.id) === String(row.item_id));
                                      return found ? `${found.item_code} - ${found.item_name}` : "";
                                    })() : "")
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemQueries((prev) => ({ ...prev, [index]: val }));
                                if (row.item_id) {
                                  updateItemRow(index, "item_id", "");
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const queryStr = (itemQueries[index] || "").trim();
                                  if (!queryStr) return;
                                  const searchResults = filterByPrefix(inventoryItems, {
                                    query: queryStr,
                                    searchFields: ["item_code", "item_name", "barcode"]
                                  });
                                  if (searchResults.length > 0) {
                                    const o = searchResults[0];
                                    updateItemRow(index, "item_id", String(o.id));
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
                              const searchResults = (queryStr && !row.item_id)
                                ? filterByPrefix(inventoryItems, {
                                    query: queryStr,
                                    searchFields: ["item_code", "item_name", "barcode"]
                                  })
                                : [];
                              if (searchResults.length === 0 || row.item_id) return null;
                              return (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-52 overflow-auto">
                                  {searchResults.map((o) => (
                                    <button
                                      type="button"
                                      key={o.id}
                                      className="block w-full text-left px-3 py-2 hover:bg-brand-50 dark:hover:bg-brand-950/50 text-xs border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                                      onClick={() => {
                                        updateItemRow(index, "item_id", String(o.id));
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
                      </td>

                      {/* Batch # */}
                      <td className="px-4 py-3 min-w-[140px]">
                        <input
                          type="text"
                          disabled={isViewMode}
                          className="input text-sm font-mono w-full"
                          placeholder="Batch (optional)"
                          value={row.batch_no || ""}
                          onChange={(e) => updateItemRow(index, "batch_no", e.target.value)}
                        />
                      </td>

                      {/* Receipt Qty (Hidden if Job Card selected) */}
                      {!formData.job_card_id && (
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          {Number(row.qty_received || 0).toFixed(2)}
                        </td>
                      )}

                      {/* Available Qty per selected Warehouse */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-brand-600">
                        {Number(row.available_qty || 0).toFixed(2)}
                      </td>

                      {/* Qty Utilized */}
                      <td className="px-4 py-3 text-right min-w-[130px]">
                        <input
                          type="number"
                          step="0.001"
                          required
                          disabled={isViewMode}
                          className="input text-sm font-mono font-bold text-right w-full text-rose-600"
                          value={row.qty_utilized}
                          onChange={(e) => updateItemRow(index, "qty_utilized", e.target.value)}
                        />
                      </td>

                      {/* UOM */}
                      <td className="px-4 py-3 font-bold text-slate-500 whitespace-nowrap">
                        {row.uom || "Pcs"}
                      </td>

                      {/* Action */}
                      {!isViewMode && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeItemRow(index)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      )}

                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isViewMode ? 6 : 7} className="px-4 py-8 text-center text-slate-400">
                      No materials added. Select a Material Receipt above or click "+ Add Material Line".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remarks Section */}
        <div className="card p-6 bg-white dark:bg-slate-800 space-y-2 shadow-xs">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Utilization Remarks / Shop Floor Justification
          </label>
          <textarea
            rows={3}
            disabled={isViewMode}
            className="input w-full text-sm leading-relaxed p-3"
            placeholder="Enter reason for utilization, work shift notes, machine variance observations..."
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          />
        </div>

      </form>
    </div>
  );
}
