/**
 * @fileoverview StockTransferForm component.
 * Provides functionality for StockTransferForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { useUoms } from "@/hooks/useUoms";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function StockTransferForm() {
  const { hasExceptional } = usePermission();
  const { uoms, loading: uomsLoading } = useUoms();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availableItems, setAvailableItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [fromBranchWarehouses, setFromBranchWarehouses] = useState([]);
  const [toBranchWarehouses, setToBranchWarehouses] = useState([]);

  const [formData, setFormData] = useState({
    transferNo: isNew ? "Auto-generated" : "ST-2024-001",
    transferDate: new Date().toISOString().split("T")[0],
    transferType: "INTER_WAREHOUSE",
    deliveryDate: "",
    driverName: "",
    vehicleNo: "",
    fromBranchId: "",
    toBranchId: "",
    fromWarehouseId: "",
    toWarehouseId: "",
    remarks: "",
    status: "DRAFT",
  });

  const [items, setItems] = useState([
    {
      id: 1,
      item_id: "",
      itemCode: "",
      itemName: "",
      qty: "",
      uom: "PCS",
      batchNumber: "",
      availableQty: "",
      batchOptions: [],
      remarks: "",
    },
  ]);
  const [itemQueries, setItemQueries] = useState({ 1: "" });

  const getEffectiveFromWarehouseId = () => {
    if (formData.transferType === "INTER_WAREHOUSE") {
      return Number(formData.fromBranchId) || 0;
    }
    return Number(formData.fromWarehouseId) || 0;
  };

  const refreshRowBatchOptions = async (rowId, itemId) => {
    const wid = getEffectiveFromWarehouseId();
    const iid = itemId ? Number(itemId) : 0;
    if (!wid || !iid) {
      setItems((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, batchOptions: [], availableQty: "" } : r,
        ),
      );
      return;
    }
    try {
      const res = await api.get("/inventory/batch-options", {
        params: { item_id: iid, warehouse_id: wid },
      });
      const opts = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          const selectedBatch = (opts || []).find(
            (x) => String(x.batch_no) === String(r.batchNumber || ""),
          );
          return {
            ...r,
            batchOptions: opts,
            availableQty: selectedBatch ? Number(selectedBatch.qty || 0) : "",
          };
        }),
      );
    } catch {
      setItems((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, batchOptions: [] } : r)),
      );
    }
  };

  useEffect(() => {
    const wid = getEffectiveFromWarehouseId();
    if (!wid) return;
    const snapshot = Array.isArray(items) ? items : [];
    const rows = snapshot.filter((r) => r.item_id);
    if (!rows.length) return;
    (async () => {
      for (const r of rows) {
        await refreshRowBatchOptions(r.id, r.item_id);
      }
    })();
  }, [formData.transferType, formData.fromBranchId, formData.fromWarehouseId]);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [itemsRes, branchesRes, warehousesRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/admin/branches"),
          api.get("/inventory/warehouses"),
        ]);

        if (mounted) {
          setAvailableItems(
            Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
          );
          setBranches(
            Array.isArray(branchesRes.data?.items)
              ? branchesRes.data.items
              : [],
          );
          setWarehouses(
            Array.isArray(warehousesRes.data?.items)
              ? warehousesRes.data.items
              : [],
          );
        }
      } catch (e) {
        if (mounted) {
          setError(e?.response?.data?.message || "Failed to load initial data");
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isNew) return;
    let mounted = true;
    api
      .get("/inventory/stock-transfers/next-no")
      .then((res) => {
        if (!mounted) return;
        const nextNo = res.data?.next_no;
        if (nextNo) {
          setFormData((prev) => ({ ...prev, transferNo: nextNo }));
        }
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, [isNew]);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/stock-transfers/${id}`)
      .then((res) => {
        if (!mounted) return;
        const t = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!t) return;

        setFormData({
          transferNo: t.transfer_no || "",
          transferDate: t.transfer_date
            ? typeof t.transfer_date === "string"
              ? t.transfer_date.split("T")[0]
              : new Date(t.transfer_date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          transferType: String(
            t.transfer_type || "INTER_WAREHOUSE",
          ).toUpperCase(),
          deliveryDate: t.delivery_date ? t.delivery_date.split("T")[0] : "",
          driverName: t.driver_name || "",
          vehicleNo: t.vehicle_no || "",
          fromBranchId: t.from_branch_id ? String(t.from_branch_id) : "",
          toBranchId: t.to_branch_id ? String(t.to_branch_id) : "",
          fromWarehouseId: t.from_warehouse_id
            ? String(t.from_warehouse_id)
            : "",
          toWarehouseId: t.to_warehouse_id ? String(t.to_warehouse_id) : "",
          remarks: t.remarks || "",
          status: t.status || "DRAFT",
        });

        const mappedItems = details.length
          ? details.map((d) => ({
              id: d.id || Date.now() + Math.random(),
              item_id: d.item_id ? String(d.item_id) : "",
              itemCode: d.item_code || "",
              itemName: d.item_name || "",
              qty: Number(d.qty) || "",
              uom: d.uom || "PCS",
              batchNumber: d.batch_number || "",
              availableQty: "",
              batchOptions: [],
              remarks: d.remarks || "",
            }))
          : [
              {
                id: 1,
                item_id: "",
                itemCode: "",
                itemName: "",
                qty: "",
                uom: "PCS",
                availableQty: "",
                batchOptions: [],
                batchNumber: "",
                remarks: "",
              },
            ];
        setItems(mappedItems);
        const initQueries = {};
        mappedItems.forEach((i) => { initQueries[i.id] = i.itemName || ""; });
        setItemQueries(initQueries);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load stock transfer");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (formData.transferType !== "INTER_BRANCH") {
      setFromBranchWarehouses([]);
      return;
    }
    const bid = Number(formData.fromBranchId);
    if (!bid) {
      setFromBranchWarehouses([]);
      return;
    }
    const branch = branches.find((b) => String(b.id) === String(bid));
    const companyId = branch ? Number(branch.company_id) : undefined;
    api
      .get("/inventory/warehouses", {
        headers: {
          "x-branch-id": String(bid),
          ...(companyId ? { "x-company-id": String(companyId) } : {}),
        },
      })
      .then((res) => {
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setFromBranchWarehouses(items);
      })
      .catch(() => {
        setFromBranchWarehouses([]);
      });
  }, [formData.transferType, formData.fromBranchId, branches]);

  useEffect(() => {
    if (formData.transferType !== "INTER_BRANCH") {
      setToBranchWarehouses([]);
      return;
    }
    const bid = Number(formData.toBranchId);
    if (!bid) {
      setToBranchWarehouses([]);
      return;
    }
    const branch = branches.find((b) => String(b.id) === String(bid));
    const companyId = branch ? Number(branch.company_id) : undefined;
    api
      .get("/inventory/warehouses", {
        headers: {
          "x-branch-id": String(bid),
          ...(companyId ? { "x-company-id": String(companyId) } : {}),
        },
      })
      .then((res) => {
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setToBranchWarehouses(items);
      })
      .catch(() => {
        setToBranchWarehouses([]);
      });
  }, [formData.transferType, formData.toBranchId, branches]);

  useEffect(() => {
    setFormData((prev) =>
      String(prev.fromBranchId) ? prev : { ...prev, fromWarehouseId: "" },
    );
  }, [formData.fromBranchId]);

  useEffect(() => {
    setFormData((prev) =>
      String(prev.toBranchId) ? prev : { ...prev, toWarehouseId: "" },
    );
  }, [formData.toBranchId]);

  const normalizedDetails = useMemo(() => {
    return items
      .filter((r) => r.item_id)
      .map((r) => ({
        item_id: Number(r.item_id),
        qty: Number(r.qty) || "",
        batch_number: r.batchNumber,
        remarks: r.remarks,
      }));
  }, [items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const isInterBranch = formData.transferType === "INTER_BRANCH";
      const isInterWarehouse = formData.transferType === "INTER_WAREHOUSE";

      const fromWarehouseIdIW = isInterWarehouse
        ? Number(formData.fromBranchId) || null
        : Number(formData.fromWarehouseId) || null;
      const toWarehouseIdIW = isInterWarehouse
        ? Number(formData.toBranchId) || null
        : Number(formData.toWarehouseId) || null;

      let fromBranchIdNum = Number(formData.fromBranchId) || null;
      let toBranchIdNum = Number(formData.toBranchId) || null;

      if (isInterWarehouse) {
        const fromWh = warehouses.find(
          (w) => String(w.id) === String(fromWarehouseIdIW),
        );
        const toWh = warehouses.find(
          (w) => String(w.id) === String(toWarehouseIdIW),
        );
        fromBranchIdNum =
          fromWh && fromWh.branch_id
            ? Number(fromWh.branch_id)
            : fromBranchIdNum;
        toBranchIdNum =
          toWh && toWh.branch_id ? Number(toWh.branch_id) : toBranchIdNum;
      }

      const payload = {
        transfer_no: isNew ? undefined : formData.transferNo,
        transfer_date: formData.transferDate,
        transfer_type: String(
          formData.transferType || "INTER_WAREHOUSE",
        ).toUpperCase(),
        delivery_date: formData.deliveryDate,
        driver_name: formData.driverName || null,
        vehicle_no: formData.vehicleNo || null,
        from_branch_id: fromBranchIdNum,
        to_branch_id: toBranchIdNum,
        from_warehouse_id: fromWarehouseIdIW,
        to_warehouse_id: toWarehouseIdIW,
        status: "DRAFT",
        remarks: formData.remarks,
        details: normalizedDetails,
      };

      if (isNew) {
        await api.post("/inventory/stock-transfers", payload);
      } else {
        await api.put(`/inventory/stock-transfers/${id}`, payload);
      }

      navigate("/inventory/stock-transfers");
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save stock transfer");
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
        qty: "",
        uom: "PCS",
        batchNumber: "",
        availableQty: "",
        batchOptions: [],
        remarks: "",
      },
    ]);
    setItemQueries((prev) => ({ ...prev, [newId]: "" }));
  };

  const handleSelectItem = (rowId, item) => {
    setItems(items.map(i =>
      i.id === rowId
        ? {
            ...i,
            item_id: String(item.id),
            itemCode: item.item_code || "",
            itemName: item.item_name || "",
            uom: item.uom || "PCS",
          }
        : i
    ));
    setItemQueries((prev) => ({ ...prev, [rowId]: item.item_name || "" }));
    refreshRowBatchOptions(rowId, item.id);
  };

  const removeItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const getSourceDestName = (id) => {
    if (!id) return "";
    if (formData.transferType === "INTER_WAREHOUSE") {
      const w = warehouses.find((w) => String(w.id) === String(id));
      return w ? w.warehouse_name : "";
    }
    const b = branches.find((b) => String(b.id) === String(id));
    return b ? b.name : "";
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew ? "New Stock Transfer" : "Edit Stock Transfer"}
              </h1>
              <p className="text-sm mt-1">
                Transfer stock between warehouses and branches
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Transfer No</label>
                <input
                  type="text"
                  className="input bg-slate-100 dark:bg-slate-700"
                  value={formData.transferNo}
                  disabled
                />
              </div>
              <div>
                <label className="label">Transfer Date *</label>
                <input
                  type="date"
                  className="input"
                  value={formData.transferDate}
                  onChange={(e) =>
                    setFormData({ ...formData, transferDate: e.target.value })
                  }
                  required
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="label">Transfer Type *</label>
                <select
                  className="input"
                  value={formData.transferType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      transferType: e.target.value,
                      fromBranchId: "",
                      toBranchId: "",
                      fromWarehouseId: "",
                      toWarehouseId: "",
                    })
                  }
                  required
                >
                  <option value="INTER_WAREHOUSE">Inter-Warehouse</option>
                  <option value="INTER_BRANCH">Inter-Branch</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">
                  From{" "}
                  {formData.transferType === "INTER_WAREHOUSE"
                    ? "Warehouse"
                    : "Branch"}{" "}
                  *
                </label>
                <select
                  className="input"
                  value={formData.fromBranchId}
                  onChange={(e) =>
                    setFormData({ ...formData, fromBranchId: e.target.value })
                  }
                  required
                >
                  <option value="">
                    Select{" "}
                    {formData.transferType === "INTER_WAREHOUSE"
                      ? "Warehouse"
                      : "Branch"}
                  </option>
                  {(formData.transferType === "INTER_WAREHOUSE"
                    ? warehouses
                    : branches
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {formData.transferType === "INTER_WAREHOUSE"
                        ? item.warehouse_name
                        : item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">
                  To{" "}
                  {formData.transferType === "INTER_WAREHOUSE"
                    ? "Warehouse"
                    : "Branch"}{" "}
                  *
                </label>
                <select
                  className="input"
                  value={formData.toBranchId}
                  onChange={(e) =>
                    setFormData({ ...formData, toBranchId: e.target.value })
                  }
                  required
                >
                  <option value="">
                    Select{" "}
                    {formData.transferType === "INTER_WAREHOUSE"
                      ? "Warehouse"
                      : "Branch"}
                  </option>
                  {(formData.transferType === "INTER_WAREHOUSE"
                    ? warehouses
                    : branches
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {formData.transferType === "INTER_WAREHOUSE"
                        ? item.warehouse_name
                        : item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Delivery Date</label>
                <input
                  type="date"
                  className="input"
                  value={formData.deliveryDate}
                  onChange={(e) =>
                    setFormData({ ...formData, deliveryDate: e.target.value })
                  }
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Driver Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.driverName}
                  onChange={(e) =>
                    setFormData({ ...formData, driverName: e.target.value })
                  }
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="label">Vehicle Number</label>
                <input
                  type="text"
                  className="input"
                  value={formData.vehicleNo}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicleNo: e.target.value })
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            {formData.transferType === "INTER_BRANCH" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    From Warehouse (in selected From Branch)
                  </label>
                  <select
                    className="input"
                    value={formData.fromWarehouseId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fromWarehouseId: e.target.value,
                      })
                    }
                    disabled={!formData.fromBranchId}
                    required
                  >
                    <option value="">
                      {formData.fromBranchId
                        ? "Select Warehouse"
                        : "Select From Branch first"}
                    </option>
                    {fromBranchWarehouses.map((w) => (
                      <option key={w.id} value={String(w.id)}>
                        {w.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">
                    To Warehouse (in selected To Branch)
                  </label>
                  <select
                    className="input"
                    value={formData.toWarehouseId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        toWarehouseId: e.target.value,
                      })
                    }
                    disabled={!formData.toBranchId}
                    required
                  >
                    <option value="">
                      {formData.toBranchId
                        ? "Select Warehouse"
                        : "Select To Branch first"}
                    </option>
                    {toBranchWarehouses.map((w) => (
                      <option key={w.id} value={String(w.id)}>
                        {w.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {/* Visualization of Flow */}
            <div className="flex items-center justify-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Origin
                </div>
                <div className="font-bold text-lg text-slate-800 dark:text-slate-200">
                  {getSourceDestName(formData.fromBranchId) || "Select Source"}
                </div>
                {formData.transferType === "INTER_BRANCH" &&
                formData.fromWarehouseId ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {
                      (
                        fromBranchWarehouses.find(
                          (w) =>
                            String(w.id) === String(formData.fromWarehouseId),
                        ) || { warehouse_name: "" }
                      ).warehouse_name
                    }
                  </div>
                ) : null}
              </div>
              <div className="mx-8 flex flex-col items-center text-brand-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
                <span className="text-xs font-medium mt-1">
                  {formData.transferType.replace("_", " ")}
                </span>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Destination
                </div>
                <div className="font-bold text-lg text-slate-800 dark:text-slate-200">
                  {getSourceDestName(formData.toBranchId) ||
                    "Select Destination"}
                </div>
                {formData.transferType === "INTER_BRANCH" &&
                formData.toWarehouseId ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {
                      (
                        toBranchWarehouses.find(
                          (w) =>
                            String(w.id) === String(formData.toWarehouseId),
                        ) || { warehouse_name: "" }
                      ).warehouse_name
                    }
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <label className="label">Remarks</label>
              <textarea
                className="input w-96"
                rows="4"
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
                  Items to Transfer
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
                      <th className="w-48 min-w-[180px]">Batch No</th>
                      <th className="w-36 min-w-[140px]">Available Qty</th>
                      <th className="w-32 min-w-[120px]">Qty</th>
                      <th className="w-32 min-w-[120px]">UOM</th>
                      <th className="w-64 min-w-[250px]">Remarks</th>
                      <th className="w-16"></th>
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
                              id={`st-item-search-${item.id}`} autoComplete="off"
                              className="input w-full"
                              placeholder="Scan barcode or type item name"
                              value={itemQueries[item.id] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemQueries((prev) => ({
                                  ...prev,
                                  [item.id]: val,
                                }));
                                if (item.item_id) {
                                  setItems(items.map(i =>
                                    i.id === item.id ? { ...i, item_id: "", itemCode: "", itemName: "", uom: "PCS" } : i
                                  ));
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const query = (itemQueries[item.id] || "").trim();
                                  if (!query || !searchResults.length) return;
                                  handleSelectItem(item.id, searchResults[0]);
                                }
                              }}
                            />
                            {searchResults.length && !item.item_id ? (
                              (() => {
                                const el = document.getElementById(`st-item-search-${item.id}`);
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
                          <select
                            className="input"
                            value={item.batchNumber}
                            onChange={(e) => {
                              const batchNo = e.target.value;
                              const opt = (item.batchOptions || []).find(
                                (x) => String(x.batch_no) === String(batchNo),
                              );
                              const availableQty = opt
                                ? Number(opt.qty ?? 0)
                                : "";
                              setItems((prev) =>
                                prev.map((i) =>
                                  i.id === item.id
                                    ? {
                                        ...i,
                                        batchNumber: batchNo,
                                        availableQty,
                                      }
                                    : i,
                                ),
                              );
                            }}
                          >
                            <option value="">Select Batch (Optional)</option>
                            {(item.batchOptions || []).map((b) => (
                              <option key={b.batch_no} value={b.batch_no}>
                                {b.batch_no}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input bg-slate-50 dark:bg-slate-700/40"
                            value={item.availableQty}
                            readOnly
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input"
                            value={item.qty}
                            onChange={(e) => {
                              const updated = items.map((i) =>
                                i.id === item.id
                                  ? {
                                      ...i,
                                      qty: parseFloat(e.target.value) || 0,
                                    }
                                  : i,
                              );
                              setItems(updated);
                            }}
                            min="0"
                            step="1"
                          />
                        </td>
                        <td>
                          <select
                            className="input"
                            value={item.uom}
                            onChange={(e) => {
                              const updated = items.map((i) =>
                                i.id === item.id
                                  ? { ...i, uom: e.target.value }
                                  : i,
                              );
                              setItems(updated);
                            }}
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
                        <td>
                          <input
                            type="text"
                            className="input"
                            value={item.remarks}
                            onChange={(e) => {
                              const updated = items.map((i) =>
                                i.id === item.id
                                  ? { ...i, remarks: e.target.value }
                                  : i,
                              );
                              setItems(updated);
                            }}
                            placeholder="Optional"
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
              <button onClick={() => window.history.back()} className="btn-success">
                Cancel
              </button>
              <button type="submit" className="btn-success">
                {saving ? "Saving..." : "Save Transfer"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
