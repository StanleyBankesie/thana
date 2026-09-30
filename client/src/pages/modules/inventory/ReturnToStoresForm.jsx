/**
 * @fileoverview ReturnToStoresForm component.
 * Provides functionality for ReturnToStoresForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ReturnToStoresForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [availableItems, setAvailableItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [issues, setIssues] = useState([]);

  const [formData, setFormData] = useState({
    rtsNo: isNew ? "Auto-generated" : "RT-000000",
    rtsDate: new Date().toISOString().split("T")[0],
    warehouseId: "",
    departmentId: "",
    returnType: "EXCESS", // Default
    requisitionId: "",
    status: "DRAFT",
    remarks: "",
  });

  const [lines, setLines] = useState([
    {
      id: 1,
      item_id: "",
      itemCode: "",
      itemName: "",
      uom: "",
      qtyReturned: 0,
      reason: "",
      condition: "GOOD", // Default
      batchSerial: "",
      location: "",
      remarks: "",
    },
  ]);

  const [selectedRequisition, setSelectedRequisition] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [itemsRes, whRes, deptRes, nextNoRes, issuesRes] =
          await Promise.all([
            api.get("/inventory/items"),
            api.get("/inventory/warehouses"),
            api.get("/admin/departments"),
            isNew
              ? api.get("/inventory/return-to-stores/next-no")
              : Promise.resolve({ data: null }),
            api.get("/inventory/issue-to-requirement"),
          ]);

        if (mounted) {
          setAvailableItems(
            Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
          );
          setWarehouses(
            Array.isArray(whRes.data?.items) ? whRes.data.items : [],
          );
          setDepartments(
            Array.isArray(deptRes.data?.items) ? deptRes.data.items : [],
          );
          if (isNew && nextNoRes?.data?.next_no) {
            setFormData((prev) => ({ ...prev, rtsNo: nextNoRes.data.next_no }));
          }
          const allIssues = Array.isArray(issuesRes?.data?.items)
            ? issuesRes.data.items
            : [];
          setIssues(
            allIssues.filter((x) => {
              const s = String(x.status || "").toUpperCase();
              return s === "POSTED" || s === "ISSUED";
            }),
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
    if (isNew) return;
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/return-to-stores/${id}`)
      .then((res) => {
        if (!mounted) return;
        const h = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!h) return;

        setFormData({
          rtsNo: h.rts_no || "",
          rtsDate: h.rts_date || new Date().toISOString().split("T")[0],
          warehouseId: h.warehouse_id ? String(h.warehouse_id) : "",
          departmentId: h.department_id ? String(h.department_id) : "",
          returnType: h.return_type || "EXCESS",
          requisitionId: h.requisition_id ? String(h.requisition_id) : "",
          status: h.status || "DRAFT",
          remarks: h.remarks || "",
        });

        // If there is a requisitionId, fetch it to show details
        if (h.requisition_id) {
          api
            .get(`/inventory/material-requisitions/${h.requisition_id}`)
            .then((reqRes) => {
              if (mounted && reqRes.data?.item) {
                setSelectedRequisition(reqRes.data.item);
              }
            })
            .catch(() => {});
        }

        setLines(
          details.length
            ? details.map((d) => ({
                id: d.id || Date.now() + Math.random(),
                item_id: d.item_id ? String(d.item_id) : "",
                itemCode: d.item_code || "",
                itemName: d.item_name || "",
                uom: d.uom || "PCS", // Should come from item lookup if not in details
                qtyReturned: Number(d.qty_returned) || 0,
                reason: d.reason || "",
                condition: d.condition || "GOOD",
                batchSerial: d.batch_serial || "",
                location: d.location || "",
                remarks: d.remarks || "",
              }))
            : [],
        );

        if (details.length === 0) addLine();
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load return to stores",
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
    return lines
      .filter((l) => l.item_id)
      .map((l) => ({
        item_id: Number(l.item_id),
        qty: Number(l.qtyReturned) || 0,
        qty_returned: Number(l.qtyReturned) || 0,
        qty_issued: Number(l.qtyIssued) || 0,
        remaining_qty: Number(l.remainingQty) || 0,
        reason: l.reason || null,
        condition: l.condition || null,
        batch_serial: l.batchSerial || null,
        location: l.location || null,
        remarks: l.remarks || null,
      }));
  }, [lines]);

  const stats = useMemo(() => {
    const totalItems = lines.filter((l) => l.item_id).length;
    const totalQty = lines.reduce(
      (sum, l) => sum + (Number(l.qtyReturned) || 0),
      0,
    );
    const goodCondition = lines
      .filter((l) => l.condition === "GOOD")
      .reduce((sum, l) => sum + (Number(l.qtyReturned) || 0), 0);
    const damagedQty = lines
      .filter((l) => l.condition === "DAMAGED")
      .reduce((sum, l) => sum + (Number(l.qtyReturned) || 0), 0);
    return { totalItems, totalQty, goodCondition, damagedQty };
  }, [lines]);

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: Date.now(),
        item_id: "",
        itemCode: "",
        itemName: "",
        uom: "",
        qtyReturned: 0,
        reason: "",
        condition: "GOOD",
        batchSerial: "",
        location: "",
        remarks: "",
      },
    ]);
  };

  const removeLine = (lineId) => {
    setLines(lines.filter((l) => l.id !== lineId));
  };

  const handleItemChange = (lineId, itemId) => {
    const item = availableItems.find((i) => String(i.id) === String(itemId));
    setLines(
      lines.map((l) => {
        if (l.id !== lineId) return l;
        return {
          ...l,
          item_id: itemId,
          itemCode: item?.item_code || "",
          itemName: item?.item_name || "",
          uom: item?.uom || "PCS",
        };
      }),
    );
  };

  const updateLine = (lineId, field, value) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const updated = { ...l, [field]: value };
        if (field === "qtyReturned" || field === "qtyIssued") {
          updated.remainingQty = (Number(updated.qtyIssued) || 0) - (Number(updated.qtyReturned) || 0);
        }
        return updated;
      }),
    );
  };

  const handleIssueSelect = (issueId) => {
    setFormData({ ...formData, issueId });
    const issue = issues.find((r) => String(r.id) === String(issueId));
    setSelectedRequisition(issue || null);
    if (!issueId) return;
    api
      .get(`/inventory/issue-to-requirement/${issueId}`)
      .then((res) => {
        const hdr = res.data?.item || {};
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (hdr) {
          setFormData((prev) => ({
            ...prev,
            issueId: String(issueId),
            returnType: prev.returnType || "EXCESS",
            warehouseId: hdr.warehouse_id ? String(hdr.warehouse_id) : prev.warehouseId,
            departmentId: hdr.department_id ? String(hdr.department_id) : prev.departmentId,
            requisitionId: hdr.requisition_id ? String(hdr.requisition_id) : prev.requisitionId || "",
            remarks: hdr.remarks || prev.remarks || "",
          }));
        }
        if (details.length) {
          const populatedLines = details
            .filter((d) => d.item_id)
            .map((d) => {
              const ai = availableItems.find(
                (i) => String(i.id) === String(d.item_id),
              );
              return {
                id: d.id || Date.now() + Math.random(),
                item_id: d.item_id ? String(d.item_id) : "",
                itemCode: d.item_code || "",
                itemName: d.item_name || "",
                uom: d.uom || d.item_uom || ai?.uom || "PCS",
                qtyIssued: Number(d.qty_issued || 0) || 0,
                qtyReturned: Number(d.qty_issued || 0) || 0,
                remainingQty: 0, // Since qtyReturned defaults to qtyIssued
                reason: "UNUSED",
                condition: "GOOD",
                batchSerial: "",
                location: "",
                remarks: "",
              };
            });
          setLines(populatedLines.length ? populatedLines : lines);
        }
      })
      .catch(() => {
        // swallow
      });
  };

  const clearRequisition = () => {
    setFormData({ ...formData, requisitionId: "" });
    setSelectedRequisition(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        rts_no: isNew ? undefined : formData.rtsNo,
        rts_date: formData.rtsDate,
        warehouse_id: formData.warehouseId
          ? Number(formData.warehouseId)
          : null,
        department_id: formData.departmentId
          ? Number(formData.departmentId)
          : null,
        issue_id: formData.issueId
          ? Number(formData.issueId)
          : null,
        return_type: formData.returnType,
        requisition_id: formData.requisitionId
          ? Number(formData.requisitionId)
          : null,
        status: formData.status,
        remarks: formData.remarks || null,
        details: normalizedDetails,
      };

      if (isNew) {
        await api.post("/inventory/return-to-stores", payload);
      } else {
        await api.put(`/inventory/return-to-stores/${id}`, payload);
      }

      navigate("/inventory/return-to-stores", { state: { refresh: true } });
    } catch (e2) {
      setError(
        e2?.response?.data?.message || "Failed to save return to stores",
      );
    } finally {
      setSaving(false);
    }
  };

  const returnReasons = [
    { id: "EXCESS", icon: "📦", title: "Excess Material" },
    { id: "UNUSED", icon: "✨", title: "Unused" },
    { id: "DAMAGED", icon: "💥", title: "Damaged" },
    { id: "WRONG_ITEM", icon: "❌", title: "Wrong Item" },
    { id: "QUALITY_ISSUE", icon: "⚠️", title: "Quality Issue" },
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew
                  ? "New Return to Stores Advice"
                  : "Edit Return to Stores Advice"}
              </h1>
              <p className="text-sm mt-1">
                Record materials being returned to stores
              </p>
            </div>
            <button onClick={() => window.history.back()} className="btn-success">
              Back to List
            </button>
          </div>
        </div>

        <div className="card-body p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            ) : null}

            {/* Return Reason Selection */}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">
                Return Reason
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {returnReasons.map((reason) => (
                  <div
                    key={reason.id}
                    onClick={() =>
                      setFormData({ ...formData, returnType: reason.id })
                    }
                    className={`cursor-pointer border rounded-lg p-4 text-center transition-all ${
                      formData.returnType === reason.id
                        ? "bg-blue-50 border-blue-500 ring-2 ring-blue-200"
                        : "bg-white hover:bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="text-2xl mb-2">{reason.icon}</div>
                    <div className="text-sm font-medium">{reason.title}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Return Details */}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">
                Return Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="label">Return Number</label>
                  <input
                    type="text"
                    className="input bg-slate-100 dark:bg-slate-700"
                    value={formData.rtsNo}
                    disabled
                  />
                </div>
                <div>
                  <label className="label">Return Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={formData.rtsDate}
                    onChange={(e) =>
                      setFormData({ ...formData, rtsDate: e.target.value })
                    }
                    required
                  
                    disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                  />
                </div>
                <div>
                  <label className="label">Status</label>
                  <div className="mt-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        formData.status === "DRAFT"
                          ? "bg-slate-100 text-slate-800"
                          : formData.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800"
                            : formData.status === "APPROVED"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                      }`}
                    >
                      {formData.status}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="label">Department</label>
                  <select
                    className="input"
                    value={formData.departmentId}
                    onChange={(e) =>
                      setFormData({ ...formData, departmentId: e.target.value })
                    }
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.dept_name || d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Warehouse</label>
                  <select
                    className="input"
                    value={formData.warehouseId}
                    onChange={(e) =>
                      setFormData({ ...formData, warehouseId: e.target.value })
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
                  <label className="label">Stock issued number</label>
                  <select
                    className="input"
                    value={formData.issueId || ""}
                    onChange={(e) => handleIssueSelect(e.target.value)}
                  >
                    <option value="">-- Select Issue --</option>
                    {issues.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.issue_no} - {r.department_name || "-"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Issue Reference Block */}
            {selectedRequisition && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-blue-600 dark:text-blue-400 font-semibold flex items-center">
                    📋 Issue Reference
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequisition(null);
                      setFormData({ ...formData, issueId: "" });
                    }}
                    className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">Issue No</div>
                    <div className="font-medium">
                      {selectedRequisition.issue_no}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Department</div>
                    <div className="font-medium">
                      {selectedRequisition.department_name || "--"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Issue Date</div>
                    <div className="font-medium">
                      {selectedRequisition.issue_date}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Issue Type</div>
                    <div className="font-medium">
                      {selectedRequisition.issue_type}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Items Table */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  📦 Return Items
                </h3>
                <button
                  type="button"
                  onClick={addLine}
                  className="btn-primary text-sm"
                >
                  ➕ Add Item
                </button>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-medium">
                    <tr>
                      <th className="px-4 py-3 w-10">#</th>
                      <th className="px-4 py-3 w-64">Item</th>
                      <th className="px-4 py-3 w-28 text-right">Qty Issued</th>
                      <th className="px-4 py-3 w-28 text-right">Remaining</th>
                      <th className="px-4 py-3 w-32">Return Qty</th>
                      <th className="px-4 py-3 w-24">UOM</th>
                      <th className="px-4 py-3 w-32">Condition</th>
                      <th className="px-4 py-3 w-32">Batch/Serial</th>
                      <th className="px-4 py-3 w-32">Location</th>
                      <th className="px-4 py-3">Remarks</th>
                      <th className="px-4 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                    {lines.map((row, index) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2 text-center text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2">
                          <select
                            className="input text-sm py-1"
                            value={row.item_id}
                            onChange={(e) =>
                              handleItemChange(row.id, e.target.value)
                            }
                          >
                            <option value="">Select Item</option>
                            {availableItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.item_code} - {item.item_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right text-slate-700">
                          {Number(row.qtyIssued || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-700">
                          {Number(row.remainingQty || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            className="input text-sm py-1"
                            value={row.qtyReturned}
                            onChange={(e) =>
                              updateLine(row.id, "qtyReturned", e.target.value)
                            }
                            min="0"
                          />
                        </td>
                        <td className="px-4 py-2 text-slate-500">{row.uom}</td>
                        <td className="px-4 py-2">
                          <select
                            className="input text-sm py-1"
                            value={row.condition}
                            onChange={(e) =>
                              updateLine(row.id, "condition", e.target.value)
                            }
                          >
                            <option value="GOOD">Good</option>
                            <option value="DAMAGED">Damaged</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="input text-sm py-1"
                            value={row.batchSerial}
                            onChange={(e) =>
                              updateLine(row.id, "batchSerial", e.target.value)
                            }
                            placeholder="Optional"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="input text-sm py-1"
                            value={row.location}
                            onChange={(e) =>
                              updateLine(row.id, "location", e.target.value)
                            }
                            placeholder="Optional"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="input text-sm py-1"
                            value={row.remarks}
                            onChange={(e) =>
                              updateLine(row.id, "remarks", e.target.value)
                            }
                            placeholder="Optional"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(row.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Section */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 mt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                    Total Items
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-white">
                    {stats.totalItems}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                    Total Quantity
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-white">
                    {stats.totalQty}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                    Good Condition
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {stats.goodCondition}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                    Damaged
                  </div>
                  <div className="text-2xl font-bold text-red-500">
                    {stats.damagedQty}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <label className="label mb-2">General Remarks</label>
              <textarea
                className="input h-24"
                value={formData.remarks}
                onChange={(e) =>
                  setFormData({ ...formData, remarks: e.target.value })
                }
                placeholder="Enter any additional notes about this return..."
              ></textarea>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={() => navigate("/inventory/return-to-stores")}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, status: "DRAFT" });
                  handleSubmit({ preventDefault: () => {} });
                }}
                disabled={saving}
                className="btn-success"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
