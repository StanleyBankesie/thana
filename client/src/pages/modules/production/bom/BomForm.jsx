/**
 * @fileoverview BomForm component.
 * Unified Manufacturing Specification Form combining:
 * - Header (Product, Specification Name, Output Qty, Active Status)
 * - Required Materials (Item, Qty, UOM, Scrap Allowance %)
 * - Operational Process Steps (Sequence, Department, Operation, Machine)
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Package,
  Layers,
  Loader2,
  Building2,
  Settings2,
  Inbox,
  LogOut,
  Recycle,
  DollarSign,
  Eye,
  X,
  CheckSquare,
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function BomForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id && id !== "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [routings, setRoutings] = useState([]);
  const [setupOverheads, setSetupOverheads] = useState([]);
  const [baseCurrency, setBaseCurrency] = useState({ symbol: "$", code: "USD" });
  const [selectedRoutingId, setSelectedRoutingId] = useState("");
  const [modalState, setModalState] = useState(null); // { type: 'inputs'|'outputs'|'byproducts'|'overheads', processIndex: number, process: object }

  const [formData, setFormData] = useState({
    item_id: "",
    routing_id: "",
    bom_name: "",
    output_qty: 1,
    is_active: true,
    components: [],
    operations: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, procRes, routRes, ovhRes, currRes, bomRes] = await Promise.all([
          api.get("/inventory/items?all=1"),
          api.get("/production/setup/processes"),
          api.get("/production/routings?active=1"),
          api.get("/production/setup/overheads"),
          api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
          isEdit
            ? api.get(`/production/boms/${id}`)
            : Promise.resolve({ data: null }),
        ]);

        const curList = Array.isArray(currRes.data?.items) ? currRes.data.items : [];
        const base = curList.find((c) => Number(c.is_base) === 1 || c.is_base === true || Number(c.is_base_currency) === 1);
        if (base) {
          setBaseCurrency({
            symbol: base.symbol || base.code || "$",
            code: base.code || "USD",
          });
        }

        const invItems = itemsRes.data?.items || [];
        setItems(invItems);

        const initialBatchQty = parseFloat(formData.output_qty) || 1;

        const fetchedProcesses = (procRes.data?.items || []).map((p) => {
          const rawInputs = Array.isArray(p.inputs) ? p.inputs : [];
          const rawOutputs = Array.isArray(p.output_items) ? p.output_items : [];
          const rawByProducts = Array.isArray(p.by_products) ? p.by_products : [];
          const rawOverheads = Array.isArray(p.overheads) ? p.overheads : [];

          const enrichedInputs = rawInputs.map((inp) => {
            const rawName = (inp.item_name || "").toLowerCase().trim();
            const matched = invItems.find(
              (it) =>
                (it.id && String(it.id) === String(inp.item_id)) ||
                (it.item_code && String(it.item_code).toLowerCase().trim() === rawName) ||
                (it.item_name || it.name || "").toLowerCase().trim() === rawName
            );
            const cost = matched
              ? parseFloat(matched.purchase_price || matched.unit_cost || matched.valuation_rate || matched.cost_price || 0)
              : parseFloat(inp.cost_value || inp.unit_cost || 0);

            const qty = parseFloat(inp.qty) || 0;
            return {
              ...inp,
              cost_value: inp.cost_value || cost || 0,
              item_id: inp.item_id || (matched ? matched.id : undefined),
              base_qty: inp.base_qty ?? (initialBatchQty > 0 ? qty / initialBatchQty : qty),
            };
          });

          const enrichedOutputs = rawOutputs.map((out) => {
            const outQty = parseFloat(out.output_qty) || 0;
            return {
              ...out,
              base_output_qty: out.base_output_qty ?? (initialBatchQty > 0 ? outQty / initialBatchQty : outQty),
            };
          });

          const enrichedByProducts = rawByProducts.map((bp) => {
            const rawName = (bp.item_name || "").toLowerCase().trim();
            const matched = invItems.find(
              (it) =>
                (it.id && String(it.id) === String(bp.item_id)) ||
                (it.item_code && String(it.item_code).toLowerCase().trim() === rawName) ||
                (it.item_name || it.name || "").toLowerCase().trim() === rawName
            );
            const cost = matched
              ? parseFloat(matched.purchase_price || matched.unit_cost || matched.valuation_rate || matched.cost_price || 0)
              : parseFloat(bp.expected_cost || bp.recovery_value || 0);

            const expQty = parseFloat(bp.expected_qty) || 0;
            return {
              ...bp,
              expected_cost: bp.expected_cost || cost || 0,
              recovery_value: bp.recovery_value || cost || 0,
              item_id: bp.item_id || (matched ? matched.id : undefined),
              base_expected_qty: bp.base_expected_qty ?? (initialBatchQty > 0 ? expQty / initialBatchQty : expQty),
            };
          });

          const enrichedOverheads = rawOverheads.map((ov) => {
            const qty = parseFloat(ov.qty) || 0;
            return {
              ...ov,
              base_qty: ov.base_qty ?? (initialBatchQty > 0 ? qty / initialBatchQty : qty),
            };
          });

          return {
            ...p,
            inputs: enrichedInputs,
            output_items: enrichedOutputs,
            by_products: enrichedByProducts,
            overheads: enrichedOverheads,
          };
        });

        setProcesses(fetchedProcesses);
        setRoutings(routRes.data?.items || []);
        setSetupOverheads(ovhRes.data?.items || []);

        if (bomRes?.data?.item) {
          const item = bomRes.data.item;
          setFormData({
            item_id: item.item_id || "",
            routing_id: item.routing_id || "",
            bom_name: item.bom_name || "",
            output_qty:
              item.output_qty !== undefined && item.output_qty !== null
                ? item.output_qty
                : 1,
            is_active: item.is_active !== undefined ? !!item.is_active : true,
            components: (item.components || []).map((c) => ({
              item_id: c.item_id,
              qty: c.qty,
              uom: c.uom || "Pcs",
              scrap_percent: c.scrap_percent || 0,
            })),
            operations: item.operations || [],
          });
          if (item.routing_id) setSelectedRoutingId(String(item.routing_id));
        }
      } catch {
        toast.error("Failed to load specification details");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit]);

  const handleRoutingSelect = async (routingId) => {
    setSelectedRoutingId(routingId);
    if (!routingId) {
      setFormData((prev) => ({ ...prev, routing_id: "", item_id: "" }));
      return;
    }

    try {
      const res = await api.get(`/production/routings/${routingId}`);
      const routingData = res.data;

      if (routingData) {
        const selectedRouteHeader = routings.find(
          (r) => String(r.id) === String(routingId),
        );
        const itemId = routingData.item_id || selectedRouteHeader?.item_id;

        setFormData((prev) => ({
          ...prev,
          routing_id: routingId,
          item_id: itemId || prev.item_id,
          bom_name:
            prev.bom_name ||
            (selectedRouteHeader
              ? `${selectedRouteHeader.routing_name} BOM`
              : prev.bom_name),
          operations: (routingData.steps || []).map((step) => ({
            process_id: step.process_id,
            setup_time_mins: step.setup_time_mins || 0,
            cycle_time_mins: step.cycle_time_mins || 0,
          })),
        }));
        toast.info("Route steps and linked finished item loaded automatically");
      }
    } catch {
      toast.error("Failed to fetch route details");
    }
  };

  const addOperationRow = () => {
    setFormData((prev) => ({
      ...prev,
      operations: [
        ...prev.operations,
        { process_id: "", setup_time_mins: 0, cycle_time_mins: 0 },
      ],
    }));
  };

  const removeOperationRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      operations: prev.operations.filter((_, i) => i !== index),
    }));
  };

  const updateOperationRow = (index, field, value) => {
    const newOperations = [...formData.operations];
    newOperations[index][field] = value;
    setFormData({ ...formData, operations: newOperations });
  };

  const updateProcessFlowField = (procId, field, itemIdx, subField, value) => {
    const batchQty = parseFloat(formData.output_qty) || 1;

    setProcesses((prev) =>
      prev.map((p) => {
        if (String(p.id) !== String(procId)) return p;
        const list = [...(p[field] || [])];
        if (list[itemIdx]) {
          list[itemIdx] = { ...list[itemIdx], [subField]: value };

          // Maintain base_qty / base_expected_qty / base_output_qty when user edits quantity fields in modal
          if (field === "inputs" && subField === "qty") {
            const num = parseFloat(value) || 0;
            list[itemIdx].base_qty = batchQty > 0 ? num / batchQty : num;
          } else if (field === "overheads" && subField === "qty") {
            const num = parseFloat(value) || 0;
            list[itemIdx].base_qty = batchQty > 0 ? num / batchQty : num;
          } else if (field === "by_products" && subField === "expected_qty") {
            const num = parseFloat(value) || 0;
            list[itemIdx].base_expected_qty = batchQty > 0 ? num / batchQty : num;
          } else if (field === "output_items" && subField === "output_qty") {
            const num = parseFloat(value) || 0;
            list[itemIdx].base_output_qty = batchQty > 0 ? num / batchQty : num;
          }

          // Auto-fill unit cost when raw material item is selected in inputs
          if (field === "inputs" && subField === "item_name") {
            const rawVal = (value || "").toLowerCase().trim();
            const matched = items.find(
              (it) =>
                String(it.id) === rawVal ||
                (it.item_code || "").toLowerCase().trim() === rawVal ||
                (it.item_name || it.name || "").toLowerCase().trim() === rawVal ||
                `${it.item_code} - ${it.item_name}`.toLowerCase().trim() === rawVal,
            );
            if (matched) {
              list[itemIdx].item_id = matched.id;
              list[itemIdx].item_code = matched.item_code || "";
              list[itemIdx].item_name = matched.item_name || matched.name || value;
              const cost = parseFloat(
                matched.purchase_price ||
                  matched.unit_cost ||
                  matched.valuation_rate ||
                  matched.cost_price ||
                  0,
              );
              list[itemIdx].cost_value = cost;
              if (matched.uom) list[itemIdx].uom = matched.uom;
            }
          }

          // Auto-fill valuation price when item is selected in by_products
          if (field === "by_products" && subField === "item_name") {
            const rawVal = (value || "").toLowerCase().trim();
            const matched = items.find(
              (it) =>
                String(it.id) === rawVal ||
                (it.item_code || "").toLowerCase().trim() === rawVal ||
                (it.item_name || it.name || "").toLowerCase().trim() === rawVal ||
                `${it.item_code} - ${it.item_name}`.toLowerCase().trim() === rawVal,
            );
            if (matched) {
              list[itemIdx].item_id = matched.id;
              list[itemIdx].item_code = matched.item_code || "";
              list[itemIdx].item_name = matched.item_name || matched.name || value;
              const cost = parseFloat(
                matched.purchase_price ||
                  matched.unit_cost ||
                  matched.valuation_rate ||
                  matched.cost_price ||
                  0,
              );
              list[itemIdx].recovery_value = cost;
              list[itemIdx].expected_cost = cost;
              if (matched.uom) list[itemIdx].uom = matched.uom;
            }
          }

          // expected_cost and recovery_value are independent fields for by-products

          // If classification (output_tag) is set to anything other than Co-Product, auto set ratios to 100
          if (subField === "output_tag") {
            const isCoProd =
              (value || "").toLowerCase().trim() === "co-product";
            if (!isCoProd) {
              list[itemIdx].input_cost_sharing_ratio = 100;
              list[itemIdx].input_qty_sharing_ratio = 100;
            }
          }
          // Auto-fill overhead allocation_basis and cost_rate when selecting setup overhead
          if (field === "overheads" && subField === "overhead_name") {
            const matched = setupOverheads.find(
              (ov) =>
                (ov.overhead_name || "").toLowerCase().trim() ===
                (value || "").toLowerCase().trim(),
            );
            if (matched) {
              if (matched.allocation_basis)
                list[itemIdx].allocation_basis = matched.allocation_basis;
              if (
                matched.default_cost_rate !== undefined &&
                matched.default_cost_rate !== null
              ) {
                list[itemIdx].cost_rate =
                  parseFloat(matched.default_cost_rate) || 0;
              }
            }
          }
        }
        return { ...p, [field]: list };
      }),
    );
  };

  const addProcessFlowItem = (procId, field) => {
    const batchQty = parseFloat(formData.output_qty) || 1;

    setProcesses((prev) =>
      prev.map((p) => {
        if (String(p.id) !== String(procId)) return p;
        const list = [...(p[field] || [])];
        if (field === "inputs")
          list.push({
            item_name: "",
            qty: 1 * batchQty,
            base_qty: 1,
            uom: "Pcs",
            scrap_percent: 0,
            cost_value: 0,
            notes: "",
          });
        else if (field === "output_items")
          list.push({
            item_name: "",
            output_qty: batchQty,
            uom: "Pcs",
            unit_value: 0,
            output_tag: "Main Output",
            input_cost_sharing_ratio: 100,
            input_qty_sharing_ratio: 100,
          });
        else if (field === "by_products")
          list.push({
            item_name: "",
            expected_qty: 1 * batchQty,
            base_expected_qty: 1,
            uom: "Kg",
            recovery_value: 0,
          });
        else if (field === "overheads")
          list.push({
            overhead_name: "",
            qty: 1 * batchQty,
            base_qty: 1,
            cost_rate: 0,
            allocation_basis: "per Batch",
          });
        return { ...p, [field]: list };
      }),
    );
  };

  const removeProcessFlowItem = (procId, field, itemIdx) => {
    setProcesses((prev) =>
      prev.map((p) => {
        if (String(p.id) !== String(procId)) return p;
        const list = (p[field] || []).filter((_, i) => i !== itemIdx);
        return { ...p, [field]: list };
      }),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedRoutingId && !formData.item_id)
      return toast.error("Select a finished product item");
    if (!formData.bom_name.trim())
      return toast.error("Specification name is required");

    setSaving(true);
    try {
      // Map operations to include full process flow specs for DB persistence
      const enrichedOperations = (formData.operations || []).map((op) => {
        const proc = processes.find(
          (p) => String(p.id) === String(op.process_id),
        );
        return {
          ...op,
          inputs: proc?.inputs || [],
          output_items: (proc?.output_items || []).map((out) => {
            const isCoProd =
              (out.output_tag || "").toLowerCase().trim() === "co-product";
            return {
              ...out,
              input_cost_sharing_ratio: isCoProd
                ? (out.input_cost_sharing_ratio ?? 100)
                : 100,
              input_qty_sharing_ratio: isCoProd
                ? (out.input_qty_sharing_ratio ?? 100)
                : 100,
            };
          }),
          by_products: proc?.by_products || [],
          overheads: proc?.overheads || [],
        };
      });

      const payload = {
        ...formData,
        operations: enrichedOperations,
      };

      if (isEdit) {
        await api.put(`/production/boms/${id}`, payload);
        toast.success("Manufacturing specification updated successfully");
      } else {
        await api.post("/production/boms", payload);
        toast.success("Manufacturing specification created successfully");
      }
      navigate("/production/boms");
    } catch {
      toast.error("Failed to save specification");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-20 text-center animate-pulse font-bold text-slate-400">
        Loading BOM details...
      </div>
    );
  }

  const currentModalProcess = modalState
    ? processes.find((p) => String(p.id) === String(modalState.processId))
    : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/production/boms" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">
              {isEdit
                ? "Edit Manufacturing Specification"
                : "New Manufacturing Specification"}
            </h1>
            <p className="text-slate-500 text-sm">
              Define bill of materials, scrap allowances, and operation
              sequences
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Specification Master Card */}
        <div className="card p-6 bg-white dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700/80 rounded-2xl">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-50 dark:bg-brand-900/30 text-brand-600 rounded-xl">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Master Specification Parameters
                </h2>
                <p className="text-xs text-slate-500">
                  Link production route, set output target product, and specify
                  output batch sizing
                </p>
              </div>
            </div>

            {/* Active Status Checkbox (Default Checked) */}
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer bg-slate-50 dark:bg-slate-700/50 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600">
              <input
                type="checkbox"
                checked={!!formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              Active Specification
            </label>
          </div>

          {/* Master Parameters Total Cost & Output Value Calculations */}
          {(() => {
            let totalCostPerBatch = 0;
            let totalOutputBatchValue = 0;
            let hasModalData = false;

            (formData.operations || []).forEach((row) => {
              const targetProc = processes.find((p) => String(p.id) === String(row.process_id));
              if (!targetProc) return;

              const inputsList = targetProc.inputs || [];
              const overheadsList = targetProc.overheads || [];
              const byProductsList = targetProc.by_products || [];
              const outputsList = targetProc.output_items || [];

              if (
                inputsList.length > 0 ||
                overheadsList.length > 0 ||
                byProductsList.length > 0 ||
                outputsList.length > 0
              ) {
                hasModalData = true;
              }

              const inputsVal = inputsList.reduce((iAcc, curr) => {
                const q = parseFloat(curr.qty) || 0;
                const s = parseFloat(curr.scrap_percent) || 0;
                const c = parseFloat(curr.cost_value) || 0;
                const grossQty = q * (1 + s / 100);
                return iAcc + grossQty * c;
              }, 0);

              const overheadsVal = overheadsList.reduce((oAcc, curr) => {
                const q = parseFloat(curr.qty) || 1;
                const r = parseFloat(curr.cost_rate) || 0;
                return oAcc + q * r;
              }, 0);

              const byProductsVal = byProductsList.reduce((bAcc, curr) => {
                const q = parseFloat(curr.expected_qty) || 0;
                const r = parseFloat(curr.recovery_value) || 0;
                return bAcc + q * r;
              }, 0);

              const netProcessCost = Math.max(0, inputsVal + overheadsVal - byProductsVal);
              totalCostPerBatch += netProcessCost;

              outputsList.forEach((out) => {
                const outQty = parseFloat(out.output_qty) || 0;
                const isCoProduct = (out.output_tag || "").toLowerCase().trim() === "co-product";
                const sharingRatio = isCoProduct ? (parseFloat(out.input_cost_sharing_ratio) || 100) / 100 : 1;
                const calcUnitCost = outQty > 0 ? (netProcessCost * sharingRatio) / outQty : 0;
                const unitCost = (out.output_cost !== undefined && out.output_cost !== "" && out.output_cost !== null)
                  ? parseFloat(out.output_cost)
                  : calcUnitCost;
                totalOutputBatchValue += (outQty * unitCost);
              });
            });

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Production Route *
                  </label>
                  <select
                    value={selectedRoutingId}
                    onChange={(e) => handleRoutingSelect(e.target.value)}
                    className="input w-full font-medium"
                  >
                    <option value="">Select Production Route...</option>
                    {routings.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.routing_name} {r.item_name ? `(${r.item_name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Specification / BOM Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.bom_name}
                    onChange={(e) =>
                      setFormData({ ...formData, bom_name: e.target.value })
                    }
                    placeholder="e.g. Standard Steel Chair Recipe"
                    className="input w-full"
                  />
                </div>

                {/* Finished Product Item - Only visible when Production Route is selected */}
                {selectedRoutingId ? (
                  <div className="animate-in fade-in zoom-in-95 duration-200">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Finished Product Item *
                    </label>
                    <select
                      required
                      value={formData.item_id}
                      onChange={(e) =>
                        setFormData({ ...formData, item_id: e.target.value })
                      }
                      className="input w-full font-bold text-brand-700 dark:text-brand-300"
                    >
                      <option value="">Select Finished Item...</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.item_name} ({it.item_code})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Output Batch Qty *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.output_qty}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                      const parsedVal = isNaN(val) ? "" : val;
                      
                      setFormData((prev) => ({
                        ...prev,
                        output_qty: parsedVal,
                      }));

                      // Scale inputs, overheads, by_products, and output_items proportionally
                      if (parsedVal !== "" && parsedVal > 0) {
                        const batchQty = parsedVal;
                        setProcesses((prevProcesses) =>
                          prevProcesses.map((p) => ({
                            ...p,
                            inputs: (p.inputs || []).map((inp) => {
                              const bQty = parseFloat(inp.base_qty ?? inp.qty) || 0;
                              return {
                                ...inp,
                                base_qty: bQty,
                                qty: bQty * batchQty,
                              };
                            }),
                            overheads: (p.overheads || []).map((ov) => {
                              const bQty = parseFloat(ov.base_qty ?? ov.qty) || 0;
                              return {
                                ...ov,
                                base_qty: bQty,
                                qty: bQty * batchQty,
                              };
                            }),
                            by_products: (p.by_products || []).map((bp) => {
                              const bQty = parseFloat(bp.base_expected_qty ?? bp.expected_qty) || 0;
                              return {
                                ...bp,
                                base_expected_qty: bQty,
                                expected_qty: bQty * batchQty,
                              };
                            }),
                            output_items: (p.output_items || []).map((out) => {
                              const bRatio = parseFloat(out.base_output_qty ?? (out.output_qty && batchQty ? parseFloat(out.output_qty) / batchQty : 1)) || 1;
                              return {
                                ...out,
                                base_output_qty: bRatio,
                                output_qty: bRatio * batchQty,
                              };
                            }),
                          }))
                        );
                      }
                    }}
                    placeholder="e.g. 1"
                    className="input w-full font-bold text-brand-600 dark:text-brand-400"
                  />
                </div>

                {/* Total Cost per Batch and Total Output Batch Value only appear when process flow modals are updated */}
                {hasModalData && (
                  <>
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Total Cost per Batch ({baseCurrency.code})
                      </label>
                      <div className="input w-full font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 flex items-center h-10 px-3">
                        {baseCurrency.symbol}{totalCostPerBatch.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="animate-in fade-in zoom-in-95 duration-200">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Total Output Batch Value ({baseCurrency.code})
                      </label>
                      <div className="input w-full font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 flex items-center h-10 px-3">
                        {baseCurrency.symbol}{totalOutputBatchValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>

        {/* Operational Process Sequence Section */}
        <div className="card p-6 bg-white dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700/80 rounded-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl">
                <Settings2 size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Production Operation Sequence
                </h2>
                <p className="text-xs text-slate-500">
                  Routing operations, setup times, cycle durations, and process
                  material flow details
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={addOperationRow}
              className="btn btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus size={15} /> Add Operation Step
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700/60">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200/80 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3.5 w-14 text-center">Seq #</th>
                  <th className="px-4 py-3.5">Process Operation</th>
                  <th className="px-4 py-3.5">Process Flow Details</th>
                  <th className="px-4 py-3.5 w-32 text-right">
                    Total Time (Mins)
                  </th>
                  <th className="px-4 py-3.5 w-36 text-right">
                    cost per process ({baseCurrency.code})
                  </th>
                  <th className="px-4 py-3.5 w-16 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {formData.operations.length > 0 ? (
                  formData.operations.map((row, idx) => {
                    const targetProc = processes.find(
                      (p) => String(p.id) === String(row.process_id),
                    );

                    // Calculate Net Process Cost: (Inputs + Overheads) - ByProducts
                    const inputsVal = (targetProc?.inputs || []).reduce(
                      (acc, curr) => {
                        const q = parseFloat(curr.qty) || 0;
                        const c =
                          parseFloat(curr.cost_value || curr.unit_cost) || 0;
                        return acc + q * c;
                      },
                      0,
                    );

                    const overheadsVal = (targetProc?.overheads || []).reduce(
                      (acc, curr) => {
                        const q = parseFloat(curr.qty) || 1;
                        const r = parseFloat(curr.cost_rate) || 0;
                        return acc + q * r;
                      },
                      0,
                    );

                    const byProductsVal = (
                      targetProc?.by_products || []
                    ).reduce((acc, curr) => {
                      const q = parseFloat(curr.expected_qty) || 0;
                      const r = parseFloat(curr.recovery_value) || 0;
                      return acc + q * r;
                    }, 0);

                    const netProcessCost = Math.max(
                      0,
                      inputsVal + overheadsVal - byProductsVal,
                    );

                    // Calculate Total Production Time (Mins) = Setup Time + (Cycle Time * Target Batch Qty)
                    const targetBatchQty = parseFloat(formData.output_qty) || 1;
                    const setupTime = parseFloat(row.setup_time_mins) || 0;
                    const cycleTime = parseFloat(row.cycle_time_mins) || 0;
                    const totalProdTimeMins =
                      setupTime + cycleTime * targetBatchQty;

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3.5 font-bold text-slate-400 text-center">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3.5">
                          <select
                            value={row.process_id}
                            onChange={(e) =>
                              updateOperationRow(
                                idx,
                                "process_id",
                                e.target.value,
                              )
                            }
                            className="input w-full text-xs font-semibold text-slate-800 dark:text-slate-200"
                          >
                            <option value="">Select Process...</option>
                            {processes.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.process_name} (
                                {p.department_name || "General"})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3.5">
                          {targetProc ? (
                            /* Process Flow Details buttons styled with soft light blue bg, subtle border, and deep blue text & icons */
                            <div className="flex items-center gap-2 flex-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  setModalState({
                                    type: "inputs",
                                    processId: targetProc.id,
                                  })
                                }
                                className="px-3 py-1.5 bg-sky-50/80 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-800 dark:text-sky-300 border border-sky-200/90 dark:border-sky-800/80 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all shadow-sm"
                              >
                                <Inbox
                                  size={14}
                                  className="text-sky-700 dark:text-sky-300"
                                />{" "}
                                Inputs ({(targetProc.inputs || []).length})
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setModalState({
                                    type: "outputs",
                                    processId: targetProc.id,
                                  })
                                }
                                className="px-3 py-1.5 bg-sky-50/80 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-800 dark:text-sky-300 border border-sky-200/90 dark:border-sky-800/80 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all shadow-sm"
                              >
                                <LogOut
                                  size={14}
                                  className="text-sky-700 dark:text-sky-300"
                                />{" "}
                                Outputs (
                                {(targetProc.output_items || []).length})
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setModalState({
                                    type: "byproducts",
                                    processId: targetProc.id,
                                  })
                                }
                                className="px-3 py-1.5 bg-sky-50/80 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-800 dark:text-sky-300 border border-sky-200/90 dark:border-sky-800/80 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all shadow-sm"
                              >
                                <Recycle
                                  size={14}
                                  className="text-sky-700 dark:text-sky-300"
                                />{" "}
                                By-Products (
                                {(targetProc.by_products || []).length})
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setModalState({
                                    type: "overheads",
                                    processId: targetProc.id,
                                  })
                                }
                                className="px-3 py-1.5 bg-sky-50/80 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-800 dark:text-sky-300 border border-sky-200/90 dark:border-sky-800/80 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all shadow-sm"
                              >
                                <DollarSign
                                  size={14}
                                  className="text-sky-700 dark:text-sky-300"
                                />{" "}
                                Overheads ({(targetProc.overheads || []).length}
                                )
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">
                              Select process operation to inspect flows
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                          {totalProdTimeMins.toLocaleString()} min
                          {totalProdTimeMins !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {baseCurrency.symbol}
                          {netProcessCost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => removeOperationRow(idx)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                            title="Remove Operation Step"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-12 text-center text-slate-400 text-sm"
                    >
                      No operation steps configured. Select a route or click
                      "Add Operation Step".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            to="/production/boms"
            className="btn btn-secondary px-5 py-2 text-sm font-semibold"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary px-6 py-2 text-sm font-bold flex items-center gap-2 shadow-lg shadow-brand-500/20"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Specification
          </button>
        </div>
      </form>

      {/* Editable Process Flow Form Modal */}
      {modalState && currentModalProcess && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {modalState.type === "inputs" && (
                    <Inbox className="text-slate-600" size={20} />
                  )}
                  {modalState.type === "outputs" && (
                    <LogOut className="text-slate-600" size={20} />
                  )}
                  {modalState.type === "byproducts" && (
                    <Recycle className="text-slate-600" size={20} />
                  )}
                  {modalState.type === "overheads" && (
                    <DollarSign className="text-slate-600" size={20} />
                  )}
                  {currentModalProcess.process_name} —{" "}
                  {modalState.type.toUpperCase()} SPECIFICATION FORM
                </h3>
                <p className="text-xs text-slate-500">
                  Edit quantities, values, UOMs, scrap allowances, and costs for
                  this process
                </p>
              </div>
              <button
                onClick={() => setModalState(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
              {/* INPUTS FORM */}
              {modalState.type === "inputs" &&
                (() => {
                  const list = currentModalProcess.inputs || [];
                  const totalInputValue = list.reduce((acc, curr) => {
                    const q = parseFloat(curr.qty) || 0;
                    const s = parseFloat(curr.scrap_percent) || 0;
                    const c = parseFloat(curr.cost_value) || 0;
                    const grossQty = q * (1 + s / 100);
                    return acc + grossQty * c;
                  }, 0);

                  return (
                    <div className="space-y-4">
                      <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-center justify-between text-xs font-bold border border-slate-200 dark:border-slate-600">
                        <span className="text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Input Value:
                        </span>
                        <span className="text-slate-900 dark:text-white text-sm font-mono">
                          {totalInputValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      {list.map((inp, i) => (
                        <div
                          key={i}
                          className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3"
                        >
                          <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700 pb-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                              Input Item #{i + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                removeProcessFlowItem(
                                  currentModalProcess.id,
                                  "inputs",
                                  i,
                                )
                              }
                              className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1"
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Item Name / Material *
                              </label>
                              <input
                                type="text"
                                value={inp.item_name || ""}
                                onChange={(e) =>
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "inputs",
                                    i,
                                    "item_name",
                                    e.target.value,
                                  )
                                }
                                placeholder="e.g. funny name"
                                className="input w-full text-xs font-semibold"
                                list={`bom-inv-items-inputs-${i}`}
                              />
                              <datalist id={`bom-inv-items-inputs-${i}`}>
                                {items.map((it) => (
                                  <option key={it.id} value={it.item_name || it.name}>
                                    {it.item_code ? `${it.item_code} - ` : ""}[
                                    {it.item_type || "Item"}]{" "}
                                    {(it.purchase_price || it.unit_cost || it.valuation_rate || it.cost_price)
                                      ? `(${baseCurrency.symbol}${it.purchase_price || it.unit_cost || it.valuation_rate || it.cost_price})`
                                      : ""}
                                  </option>
                                ))}
                              </datalist>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Required Qty *
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={inp.qty ?? ""}
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? ""
                                      : parseFloat(e.target.value);
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "inputs",
                                    i,
                                    "qty",
                                    isNaN(val) ? "" : val,
                                  );
                                }}
                                placeholder="e.g. 1"
                                className="input w-full text-xs font-bold text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                UOM
                              </label>
                              <input
                                type="text"
                                value={inp.uom || "Pcs"}
                                onChange={(e) =>
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "inputs",
                                    i,
                                    "uom",
                                    e.target.value,
                                  )
                                }
                                className="input w-full text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Unit Cost
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={inp.cost_value ?? ""}
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? ""
                                      : parseFloat(e.target.value);
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "inputs",
                                    i,
                                    "cost_value",
                                    isNaN(val) ? "" : val,
                                  );
                                }}
                                placeholder="e.g. 15.50"
                                className="input w-full text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Scrap Allowance %
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={
                                  inp.scrap_percent === 0 ||
                                  inp.scrap_percent === "0"
                                    ? ""
                                    : (inp.scrap_percent ?? "")
                                }
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? ""
                                      : parseFloat(e.target.value);
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "inputs",
                                    i,
                                    "scrap_percent",
                                    isNaN(val) ? "" : val,
                                  );
                                }}
                                placeholder="e.g. 2.5"
                                className="input w-full text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          addProcessFlowItem(currentModalProcess.id, "inputs")
                        }
                        className="btn btn-secondary w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5 border-dashed"
                      >
                        <Plus size={14} /> Add Input Item
                      </button>
                    </div>
                  );
                })()}

              {/* OUTPUTS FORM */}
              {modalState.type === "outputs" &&
                (() => {
                  const list = currentModalProcess.output_items || [];

                  // Net process cost calculation
                  const inputsVal = (currentModalProcess.inputs || []).reduce(
                    (acc, curr) =>
                      acc +
                      (parseFloat(curr.qty) || 0) *
                        (parseFloat(curr.cost_value || curr.unit_cost) || 0),
                    0,
                  );
                  const overheadsVal = (
                    currentModalProcess.overheads || []
                  ).reduce(
                    (acc, curr) =>
                      acc +
                      (parseFloat(curr.qty) || 1) *
                        (parseFloat(curr.cost_rate) || 0),
                    0,
                  );
                  const byProductsVal = (
                    currentModalProcess.by_products || []
                  ).reduce(
                    (acc, curr) =>
                      acc +
                      (parseFloat(curr.expected_qty) || 0) *
                        (parseFloat(curr.recovery_value) || 0),
                    0,
                  );
                  const netProcessCost = Math.max(
                    0,
                    inputsVal + overheadsVal - byProductsVal,
                  );

                  const totalOutputValue = list.reduce((acc, curr) => {
                    const q = parseFloat(curr.output_qty) || 0;
                    const ratio =
                      (curr.output_tag || "").toLowerCase().trim() ===
                      "co-product"
                        ? (parseFloat(curr.input_cost_sharing_ratio) || 100) /
                          100
                        : 1;
                    const calcUnitCost =
                      q > 0 ? (netProcessCost * ratio) / q : 0;
                    const cost =
                      curr.output_cost !== undefined &&
                      curr.output_cost !== "" &&
                      curr.output_cost !== null
                        ? parseFloat(curr.output_cost)
                        : calcUnitCost;
                    return acc + q * cost;
                  }, 0);

                  return (
                    <div className="space-y-4">
                      {/* Output Summary Banner */}
                      <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-center justify-between text-xs font-bold border border-slate-200 dark:border-slate-600">
                        <span className="text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Output Value:
                        </span>
                        <span className="text-slate-900 dark:text-white text-sm font-mono">
                          {totalOutputValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      {/* Simplified BOM Setup Help Note */}
                      <div className="p-4 bg-sky-50/80 dark:bg-sky-950/40 rounded-2xl border border-sky-200/90 dark:border-sky-800/80 space-y-2 text-xs text-sky-900 dark:text-sky-200">
                        <div className="font-bold flex items-center gap-1.5 text-sky-800 dark:text-sky-300 text-xs uppercase tracking-wider">
                          <span>💡</span> BOM Setup Guide: Standard Product vs
                          Co-Product
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px] leading-relaxed">
                          <div className="bg-white/80 dark:bg-slate-800/60 p-2.5 rounded-xl border border-sky-100 dark:border-sky-900/50 space-y-1">
                            <span className="font-bold text-sky-950 dark:text-sky-100 block">
                              1️⃣ Standard Product (Main Output)
                            </span>
                            <p>
                              Main finished good & by-products. Each output
                              consumes 100% input quantity. Total input cost
                              sharing ratio across outputs must equal 100%.
                            </p>
                          </div>
                          <div className="bg-white/80 dark:bg-slate-800/60 p-2.5 rounded-xl border border-sky-100 dark:border-sky-900/50 space-y-1">
                            <span className="font-bold text-sky-950 dark:text-sky-100 block">
                              2️⃣ Co-Product (Joint Production)
                            </span>
                            <p>
                              Joint production (e.g. multiple mould outputs).
                              Outputs share inputs with a total quantity sharing
                              ratio equal to 100% across outputs.
                            </p>
                          </div>
                        </div>
                      </div>

                      {list.map((out, i) => {
                        const isCoProduct =
                          (out.output_tag || "").toLowerCase().trim() ===
                          "co-product";
                        const outQty = parseFloat(out.output_qty) || 0;
                        const sharingRatio = isCoProduct
                          ? (parseFloat(out.input_cost_sharing_ratio) || 100) /
                            100
                          : 1;
                        const calculatedUnitCost =
                          outQty > 0
                            ? (netProcessCost * sharingRatio) / outQty
                            : 0;
                        const displayOutputCost =
                          out.output_cost !== undefined &&
                          out.output_cost !== "" &&
                          out.output_cost !== null
                            ? out.output_cost
                            : calculatedUnitCost
                              ? calculatedUnitCost.toFixed(2)
                              : "";

                        return (
                          <div
                            key={i}
                            className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3"
                          >
                            <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700 pb-2">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                Output Item #{i + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  removeProcessFlowItem(
                                    currentModalProcess.id,
                                    "output_items",
                                    i,
                                  )
                                }
                                className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1"
                              >
                                <Trash2 size={13} /> Remove
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                  Output Item Name *
                                </label>
                                <input
                                  type="text"
                                  value={out.item_name || ""}
                                  onChange={(e) =>
                                    updateProcessFlowField(
                                      currentModalProcess.id,
                                      "output_items",
                                      i,
                                      "item_name",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. Cut Steel Pipe / Plastic Can 5L"
                                  className="input w-full text-xs font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                  Output Qty *
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  value={out.output_qty ?? ""}
                                  onChange={(e) => {
                                    const val =
                                      e.target.value === ""
                                        ? ""
                                        : parseFloat(e.target.value);
                                    updateProcessFlowField(
                                      currentModalProcess.id,
                                      "output_items",
                                      i,
                                      "output_qty",
                                      isNaN(val) ? "" : val,
                                    );
                                  }}
                                  placeholder="e.g. 1"
                                  className="input w-full text-xs font-bold text-slate-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                  UOM
                                </label>
                                <input
                                  type="text"
                                  value={out.uom || "Pcs"}
                                  onChange={(e) =>
                                    updateProcessFlowField(
                                      currentModalProcess.id,
                                      "output_items",
                                      i,
                                      "uom",
                                      e.target.value,
                                    )
                                  }
                                  className="input w-full text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                  Classification
                                </label>
                                <select
                                  value={out.output_tag || "Main Output"}
                                  onChange={(e) =>
                                    updateProcessFlowField(
                                      currentModalProcess.id,
                                      "output_items",
                                      i,
                                      "output_tag",
                                      e.target.value,
                                    )
                                  }
                                  className="input w-full text-xs font-semibold"
                                >
                                  <option value="Main Output">
                                    Main Output
                                  </option>
                                  <option value="Sub-Assembly">
                                    Sub-Assembly
                                  </option>
                                  <option value="Co-Product">Co-Product</option>
                                  <option value="Intermediate WIP">
                                    Intermediate WIP
                                  </option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                  Output Cost{" "}
                                  <span className="text-slate-400 font-normal">
                                    (Auto calculated)
                                  </span>
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  value={displayOutputCost}
                                  onChange={(e) => {
                                    const val =
                                      e.target.value === ""
                                        ? ""
                                        : parseFloat(e.target.value);
                                    updateProcessFlowField(
                                      currentModalProcess.id,
                                      "output_items",
                                      i,
                                      "output_cost",
                                      isNaN(val) ? "" : val,
                                    );
                                  }}
                                  placeholder={
                                    calculatedUnitCost
                                      ? calculatedUnitCost.toFixed(2)
                                      : "0.00"
                                  }
                                  className="input w-full text-xs font-semibold"
                                />
                              </div>

                              {/* Cost Sharing Ratio % and Qty Sharing Ratio % only visible when classification === Co-Product */}
                              {isCoProduct && (
                                <>
                                  <div className="animate-in fade-in zoom-in-95 duration-150">
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                      Input Cost Sharing Ratio %
                                    </label>
                                    <input
                                      type="number"
                                      step="any"
                                      value={
                                        out.input_cost_sharing_ratio === 0 ||
                                        out.input_cost_sharing_ratio === "0"
                                          ? ""
                                          : (out.input_cost_sharing_ratio ?? "")
                                      }
                                      onChange={(e) => {
                                        const val =
                                          e.target.value === ""
                                            ? ""
                                            : parseFloat(e.target.value);
                                        updateProcessFlowField(
                                          currentModalProcess.id,
                                          "output_items",
                                          i,
                                          "input_cost_sharing_ratio",
                                          isNaN(val) ? "" : val,
                                        );
                                      }}
                                      placeholder="e.g. 100"
                                      className="input w-full text-xs font-semibold"
                                    />
                                  </div>
                                  <div className="animate-in fade-in zoom-in-95 duration-150">
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                      Input Qty Sharing Ratio %
                                    </label>
                                    <input
                                      type="number"
                                      step="any"
                                      value={
                                        out.input_qty_sharing_ratio === 0 ||
                                        out.input_qty_sharing_ratio === "0"
                                          ? ""
                                          : (out.input_qty_sharing_ratio ?? "")
                                      }
                                      onChange={(e) => {
                                        const val =
                                          e.target.value === ""
                                            ? ""
                                            : parseFloat(e.target.value);
                                        updateProcessFlowField(
                                          currentModalProcess.id,
                                          "output_items",
                                          i,
                                          "input_qty_sharing_ratio",
                                          isNaN(val) ? "" : val,
                                        );
                                      }}
                                      placeholder="e.g. 100"
                                      className="input w-full text-xs font-semibold"
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() =>
                          addProcessFlowItem(
                            currentModalProcess.id,
                            "output_items",
                          )
                        }
                        className="btn btn-secondary w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5 border-dashed"
                      >
                        <Plus size={14} /> Add Output Item
                      </button>
                    </div>
                  );
                })()}

              {/* BY-PRODUCTS FORM */}
              {modalState.type === "byproducts" &&
                (() => {
                  const list = currentModalProcess.by_products || [];
                  const totalQty = list.reduce(
                    (acc, curr) => acc + (parseFloat(curr.expected_qty) || 0),
                    0,
                  );
                  const totalRecoveryValue = list.reduce(
                    (acc, curr) => acc + (parseFloat(curr.recovery_value) || 0),
                    0,
                  );
                  const totalByProductValue = totalQty * totalRecoveryValue;

                  return (
                    <div className="space-y-4">
                      <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-center justify-between text-xs font-bold border border-slate-200 dark:border-slate-600">
                        <span className="text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          By-Product Value:
                        </span>
                        <span className="text-slate-900 dark:text-white text-sm font-mono">
                          {totalByProductValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      {list.map((by, i) => (
                        <div
                          key={i}
                          className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3"
                        >
                          <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700 pb-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                              By-Product Item #{i + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                removeProcessFlowItem(
                                  currentModalProcess.id,
                                  "by_products",
                                  i,
                                )
                              }
                              className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1"
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                By-Product / Waste Name *
                              </label>
                              <input
                                type="text"
                                value={by.item_name || ""}
                                onChange={(e) =>
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "by_products",
                                    i,
                                    "item_name",
                                    e.target.value,
                                  )
                                }
                                placeholder="e.g. cheetos"
                                className="input w-full text-xs font-semibold"
                                list={`bom-inv-items-byproducts-${i}`}
                              />
                              <datalist id={`bom-inv-items-byproducts-${i}`}>
                                {items.map((it) => (
                                  <option key={it.id} value={it.item_name || it.name}>
                                    {it.item_code ? `${it.item_code} - ` : ""}[
                                    {it.item_type || "Item"}]{" "}
                                    {(it.purchase_price || it.unit_cost || it.valuation_rate || it.cost_price)
                                      ? `(${baseCurrency.symbol}${it.purchase_price || it.unit_cost || it.valuation_rate || it.cost_price})`
                                      : ""}
                                  </option>
                                ))}
                              </datalist>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Expected Qty *
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={
                                  by.expected_qty === 0 ||
                                  by.expected_qty === "0"
                                    ? ""
                                    : (by.expected_qty ?? "")
                                }
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? ""
                                      : parseFloat(e.target.value);
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "by_products",
                                    i,
                                    "expected_qty",
                                    isNaN(val) ? "" : val,
                                  );
                                }}
                                placeholder="e.g. 1"
                                className="input w-full text-xs font-bold text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                UOM
                              </label>
                              <input
                                type="text"
                                value={by.uom || "Kg"}
                                onChange={(e) =>
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "by_products",
                                    i,
                                    "uom",
                                    e.target.value,
                                  )
                                }
                                className="input w-full text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Expected Cost
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={by.expected_cost ?? ""}
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? ""
                                      : parseFloat(e.target.value);
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "by_products",
                                    i,
                                    "expected_cost",
                                    isNaN(val) ? "" : val,
                                  );
                                }}
                                placeholder="e.g. 2.50"
                                className="input w-full text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Scrap Recovery Value
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={by.recovery_value ?? ""}
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? ""
                                      : parseFloat(e.target.value);
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "by_products",
                                    i,
                                    "recovery_value",
                                    isNaN(val) ? "" : val,
                                  );
                                }}
                                placeholder="e.g. 5.00"
                                className="input w-full text-xs font-semibold"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          addProcessFlowItem(
                            currentModalProcess.id,
                            "by_products",
                          )
                        }
                        className="btn btn-secondary w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5 border-dashed"
                      >
                        <Plus size={14} /> Add By-Product / Waste Item
                      </button>
                    </div>
                  );
                })()}

              {/* OVERHEADS FORM */}
              {modalState.type === "overheads" &&
                (() => {
                  const list = currentModalProcess.overheads || [];
                  const totalOverheadValue = list.reduce((acc, curr) => {
                    const q = parseFloat(curr.qty) || 1;
                    const r = parseFloat(curr.cost_rate) || 0;
                    return acc + q * r;
                  }, 0);

                  return (
                    <div className="space-y-4">
                      <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-center justify-between text-xs font-bold border border-slate-200 dark:border-slate-600">
                        <span className="text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Overhead Value:
                        </span>
                        <span className="text-slate-900 dark:text-white text-sm font-mono">
                          {totalOverheadValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      {list.map((ov, i) => (
                        <div
                          key={i}
                          className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3"
                        >
                          <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700 pb-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                              Overhead Item #{i + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                removeProcessFlowItem(
                                  currentModalProcess.id,
                                  "overheads",
                                  i,
                                )
                              }
                              className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1"
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Overhead Item Name *
                              </label>
                              <input
                                type="text"
                                value={ov.overhead_name || ""}
                                onChange={(e) =>
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "overheads",
                                    i,
                                    "overhead_name",
                                    e.target.value,
                                  )
                                }
                                placeholder="Select or type overhead..."
                                className="input w-full text-xs font-semibold"
                                list={`bom-setup-overheads-list-${i}`}
                              />
                              <datalist id={`bom-setup-overheads-list-${i}`}>
                                {setupOverheads.map((o) => (
                                  <option key={o.id} value={o.overhead_name}>
                                    {o.code ? `${o.code} - ` : ""}[
                                    {o.allocation_basis}]{" "}
                                    {o.default_cost_rate
                                      ? `(${baseCurrency.symbol}${o.default_cost_rate})`
                                      : ""}
                                  </option>
                                ))}
                              </datalist>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Quantity *
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={
                                  ov.qty === 0 || ov.qty === "0"
                                    ? ""
                                    : (ov.qty ?? "")
                                }
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? ""
                                      : parseFloat(e.target.value);
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "overheads",
                                    i,
                                    "qty",
                                    isNaN(val) ? "" : val,
                                  );
                                }}
                                placeholder="e.g. 1"
                                className="input w-full text-xs font-bold text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Cost Rate *
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={
                                  ov.cost_rate === 0 || ov.cost_rate === "0"
                                    ? ""
                                    : (ov.cost_rate ?? "")
                                }
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? ""
                                      : parseFloat(e.target.value);
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "overheads",
                                    i,
                                    "cost_rate",
                                    isNaN(val) ? "" : val,
                                  );
                                }}
                                placeholder="e.g. 10.00"
                                className="input w-full text-xs font-bold text-slate-900 dark:text-white"
                              />
                            </div>
                            <div className="sm:col-span-4">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                                Allocation Basis
                              </label>
                              <input
                                type="text"
                                value={ov.allocation_basis || "per Hour"}
                                onChange={(e) =>
                                  updateProcessFlowField(
                                    currentModalProcess.id,
                                    "overheads",
                                    i,
                                    "allocation_basis",
                                    e.target.value,
                                  )
                                }
                                className="input w-full text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          addProcessFlowItem(
                            currentModalProcess.id,
                            "overheads",
                          )
                        }
                        className="btn btn-secondary w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5 border-dashed"
                      >
                        <Plus size={14} /> Add Overhead Item
                      </button>
                    </div>
                  );
                })()}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700 gap-3">
              <button
                type="button"
                onClick={() => setModalState(null)}
                className="btn btn-primary text-xs px-6 py-2 font-bold"
              >
                Done & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
