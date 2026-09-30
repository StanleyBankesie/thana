/**
 * @fileoverview StockAdjustmentForm component.
 * Provides functionality for StockAdjustmentForm.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { api } from "api/client";

import { useUoms } from "@/hooks/useUoms";
import UnitConversionModal from "@/components/UnitConversionModal";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function StockAdjustmentForm() {
  const { hasExceptional } = usePermission();
  const { uoms, loading: uomsLoading } = useUoms();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get("mode") || "").toLowerCase();
  const isView = !isNew && mode === "view";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availableItems, setAvailableItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [formData, setFormData] = useState({
    adjustmentNo: "",
    adjustmentDate: new Date().toISOString().split("T")[0],
    warehouseId: "",
    adjustmentType: "PHYSICAL_COUNT",
    referenceDoc: "",
    reason: "",
    status: "DRAFT",
  });

  const [items, setItems] = useState([]);
  const [itemQueries, setItemQueries] = useState({});
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
  const conversionByKey = useMemo(() => {
    const m = new Map();
    for (const c of Array.isArray(unitConversions) ? unitConversions : []) {
      if (!Number(c.is_active)) continue;
      const key = `${c.item_id}|${c.from_uom}|${c.to_uom}`;
      const factor = Number(c.conversion_factor || 0);
      if (Number.isFinite(factor) && factor > 0) m.set(key, factor);
    }
    return m;
  }, [unitConversions]);
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
    if (!isNew) return;
    api
      .get("/inventory/stock-adjustments/next-no")
      .then((res) => {
        if (res.data?.next_no) {
          setFormData((prev) => ({
            ...prev,
            adjustmentNo: res.data.next_no,
          }));
        }
      })
      .catch(() => {
        // ignore; server will still auto-generate on save
      });
  }, [isNew]);

  const skipStockRefresh = useRef(false);

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
      .get(`/inventory/stock-adjustments/${id}`)
      .then((res) => {
        if (!mounted) return;
        skipStockRefresh.current = true;
        const a = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!a) return;

        setFormData({
          adjustmentNo: a.adjustment_no || "",
          adjustmentDate: a.adjustment_date
            ? new Date(a.adjustment_date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          warehouseId: a.warehouse_id ? String(a.warehouse_id) : "",
          adjustmentType: a.adjustment_type || "PHYSICAL_COUNT",
          referenceDoc: a.reference_doc || "",
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
              adjustedStock: Number(d.adjusted_stock) || 0,
              uom: d.uom || "PCS",
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

  const normalizedDetails = useMemo(() => {
    return items
      .filter((r) => r.item_id)
      .map((r) => ({
        item_id: Number(r.item_id),
        current_stock: Number(r.currentStock) || 0,
        adjusted_stock: Number(r.adjustedStock) || 0,
        qty: Number(r.adjustedStock) - Number(r.currentStock), // Difference
        unit_cost: Number(r.unitCost) || 0,
        remarks: r.remarks,
      }));
  }, [items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        adjustment_no: formData.adjustmentNo || undefined,
        adjustment_date: formData.adjustmentDate,
        warehouse_id: formData.warehouseId
          ? Number(formData.warehouseId)
          : null,
        adjustment_type: formData.adjustmentType,
        reference_doc: formData.referenceDoc,
        reason: formData.reason,
        status: formData.status,
        details: normalizedDetails,
      };

      if (isNew) {
        await api.post("/inventory/stock-adjustments", payload);
      } else {
        await api.put(`/inventory/stock-adjustments/${id}`, payload);
      }

      navigate("/inventory/stock-adjustments", { state: { refresh: true } });
    } catch (e2) {
      setError(
        e2?.response?.data?.message || "Failed to save stock adjustment",
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
        currentStock: 0,
        adjustedStock: 0,
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

  const fetchCurrentStock = async (itemId, warehouseId) => {
    if (!itemId || !warehouseId) return 0;
    try {
      const res = await api.get("/inventory/stock/balance", {
        params: {
          item_id: itemId,
          warehouse_id: warehouseId,
        },
      });
      return Number(res.data?.qty || 0);
    } catch {
      return 0;
    }
  };

  const updateItem = async (id, field, value) => {
    // We update state first
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "item_id") {
            const selected = availableItems.find(
              (ai) => String(ai.id) === String(value),
            );
            updated.itemCode = selected?.item_code || "";
            updated.itemName = selected?.item_name || "";
            updated.unitCost = selected?.cost_price || 0;
            updated.uom = selected?.uom || defaultUomCode;
          }
          return updated;
        }
        return item;
      }),
    );

    // If item_id changed, fetch its stock
    if (field === "item_id" && value && formData.warehouseId) {
      const wid = formData.warehouseId;
      const stock = await fetchCurrentStock(value, wid);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, currentStock: stock } : item,
        ),
      );
    }
  };

  // Refresh all stocks when warehouseId changes
  useEffect(() => {
    if (skipStockRefresh.current) {
      skipStockRefresh.current = false;
      return;
    }
    if (!formData.warehouseId || !items.length) return;

    const refreshAllStocks = async () => {
      const wid = formData.warehouseId;
      const updatedItems = await Promise.all(
        items.map(async (item) => {
          if (!item.item_id) return item;
          const stock = await fetchCurrentStock(item.item_id, wid);
          return { ...item, currentStock: stock };
        }),
      );
      setItems(updatedItems);
    };

    refreshAllStocks();
  }, [formData.warehouseId]);

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

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew
                  ? "New Stock Adjustment"
                  : isView
                    ? "View Stock Adjustment"
                    : "Edit Stock Adjustment"}
              </h1>
              <p className="text-sm mt-1">
                Adjust stock quantities for corrections
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn-success bg-green-600 text-white hover:bg-green-700 px-6 py-2 rounded shadow-sm font-medium"
              >
                ← Back to List
              </button>
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
              {/* Adjustment Type Selection */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">
                  🎯 Select Adjustment Type
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div
                    className={getTypeCardClass("PHYSICAL_COUNT")}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        adjustmentType: "PHYSICAL_COUNT",
                      })
                    }
                  >
                    <div className="text-3xl mb-2">📋</div>
                    <div className="font-bold text-slate-700">
                      Physical Count
                    </div>
                    <div className="text-xs text-slate-500">
                      Based on actual inventory count
                    </div>
                  </div>
                  <div
                    className={getTypeCardClass("INCREASE")}
                    onClick={() =>
                      setFormData({ ...formData, adjustmentType: "INCREASE" })
                    }
                  >
                    <div className="text-3xl mb-2">📈</div>
                    <div className="font-bold text-slate-700">
                      Stock Increase
                    </div>
                    <div className="text-xs text-slate-500">
                      Add stock (found, corrections)
                    </div>
                  </div>
                  <div
                    className={getTypeCardClass("DECREASE")}
                    onClick={() =>
                      setFormData({ ...formData, adjustmentType: "DECREASE" })
                    }
                  >
                    <div className="text-3xl mb-2">📉</div>
                    <div className="font-bold text-slate-700">
                      Stock Decrease
                    </div>
                    <div className="text-xs text-slate-500">
                      Reduce stock (damage, theft)
                    </div>
                  </div>
                  <div
                    className={getTypeCardClass("OTHER")}
                    onClick={() =>
                      setFormData({ ...formData, adjustmentType: "OTHER" })
                    }
                  >
                    <div className="text-3xl mb-2">⚙️</div>
                    <div className="font-bold text-slate-700">
                      Other Adjustment
                    </div>
                    <div className="text-xs text-slate-500">
                      Miscellaneous adjustments
                    </div>
                  </div>
                </div>
              </div>

              {/* Adjustment Information */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">
                  📋 Adjustment Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="label">Adjustment No</label>
                    <input
                      type="text"
                      className="input bg-slate-100"
                      value={formData.adjustmentNo}
                      disabled
                    />
                  </div>
                  <div>
                    <label className="label">
                      Adjustment Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={formData.adjustmentDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          adjustmentDate: e.target.value,
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
                    <label className="label">Adjustment Type</label>
                    <input
                      type="text"
                      className="input bg-slate-100"
                      value={formData.adjustmentType}
                      disabled
                    />
                  </div>
                  <div>
                    <label className="label">Reference Document</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., PC-2024-001"
                      value={formData.referenceDoc}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          referenceDoc: e.target.value,
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
                  Adjustment Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input min-w-96"
                  rows="4"
                  placeholder="Provide detailed reason for this adjustment..."
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
                    📦 Adjustment Items
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
                        <th className="w-24 min-w-[100px] p-3">Item Code</th>
                        <th className="w-16 min-w-[60px] p-3">Current Stock</th>
                        <th className="w-32 min-w-[130px] p-3">
                          Adjusted Stock
                        </th>
                        <th className="w-20 min-w-[80px] p-3">Diff</th>
                        <th className="w-20 min-w-[80px] p-3">UOM</th>
                        <th className="w-24 min-w-[90px] p-3">Unit Cost</th>
                        <th className="w-28 min-w-[100px] p-3">Impact</th>
                        <th className="w-48 min-w-[200px] p-3">Remarks</th>
                        <th className="w-16 p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((item) => {
                        const diff =
                          Number(item.adjustedStock) -
                          Number(item.currentStock);
                        const impact = diff * Number(item.unitCost);
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
                                  id={`sa-item-search-${item.id}`} autoComplete="off"
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
                                {searchResults.length && !item.item_id
                                  ? (() => {
                                      const el = document.getElementById(
                                        `sa-item-search-${item.id}`,
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
                                  : null}
                              </div>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                className="input text-sm py-1 bg-slate-50 w-24"
                                value={item.itemCode || ""}
                                readOnly
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                className="input text-sm py-1 bg-slate-50 w-16"
                                value={item.currentStock}
                                readOnly
                              />
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-3">
                                <input
                                  type="number"
                                  className="input text-sm py-1 font-bold w-36"
                                  value={item.adjustedStock}
                                  onChange={(e) =>
                                    updateItem(
                                      item.id,
                                      "adjustedStock",
                                      e.target.value,
                                    )
                                  }
                                />
                                {(() => {
                                  const it = availableItems.find(
                                    (ai) =>
                                      String(ai.id) === String(item.item_id),
                                  );
                                  const defaultUom =
                                    (it?.uom && String(it.uom)) ||
                                    (item.uom && String(item.uom)) ||
                                    (defaultUomCode
                                      ? String(defaultUomCode)
                                      : "");
                                  const nonDefaults = (
                                    Array.isArray(unitConversions)
                                      ? unitConversions
                                      : []
                                  )
                                    .filter(
                                      (c) =>
                                        Number(c.is_active) &&
                                        Number(c.item_id) ===
                                          Number(item.item_id) &&
                                        String(c.to_uom) === defaultUom,
                                    )
                                    .map((c) => String(c.from_uom));
                                  const preferredUom =
                                    item.uom && String(item.uom) !== defaultUom
                                      ? String(item.uom)
                                      : nonDefaults[0] || "";
                                  const hasConv =
                                    nonDefaults.length > 0 &&
                                    preferredUom &&
                                    preferredUom !== defaultUom;
                                  return hasConv ? (
                                    <button
                                      type="button"
                                      className="px-2 py-1 text-xs border border-brand text-brand rounded hover:bg-brand hover:text-white transition-colors"
                                      onClick={() =>
                                        setConvModal({
                                          open: true,
                                          itemId: item.item_id,
                                          defaultUom: defaultUom,
                                          currentUom: preferredUom,
                                          rowId: item.id,
                                        })
                                      }
                                    >
                                      {`number of ${preferredUom}`}
                                    </button>
                                  ) : null;
                                })()}
                              </div>
                            </td>
                            <td className="p-2 font-bold">
                              <span
                                className={
                                  diff > 0
                                    ? "text-green-600"
                                    : diff < 0
                                      ? "text-red-600"
                                      : "text-slate-400"
                                }
                              >
                                {diff > 0 ? "+" : ""}
                                {diff}
                              </span>
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
                              {impact.toFixed(2)}
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
                            colSpan="10"
                            className="p-8 text-center text-slate-500"
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
                  🧮 Adjustment Impact Summary
                </h4>
                <div className="flex gap-8 text-sm">
                  <div>
                    Total Items Adjusted:{" "}
                    <span className="font-bold text-brand-700">
                      {items.length}
                    </span>
                  </div>
                  <div>
                    Net Qty Change:{" "}
                    <span className="font-bold text-brand-700">
                      {items.reduce(
                        (acc, i) =>
                          acc +
                          (Number(i.adjustedStock) - Number(i.currentStock)),
                        0,
                      )}
                    </span>
                  </div>
                  <div>
                    Total Value Impact:{" "}
                    <span className="font-bold text-brand-700">
                      {items
                        .reduce(
                          (acc, i) =>
                            acc +
                            (Number(i.adjustedStock) - Number(i.currentStock)) *
                              Number(i.unitCost),
                          0,
                        )
                        .toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </fieldset>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button onClick={() => window.history.back()} className="btn-light bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded"
              >
                Cancel
              </button>
              {!isView ? (
                <button
                  type="submit"
                  className="btn-success bg-green-600 text-white hover:bg-green-700 px-6 py-2 rounded shadow-sm font-medium"
                >
                  {saving ? "Saving..." : "Save Adjustment"}
                </button>
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
    </div>
  );
}
