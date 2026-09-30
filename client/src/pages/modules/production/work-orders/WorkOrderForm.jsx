/**
 * @fileoverview WorkOrderForm component.
 * Complete Production Order Execution & Detail Form:
 * 1. Order Header & BOM selection
 * 2. Automatic Material Requirement & Shortage calculation (Required vs Available)
 * 3. Quick Action Triggers (Create Requisition, Material Receipt, Utilization, Record Output)
 * 4. Production Costing & Status progression
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  ClipboardList, 
  Layers,
  Loader2,
  Package,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  DollarSign
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function WorkOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id && id !== "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [boms, setBoms] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [baseCurrency, setBaseCurrency] = useState({ symbol: "$", code: "USD" });
  const [selectedBomDetails, setSelectedBomDetails] = useState(null);

  const [inventoryItems, setInventoryItems] = useState([]);
  const [warehouseStockMap, setWarehouseStockMap] = useState({});
  const [formData, setFormData] = useState({
    work_order_no: "WO-000001",
    work_order_date: new Date().toISOString().split('T')[0],
    target_completion_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    item_id: "",
    bom_id: "",
    qty_to_produce: 1,
    warehouse_id: "",
    remarks: "",
    status: "DRAFT",
    items: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bomsRes, whRes, prodWhRes, cfgRes, invRes, currRes, woListRes, woRes] = await Promise.all([
          api.get("/production/boms"),
          api.get("/inventory/warehouses"),
          api.get("/production/setup/warehouses").catch(() => ({ data: { items: [] } })),
          api.get("/production/setup/config").catch(() => ({ data: null })),
          api.get("/inventory/items?all=1"),
          api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
          !isEdit ? api.get("/production/work-orders") : Promise.resolve({ data: null }),
          isEdit ? api.get(`/production/work-orders/${id}`) : Promise.resolve({ data: null })
        ]);
        
        const fetchedBoms = bomsRes.data?.items || [];
        const fetchedItems = invRes.data?.items || [];
        const fetchedWh = whRes.data?.items || [];
        const fetchedProdWh = prodWhRes.data?.items || [];
        const cfg = cfgRes.data || {};

        setBoms(fetchedBoms);
        setInventoryItems(fetchedItems);

        // Deduplicate & normalize warehouses
        const combinedWh = [...fetchedProdWh, ...fetchedWh];
        const uniqueWhMap = new Map();
        combinedWh.forEach(w => {
          if (w && w.id && !uniqueWhMap.has(String(w.id))) {
            uniqueWhMap.set(String(w.id), {
              id: String(w.id),
              name: w.warehouse_name || w.name || w.title || `Warehouse #${w.id}`,
              code: w.warehouse_code || w.code || '',
              is_default: Number(w.is_default) === 1 || w.is_default === true
            });
          }
        });
        const allWarehouses = Array.from(uniqueWhMap.values());
        setWarehouses(allWarehouses);

        // Determine Default Production Warehouse from Setup
        const cfgSettings = cfg.settings || cfg || {};
        let defaultWhId = cfgSettings.default_production_warehouse_id || cfgSettings.default_warehouse_id || cfgSettings.production_warehouse_id || "";
        if (!defaultWhId) {
          const defWh = allWarehouses.find(w => w.is_default) || allWarehouses[0];
          if (defWh) defaultWhId = String(defWh.id);
        }

        const curList = Array.isArray(currRes.data?.items) ? currRes.data.items : [];
        const base = curList.find((c) => Number(c.is_base) === 1 || c.is_base === true || Number(c.is_base_currency) === 1);
        if (base) {
          setBaseCurrency({
            symbol: base.symbol || base.code || "$",
            code: base.code || "USD",
          });
        }

        if (!isEdit && woListRes?.data?.items) {
          const count = (woListRes.data.items || []).length + 1;
          const nextWoNo = `WO-${String(count).padStart(6, '0')}`;
          setFormData((prev) => ({ 
            ...prev, 
            work_order_no: nextWoNo,
            warehouse_id: prev.warehouse_id || defaultWhId
          }));
        } else if (!isEdit) {
          setFormData((prev) => ({ 
            ...prev, 
            warehouse_id: prev.warehouse_id || defaultWhId
          }));
        }

        const map = {};
        fetchedItems.forEach(i => {
          map[i.id] = i.current_stock || 0;
        });
        setStockMap(map);

        if (woRes?.data?.item) {
          const item = woRes.data.item;
          setFormData({
            work_order_no: item.work_order_no,
            work_order_date: item.work_order_date ? item.work_order_date.split('T')[0] : new Date().toISOString().split('T')[0],
            target_completion_date: item.target_completion_date ? item.target_completion_date.split('T')[0] : new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
            item_id: item.item_id || "",
            bom_id: item.bom_id,
            qty_to_produce: item.qty_to_produce,
            warehouse_id: item.warehouse_id || "",
            remarks: item.remarks || "",
            status: item.status || "DRAFT",
            items: item.items || []
          });

          if (item.bom_id) {
            handleBomChange(item.bom_id, item.qty_to_produce);
          }
        }
      } catch {
        toast.error("Failed to load Production Order details");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit]);

  const fetchWarehouseStock = async (whId) => {
    if (!whId) return;
    try {
      const res = await api.get("/production/reports/warehouse-stock", {
        params: { warehouse_id: whId }
      });
      const items = res.data?.items || [];
      const map = {};
      items.forEach(i => {
        map[i.item_id] = Number(i.available_qty !== undefined ? i.available_qty : (i.stock_qty || 0));
      });
      setWarehouseStockMap(map);
    } catch {
      setWarehouseStockMap({});
    }
  };

  useEffect(() => {
    if (formData.warehouse_id) {
      fetchWarehouseStock(formData.warehouse_id);
    }
  }, [formData.warehouse_id]);

  const handleItemChange = (itemId) => {
    setFormData(prev => ({ ...prev, item_id: itemId }));
    if (!itemId) {
      handleBomChange("");
      return;
    }
    const linkedBom = boms.find(b => String(b.item_id) === String(itemId));
    if (linkedBom) {
      handleBomChange(linkedBom.id);
      toast.info(`Auto-populated linked BOM: ${linkedBom.bom_name}`);
    } else {
      toast.warning("No linked BOM found for this item. Please select a BOM manually or create one in BOM setup.");
      handleBomChange("");
    }
  };

  const handleBomChange = async (bomId, customQty = null) => {
    if (!bomId) {
      setFormData(prev => ({ ...prev, bom_id: "", items: [] }));
      setSelectedBomDetails(null);
      return;
    }
    
    try {
      const res = await api.get(`/production/boms/${bomId}`);
      const bom = res.data?.item;
      if (bom) {
        setSelectedBomDetails(bom);
        const targetQty = customQty !== null ? customQty : formData.qty_to_produce;
        const ratio = targetQty / (bom.output_qty || 1);
        
        let allMaterials = [];
        if (Array.isArray(bom.components) && bom.components.length > 0) {
          allMaterials = bom.components.map(c => ({
            item_id: c.item_id,
            item_name: c.item_name,
            item_code: c.item_code,
            planned_qty: Number(((parseFloat(c.qty) || 1) * ratio).toFixed(3)),
            actual_qty: Number(((parseFloat(c.qty) || 1) * ratio).toFixed(3)),
            unit_cost: parseFloat(c.unit_cost || c.cost_value) || 0,
            uom: c.uom || "Pcs"
          }));
        } else if (Array.isArray(bom.operations)) {
          // Extract inputs from process operations
          bom.operations.forEach(op => {
            (op.inputs || []).forEach(inp => {
              allMaterials.push({
                item_id: inp.item_id || inp.id || Math.random(),
                item_name: inp.item_name || "Raw Material",
                item_code: inp.item_code || "",
                planned_qty: Number(((parseFloat(inp.qty) || 1) * ratio).toFixed(3)),
                actual_qty: Number(((parseFloat(inp.qty) || 1) * ratio).toFixed(3)),
                unit_cost: parseFloat(inp.cost_value || inp.unit_cost) || 0,
                uom: inp.uom || "Pcs"
              });
            });
          });
        }

        setFormData(prev => ({
          ...prev,
          bom_id: bomId,
          items: allMaterials
        }));
        toast.info("BOM components and process flows loaded dynamically");
      }
    } catch {
      toast.error("Failed to fetch BOM details");
    }
  };

  const handleQtyChange = (val) => {
    setFormData(prev => {
      const numQty = parseFloat(val);
      if (isNaN(numQty) || numQty < 0) {
        return { ...prev, qty_to_produce: val };
      }

      const selectedBom = selectedBomDetails || boms.find(b => String(b.id) === String(prev.bom_id));
      const baseBatch = selectedBom?.output_qty || selectedBom?.batch_size || 1;

      const updatedItems = (prev.items || []).map(i => {
        const unitPerOutput = i.unit_per_output || (i.planned_qty ? i.planned_qty / (parseFloat(prev.qty_to_produce) || 1) : 1);
        return {
          ...i,
          unit_per_output: unitPerOutput,
          planned_qty: Number((unitPerOutput * numQty).toFixed(3)),
          actual_qty: Number((unitPerOutput * numQty).toFixed(3))
        };
      });

      return {
        ...prev,
        qty_to_produce: val,
        items: updatedItems
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.bom_id) return toast.error("Please select a BOM / Manufacturing Specification");

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/production/work-orders/${id}/status`, { status: formData.status });
        toast.success("Production Order status updated successfully");
      } else {
        await api.post("/production/work-orders", formData);
        toast.success("Production Order created successfully");
      }
      navigate("/production/work-orders");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save Production Order");
    } finally {
      setSaving(false);
    }
  };

  // Calculate Shortages & Financials
  const materialAnalysis = (formData.items || []).map(item => {
    const required = Number(item.planned_qty || 0);
    const available = Number(
      warehouseStockMap[item.item_id] !== undefined 
        ? warehouseStockMap[item.item_id] 
        : (stockMap[item.item_id] || 0)
    );
    const shortage = Math.max(0, required - available);
    const lineCost = required * (item.unit_cost || 0);
    return {
      ...item,
      available,
      shortage,
      lineCost,
      hasShortage: shortage > 0
    };
  });

  const totalShortages = materialAnalysis.filter(m => m.hasShortage).length;
  const totalPlannedMaterialCost = materialAnalysis.reduce((acc, m) => acc + m.lineCost, 0);

  if (loading) {
    return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading Order Details...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/production/work-orders" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">
              {isEdit ? `Production Order #${formData.work_order_no}` : "New Production Order"}
            </h1>
            <p className="text-slate-500 text-sm">Configure manufacturing run, required materials, stock shortages & execution</p>
          </div>
        </div>

        {/* Quick Action Shortcuts for Receipts, Utilizations */}
        {isEdit && (
          <div className="flex items-center gap-2">
            <Link
              to={`/production/execution/material-receipt/new`}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              + Receipt
            </Link>
            <Link
              to={`/production/execution/material-utilization/new`}
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              + Utilization
            </Link>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Header */}
        <div className="card p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Select Item / Product *
            </label>
            <select
              value={formData.item_id}
              onChange={(e) => handleItemChange(e.target.value)}
              className="input w-full font-bold text-brand-700 dark:text-brand-300"
            >
              <option value="">Select Item to Produce...</option>
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_name}
                </option>
              ))}
            </select>
            {selectedBomDetails && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                ✓ Auto-linked BOM: {selectedBomDetails.bom_name}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Planned Output Qty *
            </label>
            <input
              type="number"
              step="any"
              required
              value={formData.qty_to_produce}
              onChange={(e) => handleQtyChange(e.target.value)}
              className="input w-full font-bold text-brand-600 dark:text-brand-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Production Warehouse *
            </label>
            <select
              value={formData.warehouse_id}
              onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
              className="input w-full font-semibold"
            >
              <option value="">Select Warehouse...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Order Date *
            </label>
            <input
              type="date"
              required
              value={formData.work_order_date}
              onChange={(e) => setFormData({ ...formData, work_order_date: e.target.value })}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Target Completion Date
            </label>
            <input
              type="date"
              value={formData.target_completion_date}
              onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Lifecycle Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="input w-full font-bold"
            >
              <option value="DRAFT">Draft</option>
              <option value="PLANNED">Planned</option>
              <option value="RELEASED">Released</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Estimated Material Cost ({baseCurrency.code})
            </label>
            <div className="input w-full font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center h-10 px-3">
              {baseCurrency.symbol}{totalPlannedMaterialCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Shortage Summary Banner */}
        {totalShortages > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3 text-amber-800 dark:text-amber-300 text-sm">
              <AlertTriangle size={20} className="text-amber-600" />
              <span>
                <strong>Material Shortage Detected:</strong> {totalShortages} material(s) have stock shortages for this planned quantity.
              </span>
            </div>
          </div>
        )}

        {/* Operational Flow Details Preview */}
        {selectedBomDetails?.operations?.length > 0 && (
          <div className="card p-5 space-y-3 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-brand-600" />
              Linked BOM Process Operations ({selectedBomDetails.operations.length} Steps)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {selectedBomDetails.operations.map((op, idx) => (
                <div key={idx} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1 shadow-sm">
                  <div className="font-bold text-slate-900 dark:text-white flex justify-between">
                    <span>Seq #{idx + 1}: {op.process_name || op.operation_name || op.name || op.title || `Process Operation #${idx + 1}`}</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono">{(op.cycle_time_mins || 0) * (formData.qty_to_produce || 1)} mins</span>
                  </div>
                  <div className="text-slate-500 flex justify-between text-[11px]">
                    <span>Inputs: {(op.inputs || []).length} items</span>
                    <span>Overheads: {(op.overheads || []).length} items</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Material Requirements vs Available Stock Table */}
        <div className="card p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Required Materials & Shortage Analysis</h3>
              <p className="text-xs text-slate-500">Calculated automatically from BOM Specification * Planned Production Quantity</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Material Item</th>
                  <th className="px-4 py-3">Required Qty</th>
                  <th className="px-4 py-3">Available Stock</th>
                  <th className="px-4 py-3">Stock Shortage</th>
                  <th className="px-4 py-3">Est. Unit Cost</th>
                  <th className="px-4 py-3">Line Total ({baseCurrency.code})</th>
                  <th className="px-4 py-3 text-center">Shortage Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {materialAnalysis.length > 0 ? (
                  materialAnalysis.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 font-medium">
                        {row.item_name || `Item #${row.item_id}`} ({row.item_code || ''})
                      </td>
                      <td className="px-4 py-3 font-bold text-brand-600">
                        {row.planned_qty} {row.uom || "Pcs"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                        {row.available}
                      </td>
                      <td className="px-4 py-3 font-bold text-rose-600">
                        {row.shortage > 0 ? row.shortage : "0"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {baseCurrency.symbol}{Number(row.unit_cost || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        {baseCurrency.symbol}{row.lineCost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.hasShortage ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Shortage
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Stock Available
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-400 italic">
                      Select a BOM Specification above to inspect material requirements and stock availability.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link to="/production/work-orders" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save Production Order
          </button>
        </div>
      </form>
    </div>
  );
}
