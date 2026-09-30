import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "api/client";
import { useUoms } from "@/hooks/useUoms";
import { filterByPrefix } from "@/utils/searchUtils.js";
import "./MaterialRequisitionForm.css";
import { usePermission } from "@/auth/PermissionContext.jsx";

function normalizeDate(v) {
  if (!v) return new Date().toISOString().split("T")[0];
  const s = String(v);
  return s.includes("T") ? s.split("T")[0] : s;
}

export default function MaterialRequisitionForm() {
  const { hasExceptional } = usePermission();
  const { uoms, loading: uomsLoading } = useUoms();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availableItems, setAvailableItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [itemQueries, setItemQueries] = useState({});

  const [formData, setFormData] = useState({
    requisitionNo: isNew ? "Auto-generated" : "",
    requisitionDate: new Date().toISOString().split("T")[0],
    warehouseId: "",
    departmentId: "",
    requisitionType: "INTERNAL",
    priority: "MEDIUM",
    requestedBy: "",
    remarks: "",
    status: "DRAFT",
  });

  const [items, setItems] = useState([
    {
      id: 1,
      item_id: "",
      itemCode: "",
      itemName: "",
      qtyRequested: "",
      qtyIssued: 0,
      uom: "PCS",
      batchNo: "",
      serialNo: "",
    },
  ]);

  useEffect(() => {
    let mounted = true;

    // Fetch users
    api
      .get("/admin/users", { params: { active: 1 } })
      .then((res) => {
        if (!mounted) return;
        const items =
          (res?.data &&
            res.data.data &&
            Array.isArray(res.data.data.items) &&
            res.data.data.items) ||
          (Array.isArray(res?.data?.items) && res.data.items) ||
          [];
        setUsers(items);
      })
      .catch(() => {});

    // Fetch warehouses
    api
      .get("/inventory/warehouses")
      .then((res) => {
        if (!mounted) return;
        setWarehouses(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((err) => console.error("Failed to load warehouses", err));

    // Fetch departments
    api
      .get("/admin/departments")
      .then((res) => {
        if (!mounted) return;
        setDepartments(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((err) => console.error("Failed to load departments", err));

    api
      .get("/inventory/items")
      .then((res) => {
        if (!mounted) return;
        setAvailableItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load items");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isNew) return;
    let cancelled = false;
    async function prefillNextNo() {
      try {
        const res = await api.get("/inventory/material-requisitions");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        let max = 0;
        for (const it of items) {
          const no = String(it.requisition_no || "");
          if (/^MRS-\d{6}$/.test(no)) {
            const n = parseInt(no.slice(4), 10);
            if (Number.isFinite(n) && n > max) max = n;
          }
        }
        const next = `MRS-${String(max + 1).padStart(6, "0")}`;
        if (!cancelled) {
          setFormData((prev) => ({
            ...prev,
            requisitionNo: next,
          }));
        }
      } catch {}
    }
    prefillNextNo();
    return () => {
      cancelled = true;
    };
  }, [isNew]);

  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/material-requisitions/${id}`)
      .then((res) => {
        if (!mounted) return;
        const r = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!r) return;

        setFormData({
          requisitionNo: r.requisition_no || "",
          requisitionDate: normalizeDate(r.requisition_date),
          warehouseId: r.warehouse_id || "",
          departmentId: r.department_id || "",
          requisitionType: r.requisition_type || "INTERNAL",
          priority: r.priority || "MEDIUM",
          requestedBy: r.requested_by || "",
          remarks: r.remarks || "",
          status: r.status || "DRAFT",
        });

        setItems(
          details.length
            ? details.map((d) => ({
                id: d.id || Date.now() + Math.random(),
                item_id: d.item_id ? String(d.item_id) : "",
                itemCode: d.item_code || "",
                itemName: d.item_name || "",
                qtyRequested: Number(d.qty_requested) || 0,
                qtyIssued: Number(d.qty_issued) || 0,
                uom: d.uom || "PCS",
                batchNo: d.batch_no || "",
                serialNo: d.serial_no || "",
              }))
            : [
                {
                  id: 1,
                  item_id: "",
                  itemCode: "",
                  itemName: "",
                  qtyRequested: "",
                  qtyIssued: 0,
                  uom: "PCS",
                },
              ],
        );
        const initQueries = {};
        (details.length ? details : [{ id: 1 }]).forEach((d) => {
          initQueries[d.id || 1] = d.item_name || "";
        });
        setItemQueries(initQueries);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load material requisition",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const normalizedDetails = useMemo(() => {
    return items
      .filter((r) => r.item_id)
      .map((r) => ({
        item_id: Number(r.item_id),
        qty_requested: Math.max(0, parseInt(r.qtyRequested, 10) || 0),
        batch_no: r.batchNo || null,
        serial_no: r.serialNo || null,
      }));
  }, [items]);

  const itemSelectOptions = useMemo(
    () =>
      Array.isArray(availableItems)
        ? availableItems.map((ai) => ({
            value: String(ai.id),
            label: `${ai.item_code || ""} - ${ai.item_name || ""}`,
          }))
        : [],
    [availableItems],
  );

  const statusColors = {
    DRAFT: "bg-gray-500 text-white",
    PENDING: "bg-yellow-400 text-black",
    PENDING_APPROVAL: "bg-yellow-400 text-black",
    SUBMITTED: "bg-yellow-300 text-black",
    APPROVED: "bg-green-500 text-white",
    ISSUED: "bg-blue-500 text-white",
    REJECTED: "bg-red-500 text-white",
  };

  const handleSubmit = async (e, statusOverride) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        requisition_no: isNew ? undefined : formData.requisitionNo,
        requisition_date: normalizeDate(formData.requisitionDate),
        warehouse_id: formData.warehouseId || null,
        department_id: formData.departmentId || null,
        requisition_type: formData.requisitionType,
        priority: formData.priority,
        requested_by: formData.requestedBy || null,
        remarks: formData.remarks || null,
        status: statusOverride || formData.status,
        details: normalizedDetails,
      };

      if (isNew) {
        await api.post("/inventory/material-requisitions", payload);
      } else {
        await api.put(`/inventory/material-requisitions/${id}`, payload);
      }

      navigate("/inventory/material-requisitions", {
        state: { refresh: true },
      });
    } catch (e2) {
      setError(
        e2?.response?.data?.message || "Failed to save material requisition",
      );
    } finally {
      setSaving(false);
    }
  };

  const forwardForApproval = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        requisition_no: isNew ? undefined : formData.requisitionNo,
        requisition_date: normalizeDate(formData.requisitionDate),
        warehouse_id: formData.warehouseId || null,
        department_id: formData.departmentId || null,
        requisition_type: formData.requisitionType,
        priority: formData.priority,
        requested_by: formData.requestedBy || null,
        remarks: formData.remarks || null,
        status: formData.status || "DRAFT",
        details: normalizedDetails,
      };
      let newId = id;
      if (isNew) {
        const res = await api.post("/inventory/material-requisitions", payload);
        newId = res?.data?.id ? String(res.data.id) : null;
        if (!newId) throw new Error("Failed to create requisition");
      } else {
        await api.put(`/inventory/material-requisitions/${id}`, payload);
      }
      const targetId = newId || id;
      const submitRes = await api.post(
        `/inventory/material-requisitions/${targetId}/submit`,
        { amount: null },
      );
      const instanceId = submitRes?.data?.instanceId;
      setFormData((prev) => ({
        ...prev,
        status: submitRes?.data?.status || "PENDING_APPROVAL",
      }));
      if (instanceId) {
        navigate(`/administration/workflows/approvals/${instanceId}`);
      } else {
        navigate("/inventory/material-requisitions", {
          state: { refresh: true },
        });
      }
    } catch (e2) {
      setError(
        e2?.response?.data?.message ||
          e2?.message ||
          "Failed to forward for approval",
      );
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    const newId = Date.now();
    setItems([
      ...items,
      {
        id: newId,
        item_id: "",
        itemCode: "",
        itemName: "",
        qtyRequested: "",
        qtyIssued: 0,
        uom: "PCS",
        batchNo: "",
        serialNo: "",
      },
    ]);
    setItemQueries((prev) => ({ ...prev, [newId]: "" }));
  };

  const handleSelectItem = (rowId, item) => {
    setItems(
      items.map((i) =>
        i.id === rowId
          ? {
              ...i,
              item_id: String(item.id),
              itemCode: item.item_code || "",
              itemName: item.item_name || "",
              uom: item.uom || "PCS",
            }
          : i,
      ),
    );
    setItemQueries((prev) => ({ ...prev, [rowId]: item.item_name || "" }));
  };

  const removeItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew
                  ? "New Material Requisition"
                  : "Edit Material Requisition"}
              </h1>
              <p className="text-sm mt-1">
                Request materials from warehouse inventory
              </p>
            </div>
            <button onClick={() => window.history.back()} className="btn-success">
              Back to List
            </button>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Requisition No</label>
                <input
                  type="text"
                  className="input bg-slate-100 dark:bg-slate-700"
                  value={formData.requisitionNo}
                  disabled
                />
              </div>
              <div>
                <label className="label">Requisition Date *</label>
                <input
                  type="date"
                  className="input"
                  value={formData.requisitionDate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requisitionDate: e.target.value,
                    })
                  }
                  required
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  className="input"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <div className="pt-2">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      statusColors[formData.status] || "bg-gray-500 text-white"
                    }`}
                  >
                    {formData.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Source Warehouse</label>
                <select
                  className="input"
                  value={formData.warehouseId}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouseId: e.target.value })
                  }
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Destination Department</label>
                <select
                  className="input"
                  value={formData.departmentId}
                  onChange={(e) =>
                    setFormData({ ...formData, departmentId: e.target.value })
                  }
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Requisition Type</label>
                <select
                  className="input"
                  value={formData.requisitionType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requisitionType: e.target.value,
                    })
                  }
                >
                  <option value="INTERNAL">Internal Use</option>
                  <option value="PROJECT">Project</option>
                  <option value="PROMOTIONS">Promotions</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="SALES">Sales Campaign</option>
                  <option value="PRODUCTION">Production</option>
                </select>
              </div>
              <div>
                <label className="label">Requested By *</label>
                <select
                  className="input"
                  value={formData.requestedBy}
                  onChange={(e) =>
                    setFormData({ ...formData, requestedBy: e.target.value })
                  }
                  required
                >
                  <option value="">Select User</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Remarks</label>
              <textarea
                className="input w-full"
                rows="3"
                value={formData.remarks}
                onChange={(e) =>
                  setFormData({ ...formData, remarks: e.target.value })
                }
                placeholder="Enter any additional notes..."
              ></textarea>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Items
                </h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="btn-success text-sm"
                >
                  + Add Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="w-1/2 min-w-[300px]">Item Name</th>
                      <th className="w-32 min-w-[110px]">Qty Requested</th>
                      <th className="w-24 min-w-[80px]">UOM</th>
                      <th className="w-40 min-w-[160px]">Batch No</th>
                      <th className="w-40 min-w-[160px]">Serial No</th>
                      <th className="w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const itemQuery = itemQueries[item.id] || "";
                      const searchResults = itemQuery.trim()
                        ? filterByPrefix(availableItems, {
                            query: itemQuery,
                            searchFields: ["item_code", "item_name", "barcode"],
                          })
                        : [];
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="relative">
                              <input
                                id={`mr-item-search-${item.id}`} autoComplete="off"
                                className="input w-full"
                                placeholder="Type to search items"
                                value={itemQueries[item.id] || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItemQueries((prev) => ({
                                    ...prev,
                                    [item.id]: val,
                                  }));
                                  if (!val && item.item_id) {
                                    setItems(
                                      items.map((i) =>
                                        i.id === item.id
                                          ? {
                                              ...i,
                                              item_id: "",
                                              itemCode: "",
                                              itemName: "",
                                            }
                                          : i,
                                      ),
                                    );
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const query = (
                                      itemQueries[item.id] || ""
                                    ).trim();
                                    if (!query || !searchResults.length) return;
                                    handleSelectItem(item.id, searchResults[0]);
                                  }
                                }}
                              />
                              {searchResults.length ? (
                                (() => {
                                  const el = document.getElementById(`mr-item-search-${item.id}`);
                                  const r = el ? el.getBoundingClientRect() : { bottom: 0, left: 0, width: 0 };
                                  return (
                                    <div
                                      className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto"
                                      style={{ position: 'fixed', top: `${r.bottom + 4}px`, left: `${r.left}px`, width: `${r.width}px`, zIndex: 9999 }}
                                    >
                                      {searchResults.map((o) => (
                                        <button
                                          type="button"
                                          key={o.id}
                                          className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs"
                                          onClick={() => {
                                            handleSelectItem(item.id, o);
                                          }}
                                        >
                                          {o.item_code} - {o.item_name}
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })()
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="input"
                              value={item.qtyRequested}
                              onChange={(e) => {
                                const updated = items.map((i) =>
                                  i.id === item.id
                                    ? {
                                        ...i,
                                        qtyRequested: Math.max(
                                          0,
                                          parseInt(e.target.value, 10) || 0,
                                        ),
                                      }
                                    : i,
                                );
                                setItems(updated);
                              }}
                              min="0"
                              step="1"
                              inputMode="numeric"
                              pattern="[0-9]*"
                            />
                          </td>
                          <td>
                            <select
                              className="input"
                              value={item.uom || ""}
                              onChange={(e) => {
                                const updated = items.map((i) =>
                                  i.id === item.id
                                    ? { ...i, uom: e.target.value }
                                    : i,
                                );
                                setItems(updated);
                              }}
                            >
                              <option value="">UOM</option>
                              {(Array.isArray(uoms) && uoms.length
                                ? uoms.map((u) => ({
                                    code: u.uom_code || u.code || "",
                                    name: u.uom_name || u.name || "",
                                  }))
                                : [
                                    { code: "EA", name: "EA" },
                                    { code: "PCS", name: "PCS" },
                                    { code: "KG", name: "KG" },
                                    { code: "LTR", name: "LTR" },
                                    { code: "MTR", name: "MTR" },
                                  ]
                              ).map((u) => (
                                <option key={u.code} value={u.code}>
                                  {u.name ? `${u.name} (${u.code})` : u.code}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="input"
                              placeholder="Batch No"
                              value={item.batchNo || ""}
                              onChange={(e) => {
                                const updated = items.map((i) =>
                                  i.id === item.id
                                    ? { ...i, batchNo: e.target.value }
                                    : i,
                                );
                                setItems(updated);
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="input"
                              placeholder="Serial No"
                              value={item.serialNo || ""}
                              onChange={(e) => {
                                const updated = items.map((i) =>
                                  i.id === item.id
                                    ? { ...i, serialNo: e.target.value }
                                    : i,
                                );
                                setItems(updated);
                              }}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => window.history.back()} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, "DRAFT")}
                className="btn-success"
                disabled={saving}
              >
                {saving ? "Saving..." : "💾 Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
