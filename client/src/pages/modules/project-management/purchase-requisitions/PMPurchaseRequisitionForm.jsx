/**
 * @fileoverview PMPurchaseRequisitionForm component.
 * Provides functionality for PMPurchaseRequisitionForm.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext";
import { useUoms } from "@/hooks/useUoms";
import { filterByPrefix } from "@/utils/searchUtils.js";

const priorities = [
  { value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" },
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PMPurchaseRequisitionForm() {
  const { uoms } = useUoms();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === "new";
  const isViewMode = !isNew && !searchParams.has("edit");
  const { canEditDiscount, hasExceptional } = usePermission();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemQueries, setItemQueries] = useState({});

  const [formData, setFormData] = useState({
    requisitionDate: new Date().toISOString().split("T")[0],
    projectId: "",
    department: "",
    requestedBy: "",
    purpose: "",
    priority: "MEDIUM",
    requiredDate: "",
    status: "DRAFT",
    remarks: "",
    timeline: "",
  });

  const [items, setItems] = useState([]);

  const statusColors = {
    DRAFT: "bg-gray-500 text-white",
    PENDING_APPROVAL: "bg-yellow-400 text-black",
    APPROVED: "bg-green-500 text-white",
    REJECTED: "bg-red-500 text-white",
    CANCELLED: "bg-red-500 text-white",
    FULFILLED: "bg-blue-500 text-white",
  };

  const readOnly = isViewMode || !["DRAFT", "REJECTED"].includes(formData.status);

  useEffect(() => {
    let mounted = true;
    const getItems = (r) => (Array.isArray(r.data?.data?.items) ? r.data.data.items : (Array.isArray(r.data?.items) ? r.data.items : []));
    api.get("/projects/projects").then(res => {
      if (!mounted) return;
      setProjects(getItems(res));
    }).catch(() => {});
    api.get("/admin/departments").then(res => {
      if (!mounted) return;
      setDepartments(getItems(res));
    }).catch(() => {});
    api.get("/admin/users", { params: { active: 1 } }).then(res => {
      if (!mounted) return;
      setUsers(getItems(res));
    }).catch(() => {});
    api.get("/inventory/items").then(res => {
      if (!mounted) return;
      setAvailableItems(getItems(res));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    setLoading(true);
    setError("");

    api.get(`/projects/purchase-requisitions/${id}`).then(res => {
      if (!mounted) return;
      const d = res.data;
      if (!d) return;
      setFormData({
        requisitionDate: d.requisition_date ? d.requisition_date.split("T")[0] : "",
        projectId: String(d.project_id || ""),
        department: d.department || "",
        requestedBy: d.requested_by || "",
        purpose: d.purpose || "",
        priority: d.priority || "MEDIUM",
        requiredDate: d.required_date ? d.required_date.split("T")[0] : "",
        status: d.status || "DRAFT",
        remarks: d.remarks || "",
        timeline: d.timeline || "",
      });
      const its = Array.isArray(d.items) ? d.items : [];
      if (its.length) {
        setItems(its.map(x => ({
          id: x.id || Date.now() + Math.random(),
          item_id: x.item_id ? String(x.item_id) : "",
          itemCode: x.item_code || "",
          itemName: x.item_name || x.description || "",
          description: x.description || "",
          qty: Number(x.qty || 0),
          uom: x.uom || "PCS",
          estimatedUnitCost: Number(x.estimated_unit_cost || 0),
          estimatedTotal: Number(x.qty || 0) * Number(x.estimated_unit_cost || 0),
        })));
        const initQueries = {};
        its.forEach(x => { initQueries[x.id || Date.now()] = x.item_name || x.description || ""; });
        setItemQueries(initQueries);
      }
    }).catch(e => {
      if (!mounted) return;
      setError(e?.response?.data?.message || "Failed to load purchase requisition");
    }).finally(() => {
      if (!mounted) return;
      setLoading(false);
    });

    return () => { mounted = false; };
  }, [id, isNew]);



  const handleSelectItem = (rowId, item) => {
    setItems(items.map(i =>
      i.id === rowId ? {
        ...i, item_id: String(item.id), itemCode: item.item_code || "",
        itemName: item.item_name || "", uom: item.uom || "PCS",
      } : i,
    ));
    setItemQueries(prev => ({ ...prev, [rowId]: item.item_name || "" }));
  };

  const addItem = () => {
    const newId = Date.now();
    setItems([...items, {
      id: newId, item_id: "", itemCode: "", itemName: "", description: "",
      qty: 1, uom: "PCS", estimatedUnitCost: "", estimatedTotal: 0,
    }]);
    setItemQueries(prev => ({ ...prev, [newId]: "" }));
  };

  const removeItem = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItemField = (id, field, val) => {
    setItems(items.map(i => {
      if (i.id !== id) return i;
      const u = { ...i, [field]: val };
      if (field === "qty" || field === "estimatedUnitCost") {
        u.estimatedTotal = Number(u.qty || 0) * Number(u.estimatedUnitCost || 0);
      }
      return u;
    }));
  };

  const normalizedDetails = useMemo(() => {
    return items.filter(i => i.item_id || i.description).map(i => ({
      item_id: i.item_id ? Number(i.item_id) : null,
      description: i.description || i.itemName || "",
      qty: Number(i.qty || 0),
      uom: i.uom || "PCS",
      estimated_unit_cost: Number(i.estimatedUnitCost || 0),
    }));
  }, [items]);

  const effectiveTotal = useMemo(() => {
    return items.reduce((s, i) => s + Number(i.estimatedTotal || 0), 0);
  }, [items]);

  const buildPayload = () => {
    return {
      requisition_date: formData.requisitionDate || null,
      project_id: formData.projectId ? Number(formData.projectId) : null,
      department: formData.department || null,
      requested_by: formData.requestedBy || null,
      purpose: formData.purpose || null,
      priority: formData.priority,
      required_date: formData.requiredDate || null,
      status: formData.status || "DRAFT",
      remarks: formData.remarks || null,
      timeline: formData.timeline || null,
      items: normalizedDetails,
    };
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload();
      if (isNew) {
        await api.post("/projects/purchase-requisitions", payload);
      } else {
        await api.put(`/projects/purchase-requisitions/${id}`, payload);
      }
      navigate("/project-management/purchase-requisitions", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleSubmitApproval = async () => {
    if (!formData.requisitionDate || items.length === 0) { setError("Complete the form first"); return; }
    setSubmitting(true);
    setError("");
    try {
      const payload = buildPayload();
      if (isNew) {
        const res = await api.post("/projects/purchase-requisitions", payload);
        if (res.data?.id) await api.post(`/projects/purchase-requisitions/${res.data.id}/submit`);
      } else {
        await api.put(`/projects/purchase-requisitions/${id}`, payload);
        await api.post(`/projects/purchase-requisitions/${id}/submit`);
      }
      navigate("/project-management/purchase-requisitions", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to submit");
    } finally { setSubmitting(false); }
  };

  const handleCancel = async () => {
    if (!window.confirm("Cancel this purchase requisition?")) return;
    try {
      await api.delete(`/projects/purchase-requisitions/${id}`);
      navigate("/project-management/purchase-requisitions", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to cancel");
    }
  };

  const handlePdf = () => { if (id) window.print(); };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew ? "New Purchase Requisition" : "Edit Purchase Requisition"}
              </h1>
              <p className="text-sm mt-1">Request materials for project procurement</p>
            </div>
            <div className="flex gap-2">
              {!isNew && (
                <button type="button" onClick={handlePdf}
                  className="btn btn-secondary text-xs px-3 py-1">PDF</button>
              )}
              <button onClick={() => window.history.back()} className="btn-success">Back</button>
            </div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSave} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Requisition Date *</label>
                <input type="date" className="input" value={formData.requisitionDate}
                  onChange={e => setFormData({ ...formData, requisitionDate: e.target.value })} required disabled={readOnly} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Project</label>
                <select className="input" value={formData.projectId}
                  onChange={e => setFormData({ ...formData, projectId: e.target.value })} disabled={readOnly}>
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })} disabled={readOnly}>
                  {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <div className="pt-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[formData.status] || "bg-gray-500 text-white"}`}>
                    {formData.status === "PENDING_APPROVAL" ? "Pending Approval" : formData.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Department</label>
                <select className="input" value={formData.department}
                  onChange={e => setFormData({ ...formData, department: e.target.value })} disabled={readOnly}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Requested By</label>
                <select className="input" value={formData.requestedBy}
                  onChange={e => setFormData({ ...formData, requestedBy: e.target.value })} disabled={readOnly}>
                  <option value="">Select User</option>
                  {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Required Date</label>
                <input type="date" className="input" value={formData.requiredDate}
                  onChange={e => setFormData({ ...formData, requiredDate: e.target.value })} disabled={readOnly} />
              </div>
              <div>
                <label className="label">Timeline</label>
                <input type="text" className="input" value={formData.timeline}
                  onChange={e => setFormData({ ...formData, timeline: e.target.value })} disabled={readOnly} placeholder="e.g. 2 Weeks, Next Quarter..." />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Purpose / Justification</label>
                <textarea className="input w-full" rows="2" value={formData.purpose}
                  onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                  disabled={readOnly} placeholder="Describe the purpose..."></textarea>
              </div>
              <div>
                <label className="label">Remarks</label>
                <textarea className="input w-full" rows="2" value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  disabled={readOnly} placeholder="Enter any additional notes..."></textarea>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Items</h3>
                {!readOnly && <button type="button" onClick={addItem} className="btn-success text-sm">+ Add Item</button>}
              </div>

              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="w-1/3 min-w-[250px]">Item Name</th>
                      <th className="w-48 min-w-[180px]">Description</th>
                      <th className="w-32 min-w-[120px] text-right">Qty</th>
                      <th className="w-32 min-w-[120px]">UOM</th>
                      <th className="w-24 text-right">Unit Cost</th>
                      <th className="w-24 text-right">Total</th>
                      {!readOnly && <th className="w-20">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan={readOnly ? 6 : 7} className="text-center py-8 text-slate-400">No items added</td></tr>
                    ) : items.map((item) => {
                      const itemQuery = itemQueries[item.id] || "";
                      const showQuery = item.item_id ? item.itemName : itemQuery;
                      const searchResults = itemQuery.trim() && !item.item_id && !readOnly
                        ? filterByPrefix(availableItems, { query: itemQuery, searchFields: ["item_code", "item_name", "barcode"] })
                        : [];
                      return (
                        <tr key={item.id}>
                          <td>
                            {readOnly ? (
                              <span className="text-sm">{item.itemName || item.description}</span>
                            ) : (
                              <div className="relative">
                                <input id={`pm-pr-item-search-${item.id}`} autoComplete="off"
                                  className="input w-full" placeholder="Type to search items"
                                  value={showQuery}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setItemQueries(prev => ({ ...prev, [item.id]: val }));
                                    if (item.item_id) {
                                      setItems(items.map(i =>
                                        i.id === item.id ? { ...i, item_id: "", itemCode: "", itemName: "" } : i,
                                      ));
                                    }
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") {
                                      const query = (itemQueries[item.id] || "").trim();
                                      if (!query || !searchResults.length) return;
                                      handleSelectItem(item.id, searchResults[0]);
                                    }
                                  }}
                                />
                                {searchResults.length ? (() => {
                                  const el = document.getElementById(`pm-pr-item-search-${item.id}`);
                                  const r = el ? el.getBoundingClientRect() : { bottom: 0, left: 0, width: 0 };
                                  return (
                                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto"
                                      style={{ position: 'fixed', top: `${r.bottom + 4}px`, left: `${r.left}px`, width: `${r.width}px`, zIndex: 9999 }}>
                                      {searchResults.map(o => (
                                        <button type="button" key={o.id}
                                          className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs"
                                          onClick={() => handleSelectItem(item.id, o)}>
                                          {o.item_code} - {o.item_name}
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })() : null}
                              </div>
                            )}
                          </td>
                          <td>
                            {readOnly ? (
                              <span className="text-xs text-slate-500">{item.description || "-"}</span>
                            ) : (
                              <input type="text" className="input w-full" placeholder="Description"
                                value={item.description || ""}
                                onChange={e => updateItemField(item.id, "description", e.target.value)} />
                            )}
                          </td>
                          <td>
                            {readOnly ? (
                              <span className="text-sm block text-right">{item.qty}</span>
                            ) : (
                              <input type="number" className="input w-full text-right" value={item.qty}
                                onChange={e => updateItemField(item.id, "qty", Math.max(0, parseInt(e.target.value, 10) || 0))}
                                min="1" />
                            )}
                          </td>
                          <td>
                            {readOnly ? (
                              <span className="text-sm">{item.uom}</span>
                            ) : (
                              <select className="input w-full" value={item.uom || "PCS"}
                                onChange={e => updateItemField(item.id, "uom", e.target.value)}>
                                {(Array.isArray(uoms) && uoms.length ? uoms.map(u => ({ code: u.uom_code || u.code || "", name: u.uom_name || u.name || "" }))
                                  : [{ code: "EA", name: "EA" }, { code: "PCS", name: "PCS" }, { code: "KG", name: "KG" }, { code: "LTR", name: "LTR" }, { code: "MTR", name: "MTR" }]
                                ).map(u => (
                                  <option key={u.code} value={u.code}>{u.name ? `${u.name} (${u.code})` : u.code}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td>
                            {readOnly ? (
                              <span className="text-sm block text-right">{Number(item.estimatedUnitCost).toFixed(2)}</span>
                            ) : (
                              <input type="number" step="0.01" className="input w-full text-right" value={item.estimatedUnitCost}
                                onChange={e => updateItemField(item.id, "estimatedUnitCost", e.target.value === "" ? "" : Number(e.target.value))} />
                            )}
                          </td>
                          <td className="text-right font-semibold text-sm">
                            {Number(item.estimatedTotal || 0).toFixed(2)}
                          </td>
                          {!readOnly && (
                            <td>
                              <button type="button" onClick={() => removeItem(item.id)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium">Remove</button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {items.length > 0 && (
                <div className="flex justify-end pt-4">
                  <div className="bg-slate-50 rounded-lg px-6 py-3">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-500">Items: <strong>{items.length}</strong></span>
                      <span className="text-sm text-slate-500">Total Qty: <strong>{items.reduce((s, i) => s + Number(i.qty || 0), 0)}</strong></span>
                      <span className="text-base font-bold text-slate-900">Estimated Total: <span className="text-brand-900">{effectiveTotal.toFixed(2)}</span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Link to="/project-management/purchase-requisitions"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">Close</Link>
              {!readOnly && (formData.status === "DRAFT" || formData.status === "REJECTED") && (
                <>
                  <button type="submit" className="btn-success" disabled={saving}>
                    {saving ? "Saving..." : "Save Draft"}
                  </button>
                  <button type="button" onClick={handleSubmitApproval}
                    className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit for Approval"}
                  </button>
                </>
              )}
              {!isNew && formData.status === "PENDING_APPROVAL" && hasExceptional("PM.PR.CANCEL") && (
                <button type="button" onClick={handleCancel}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">Cancel Requisition</button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}