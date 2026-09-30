/**
 * @fileoverview ProjectOrderForm component.
 * Provides functionality for ProjectOrderForm.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthContext";
import { usePermission } from "../../../../auth/PermissionContext";
import { useUoms } from "@/hooks/useUoms";
import { filterByPrefix } from "@/utils/searchUtils.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProjectOrderForm() {
  const { uoms } = useUoms();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id || id === "new";
  const isViewMode = !isNew && new URLSearchParams(window.location.search).get("mode") === "view";
  const effectiveId = isNew ? null : id;

  useAuth();
  const { canEditDiscount, hasExceptional } = usePermission();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [projects, setProjects] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [itemQueries, setItemQueries] = useState({});
  const [approver, setApprover] = useState(null);
  const [warehouses, setWarehouses] = useState([]);

  const [newItem, setNewItem] = useState({
    item_id: "",
    item_name: "",
    qty: "",
    unit_price: "",
    discount_percent: 0,
    tax_type: "",
    uom: "",
    remarks: "",
  });
  const [itemQuery, setItemQuery] = useState("");

  const [formData, setFormData] = useState({
    orderNo: "",
    orderDate: new Date().toISOString().split("T")[0],
    projectId: "",
    priority: "MEDIUM",
    warehouseId: "",
    status: "DRAFT",
    remarks: "",
  });

  const [items, setItems] = useState([]);

  const statusColors = {
    DRAFT: "bg-gray-500 text-white",
    PENDING_APPROVAL: "bg-yellow-400 text-black",
    APPROVED: "bg-green-500 text-white",
    REJECTED: "bg-red-500 text-white",
    CANCELLED: "bg-red-500 text-white",
  };

  const priorities = [
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
    { value: "URGENT", label: "Urgent" },
  ];

  const readOnly = isViewMode || !["DRAFT", "REJECTED"].includes(formData.status);

  const calcItem = (itm) => {
    const qty = parseFloat(itm.qty) || 0;
    const price = parseFloat(itm.unitPrice) || 0;
    const disc = parseFloat(itm.discountPercent) || 0;
    const sub = qty * price;
    const discAmt = (sub * disc) / 100;
    const net = sub - discAmt;
    const taxRate = taxes.find((t) => String(t.value) === String(itm.taxType))?.rate || 0;
    const taxAmt = (net * taxRate) / 100;
    return { subTotal: sub, discAmt, net, taxAmt, total: net + taxAmt };
  };

  const calcGrand = () => {
    let subTotal = 0, taxTotal = 0, total = 0;
    items.forEach(i => {
      subTotal += i.subTotal || 0;
      taxTotal += i.taxAmt || 0;
      total += i.total || 0;
    });
    return { subTotal, taxTotal, total };
  };

  const { subTotal, taxTotal, total } = calcGrand();

  // useEffect for warehouseId removed to prevent stale closure race conditions.
  // Instead, handleWarehouseChange takes care of this logic exclusively.

  useEffect(() => {
    let mounted = true;
    api.get("/projects/projects", { params: { active: "true" } }).then(res => {
      if (!mounted) return;
      setProjects(Array.isArray(res.data?.items) ? res.data.items : []);
    }).catch(() => {});
    api.get("/inventory/items", { params: { active: "true" } }).then(res => {
      if (!mounted) return;
      setAvailableItems(Array.isArray(res.data?.items) ? res.data.items : []);
    }).catch(() => {});
    api.get("/finance/tax-codes", { params: { active: "true" } }).then(res => {
      if (!mounted) return;
      const fetched = Array.isArray(res.data?.items) ? res.data.items : [];
      const seen = new Set();
      const unique = fetched.filter(t => {
        if (seen.has(t.name)) return false;
        seen.add(t.name);
        return true;
      });
      setTaxes(unique.map(t => ({ value: t.id, label: t.name, rate: Number(t.rate_percent), code: t.code })));
    }).catch(() => {});
    api.get("/inventory/warehouses").then(res => {
      if (!mounted) return;
      setWarehouses(Array.isArray(res.data?.items) ? res.data.items : []);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isNew) {
      api.get("/projects/project-orders/next-no").then(res => {
        const no = res.data?.order_no || res.data?.next_no || "";
        if (no) setFormData(prev => ({ ...prev, orderNo: no }));
      }).catch(() => {});
    }
    if (isNew) return;
    let mounted = true;
    setLoading(true);
    setError("");

    api.get(`/projects/project-orders/${effectiveId}`).then(res => {
      if (!mounted) return;
      const d = res.data?.item || {};
      if (!d) return;
      setFormData({
        orderNo: d.order_no || "",
        orderDate: d.order_date ? d.order_date.split("T")[0] : new Date().toISOString().split("T")[0],
        projectId: d.project_id ? String(d.project_id) : "",
        priority: d.priority || "MEDIUM",
        warehouseId: d.warehouse_id ? String(d.warehouse_id) : "",
        status: d.status || "DRAFT",
        remarks: d.remarks || "",
      });
      setApprover(d.status === "PENDING_APPROVAL" && d.approver ? d.approver : null);
      const dets = res.data?.details || [];
      if (dets.length > 0) {
        Promise.all(dets.map(async (line) => {
          const qty = Number(line.qty ?? line.quantity ?? 0);
          const price = Number(line.unit_price || 0);
          const disc = Number(line.discount_percent || 0);
          const sub = qty * price;
          const discAmt = (sub * disc) / 100;
          const net = Number(line.net_amount || sub - discAmt);
          const aq = await fetchAvailable(d.warehouse_id, line.item_id);
          return {
            id: line.id || Date.now() + Math.random(),
            item_id: line.item_id ? String(line.item_id) : "",
            itemCode: line.item_code || "",
            itemName: line.item_name || "",
            qty, unitPrice: price, discountPercent: disc,
            taxType: line.tax_code_id ? String(line.tax_code_id) : "",
            uom: line.uom || "",
            subTotal: sub, discAmt, net,
            taxAmt: Number(line.tax_amount || (net * (Number(line.tax_rate) || 0)) / 100),
            total: Number(line.total_amount || net + (net * (Number(line.tax_rate) || 0)) / 100),
            available_qty: aq,
          };
        })).then(resolvedItems => setItems(resolvedItems));
        const initQueries = {};
        dets.forEach(x => { initQueries[x.id || Date.now()] = x.item_name || ""; });
        setItemQueries(initQueries);
      }
    }).catch(e => {
      if (!mounted) return;
      setError(e?.response?.data?.message || "Failed to load order");
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
        itemName: item.item_name || "",
        unitPrice: item.selling_price || 0,
        uom: item.uom || "",
        ...calcItem({ ...i, item_id: String(item.id), itemName: item.item_name || "", unitPrice: item.selling_price || 0 }),
      } : i,
    ));
    setItemQueries(prev => ({ ...prev, [rowId]: item.item_name || "" }));

    if (formData.warehouseId && item.id) {
      fetchAvailable(formData.warehouseId, item.id).then(aq => {
        setItems(prev => prev.map(i =>
          i.id === rowId ? { ...i, available_qty: aq } : i,
        ));
      });
    }
  };

  const fetchAvailable = async (warehouseId, itemId) => {
    if (!warehouseId || !itemId) return 0;
    try {
      const resp = await api.get(`/inventory/stock/available?warehouse_id=${warehouseId}&item_id=${itemId}`);
      return Number(resp.data?.qty || 0);
    } catch { return 0; }
  };

  const handleWarehouseChange = async (e) => {
    const wh = e.target.value;
    setFormData(prev => ({ ...prev, warehouseId: wh }));
    if (!wh) {
      setItems(prev => prev.map((i) => ({ ...i, available_qty: undefined })));
      setNewItem(prev => ({ ...prev, available_qty: undefined }));
      return;
    }
    if (items.length > 0 && wh) {
      const updated = await Promise.all(
        items.map(async (it) => {
          if (it.item_id) {
            return {
              ...it,
              available_qty: await fetchAvailable(wh, it.item_id),
            };
          }
          return it;
        })
      );
      setItems(updated);
    }
    if (newItem.item_id && wh) {
      const aq = await fetchAvailable(wh, Number(newItem.item_id));
      setNewItem((prev) => ({ ...prev, available_qty: aq }));
    }
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    if (name === "item_id") {
      const prod = availableItems.find((p) => String(p.id) === String(value));
      setNewItem((prev) => ({
        ...prev,
        item_id: value,
        item_name: prod?.item_name || "",
        unit_price: prod?.selling_price || "",
        qty: 1,
        uom: String(prod?.uom || ""),
      }));
      const wh = formData.warehouseId;
      if (value && wh) {
        fetchAvailable(wh, Number(value)).then((aq) =>
          setNewItem((prev) => ({ ...prev, available_qty: aq }))
        );
      } else {
        setNewItem((prev) => ({ ...prev, available_qty: undefined }));
      }
    } else {
      setNewItem((prev) => ({ ...prev, [name]: value }));
    }
  };

  const addItem = () => {
    if (!newItem.item_id || !newItem.qty || !newItem.unit_price) {
      setError("Please fill all required item fields");
      return;
    }
    if (newItem.available_qty !== undefined && Number(newItem.qty || 0) > Number(newItem.available_qty || 0)) {
      setError("Quantity exceeds available stock for selected warehouse");
      return;
    }
    const calculations = calcItem({
      qty: parseFloat(newItem.qty) || 0,
      unitPrice: parseFloat(newItem.unit_price) || 0,
      discountPercent: parseFloat(newItem.discount_percent) || 0,
      taxType: newItem.tax_type || "",
    });
    setItems([
      ...items,
      {
        id: Date.now(),
        item_id: newItem.item_id,
        itemCode: availableItems.find(p => String(p.id) === String(newItem.item_id))?.item_code || "",
        itemName: newItem.item_name,
        qty: parseFloat(newItem.qty) || 1,
        unitPrice: parseFloat(newItem.unit_price) || 0,
        discountPercent: parseFloat(newItem.discount_percent) || 0,
        taxType: newItem.tax_type || "",
        uom: newItem.uom || "",
        ...calculations,
        available_qty: newItem.available_qty,
      },
    ]);
    setNewItem({
      item_id: "", item_name: "", qty: "", unit_price: "",
      discount_percent: 0, tax_type: "", uom: "", remarks: "",
    });
    setItemQuery("");
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItemField = (id, field, val) => {
    setItems(items.map(i => {
      if (i.id !== id) return i;
      const u = { ...i, [field]: val };
      return { ...u, ...calcItem(u) };
    }));
  };

  const buildPayload = () => ({
    order_no: formData.orderNo,
    order_date: formData.orderDate || null,
    project_id: formData.projectId ? Number(formData.projectId) : null,
    priority: formData.priority,
    warehouse_id: formData.warehouseId ? Number(formData.warehouseId) : null,
    status: formData.status || "DRAFT",
    remarks: formData.remarks || null,
    total_amount: total, sub_total: subTotal, tax_amount: taxTotal,
    items: items.map(i => ({
      item_id: Number(i.item_id), quantity: Number(i.qty), unit_price: Number(i.unitPrice),
      discount_percent: Number(i.discountPercent),
      tax_id: i.taxType ? Number(i.taxType) : null,
      tax_rate: taxes.find(tx => String(tx.value) === String(i.taxType))?.rate || 0,
      net_amount: Number(i.net || 0), tax_amount: Number(i.taxAmt || 0), total_amount: Number(i.total || 0),
      uom: i.uom || "",
    })),
  });

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.projectId || items.length === 0) { setError("Select a project and add at least one item"); return; }
    
    const invalidItems = items.filter(
      (item) => Number(item.qty || 0) > Number(item.available_qty || 0)
    );
    if (invalidItems.length > 0) {
      setError(
        `Quantity exceeds available stock for items: ${invalidItems
          .map((i) => i.item_name || i.itemName)
          .join(", ")}`
      );
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = buildPayload();
      if (isNew) {
        await api.post("/projects/project-orders", payload);
      } else {
        await api.put(`/projects/project-orders/${effectiveId}`, payload);
      }
      navigate("/project-management/project-orders", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleSubmitApproval = async () => {
    if (!formData.projectId || items.length === 0) { setError("Select a project and add at least one item"); return; }
    
    const invalidItems = items.filter(
      (item) => Number(item.qty || 0) > Number(item.available_qty || 0)
    );
    if (invalidItems.length > 0) {
      setError(
        `Quantity exceeds available stock for items: ${invalidItems
          .map((i) => i.item_name || i.itemName)
          .join(", ")}`
      );
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = buildPayload();
      if (isNew) {
        const res = await api.post("/projects/project-orders", payload);
        if (res.data?.item?.id) await api.post(`/projects/project-orders/${res.data.item.id}/submit`);
      } else {
        await api.put(`/projects/project-orders/${effectiveId}`, payload);
        await api.post(`/projects/project-orders/${effectiveId}/submit`);
      }
      navigate("/project-management/project-orders", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to submit");
    } finally { setSubmitting(false); }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm("Cancel this project order?")) return;
    try {
      await api.delete(`/projects/project-orders/${effectiveId}`);
      navigate("/project-management/project-orders", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to cancel");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this project order?")) return;
    try {
      await api.delete(`/projects/project-orders/${effectiveId}`);
      navigate("/project-management/project-orders", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to delete");
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew ? "New Project Order" : `Project Order ${formData.orderNo}`}
              </h1>
              <p className="text-sm mt-1">Create items for a project</p>
            </div>
            <div className="flex gap-2">
              {!isViewMode && formData.status === "DRAFT" && (
                <>
                  {!isNew && (
                    <button type="button" onClick={handleDelete}
                      className="btn btn-danger text-xs px-3 py-1">Delete</button>
                  )}
                </>
              )}
              {!isNew && formData.status !== "DRAFT" && (
                <button type="button" onClick={handleCancelOrder}
                  className="btn btn-warning text-xs px-3 py-1">Cancel</button>
              )}
              {!isNew && (
                <>
                  <button type="button" onClick={handlePrint}
                    className="btn btn-secondary text-xs px-3 py-1">Print</button>
                </>
              )}
              <button onClick={() => window.history.back()} className="btn-success">Back</button>
            </div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSave} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            {formData.status === "PENDING_APPROVAL" && approver && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-yellow-800">Pending Approval</p>
                  <p className="text-xs text-yellow-700">Assigned to: {approver.name || approver.email || "Unknown"}{approver.role && ` (${approver.role})`}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="hidden">
                <label className="label">Order No</label>
                <input type="text" className="input bg-slate-50" value={formData.orderNo} readOnly />
              </div>
              <div>
                <label className="label">Order Date *</label>
                <input type="date" className="input" value={formData.orderDate}
                  onChange={e => setFormData({ ...formData, orderDate: e.target.value })} required disabled={readOnly} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Project *</label>
                <select className="input" value={formData.projectId}
                  onChange={e => setFormData({ ...formData, projectId: e.target.value })} required disabled={readOnly}>
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
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
                <label className="label">Priority</label>
                <select className="input" value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })} disabled={readOnly}>
                  {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Warehouse</label>
                <select className="input" value={formData.warehouseId}
                  onChange={handleWarehouseChange} disabled={readOnly}>
                  <option value="">Select Warehouse</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Remarks</label>
              <textarea className="input w-full" rows="3" value={formData.remarks}
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                disabled={readOnly} placeholder="Enter any additional notes..."></textarea>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Order Items</h3>

              {!readOnly && (
                <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mb-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Item *</label>
                      <div className="relative">
                        <input id="pm-order-item-search" autoComplete="off"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                          placeholder="Scan barcode or type item name"
                          value={itemQuery}
                          onChange={e => {
                            const val = e.target.value;
                            setItemQuery(val);
                            if (newItem.item_id) {
                              setNewItem(prev => ({ ...prev, item_id: "", item_name: "", unit_price: "" }));
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              const query = itemQuery.trim();
                              const results = query ? filterByPrefix(availableItems, { query, searchFields: ["item_code", "item_name", "barcode"] }) : [];
                              if (!query || !results.length) return;
                              e.preventDefault();
                              handleNewItemChange({ target: { name: "item_id", value: results[0].id } });
                              setItemQuery(results[0].item_name);
                            }
                          }}
                        />
                        {(() => {
                          const query = itemQuery.trim();
                          const results = query ? filterByPrefix(availableItems, { query, searchFields: ["item_code", "item_name", "barcode"] }) : [];
                          return results.length && !newItem.item_id ? (() => {
                            const el = document.getElementById("pm-order-item-search");
                            const r = el ? el.getBoundingClientRect() : { bottom: 0, left: 0, width: 0 };
                            return (
                              <div className="bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-auto"
                                style={{ position: 'fixed', top: `${r.bottom + 4}px`, left: `${r.left}px`, width: `${r.width}px`, zIndex: 9999 }}>
                                {results.map(o => (
                                  <button type="button" key={o.id}
                                    className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-xs"
                                    onClick={() => {
                                      handleNewItemChange({ target: { name: "item_id", value: o.id } });
                                      setItemQuery(o.item_name);
                                    }}>
                                    {o.item_code} - {o.item_name}
                                  </button>
                                ))}
                              </div>
                            );
                          })() : null;
                        })()}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">UOM *</label>
                      <select name="uom" value={newItem.uom || ""}
                        onChange={handleNewItemChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]">
                        <option value="">UOM</option>
                        {(Array.isArray(uoms) && uoms.length ? uoms.map(u => ({ code: u.uom_code || u.code || "", name: u.uom_name || u.name || "" }))
                          : [{ code: "EA", name: "EA" }, { code: "PCS", name: "PCS" }, { code: "KG", name: "KG" }, { code: "LTR", name: "LTR" }, { code: "MTR", name: "MTR" }]
                        ).map(u => (
                          <option key={u.code} value={u.code}>{u.name ? `${u.name} (${u.code})` : u.code}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Qty *</label>
                      <input type="number" name="qty" value={newItem.qty}
                        onChange={handleNewItemChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                        min="1" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Available</label>
                      <input type="text"
                        value={formData.warehouseId ? Number(newItem.available_qty || 0).toFixed(2) : ""}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50" readOnly />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Price *</label>
                      <input type="number" name="unit_price" value={newItem.unit_price}
                        onChange={handleNewItemChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]" />
                    </div>
                    <div className={!canEditDiscount() ? "disabled-light-blue" : ""}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Disc %</label>
                      <input type="number" name="discount_percent" value={newItem.discount_percent}
                        onChange={handleNewItemChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                        min="0" max="100" disabled={!canEditDiscount()} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Tax</label>
                      <select name="tax_type" value={newItem.tax_type || ""}
                        onChange={handleNewItemChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]">
                        <option value="">Exempted</option>
                        {taxes.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={addItem}
                      className="bg-[#0E3646] text-white px-4 py-2 rounded-lg hover:bg-[#092530] flex items-center gap-2 transition-colors text-sm">
                      + Add Item
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">UOM</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Available</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Disc%</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Net</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Tax</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Total</th>
                      {!readOnly && <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={readOnly ? 9 : 10} className="px-4 py-8 text-center text-gray-500">No items added yet</td>
                      </tr>
                    ) : items.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{item.itemName}</td>
                        <td className="px-4 py-3 text-gray-900">
                          {readOnly ? (
                            <span>{item.uom || ""}</span>
                          ) : (
                            <select className="input text-xs w-full" value={item.uom || ""}
                              onChange={e => updateItemField(item.id, "uom", e.target.value)}>
                              <option value="">UOM</option>
                              {(Array.isArray(uoms) && uoms.length ? uoms.map(u => ({ code: u.uom_code || u.code || "", name: u.uom_name || u.name || "" }))
                                : [{ code: "EA", name: "EA" }, { code: "PCS", name: "PCS" }]
                              ).map(u => (
                                <option key={u.code} value={u.code}>{u.name || u.code}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {readOnly ? (
                            <span>{item.qty}</span>
                          ) : (
                            <input type="number" className="input text-xs w-full text-right" value={item.qty}
                              onChange={e => updateItemField(item.id, "qty", Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {formData.warehouseId ? Number(item.available_qty || 0).toFixed(2) : ""}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {readOnly ? (
                            <span>{Number(item.unitPrice).toFixed(2)}</span>
                          ) : (
                            <input type="number" step="0.01" className="input text-xs w-full text-right" value={item.unitPrice}
                              onChange={e => updateItemField(item.id, "unitPrice", Number(e.target.value) || 0)} />
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {readOnly ? (
                            <span>{Number(item.discountPercent || 0).toFixed(2)}</span>
                          ) : (
                            <input type="number" className="input text-xs w-full text-right" value={item.discountPercent}
                              onChange={e => updateItemField(item.id, "discountPercent", Number(e.target.value) || 0)}
                              min="0" max="100" disabled={!canEditDiscount()} />
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-900">{Number(item.net || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-900">{Number(item.taxAmt || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{Number(item.total || 0).toFixed(2)}</td>
                        {!readOnly && (
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => removeItem(item.id)}
                              className="text-red-600 hover:text-red-900 transition-colors">Remove</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {items.length > 0 && (
                <div className="flex justify-end pt-4">
                  <div className="bg-slate-50 rounded-lg px-6 py-3">
                    <div className="flex items-center gap-6">
                      <span className="text-sm text-slate-500">Items: <strong>{items.length}</strong></span>
                      <span className="text-sm text-slate-500">Sub Total: <strong>{subTotal.toFixed(2)}</strong></span>
                      <span className="text-sm text-slate-500">Tax: <strong>{taxTotal.toFixed(2)}</strong></span>
                      <span className="text-base font-bold text-slate-900">Total: <span className="text-brand-900">{total.toFixed(2)}</span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Link to="/project-management/project-orders"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">Close</Link>
              {!readOnly && formData.status === "DRAFT" && (
                  <button type="submit" className="btn-success" disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}