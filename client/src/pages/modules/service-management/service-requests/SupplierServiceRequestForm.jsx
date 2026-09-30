/**
 * @fileoverview SupplierServiceRequestForm component.
 * Provides functionality for SupplierServiceRequestForm.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../../api/client.js";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SupplierServiceRequestForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const grId = params?.id ? Number(params.id) : null;
  const isEditMode = location?.pathname?.endsWith("/edit");
  const isViewMode = grId && !isEditMode;

  const [inventoryItems, setInventoryItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [users, setUsers] = useState([]);
  const [timelines, setTimelines] = useState([]);
  const [workLocations, setWorkLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    requisition_date: new Date().toISOString().slice(0, 10),
    requisition_type: "SERVICE",
    department: "",
    requested_by: "",
    purpose: "",
    priority: "MEDIUM",
    required_date: "",
    remarks: "",
    timeline: "",
    work_location: "",
  });

  const [lines, setLines] = useState([
    {
      item_id: "",
      description: "",
      qty: "",
      uom: "",
      estimated_unit_cost: "",
      remarks: "",
    },
  ]);
  const [itemQueries, setItemQueries] = useState({});
  const searchInputRefs = useRef({});
  const [dropdownPos, setDropdownPos] = useState(null);

  const [headerData, setHeaderData] = useState(null);

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

  // Load reference data
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [itemsRes, deptRes, uomRes, usersRes, timelinesRes, wlRes] = await Promise.all([
          api.get("/inventory/items").catch(() => ({ data: { items: [] } })),
          api.get("/admin/departments").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/uoms").catch(() => ({ data: { items: [] } })),
          api
            .get("/admin/users", { params: { active: 1 } })
            .catch(() => ({ data: { items: [] } })),
          api.get("/purchase/service-setup/timelines").catch(() => ({ data: { items: [] } })),
          api.get("/purchase/service-setup/work-locations").catch(() => ({ data: { items: [] } })),
        ]);
        if (mounted) {
          setInventoryItems(itemsRes?.data?.items || []);
          setDepartments(deptRes?.data?.items || []);
          setUoms(uomRes?.data?.items || []);
          const usersItems =
            (usersRes?.data &&
              usersRes.data.data &&
              Array.isArray(usersRes.data.data.items) &&
              usersRes.data.data.items) ||
            (Array.isArray(usersRes?.data?.items) && usersRes.data.items) ||
            [];
          setUsers(usersItems);
          setTimelines(timelinesRes?.data?.items || []);
          setWorkLocations(wlRes?.data?.items || []);
        }
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Load existing if editing/viewing
  useEffect(() => {
    if (!grId) return;
    let mounted = true;
    async function loadExisting() {
      try {
        const res = await api.get(`/purchase/general-requisitions/${grId}`);
        const data = res?.data;
        if (!data || !mounted) return;
        setHeaderData(data);
        setForm({
          requisition_date: String(data.requisition_date || "").slice(0, 10),
          requisition_type: data.requisition_type || "SERVICE",
          department: data.department || "",
          requested_by: data.requested_by || "",
          purpose: data.purpose || "",
          priority: data.priority || "MEDIUM",
          required_date: data.required_date
            ? String(data.required_date).slice(0, 10)
            : "",
          remarks: data.remarks || "",
          timeline: data.timeline || "",
          work_location: data.work_location || "",
        });
        const existingItems = Array.isArray(data.items) ? data.items : [];
        setLines(
          existingItems.length
            ? existingItems.map((i) => ({
                item_id: i.item_id || "",
                description: i.description || "",
                qty: i.qty || "",
                uom: i.uom || "",
                estimated_unit_cost: i.estimated_unit_cost || "",
                remarks: i.remarks || "",
              }))
            : [
                {
                  item_id: "",
                  description: "",
                  qty: "",
                  uom: "",
                  estimated_unit_cost: "",
                  remarks: "",
                },
              ],
        );
      } catch {
        toast.error("Failed to load requisition");
      }
    }
    loadExisting();
    return () => {
      mounted = false;
    };
  }, [grId]);

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
    const item = inventoryItems.find((x) => Number(x.id) === Number(itemId));
    setLines((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        item_id: itemId,
        description: item ? item.item_name : next[idx].description,
        uom: item?.uom || next[idx].uom || "PCS",
        estimated_unit_cost: item?.cost_price
          ? Number(item.cost_price)
          : next[idx].estimated_unit_cost,
      };
      return next;
    });
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        item_id: "",
        description: "",
        qty: "",
        uom: "",
        estimated_unit_cost: "",
        remarks: "",
      },
    ]);
  }

  function removeLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const totals = useMemo(() => {
    let total = 0;
    for (const l of lines) {
      total += Number(l.qty || 0) * Number(l.estimated_unit_cost || 0);
    }
    return { total };
  }, [lines]);

  async function submit(action) {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        status: action === "submit" ? "SUBMITTED" : "DRAFT",
        items: lines
          .filter((l) => l.description)
          .map((l) => ({
            item_id: l.item_id ? Number(l.item_id) : null,
            description: l.description,
            qty: Number(l.qty || 0),
            uom: l.uom || null,
            estimated_unit_cost: Number(l.estimated_unit_cost || 0),
            remarks: l.remarks || null,
          })),
      };
      if (!payload.items.length) {
        setError("Add at least one line item with a description");
        setSaving(false);
        return;
      }
      const resp = grId
        ? await api.put(`/purchase/general-requisitions/${grId}`, payload)
        : await api.post("/purchase/general-requisitions", payload);
      const data = resp?.data || {};
      toast.success(data.message || "Saved successfully");
      navigate("/service-management/supplier-service-requests", {
        state: { success: data.message },
      });
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const disabled = isViewMode;
  const canEdit = !isViewMode;

  return (
    <div className="p-6">
      <div className="rounded-lg border border-[#dee2e6] bg-white dark:bg-slate-800 shadow-erp">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-brand text-white rounded-t-lg flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {grId
                ? isEditMode
                  ? "Edit Supplier Service Request"
                  : "View Supplier Service Request"
                : "New Supplier Service Request"}
            </h1>
            <p className="text-sm mt-1 opacity-90">
              {headerData?.requisition_no
                ? `Requisition: ${headerData.requisition_no}`
                : "Request items or services for purchase"}
            </p>
          </div>
          <button onClick={() => window.history.back()} className="px-3 py-1.5 rounded bg-white text-brand hover:bg-slate-100 text-sm font-semibold"
          >
            ← Back to List
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

          {/* Form Fields */}
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
              <label className="label">Requisition Date</label>
              <input
                type="date"
                className="input"
                value={form.requisition_date}
                onChange={(e) => updateForm("requisition_date", e.target.value)}
                disabled={disabled}
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
            <div className="flex flex-col gap-1">
              <label className="label">Department</label>
              <select
                className="input"
                value={form.department}
                onChange={(e) => updateForm("department", e.target.value)}
                disabled={disabled}
              >
                <option value="">Select Department</option>
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
                <option value="">Select user</option>
                {users.map((u) => {
                  const uname = u.username || "";
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
            <div className="flex flex-col gap-1">
              <label className="label">Timeline</label>
              <select
                className="input"
                value={form.timeline || ""}
                onChange={(e) => updateForm("timeline", e.target.value)}
                disabled={disabled}
              >
                <option value="">Select timeline</option>
                {timelines.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Work Location</label>
              <select
                className="input"
                value={form.work_location || ""}
                onChange={(e) => updateForm("work_location", e.target.value)}
                disabled={disabled}
              >
                <option value="">Select work location</option>
                {workLocations.map((wl) => (
                  <option key={wl.id} value={wl.name}>{wl.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label">Purpose / Justification</label>
              <textarea
                className="input w-full"
                rows="4"
                placeholder="Why is this needed?"
                value={form.purpose}
                onChange={(e) => updateForm("purpose", e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Remarks</label>
              <textarea
                className="input w-full"
                rows="4"
                value={form.remarks}
                onChange={(e) => updateForm("remarks", e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="mt-6">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
              {form.requisition_type === "SERVICE" ? "Services" : "Items"}{" "}
              Requested
            </h3>
            <div
              className="rounded border border-[#dee2e6] overflow-x-auto"
            >
              <table className="table w-full" style={{ tableLayout: "auto" }}>
                <thead>
                  <tr>
                    {form.requisition_type === "ITEM" && (
                      <th className="w-full min-w-[300px]">Description</th>
                    )}
                    {form.requisition_type === "SERVICE" && (
                      <th className="w-full min-w-[300px]">Description</th>
                    )}
                    <th className="w-20">Qty</th>
                    <th className="w-24">UOM</th>
                    <th className="w-32">Est. Unit Cost</th>
                    <th className="w-32 text-right">
                      Est. Total
                    </th>
                    {canEdit && <th className="w-20"></th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const lineTotal =
                      Number(l.qty || 0) * Number(l.estimated_unit_cost || 0);
                    return (
                      <tr key={i}>
                        {form.requisition_type === "ITEM" && (
                          <td>
                            <div className="relative">
                              <input
                                id={`gr-item-search-${i}`}
                                autoComplete="off"
                                className="input text-sm w-full"
                                placeholder="Type to search items"
                                value={
                                  itemQueries[`item-${i}`] !== undefined
                                    ? itemQueries[`item-${i}`]
                                    : l.description || ""
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItemQueries((prev) => ({
                                    ...prev,
                                    [`item-${i}`]: val,
                                  }));
                                  if (!val && lines[i].item_id) {
                                    updateLine(i, "item_id", "");
                                    updateLine(i, "description", "");
                                    updateLine(i, "uom", "");
                                    updateLine(i, "estimated_unit_cost", "");
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const query = (
                                      itemQueries[`item-${i}`] || ""
                                    ).trim();
                                    const results = query
                                      ? filterByPrefix(itemOptions, {
                                          query,
                                          searchFields: [
                                            "item_code",
                                            "item_name",
                                            "barcode",
                                          ],
                                        })
                                      : [];
                                    if (!query || !results.length) return;
                                    onItemChange(i, String(results[0].id));
                                    setItemQueries((prev) => {
                                      const next = { ...prev };
                                      delete next[`item-${i}`];
                                      return next;
                                    });
                                  }
                                }}
                                disabled={disabled}
                              />
                              {(() => {
                                const query = (
                                  itemQueries[`item-${i}`] || ""
                                ).trim();
                                const results = query
                                  ? filterByPrefix(itemOptions, {
                                      query,
                                      searchFields: [
                                        "item_code",
                                        "item_name",
                                        "barcode",
                                      ],
                                    })
                                  : [];
                                return results.length ? (
                                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                                    {results.map((o) => (
                                      <button
                                        type="button"
                                        key={o.id}
                                        className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs"
                                        onClick={() => {
                                          onItemChange(i, String(o.id));
                                          setItemQueries((prev) => {
                                            const next = { ...prev };
                                            delete next[`item-${i}`];
                                            return next;
                                          });
                                        }}
                                      >
                                        {o.item_code} - {o.item_name}
                                      </button>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </td>
                        )}
                        {form.requisition_type === "SERVICE" && (
                          <td>
                            <div className="relative">
                              <input
                                id={`gr-svc-search-${i}`}
                                autoComplete="off"
                                className="input text-sm w-full"
                                placeholder="Type to search services"
                                value={
                                  itemQueries[`svc-${i}`] !== undefined
                                    ? itemQueries[`svc-${i}`]
                                    : l.description || ""
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItemQueries((prev) => ({
                                    ...prev,
                                    [`svc-${i}`]: val,
                                  }));
                                  if (!val && lines[i].item_id) {
                                    updateLine(i, "item_id", "");
                                    updateLine(i, "description", "");
                                    updateLine(i, "uom", "");
                                    updateLine(i, "estimated_unit_cost", "");
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const query = (
                                      itemQueries[`svc-${i}`] || ""
                                    ).trim();
                                    const results = query
                                      ? filterByPrefix(serviceOptions, {
                                          query,
                                          searchFields: [
                                            "item_code",
                                            "item_name",
                                            "barcode",
                                          ],
                                        })
                                      : [];
                                    if (!query || !results.length) return;
                                    onItemChange(i, String(results[0].id));
                                    setItemQueries((prev) => {
                                      const next = { ...prev };
                                      delete next[`svc-${i}`];
                                      return next;
                                    });
                                  }
                                }}
                                disabled={disabled}
                              />
                              {(() => {
                                const query = (
                                  itemQueries[`svc-${i}`] || ""
                                ).trim();
                                const results = query
                                  ? filterByPrefix(serviceOptions, {
                                      query,
                                      searchFields: [
                                        "item_code",
                                        "item_name",
                                        "barcode",
                                      ],
                                    })
                                  : [];
                                return results.length ? (
                                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                                    {results.map((o) => (
                                      <button
                                        type="button"
                                        key={o.id}
                                        className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs"
                                        onClick={() => {
                                          onItemChange(i, String(o.id));
                                          setItemQueries((prev) => {
                                            const next = { ...prev };
                                            delete next[`svc-${i}`];
                                            return next;
                                          });
                                        }}
                                      >
                                        {o.item_name}
                                      </button>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </td>
                        )}
                        <td>
                          <input
                            type="number"
                            className="input text-sm"
                            value={l.qty}
                            onChange={(e) =>
                              updateLine(i, "qty", e.target.value)
                            }
                            disabled={disabled}
                          />
                        </td>
                        <td>
                          <select
                            className="input text-sm"
                            value={l.uom}
                            onChange={(e) =>
                              updateLine(i, "uom", e.target.value)
                            }
                            disabled={disabled}
                          >
                            <option value="">UOM</option>
                            {uoms.map((u) => (
                              <option key={u.id} value={u.uom_code}>
                                {u.uom_name
                                  ? `${u.uom_name} (${u.uom_code})`
                                  : u.uom_code}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input text-sm"
                            value={l.estimated_unit_cost}
                            onChange={(e) =>
                              updateLine(
                                i,
                                "estimated_unit_cost",
                                e.target.value,
                              )
                            }
                            disabled={disabled}
                          />
                        </td>
                        <td className="text-right font-mono text-sm font-medium">
                          {lineTotal.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        {canEdit && (
                          <td>
                            <button
                              className="text-xs text-red-600 hover:text-red-800 underline whitespace-nowrap"
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
                <button className="btn btn-success" onClick={addLine}>
                  + Add Line
                </button>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="bg-[#f8f9fa] dark:bg-slate-700/40 p-5 rounded-lg mt-5 border border-[#dee2e6] dark:border-slate-600">
            <div className="flex justify-between py-3 text-lg font-bold text-[#0E3646] dark:text-slate-200">
              <span>TOTAL ESTIMATED COST:</span>
              <span>
                {totals.total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="mt-6 flex justify-end gap-3 items-center">
              <button
                type="button"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-brand hover:opacity-90 shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                disabled={saving}
                onClick={() => submit("draft")}
              >
                Save
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 shadow-sm"
                onClick={() => navigate("/service-management/supplier-service-requests")}
              >
                Back
              </button>
            </div>
          )}

          {isViewMode &&
            !["DRAFT", "SUBMITTED"].includes(headerData?.status) && (
              <div className="mt-6 flex justify-end">
                <button
                  className="btn"
                  onClick={() => navigate("/service-management/supplier-service-requests")}
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
