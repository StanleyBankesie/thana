/**
 * @fileoverview MaterialUtilizationForm component.
 * Provides functionality for MaterialUtilizationForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "api/client";
import { useUoms } from "@/hooks/useUoms";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

function normalizeDate(v) {
  if (!v) return new Date().toISOString().split("T")[0];
  const s = String(v);
  return s.includes("T") ? s.split("T")[0] : s;
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaterialUtilizationForm() {
  const { hasExceptional } = usePermission();
  const { uoms, loading: uomsLoading } = useUoms();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new" || !id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availableItems, setAvailableItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [itemQueries, setItemQueries] = useState({});
  const [stockQtyMap, setStockQtyMap] = useState({});

  const [formData, setFormData] = useState({
    utilizationDate: new Date().toISOString().split("T")[0],
    projectId: "",
    taskId: "",
    taskSummary: "",
    warehouseId: "",
    remarks: "",
    status: "DRAFT",
  });

  const [items, setItems] = useState([
    {
      id: 1,
      item_id: "",
      itemCode: "",
      itemName: "",
      requiredQty: "",
      uom: "PCS",
      costPrice: "",
      availableQty: 0,
    },
  ]);

  useEffect(() => {
    let mounted = true;

    api
      .get("/projects/projects")
      .then((res) => {
        if (!mounted) return;
        setProjects(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => {});

    api
      .get("/inventory/items")
      .then((res) => {
        if (!mounted) return;
        setAvailableItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => {});

    api
      .get("/inventory/warehouses")
      .then((res) => {
        if (!mounted) return;
        setWarehouses(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/projects/material-utilizations/${id}`)
      .then((res) => {
        if (!mounted) return;
        const r = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!r) return;

        setFormData({
          utilizationDate: normalizeDate(r.utilization_date),
          projectId: r.project_id || "",
          taskId: r.task_id || "",
          taskSummary: r.task_summary || "",
          warehouseId: r.warehouse_id || "",
          remarks: r.remarks || "",
          status: r.status || "DRAFT",
        });

        if (r.project_id) {
          api
            .get(`/projects/tasks?projectId=${r.project_id}`)
            .then((res2) => {
              if (!mounted) return;
              setTasks(Array.isArray(res2.data?.items) ? res2.data.items : []);
            })
            .catch(() => {});
        }

        setItems(
          details.length
            ? details.map((d) => ({
                id: d.id || Date.now() + Math.random(),
                item_id: d.item_id ? String(d.item_id) : "",
                itemCode: d.item_code || "",
                itemName: d.item_name || "",
                requiredQty: Number(d.required_qty) || 0,
                uom: d.uom || "PCS",
                costPrice: Number(d.cost_price) || 0,
                availableQty: 0,
              }))
            : [
                {
                  id: 1,
                  item_id: "",
                  itemCode: "",
                  itemName: "",
                  requiredQty: 0,
                  uom: "PCS",
                  costPrice: 0,
                  availableQty: 0,
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
          e?.response?.data?.message || "Failed to load material utilization",
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
        item_name: r.itemName || null,
        required_qty: Math.max(0, parseInt(r.requiredQty, 10) || 0),
        uom: r.uom || "PCS",
        cost_price: Number(r.costPrice) || 0,
      }));
  }, [items]);

  const statusColors = {
    DRAFT: "bg-gray-500 text-white",
    SUBMITTED: "bg-yellow-300 text-black",
    CONFIRMED: "bg-green-500 text-white",
    CANCELLED: "bg-red-500 text-white",
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        utilization_date: normalizeDate(formData.utilizationDate),
        project_id: formData.projectId || null,
        task_id: formData.taskId || null,
        task_summary: formData.taskSummary || null,
        warehouse_id: formData.warehouseId || null,
        remarks: formData.remarks || null,
        status: "DRAFT",
        details: normalizedDetails,
      };

      if (isNew) {
        await api.post("/projects/material-utilizations", payload);
      } else {
        await api.put(`/projects/material-utilizations/${id}`, payload);
      }

      navigate("/project-management/material-utilizations", {
        state: { refresh: true },
      });
    } catch (e2) {
      setError(
        e2?.response?.data?.message || "Failed to save material utilization",
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
        requiredQty: 0,
        uom: "PCS",
        costPrice: 0,
        availableQty: 0,
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
              costPrice: Number(item.cost_price) || 0,
            }
          : i,
      ),
    );
    setItemQueries((prev) => ({ ...prev, [rowId]: item.item_name || "" }));

    if (formData.warehouseId && item.id) {
      api
        .get(
          `/inventory/stock-balances?warehouseId=${formData.warehouseId}&q=${encodeURIComponent(item.item_name || "")}`,
        )
        .then((res) => {
          const rows = Array.isArray(res.data?.items) ? res.data.items : [];
          const match = rows.find((r) => String(r.item_id) === String(item.id));
          const availQty = match ? Number(match.total_qty || 0) : 0;
          setItems((prev) =>
            prev.map((i) =>
              i.id === rowId ? { ...i, availableQty: availQty } : i,
            ),
          );
        })
        .catch(() => {});
    }
  };

  const removeItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const onProjectChange = (pid) => {
    setFormData({ ...formData, projectId: pid, taskId: "" });
    if (pid) {
      api
        .get(`/projects/tasks?projectId=${pid}`)
        .then((r) => {
          setTasks(Array.isArray(r.data?.items) ? r.data.items : []);
        })
        .catch(() => {});
    } else {
      setTasks([]);
    }
  };

  const onWarehouseChange = (whId) => {
    setFormData((prev) => ({ ...prev, warehouseId: whId }));
    const selectedItems = items.filter((i) => i.item_id);
    if (!whId || !selectedItems.length) {
      setItems((prev) => prev.map((i) => ({ ...i, availableQty: 0 })));
      return;
    }
    selectedItems.forEach((item) => {
      api
        .get(
          `/inventory/stock-balances?warehouseId=${whId}&q=${encodeURIComponent(item.itemName || "")}`,
        )
        .then((res) => {
          const rows = Array.isArray(res.data?.items) ? res.data.items : [];
          const match = rows.find(
            (r) => String(r.item_id) === String(item.item_id),
          );
          const availQty = match ? Number(match.total_qty || 0) : 0;
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, availableQty: availQty } : i,
            ),
          );
        })
        .catch(() => {});
    });
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew
                  ? "New Material Utilization"
                  : "Edit Material Utilization"}
              </h1>
              <p className="text-sm mt-1">
                Record material consumption against project tasks
              </p>
            </div>
            <button onClick={() => window.history.back()} className="btn-success"
            >
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
                <label className="label">Utilization Date *</label>
                <input
                  type="date"
                  className="input"
                  value={formData.utilizationDate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      utilizationDate: e.target.value,
                    })
                  }
                  required
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="label">Project *</label>
                <select
                  className="input"
                  value={formData.projectId}
                  onChange={(e) => onProjectChange(e.target.value)}
                  required
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Task</label>
                <select
                  className="input"
                  value={formData.taskId}
                  onChange={(e) => {
                    setFormData({ ...formData, taskId: e.target.value });
                    const t = tasks.find(
                      (tt) => String(tt.id) === e.target.value,
                    );
                    if (t)
                      setFormData((prev) => ({
                        ...prev,
                        taskId: e.target.value,
                        taskSummary: t.task_title,
                      }));
                  }}
                >
                  <option value="">Select Task</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.task_title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <div className="pt-2">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[formData.status] || "bg-gray-500 text-white"}`}
                  >
                    {formData.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Task Summary</label>
                <input
                  type="text"
                  className="input"
                  value={formData.taskSummary}
                  onChange={(e) =>
                    setFormData({ ...formData, taskSummary: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Temporal Storage / Warehouse</label>
                <select
                  className="input"
                  value={formData.warehouseId}
                  onChange={(e) => onWarehouseChange(e.target.value)}
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name}
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
                  Items Consumed
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
                      <th className="w-24 min-w-[100px]">Available Qty</th>
                      <th className="w-32 min-w-[110px]">Required Qty</th>
                      <th className="w-24 min-w-[80px]">UOM</th>
                      <th className="w-32 min-w-[120px]">Cost Price</th>
                      <th className="w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const itemQuery = itemQueries[item.id] || "";
                      const showQuery = item.item_id
                        ? item.itemName
                        : itemQuery;
                      const searchResults =
                        itemQuery.trim() && !item.item_id
                          ? filterByPrefix(availableItems, {
                              query: itemQuery,
                              searchFields: [
                                "item_code",
                                "item_name",
                                "barcode",
                              ],
                            })
                          : [];
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="relative">
                              <input
                                id={`pm-util-item-search-${item.id}`}
                                autoComplete="off"
                                className="input w-full"
                                placeholder="Type to search items"
                                value={showQuery}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItemQueries((prev) => ({
                                    ...prev,
                                    [item.id]: val,
                                  }));
                                  if (item.item_id) {
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
                              {searchResults.length
                                ? (() => {
                                    const el = document.getElementById(
                                      `pm-util-item-search-${item.id}`,
                                    );
                                    const r = el
                                      ? el.getBoundingClientRect()
                                      : { bottom: 0, left: 0, width: 0 };
                                    return (
                                      <div
                                        className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto"
                                        style={{
                                          position: "fixed",
                                          top: `${r.bottom + 4}px`,
                                          left: `${r.left}px`,
                                          width: `${r.width}px`,
                                          zIndex: 9999,
                                        }}
                                      >
                                        {searchResults.map((o) => (
                                          <button
                                            type="button"
                                            key={o.id}
                                            className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs"
                                            onClick={() =>
                                              handleSelectItem(item.id, o)
                                            }
                                          >
                                            {o.item_code} - {o.item_name}
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })()
                                : null}
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="input bg-slate-50"
                              value={item.availableQty}
                              readOnly
                              tabIndex={-1}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="input"
                              value={item.requiredQty}
                              onChange={(e) => {
                                setItems(
                                  items.map((i) =>
                                    i.id === item.id
                                      ? {
                                          ...i,
                                          requiredQty: Math.max(
                                            0,
                                            parseInt(e.target.value, 10) || 0,
                                          ),
                                        }
                                      : i,
                                  ),
                                );
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
                                setItems(
                                  items.map((i) =>
                                    i.id === item.id
                                      ? { ...i, uom: e.target.value }
                                      : i,
                                  ),
                                );
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
                              type="number"
                              step="0.01"
                              className="input"
                              value={item.costPrice}
                              onChange={(e) => {
                                setItems(
                                  items.map((i) =>
                                    i.id === item.id
                                      ? {
                                          ...i,
                                          costPrice:
                                            Number(e.target.value) || 0,
                                        }
                                      : i,
                                  ),
                                );
                              }}
                              min="0"
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
              <button type="submit" className="btn-success" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
