/**
 * @fileoverview MaterialRequirementPage component.
 * Dedicated Production Material Requirements (MRP / Shortage) Page.
 * Corresponds to Step 5 of the Production Process Flow:
 * Manufacturing Setup -> BOM -> Production Planning -> Production Order -> Material Requirement
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  ShoppingCart,
  Layers,
  ArrowRight,
  Loader2,
  RefreshCw,
  Plus
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function MaterialRequirementPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [inventoryMap, setInventoryMap] = useState({});
  const [selectedOrderId, setSelectedOrderId] = useState("ALL_ORDERS");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [boms, setBoms] = useState([]);
  const [autoGenSetting, setAutoGenSetting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [configuredWhInfo, setConfiguredWhInfo] = useState({ sourceWh: null, prodWh: null });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [woRes, planRes, invRes, whRes, cfgRes, stockRes, bomRes, deptRes] = await Promise.all([
        api.get("/production/work-orders").catch(() => ({ data: { items: [] } })),
        api.get("/production/planning/daily").catch(() => ({ data: { items: [] } })),
        api.get("/inventory/items?all=1").catch(() => ({ data: { items: [] } })),
        api.get("/inventory/warehouses").catch(() => ({ data: { items: [] } })),
        api.get("/production/setup/config").catch(() => ({ data: { settings: {} } })),
        api.get("/inventory/granular-balances").catch(() => ({ data: { items: [] } })),
        api.get("/production/boms").catch(() => ({ data: { items: [] } })),
        api.get("/production/setup/departments").catch(() => ({ data: { items: [] } }))
      ]);

      const orders = woRes.data?.items || [];
      const fetchedPlans = planRes.data?.items || [];
      const fetchedWh = whRes.data?.items || [];
      const settings = cfgRes.data?.settings || {};
      const fetchedBoms = bomRes.data?.items || bomRes.data || [];
      const fetchedDepts = deptRes.data?.items || deptRes.data || [];
      
      setWorkOrders(orders);
      setPlans(fetchedPlans);
      setWarehouses(fetchedWh);
      setBoms(fetchedBoms);
      setDepartments(fetchedDepts);
      setAutoGenSetting(!!settings.auto_generate_material_requisitions);

      const sourceWhId = settings.default_source_warehouse_id;
      const prodWhId = settings.default_warehouse_id;

      const sourceWhObj = fetchedWh.find(w => String(w.id) === String(sourceWhId));
      const prodWhObj = fetchedWh.find(w => String(w.id) === String(prodWhId));
      setConfiguredWhInfo({
        sourceWh: sourceWhObj ? (sourceWhObj.warehouse_name || sourceWhObj.name) : null,
        prodWh: prodWhObj ? (prodWhObj.warehouse_name || prodWhObj.name) : null,
        sourceWhId,
        prodWhId
      });

      // Parse item stock balances per warehouse
      const stockBalancesList = stockRes.data?.items || stockRes.data?.balances || [];
      const whStockMap = {}; // item_id -> { [warehouse_id]: qty }
      stockBalancesList.forEach(sb => {
        if (!whStockMap[sb.item_id]) whStockMap[sb.item_id] = {};
        whStockMap[sb.item_id][sb.warehouse_id] = (whStockMap[sb.item_id][sb.warehouse_id] || 0) + (Number(sb.available_qty || sb.qty || 0));
      });

      const map = {};
      (invRes.data?.items || []).forEach((i) => {
        const itemWhStock = whStockMap[i.id] || {};
        const sourceQty = sourceWhId ? (itemWhStock[sourceWhId] || 0) : 0;
        const prodQty = prodWhId ? (itemWhStock[prodWhId] || 0) : 0;

        map[i.id] = {
          name: i.item_name,
          code: i.item_code,
          stock: Number(i.current_stock || 0),
          sourceStock: sourceQty,
          prodStock: prodQty,
          uom: i.unit_name || "Pcs"
        };
      });
      setInventoryMap(map);
    } catch {
      toast.error("Failed to load material requirements data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute aggregate raw material requirements across active Work Orders AND Production Plans with BOM explosion
  const requirementItems = useMemo(() => {
    const rawRequirementsMap = {};

    // 1. Gather requirements from Work Orders
    const targetOrders = selectedOrderId === "ALL_ORDERS"
      ? workOrders
      : workOrders.filter(w => String(w.id) === String(selectedOrderId));

    targetOrders.forEach(order => {
      const itemsList = Array.isArray(order.items) && order.items.length > 0 ? order.items : [];

      if (itemsList.length > 0) {
        itemsList.forEach(item => {
          const id = item.item_id;
          if (!id) return;
          const reqQty = Number(item.planned_qty || item.qty_to_produce || 0);
          if (!rawRequirementsMap[id]) {
            rawRequirementsMap[id] = {
              item_id: id,
              item_name: item.item_name,
              item_code: item.item_code,
              uom: item.uom || "Pcs",
              required: 0
            };
          }
          rawRequirementsMap[id].required += reqQty;
        });
      } else if (order.bom_id) {
        const matchedBom = boms.find(b => String(b.id) === String(order.bom_id));
        const bomItems = matchedBom?.items || [];
        bomItems.forEach(bItem => {
          const id = bItem.item_id;
          if (!id) return;
          const baseQty = parseFloat(bItem.quantity || bItem.qty) || 1;
          const scrap = parseFloat(bItem.scrap_percent) || 0;
          const reqQty = baseQty * (1 + scrap / 100) * (parseFloat(order.quantity || order.qty_to_produce) || 1);
          if (!rawRequirementsMap[id]) {
            rawRequirementsMap[id] = {
              item_id: id,
              item_name: bItem.item_name || `Item #${id}`,
              item_code: bItem.item_code || "",
              uom: bItem.uom || "Pcs",
              required: 0
            };
          }
          rawRequirementsMap[id].required += reqQty;
        });
      }
    });

    // 2. Gather requirements from Production Plans (prod_daily_plans)
    plans.forEach(plan => {
      const planProcesses = Array.isArray(plan.processes) 
        ? plan.processes 
        : (typeof plan.processes === 'string' ? JSON.parse(plan.processes || '[]') : []);

      let processesUsed = false;
      planProcesses.forEach(proc => {
        const inputs = proc.inputs || [];
        inputs.forEach(inp => {
          const id = inp.item_id;
          if (!id) return;
          processesUsed = true;
          const baseQty = parseFloat(inp.qty) || 1;
          const scrap = parseFloat(inp.scrap_percent) || 0;
          const grossQty = baseQty * (1 + scrap / 100);
          const reqQty = grossQty * (parseFloat(plan.quantity) || 1);

          if (!rawRequirementsMap[id]) {
            rawRequirementsMap[id] = {
              item_id: id,
              item_name: inp.item_name || "Raw Material",
              item_code: inp.item_code || "",
              uom: inp.uom || "Pcs",
              required: 0
            };
          }
          rawRequirementsMap[id].required += reqQty;
        });
      });

      // If plan has no process inputs, explode from BOM directly
      if (!processesUsed && plan.bom_id) {
        const matchedBom = boms.find(b => String(b.id) === String(plan.bom_id));
        const bomItems = matchedBom?.items || [];
        bomItems.forEach(bItem => {
          const id = bItem.item_id;
          if (!id) return;
          const baseQty = parseFloat(bItem.quantity || bItem.qty) || 1;
          const scrap = parseFloat(bItem.scrap_percent) || 0;
          const reqQty = baseQty * (1 + scrap / 100) * (parseFloat(plan.quantity) || 1);

          if (!rawRequirementsMap[id]) {
            rawRequirementsMap[id] = {
              item_id: id,
              item_name: bItem.item_name || `Item #${id}`,
              item_code: bItem.item_code || "",
              uom: bItem.uom || "Pcs",
              required: 0
            };
          }
          rawRequirementsMap[id].required += reqQty;
        });
      }
    });

    return Object.values(rawRequirementsMap).map(item => {
      const invInfo = inventoryMap[item.item_id] || {};
      const required = item.required;
      const totalCompanyStock = invInfo.stock || 0;
      const sourceStock = invInfo.sourceStock || 0;
      const prodStock = invInfo.prodStock || 0;
      
      // Stock available in the designated setup warehouses (Source Warehouse + Production Warehouse)
      const configuredAvailable = (configuredWhInfo.sourceWhId || configuredWhInfo.prodWhId)
        ? (sourceStock + prodStock)
        : totalCompanyStock;

      const shortage = Math.max(0, required - configuredAvailable);
      const status = shortage > 0 ? (configuredAvailable > 0 ? "PARTIAL" : "SHORTAGE") : "AVAILABLE";

      return {
        item_id: item.item_id,
        item_name: item.item_name || invInfo.name || `Item #${item.item_id}`,
        item_code: item.item_code || invInfo.code || "—",
        uom: item.uom || invInfo.uom || "Pcs",
        required,
        available: configuredAvailable,
        totalCompanyStock,
        sourceStock,
        prodStock,
        shortage,
        status
      };
    });
  }, [workOrders, plans, boms, selectedOrderId, inventoryMap, configuredWhInfo]);

  const filteredItems = requirementItems.filter(
    (i) =>
      i.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.item_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const shortageItemsList = requirementItems.filter((i) => i.shortage > 0);
  const totalShortages = shortageItemsList.length;

  const autoGenTriggeredRef = useRef(false);

  // Automated Requisition Creation when triggered automatically by setup configuration for ANY required materials
  useEffect(() => {
    if (!loading && autoGenSetting && requirementItems.length > 0 && !generating && !autoGenTriggeredRef.current) {
      autoGenTriggeredRef.current = true;
      const triggerAutoGen = async () => {
        setGenerating(true);
        try {
          const prodDept = departments.find(d => String(d.department_name).toLowerCase().includes("prod") || String(d.name).toLowerCase().includes("prod")) || departments[0];

          const reqPayload = {
            plan_id: plans[0]?.id || null,
            warehouse_id: configuredWhInfo.sourceWhId || (selectedWarehouseId ? Number(selectedWarehouseId) : null),
            department_id: prodDept?.id || null,
            priority: "HIGH",
            requisition_type: "PRODUCTION",
            status: "PENDING",
            requisition_date: new Date().toISOString().split('T')[0],
            remarks: `System Auto-generated Material Requisition from MRP calculation`,
            items: requirementItems.map(s => ({
              item_id: s.item_id,
              qty_requested: Math.ceil(s.required) || 1,
              uom: s.uom
            }))
          };

          await api.post("/production/execution/material-requisition", reqPayload);
          toast.success("System automatically generated Material Requisition for production materials!");
        } catch (err) {
          console.error("Auto-requisition trigger error:", err);
        } finally {
          setGenerating(false);
        }
      };
      triggerAutoGen();
    }
  }, [loading, autoGenSetting, requirementItems, generating]);

  const activeOrder = selectedOrderId === "ALL_ORDERS" 
    ? null 
    : workOrders.find((w) => String(w.id) === String(selectedOrderId));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/production" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Material Requirements (MRP)</h1>
            <p className="text-slate-500 text-sm">Automated Required vs Available stock comparison & shortage calculation per Production Order</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2 text-xs font-semibold">
            <RefreshCw size={16} /> Refresh Stock
          </button>
          
          <Link 
            to="/production/execution/material-requisition/new"
            className="btn btn-primary bg-brand-900 hover:bg-brand-950 text-white flex items-center gap-2 text-xs font-bold shadow-md"
          >
            <Plus size={18} />
            + Run MRP / Create Material Plan
          </Link>
        </div>
      </div>

      {/* Select Production Order & Warehouse Filter Selector Card */}
      <div className="card p-6 bg-brand-900 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl border-none">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-300">Material Requirements Calculation Scope</p>
          <h2 className="text-lg font-bold">Calculate Gross vs Available Material Shortages</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-72">
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="input bg-brand-950 border-brand-800 text-white w-full py-2.5 font-bold text-xs"
            >
              <option value="ALL_ORDERS">🌐 ALL Active Orders & Plans (Aggregate)</option>
              {workOrders.map((wo) => (
                <option key={wo.id} value={wo.id}>
                  Order #{wo.work_order_no} — {wo.item_name || "Production Order"} ({wo.qty_to_produce} Units)
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-56">
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="input bg-brand-950 border-brand-800 text-white w-full py-2.5 font-bold text-xs"
            >
              <option value="">All Warehouses (Company Stock)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.warehouse_name || w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Shortage Action Banner */}
      {totalShortages > 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-amber-800 dark:text-amber-300">
            <AlertTriangle size={24} className="text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">Material Shortage Warning</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {totalShortages} material item(s) have stock shortages for {activeOrder ? `Order #${activeOrder.work_order_no}` : "All Active Production Orders"}. {autoGenSetting ? "System auto-requisition active." : "Create Requisition to proceed."}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                try {
                  setGenerating(true);
                  const prodDept = departments.find(d => String(d.department_name).toLowerCase().includes("prod") || String(d.name).toLowerCase().includes("prod")) || departments[0];
                  const reqPayload = {
                    plan_id: plans[0]?.id || null,
                    warehouse_id: configuredWhInfo.sourceWhId || (selectedWarehouseId ? Number(selectedWarehouseId) : null),
                    department_id: prodDept?.id || null,
                    priority: "HIGH",
                    requisition_type: "PRODUCTION",
                    status: "PENDING",
                    requisition_date: new Date().toISOString().split('T')[0],
                    remarks: `System Material Requisition generated from MRP calculation`,
                    items: requirementItems.map(s => ({
                      item_id: s.item_id,
                      qty_requested: Math.ceil(s.required) || 1,
                      uom: s.uom
                    }))
                  };
                  await api.post("/production/execution/material-requisition", reqPayload);
                  toast.success("Material Requisition generated successfully!");
                  navigate("/production/execution/material-requisition");
                } catch (err) {
                  toast.error("Failed to generate Material Requisition");
                } finally {
                  setGenerating(false);
                }
              }}
              disabled={generating}
              className="btn btn-primary bg-brand-900 hover:bg-brand-950 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Material Requisition
            </button>
            <Link
              to="/purchase/requisitions/new"
              className="btn btn-secondary text-xs flex items-center gap-1.5 bg-white border-amber-300"
            >
              <ShoppingCart size={14} /> Create Purchase Requisition
            </Link>
          </div>
        </div>
      ) : activeOrder ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-sm font-medium">
            <CheckCircle2 size={20} className="text-emerald-600" />
            All required materials are fully available in stock for Order #{activeOrder?.work_order_no}. You can release material requisition.
          </div>
          <Link
            to="/production/execution/material-requisition/new"
            className="btn btn-primary bg-brand-900 hover:bg-brand-950 text-white font-bold text-xs shadow-md"
          >
            Issue Material Requisition →
          </Link>
        </div>
      ) : null}

      {/* Main Material Breakdown Table */}
      <div className="card overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">
            Material Breakdown — {activeOrder ? `Order #${activeOrder.work_order_no}` : "All Active Production Orders"}
          </h3>

          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 py-1 text-xs w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase tracking-wider text-xs border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Material Item</th>
                <th className="px-6 py-4">Required Qty</th>
                <th className="px-6 py-4">Available Qty (Configured Warehouses)</th>
                <th className="px-6 py-4">Setup Warehouses Breakdown</th>
                <th className="px-6 py-4">Shortage Qty</th>
                <th className="px-6 py-4">UOM</th>
                <th className="px-6 py-4 text-center">Availability Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase">
                    Calculating stock requirements...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-400">
                    <Package className="mx-auto mb-2 opacity-40" size={32} />
                    No material requirements found for this order.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 dark:text-white">{item.item_name}</p>
                      <p className="text-xs text-slate-400">{item.item_code}</p>
                    </td>

                    <td className="px-6 py-4 font-bold text-brand-600">
                      {item.required}
                    </td>

                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {item.available}
                    </td>

                    <td className="px-6 py-4 text-xs space-y-1">
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 gap-3">
                        <span className="font-semibold">{configuredWhInfo.sourceWh || "Source Warehouse"}:</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.sourceStock}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 gap-3">
                        <span className="font-semibold">{configuredWhInfo.prodWh || "Production Warehouse"}:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.prodStock}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-bold text-rose-600">
                      {item.shortage > 0 ? item.shortage : "0"}
                    </td>

                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {item.uom}
                    </td>

                    <td className="px-6 py-4 text-center">
                      {item.status === "SHORTAGE" ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Total Shortage
                        </span>
                      ) : item.status === "PARTIAL" ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Partial Stock
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Fully Available
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
