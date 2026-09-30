import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Loader2,
  Calendar,
  ClipboardList,
  Printer,
  Edit2,
  Package,
  Layers,
  Building2,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function DailyPlanForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isViewOnly = location.pathname.includes("/view/");
  const printRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [workOrders, setWorkOrders] = useState([]);
  const [boms, setBoms] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [masterProcesses, setMasterProcesses] = useState([]);
  const [masterMachines, setMasterMachines] = useState([]);
  const [masterShifts, setMasterShifts] = useState([]);
  const [currencySymbol, setCurrencySymbol] = useState("$");

  const [formData, setFormData] = useState({
    plan_no: "",
    plan_date: new Date().toISOString().split('T')[0],
    plan_period: "DAILY",
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    selected_dates: [new Date().toISOString().split('T')[0]],
    work_order_id: "",
    work_order_no: "",
    item_id: "",
    product_name: "",
    bom_id: "",
    bom_description: "",
    quantity: "",
    manufacture_date: new Date().toISOString().split('T')[0],
    expiry_date: "",
    batch_number: "",
    job_card_no: "",
    job_card_date: new Date().toISOString().split('T')[0],
    processes: [],
    remarks: "",
    status: "DRAFT"
  });

  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [prodWarehouses, setProdWarehouses] = useState([]);
  const [warehouseStockMap, setWarehouseStockMap] = useState({});

  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calDate, setCalDate] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [woRes, bomsRes, itemsRes, procRes, machRes, shiftRes, currRes, cfgRes, prodWhRes] = await Promise.allSettled([
        api.get("/production/work-orders"),
        api.get("/production/boms"),
        api.get("/inventory/items?all=1"),
        api.get("/production/setup/processes"),
        api.get("/production/setup/machines"),
        api.get("/production/setup/shifts"),
        api.get("/currencies").catch(() => ({ data: { items: [] } })),
        api.get("/production/setup/config").catch(() => ({ data: { settings: {} } })),
        api.get("/production/setup/warehouses").catch(() => ({ data: { items: [] } }))
      ]);

      if (woRes.status === "fulfilled") setWorkOrders(woRes.value.data?.items || []);
      if (bomsRes.status === "fulfilled") setBoms(bomsRes.value.data?.items || []);
      if (itemsRes.status === "fulfilled") setItemsList(itemsRes.value.data?.items || []);
      if (procRes.status === "fulfilled") setMasterProcesses(procRes.value.data?.items || []);
      if (machRes.status === "fulfilled") setMasterMachines(machRes.value.data?.items || []);
      if (shiftRes.status === "fulfilled") setMasterShifts(shiftRes.value.data?.items || []);
      if (prodWhRes.status === "fulfilled") setProdWarehouses(prodWhRes.value.data?.items || []);

      let defWhId = "";
      if (cfgRes.status === "fulfilled" && cfgRes.value.data?.settings?.default_warehouse_id) {
        defWhId = String(cfgRes.value.data.settings.default_warehouse_id);
        setDefaultWarehouseId(defWhId);
      }

      // Fetch warehouse-specific stock ledger balances if default warehouse set
      if (defWhId) {
        try {
          const stockRes = await api.get(`/inventory/stock-balances?warehouse_id=${defWhId}`);
          const sMap = {};
          (stockRes.data?.items || []).forEach(sb => {
            sMap[sb.item_id] = Number(sb.current_stock || sb.balance || 0);
          });
          setWarehouseStockMap(sMap);
        } catch {}
      }

      if (currRes.status === "fulfilled") {
        const curList = Array.isArray(currRes.value.data?.items) ? currRes.value.data.items : [];
        const base = curList.find((c) => Number(c.is_base) === 1 || c.is_base === true || Number(c.is_base_currency) === 1);
        if (base) setCurrencySymbol(base.symbol || base.code || "$");
      }

      if (id) {
        const res = await api.get(`/production/planning/daily/${id}`);
        const plan = res.data;
        if (plan.plan_date) plan.plan_date = new Date(plan.plan_date).toISOString().split('T')[0];
        if (plan.manufacture_date) plan.manufacture_date = new Date(plan.manufacture_date).toISOString().split('T')[0];
        if (plan.expiry_date) plan.expiry_date = new Date(plan.expiry_date).toISOString().split('T')[0];
        if (plan.job_card_date) plan.job_card_date = new Date(plan.job_card_date).toISOString().split('T')[0];
        setFormData(plan);
      } else {
        const ts = Date.now().toString().slice(-6);
        setFormData(prev => ({
          ...prev,
          plan_no: `PLAN-${ts}`,
          job_card_no: `JC-${ts}`,
          batch_number: ""
        }));
      }
    } catch {
      toast.error("Failed to load production plan dependency data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Helper to compute net process cost from BOM process definition
  const calculateProcessCost = (proc, planQty, bomOutputBatchQty) => {
    const scale = (parseFloat(planQty) || 1) / (parseFloat(bomOutputBatchQty) || 1 || 1);
    
    const inputsList = proc.inputs || [];
    const overheadsList = proc.overheads || [];
    const byProductsList = proc.by_products || [];

    const inputsVal = inputsList.reduce((iAcc, curr) => {
      const q = parseFloat(curr.qty) || 0;
      const s = parseFloat(curr.scrap_percent) || 0;
      const matchedItem = itemsList.find(it => String(it.id) === String(curr.item_id));
      const c = parseFloat(curr.cost_value || (matchedItem ? matchedItem.purchase_price || matchedItem.unit_cost || matchedItem.valuation_rate || matchedItem.cost_price : 0) || 0);
      const grossQty = q * (1 + s / 100);
      return iAcc + (grossQty * scale) * c;
    }, 0);

    const overheadsVal = overheadsList.reduce((oAcc, curr) => {
      const q = parseFloat(curr.qty) || 1;
      const r = parseFloat(curr.cost_rate) || 0;
      return oAcc + (q * scale) * r;
    }, 0);

    const byProductsVal = byProductsList.reduce((bAcc, curr) => {
      const q = parseFloat(curr.expected_qty) || 0;
      const matchedItem = itemsList.find(it => String(it.id) === String(curr.item_id));
      const r = parseFloat(curr.recovery_value || (matchedItem ? matchedItem.purchase_price || matchedItem.unit_cost || matchedItem.valuation_rate || matchedItem.cost_price : 0) || 0);
      return bAcc + (q * scale) * r;
    }, 0);

    return Math.max(0, inputsVal + overheadsVal - byProductsVal);
  };

  // Handle Work Order selection
  const handleWorkOrderChange = (woId) => {
    const selectedWo = workOrders.find(w => String(w.id) === String(woId));
    if (!selectedWo) {
      setFormData(prev => ({ ...prev, work_order_id: "", work_order_no: "" }));
      return;
    }

    const matchedBom = boms.find(b => String(b.id) === String(selectedWo.bom_id));
    
    setFormData(prev => {
      const nextQty = selectedWo.qty_to_produce || matchedBom?.output_qty || prev.quantity;
      const updated = {
        ...prev,
        work_order_id: selectedWo.id,
        work_order_no: selectedWo.work_order_no || `WO-${selectedWo.id}`,
        item_id: selectedWo.item_id || prev.item_id,
        product_name: selectedWo.item_name || prev.product_name,
        bom_id: selectedWo.bom_id || prev.bom_id,
        quantity: nextQty
      };

      if (matchedBom) {
        populateProcessesFromBom(matchedBom, nextQty, updated);
      }
      return updated;
    });
  };

  // Handle BOM selection
  const handleBomChange = (bomId) => {
    const selectedBom = boms.find(b => String(b.id) === String(bomId));
    if (!selectedBom) {
      setFormData(prev => ({ ...prev, bom_id: "", bom_description: "", processes: [] }));
      return;
    }

    const matchedItem = itemsList.find(i => String(i.id) === String(selectedBom.item_id));
    const bomBatchQty = parseFloat(selectedBom.output_qty) || 0;

    setFormData(prev => {
      const updated = {
        ...prev,
        bom_id: selectedBom.id,
        bom_description: selectedBom.description || selectedBom.bom_name || "",
        item_id: selectedBom.item_id || prev.item_id,
        product_name: matchedItem ? matchedItem.item_name : (selectedBom.item_name || prev.product_name),
        quantity: bomBatchQty || prev.quantity
      };
      populateProcessesFromBom(selectedBom, bomBatchQty || prev.quantity || 1, updated);
      return updated;
    });
  };

  // Filter BOMs linked to the selected product item
  const availableBoms = formData.item_id
    ? boms.filter(b => String(b.item_id) === String(formData.item_id))
    : boms;

  // Handle Product Name selection from inv_items
  const handleProductSelect = (itemId) => {
    const selectedItem = itemsList.find(i => String(i.id) === String(itemId));
    if (!selectedItem) {
      setFormData(prev => ({ ...prev, item_id: "", product_name: "", bom_id: "", bom_description: "", processes: [] }));
      return;
    }

    const matchingBoms = boms.filter(b => String(b.item_id) === String(selectedItem.id));
    const matchedBom = matchingBoms[0];

    setFormData(prev => {
      const updated = {
        ...prev,
        item_id: selectedItem.id,
        product_name: selectedItem.item_name,
        bom_id: matchedBom ? matchedBom.id : "",
        bom_description: matchedBom ? (matchedBom.description || matchedBom.bom_name || "") : ""
      };
      if (matchedBom) {
        const batchQty = parseFloat(matchedBom.output_qty) || 0;
        if (batchQty > 0) updated.quantity = batchQty;
        populateProcessesFromBom(matchedBom, batchQty || prev.quantity || 1, updated);
      } else {
        updated.processes = [];
      }
      return updated;
    });
  };

  // Populate processes table directly from selected BOM specification
  const populateProcessesFromBom = (bom, planQty, currentFormState) => {
    const bomOps = Array.isArray(bom.operations) ? bom.operations : [];
    const bomBatchQty = parseFloat(bom.output_qty) || 1;
    const effectivePlanQty = (planQty === "" || planQty === undefined || planQty === null) 
      ? bomBatchQty 
      : (parseFloat(planQty) || 0);

    const scale = bomBatchQty > 0 ? (effectivePlanQty / bomBatchQty) : 1;

    const procRows = bomOps.map((op, idx) => {
      const targetProc = masterProcesses.find(p => String(p.id) === String(op.process_id));
      
      // 1. Process Name: from BOM operation or fallback to process master
      const procName = op.process_name || targetProc?.process_name || `Operation ${idx + 1}`;
      const deptName = op.department_name || targetProc?.department_name || "Main Factory Floor";
      
      // 2. Output Items & Descriptions directly from BOM operation
      const opOutputs = op.outputs || op.output_items || targetProc?.output_items || [];
      const firstOut = opOutputs[0];
      
      const outputText = opOutputs.length > 0 
        ? opOutputs.map(o => o.item_name || 'Output').join(", ")
        : (currentFormState.product_name || 'Finished Product');

      const outputUom = firstOut?.uom || op.uom || targetProc?.uom || bom?.uom || "Pcs";
      const baseOutQty = firstOut ? (parseFloat(firstOut.output_qty || firstOut.qty) || 1) : bomBatchQty;
      const calcPlannedQty = Math.round(baseOutQty * scale);

      // 3. Machines & Shifts directly from BOM operation
      const opMachine = op.machine_name || (Array.isArray(op.machines) ? (typeof op.machines[0] === 'object' ? op.machines[0].machine_name : op.machines[0]) : "") || (targetProc?.machines?.[0] ? (typeof targetProc.machines[0] === 'object' ? targetProc.machines[0].machine_name : targetProc.machines[0]) : "");
      const opShift = op.shift_name || (Array.isArray(op.shifts) ? (typeof op.shifts[0] === 'object' ? op.shifts[0].shift_name : op.shifts[0]) : "") || (targetProc?.shifts?.[0] ? (typeof targetProc.shifts[0] === 'object' ? targetProc.shifts[0].shift_name : targetProc.shifts[0]) : "");

      // 4. Total Time (Mins) matching exact formula on BOM page: setup_time + (cycle_time * target_plan_qty)
      const setupTime = parseFloat(op.setup_time_mins) || 0;
      const cycleTime = parseFloat(op.cycle_time_mins) || 0;
      
      const calcBomTime = setupTime + (cycleTime * effectivePlanQty);
      const totalTimeMins = calcBomTime > 0 
        ? Math.round(calcBomTime)
        : (parseFloat(op.total_time_mins) ? Math.round(parseFloat(op.total_time_mins) * scale) : Math.round((parseFloat(targetProc?.cycle_time_mins) || 0) * scale));

      const opMachineId = op.machine_id || (Array.isArray(op.machines) ? (typeof op.machines[0] === 'object' ? (op.machines[0].id || op.machines[0].machine_id) : op.machines[0]) : "") || (targetProc?.machines?.[0] ? (typeof targetProc.machines[0] === 'object' ? (targetProc.machines[0].id || targetProc.machines[0].machine_id) : targetProc.machines[0]) : "");
      const opShiftId = op.shift_id || (Array.isArray(op.shifts) ? (typeof op.shifts[0] === 'object' ? (op.shifts[0].id || op.shifts[0].shift_id) : op.shifts[0]) : "") || (targetProc?.shifts?.[0] ? (typeof targetProc.shifts[0] === 'object' ? (targetProc.shifts[0].id || targetProc.shifts[0].shift_id) : targetProc.shifts[0]) : "");

      return {
        process_id: op.process_id || targetProc?.id || "",
        process_name: procName,
        output_desc: outputText,
        planned_qty: calcPlannedQty,
        uom: outputUom,
        machine_id: opMachineId || "",
        machine_name: opMachine || "CNC Lathe Workstation 1",
        shift_id: opShiftId || "",
        shift_name: opShift || "Day Shift (08:00 - 16:00)",
        production_area: deptName,
        job_date: currentFormState.plan_date || new Date().toISOString().split('T')[0],
        total_time_mins: totalTimeMins,
        cost_per_process: parseFloat(op.cost_per_process) || 0,
        inputs: op.inputs || targetProc?.inputs || []
      };
    });

    currentFormState.processes = procRows;
  };

  const [editingRowIndex, setEditingRowIndex] = useState(null);

  // Add process row
  const addProcessRow = () => {
    const newIdx = formData.processes.length;
    setFormData(prev => ({
      ...prev,
      processes: [
        ...prev.processes,
        {
          process_id: "",
          process_name: "New Custom Operation",
          output_desc: prev.product_name || "Finished Output",
          planned_qty: Math.round(parseFloat(prev.quantity) || 1),
          uom: "Pcs",
          machine_name: masterMachines[0]?.machine_name || "General Machine",
          shift_name: masterShifts[0]?.shift_name || "Day Shift",
          production_area: "Factory Floor",
          job_date: prev.plan_date,
          total_time_mins: 60,
          cost_per_process: 0,
          inputs: []
        }
      ]
    }));
    setEditingRowIndex(newIdx);
  };

  // Remove process row
  const removeProcessRow = (index) => {
    const updated = [...formData.processes];
    updated.splice(index, 1);
    setFormData(prev => ({ ...prev, processes: updated }));
  };

  // Update process row
  const updateProcessRow = (index, field, value) => {
    const updated = [...formData.processes];
    const row = { ...updated[index], [field]: value };

    if (field === "machine_name") {
      const matchedMac = masterMachines.find(m => (m.machine_name || m.name) === value);
      if (matchedMac) {
        row.machine_id = matchedMac.id;
      }
    }

    if (field === "shift_name") {
      const matchedShift = masterShifts.find(s => (s.shift_name || s.name) === value);
      if (matchedShift) {
        row.shift_id = matchedShift.id;
      }
    }

    updated[index] = row;
    setFormData(prev => ({ ...prev, processes: updated }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product_name) return toast.error("Product name is required");
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) return toast.error("Valid plan quantity is required");

    setSaving(true);
    try {
      if (id) {
        await api.put(`/production/planning/daily/${id}`, formData);
        toast.success("Production Plan updated successfully");
      } else {
        await api.post("/production/planning/daily", formData);
        toast.success("Production Plan created successfully");
      }
      navigate("/production/planning/daily");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save production plan");
    } finally {
      setSaving(false);
    }
  };

  // Total Plan Time
  const totalPlanTimeMins = formData.processes.reduce((acc, p) => acc + (parseFloat(p.total_time_mins) || 0), 0);

  // Generate compiled input materials list directly from BOM specification
  const getCompiledInputMaterials = () => {
    const result = [];
    const targetBom = boms.find(b => String(b.id) === String(formData.bom_id));
    const bomBatchQty = parseFloat(targetBom?.output_qty) || 1;
    const planQty = parseFloat(formData.quantity) || 1;
    const scale = planQty / bomBatchQty;

    if (!targetBom) return result;

    // 1. Primary: Pick raw material components directly defined on the selected BOM
    if (Array.isArray(targetBom.components) && targetBom.components.length > 0) {
      targetBom.components.forEach((comp) => {
        const baseQty = parseFloat(comp.qty) || parseFloat(comp.quantity) || 1;
        const scrap = parseFloat(comp.scrap_percent) || 0;
        const grossQty = baseQty * (1 + scrap / 100);
        const reqQty = grossQty * scale;

        result.push({
          item_id: comp.item_id,
          process_name: comp.process_name || "BOM Material Recipe",
          item_name: comp.item_name || comp.name || "Raw Material",
          item_code: comp.item_code || comp.code || "",
          uom: comp.uom || "Pcs",
          required_qty: Math.round(reqQty),
          scrap_percent: scrap
        });
      });
      return result;
    }

    // 2. Secondary: If BOM has operations with inputs array embedded in BOM recipe
    const bomOps = Array.isArray(targetBom.operations) ? targetBom.operations : [];
    bomOps.forEach((op) => {
      const inputs = op.inputs || [];
      inputs.forEach((inp) => {
        const baseQty = parseFloat(inp.qty) || parseFloat(inp.quantity) || 1;
        const scrap = parseFloat(inp.scrap_percent) || 0;
        const grossQty = baseQty * (1 + scrap / 100);
        const reqQty = grossQty * scale;

        result.push({
          item_id: inp.item_id,
          process_name: op.process_name || "Operation Step",
          item_name: inp.item_name || "Raw Material",
          item_code: inp.item_code || "",
          uom: inp.uom || "Pcs",
          required_qty: Math.round(reqQty),
          scrap_percent: scrap
        });
      });
    });

    // 3. Fallback: If BOM components empty, pull from master processes loaded for plan
    if (result.length === 0) {
      formData.processes.forEach((proc) => {
        const procMaster = masterProcesses.find(p => String(p.id) === String(proc.process_id)) || proc;
        const inputs = procMaster.inputs || proc.inputs || [];

        inputs.forEach((inp) => {
          const grossQty = (parseFloat(inp.qty) || 0) * (1 + (parseFloat(inp.scrap_percent) || 0) / 100);
          const reqQty = grossQty * scale;

          result.push({
            item_id: inp.item_id,
            process_name: proc.process_name,
            item_name: inp.item_name || "Raw Material",
            item_code: inp.item_code || "",
            uom: inp.uom || "Pcs",
            required_qty: Math.round(reqQty),
            scrap_percent: inp.scrap_percent || 0
          });
        });
      });
    }

    return result;
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading Production Plan...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div className="flex items-center gap-4">
          <Link to="/production/planning/daily" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {isViewOnly ? `View Production Plan: ${formData.plan_no}` : (id ? `Edit Production Plan: ${formData.plan_no}` : "New Production Plan")}
              </h1>
              {formData.status && (
                <span className={`badge ${
                  formData.status === 'COMPLETED' ? 'badge-success' : 
                  formData.status === 'IN_PROGRESS' ? 'badge-info' : 
                  formData.status === 'RELEASED' ? 'badge-primary' :
                  'badge-secondary'
                }`}>
                  {formData.status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Schedule operation processes, linked machines, work shifts, job card tracking, and material sheets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Printer size={18} />
            Input Material Sheet
          </button>
          
          {!isViewOnly && (
            <button
              form="prod-plan-form"
              type="submit"
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save Production Plan
            </button>
          )}
        </div>
      </div>

      <form id="prod-plan-form" onSubmit={handleSubmit} className="space-y-8 print:hidden">
        <fieldset disabled={isViewOnly} className="space-y-8 border-none p-0 m-0">
        {/* Hidden Field: Plan No */}
        <input type="hidden" name="plan_no" value={formData.plan_no} />

        {/* Top Header Card */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl">
                <ClipboardList size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Plan Specifications & Job Card</h3>
                <p className="text-xs text-slate-400">Specify production targets, manufacture dates, and auto-generated job card codes</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase text-slate-400">Plan No: <strong className="text-indigo-600">{formData.plan_no}</strong></span>
              {id && (
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="input py-1 text-xs font-bold uppercase"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="RELEASED">RELEASED</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Plan Period */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Plan Period *
              </label>
              <select
                value={formData.plan_period || "DAILY"}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    plan_period: val,
                    start_date: prev.start_date || prev.plan_date,
                    end_date: prev.end_date || prev.plan_date
                  }));
                  if (val === "CUSTOM") {
                    setShowCalendarModal(true);
                  }
                }}
                className="input w-full font-bold text-slate-900 dark:text-slate-100"
              >
                <option value="DAILY">Daily Plan (Single Date)</option>
                <option value="WEEKLY">Weekly Production Run</option>
                <option value="MONTHLY">Monthly Production Schedule</option>
                <option value="CUSTOM">Custom Multi-Date Calendar Selection</option>
              </select>
            </div>

            {/* Plan Date / Multi-Date Picker Launcher */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                {formData.plan_period === "DAILY" ? "Plan Date *" : "Production Schedule Dates *"}
              </label>
              {formData.plan_period === "CUSTOM" ? (
                <button
                  type="button"
                  onClick={() => setShowCalendarModal(true)}
                  className="btn btn-secondary w-full flex items-center justify-between text-xs py-2 px-3 font-bold border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Calendar size={16} className="text-indigo-600 shrink-0" />
                    <span className="truncate">
                      {(formData.selected_dates || []).length > 0
                        ? `${formData.selected_dates.length} Date(s) Selected`
                        : "Click to select dates..."}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 text-[10px] bg-indigo-600 text-white rounded-full font-extrabold shrink-0">
                    {(formData.selected_dates || []).length}
                  </span>
                </button>
              ) : (
                <input
                  type="date"
                  required
                  value={formData.plan_period === "DAILY" ? formData.plan_date : formData.start_date}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      plan_date: val,
                      start_date: val,
                      end_date: prev.plan_period === "DAILY" ? val : prev.end_date,
                      selected_dates: [val]
                    }));
                  }}
                  className="input w-full font-semibold"
                />
              )}
            </div>

            {/* End Date (shown for Weekly, Monthly) */}
            {formData.plan_period !== "DAILY" && formData.plan_period !== "CUSTOM" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  className="input w-full font-semibold"
                />
              </div>
            )}

            {/* Dates Summary Badge for CUSTOM */}
            {formData.plan_period === "CUSTOM" && (
              <div className="flex flex-col justify-end pb-1">
                <span className="text-[11px] font-bold text-slate-500 truncate">
                  Selected Dates List:
                </span>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate">
                  {(formData.selected_dates || []).sort().join(", ") || "None"}
                </span>
              </div>
            )}

            {/* Production Order Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Production Order (Work Order)
              </label>
              <select
                value={formData.work_order_id || ""}
                onChange={(e) => handleWorkOrderChange(e.target.value)}
                className={`input w-full transition-colors ${!formData.work_order_id ? "text-slate-400 font-normal" : "text-slate-900 dark:text-slate-100 font-bold"}`}
              >
                <option value="" className="text-slate-400 font-normal">Select Production Order (Optional)...</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id} className="text-slate-900 font-medium">
                    {wo.work_order_no} - {wo.item_name || 'Item'} ({wo.qty_to_produce} Pcs)
                  </option>
                ))}
              </select>
            </div>

            {/* Product Name (Populated from inv_items) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Product Name *
              </label>
              <select
                value={formData.item_id || ""}
                onChange={(e) => handleProductSelect(e.target.value)}
                required
                className={`input w-full transition-colors ${!formData.item_id ? "text-slate-400 font-normal" : "text-slate-900 dark:text-slate-100 font-bold"}`}
              >
                <option value="" className="text-slate-400 font-normal">Select Finished Product (from Inventory)...</option>
                {itemsList.map((item) => (
                  <option key={item.id} value={item.id} className="text-slate-900 font-medium">
                    {item.item_name} {item.item_code ? `(${item.item_code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* BOM Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                BOM
              </label>
              <select
                value={formData.bom_id || ""}
                onChange={(e) => handleBomChange(e.target.value)}
                className={`input w-full transition-colors ${!formData.bom_id ? "text-slate-400 font-normal" : "text-slate-900 dark:text-slate-100 font-bold"}`}
              >
                <option value="" className="text-slate-400 font-normal">Select BOM Recipe...</option>
                {availableBoms.map((bom) => (
                  <option key={bom.id} value={bom.id} className="text-slate-900 font-medium">
                    {bom.bom_name} ({bom.output_qty} {bom.uom || 'Pcs'})
                  </option>
                ))}
              </select>
            </div>

            {/* Plan Quantity */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Plan Quantity *
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="Enter plan quantity..."
                value={formData.quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  const q = val === "" ? "" : (parseFloat(val) || 0);
                  setFormData(prev => {
                    const updated = { ...prev, quantity: q };
                    const selectedBom = boms.find(b => String(b.id) === String(prev.bom_id));
                    if (selectedBom) populateProcessesFromBom(selectedBom, q || selectedBom.output_qty || 1, updated);
                    return updated;
                  });
                }}
                className="input w-full text-indigo-600 dark:text-indigo-400 placeholder:text-slate-400 placeholder:font-normal font-bold"
              />
            </div>

            {/* Manufacture Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Manufacture Date
              </label>
              <input
                type="date"
                value={formData.manufacture_date}
                onChange={(e) => setFormData({ ...formData, manufacture_date: e.target.value })}
                className="input w-full"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="input w-full"
              />
            </div>

            {/* Batch Number */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Batch Number
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
                    const rnd = Math.floor(1000 + Math.random() * 9000);
                    setFormData(prev => ({ ...prev, batch_number: `LOT-${todayStr}-${rnd}` }));
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 uppercase underline"
                >
                  Auto Gen Batch
                </button>
              </div>
              <input
                type="text"
                value={formData.batch_number}
                onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                placeholder="e.g. BATCH-2026-001"
                className="input w-full font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
          </div>

          {/* Real-Time MRP Stock & Machine Capacity Readiness Panel */}
          {formData.bom_id && (
            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg">
                    <ClipboardList size={16} />
                  </div>
                  {(() => {
                    const targetWh = prodWarehouses.find(w => String(w.id) === String(defaultWarehouseId));
                    const whName = targetWh ? targetWh.warehouse_name : "Default Stores Warehouse";

                    return (
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                          MRP Material Stock Availability & Capacity Guard
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Live stock check in <span className="font-bold underline text-indigo-600">{whName}</span> against required plan ({formData.quantity || 0} Pcs)
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {(() => {
                  const materials = getCompiledInputMaterials();
                  const hasShortage = materials.some(m => {
                    const targetItem = itemsList.find(i => String(i.id) === String(m.item_id) || i.item_name === m.item_name);
                    const stock = (defaultWarehouseId && warehouseStockMap[m.item_id] !== undefined)
                      ? warehouseStockMap[m.item_id]
                      : (parseFloat(targetItem?.current_stock) || 0);
                    return stock < m.required_qty;
                  });

                  return (
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      hasShortage 
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300"
                    }`}>
                      {hasShortage ? "⚠️ Raw Material Shortage Alert" : "✓ Material Stock Ready"}
                    </span>
                  );
                })()}
              </div>

              {/* Material Stock Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {getCompiledInputMaterials().map((mat, i) => {
                  const targetItem = itemsList.find(item => String(item.id) === String(mat.item_id) || item.item_name === mat.item_name);
                  const currentStock = (defaultWarehouseId && warehouseStockMap[mat.item_id] !== undefined)
                    ? warehouseStockMap[mat.item_id]
                    : (parseFloat(targetItem?.current_stock) || 0);
                  const isSufficient = currentStock >= mat.required_qty;

                  return (
                    <div key={i} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{mat.item_name}</span>
                        <span className="text-[11px] text-slate-500">Needed: <strong>{mat.required_qty} {mat.uom}</strong></span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-bold text-slate-500 block">Current Stock:</span>
                        <span className={`font-mono font-bold ${isSufficient ? "text-emerald-600" : "text-red-600"}`}>
                          {currentStock} {mat.uom}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Machine Capacity Summary */}
              <div className="flex items-center justify-between text-xs bg-indigo-50/60 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900">
                <span className="text-indigo-900 dark:text-indigo-200 font-semibold">
                  Scheduled Workstation Time: <strong>{totalPlanTimeMins} Minutes ({(totalPlanTimeMins / 60).toFixed(1)} Hours)</strong>
                </span>
                <span className="text-indigo-700 dark:text-indigo-300 font-bold">
                  {totalPlanTimeMins > 480 ? "⚠️ Over 8h Standard Shift - Dual Shift Suggested" : "✓ Within 1-Shift Machine Limit"}
                </span>
              </div>
            </div>
          )}

          {/* Auto-generated Job Card Metadata Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase block">Auto Job Card No:</span>
              <span className="font-mono font-bold text-brand-600 dark:text-brand-300 text-sm">{formData.job_card_no}</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase block">Auto Job Card Date:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{formData.job_card_date}</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase block">BOM Description:</span>
              <span className="text-xs text-slate-600 dark:text-slate-300 italic truncate block">{formData.bom_description || "No BOM selected"}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Production Plan Operations Breakdown */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Layers size={20} className="text-indigo-600" />
                Production Operation Processes
              </h3>
              <p className="text-xs text-slate-500">
                Operations populated from selected BOM specification with output yield, assigned machines, shifts, area, and total time
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500">
                Total Time: <strong className="text-indigo-600">{totalPlanTimeMins} mins</strong>
              </span>
              <button
                type="button"
                onClick={addProcessRow}
                className="btn btn-secondary text-xs flex items-center gap-1.5"
              >
                <Plus size={16} /> Add Custom Process
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden min-w-[1100px]">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase whitespace-nowrap">
                <tr>
                  <th className="p-3 min-w-[160px]">Process Name</th>
                  <th className="p-3 min-w-[160px]">Process Output</th>
                  <th className="p-3 text-right min-w-[130px]">Planned Quantity</th>
                  <th className="p-3 min-w-[70px]">UOM</th>
                  <th className="p-3 min-w-[140px]">Machine</th>
                  <th className="p-3 min-w-[140px]">Shift</th>
                  <th className="p-3 min-w-[150px]">Production Area</th>
                  <th className="p-3 min-w-[120px]">Job Date</th>
                  <th className="p-3 text-right min-w-[130px]">Total Time (Mins)</th>
                  <th className="p-3 text-right min-w-[90px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {formData.processes.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="p-8 text-center text-slate-400 italic">
                      No operation processes loaded. Select a BOM specification or click "Add Custom Process".
                    </td>
                  </tr>
                ) : (
                  formData.processes.map((proc, idx) => {
                    const isEditing = editingRowIndex === idx;
                    const planQuantityVal = proc.planned_qty ?? Math.round(parseFloat(formData.quantity) || 0);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Process Name */}
                        <td className="p-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="text"
                              value={proc.process_name}
                              onChange={(e) => updateProcessRow(idx, "process_name", e.target.value)}
                              className="input w-full py-1 text-sm font-bold min-w-[140px]"
                            />
                          ) : (
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{proc.process_name}</span>
                          )}
                        </td>

                        {/* Process Output */}
                        <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="text"
                              value={proc.output_desc}
                              onChange={(e) => updateProcessRow(idx, "output_desc", e.target.value)}
                              className="input w-full py-1 text-sm font-semibold min-w-[140px]"
                            />
                          ) : (
                            <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">{proc.output_desc}</span>
                          )}
                        </td>

                        {/* Planned Quantity */}
                        <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="number"
                              step="1"
                              value={planQuantityVal}
                              onChange={(e) => updateProcessRow(idx, "planned_qty", parseInt(e.target.value) || 0)}
                              className="input w-24 py-1 text-sm font-bold text-right text-indigo-600 dark:text-indigo-400"
                            />
                          ) : (
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{planQuantityVal}</span>
                          )}
                        </td>

                        {/* UOM */}
                        <td className="p-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="text"
                              value={proc.uom || "Pcs"}
                              onChange={(e) => updateProcessRow(idx, "uom", e.target.value)}
                              className="input w-16 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200"
                            />
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">{proc.uom || "Pcs"}</span>
                          )}
                        </td>

                        {/* Machine */}
                        <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {isEditing ? (
                            <select
                              value={proc.machine_name}
                              onChange={(e) => updateProcessRow(idx, "machine_name", e.target.value)}
                              className="input w-full py-1 text-sm font-semibold min-w-[130px]"
                            >
                              <option value="">Select Machine...</option>
                              {masterMachines.map((m) => (
                                <option key={m.id} value={m.machine_name || m.name}>
                                  {m.machine_name || m.name}
                                </option>
                              ))}
                              {!masterMachines.some(m => (m.machine_name || m.name) === proc.machine_name) && proc.machine_name && (
                                <option value={proc.machine_name}>{proc.machine_name}</option>
                              )}
                            </select>
                          ) : (
                            <span className="text-sm text-slate-700 dark:text-slate-300">{proc.machine_name || "—"}</span>
                          )}
                        </td>

                        {/* Shift */}
                        <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {isEditing ? (
                            <select
                              value={proc.shift_name}
                              onChange={(e) => updateProcessRow(idx, "shift_name", e.target.value)}
                              className="input w-full py-1 text-sm font-semibold min-w-[130px]"
                            >
                              <option value="">Select Shift...</option>
                              {masterShifts.map((s) => (
                                <option key={s.id} value={s.shift_name || s.name}>
                                  {s.shift_name || s.name}
                                </option>
                              ))}
                              {!masterShifts.some(s => (s.shift_name || s.name) === proc.shift_name) && proc.shift_name && (
                                <option value={proc.shift_name}>{proc.shift_name}</option>
                              )}
                            </select>
                          ) : (
                            <span className="text-sm text-slate-700 dark:text-slate-300">{proc.shift_name || "—"}</span>
                          )}
                        </td>

                        {/* Production Area */}
                        <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="text"
                              value={proc.production_area}
                              onChange={(e) => updateProcessRow(idx, "production_area", e.target.value)}
                              className="input w-full py-1 text-sm font-semibold min-w-[130px]"
                            />
                          ) : (
                            <span className="text-sm text-slate-700 dark:text-slate-300">{proc.production_area || "—"}</span>
                          )}
                        </td>

                        {/* Job Date */}
                        <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="date"
                              value={proc.job_date}
                              onChange={(e) => updateProcessRow(idx, "job_date", e.target.value)}
                              className="input w-full py-1 text-sm font-semibold min-w-[120px]"
                            />
                          ) : (
                            <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
                              {proc.job_date ? new Date(proc.job_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : "—"}
                            </span>
                          )}
                        </td>

                        {/* Total Time (Mins) */}
                        <td className="p-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="number"
                              value={proc.total_time_mins}
                              onChange={(e) => updateProcessRow(idx, "total_time_mins", parseInt(e.target.value) || 0)}
                              className="input w-20 py-1 text-sm font-bold text-right"
                            />
                          ) : (
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{proc.total_time_mins} mins</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingRowIndex(isEditing ? null : idx)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isEditing 
                                  ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100"
                                  : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                              }`}
                              title={isEditing ? "Done Editing" : "Edit Process Details"}
                            >
                              {isEditing ? <Check size={16} /> : <Edit2 size={16} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeProcessRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                              title="Delete Process"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </fieldset>
      </form>

      {/* Printable Material Requirement Details Sheet Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center print:hidden">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Printer size={20} /> Input Materials Details Sheet
              </h2>
              <div className="flex items-center gap-3">
                <button onClick={handlePrint} className="btn btn-primary text-xs flex items-center gap-1.5">
                  <Printer size={14} /> Print Material Sheet
                </button>
                <button onClick={() => setShowPrintModal(false)} className="text-white text-2xl hover:opacity-80">&times;</button>
              </div>
            </div>

            {/* Printable Content Container */}
            <div ref={printRef} className="p-8 flex-1 overflow-y-auto space-y-6 font-sans">
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">OMNISUITE ERP - INPUT MATERIAL REQUISITION SHEET</h1>
                  <p className="text-xs text-slate-500 font-bold">Production Planning & Material Dispatch Document</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-100 text-slate-800 font-mono font-bold text-xs rounded border border-slate-300 block">
                    PLAN #: {formData.plan_no}
                  </span>
                  <span className="text-xs text-slate-500 block mt-1">Date: {formData.plan_date}</span>
                </div>
              </div>

              {/* Plan Metadata Summary Grid */}
              <div className="grid grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-500 block">PRODUCT NAME:</span>
                  <span className="font-bold text-slate-900">{formData.product_name || "N/A"}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">PLAN QUANTITY:</span>
                  <span className="font-bold text-slate-900">{formData.quantity} Pcs</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">BATCH NUMBER:</span>
                  <span className="font-mono font-bold text-slate-900">{formData.batch_number || "N/A"}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">JOB CARD NO:</span>
                  <span className="font-mono font-bold text-indigo-700">{formData.job_card_no}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">MANUFACTURE DATE:</span>
                  <span className="font-bold text-slate-900">{formData.manufacture_date || "N/A"}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">EXPIRY DATE:</span>
                  <span className="font-bold text-slate-900">{formData.expiry_date || "N/A"}</span>
                </div>
              </div>

              {/* Material Requisition Table */}
              <div>
                <h3 className="font-bold text-sm uppercase text-slate-800 border-b border-slate-300 pb-2 mb-3">
                  Input Materials Breakdown per Process Step
                </h3>
                <table className="w-full text-left text-xs border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2.5 border-r border-slate-300">#</th>
                      <th className="p-2.5 border-r border-slate-300">Process Name</th>
                      <th className="p-2.5 border-r border-slate-300">Input Item Name & Code</th>
                      <th className="p-2.5 border-r border-slate-300">UOM</th>
                      <th className="p-2.5 border-r border-slate-300 text-right">Scrap Allowance %</th>
                      <th className="p-2.5 text-right font-black">Required Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {getCompiledInputMaterials().length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-6 text-center text-slate-400 italic">
                          No input materials registered for the processes in this plan.
                        </td>
                      </tr>
                    ) : (
                      getCompiledInputMaterials().map((mat, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 border-r border-slate-300 text-slate-500">{idx + 1}</td>
                          <td className="p-2.5 border-r border-slate-300 font-bold text-slate-900">{mat.process_name}</td>
                          <td className="p-2.5 border-r border-slate-300 font-semibold text-slate-800">
                            {mat.item_name} {mat.item_code ? `(${mat.item_code})` : ""}
                          </td>
                          <td className="p-2.5 border-r border-slate-300 font-bold">{mat.uom}</td>
                          <td className="p-2.5 border-r border-slate-300 text-right text-slate-600">{mat.scrap_percent}%</td>
                          <td className="p-2.5 text-right font-black text-slate-900">{mat.required_qty}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signature Block */}
              <div className="pt-8 grid grid-cols-3 gap-8 text-center text-xs font-bold text-slate-700">
                <div>
                  <div className="border-b border-slate-400 mb-2 h-12"></div>
                  <span>PREPARED BY (PLANNER)</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 mb-2 h-12"></div>
                  <span>STOREKEEPER / DISPATCH</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 mb-2 h-12"></div>
                  <span>PRODUCTION SUPERVISOR</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Multi-Date Calendar Modal */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl text-white">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Production Calendar</h3>
                  <p className="text-xs text-slate-300">Click dates to select or deselect for production</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Month Header & Controls */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))}
                className="btn btn-secondary text-xs px-2.5 py-1"
              >
                ◀ Prev
              </button>
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                {calDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))}
                className="btn btn-secondary text-xs px-2.5 py-1"
              >
                Next ▶
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 uppercase">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              <div className="grid grid-cols-7 gap-1 text-xs">
                {(() => {
                  const year = calDate.getFullYear();
                  const month = calDate.getMonth();
                  const firstDayIndex = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const cells = [];

                  // Empty padding cells before 1st of month
                  for (let i = 0; i < firstDayIndex; i++) {
                    cells.push(<div key={`empty-${i}`} className="h-10"></div>);
                  }

                  // Month days
                  for (let day = 1; day <= daysInMonth; day++) {
                    const monthStr = String(month + 1).padStart(2, '0');
                    const dayStr = String(day).padStart(2, '0');
                    const dateIso = `${year}-${monthStr}-${dayStr}`;

                    const isSelected = (formData.selected_dates || []).includes(dateIso);
                    const isToday = dateIso === new Date().toISOString().split('T')[0];

                    cells.push(
                      <button
                        key={dateIso}
                        type="button"
                        onClick={() => {
                          setFormData(prev => {
                            const list = prev.selected_dates || [];
                            const exists = list.includes(dateIso);
                            const updated = exists
                              ? list.filter(d => d !== dateIso)
                              : [...list, dateIso].sort();

                            const sorted = [...updated].sort();
                            return {
                              ...prev,
                              selected_dates: updated,
                              start_date: sorted[0] || prev.plan_date,
                              end_date: sorted[sorted.length - 1] || prev.plan_date,
                              plan_date: sorted[0] || prev.plan_date
                            };
                          });
                        }}
                        className={`h-10 rounded-xl font-bold flex flex-col items-center justify-center relative transition-all ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105"
                            : isToday
                              ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border border-indigo-300 dark:border-indigo-700"
                              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        <span>{day}</span>
                        {isSelected && <span className="text-[9px] leading-none">✓</span>}
                      </button>
                    );
                  }

                  return cells;
                })()}
              </div>
            </div>

            {/* Quick Action Presets */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>Quick Presets:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {(formData.selected_dates || []).length} Date(s) Selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const year = calDate.getFullYear();
                    const month = calDate.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const weekdays = [];
                    for (let d = 1; d <= daysInMonth; d++) {
                      const dt = new Date(year, month, d);
                      const dayOfWeek = dt.getDay();
                      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                        const mStr = String(month + 1).padStart(2, '0');
                        const dStr = String(d).padStart(2, '0');
                        weekdays.push(`${year}-${mStr}-${dStr}`);
                      }
                    }
                    const sorted = [...weekdays].sort();
                    setFormData(prev => ({
                      ...prev,
                      selected_dates: weekdays,
                      start_date: sorted[0] || prev.plan_date,
                      end_date: sorted[sorted.length - 1] || prev.plan_date
                    }));
                  }}
                  className="btn btn-secondary py-1 text-[11px]"
                >
                  Select Weekdays (Mon-Fri)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const year = calDate.getFullYear();
                    const month = calDate.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const allDays = [];
                    for (let d = 1; d <= daysInMonth; d++) {
                      const mStr = String(month + 1).padStart(2, '0');
                      const dStr = String(d).padStart(2, '0');
                      allDays.push(`${year}-${mStr}-${dStr}`);
                    }
                    const sorted = [...allDays].sort();
                    setFormData(prev => ({
                      ...prev,
                      selected_dates: allDays,
                      start_date: sorted[0] || prev.plan_date,
                      end_date: sorted[sorted.length - 1] || prev.plan_date
                    }));
                  }}
                  className="btn btn-secondary py-1 text-[11px]"
                >
                  Select Entire Month
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, selected_dates: [] }))}
                  className="btn btn-secondary py-1 text-[11px] text-red-600 dark:text-red-400"
                >
                  Clear All
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCalendarModal(false)}
                  className="btn btn-primary text-xs px-6 py-2 font-bold"
                >
                  Done & Confirm Dates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
