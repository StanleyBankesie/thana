/**
 * @fileoverview JobCardExecution component.
 * Unified Job Card Execution, Real-time Stopwatch, Quality Check & Finished Goods Output Registration Page.
 */

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Save, 
  Loader2,
  Cpu,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  Timer,
  User,
  Box,
  Plus,
  Trash2,
  Edit2,
  X,
  DollarSign,
  Calculator,
  RefreshCw,
  Layers,
  PackageCheck,
  Building
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

const safeIsoDate = (val, fallback = "") => {
  if (!val) return fallback;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? fallback : d.toISOString().split('T')[0];
  } catch {
    return fallback;
  }
};

export default function JobCardExecution() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isViewOnly = searchParams.get("mode") === "view";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("consumption");

  const [machines, setMachines] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [operators, setOperators] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [jobDetails, setJobDetails] = useState({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [formData, setFormData] = useState({
    job_card_no: "",
    job_card_date: safeIsoDate(new Date(), ""),
    warehouse_id: "",
    batch_no: "",
    mfg_date: safeIsoDate(new Date(), ""),
    expiry_date: "",
    quality_status: "PASSED",
    machine_id: "",
    machine_ids: [],
    shift_id: "",
    operator_id: "",
    operator_name: "",
    good_qty: "",
    rejected_qty: "",
    scrap_qty: "",
    defect_reason: "",
    total_overhead: 0,
    total_consumption: 0,
    total_production_cost: 0,
    status: "PENDING",
    start_time: null,
    end_time: null
  });

  const [currencySymbol, setCurrencySymbol] = useState("GH₵");
  const [consumptionList, setConsumptionList] = useState([]);
  const [overheadList, setOverheadList] = useState([]);
  const [byProductsList, setByProductsList] = useState([]);
  const [breakdownList, setBreakdownList] = useState([]);
  const [editRowModal, setEditRowModal] = useState(null);
  const [autoCreateQc, setAutoCreateQc] = useState(false);
  const [productionWarehouses, setProductionWarehouses] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [macRes, shiftRes, usersRes, opRes, whRes, jcRes, currRes, finCurrRes, prodWhRes] = await Promise.all([
          api.get("/production/setup/machines").catch(() => ({ data: { items: [] } })),
          api.get("/production/setup/shifts").catch(() => ({ data: { items: [] } })),
          api.get("/admin/users").catch(() => ({ data: { items: [] } })),
          api.get("/production/setup/operators").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/warehouses").catch(() => ({ data: { items: [] } })),
          api.get(`/production/execution/job-cards/${id}`).catch(() => ({ data: {} })),
          api.get("/currencies").catch(() => ({ data: { items: [] } })),
          api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
          api.get("/production/setup/warehouses").catch(() => ({ data: { items: [] } }))
        ]);

        const jc = jcRes.data || {};
        setJobDetails(jc);
        setProductionWarehouses(prodWhRes.data?.items || []);

        const curList = [
          ...(Array.isArray(finCurrRes.data?.items) ? finCurrRes.data.items : (Array.isArray(finCurrRes.data) ? finCurrRes.data : [])),
          ...(Array.isArray(currRes.data?.items) ? currRes.data.items : (Array.isArray(currRes.data) ? currRes.data : []))
        ];
        const baseCurr = curList.find((c) => Number(c.is_base) === 1 || c.is_base === true || Number(c.is_base_currency) === 1);
        if (baseCurr) {
          setCurrencySymbol(baseCurr.symbol || baseCurr.code || "GH₵");
        } else if (jc.base_currency_symbol) {
          setCurrencySymbol(jc.base_currency_symbol);
        }

        let linkedMachines = Array.isArray(jc.linked_machines) && jc.linked_machines.length > 0
          ? jc.linked_machines 
          : [];

        if (linkedMachines.length === 0 && jc.plan_processes) {
          try {
            const pProcs = typeof jc.plan_processes === 'string' ? JSON.parse(jc.plan_processes) : jc.plan_processes;
            if (Array.isArray(pProcs) && pProcs.length > 0) {
              const planMacs = [];
              pProcs.forEach((p, idx) => {
                const mName = p.machine_name || (Array.isArray(p.machines) && p.machines[0] ? (typeof p.machines[0] === 'object' ? p.machines[0].machine_name : p.machines[0]) : "");
                if (mName && !planMacs.some(m => (m.machine_name || '').toLowerCase().trim() === mName.toLowerCase().trim())) {
                  planMacs.push({
                    id: p.machine_id || `plan-mac-${idx + 1}`,
                    machine_name: mName,
                    machine_code: `MAC-0${idx + 1}`
                  });
                }
              });
              if (planMacs.length > 0) {
                linkedMachines = planMacs;
              }
            }
          } catch {}
        }

        const hasPlan = !!(jc.plan_id || jc.plan_no || (jc.plan_processes && jc.plan_processes.length > 0));
        if (linkedMachines.length === 0 && !hasPlan) {
          const allSetupMacs = macRes.data?.items || [];
          if (allSetupMacs.length > 0) {
            linkedMachines = allSetupMacs;
          }
        }

        let linkedShifts = Array.isArray(jc.linked_shifts) && jc.linked_shifts.length > 0
          ? jc.linked_shifts 
          : [];

        if (linkedShifts.length === 0 && jc.plan_processes) {
          try {
            const pProcs = typeof jc.plan_processes === 'string' ? JSON.parse(jc.plan_processes) : jc.plan_processes;
            if (Array.isArray(pProcs) && pProcs.length > 0) {
              const planShifts = [];
              pProcs.forEach((p, idx) => {
                const sName = p.shift_name || (Array.isArray(p.shifts) && p.shifts[0] ? (typeof p.shifts[0] === 'object' ? p.shifts[0].shift_name : p.shifts[0]) : "");
                if (sName && !planShifts.some(s => (s.shift_name || '').toLowerCase().trim() === sName.toLowerCase().trim())) {
                  planShifts.push({
                    id: p.shift_id || `plan-shift-${idx + 1}`,
                    shift_name: sName
                  });
                }
              });
              if (planShifts.length > 0) {
                linkedShifts = planShifts;
              }
            }
          } catch {}
        }

        if (linkedShifts.length === 0 && !hasPlan) {
          const allSetupShifts = shiftRes.data?.items || [];
          if (allSetupShifts.length > 0) {
            linkedShifts = allSetupShifts;
          }
        }

        setMachines(linkedMachines);
        setShifts(linkedShifts);

        const setupOperators = opRes.data?.items || [];
        const adminUsers = Array.isArray(usersRes.data?.items) ? usersRes.data.items : (Array.isArray(usersRes.data) ? usersRes.data : []);

        const combinedOperators = [
          ...setupOperators.map(o => ({
            id: String(o.id),
            name: o.operator_name + (o.employee_code ? ` (${o.employee_code})` : ""),
            rawName: o.operator_name,
            machine_id: o.machine_id
          })),
          ...adminUsers.map(u => ({
            id: `usr-${u.id}`,
            name: u.full_name || u.username,
            rawName: u.full_name || u.username
          }))
        ];

        setOperators(combinedOperators);

        const whList = whRes.data?.items || [];
        setWarehouses(whList);

        const validLinkedIds = linkedMachines.map(m => String(m.id || m.machine_id || m.machine_name));
        let initialMachineIds = [];
        
        if (Array.isArray(jc.machine_ids) && jc.machine_ids.length > 0) {
          const matched = jc.machine_ids.map(String).filter(mid => validLinkedIds.includes(mid));
          if (matched.length > 0) initialMachineIds = matched;
        }
        
        if (initialMachineIds.length === 0 && jc.machine_id && validLinkedIds.includes(String(jc.machine_id))) {
          initialMachineIds = [String(jc.machine_id)];
        }
        
        if (initialMachineIds.length === 0 && linkedMachines.length > 0) {
          initialMachineIds = [String(linkedMachines[0].id || linkedMachines[0].machine_id || linkedMachines[0].machine_name)];
        }

        const validShiftIds = linkedShifts.map(s => String(s.id || s.shift_id || s.shift_name));
        let initialShiftId = "";
        if (jc.shift_id && validShiftIds.includes(String(jc.shift_id))) {
          initialShiftId = String(jc.shift_id);
        } else if (jc.route_shift_id && validShiftIds.includes(String(jc.route_shift_id))) {
          initialShiftId = String(jc.route_shift_id);
        } else if (jc.plan_shift_id && validShiftIds.includes(String(jc.plan_shift_id))) {
          initialShiftId = String(jc.plan_shift_id);
        } else if (linkedShifts.length > 0) {
          initialShiftId = String(linkedShifts[0].id || linkedShifts[0].shift_id || linkedShifts[0].shift_name);
        }

        setFormData({
          job_card_no: jc.job_card_no || `JC-${String(id || '').padStart(5, '0')}`,
          job_card_date: safeIsoDate(jc.job_card_date, safeIsoDate(new Date(), "")),
          batch_no: jc.batch_no || jc.batch_number || "",
          mfg_date: safeIsoDate(jc.mfg_date || jc.manufacture_date, safeIsoDate(new Date(), "")),
          expiry_date: safeIsoDate(jc.expiry_date, ""),
          machine_id: jc.machine_id || initialMachineIds[0] || jc.plan_machine_id || (linkedMachines[0]?.id || ""),
          machine_ids: (jc.machine_id && [String(jc.machine_id)]) || initialMachineIds,
          shift_id: jc.shift_id || initialShiftId || jc.route_shift_id || jc.plan_shift_id || "",
          operator_id: jc.operator_id ? String(jc.operator_id) : "",
          operator_name: jc.operator_name || jc.operator_user_name || "",
          good_qty: (jc.good_qty !== undefined && jc.good_qty !== null && jc.good_qty !== "") ? String(jc.good_qty) : "",
          rejected_qty: (jc.rejected_qty !== undefined && jc.rejected_qty !== null && jc.rejected_qty !== "") ? String(jc.rejected_qty) : "",
          scrap_qty: (jc.scrap_qty !== undefined && jc.scrap_qty !== null && jc.scrap_qty !== "") ? String(jc.scrap_qty) : "",
          defect_reason: jc.defect_reason || "",
          total_overhead: Number(jc.total_overhead || 0),
          total_consumption: Number(jc.total_consumption || 0),
          total_production_cost: Number(jc.total_production_cost || 0),
          status: jc.status || "PENDING",
          start_time: jc.start_time || null,
          end_time: jc.end_time || null
        });

        // 1. Consumption list
        let rawInputs = [];
        if (Array.isArray(jc.consumption_details) && jc.consumption_details.length > 0) {
          rawInputs = jc.consumption_details;
        } else if (Array.isArray(jc.inputs) && jc.inputs.length > 0) {
          rawInputs = jc.inputs;
        }
        const finalInputs = rawInputs.map(i => {
          const actQ = Number(i.actual_qty !== undefined && i.actual_qty !== null ? i.actual_qty : (i.qty || 1));
          const uCost = Number(i.unit_cost || 0);
          const tCost = Number(i.total_cost !== undefined && i.total_cost !== null && !isNaN(Number(i.total_cost)) && Number(i.total_cost) > 0 ? i.total_cost : (actQ * uCost));
          return {
            ...i,
            unit_cost: uCost,
            actual_qty: actQ,
            total_cost: tCost
          };
        });
        setConsumptionList(finalInputs);

        // 2. Overhead list
        let rawOverheads = [];
        if (Array.isArray(jc.overhead_details) && jc.overhead_details.length > 0) {
          rawOverheads = jc.overhead_details;
        } else if (Array.isArray(jc.overheads) && jc.overheads.length > 0) {
          rawOverheads = jc.overheads;
        }
        const finalOverheads = rawOverheads.map(o => {
          const q = Number(o.qty !== undefined && o.qty !== null ? o.qty : (o.base_qty || 1));
          const r = Number(o.rate || o.cost_rate || 0);
          const a = Number(o.amount !== undefined && o.amount !== null && !isNaN(Number(o.amount)) && Number(o.amount) > 0 ? o.amount : (q * r));
          return {
            ...o,
            overhead_type: o.overhead_type || o.overhead_name || "Operational Overhead",
            allocation_basis: o.allocation_basis || "per Hour",
            qty: q,
            rate: r,
            amount: a
          };
        });
        setOverheadList(finalOverheads);

        // 3. By-Products list
        let rawByProducts = [];
        if (Array.isArray(jc.by_products_details) && jc.by_products_details.length > 0) {
          rawByProducts = jc.by_products_details;
        } else if (Array.isArray(jc.by_products) && jc.by_products.length > 0) {
          rawByProducts = jc.by_products;
        }
        setByProductsList(rawByProducts);

        // 4. Breakdown list
        let rawBreakdowns = [];
        if (Array.isArray(jc.breakdown_details) && jc.breakdown_details.length > 0) {
          rawBreakdowns = jc.breakdown_details;
        } else if (Array.isArray(jc.breakdowns) && jc.breakdowns.length > 0) {
          rawBreakdowns = jc.breakdowns;
        }
        setBreakdownList(rawBreakdowns);

        const initTotalCons = finalInputs.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);
        const initTotalOvh = finalOverheads.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        setFormData(prev => ({
          ...prev,
          total_consumption: initTotalCons,
          total_overhead: initTotalOvh,
          total_production_cost: initTotalCons + initTotalOvh
        }));

      } catch (error) {
        toast.error("Failed to load job execution details");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Live Timer Stopwatch Effect
  useEffect(() => {
    let interval = null;
    const startTimeStr = formData.start_time || jobDetails?.start_time;
    const endTimeStr = formData.end_time || jobDetails?.end_time;

    if (formData.status === 'IN_PROGRESS' && startTimeStr) {
      const startTimeMs = new Date(startTimeStr).getTime();
      const updateTimer = () => {
        const now = Date.now();
        const diffSecs = Math.max(0, Math.floor((now - startTimeMs) / 1000));
        setElapsedSeconds(diffSecs);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else if (startTimeStr && endTimeStr) {
      const startMs = new Date(startTimeStr).getTime();
      const endMs = new Date(endTimeStr).getTime();
      const diff = Math.max(0, Math.floor((endMs - startMs) / 1000));
      setElapsedSeconds(!isNaN(diff) ? diff : 0);
    } else if (formData.status === 'COMPLETED') {
      const planMins = Number(jobDetails?.total_time_mins || 0);
      setElapsedSeconds(planMins > 0 ? planMins * 60 : 0);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [formData.status, formData.start_time, formData.end_time, jobDetails?.start_time, jobDetails?.end_time, jobDetails?.total_time_mins]);

  const formatTimer = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const calculateCosts = () => {
    const totalCons = consumptionList.reduce((sum, item) => sum + (Number(item.total_cost || item.qty * (item.unit_cost || 0)) || 0), 0);
    const totalOvhd = overheadList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalProdCost = totalCons + totalOvhd;

    setFormData(prev => ({
      ...prev,
      total_consumption: totalCons,
      total_overhead: totalOvhd,
      total_production_cost: totalProdCost
    }));
    toast.info("Production costs recalculated");
  };

  const handleSaveModal = (e) => {
    if (e) e.preventDefault();
    if (!editRowModal) return;

    const { type, index, data } = editRowModal;

    if (type === "consumption") {
      const updated = [...consumptionList];
      const actualQty = Number(data.actual_qty !== "" && data.actual_qty !== undefined ? data.actual_qty : (data.qty || 1));
      const unitCost = Number(data.unit_cost || 0);
      const row = {
        ...data,
        item_name: data.item_name || "Raw Material",
        item_code: data.item_code || "",
        qty: Number(data.qty || 1),
        actual_qty: actualQty,
        uom: data.uom || "Pcs",
        unit_cost: unitCost,
        total_cost: Number((actualQty * unitCost).toFixed(2))
      };
      if (index >= 0 && index < updated.length) {
        updated[index] = row;
      } else {
        updated.push(row);
      }
      setConsumptionList(updated);
      
      const totCons = updated.reduce((s, i) => s + (Number(i.total_cost) || 0), 0);
      const totOvh = overheadList.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      setFormData(prev => ({
        ...prev,
        total_consumption: totCons,
        total_production_cost: totCons + totOvh
      }));
    } else if (type === "overhead") {
      const updated = [...overheadList];
      const qty = Number(data.qty !== "" && data.qty !== undefined ? data.qty : 1);
      const rate = Number(data.rate || 0);
      const row = {
        ...data,
        overhead_type: data.overhead_type || "Operational Overhead",
        allocation_basis: data.allocation_basis || "per Hour",
        qty: qty,
        rate: rate,
        amount: Number((qty * rate).toFixed(2))
      };
      if (index >= 0 && index < updated.length) {
        updated[index] = row;
      } else {
        updated.push(row);
      }
      setOverheadList(updated);

      const totCons = consumptionList.reduce((s, i) => s + (Number(i.total_cost) || 0), 0);
      const totOvh = updated.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      setFormData(prev => ({
        ...prev,
        total_overhead: totOvh,
        total_production_cost: totCons + totOvh
      }));
    } else if (type === "byproduct") {
      const updated = [...byProductsList];
      const row = {
        ...data,
        item_name: data.item_name || "Secondary Output",
        item_code: data.item_code || "",
        qty: Number(data.qty || 0),
        uom: data.uom || "Kg"
      };
      if (index >= 0 && index < updated.length) {
        updated[index] = row;
      } else {
        updated.push(row);
      }
      setByProductsList(updated);
    } else if (type === "breakdown") {
      const updated = [...breakdownList];
      const row = {
        ...data,
        machine_name: data.machine_name || "Machine",
        downtime_hrs: Number(data.downtime_hrs || 0),
        reason: data.reason || ""
      };
      if (index >= 0 && index < updated.length) {
        updated[index] = row;
      } else {
        updated.push(row);
      }
      setBreakdownList(updated);
    }

    setEditRowModal(null);
    toast.success("Line details saved successfully");
  };

  const deleteConsumptionRow = (idx) => {
    const updated = consumptionList.filter((_, i) => i !== idx);
    setConsumptionList(updated);
    const totCons = updated.reduce((s, i) => s + (Number(i.total_cost) || 0), 0);
    const totOvh = overheadList.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    setFormData(prev => ({
      ...prev,
      total_consumption: totCons,
      total_production_cost: totCons + totOvh
    }));
    toast.info("Item removed from recipe");
  };

  const deleteOverheadRow = (idx) => {
    const updated = overheadList.filter((_, i) => i !== idx);
    setOverheadList(updated);
    const totCons = consumptionList.reduce((s, i) => s + (Number(i.total_cost) || 0), 0);
    const totOvh = updated.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    setFormData(prev => ({
      ...prev,
      total_overhead: totOvh,
      total_production_cost: totCons + totOvh
    }));
    toast.info("Overhead line removed");
  };

  const deleteByProductRow = (idx) => {
    setByProductsList(byProductsList.filter((_, i) => i !== idx));
    toast.info("By-product line removed");
  };

  const deleteBreakdownRow = (idx) => {
    setBreakdownList(breakdownList.filter((_, i) => i !== idx));
    toast.info("Downtime log removed");
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const goodQtyNum = parseFloat(formData.good_qty) || 0;
      const rejectedQtyNum = parseFloat(formData.rejected_qty) || 0;
      const scrapQtyNum = parseFloat(formData.scrap_qty) || 0;
      const totCons = consumptionList.reduce((s, i) => s + (Number(i.total_cost) || 0), 0);
      const totOvh = overheadList.reduce((s, i) => s + (Number(i.amount) || 0), 0);

      const payload = {
        ...formData,
        good_qty: goodQtyNum,
        rejected_qty: rejectedQtyNum,
        scrap_qty: scrapQtyNum,
        total_consumption: totCons,
        total_overhead: totOvh,
        total_production_cost: totCons + totOvh,
        consumption_details: consumptionList,
        overhead_details: overheadList,
        by_products_details: byProductsList,
        breakdown_details: breakdownList
      };
      await api.put(`/production/execution/job-cards/${id}`, payload);

      // If completing output, post inventory stock journal entry
      if (goodQtyNum > 0 && formData.status === 'COMPLETED') {
        await api.post("/production/inventory/stock-journal", {
          plan_id: jobDetails?.plan_id || null,
          journal_date: formData.job_card_date,
          remarks: `Finished Goods Output for Job Card #${formData.job_card_no} (${jobDetails?.item_name || 'Produced Product'}). Batch: ${formData.batch_no}`,
          items: [
            {
              item_id: jobDetails?.item_id || 1,
              type: "IN",
              qty: goodQtyNum,
              uom: productUom
            }
          ]
        }).catch(() => {});
      }

      // If auto-create Quality Control is enabled and completed, generate QC Inspection record
      if (autoCreateQc && formData.status === 'COMPLETED') {
        const fgWh = (productionWarehouses || []).find(w => 
          (w.warehouse_name || '').toLowerCase().includes('finished') || 
          (w.code || '').toLowerCase().includes('fg')
        ) || productionWarehouses[0];

        await api.post("/production/qc/inspections", {
          job_card_id: id,
          inspection_date: formData.job_card_date || new Date().toISOString().split("T")[0],
          warehouse_id: fgWh?.id || null,
          batch_no: formData.batch_no || null,
          mfg_date: formData.mfg_date || null,
          expiry_date: formData.expiry_date || null,
          planned_qty: Number(jobDetails?.planned_qty || 0),
          inspected_qty: goodQtyNum + rejectedQtyNum,
          good_qty: goodQtyNum,
          rejected_qty: rejectedQtyNum,
          quality_score: 100,
          quality_status: "PASSED",
          remarks: `Auto-generated QC Passed on Job Card Execution #${formData.job_card_no || id} (${jobDetails?.item_name || 'Produced Product'})`
        }).catch(() => {});
      }

      toast.success("Job Execution & Production Output saved successfully!");
      navigate("/production/execution/job-cards");
    } catch {
      toast.error("Failed to update execution & output record");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (newStatus) => {
    const nowIso = new Date().toISOString();
    const update = { ...formData, status: newStatus };
    if (newStatus === 'IN_PROGRESS' && !formData.start_time) {
      update.start_time = nowIso;
    }
    if (newStatus === 'COMPLETED') {
      update.end_time = nowIso;
      if (!update.good_qty || Number(update.good_qty) === 0) {
        update.good_qty = Number(jobDetails?.planned_qty || 0);
      }
    }
    setFormData(update);
    saveJobCard(update);
  };

  const saveJobCard = async (updatedData) => {
    const active = updatedData || formData;
    const goodQtyNum = parseFloat(active.good_qty) || 0;
    const rejectedQtyNum = parseFloat(active.rejected_qty) || 0;
    const scrapQtyNum = parseFloat(active.scrap_qty) || 0;
    const totCons = consumptionList.reduce((s, i) => s + (Number(i.total_cost) || 0), 0);
    const totOvh = overheadList.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const payload = {
      ...active,
      good_qty: goodQtyNum,
      rejected_qty: rejectedQtyNum,
      scrap_qty: scrapQtyNum,
      total_consumption: totCons,
      total_overhead: totOvh,
      total_production_cost: totCons + totOvh,
      consumption_details: consumptionList,
      overhead_details: overheadList,
      by_products_details: byProductsList,
      breakdown_details: breakdownList
    };
    setSaving(true);
    try {
      await api.put(`/production/execution/job-cards/${id}`, payload);
      
      // If completing output, post inventory stock journal entry
      if (goodQtyNum > 0 && payload.status === 'COMPLETED') {
        await api.post("/production/inventory/stock-journal", {
          plan_id: jobDetails?.plan_id || null,
          journal_date: payload.job_card_date,
          remarks: `Finished Goods Output for Job Card #${payload.job_card_no} (${jobDetails?.item_name || 'Produced Product'}). Batch: ${payload.batch_no}`,
          items: [
            {
              item_id: jobDetails?.item_id || 1,
              type: "IN",
              qty: goodQtyNum,
              uom: productUom
            }
          ]
        }).catch(() => {});
      }

      // If auto-create Quality Control is enabled and completed, generate QC Inspection record
      if (autoCreateQc && payload.status === 'COMPLETED') {
        const fgWh = (productionWarehouses || []).find(w => 
          (w.warehouse_name || '').toLowerCase().includes('finished') || 
          (w.code || '').toLowerCase().includes('fg')
        ) || productionWarehouses[0];

        await api.post("/production/qc/inspections", {
          job_card_id: id,
          inspection_date: payload.job_card_date || new Date().toISOString().split("T")[0],
          warehouse_id: fgWh?.id || null,
          batch_no: payload.batch_no || null,
          mfg_date: payload.mfg_date || null,
          expiry_date: payload.expiry_date || null,
          planned_qty: Number(jobDetails?.planned_qty || 0),
          inspected_qty: goodQtyNum + rejectedQtyNum,
          good_qty: goodQtyNum,
          rejected_qty: rejectedQtyNum,
          quality_score: 100,
          quality_status: "PASSED",
          remarks: `Auto-generated QC Passed on Job Card Execution #${payload.job_card_no || id} (${jobDetails?.item_name || 'Produced Product'})`
        }).catch(() => {});
      }

      toast.success("Job status & output updated");
      if (payload.status === 'COMPLETED') {
        navigate("/production/execution/job-cards");
      }
    } catch {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-400 text-xl">Loading Execution & Output Environment...</div>;

  const plannedQty = Number(jobDetails?.planned_qty || 1);
  const productUom = jobDetails?.uom || jobDetails?.item_uom || "Pcs";
  const completionPct = Math.min(100, Math.round(((parseFloat(formData.good_qty) || 0) / plannedQty) * 100));

  const totalConsumption = consumptionList.reduce((sum, item) => {
    const q = Number(item.actual_qty !== undefined && item.actual_qty !== null && item.actual_qty !== "" ? item.actual_qty : (item.qty || 1));
    const u = Number(item.unit_cost || 0);
    return sum + (Number(item.total_cost) || (q * u));
  }, 0);

  const totalOverhead = overheadList.reduce((sum, item) => {
    const q = Number(item.qty !== undefined && item.qty !== null && item.qty !== "" ? item.qty : 1);
    const r = Number(item.rate || 0);
    return sum + (Number(item.amount) || (q * r));
  }, 0);

  const totalProductionCost = totalConsumption + totalOverhead;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/production/execution/job-cards" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Job Card Execution & Production Output</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                formData.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                formData.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                {formData.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Plan: <strong className="text-brand-600 font-mono">{jobDetails?.plan_no || "Daily Plan"}</strong> | Process Operation: <strong className="text-slate-800 dark:text-slate-200">{jobDetails?.process_name || jobDetails?.item_name || "Manufacturing Step"}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isViewOnly && (
            <button 
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Confirm Output & Save
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Execution & Output Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Target & Quick Execution Card */}
          <div className="card p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{jobDetails?.item_name || "Produced Product"}</h2>
                <p className="text-xs font-mono text-slate-400">{jobDetails?.item_code ? `Code: ${jobDetails.item_code}` : ""}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Planned Target Output</span>
                <span className="text-2xl font-black text-brand-600 dark:text-brand-400">{Number(jobDetails?.planned_qty || jobDetails?.plan_quantity || 1)} {productUom}</span>
              </div>
            </div>

            {!isViewOnly && (
              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button" 
                  onClick={() => handleStatusChange('IN_PROGRESS')}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                    formData.status === 'IN_PROGRESS' 
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 shadow-sm' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/60 text-amber-700 rounded-xl">
                    <Timer size={24} />
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-sm block">Start Machine Run</span>
                    <span className="text-xs opacity-75">Begin machine cycle</span>
                  </div>
                </button>

                <button 
                  type="button" 
                  onClick={() => handleStatusChange('COMPLETED')}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                    formData.status === 'COMPLETED' 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-sm' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 rounded-xl">
                    <PackageCheck size={24} />
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-sm block">Complete & Post Output</span>
                    <span className="text-xs opacity-75">Post finished goods to stock</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Work Center, Allocation & Warehouse Parameters */}
          <div className="card p-6 space-y-6">
            <h3 className="font-bold text-slate-900 dark:text-white text-base border-b border-slate-100 dark:border-slate-700/60 pb-3 flex items-center gap-2">
              <Cpu size={18} className="text-brand-600" /> Work Center, Allocation & Stock Warehouse
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Assigned Machines (Process Line / Work Centers)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 min-h-[42px] items-center">
                  {machines.length > 0 ? (
                    machines.map((m, idx) => {
                      const macId = typeof m === 'object' ? String(m.id || m.machine_id || m.machine_name || `mac-${idx}`) : String(m);
                      const macName = typeof m === 'object' ? (m.machine_name || m.name || 'Machine') : String(m);
                      const isSelected = (formData.machine_ids || []).map(String).includes(macId);
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={isViewOnly}
                          onClick={() => {
                            const current = (formData.machine_ids || []).map(String);
                            const updated = isSelected 
                              ? current.filter(id => id !== macId)
                              : [...current, macId];
                            setFormData({ 
                              ...formData, 
                              machine_ids: updated,
                              machine_id: updated[0] || ""
                            });
                          }}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-brand-600 text-white border-brand-700 shadow-xs"
                              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <Cpu size={13} /> {macName}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-400 font-medium px-2">No machines configured in setup</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Work Shift
                  </label>
                  <select 
                    disabled={isViewOnly}
                    className="input w-full font-bold"
                    value={formData.shift_id}
                    onChange={e => setFormData({ ...formData, shift_id: e.target.value })}
                  >
                    <option value="">Select Shift...</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.shift_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Machine Operator
                  </label>
                  <select 
                    disabled={isViewOnly}
                    className="input w-full font-bold"
                    value={formData.operator_id}
                    onChange={e => {
                      const op = operators.find(o => String(o.id) === String(e.target.value));
                      setFormData({ 
                        ...formData, 
                        operator_id: e.target.value,
                        operator_name: op ? (op.rawName || op.name) : ""
                      });
                    }}
                  >
                    <option value="">Select Operator...</option>
                    {operators.map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.rawName}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Batch Lot & Date Tracking (MFG & EXP Date) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Batch / Lot No
                </label>
                <input
                  type="text"
                  readOnly={isViewOnly}
                  className="input w-full font-mono font-bold text-xs"
                  value={formData.batch_no}
                  onChange={e => setFormData({ ...formData, batch_no: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Manufacture Date (MFG Date)
                </label>
                <input
                  type="date"
                  required
                  readOnly={isViewOnly}
                  className="input w-full font-medium text-xs"
                  value={formData.mfg_date}
                  onChange={e => setFormData({ ...formData, mfg_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Expiry Date (EXP Date)
                </label>
                <input
                  type="date"
                  readOnly={isViewOnly}
                  className="input w-full font-medium text-xs"
                  value={formData.expiry_date}
                  onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
                />
              </div>
            </div>

            {/* Output Quantity & Scrap Input */}
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Good Produced Output Quantity *</span>
                    <span className="text-xs font-bold text-emerald-600/75 dark:text-emerald-400/75 font-mono">({productUom})</span>
                  </label>
                  <div className="relative flex items-center">
                    <input 
                      type="number" 
                      step="0.01"
                      readOnly={isViewOnly}
                      placeholder="0.00"
                      className="input w-full font-black text-xl text-emerald-600 dark:text-emerald-400 pr-16"
                      value={formData.good_qty ?? ""}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                          setFormData({ ...formData, good_qty: val });
                        }
                      }}
                    />
                    <span className="absolute right-3 text-xs font-black font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg pointer-events-none">
                      {productUom}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Scrap / Rejected Quantity</span>
                    <span className="text-xs font-bold text-rose-600/75 dark:text-rose-400/75 font-mono">({productUom})</span>
                  </label>
                  <div className="relative flex items-center">
                    <input 
                      type="number" 
                      step="0.01"
                      readOnly={isViewOnly}
                      placeholder="0.00"
                      className="input w-full font-black text-xl text-rose-600 dark:text-rose-400 pr-16"
                      value={formData.rejected_qty ?? ""}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                          setFormData({ ...formData, rejected_qty: val });
                        }
                      }}
                    />
                    <span className="absolute right-3 text-xs font-black font-mono text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 px-2.5 py-1 rounded-lg pointer-events-none">
                      {productUom}
                    </span>
                  </div>
                </div>

                {/* Auto-create Quality Control Checkbox */}
                <div className="sm:col-span-2 pt-2">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-brand-200 dark:border-brand-900/60 bg-brand-50/60 dark:bg-brand-950/30 cursor-pointer select-none transition-colors hover:bg-brand-50 dark:hover:bg-brand-950/50">
                    <input 
                      type="checkbox" 
                      id="auto_create_qc_checkbox"
                      checked={autoCreateQc}
                      onChange={(e) => setAutoCreateQc(e.target.checked)}
                      disabled={isViewOnly}
                      className="checkbox checkbox-primary h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        🛡️ Automatically create Quality Control (QC Inspection) on execution completion
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        When checked, completing this execution automatically creates a verified QC Inspection record and logs output stock.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Details Breakdown Tabs (Consumption, Overheads, By-Products, Breakdown) */}
          <div className="card shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            <div className="flex border-b border-slate-100 dark:border-slate-800 text-xs font-bold">
              {[
                { id: "consumption", label: "Consumption Details" },
                { id: "overhead", label: "Overhead Details" },
                { id: "byproducts", label: "By-Products" },
                { id: "breakdown", label: "Break Down Log" }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 transition-colors uppercase tracking-wider font-bold ${
                    activeTab === tab.id 
                      ? "border-b-2 border-brand-600 text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-950/20" 
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* TAB 1: Consumption Details */}
              {activeTab === "consumption" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Auto-Populated Raw Material Recipe</h4>
                    {!isViewOnly && (
                      <button 
                        type="button"
                        onClick={() => setEditRowModal({ 
                          type: 'consumption', 
                          index: -1, 
                          data: { item_name: "", item_code: "", qty: 1, actual_qty: 1, uom: "Pcs", unit_cost: 0 } 
                        })}
                        className="btn btn-secondary text-xs flex items-center gap-1"
                      >
                        <Plus size={14} /> Add Line
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 uppercase font-bold text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Item Name</th>
                          <th className="px-3 py-2">Item Code</th>
                          <th className="px-3 py-2 text-right">Recipe Unit Qty</th>
                          <th className="px-3 py-2 text-right">Consumed Qty</th>
                          <th className="px-3 py-2">UOM</th>
                          <th className="px-3 py-2 text-right">Unit Cost ({currencySymbol})</th>
                          <th className="px-3 py-2 text-right">Total Cost ({currencySymbol})</th>
                          {!isViewOnly && <th className="px-3 py-2 text-center">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {consumptionList.length > 0 ? consumptionList.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{item.item_name}</td>
                            <td className="px-3 py-2 font-mono text-slate-500">{item.item_code}</td>
                            <td className="px-3 py-2 text-right font-bold">{item.qty}</td>
                            <td className="px-3 py-2 text-right font-bold text-brand-600">{item.actual_qty || item.qty}</td>
                            <td className="px-3 py-2 font-semibold">{item.uom || 'Pcs'}</td>
                            <td className="px-3 py-2 text-right font-mono">{currencySymbol}{(Number(item.unit_cost) || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-black text-brand-600">{currencySymbol}{((Number(item.actual_qty) || Number(item.qty) || 1) * (Number(item.unit_cost) || 0)).toFixed(2)}</td>
                            {!isViewOnly && (
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditRowModal({ type: 'consumption', index: idx, data: { ...item } })}
                                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    title="Edit consumption item"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteConsumptionRow(idx)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                    title="Remove item"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )) : (
                          <tr><td colSpan={isViewOnly ? 7 : 8} className="px-3 py-6 text-center text-slate-400 italic">No raw materials logged.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: Overhead Details */}
              {activeTab === "overhead" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Overhead Costs Breakdown</h4>
                    {!isViewOnly && (
                      <button 
                        type="button"
                        onClick={() => setEditRowModal({ 
                          type: 'overhead', 
                          index: -1, 
                          data: { overhead_type: "", allocation_basis: "per Hour", qty: 1, rate: 10 } 
                        })}
                        className="btn btn-secondary text-xs flex items-center gap-1"
                      >
                        <Plus size={14} /> Add Overhead
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 uppercase font-bold text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Overhead Type</th>
                          <th className="px-3 py-2">Allocation Basis</th>
                          <th className="px-3 py-2 text-right">Quantity</th>
                          <th className="px-3 py-2 text-right">Rate ({currencySymbol})</th>
                          <th className="px-3 py-2 text-right">Allocated Amount ({currencySymbol})</th>
                          {!isViewOnly && <th className="px-3 py-2 text-center">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {overheadList.length > 0 ? overheadList.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-bold">{item.overhead_type}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 font-medium">{item.allocation_basis || "per Hour"}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-200">{item.qty || 1}</td>
                            <td className="px-3 py-2 text-right font-mono">{currencySymbol}{(Number(item.rate) || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-black text-amber-600">{currencySymbol}{(Number(item.amount) || 0).toFixed(2)}</td>
                            {!isViewOnly && (
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditRowModal({ type: 'overhead', index: idx, data: { ...item } })}
                                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    title="Edit overhead"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteOverheadRow(idx)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                    title="Remove overhead"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )) : (
                          <tr><td colSpan={isViewOnly ? 5 : 6} className="px-3 py-6 text-center text-slate-400 italic">No overheads logged.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: By-Products */}
              {activeTab === "byproducts" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">By-Products & Recoveries</h4>
                    {!isViewOnly && (
                      <button 
                        type="button"
                        onClick={() => setEditRowModal({ 
                          type: 'byproduct', 
                          index: -1, 
                          data: { item_name: "", item_code: "", qty: 1, uom: "Kg" } 
                        })}
                        className="btn btn-secondary text-xs flex items-center gap-1"
                      >
                        <Plus size={14} /> Add By-Product
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 uppercase font-bold text-slate-500">
                        <tr>
                          <th className="px-3 py-2">By-Product Item</th>
                          <th className="px-3 py-2">Code</th>
                          <th className="px-3 py-2 text-right">Qty Produced</th>
                          <th className="px-3 py-2">UOM</th>
                          {!isViewOnly && <th className="px-3 py-2 text-center">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {byProductsList.length > 0 ? byProductsList.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-bold">{item.item_name}</td>
                            <td className="px-3 py-2 font-mono text-slate-500">{item.item_code}</td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-600">{item.qty}</td>
                            <td className="px-3 py-2 font-semibold">{item.uom || 'Kg'}</td>
                            {!isViewOnly && (
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditRowModal({ type: 'byproduct', index: idx, data: { ...item } })}
                                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    title="Edit by-product"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteByProductRow(idx)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                    title="Remove by-product"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )) : (
                          <tr><td colSpan={isViewOnly ? 4 : 5} className="px-3 py-6 text-center text-slate-400 italic">No secondary by-products logged.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: Break Down Log */}
              {activeTab === "breakdown" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Machine Downtime Runtimes</h4>
                    {!isViewOnly && (
                      <button 
                        type="button"
                        onClick={() => setEditRowModal({ 
                          type: 'breakdown', 
                          index: -1, 
                          data: { machine_name: (machines[0]?.machine_name || machines[0]?.name || "Machine 1"), downtime_hrs: 0.5, reason: "" } 
                        })}
                        className="btn btn-secondary text-xs flex items-center gap-1"
                      >
                        <Plus size={14} /> Log Downtime
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 uppercase font-bold text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Machine</th>
                          <th className="px-3 py-2 text-right">Downtime (Hrs)</th>
                          <th className="px-3 py-2">Reason</th>
                          {!isViewOnly && <th className="px-3 py-2 text-center">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {breakdownList.length > 0 ? breakdownList.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-bold">{item.machine_name}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-amber-600">{item.downtime_hrs} Hrs</td>
                            <td className="px-3 py-2">{item.reason}</td>
                            {!isViewOnly && (
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditRowModal({ type: 'breakdown', index: idx, data: { ...item } })}
                                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    title="Edit downtime log"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteBreakdownRow(idx)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                    title="Remove log"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )) : (
                          <tr><td colSpan={isViewOnly ? 3 : 4} className="px-3 py-6 text-center text-slate-400 italic">No downtime recorded.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Performance Stopwatch & Quick Costs */}
        <div className="space-y-6">
          
          {/* Live Timer Card */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity size={16} className="text-amber-400 animate-pulse" /> Real-time Execution
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                {formData.status}
              </span>
            </div>

            <div className="text-center py-2 bg-slate-800/80 rounded-2xl border border-slate-700">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Elapsed Run Time</span>
              <span className="text-4xl font-black font-mono tracking-wider text-amber-400">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-800 pt-1">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Start Timestamp:</span>
                <span className="font-mono font-bold text-slate-200">
                  {formData.start_time || jobDetails?.start_time
                    ? new Date(formData.start_time || jobDetails.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : (formData.status === 'COMPLETED' || formData.status === 'IN_PROGRESS' ? 'Recorded' : 'Not started')}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">End Timestamp:</span>
                <span className="font-mono font-bold text-slate-200">
                  {formData.end_time || jobDetails?.end_time
                    ? new Date(formData.end_time || jobDetails.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : (formData.status === 'COMPLETED' ? 'Completed' : (formData.status === 'IN_PROGRESS' ? 'In progress' : 'Pending'))}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Yield Completion:</span>
                <span className="font-mono font-bold text-emerald-400">{completionPct}%</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Production Cost Card */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Cost Summary</h4>
              {!isViewOnly && (
                <button 
                  type="button" 
                  onClick={calculateCosts}
                  className="text-xs text-brand-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Calculator size={12} /> Recalculate
                </button>
              )}
            </div>
            
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">Total Material Consumption:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{currencySymbol}{totalConsumption.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">Total Operational Overhead:</span>
                <span className="font-bold font-mono text-amber-600">{currencySymbol}{totalOverhead.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700">
                <span className="text-slate-700 dark:text-slate-300 font-bold">Total Batch Cost:</span>
                <span className="font-black font-mono text-brand-600 text-sm">{currencySymbol}{totalProductionCost.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-900 dark:text-white font-extrabold">Cost per Unit:</span>
                <span className="font-black font-mono text-emerald-600 text-base">
                  {currencySymbol}{(totalProductionCost / ((parseFloat(formData.good_qty) || plannedQty) || 1)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive Line Item Edit Modal */}
      {editRowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editRowModal.index >= 0 ? "Edit Line Details" : "Add New Line"}
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 capitalize">
                  {editRowModal.type}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setEditRowModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveModal} className="p-6 space-y-4">
              
              {/* Type: Consumption */}
              {editRowModal.type === "consumption" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Raw Material Item Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Raw Sugar / Wheat Flour"
                      className="input w-full font-semibold text-xs"
                      value={editRowModal.data.item_name || ""}
                      onChange={e => setEditRowModal({
                        ...editRowModal,
                        data: { ...editRowModal.data, item_name: e.target.value }
                      })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Item Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. RM-001"
                        className="input w-full font-mono text-xs"
                        value={editRowModal.data.item_code || ""}
                        onChange={e => setEditRowModal({
                          ...editRowModal,
                          data: { ...editRowModal.data, item_code: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        UOM (Unit)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Pcs / Kg / Ltr"
                        className="input w-full font-semibold text-xs"
                        value={editRowModal.data.uom || ""}
                        onChange={e => setEditRowModal({
                          ...editRowModal,
                          data: { ...editRowModal.data, uom: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Recipe Unit Qty
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="1"
                        className="input w-full font-bold text-xs"
                        value={editRowModal.data.qty ?? ""}
                        onChange={e => setEditRowModal({
                          ...editRowModal,
                          data: { ...editRowModal.data, qty: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-brand-600 uppercase tracking-wider mb-1">
                        Consumed Qty *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="1"
                        className="input w-full font-bold text-xs text-brand-600"
                        value={editRowModal.data.actual_qty ?? ""}
                        onChange={e => setEditRowModal({
                          ...editRowModal,
                          data: { ...editRowModal.data, actual_qty: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Unit Cost ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        className="input w-full font-mono text-xs font-bold"
                        value={editRowModal.data.unit_cost ?? ""}
                        onChange={e => setEditRowModal({
                          ...editRowModal,
                          data: { ...editRowModal.data, unit_cost: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl flex items-center justify-between text-xs border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 font-medium">Line Total Cost:</span>
                    <span className="font-mono font-black text-brand-600 text-sm">
                      {currencySymbol}{(
                        (parseFloat(editRowModal.data.actual_qty !== "" && editRowModal.data.actual_qty !== undefined ? editRowModal.data.actual_qty : editRowModal.data.qty) || 0) * 
                        (parseFloat(editRowModal.data.unit_cost) || 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Type: Overhead */}
              {editRowModal.type === "overhead" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Overhead Type / Description *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Direct Labor / Electricity"
                      className="input w-full font-semibold text-xs"
                      value={editRowModal.data.overhead_type || ""}
                      onChange={e => setEditRowModal({
                        ...editRowModal,
                        data: { ...editRowModal.data, overhead_type: e.target.value }
                      })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Allocation Basis
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. per Hour / per Unit / Fixed"
                      className="input w-full text-xs font-medium"
                      value={editRowModal.data.allocation_basis || ""}
                      onChange={e => setEditRowModal({
                        ...editRowModal,
                        data: { ...editRowModal.data, allocation_basis: e.target.value }
                      })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Quantity / Hours *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="1"
                        className="input w-full font-bold text-xs"
                        value={editRowModal.data.qty ?? ""}
                        onChange={e => setEditRowModal({
                          ...editRowModal,
                          data: { ...editRowModal.data, qty: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Cost Rate ({currencySymbol}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="0.00"
                        className="input w-full font-mono font-bold text-xs"
                        value={editRowModal.data.rate ?? ""}
                        onChange={e => setEditRowModal({
                          ...editRowModal,
                          data: { ...editRowModal.data, rate: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl flex items-center justify-between text-xs border border-amber-200/60 dark:border-amber-900/40">
                    <span className="text-amber-800 dark:text-amber-300 font-medium">Allocated Amount:</span>
                    <span className="font-mono font-black text-amber-600 text-sm">
                      {currencySymbol}{(
                        (parseFloat(editRowModal.data.qty) || 0) * 
                        (parseFloat(editRowModal.data.rate) || 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Type: By-Product */}
              {editRowModal.type === "byproduct" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      By-Product Item Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Recovered Scrap / Trim"
                      className="input w-full font-semibold text-xs"
                      value={editRowModal.data.item_name || ""}
                      onChange={e => setEditRowModal({
                        ...editRowModal,
                        data: { ...editRowModal.data, item_name: e.target.value }
                      })}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Item Code
                      </label>
                      <input
                        type="text"
                        placeholder="BY-01"
                        className="input w-full font-mono text-xs"
                        value={editRowModal.data.item_code || ""}
                        onChange={e => setEditRowModal({
                          ...editRowModal,
                          data: { ...editRowModal.data, item_code: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
                        Qty Produced *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="1"
                        className="input w-full font-bold text-xs text-emerald-600"
                        value={editRowModal.data.qty ?? ""}
                        onChange={e => setEditRowModal({
                          ...editRowModal,
                          data: { ...editRowModal.data, qty: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        UOM
                      </label>
                      <input
                        type="text"
                        placeholder="Kg"
                        className="input w-full font-semibold text-xs"
                        value={editRowModal.data.uom || ""}
                        onChange={e => setEditRowModal({
                          ...editRowModal,
                          data: { ...editRowModal.data, uom: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Type: Breakdown */}
              {editRowModal.type === "breakdown" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Machine / Work Center *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mixing Machine"
                      className="input w-full font-semibold text-xs"
                      value={editRowModal.data.machine_name || ""}
                      onChange={e => setEditRowModal({
                        ...editRowModal,
                        data: { ...editRowModal.data, machine_name: e.target.value }
                      })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Downtime (Hours) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0.5"
                      className="input w-full font-bold text-xs text-amber-600"
                      value={editRowModal.data.downtime_hrs ?? ""}
                      onChange={e => setEditRowModal({
                        ...editRowModal,
                        data: { ...editRowModal.data, downtime_hrs: e.target.value }
                      })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Reason / Root Cause
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Explain downtime or stoppage reason..."
                      className="input w-full text-xs font-medium"
                      value={editRowModal.data.reason || ""}
                      onChange={e => setEditRowModal({
                        ...editRowModal,
                        data: { ...editRowModal.data, reason: e.target.value }
                      })}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditRowModal(null)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <Save size={14} /> Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
