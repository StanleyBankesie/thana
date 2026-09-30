import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { toast } from "react-toastify";
import { api } from "api/client";
import { useUoms } from "@/hooks/useUoms";
import UnitConversionModal from "@/components/UnitConversionModal";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

export default function StockUpdationForm({
  isModal = false,
  modalId = null,
  onClose = null,
}) {
  const { hasExceptional } = usePermission();
  const { uoms, loading: uomsLoading } = useUoms();
  const { id: routeId } = useParams();
  const id = isModal ? modalId : routeId;
  const navigate = useNavigate();
  const isNew = id === "new" || !id;
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get("mode") || "").toLowerCase();
  const isView = !isNew && mode === "view";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isWfActive, setIsWfActive] = useState(false);
  const [checkingWf, setCheckingWf] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [unitConversions, setUnitConversions] = useState([]);
  const [convModal, setConvModal] = useState({
    open: false,
    itemId: null,
    defaultUom: "",
    currentUom: "",
    rowId: null,
  });
  const defaultUomCode = useMemo(() => {
    const list = Array.isArray(uoms) ? uoms : [];
    const pcs =
      list.find((u) => String(u.uom_code || "").toUpperCase() === "PCS") ||
      list[0];
    if (pcs && pcs.uom_code) return pcs.uom_code;
    return "PCS";
  }, [uoms]);

  const [formData, setFormData] = useState({
    updationNo: "",
    updationDate: new Date().toISOString().split("T")[0],
    warehouseId: "",
    reason: "",
    status: "DRAFT",
  });

  const [items, setItems] = useState([]);
  const [itemQueries, setItemQueries] = useState({});

  const refreshRowCurrentStock = async (rowId, itemId, warehouseId) => {
    const wid = warehouseId ? Number(warehouseId) : 0;
    const iid = itemId ? Number(itemId) : 0;
    if (!wid || !iid) {
      setItems((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, currentStock: 0 } : r)),
      );
      return;
    }
    try {
      const res = await api.get("/inventory/stock/balance", {
        params: { item_id: iid, warehouse_id: wid },
      });
      const qty = Number(res.data?.qty || 0);
      setItems((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, currentStock: qty } : r)),
      );
    } catch {}
  };

  const checkWorkflowStatus = async () => {
    setCheckingWf(true);
    try {
      const res = await api.get("/workflows");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const active = items.some(
        (w) =>
          Number(w.is_active) === 1 &&
          (String(w.document_route) === "/inventory/stock-updation" ||
            String(w.document_type).toUpperCase() === "STOCK_UPDATION" ||
            String(w.document_type).toUpperCase() === "STOCK UPDATION"),
      );
      setIsWfActive(active);
    } catch (e) {
      console.error("Workflow status check failed", e);
    } finally {
      setCheckingWf(false);
    }
  };

  useEffect(() => {
    checkWorkflowStatus();
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get("/inventory/items"),
      api.get("/inventory/warehouses"),
      api.get("/inventory/unit-conversions"),
    ])
      .then(([itemsRes, whRes, convRes]) => {
        if (!mounted) return;
        setAvailableItems(
          Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
        );
        setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
        setUnitConversions(
          Array.isArray(convRes.data?.items) ? convRes.data.items : [],
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load lookups");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isNew) {
      api
        .get("/inventory/stock-updation/next-no")
        .then((res) => {
          setFormData((prev) => ({
            ...prev,
            updationNo: res.data?.next_no || "",
          }));
        })
        .catch((err) => console.error("Failed to fetch next updation no", err));
    }
  }, [isNew]);

  useEffect(() => {
    if (skipStockRefresh.current) {
      skipStockRefresh.current = false;
      return;
    }
    const wid = formData.warehouseId ? Number(formData.warehouseId) : 0;
    if (!wid) {
      setItems((prev) => prev.map((r) => ({ ...r, currentStock: 0 })));
      return;
    }
    const snapshot = Array.isArray(items) ? items : [];
    const targets = snapshot
      .filter((r) => r.item_id)
      .map((r) => ({ rowId: r.id, itemId: r.item_id }));
    if (!targets.length) return;
    (async () => {
      for (const t of targets) {
        await refreshRowCurrentStock(t.rowId, t.itemId, wid);
      }
    })();
  }, [
    formData.warehouseId,
    items.map((item) => `${item.id}:${item.item_id || ""}`).join("|"),
  ]);

  useEffect(() => {
    if (isNew) {
      const id = Date.now();
      setItems([
        {
          id,
          item_id: "",
          itemCode: "",
          itemName: "",
          currentStock: 0,
          adjustedStock: 0,
          uom: "",
          unitCost: 0,
          remarks: "",
        },
      ]);
      setItemQueries({ [id]: "" });
      return;
    }

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/stock-updation/${id}`)
      .then((res) => {
        if (!mounted) return;
        skipStockRefresh.current = true;
        const a = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!a) return;

        setFormData({
          updationNo: a.updation_no || "",
          updationDate: a.updation_date
            ? new Date(a.updation_date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          warehouseId: a.warehouse_id ? String(a.warehouse_id) : "",
          reason: a.reason || "",
          status: a.status || "DRAFT",
        });

        const mappedItems = details.length
          ? details.map((d) => ({
              id: d.id || Date.now() + Math.random(),
              item_id: d.item_id ? String(d.item_id) : "",
              itemCode: d.item_code || "",
              itemName: d.item_name || "",
              currentStock: Number(d.current_stock) || 0,
              qty: Number(d.qty) || 0,
              uom: d.uom || "",
              unitCost: Number(d.unit_cost) || 0,
              remarks: d.remarks || "",
            }))
          : [];
        setItems(mappedItems);
        const initQueries = {};
        mappedItems.forEach((i) => {
          initQueries[i.id] = i.itemName || i.itemCode || "";
        });
        setItemQueries(initQueries);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load stock adjustment",
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

  const skipStockRefresh = useRef(false);

  const normalizedDetails = useMemo(() => {
    return items
      .filter((r) => r.item_id)
      .map((r) => ({
        item_id: Number(r.item_id),
        qty: Number(r.qty) || 0,
        unit_cost: Number(r.unitCost) || 0,
        current_stock: Number(r.currentStock) || 0,
        uom: r.uom,
        remarks: r.remarks,
      }));
  }, [items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        updation_no: isNew ? undefined : formData.updationNo,
        updation_date: formData.updationDate,
        warehouse_id: formData.warehouseId
          ? Number(formData.warehouseId)
          : null,
        reason: formData.reason,
        status: formData.status,
        details: normalizedDetails,
      };

      if (isNew) {
        await api.post("/inventory/stock-updation", payload);
      } else {
        await api.put(`/inventory/stock-updation/${id}`, payload);
      }

      navigate("/inventory/stock-updation", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save stock updation");
    } finally {
      setSaving(false);
    }
  };

  const forwardForApproval = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        updation_no: isNew ? undefined : formData.updationNo,
        updation_date: formData.updationDate,
        warehouse_id: formData.warehouseId
          ? Number(formData.warehouseId)
          : null,
        reason: formData.reason,
        status: formData.status,
        details: normalizedDetails,
      };

      let newId = id;
      if (isNew) {
        const res = await api.post("/inventory/stock-updation", payload);
        newId = res?.data?.id ? String(res.data.id) : null;
        if (!newId) throw new Error("Failed to create stock updation");
      } else {
        await api.put(`/inventory/stock-updation/${id}`, payload);
      }

      const targetId = newId || id;
      const submitRes = await api.post(
        `/inventory/stock-updation/${targetId}/submit`,
        { amount: null },
      );

      const instanceId = submitRes?.data?.instanceId;
      setFormData((prev) => ({
        ...prev,
        status: submitRes?.data?.status || "PENDING_APPROVAL",
      }));

      if (instanceId) {
        if (isModal) onClose && onClose(true);
        navigate(`/administration/workflows/approvals/${instanceId}`);
      } else {
        if (isModal) {
          onClose && onClose(true);
        } else {
          navigate("/inventory/stock-updation", { state: { refresh: true } });
        }
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
        qty: 0,
        uom: "",
        unitCost: 0,
        remarks: "",
      },
    ]);
    setItemQueries((prev) => ({ ...prev, [newId]: "" }));
  };

  const removeItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "item_id") {
          const selected = availableItems.find(
            (ai) => String(ai.id) === String(value),
          );
          updated.itemCode = selected?.item_code || "";
          updated.itemName = selected?.item_name || "";
          updated.unitCost = selected?.cost_price || 0;
          updated.uom =
            (selected?.uom && String(selected.uom)) || String(defaultUomCode);
        }
        return updated;
      }),
    );
    if (field === "item_id") {
      refreshRowCurrentStock(id, value, formData.warehouseId);
    }
  };

  const selectReason = (reason) => {
    setFormData((prev) => ({ ...prev, reason: reason }));
  };

  const getTypeCardClass = (type) => {
    const base =
      "border-2 rounded-lg p-4 cursor-pointer transition-all text-center hover:shadow-md";
    const active =
      formData.adjustmentType === type
        ? " ring-2 ring-brand-500 bg-brand-50 border-brand-500"
        : " border-slate-200 bg-white";

    if (type === "INCREASE")
      return `${base} ${active} ${
        formData.adjustmentType === type
          ? "border-green-500 ring-green-500 bg-green-50"
          : "hover:border-green-200"
      }`;
    if (type === "DECREASE")
      return `${base} ${active} ${
        formData.adjustmentType === type
          ? "border-red-500 ring-red-500 bg-red-50"
          : "hover:border-red-200"
      }`;
    return `${base} ${active}`;
  };

  const formContent = (
    <>
      <div className="card border-0 shadow-none">
        <div
          className={`card-header bg-brand text-white ${isModal ? "" : "rounded-t-lg"}`}
        >
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew
                  ? "New Stock Updation"
                  : isView
                    ? "View Stock Updation"
                    : "Edit Stock Updation"}
              </h1>
              <p className="text-sm mt-1">Update stock levels</p>
            </div>
            <div className="flex gap-2">
              {!isModal && (
                <button onClick={() => window.history.back()} className="btn-success bg-green-600 text-white hover:bg-green-700 px-6 py-2 rounded shadow-sm font-medium"
                >
                  ← Back to List
                </button>
              )}
              {isModal && (
                <button
                  type="button"
                  onClick={() => onClose && onClose()}
                  className="text-white hover:text-slate-200 text-2xl"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card-body p-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {loading && <div className="text-sm">Loading...</div>}
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-md border border-red-200">
                {error}
              </div>
            )}

            <fieldset disabled={isView} className="space-y-8">
              {/* UI for Updation usually doesn't need type selection as it's always additions */}

              {/* Adjustment Information */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">
                  📋 Updation Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="label">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={formData.updationDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          updationDate: e.target.value,
                        })
                      }
                      required
                    
                      disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                    />
                  </div>
                  <div>
                    <label className="label">Warehouse</label>
                    <select required
                      className="input"
                      value={formData.warehouseId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          warehouseId: e.target.value,
                        })
                      }
                    >
                      <option value="">-- Select Warehouse --</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.warehouse_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Updation No</label>
                    <input
                      type="text"
                      className="input bg-slate-100"
                      value={formData.updationNo || "NEW"}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="label">Reference (Optional)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., Opening Balance, Correction"
                      value={formData.remarks || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          remarks: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <div className="mt-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          formData.status === "DRAFT"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {formData.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="label">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input w-96"
                  rows="4"
                  placeholder="Provide detailed reason for this stock updation..."
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  required
                ></textarea>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    "Physical count variance",
                    "Damaged goods",
                    "Expired items",
                    "Theft/Loss",
                    "Found items",
                    "System error correction",
                    "Other",
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => selectReason(r)}
                      className={`px-3 py-1 rounded-full text-xs border ${
                        formData.reason === r
                          ? "bg-brand-500 text-white border-brand-500"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h3 className="text-lg font-semibold text-slate-800">
                    📦 Items
                  </h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="btn-primary text-sm px-3 py-1 rounded bg-brand-600 text-white hover:bg-brand-700"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="table w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                      <tr>
                        <th className="w-1/2 min-w-[280px] p-3">Item</th>
                        <th className="w-24 min-w-[90px] p-3 text-center text-blue-600">
                          Available Qty
                        </th>
                        <th className="w-28 min-w-[110px] p-3">Qty to Add</th>
                        <th className="w-20 min-w-[80px] p-3">UOM</th>
                        <th className="w-28 min-w-[100px] p-3">Unit Cost</th>
                        <th className="w-28 min-w-[100px] p-3">Total Value</th>
                        <th className="w-48 min-w-[200px] p-3">Remarks</th>
                        <th className="w-16 p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((item) => {
                        const totalValue =
                          Number(item.qty || 0) * Number(item.unitCost || 0);
                        const itemQuery = itemQueries[item.id] || "";
                        const searchResults = itemQuery.trim()
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
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-2">
                              <div className="relative">
                                <input
                                  id={`su-item-search-${item.id}`} autoComplete="off"
                                  className="input text-sm py-1 w-full"
                                  placeholder="Scan barcode or type item name"
                                  value={itemQueries[item.id] || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setItemQueries((prev) => ({
                                      ...prev,
                                      [item.id]: val,
                                    }));
                                    if (item.item_id) {
                                      updateItem(item.id, "item_id", "");
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const query = (
                                        itemQueries[item.id] || ""
                                      ).trim();
                                      if (!query || !searchResults.length)
                                        return;
                                      updateItem(
                                        item.id,
                                        "item_id",
                                        String(searchResults[0].id),
                                      );
                                      setItemQueries((prev) => ({
                                        ...prev,
                                        [item.id]: searchResults[0].item_name,
                                      }));
                                    }
                                  }}
                                />
                                {searchResults.length && !item.item_id ? (
                                  (() => {
                                    const el = document.getElementById(`su-item-search-${item.id}`);
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
                                              updateItem(
                                                item.id,
                                                "item_id",
                                                String(o.id),
                                              );
                                              setItemQueries((prev) => ({
                                                ...prev,
                                                [item.id]: o.item_name,
                                              }));
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
                            <td className="p-2 text-center">
                              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                {Number(
                                  item.currentStock || 0,
                                ).toLocaleString()}
                              </span>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                className="input text-sm py-1 font-bold"
                                value={item.qty}
                                onChange={(e) =>
                                  updateItem(item.id, "qty", e.target.value)
                                }
                                required
                              />
                            </td>
                            <td className="p-2">
                              <select
                                className="input text-sm py-1"
                                value={item.uom}
                                onChange={(e) =>
                                  updateItem(item.id, "uom", e.target.value)
                                }
                              >
                                {uomsLoading ? (
                                  <option>Loading...</option>
                                ) : (
                                  uoms.map((u) => (
                                    <option key={u.id} value={u.uom_code}>
                                      {u.uom_code}
                                    </option>
                                  ))
                                )}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                className="input text-sm py-1"
                                value={item.unitCost}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "unitCost",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td className="p-2 font-medium">
                              {totalValue.toFixed(2)}
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                className="input text-sm py-1"
                                placeholder="Optional"
                                value={item.remarks}
                                onChange={(e) =>
                                  updateItem(item.id, "remarks", e.target.value)
                                }
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {items.length === 0 && (
                        <tr>
                          <td
                            className="p-8 text-center text-slate-500"
                            colSpan="7"
                          >
                            No items added. Click "Add Item" to begin.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-2">
                  🧮 Impact Summary
                </h4>
                <div className="flex gap-8 text-sm">
                  <div>
                    Total Items:{" "}
                    <span className="font-bold text-brand-700">
                      {items.length}
                    </span>
                  </div>
                  <div>
                    Total Items Count:{" "}
                    <span className="font-bold text-brand-700">
                      {items.reduce((acc, i) => acc + Number(i.qty || 0), 0)}
                    </span>
                  </div>
                  <div>
                    Total Value:{" "}
                    <span className="font-bold text-brand-700">
                      {items
                        .reduce(
                          (acc, i) =>
                            acc + Number(i.qty || 0) * Number(i.unitCost || 0),
                          0,
                        )
                        .toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </fieldset>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() =>
                  isModal ? onClose() : navigate("/inventory/stock-updation")
                }
                className="btn-light bg-slate-500 text-white hover:bg-slate-600 px-4 py-2 rounded"
              >
                Cancel
              </button>
              {!isView ? (
                <>
                  <button
                    type="submit"
                    className="btn-success bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded shadow-sm font-medium"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  {((!isWfActive && !checkingWf) || id !== "new") &&
                    (formData.status === "DRAFT" ||
                      formData.status === "RETURNED") && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setSaving(true);
                            let currentId = id;
                            // If new, we must save first
                            const mapPayload = () => ({
                              updation_no: isNew ? undefined : formData.updationNo,
                              updation_date: formData.updationDate,
                              warehouse_id: formData.warehouseId
                                ? Number(formData.warehouseId)
                                : null,
                              reason: formData.reason,
                              status: formData.status,
                              remarks: formData.remarks || null,
                              details: items
                                .filter((i) => i.item_id)
                                .map((r) => ({
                                  item_id: Number(r.item_id),
                                  qty: Number(r.qty || 0),
                                  uom: r.uom || "PCS",
                                  unit_cost: Number(r.unitCost || 0),
                                  current_stock: Number(r.currentStock || 0),
                                  remarks: r.remarks || null,
                                })),
                            });
                            if (isNew) {
                              const saveRes = await api.post(
                                "/inventory/stock-updation",
                                mapPayload(),
                              );
                              currentId = saveRes.data?.id;
                            } else {
                              await api.put(`/inventory/stock-updation/${id}`, mapPayload());
                            }

                            if (!currentId)
                              throw new Error("Could not resolve document ID");

                            await api.post(
                              `/inventory/stock-updation/${currentId}/submit`,
                            );
                            toast.success("Stock updation confirmed and approved");
                            if (isModal) onClose && onClose(true);
                            else navigate("/inventory/stock-updation");
                          } catch (e) {
                            console.error("Confirm Updation error:", e);
                            setError(
                              e?.response?.data?.message ||
                                e?.message ||
                                "Confirmation failed",
                            );
                          } finally {
                            setSaving(false);
                          }
                        }}
                        className="btn-primary bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded shadow-sm font-medium"
                      >
                        {saving ? "Confirming..." : "Confirm Updation"}
                      </button>
                    )}
                </>
              ) : null}
            </div>
          </form>
        </div>
      </div>
      <UnitConversionModal
        open={convModal.open}
        onClose={() =>
          setConvModal({
            open: false,
            itemId: null,
            defaultUom: "",
            currentUom: "",
            rowId: null,
          })
        }
        itemId={convModal.itemId ? Number(convModal.itemId) : null}
        defaultUom={String(convModal.defaultUom || "")}
        currentUom={String(convModal.currentUom || "")}
        conversions={unitConversions}
        onApply={({ converted_qty }) => {
          const rowId = convModal.rowId;
          if (rowId != null) {
            updateItem(rowId, "adjustedStock", converted_qty);
          }
        }}
      />
    </>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in duration-200">
          {formContent}
        </div>
      </div>
    );
  }

  return <div className="space-y-6">{formContent}</div>;
}
