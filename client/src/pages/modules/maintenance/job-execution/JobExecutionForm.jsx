/**
 * @fileoverview JobExecutionForm component.
 * Comprehensive, multi-step job execution: links to a job order,
 * tracks labor, materials/parts, a completion checklist, downtime, costing,
 * and a sign-off / approval workflow. Mirrors service execution layout.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

const COMPLETION = ["IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"];
const UNITS = ["pcs", "set", "box", "ltr", "kg", "m", "roll", "unit"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * JobExecutionForm — 3-step wizard matching service execution layout.
 *
 * Step 1: Job Order Reference (link job order, set work status, start date/time)
 * Step 2: Labor & Materials (technicians, parts used, checklist)
 * Step 3: Execution Details & Closing (end date, work performed, sign-off)
 */
export default function JobExecutionForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isEdit = !!id;

  const [step, setStep] = useState(1);
  const [workStatus, setWorkStatus] = useState("IN_PROGRESS");

  const [form, setForm] = useState({
    execution_no: "",
    job_order_id: params.get("job_order_id") || "",
    start_date: new Date().toISOString().slice(0, 10),
    start_time: "",
    end_date: "",
    end_time: "",
    downtime_hours: "",
    work_done: "",
    materials_used: "",
    completion_status: "IN_PROGRESS",
    sign_off_by: "",
    sign_off_date: "",
    status: "DRAFT",
    notes: "",
    approval_status: "PENDING",
    approved_by: "",
    approval_date: "",
    approval_notes: "",
    warehouse_id: "",
  });

  const [technicians, setTechnicians] = useState([
    { id: uid(), name: "", role: "", hours: "", rate: "" },
  ]);
  const [materials, setMaterials] = useState([{ id: 1, item_id: '', itemName: '', description: '', qty: 1, unit: 'PCS', unit_cost: 0, availableQty: 0 }]);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemQueries, setItemQueries] = useState({});
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    let mounted = true;
    api.get('/inventory/items').then((res) => {
      if (mounted) setAvailableItems(Array.isArray(res.data?.items) ? res.data.items : []);
    }).catch(() => {});
    api.get('/inventory/warehouses').then((res) => {
      if (mounted) setWarehouses(Array.isArray(res.data?.items) ? res.data.items : []);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const filterByPrefix = (items, options) => {
    const q = (options.query || '').toLowerCase();
    if (!q) return [];
    return items.filter(i => (i.item_name || '').toLowerCase().includes(q) || (i.item_code || '').toLowerCase().includes(q));
  };

  const [checklist, setChecklist] = useState([
    { id: uid(), task: "", done: false },
  ]);

  const [jobOrders, setJobOrders] = useState([]);
  const [selectedJobOrder, setSelectedJobOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [errors, setErrors] = useState({});

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // -- load job orders + existing execution -------------------------------
  useEffect(() => {
    let mounted = true;
    api
      .get("/maintenance/job-orders")
      .then((r) => {
        if (mounted)
          setJobOrders(Array.isArray(r.data?.items) ? r.data.items : []);
      })
      .catch(() => {});

    if (isEdit) {
      api
        .get(`/maintenance/job-executions/${id}`)
        .then((r) => {
          const item = r.data?.item || {};
          if (!mounted) return;
          setForm((p) => ({
            ...p,
            ...item,
            start_date: (item.start_date || "").slice(0, 10),
            end_date: (item.end_date || "").slice(0, 10),
            approval_date: (item.approval_date || "").slice(0, 10),
            sign_off_date: (item.sign_off_date || "").slice(0, 10),
          }));
          setWorkStatus((item.completion_status || "IN_PROGRESS").toLowerCase());
          setStep(Number(item.current_step) || 1);
          if (Array.isArray(item.technicians) && item.technicians.length) {
            setTechnicians(item.technicians.map((t) => ({ id: uid(), ...t })));
          }
          if (
            Array.isArray(item.material_lines) &&
            item.material_lines.length
          ) {
            setMaterials(item.material_lines.map((m) => ({ id: uid(), ...m })));
          }
          if (Array.isArray(item.checklist) && item.checklist.length) {
            setChecklist(item.checklist.map((c) => ({ id: uid(), ...c })));
          }
        })
        .catch(() => toast.error("Failed to load execution"))
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }
    return () => {
      mounted = false;
    };
  }, [id]);

  // -- keep selected job order summary in sync -----------------------------
  useEffect(() => {
    const jo = jobOrders.find(
      (o) => String(o.id) === String(form.job_order_id),
    );
    setSelectedJobOrder(jo || null);
  }, [form.job_order_id, jobOrders]);

  // -- derived costing -------------------------------------------------------
  const laborCost = useMemo(
    () =>
      technicians.reduce(
        (sum, t) => sum + (Number(t.hours) || 0) * (Number(t.rate) || 0),
        0,
      ),
    [technicians],
  );
  const totalLaborHours = useMemo(
    () => technicians.reduce((sum, t) => sum + (Number(t.hours) || 0), 0),
    [technicians],
  );
  const materialsCost = useMemo(
    () =>
      materials.reduce(
        (sum, m) => sum + (Number(m.qty) || 0) * (Number(m.unit_cost) || 0),
        0,
      ),
    [materials],
  );
  const grandTotal = laborCost + materialsCost;
  const checklistProgress = useMemo(() => {
    const total = checklist.filter((c) => c.task.trim() !== "").length;
    const done = checklist.filter((c) => c.task.trim() !== "" && c.done).length;
    return { total, done };
  }, [checklist]);

  // -- row helpers -------------------------------------------------------
  const addTechnician = () =>
    setTechnicians((p) => [
      ...p,
      { id: uid(), name: "", role: "", hours: "", rate: "" },
    ]);
  const removeTechnician = (rid) =>
    setTechnicians((p) => (p.length > 1 ? p.filter((t) => t.id !== rid) : p));
  const updateTechnician = (rid, k, v) =>
    setTechnicians((p) => p.map((t) => (t.id === rid ? { ...t, [k]: v } : t)));

  const addMaterial = () =>
    setMaterials((p) => [
      ...p,
      { id: uid(), description: "", qty: "", unit: "pcs", unit_cost: "" },
    ]);
  const removeMaterial = (rid) =>
    setMaterials((p) => (p.length > 1 ? p.filter((m) => m.id !== rid) : p));
  const updateMaterial = (rid, k, v) =>
    setMaterials((p) => p.map((m) => (m.id === rid ? { ...m, [k]: v } : m)));

  const addChecklistItem = () =>
    setChecklist((p) => [...p, { id: uid(), task: "", done: false }]);
  const removeChecklistItem = (rid) =>
    setChecklist((p) => (p.length > 1 ? p.filter((c) => c.id !== rid) : p));
  const updateChecklistItem = (rid, k, v) =>
    setChecklist((p) => p.map((c) => (c.id === rid ? { ...c, [k]: v } : c)));

  // -- validation -------------------------------------------------------
  function validate() {
    const e = {};
    if (!form.job_order_id) e.job_order_id = "Select a job order";
    if (!form.start_date) e.start_date = "Start date is required";
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      e.end_date = "End date cannot be before start date";
    }
    if (workStatus === "completed" && !form.end_date) {
      e.end_date = "End date is required when marking as Completed";
    }
    const cleanTechs = technicians.filter((t) => t.name.trim() !== "");
    if (cleanTechs.length === 0) e.technicians = "Add at least one technician";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e, nextStepNum, saveOnly = false) {
    if (e) e.preventDefault();
    if (!saveOnly && !nextStepNum) {
      if (!validate()) {
        toast.error("Please fix the highlighted fields");
        return;
      }
    }
    setSaving(true);

    const isCompleting = !saveOnly && !nextStepNum;
    let finalStatus = "DRAFT";
    if (isCompleting) finalStatus = "POSTED";
    const completionStatus = isCompleting ? "COMPLETED" : workStatus.toUpperCase();

    const payload = {
      ...form,
      completion_status: completionStatus,
      status: finalStatus,
      technicians: technicians
        .filter((t) => t.name.trim() !== "")
        .map(({ id: _id, ...rest }) => rest),
      material_lines: materials
        .filter((m) => m.description.trim() !== "")
        .map(({ id: _id, ...rest }) => rest),
      checklist: checklist
        .filter((c) => c.task.trim() !== "")
        .map(({ id: _id, ...rest }) => rest),
      total_labor_hours: totalLaborHours,
      labor_cost: laborCost,
      materials_cost: materialsCost,
      total_cost: grandTotal,
      current_step: nextStepNum || step,
    };

    try {
      if (isEdit) {
        await api.put(`/maintenance/job-executions/${id}`, payload);
        toast.success("Execution updated");
      } else {
        const r = await api.post("/maintenance/job-executions", payload);
        toast.success(`Execution ${r.data?.execution_no || ""} created`);
        if (r.data?.id) {
          window.history.replaceState(null, "", `/maintenance/job-executions/${r.data.id}`);
        }
      }

      if (nextStepNum) {
        setStep(nextStepNum);
      } else {
        navigate("/maintenance/job-executions", { state: { refresh: true } });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500 dark:text-slate-400">
        Loading job execution...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="btn-secondary">
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isEdit ? "Edit" : "New"} Job Execution
            </h1>
            <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
              Track and manage job execution from assignment to completion
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div className="font-semibold">Execution Progress</div>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={step === n ? "btn-primary" : "btn-secondary"}
                  onClick={() => setStep(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            {/* STEP 1: Job Order Reference */}
            {step === 1 && (
              <div className="card">
                <div className="card-body space-y-3">
                  <div className="text-lg font-semibold">
                    Job Order Reference
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="label">
                        Job Order <span className="text-red-600">*</span>
                      </label>
                      <select
                        className={`input ${errors.job_order_id ? "border-red-500" : ""}`}
                        value={form.job_order_id}
                        onChange={(e) => update("job_order_id", e.target.value)}
                      >
                        <option value="">-- Select Job Order --</option>
                        {jobOrders.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.order_no} – {o.asset_name || o.description || ""}
                          </option>
                        ))}
                      </select>
                      {errors.job_order_id && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.job_order_id}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label">
                        Work Status <span className="text-red-600">*</span>
                      </label>
                      <select
                        className="input"
                        value={workStatus}
                        onChange={(e) => setWorkStatus(e.target.value)}
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">
                        Start Date <span className="text-red-600">*</span>
                      </label>
                      <input
                        className={`input ${errors.start_date ? "border-red-500" : ""}`}
                        type="date"
                        value={form.start_date}
                        onChange={(e) => update("start_date", e.target.value)}
                      
                        disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
                      />
                      {errors.start_date && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.start_date}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label">Start Time</label>
                      <input
                        className="input"
                        type="time"
                        value={form.start_time}
                        onChange={(e) => update("start_time", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Downtime (hrs)</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.5"
                        value={form.downtime_hours}
                        onChange={(e) => update("downtime_hours", e.target.value)}
                        placeholder="Asset downtime, if any"
                      />
                    </div>
                  </div>

                  {selectedJobOrder && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Asset</div>
                        <div className="font-medium">{selectedJobOrder.asset_name || "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Priority</div>
                        <div className="font-medium">{selectedJobOrder.priority || "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Requested By</div>
                        <div className="font-medium">{selectedJobOrder.requested_by || "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Order Status</div>
                        <div className="font-medium">{selectedJobOrder.status || "—"}</div>
                      </div>
                      {selectedJobOrder.description && (
                        <div className="col-span-2 md:col-span-4">
                          <div className="text-xs text-slate-500 dark:text-slate-400">Description</div>
                          <div className="font-medium">{selectedJobOrder.description}</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between w-full pt-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary opacity-0 pointer-events-none"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={(e) => submit(e, null, true)}
                      >
                        Save & Exit
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn-success"
                      onClick={(e) => submit(e, 2)}
                    >
                      Next: Labor & Materials &rarr;
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Labor & Materials */}
            {step === 2 && (
              <div className="card">
                <div className="card-body space-y-4">
                  <div className="text-lg font-semibold">
                    Labor & Materials
                  </div>

                  {/* Labor Tracking */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">
                        Labor Tracking
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {totalLaborHours || 0} hrs logged · {technicians.filter((t) => t.name.trim()).length} technician(s)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={addTechnician}
                        className="text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 rounded px-2 py-1"
                      >
                        + Add Technician
                      </button>
                    </div>
                    {errors.technicians && (
                      <p className="text-xs text-red-500">{errors.technicians}</p>
                    )}
                    <div className="overflow-x-auto">
                      <table className="table w-full">
                        <thead>
                          <tr>
                            <th className="w-1/3 min-w-[200px]">Technician</th>
                            <th className="w-1/4 min-w-[150px]">Role</th>
                            <th className="w-24 min-w-[100px]">Hours</th>
                            <th className="w-32 min-w-[110px]">Rate/hr</th>
                            <th className="w-32 min-w-[120px] text-right">Subtotal</th>
                            <th className="w-20">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {technicians.map((t) => (
                            <tr key={t.id} className="border-b border-slate-100">
                              <td className="py-1.5 pr-2">
                                <input
                                  className="input w-full"
                                  value={t.name}
                                  onChange={(e) => updateTechnician(t.id, "name", e.target.value)}
                                  placeholder="Technician name"
                                />
                              </td>
                              <td className="py-1.5 pr-2">
                                <input
                                  className="input w-full"
                                  value={t.role}
                                  onChange={(e) => updateTechnician(t.id, "role", e.target.value)}
                                  placeholder="e.g. Electrician"
                                />
                              </td>
                              <td className="py-1.5 pr-2">
                                <input
                                  className="input w-full"
                                  type="number"
                                  min="0"
                                  step="0.25"
                                  value={t.hours}
                                  onChange={(e) => updateTechnician(t.id, "hours", e.target.value)}
                                />
                              </td>
                              <td className="py-1.5 pr-2">
                                <input
                                  className="input w-full"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={t.rate}
                                  onChange={(e) => updateTechnician(t.id, "rate", e.target.value)}
                                />
                              </td>
                              <td className="py-1.5 pr-2 text-right font-medium">
                                {((Number(t.hours) || 0) * (Number(t.rate) || 0)).toFixed(2)}
                              </td>
                              <td className="py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeTechnician(t.id)}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 dark:bg-slate-800 font-semibold border-t">
                            <td colSpan={4} className="py-3 px-4 text-right">
                              Labor Cost Subtotal
                            </td>
                            <td className="py-3 px-4 text-right text-brand-600">
                              {laborCost.toFixed(2)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Materials / Parts Used */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">
                        Materials & Parts Used
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {materials.filter((m) => m.description.trim()).length} line item(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-slate-600">Temporal Storage / Warehouse</label>
                          <select
                            className="input text-sm py-1"
                            value={form.warehouse_id}
                            onChange={(e) => update("warehouse_id", e.target.value)}
                          >
                            <option value="">-- Select --</option>
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.warehouse_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      <button
                        type="button"
                        onClick={addMaterial}
                        className="text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 rounded px-2 py-1"
                      >
                        + Add Line
                      </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table w-full">
                        <thead>
                          <tr>
                            <th className="w-1/2 min-w-[300px]">Item / Description</th>
                            <th className="w-24 min-w-[100px]">Available Qty</th>
                            <th className="w-32 min-w-[110px]">Required Qty</th>
                            <th className="w-24 min-w-[80px]">UOM</th>
                            <th className="w-32 min-w-[120px]">Cost Price</th>
                            <th className="w-20">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {materials.map((m) => {
                            const itemQuery = itemQueries[m.id] || '';
                            const showQuery = m.item_id ? m.itemName : (itemQuery || m.description);
                            const searchResults = itemQuery.trim() && !m.item_id ? filterByPrefix(availableItems, { query: itemQuery }) : [];
                            return (
                            <tr key={m.id} className="border-b border-slate-100">
                              <td className="py-1.5 pr-2">
                                <div className="relative">
                                  <input
                                    className="input w-full"
                                    value={showQuery}
                                    placeholder="Type to search items..."
                                    onChange={(e) => {
                                      setItemQueries({ ...itemQueries, [m.id]: e.target.value });
                                      updateMaterial(m.id, 'description', e.target.value);
                                      if (m.item_id) {
                                        updateMaterial(m.id, 'item_id', '');
                                        updateMaterial(m.id, 'itemName', '');
                                      }
                                    }}
                                  />
                                  {searchResults.length > 0 && !m.item_id && (
                                    <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                      {searchResults.map((sr) => (
                                        <div
                                          key={sr.id}
                                          className="p-2 hover:bg-slate-50 cursor-pointer text-sm"
                                          onClick={() => {
                                            updateMaterial(m.id, 'item_id', String(sr.id));
                                            updateMaterial(m.id, 'itemName', sr.item_name);
                                            updateMaterial(m.id, 'description', sr.item_name);
                                            updateMaterial(m.id, 'unit_cost', Number(sr.selling_price || 0));
                                            setItemQueries({ ...itemQueries, [m.id]: '' });
                                          }}
                                        >
                                          <div className="font-medium">{sr.item_name}</div>
                                          <div className="text-xs text-slate-500">{sr.item_code}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-1.5 pr-2">
                                <input className="input" value={m.availableQty || 0} disabled />
                              </td>
                              <td className="py-1.5 pr-2">
                                <input
                                  className="input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={m.qty}
                                  onChange={(e) => updateMaterial(m.id, 'qty', e.target.value)}
                                />
                              </td>
                              <td className="py-1.5 pr-2">
                                <select
                                  className="input"
                                  value={m.unit}
                                  onChange={(e) => updateMaterial(m.id, 'unit', e.target.value)}
                                >
                                  {UNITS.map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1.5 pr-2">
                                <input
                                  className="input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={m.unit_cost}
                                  onChange={(e) => updateMaterial(m.id, 'unit_cost', e.target.value)}
                                />
                              </td>
                              <td className="py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeMaterial(m.id)}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={4} className="pt-2 text-right text-xs text-slate-500">
                              Materials Cost Subtotal
                            </td>
                            <td className="pt-2 font-semibold">
                              {materialsCost.toFixed(2)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Cost Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <div className="text-xs text-slate-500">Labor Hours</div>
                      <div className="text-lg font-semibold">{totalLaborHours.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <div className="text-xs text-slate-500">Labor Cost</div>
                      <div className="text-lg font-semibold">{laborCost.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <div className="text-xs text-slate-500">Materials Cost</div>
                      <div className="text-lg font-semibold">{materialsCost.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-brand/10 border border-brand/30">
                      <div className="text-xs text-slate-500">Grand Total</div>
                      <div className="text-lg font-bold text-brand">{grandTotal.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="flex justify-between w-full pt-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setStep(1)}
                      >
                        &larr; Back
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={(e) => submit(e, null, true)}
                      >
                        Save & Exit
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn-success"
                      onClick={(e) => submit(e, 3)}
                    >
                      Next: Execution Details &rarr;
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Execution Details & Closing */}
            {step === 3 && (
              <div className="card">
                <div className="card-body space-y-4">
                  <div className="text-lg font-semibold">
                    Execution Details & Closing
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Job Order</label>
                      <select
                        className="input"
                        value={form.job_order_id}
                        onChange={(e) => update("job_order_id", e.target.value)}
                      >
                        <option value="">-- Select Job Order --</option>
                        {jobOrders.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.order_no} – {o.asset_name || ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">
                        Completion Status <span className="text-red-600">*</span>
                      </label>
                      <select
                        className="input"
                        value={workStatus}
                        onChange={(e) => setWorkStatus(e.target.value)}
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">End Date</label>
                      <input
                        className={`input ${errors.end_date ? "border-red-500" : ""}`}
                        type="date"
                        value={form.end_date}
                        onChange={(e) => update("end_date", e.target.value)}
                      
                        disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
                      />
                      {errors.end_date && (
                        <p className="text-xs text-red-500 mt-1">{errors.end_date}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">End Time</label>
                      <input
                        className="input"
                        type="time"
                        value={form.end_time}
                        onChange={(e) => update("end_time", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">
                      Work Performed Description <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      className="input"
                      rows={4}
                      value={form.work_done}
                      onChange={(e) => update("work_done", e.target.value)}
                      placeholder="Describe work performed..."
                    />
                  </div>

                  {/* Completion Checklist */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">
                        Completion Checklist
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {checklistProgress.done}/{checklistProgress.total || 0} tasks completed
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={addChecklistItem}
                        className="text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 rounded px-2 py-1"
                      >
                        + Add Task
                      </button>
                    </div>
                    <div className="space-y-2">
                      {checklist.map((c) => (
                        <div key={c.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={c.done}
                            onChange={(e) => updateChecklistItem(c.id, "done", e.target.checked)}
                            className="h-4 w-4"
                          />
                          <input
                            className="input flex-1"
                            value={c.task}
                            onChange={(e) => updateChecklistItem(c.id, "task", e.target.value)}
                            placeholder="Checklist task or safety step"
                          />
                          <button
                            type="button"
                            onClick={() => removeChecklistItem(c.id)}
                            className="text-red-500 hover:text-red-700 text-xs px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sign-off & Approval */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="font-semibold text-sm">Sign-off & Approval</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Sign-off By</label>
                        <input
                          className="input"
                          value={form.sign_off_by}
                          onChange={(e) => update("sign_off_by", e.target.value)}
                          placeholder="Supervisor or manager"
                        />
                      </div>
                      <div>
                        <label className="label">Sign-off Date</label>
                        <input
                          className="input"
                          type="date"
                          value={form.sign_off_date}
                          onChange={(e) => update("sign_off_date", e.target.value)}
                        
                          disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
                        />
                      </div>
                      <div>
                        <label className="label">Approval Status</label>
                        <select
                          className="input"
                          value={form.approval_status}
                          onChange={(e) => update("approval_status", e.target.value)}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="APPROVED">Approved</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Approved By</label>
                        <input
                          className="input"
                          value={form.approved_by}
                          onChange={(e) => update("approved_by", e.target.value)}
                          placeholder="Approver name"
                        />
                      </div>
                      <div>
                        <label className="label">Approval Date</label>
                        <input
                          className="input"
                          type="date"
                          value={form.approval_date}
                          onChange={(e) => update("approval_date", e.target.value)}
                        
                          disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">Approval Notes</label>
                        <textarea
                          className="input"
                          rows={2}
                          value={form.approval_notes}
                          onChange={(e) => update("approval_notes", e.target.value)}
                          placeholder="Reason for rejection, conditions of approval, etc."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between w-full pt-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setStep(2)}
                      >
                        &larr; Back
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={(e) => submit(e, null, true)}
                      >
                        Save & Exit
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn-success"
                      onClick={(e) => submit(e)}
                    >
                      Complete Job Execution
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
