/**
 * @fileoverview ServiceExecutionForm component.
 * Provides functionality for ServiceExecutionForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import MaterialRequisitionForm from "../../inventory/MaterialRequisitionForm.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

function toYmd(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function ServiceExecutionForm() {
  const { id } = useParams();
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [executionId, setExecutionId] = useState(
    searchParams.get("id") || null,
  );
  const [step, setStep] = useState(1);
  const [workStatus, setWorkStatus] = useState("opened");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [executionDate, setExecutionDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [assignedSupervisor, setAssignedSupervisor] = useState("");

  const [materials, setMaterials] = useState([]);
  const [requisitionNotes, setRequisitionNotes] = useState("");
  const [invItems, setInvItems] = useState([]);
  const [supervisors, setSupervisors] = useState([]);

  const [workPerformed, setWorkPerformed] = useState("");

  const [actualEndTime, setActualEndTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [actualEndDate, setActualEndDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const totalDuration = useMemo(() => {
    try {
      const [sh, sm] = (scheduledTime || "00:00")
        .split(":")
        .map((x) => Number(x || 0));
      const [eh, em] = (actualEndTime || "00:00")
        .split(":")
        .map((x) => Number(x || 0));
      const start = sh + sm / 60;
      const end = eh + em / 60;
      const diff = end - start;
      return diff > 0 ? diff.toFixed(2) : "";
    } catch {
      return "";
    }
  }, [scheduledTime, actualEndTime]);

  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [customerFeedback, setCustomerFeedback] = useState("");
  const [satisfaction, setSatisfaction] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [closingFiles, setClosingFiles] = useState([]);
  const [confirmClosure, setConfirmClosure] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [executionNumber, setExecutionNumber] = useState("");

  const filteredOrders = useMemo(() => {
    const s = String(search || "").trim();
    if (!s) return orders.slice();
    return filterAndSort(orders, {
      query: s,
      getKeys: (o) => [o.orderNumber, o.customer, o.serviceType],
    });
  }, [search, orders]);

  useEffect(() => {
    let mounted = true;
    async function fetchOrders() {
      try {
        const resp = await api.get("/purchase/service-orders", {
          params: { type: "INTERNAL" },
        });
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        const mapped = rows.map((r) => ({
          id: r.id,
          orderNumber: r.order_no,
          customer: r.customer_name || "",
          serviceType: r.service_type || "",
          location: r.work_location || "",
          scheduledDate: r.order_date || "",
          status: r.status || "",
          estimatedCost: Number(r.total_amount || 0),
          assigned_supervisor_username: r.assigned_supervisor_username || "",
          assigned_supervisor_user_id: r.assigned_supervisor_user_id || null,
        }));
        if (mounted) setOrders(mapped);
      } catch {
        if (mounted) setOrders([]);
      }
    }
    const now = new Date();
    setExecutionDate(toYmd(now));
    setScheduledTime(
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    );
    setActualEndDate(toYmd(now));
    setActualEndTime(
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    );
    fetchOrders();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!executionId) return;
    let mounted = true;
    async function loadExecution() {
      try {
        const res = await api.get(
          `/purchase/service-executions/${executionId}`,
        );
        const ex = res.data?.item;
        if (!ex || !mounted) return;
        setExecutionDate(ex.execution_date ? toYmd(ex.execution_date) : "");
        setScheduledTime(ex.scheduled_time || "");
        setAssignedSupervisor(ex.assigned_supervisor_username || "");
        setWorkStatus((ex.work_status || "opened").toLowerCase());
        setExecutionNumber(ex.execution_no || "");
        setWorkPerformed(ex.work_performed_description || "");
        setActualEndTime(ex.actual_end_time || "");
        setActualEndDate(ex.actual_end_date ? toYmd(ex.actual_end_date) : "");
        setRequisitionNotes(ex.requisition_notes || "");
        setConfirmClosure(String(ex.status || "").toUpperCase() === "POSTED");
        setStep(Number(ex.current_step) || 1);
        if (ex.order_id) {
          setSelectedOrder({
            id: ex.order_id,
            orderNumber: ex.order_no || "",
            customer: ex.customer_name || "",
            serviceType: ex.service_category || "",
            location: ex.work_location || "",
            scheduledDate: ex.order_date || "",
            estimatedCost: Number(ex.total_amount || 0),
            assigned_supervisor_username:
              ex.order_supervisor_username ||
              ex.assigned_supervisor_username ||
              "",
            assigned_supervisor_user_id:
              ex.order_supervisor_user_id ||
              ex.assigned_supervisor_user_id ||
              null,
          });
        }
        const details = Array.isArray(ex.materials) ? ex.materials : [];
        if (details.length) {
          setMaterials(
            details.map((d) => ({
              id: d.id || crypto.randomUUID(),
              code: d.code
                ? String(d.code)
                : d.item_id
                  ? String(d.item_id)
                  : "",
              name: d.name || d.item_name || "",
              qty: d.qty || 1,
              unit: d.unit || "",
              note: d.note || "",
            })),
          );
        }
        if (ex.photos_json) {
          try {
            const p = JSON.parse(ex.photos_json);
            if (Array.isArray(p)) setClosingFiles(p);
          } catch {}
        }
      } catch {}
    }
    loadExecution();
    return () => {
      mounted = false;
    };
  }, [executionId]);

  useEffect(() => {
    if (selectedOrder) {
      setAssignedSupervisor(selectedOrder.assigned_supervisor_username || "");
      setCustomerName(selectedOrder.customer || "");
    }
  }, [selectedOrder]);

  function nextStep(n) {
    setStep(n);
  }

  function previousStep(n) {
    setStep(n);
  }
  function addMaterialItem() {
    setMaterials((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        code: "",
        name: "",
        qty: 1,
        unit: "",
        note: "",
      },
    ]);
  }
  function updateMaterial(id, key, value) {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [key]: value } : m)),
    );
  }
  function removeMaterial(id) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }
  function onFileAdd(setter) {
    return (e) => {
      const incoming = Array.from(e.target.files || []);
      setter((prev) => [...prev, ...incoming]);
      e.target.value = "";
    };
  }
  function formatMoney(n) {
    return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
  }
  useEffect(() => {
    let mounted = true;
    async function fetchItems() {
      try {
        const resp = await api.get("/inventory/items", {
          params: { active: 1 },
        });
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setInvItems(rows);
      } catch {
        if (mounted) setInvItems([]);
      }
    }
    async function fetchSupervisors() {
      try {
        const resp = await api.get("/purchase/service-setup/supervisors");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setSupervisors(rows);
      } catch {
        if (mounted) setSupervisors([]);
      }
    }
    fetchItems();
    fetchSupervisors();
    return () => {
      mounted = false;
    };
  }, []);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [modalMaterials, setModalMaterials] = useState([]);
  const [modalSearch, setModalSearch] = useState("");

  const filteredInvItems = useMemo(() => {
    const q = String(modalSearch || "")
      .trim()
      .toLowerCase();
    if (!q) return invItems;
    return invItems.filter(
      (it) =>
        String(it.item_name || "")
          .toLowerCase()
          .includes(q) ||
        String(it.item_code || "")
          .toLowerCase()
          .includes(q),
    );
  }, [invItems, modalSearch]);

  function openRequisitionModal() {
    setModalMaterials(
      materials.length > 0
        ? materials.map((m) => ({ ...m }))
        : [
            {
              id: crypto.randomUUID(),
              code: "",
              name: "",
              qty: 1,
              unit: "",
              note: "",
            },
          ],
    );
    setModalSearch("");
    setShowRequisitionModal(true);
  }

  function addModalMaterialItem() {
    setModalMaterials((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        code: "",
        name: "",
        qty: 1,
        unit: "",
        note: "",
      },
    ]);
  }

  function updateModalMaterial(id, key, value) {
    setModalMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [key]: value } : m)),
    );
  }

  function removeModalMaterial(id) {
    setModalMaterials((prev) => prev.filter((m) => m.id !== id));
  }

  function saveRequisitionModal() {
    setMaterials(modalMaterials.filter((m) => m.code || m.name));
    setShowRequisitionModal(false);
  }

  async function submit(e, nextStepNum, saveOnly = false) {
    if (e) e.preventDefault();
    const orderId = selectedOrder?.id || null;
    const isCompleting = !saveOnly && !nextStepNum;
    let finalStatus = "DRAFT";
    if (isCompleting) {
      finalStatus = "POSTED";
    }

    const payload = {
      order_id: orderId,
      execution_no: executionNumber || "",
      execution_date: executionDate || null,
      scheduled_time: scheduledTime || null,
      actual_end_date: actualEndDate || null,
      actual_end_time: actualEndTime || null,
      assigned_supervisor_user_id:
        selectedOrder?.assigned_supervisor_user_id || null,
      assigned_supervisor_username:
        assignedSupervisor ||
        selectedOrder?.assigned_supervisor_username ||
        null,
      requisition_notes: requisitionNotes || null,
      work_status: isCompleting ? "COMPLETED" : workStatus.toUpperCase(),
      status: finalStatus,
      work_performed_description: workPerformed || null,
      photos: closingFiles.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      })),
      materials: materials.map((m) => ({
        code: m.code || null,
        name: m.name || "",
        unit: m.unit || "",
        qty: Number(m.qty || 0) || 0,
        note: m.note || "",
      })),
      current_step: step,
    };

    try {
      if (executionId) {
        await api.put(`/purchase/service-executions/${executionId}`, payload);
      } else {
        const res = await api.post("/purchase/service-executions", payload);
        if (res.data?.id) {
          setExecutionId(res.data.id);
        }
        if (res.data?.execution_no) {
          setExecutionNumber(res.data.execution_no);
        }
      }

      if (nextStepNum) {
        setStep(nextStepNum);
      } else {
        navigate("/service-management/service-executions", {
          state: { success: "Service execution saved successfully" },
        });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save service execution");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold mt-2">
            Service Execution Management
          </h1>
          <p className="text-sm mt-1">
            Track and manage service execution from assignment to completion
          </p>
        </div>
      </div>

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
          <div>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              {step === 1 && (
                <div className="card">
                  <div className="card-body space-y-3">
                    <div className="text-lg font-semibold">
                      Service Order Reference
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="label">
                          Search Service Order{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <select
                          className="input"
                          value={selectedOrder?.id || ""}
                          onChange={(e) => {
                            const id = e.target.value;
                            const o = orders.find(
                              (x) => String(x.id) === String(id),
                            );
                            if (o) {
                              setSelectedOrder(o);
                              setSearch(o.orderNumber);
                            } else {
                              setSelectedOrder(null);
                              setSearch("");
                            }
                          }}
                        >
                          <option value="">
                            -- Select Internal Service Order --
                          </option>
                          {orders.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.orderNumber} • {o.customer} • {o.serviceType}
                            </option>
                          ))}
                        </select>
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
                          <option value="opened">Opened</option>
                          <option value="pending">Pending</option>
                          <option value="work in progress">
                            Work in Progress
                          </option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">
                          Execution Start Date{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <input
                          className="input"
                          type="date"
                          value={executionDate}
                          onChange={(e) => setExecutionDate(e.target.value)}
                        
                          disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
                        />
                      </div>
                      <div>
                        <label className="label">
                          Execution Start Time{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <input
                          className="input"
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">
                          Assigned Supervisor{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <input
                          className="input"
                          value={assignedSupervisor}
                          onChange={(e) =>
                            setAssignedSupervisor(e.target.value)
                          }
                          placeholder="Auto-filled from service order"
                          readOnly
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">Customer</label>
                        <input
                          className="input"
                          value={customerName}
                          readOnly
                          placeholder="Auto-filled from service order"
                        />
                      </div>
                    </div>
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
                        Next: Material Requisition &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="card">
                  <div className="card-body space-y-3">
                    <div className="text-lg font-semibold">
                      📦 Material Requisition from Stores
                    </div>

                    <div className="mb-4">
                      <label className="label">
                        Work Status <span className="text-red-600">*</span>
                      </label>
                      <select
                        className="input"
                        value={workStatus}
                        onChange={(e) => setWorkStatus(e.target.value)}
                      >
                        <option value="opened">Opened</option>
                        <option value="pending">Pending</option>
                        <option value="work in progress">
                          Work in Progress
                        </option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    <div className="text-sm bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      Materials will be checked against store inventory.
                      Unavailable items will be flagged for procurement.
                    </div>
                    <div className="space-y-2">
                      {materials.map((m) => (
                        <div
                          key={m.id}
                          className="grid grid-cols-1 md:grid-cols-[2fr_1fr_120px_120px_40px] gap-2 items-end p-3 bg-slate-50 rounded border"
                        >
                          <div>
                            <label className="label">Description</label>
                            <select
                              className="input"
                              value={m.code}
                              onChange={(e) => {
                                const val = e.target.value;
                                const item = invItems.find(
                                  (it) => String(it.id) === String(val),
                                );
                                updateMaterial(m.id, "code", val);
                                updateMaterial(
                                  m.id,
                                  "name",
                                  item?.item_name || "",
                                );
                                updateMaterial(m.id, "unit", item?.uom || "");
                              }}
                            >
                              <option value="">-- Select Item --</option>
                              {invItems.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.item_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="label">Qty</label>
                            <input
                              className="input"
                              type="number"
                              min="1"
                              value={m.qty}
                              onChange={(e) =>
                                updateMaterial(m.id, "qty", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <label className="label">Unit</label>
                            <input className="input" value={m.unit} readOnly />
                          </div>
                          <div>
                            <label className="label">Note</label>
                            <input
                              className="input"
                              value={m.note}
                              onChange={(e) =>
                                updateMaterial(m.id, "note", e.target.value)
                              }
                              placeholder="Optional note"
                            />
                          </div>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => removeMaterial(m.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div
                      className="card cursor-pointer hover:border-brand transition-colors"
                      onClick={openRequisitionModal}
                    >
                      <div className="card-body flex items-center gap-3 py-4">
                        <span className="text-2xl">📦</span>
                        <div>
                          <div className="font-semibold text-brand">
                            Open Material Requisition
                          </div>
                          <div className="text-xs text-slate-500">
                            Click to open the full material requisition form in
                            a modal
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between w-full pt-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => previousStep(1)}
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
                        Next: Execution & Closing &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="card">
                  <div className="card-body space-y-4">
                    <div className="text-lg font-semibold">
                      Execution & Closing
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="label">
                          Work Status <span className="text-red-600">*</span>
                        </label>
                        <select
                          className="input"
                          value={workStatus}
                          onChange={(e) => setWorkStatus(e.target.value)}
                        >
                          <option value="opened">Opened</option>
                          <option value="pending">Pending</option>
                          <option value="work in progress">
                            Work in Progress
                          </option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Execution End Date</label>
                        <input
                          type="date"
                          className="input"
                          value={actualEndDate}
                          onChange={(e) => setActualEndDate(e.target.value)}
                        
                          disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
                        />
                      </div>
                      <div>
                        <label className="label">Actual End Time</label>
                        <input
                          className="input"
                          type="time"
                          value={actualEndTime}
                          onChange={(e) => setActualEndTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Total Duration (hours)</label>
                        <input
                          className="input"
                          value={totalDuration}
                          readOnly
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">
                          Work Performed Description & Closing Rmarks{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          className="input w-1/2"
                          rows={6}
                          value={workPerformed}
                          onChange={(e) => setWorkPerformed(e.target.value)}
                          placeholder="Detailed description of work performed"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="label">
                            Completion Certificate/Photos
                          </label>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={onFileAdd(setClosingFiles)}
                          />
                          {closingFiles.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {closingFiles.map((f) => (
                                <div
                                  key={f.name}
                                  className="flex items-center justify-between p-2 border rounded"
                                >
                                  <div className="text-xs">
                                    {f.name} • {(f.size / 1024).toFixed(1)} KB
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="md:col-span-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={followUpRequired}
                            onChange={(e) =>
                              setFollowUpRequired(e.target.checked)
                            }
                          />
                          <span>Follow-up service required</span>
                        </div>
                        {followUpRequired && (
                          <div className="md:col-span-2">
                            <label className="label">Follow-up Details</label>
                            <textarea
                              className="input w-1/2"
                              rows={6}
                              value={followUpNotes}
                              onChange={(e) => setFollowUpNotes(e.target.value)}
                            />
                          </div>
                        )}
                        <div className="md:col-span-2 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded">
                          <input
                            type="checkbox"
                            checked={confirmClosure}
                            onChange={(e) =>
                              setConfirmClosure(e.target.checked)
                            }
                          />
                          <span className="font-medium">
                            I confirm that all work has been completed
                            satisfactorily and customer has approved the service
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between w-full pt-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => previousStep(2)}
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
                        disabled={!confirmClosure}
                      >
                        Complete Service Execution
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Success modal removed; navigation occurs after save */}

      {showRequisitionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-y-auto flex flex-col relative my-8">
            <MaterialRequisitionForm
              embedded={true}
              embeddedId="new"
              embeddedMode="service-execution"
              defaultStatus="POSTED"
              initialItems={invItems}
              onSave={() => {
                setShowRequisitionModal(false);
              }}
              onCancel={() => setShowRequisitionModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
