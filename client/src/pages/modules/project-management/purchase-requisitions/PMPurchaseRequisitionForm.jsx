/**
 * @fileoverview PMPurchaseRequisitionForm component for Project Management.
 * Replicates the procurement module purchase requisition form design, code, and logic.
 */

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { api } from "../../../../api/client.js";
import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

export default function PMPurchaseRequisitionForm() {
  const { hasExceptional = () => false } = usePermission();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const reqId = params?.id && params.id !== "new" ? Number(params.id) : null;
  const isNew = !reqId;
  const isEditMode = location?.pathname?.endsWith("/edit") || searchParams.has("edit");
  const isViewMode = !isNew && !isEditMode;
  const canEdit = !isViewMode;
  const disabled = isViewMode;

  const [inventoryItems, setInventoryItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [headerData, setHeaderData] = useState(null);

  const [form, setForm] = useState({
    requisition_date: new Date().toISOString().slice(0, 10),
    requisition_type: "ITEM",
    project_id: "",
    department: "",
    requested_by: "",
    purpose: "",
    priority: "MEDIUM",
    required_date: "",
    remarks: "",
    timeline: "",
  });

  const [lines, setLines] = useState([
    {
      item_id: "",
      description: "",
      qty: 1,
      uom: "PCS",
      estimated_unit_cost: "",
      remarks: "",
    },
  ]);
  const [itemQueries, setItemQueries] = useState({});

  const serviceFlag = (it) => {
    const v = it?.service_item;
    if (v == null) return false;
    if (typeof v === "string") return v.toUpperCase() === "Y";
    return Number(v) === 1;
  };

  const itemOptions = useMemo(
    () => inventoryItems.filter((it) => !serviceFlag(it)),
    [inventoryItems],
  );
  const serviceOptions = useMemo(
    () => inventoryItems.filter((it) => serviceFlag(it)),
    [inventoryItems],
  );

  // Filter projects to only active projects from pm_projects table
  const activeProjects = useMemo(() => {
    const list = Array.isArray(projects) ? projects : projects?.items || [];
    return list.filter((p) => {
      if (form.project_id && String(form.project_id) === String(p.id)) return true;
      const st = String(p.project_status || p.status || "").toUpperCase();
      if (st === "COMPLETED" || st === "CANCELLED" || st === "ARCHIVED" || st === "INACTIVE") return false;
      const isActive =
        p.is_active === "Y" ||
        p.is_active === 1 ||
        p.is_active === "1" ||
        p.is_active === true ||
        p.is_active === null ||
        p.is_active === undefined ||
        st === "ACTIVE" ||
        st === "IN_PROGRESS" ||
        st === "PLANNING";
      return isActive;
    });
  }, [projects, form.project_id]);

  // Load reference data
  useEffect(() => {
    let mounted = true;
    async function loadReferenceData() {
      try {
        const [itemsRes, projRes, deptRes, uomRes, usersRes] = await Promise.all([
          api.get("/inventory/items").catch(() => ({ data: { items: [] } })),
          api.get("/projects/projects").catch(() => ({ data: { items: [] } })),
          api.get("/admin/departments").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/uoms").catch(() => ({ data: { items: [] } })),
          api.get("/admin/users", { params: { active: 1 } }).catch(() => ({ data: { items: [] } })),
        ]);
        if (mounted) {
          setInventoryItems(itemsRes?.data?.items || (Array.isArray(itemsRes?.data) ? itemsRes.data : []));
          setProjects(projRes?.data?.items || projRes?.data?.projects || (Array.isArray(projRes?.data) ? projRes.data : []));
          setDepartments(deptRes?.data?.items || (Array.isArray(deptRes?.data) ? deptRes.data : []));
          setUoms(uomRes?.data?.items || (Array.isArray(uomRes?.data) ? uomRes.data : []));
          const usersList =
            (usersRes?.data && usersRes.data.data && Array.isArray(usersRes.data.data.items) && usersRes.data.data.items) ||
            (Array.isArray(usersRes?.data?.items) && usersRes.data.items) ||
            (Array.isArray(usersRes?.data) && usersRes.data) ||
            [];
          setUsers(usersList);
        }
      } catch (err) {
        console.error("Failed to load reference data", err);
      }
    }
    loadReferenceData();
    return () => {
      mounted = false;
    };
  }, []);

  // Load existing requisition if editing/viewing
  useEffect(() => {
    if (!reqId) return;
    let mounted = true;
    async function loadExisting() {
      try {
        setLoading(true);
        const res = await api.get(`/projects/purchase-requisitions/${reqId}`);
        const data = res?.data;
        if (!data || !mounted) return;
        setHeaderData(data);
        setForm({
          requisition_date: String(data.requisition_date || "").slice(0, 10),
          requisition_type: data.requisition_type || "ITEM",
          project_id: data.project_id ? String(data.project_id) : "",
          department: data.department || "",
          requested_by: data.requested_by || "",
          purpose: data.purpose || "",
          priority: data.priority || "MEDIUM",
          required_date: data.required_date ? String(data.required_date).slice(0, 10) : "",
          remarks: data.remarks || "",
          timeline: data.timeline || "",
        });
        const existingItems = Array.isArray(data.items) ? data.items : [];
        if (existingItems.length) {
          setLines(
            existingItems.map((i) => ({
              item_id: i.item_id ? String(i.item_id) : "",
              description: i.description || i.item_name || "",
              qty: i.qty !== undefined ? Number(i.qty) : 1,
              uom: i.uom || "PCS",
              estimated_unit_cost: i.estimated_unit_cost !== undefined ? Number(i.estimated_unit_cost) : "",
              remarks: i.remarks || "",
            }))
          );
          const initQueries = {};
          existingItems.forEach((x, idx) => {
            initQueries[`item-${idx}`] = x.description || x.item_name || "";
            initQueries[`svc-${idx}`] = x.description || x.item_name || "";
          });
          setItemQueries(initQueries);
        }
      } catch (e) {
        toast.error("Failed to load purchase requisition");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadExisting();
    return () => {
      mounted = false;
    };
  }, [reqId]);

  function updateForm(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function updateLine(idx, key, val) {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  }

  function onItemChange(idx, itemId) {
    const item = inventoryItems.find((x) => String(x.id) === String(itemId));
    setLines((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        item_id: itemId,
        description: item ? item.item_name : next[idx].description,
        uom: item?.uom || next[idx].uom || "PCS",
        estimated_unit_cost: item?.cost_price ? Number(item.cost_price) : next[idx].estimated_unit_cost,
      };
      return next;
    });
    const key = form.requisition_type === "SERVICE" ? `svc-${idx}` : `item-${idx}`;
    setItemQueries((prev) => ({
      ...prev,
      [key]: item ? item.item_name : "",
    }));
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        item_id: "",
        description: "",
        qty: 1,
        uom: "PCS",
        estimated_unit_cost: "",
        remarks: "",
      },
    ]);
  }

  function removeLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
    setItemQueries((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => {
        const parts = k.split("-");
        const i = Number(parts[1]);
        if (i < idx) next[k] = prev[k];
        else if (i > idx) next[`${parts[0]}-${i - 1}`] = prev[k];
      });
      return next;
    });
  }

  const totals = useMemo(() => {
    let total = 0;
    for (const l of lines) {
      total += Number(l.qty || 0) * Number(l.estimated_unit_cost || 0);
    }
    return { total };
  }, [lines]);

  async function submit() {
    setSaving(true);
    setError("");
    try {
      if (!form.project_id) {
        setError("Project is required");
        toast.warn("Project is required");
        setSaving(false);
        return;
      }
      if (!form.requisition_date) {
        setError("Requisition date is required");
        toast.warn("Requisition date is required");
        setSaving(false);
        return;
      }

      const validLines = lines
        .filter((l) => (l.description && String(l.description).trim()) || l.item_id)
        .map((l) => ({
          item_id: l.item_id ? Number(l.item_id) : null,
          description: (l.description || "").trim(),
          qty: Number(l.qty || 0),
          uom: l.uom || "PCS",
          estimated_unit_cost: Number(l.estimated_unit_cost || 0),
          remarks: l.remarks || null,
        }));

      if (!validLines.length) {
        setError("Add at least one line item with a description");
        toast.warn("Add at least one line item with a description");
        setSaving(false);
        return;
      }

      const payload = {
        ...form,
        project_id: Number(form.project_id),
        status: headerData?.status || "DRAFT",
        items: validLines,
      };

      const resp = reqId
        ? await api.put(`/projects/purchase-requisitions/${reqId}`, payload)
        : await api.post("/projects/purchase-requisitions", payload);
      const data = resp?.data || {};
      toast.success(data.message || "Purchase requisition saved successfully");
      navigate("/project-management/purchase-requisitions", {
        state: { refresh: true, success: data.message },
      });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Failed to save";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-brand-400 flex items-center justify-center font-bold">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {reqId
                  ? isEditMode
                    ? "Edit Purchase Requisition"
                    : "View Purchase Requisition"
                  : "New Purchase Requisition"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {headerData?.requisition_no
                  ? `Requisition: ${headerData.requisition_no}`
                  : "Request items or services for project procurement"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/project-management/purchase-requisitions")}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft size={16} /> Back to List
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && <div className="alert alert-error">{error}</div>}
          
          {headerData?.status && (
            <div className="flex gap-2 items-center text-sm">
              <span className="font-semibold text-slate-500">Status:</span>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  headerData.status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-700"
                    : headerData.status === "REJECTED"
                    ? "bg-red-100 text-red-700"
                    : headerData.status === "PENDING_APPROVAL"
                    ? "bg-yellow-100 text-yellow-800"
                    : headerData.status === "SUBMITTED"
                    ? "bg-blue-100 text-blue-700"
                    : headerData.status === "CANCELLED"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {headerData.status}
              </span>
            </div>
          )}

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label">Requisition Type</label>
              <select
                className="input"
                value={form.requisition_type}
                onChange={(e) => updateForm("requisition_type", e.target.value)}
                disabled={disabled}
              >
                <option value="ITEM">Item / Material</option>
                <option value="SERVICE">Service</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Requisition Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="input"
                value={form.requisition_date}
                onChange={(e) => updateForm("requisition_date", e.target.value)}
                disabled={disabled}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Required By Date</label>
              <input
                type="date"
                className="input"
                value={form.required_date}
                onChange={(e) => updateForm("required_date", e.target.value)}
                disabled={disabled}
              />
            </div>

            {/* Project Field: Active projects from pm_projects */}
            <div className="flex flex-col gap-1">
              <label className="label">Project <span className="text-red-500">*</span></label>
              <select
                className="input"
                value={form.project_id}
                onChange={(e) => updateForm("project_id", e.target.value)}
                disabled={disabled}
                required
              >
                <option value="">-- Select Active Project --</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_code ? `${p.project_code} - ` : ""}{p.project_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Department</label>
              <select
                className="input"
                value={form.department}
                onChange={(e) => updateForm("department", e.target.value)}
                disabled={disabled}
              >
                <option value="">-- Select Department --</option>
                {departments.map((d) => {
                  const name = d.name || d.dept_name || "";
                  return (
                    <option key={d.id} value={name}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Requested By</label>
              <select
                className="input"
                value={form.requested_by}
                onChange={(e) => updateForm("requested_by", e.target.value)}
                disabled={disabled}
              >
                <option value="">-- Select User --</option>
                {users.map((u) => {
                  const uname = u.username || u.name || "";
                  return (
                    <option key={u.id} value={uname}>
                      {uname}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Priority</label>
              <select
                className="input"
                value={form.priority}
                onChange={(e) => updateForm("priority", e.target.value)}
                disabled={disabled}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="label">Timeline</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. 2 Weeks, Next Quarter..."
                value={form.timeline || ""}
                onChange={(e) => updateForm("timeline", e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label">Purpose / Justification</label>
              <textarea
                className="input w-full"
                rows="3"
                placeholder="Why is this purchase requisition needed for the project?"
                value={form.purpose}
                onChange={(e) => updateForm("purpose", e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Remarks</label>
              <textarea
                className="input w-full"
                rows="3"
                placeholder="Additional notes, specifications, or supplier references..."
                value={form.remarks}
                onChange={(e) => updateForm("remarks", e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Line Items Section */}
          <div className="mt-6">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
              {form.requisition_type === "SERVICE" ? "Services" : "Items"} Requested
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="table w-full" style={{ tableLayout: "auto" }}>
                <thead>
                  <tr>
                    <th className="w-full min-w-[300px]">Description</th>
                    <th className="w-24">Qty</th>
                    <th className="w-28">UOM</th>
                    <th className="w-36">Est. Unit Cost</th>
                    <th className="w-36 text-right">Est. Total</th>
                    {canEdit && <th className="w-20 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const lineTotal = Number(l.qty || 0) * Number(l.estimated_unit_cost || 0);
                    return (
                      <tr key={i}>
                        {/* Autocomplete Description Input */}
                        <td>
                          <div className="relative">
                            <input
                              id={`pm-pr-item-search-${i}`}
                              autoComplete="off"
                              className="input text-sm w-full"
                              placeholder={
                                form.requisition_type === "SERVICE"
                                  ? "Type to search services or enter description"
                                  : "Type to search items or enter description"
                              }
                              value={
                                itemQueries[form.requisition_type === "SERVICE" ? `svc-${i}` : `item-${i}`] !== undefined
                                  ? itemQueries[form.requisition_type === "SERVICE" ? `svc-${i}` : `item-${i}`]
                                  : l.description || ""
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                const queryKey = form.requisition_type === "SERVICE" ? `svc-${i}` : `item-${i}`;
                                setItemQueries((prev) => ({
                                  ...prev,
                                  [queryKey]: val,
                                }));
                                updateLine(i, "description", val);
                                if (!val && lines[i].item_id) {
                                  updateLine(i, "item_id", "");
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const queryKey = form.requisition_type === "SERVICE" ? `svc-${i}` : `item-${i}`;
                                  const query = (itemQueries[queryKey] || "").trim();
                                  const optionsList = form.requisition_type === "SERVICE" ? serviceOptions : itemOptions;
                                  const results = query
                                    ? filterByPrefix(optionsList, {
                                        query,
                                        searchFields: ["item_code", "item_name", "barcode"],
                                      })
                                    : [];
                                  if (!query || !results.length) return;
                                  onItemChange(i, String(results[0].id));
                                  setItemQueries((prev) => {
                                    const next = { ...prev };
                                    delete next[queryKey];
                                    return next;
                                  });
                                }
                              }}
                              disabled={disabled}
                            />
                            {(() => {
                              const queryKey = form.requisition_type === "SERVICE" ? `svc-${i}` : `item-${i}`;
                              const query = (itemQueries[queryKey] || "").trim();
                              const optionsList = form.requisition_type === "SERVICE" ? serviceOptions : itemOptions;
                              const results = query
                                ? filterByPrefix(optionsList, {
                                    query,
                                    searchFields: ["item_code", "item_name", "barcode"],
                                  })
                                : [];
                              return results.length ? (
                                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-auto">
                                  {results.map((o) => (
                                    <button
                                      type="button"
                                      key={o.id}
                                      className="block w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs border-b border-slate-100 dark:border-slate-700 last:border-0"
                                      onClick={() => {
                                        onItemChange(i, String(o.id));
                                        setItemQueries((prev) => {
                                          const next = { ...prev };
                                          delete next[queryKey];
                                          return next;
                                        });
                                      }}
                                    >
                                      <span className="font-semibold text-brand-700 dark:text-brand-400">{o.item_code}</span> - {o.item_name}
                                    </button>
                                  ))}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </td>

                        {/* Quantity */}
                        <td>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            className="input text-sm w-full"
                            value={l.qty}
                            onChange={(e) => updateLine(i, "qty", e.target.value)}
                            disabled={disabled}
                          />
                        </td>

                        {/* UOM */}
                        <td>
                          <select
                            className="input text-sm w-full"
                            value={l.uom}
                            onChange={(e) => updateLine(i, "uom", e.target.value)}
                            disabled={disabled}
                          >
                            <option value="">UOM</option>
                            {uoms.map((u) => (
                              <option key={u.id} value={u.uom_code}>
                                {u.uom_name ? `${u.uom_name} (${u.uom_code})` : u.uom_code}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Estimated Unit Cost */}
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="input text-sm w-full"
                            value={l.estimated_unit_cost}
                            onChange={(e) => updateLine(i, "estimated_unit_cost", e.target.value)}
                            disabled={disabled}
                          />
                        </td>

                        {/* Est. Total */}
                        <td className="text-right font-mono text-sm font-medium">
                          {lineTotal.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        {/* Remove Action */}
                        {canEdit && (
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-danger text-xs px-2 py-1"
                              onClick={() => removeLine(i)}
                            >
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {canEdit && (
              <div className="mt-3">
                <button type="button" className="btn btn-secondary text-xs inline-flex items-center gap-1.5" onClick={addLine}>
                  + Add Line
                </button>
              </div>
            )}
          </div>

          {/* Totals Summary */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl mt-5 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between py-2 text-lg font-bold text-brand-900 dark:text-brand-300">
              <span>TOTAL ESTIMATED COST:</span>
              <span className="font-mono">
                {totals.total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Actions: Save & Back */}
          {canEdit && (
            <div className="mt-6 flex justify-end gap-3 items-center">
              <button
                type="button"
                className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
                disabled={saving}
                onClick={submit}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => navigate("/project-management/purchase-requisitions")}
              >
                Back
              </button>
            </div>
          )}

          {isViewMode && (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="btn btn-secondary px-6 py-2"
                onClick={() => navigate("/project-management/purchase-requisitions")}
              >
                Back to List
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
