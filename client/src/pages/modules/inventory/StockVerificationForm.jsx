import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Save, Plus, Trash2, ArrowLeft, Check } from "lucide-react";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

export default function StockVerificationForm({
  isModal = false,
  modalId = null,
  onClose = null,
}) {
  const { hasExceptional } = usePermission();
  const { id: routeId } = useParams();
  const id = isModal ? modalId : routeId;
  const navigate = useNavigate();
  const isNew = id === "new" || !id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isWfActive, setIsWfActive] = useState(false);
  const [checkingWf, setCheckingWf] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemQueries, setItemQueries] = useState({});
  const [warehouses, setWarehouses] = useState([]);

  const [formData, setFormData] = useState({
    verification_number: "",
    verification_date: new Date().toISOString().split("T")[0],
    warehouse_id: "",
    verification_type: "PHYSICAL_COUNT",
    status: "DRAFT",
    remarks: "",
  });

  const [items, setItems] = useState([]);

  const verificationTypes = [
    { value: "PHYSICAL_COUNT", label: "Physical Count" },
    { value: "CYCLE_COUNT", label: "Cycle Count" },
    { value: "SPOT_CHECK", label: "Spot Check" },
    { value: "PERIODIC", label: "Periodic" },
  ];

  const itemSelectOptions = useMemo(
    () =>
      Array.isArray(availableItems)
        ? availableItems.map((ai) => ({
            value: String(ai.id),
            label: `${ai.item_code || ""} - ${ai.item_name || ""}`,
            barcode: ai.barcode || "",
          }))
        : [],
    [availableItems],
  );

  const checkWorkflowStatus = async () => {
    setCheckingWf(true);
    try {
      const res = await api.get("/workflows");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const active = items.some(
        (w) =>
          Number(w.is_active) === 1 &&
          (String(w.document_route) === "/inventory/stock-verification" ||
            String(w.document_type).toUpperCase() === "STOCK_VERIFICATION" ||
            String(w.document_type).toUpperCase() === "STOCK VERIFICATION"),
      );
      setIsWfActive(active);
    } catch (e) {
      console.error("Workflow status check failed", e);
    } finally {
      setCheckingWf(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [itemsRes, warehousesRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/inventory/warehouses"),
        ]);

        if (mounted) {
          setAvailableItems(
            Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
          );
          setWarehouses(
            Array.isArray(warehousesRes.data?.items)
              ? warehousesRes.data.items
              : [],
          );
        }
      } catch (e) {
        if (mounted) {
          setError("Failed to load initial data");
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  const skipStockRefresh = useRef(false);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);

    api
      .get(`/inventory/stock-verification/${id}`)
      .then((res) => {
        if (!mounted) return;
        skipStockRefresh.current = true;
        const a = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];

        if (a) {
          setFormData({
            verification_number: a.verification_no || "",
            verification_date: a.verification_date
              ? a.verification_date.split("T")[0]
              : "",
            warehouse_id: a.warehouse_id || "",
            verification_type: a.verification_type || "PHYSICAL_COUNT",
            status: a.status || "DRAFT",
            remarks: a.remarks || a.reason || "",
          });

          const mappedDetails = details.map((d) => ({
            id: d.id || Date.now() + Math.random(),
            item_id: d.item_id ? String(d.item_id) : "",
            itemCode: d.item_code || "",
            itemName: d.item_name || "",
            system_qty: Number(d.system_qty || 0),
            reserve_qty: Number(d.reserve_qty || 0),
            verified_qty:
              d.counted_qty !== undefined && d.counted_qty !== null
                ? Number(d.counted_qty)
                : d.verified_qty !== undefined && d.verified_qty !== null
                  ? Number(d.verified_qty)
                  : "",
            uom: d.uom || "",
            remarks: d.remarks || "",
          }));
          setItems(mappedDetails);
          const initQueries = {};
          mappedDetails.forEach((i) => {
            initQueries[i.id] = i.itemName || i.itemCode || "";
          });
          setItemQueries(initQueries);
        }
      })
      .catch((e) => {
        if (mounted)
          setError(e?.response?.data?.message || "Failed to load verification");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew) return;
    let mounted = true;
    api
      .get("/inventory/stock-verification/next-no")
      .then((res) => {
        if (!mounted) return;
        const no = res.data?.verification_no || "";
        setFormData((prev) => ({
          ...prev,
          verification_number: prev.verification_number || no,
        }));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isNew]);

  useEffect(() => {
    if (skipStockRefresh.current) {
      skipStockRefresh.current = false;
      return;
    }
    const warehouseId = formData.warehouse_id
      ? Number(formData.warehouse_id)
      : 0;
    const targets = Array.isArray(items)
      ? items.filter((item) => item.item_id).map((item) => item.id)
      : [];

    if (!warehouseId) {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          system_qty: 0,
          reserve_qty: 0,
        })),
      );
      return;
    }

    if (!targets.length) return;

    (async () => {
      for (const rowId of targets) {
        const row = items.find((item) => item.id === rowId);
        if (!row?.item_id) continue;
        const stock = await fetchSystemStock(row.item_id, warehouseId);
        setItems((prev) =>
          prev.map((item) =>
            item.id === rowId
              ? {
                  ...item,
                  system_qty: stock.qty,
                  reserve_qty: stock.reserved,
                }
              : item,
          ),
        );
      }
    })();
  }, [
    formData.warehouse_id,
    items.map((item) => `${item.id}:${item.item_id || ""}`).join("|"),
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addItem = () => {
    const newId = Date.now();
    setItems([
      ...items,
      {
        id: newId,
        item_id: "",
        system_qty: 0,
        reserve_qty: 0,
        verified_qty: "",
        uom: "PCS",
        remarks: "",
      },
    ]);
    setItemQueries((prev) => ({ ...prev, [newId]: "" }));
  };

  const removeItem = (rowId) => {
    setItems(items.filter((item) => item.id !== rowId));
  };

  const fetchSystemStock = async (itemId, warehouseId) => {
    const iid = itemId ? Number(itemId) : 0;
    const wid = warehouseId ? Number(warehouseId) : 0;
    if (!iid || !wid) return { qty: 0, reserved: 0 };
    try {
      const res = await api.get("/inventory/stock/balance", {
        params: { item_id: iid, warehouse_id: wid },
      });
      return {
        qty: Number(res.data?.qty || 0),
        reserved: Number(res.data?.reserved || 0),
      };
    } catch {
      return { qty: 0, reserved: 0 };
    }
  };

  const updateItem = (rowId, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== rowId) return item;
        const updated = { ...item, [field]: value };
        if (field === "item_id") {
          const selectedItem = availableItems.find(
            (i) => String(i.id) === String(value),
          );
          if (selectedItem) {
            updated.uom = selectedItem.uom || "";
          }
          updated.system_qty = 0;
          updated.reserve_qty = 0;
          updated.verified_qty = "";
        }
        return updated;
      }),
    );

    if (field === "item_id" && value && formData.warehouse_id) {
      fetchSystemStock(value, formData.warehouse_id).then((stock) => {
        setItems((prev) =>
          prev.map((item) =>
            item.id === rowId
              ? { ...item, system_qty: stock.qty, reserve_qty: stock.reserved }
              : item,
          ),
        );
      });
    }
  };

  const buildPayload = () => ({
    verification_no: formData.verification_number,
    verification_date: formData.verification_date,
    warehouse_id: Number(formData.warehouse_id),
    verification_type: formData.verification_type,
    status: formData.status || "DRAFT",
    remarks: formData.remarks,
    details: items
      .filter((i) => i.item_id)
      .map((i) => ({
        item_id: Number(i.item_id),
        system_qty: Number(i.system_qty || 0),
        reserve_qty: Number(i.reserve_qty || 0),
        verified_qty: Number(i.verified_qty || 0),
        variance_qty:
          Number(i.verified_qty || 0) -
          (Number(i.system_qty || 0) + Number(i.reserve_qty || 0)),
        uom: i.uom || "PCS",
        remarks: i.remarks || null,
      })),
  });

  const saveVerification = async ({ navigateAfterSave = true } = {}) => {
    if (!formData.warehouse_id || !formData.verification_date) {
      toast.error("Please fill in all required fields");
      return null;
    }

    setSaving(true);
    setError("");

    try {
      const payload = buildPayload();
      let savedId = id;

      if (isNew) {
        const res = await api.post("/inventory/stock-verification", payload);
        savedId = res.data?.id || null;
      } else {
        await api.put(`/inventory/stock-verification/${id}`, payload);
      }

      if (navigateAfterSave) {
        if (isModal) {
          onClose && onClose(true);
        } else {
          navigate("/inventory/stock-verification");
        }
      }
      return savedId || id || null;
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save verification");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    await saveVerification();
  };

  const handleConfirmVerification = async () => {
    const currentId = await saveVerification({ navigateAfterSave: false });
    if (!currentId) return;

    setSaving(true);
    setError("");
    try {
      await api.post(`/inventory/stock-verification/${currentId}/submit`);
      toast.success("Verification confirmed and approved");
      if (isModal) onClose && onClose(true);
      else navigate("/inventory/stock-verification");
    } catch (e) {
      setError(e?.response?.data?.message || "Confirmation failed");
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {!isModal && (
            <Link
              to="/inventory/stock-verification"
              className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? "New Stock Verification" : "Edit Stock Verification"}
            </h1>
            <p className="text-sm text-gray-600">
              {isNew
                ? "Create a new stock verification record"
                : `Editing ${formData.verification_number}`}
            </p>
          </div>
        </div>
        {isModal && (
          <button
            type="button"
            onClick={() => onClose && onClose()}
            className="text-slate-400 hover:text-slate-600 text-3xl pb-1"
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Main Info Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b dark:border-slate-700">
              Verification Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Verification Number
                </label>
                <input
                  type="text"
                  name="verification_number"
                  value={formData.verification_number}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-300"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Verification Date *
                </label>
                <input
                  type="date"
                  name="verification_date"
                  value={formData.verification_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Warehouse *
                </label>
                <select
                  name="warehouse_id"
                  value={formData.warehouse_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
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
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Verification Type *
                </label>
                <select
                  name="verification_type"
                  value={formData.verification_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {verificationTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Remarks
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
                rows="4"
                className="w-96 px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter any additional remarks..."
              />
            </div>
          </div>

          {/* Items Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Items</h2>
              <button
                onClick={addItem}
                className="flex items-center gap-2 px-3 py-1.5 text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#0E3646" }}
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead className="bg-gray-50 dark:bg-slate-800 border-b dark:border-slate-700">
                  <tr>
                    <th className="w-1/2 min-w-[280px] px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="w-24 min-w-[90px] px-3 py-3 text-center text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      Available Qty
                    </th>
                    <th className="w-24 min-w-[90px] px-3 py-3 text-center text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Reserve Qty
                    </th>
                    <th className="w-28 min-w-[110px] px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Verified Qty
                    </th>
                    <th className="w-24 min-w-[90px] px-3 py-3 text-center text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Balance Qty
                    </th>
                    <th className="w-28 min-w-[100px] px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Variance
                    </th>
                    <th className="w-20 min-w-[80px] px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      UOM
                    </th>
                    <th className="w-96 min-w-[380px] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Remarks
                    </th>
                    <th className="w-16 px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan="9"
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No items added yet. Click "Add Item" to start.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const itemQuery = itemQueries[item.id] || "";
                      const searchResults = itemQuery.trim()
                        ? filterByPrefix(availableItems, {
                            query: itemQuery,
                            searchFields: ["item_code", "item_name", "barcode"],
                          })
                        : [];
                      return (
                        <tr key={item.id}>
                          <td className="px-6 py-4">
                            <div className="relative">
                              <input
                                id={`sv-item-search-${item.id}`} autoComplete="off"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                    if (!query || !searchResults.length) return;
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
                                  const el = document.getElementById(`sv-item-search-${item.id}`);
                                  const r = el ? el.getBoundingClientRect() : { bottom: 0, left: 0, width: 0 };
                                  return (
                                    <div
                                      className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-auto"
                                      style={{ position: 'fixed', top: `${r.bottom + 4}px`, left: `${r.left}px`, width: `${r.width}px`, zIndex: 9999 }}
                                    >
                                      {searchResults.map((o) => (
                                        <button
                                          type="button"
                                          key={o.id}
                                          className="block w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-white text-xs"
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
                          <td className="px-3 py-4 text-center">
                            <span className="font-mono font-bold text-blue-600">
                              {Number(item.system_qty || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <span className="font-mono font-bold text-amber-600">
                              {Number(item.reserve_qty || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <input
                              type="number"
                              value={item.verified_qty}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "verified_qty",
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-bold"
                              step="1"
                            />
                          </td>
                          <td className="px-3 py-4 text-center">
                            <span className="font-mono font-bold text-indigo-600">
                              {(
                                Number(item.system_qty || 0) +
                                Number(item.reserve_qty || 0)
                              ).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <div
                              className={`w-full px-3 py-2 border rounded-lg font-bold text-center ${
                                Number(item.verified_qty || 0) -
                                  (Number(item.system_qty || 0) +
                                    Number(item.reserve_qty || 0)) <
                                0
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : Number(item.verified_qty || 0) -
                                        (Number(item.system_qty || 0) +
                                          Number(item.reserve_qty || 0)) >
                                      0
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-gray-50 text-gray-500 border-gray-300"
                              }`}
                            >
                              {Number(item.verified_qty || 0) -
                                (Number(item.system_qty || 0) +
                                  Number(item.reserve_qty || 0)) >
                              0
                                ? "+"
                                : ""}
                              {Number(item.verified_qty || 0) -
                                (Number(item.system_qty || 0) +
                                  Number(item.reserve_qty || 0))}
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 dark:text-slate-300 font-medium">
                                {item.uom || "PCS"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={item.remarks || ""}
                              onChange={(e) =>
                                updateItem(item.id, "remarks", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Optional"
                            />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 dark:hover:bg-slate-700 rounded-full transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <div className="flex flex-col md:flex-row gap-3 md:justify-end">
              <button
                type="button"
                onClick={() =>
                  isModal
                    ? onClose && onClose()
                    : navigate("/inventory/stock-verification")
                }
                className="px-4 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              {(!formData.status || formData.status === "DRAFT") && (
                <>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: "#15803d" }}
                  >
                    <Save className="w-5 h-5" />
                    {saving ? "Saving..." : "Save"}
                  </button>
                  {((!isWfActive && !checkingWf) || id !== "new") &&
                    (!formData.status || formData.status === "DRAFT") && (
                      <button
                        type="button"
                        onClick={handleConfirmVerification}
                        disabled={saving}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: "#4f46e5" }}
                      >
                        <Check className="w-5 h-5" />
                        {saving ? "Confirming..." : "Confirm Verification"}
                      </button>
                    )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in duration-200 p-6">
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">{formContent}</div>
    </div>
  );
}
