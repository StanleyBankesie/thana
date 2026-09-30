/**
 * @fileoverview IssueToRequirementForm component.
 * Provides functionality for IssueToRequirementForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUoms } from "@/hooks/useUoms";
import { filterByPrefix } from "@/utils/searchUtils.js";

import { toast } from "react-toastify";
import { api } from "api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function IssueToRequirementForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const toDateOnly = (v) => {
    if (!v) return "";
    const s = String(v);
    return s.includes("T") ? s.split("T")[0] : s;
  };

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [availableItems, setAvailableItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [itemQueries, setItemQueries] = useState({});

  const [formData, setFormData] = useState({
    issueNo: isNew ? "Auto-generated" : "ISS-000",
    issueDate: new Date().toISOString().split("T")[0],
    warehouseId: "",
    issuedTo: "",
    departmentId: "",
    issueType: "GENERAL",
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
      qtyIssued: "",
      uom: "",
      batchNumber: "",
      serialNumber: "",
    },
  ]);

  const mapIssueTypeFromReq = (reqType) => {
    const t = String(reqType || "").toUpperCase();
    if (t === "PRODUCTION") return "PRODUCTION";
    if (t === "MAINTENANCE") return "MAINTENANCE";
    return "GENERAL";
  };

  const populateFromRequisition = async (reqId) => {
    if (!reqId) return;
    try {
      const isMaint = String(reqId).startsWith("maint_");
      const isPM = String(reqId).startsWith("pm_");
      const isProd = String(reqId).startsWith("prod_");
      const actualId = isMaint
        ? String(reqId).replace("maint_", "")
        : isPM
          ? String(reqId).replace("pm_", "")
          : isProd
            ? String(reqId).replace("prod_", "")
            : reqId;
      const endpoint = isMaint
        ? `/maintenance/material-requisitions/${actualId}`
        : isPM
          ? `/projects/material-requisitions/${actualId}`
          : isProd
            ? `/production/execution/material-requisition/${actualId}`
            : `/inventory/material-requisitions/${reqId}`;
      const res = await api.get(endpoint);
      const hdr = res.data?.item || res.data || null;
      const details = Array.isArray(res.data?.details) ? res.data.details : (Array.isArray(res.data?.items) ? res.data.items : []);
      if (hdr) {
        setFormData((prev) => ({
          ...prev,
          requisitionId: String(reqId),
          warehouseId: hdr.warehouse_id
            ? String(hdr.warehouse_id)
            : prev.warehouseId,
          departmentId: hdr.department_id
            ? String(hdr.department_id)
            : prev.departmentId,
          issueType: isMaint ? "MAINTENANCE" : isPM ? "PROJECT" : isProd ? "PRODUCTION" : mapIssueTypeFromReq(hdr.requisition_type),
          issuedTo: hdr.requested_by || prev.issuedTo,
          remarks: prev.remarks || "",
        }));
      }
      if (details.length) {
        const populatedLines = details.map((d) => {
          const remaining =
            Number(d.qty_requested || 0) - Number(d.qty_issued || 0);
          return {
            id: d.id || Date.now() + Math.random(),
            item_id: d.item_id ? String(d.item_id) : "",
            itemCode: d.item_code || "",
            itemName: d.item_name || "",
            qtyIssued: remaining > 0 ? remaining : Number(d.qty_requested || 0),
            uom: d.uom || "",
            batchNumber: "",
            serialNumber: "",
          };
        });
        setLines(populatedLines);
        const initQueries = {};
        populatedLines.forEach((l) => {
          initQueries[l.id] = l.itemName || "";
        });
        setItemQueries(initQueries);
      }
    } catch (e) {
      setError(
        e?.response?.data?.message || "Failed to populate from requisition",
      );
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [itemsRes, warehousesRes, deptsRes, reqRes, maintReqRes, pmReqRes, prodReqRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/inventory/warehouses"),
          api.get("/admin/departments"),
          api.get("/inventory/material-requisitions"),
          api.get("/maintenance/material-requisitions").catch(() => ({ data: { items: [] } })),
          api.get("/projects/material-requisitions").catch(() => ({ data: { items: [] } })),
          api.get("/production/execution/material-requisition").catch(() => ({ data: { items: [] } })),
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
          setDepartments(
            Array.isArray(deptsRes.data?.items) ? deptsRes.data.items : [],
          );
          const invReqs = Array.isArray(reqRes.data?.items)
            ? reqRes.data.items.filter((r) => {
                const s = String(r.status || "").toUpperCase();
                return s !== "CANCELLED" && s !== "REJECTED";
              }).map((r) => ({ ...r, _source: "inventory" }))
            : [];
          const maintReqs = Array.isArray(maintReqRes.data?.items)
            ? maintReqRes.data.items.filter((r) => {
                const s = String(r.status || "").toUpperCase();
                return s !== "CANCELLED" && s !== "REJECTED";
              }).map((r) => ({ ...r, _source: "maintenance", id: `maint_${r.id}` }))
            : [];
          const pmReqs = Array.isArray(pmReqRes.data?.items)
            ? pmReqRes.data.items.filter((r) => {
                const s = String(r.status || "").toUpperCase();
                return s !== "CANCELLED" && s !== "REJECTED";
              }).map((r) => ({ ...r, _source: "project", id: `pm_${r.id}` }))
            : [];
          const prodItems = Array.isArray(prodReqRes.data?.items)
            ? prodReqRes.data.items
            : Array.isArray(prodReqRes.data)
              ? prodReqRes.data
              : [];
          const prodReqs = prodItems
            .filter((r) => {
              const s = String(r.status || "").toUpperCase();
              return s !== "CANCELLED" && s !== "REJECTED";
            })
            .map((r) => ({
              ...r,
              _source: "production",
              id: `prod_${r.id}`,
              requisition_no: r.requisition_no || r.req_no || `REQ-${r.id}`,
            }));
          setRequisitions([...invReqs, ...maintReqs, ...pmReqs, ...prodReqs]);
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
      .get(`/inventory/issue-to-requirement/${id}`)
      .then((res) => {
        if (!mounted) return;
        const h = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!h) return;

        setFormData({
          issueNo: h.issue_no || "",
          issueDate:
            toDateOnly(h.issue_date) || new Date().toISOString().split("T")[0],
          warehouseId: h.warehouse_id ? String(h.warehouse_id) : "",
          issuedTo: h.issued_to || "",
          departmentId: h.department_id ? String(h.department_id) : "",
          issueType: h.issue_type || "GENERAL",
          requisitionId: h.requisition_id
            ? (h.requisition_source === "maintenance" ? `maint_${h.requisition_id}`
              : h.requisition_source === "project" ? `pm_${h.requisition_id}`
              : h.requisition_source === "production" ? `prod_${h.requisition_id}`
              : String(h.requisition_id))
            : "",
          status: h.status || "DRAFT",
          remarks: h.remarks || "",
        });

        setLines(
          details.length
            ? details.map((d) => ({
                id: d.id || Date.now() + Math.random(),
                item_id: d.item_id ? String(d.item_id) : "",
                itemCode: d.item_code || "",
                itemName: d.item_name || "",
                qtyIssued: Number(d.qty_issued) || 0,
                uom: d.uom || "",
                batchNumber: d.batch_number || "",
                serialNumber: d.serial_number || "",
              }))
            : [
                {
                  id: 1,
                  item_id: "",
                  itemCode: "",
                  itemName: "",
                  qtyIssued: 0,
                  uom: "",
                  batchNumber: "",
                  serialNumber: "",
                },
              ],
        );
        const initQueries = {};
        (details.length ? details : [{ id: 1 }]).forEach((d) => {
          initQueries[d.id || 1] = "";
        });
        setItemQueries(initQueries);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load issue to requirement",
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

  const getDeptType = (deptId) => {
    if (!deptId) return null;
    const selectedDept = departments.find(
      (d) => String(d.id) === String(deptId)
    );
    if (!selectedDept) return null;
    const nameStr = String(selectedDept.name || selectedDept.department_name || "").toLowerCase();
    const codeStr = String(selectedDept.code || selectedDept.dept_code || "").toLowerCase();
    if (nameStr.includes("production") || nameStr.includes("manufactur") || codeStr.includes("production") || codeStr.includes("prod") || codeStr.includes("mfg")) {
      return "PRODUCTION";
    }
    if (nameStr.includes("maintenance") || nameStr.includes("maint") || codeStr.includes("maintenance") || codeStr.includes("maint")) {
      return "MAINTENANCE";
    }
    if (nameStr.includes("project") || codeStr.includes("project") || nameStr.includes("proj") || codeStr.includes("proj")) {
      return "PROJECT";
    }
    return "GENERAL";
  };

  const selectedDeptType = useMemo(() => {
    return getDeptType(formData.departmentId);
  }, [departments, formData.departmentId]);

  const filteredRequisitions = useMemo(() => {
    if (selectedDeptType === "PRODUCTION") {
      return requisitions.filter((req) => req._source === "production");
    }
    if (selectedDeptType === "MAINTENANCE") {
      return requisitions.filter((req) => req._source === "maintenance");
    }
    if (selectedDeptType === "PROJECT") {
      return requisitions.filter((req) => req._source === "project");
    }
    if (selectedDeptType === "GENERAL") {
      return requisitions.filter((req) => req._source === "inventory" || req._source === "general");
    }
    return requisitions;
  }, [selectedDeptType, requisitions]);

  const normalizedDetails = useMemo(() => {
    return lines
      .filter((l) => l.item_id)
      .map((l) => ({
        item_id: Number(l.item_id),
        qty_issued: Number(l.qtyIssued) || 0,
        uom: l.uom || "",
        batch_number: l.batchNumber || null,
        serial_number: l.serialNumber || null,
      }));
  }, [lines]);

  const addLine = () => {
    const newId = Date.now();
    setLines([
      ...lines,
      {
        id: newId,
        item_id: "",
        itemCode: "",
        itemName: "",
        qtyIssued: 0,
        uom: "",
        batchNumber: "",
        serialNumber: "",
      },
    ]);
    setItemQueries((prev) => ({ ...prev, [newId]: "" }));
  };

  const handleSelectItem = (lineId, item) => {
    setLines(
      lines.map((l) =>
        l.id === lineId
          ? {
              ...l,
              item_id: String(item.id),
              itemCode: item.item_code || "",
              itemName: item.item_name || "",
              uom: item.uom || "",
            }
          : l,
      ),
    );
    setItemQueries((prev) => ({ ...prev, [lineId]: item.item_name || "" }));
  };

  const removeLine = (lineId) => {
    setLines(lines.filter((l) => l.id !== lineId));
  };

  const handleSubmit = async (e, statusOverride) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");

    const finalStatus = statusOverride || formData.status;
    const rawReqId = formData.requisitionId || "";
    const isMaintReq = String(rawReqId).startsWith("maint_");
    const isPMReq = String(rawReqId).startsWith("pm_");
    const isProdReq = String(rawReqId).startsWith("prod_");
    const numericReqId = isMaintReq
      ? Number(String(rawReqId).replace("maint_", ""))
      : isPMReq
        ? Number(String(rawReqId).replace("pm_", ""))
        : isProdReq
          ? Number(String(rawReqId).replace("prod_", ""))
          : Number(rawReqId);

    try {
      const payload = {
        issue_no: isNew ? null : formData.issueNo,
        issue_date: formData.issueDate,
        warehouse_id: formData.warehouseId
          ? Number(formData.warehouseId)
          : null,
        issued_to: formData.issuedTo || null,
        department_id: formData.departmentId
          ? Number(formData.departmentId)
          : null,
        issue_type: formData.issueType,
        requisition_id: Number.isFinite(numericReqId) && numericReqId > 0
          ? numericReqId
          : null,
        requisition_source: isMaintReq
          ? "maintenance"
          : isPMReq
            ? "project"
            : isProdReq
              ? "production"
              : "inventory",
        status: finalStatus,
        remarks: formData.remarks || null,
        details: normalizedDetails,
      };

      if (isNew) {
        await api.post("/inventory/issue-to-requirement", payload);
      } else {
        await api.put(`/inventory/issue-to-requirement/${id}`, payload);
      }

      toast.success(
        isNew ? "Issue created successfully" : "Issue updated successfully",
      );
      navigate("/inventory/issue-to-requirement");
    } catch (e2) {
      setError(
        e2?.response?.data?.message || "Failed to save issue to requirement",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew
                  ? "New Issue to Requirement Area"
                  : "Edit Issue to Requirement Area"}
              </h1>
              <p className="text-sm mt-1">
                Issue materials to departments / requirement areas
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
                <label className="label">Issue No</label>
                <input
                  type="text"
                  className="input bg-slate-100 dark:bg-slate-700"
                  value={formData.issueNo}
                  disabled
                />
              </div>
              <div>
                <label className="label">Issue Date *</label>
                <input
                  type="date"
                  className="input"
                  value={formData.issueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, issueDate: e.target.value })
                  }
                  required
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="label">Issue Type *</label>
                <select
                  required
                  className="input"
                  value={formData.issueType}
                  onChange={(e) =>
                    setFormData({ ...formData, issueType: e.target.value })
                  }
                >
                  <option value="GENERAL">General</option>
                  <option value="PRODUCTION">Production</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="PROJECT">Project</option>
                </select>
              </div>
              <div>
                <label className="label">Destination Department *</label>
                <select
                  required
                  className="input"
                  value={formData.departmentId}
                  onChange={(e) => {
                    const newDeptId = e.target.value;
                    const deptType = getDeptType(newDeptId);

                    let newReqId = formData.requisitionId;
                    if (newReqId) {
                      const currentReq = requisitions.find(
                        (r) => String(r.id) === String(newReqId)
                      );
                      if (currentReq) {
                        if (deptType === "PRODUCTION" && currentReq._source !== "production") {
                          newReqId = "";
                        } else if (deptType === "MAINTENANCE" && currentReq._source !== "maintenance") {
                          newReqId = "";
                        } else if (deptType === "PROJECT" && currentReq._source !== "project") {
                          newReqId = "";
                        } else if (deptType === "GENERAL" && (currentReq._source === "production" || currentReq._source === "maintenance" || currentReq._source === "project")) {
                          newReqId = "";
                        }
                      }
                    }

                    setFormData((prev) => ({
                      ...prev,
                      departmentId: newDeptId,
                      requisitionId: newReqId,
                      ...(deptType && deptType !== "GENERAL" ? { issueType: deptType } : {}),
                    }));
                  }}
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.department_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Source Warehouse *</label>
                <select required
                  className="input"
                  value={formData.warehouseId}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouseId: e.target.value })
                  }
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name || w.warehouse_code || w.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Requisition Reference</label>
                <select
                  className="input"
                  value={formData.requisitionId}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, requisitionId: val });
                    if (val) {
                      await populateFromRequisition(val);
                    }
                  }}
                >
                  <option value="">Select Requisition (Optional)</option>
                  {filteredRequisitions.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.requisition_no}{req._source === "maintenance" ? " (Maintenance)" : req._source === "project" ? " (Project)" : req._source === "production" ? " (Production)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Remarks *</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({ ...formData, remarks: e.target.value })
                  }
                  placeholder="Enter any additional notes or remarks"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Items
                </h3>
                <button
                  type="button"
                  onClick={addLine}
                  className="btn-success text-sm"
                >
                  + Add Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="w-12">#</th>
                      <th className="w-1/2 min-w-[280px]">Item</th>
                      <th className="w-28 min-w-[100px]">Qty Issued</th>
                      <th className="w-20 min-w-[80px]">UOM</th>
                      <th className="w-40 min-w-[160px]">Batch No</th>
                      <th className="w-40 min-w-[160px]">Serial No</th>
                      <th className="w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const itemQuery = itemQueries[line.id] || "";
                      const showQuery = line.item_id
                        ? line.itemName
                        : itemQuery;
                      const searchResults =
                        itemQuery.trim() && !line.item_id
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
                        <tr key={line.id}>
                          <td className="text-center text-slate-500">
                            {index + 1}
                          </td>
                          <td>
                            <div className="relative">
                              <input
                                id={`ir-item-search-${line.id}`}
                                autoComplete="off"
                                className="input w-full"
                                placeholder="Scan barcode or type item name"
                                value={showQuery}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItemQueries((prev) => ({
                                    ...prev,
                                    [line.id]: val,
                                  }));
                                  if (line.item_id) {
                                    setLines(
                                      lines.map((l) =>
                                        l.id === line.id
                                          ? {
                                              ...l,
                                              item_id: "",
                                              itemCode: "",
                                              itemName: "",
                                              uom: "",
                                            }
                                          : l,
                                      ),
                                    );
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    const query = (
                                      itemQueries[line.id] || ""
                                    ).trim();
                                    if (!query || !searchResults.length) return;
                                    handleSelectItem(line.id, searchResults[0]);
                                  }
                                }}
                              />
                              {searchResults.length
                                ? (() => {
                                    const el = document.getElementById(
                                      `ir-item-search-${line.id}`,
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
                                              handleSelectItem(line.id, o);
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
                          <td className="w-24">
                            <input
                              type="number"
                              className="input"
                              value={line.qtyIssued}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setLines(
                                  lines.map((l) =>
                                    l.id === line.id
                                      ? {
                                          ...l,
                                          qtyIssued: Number.isFinite(v) ? v : 0,
                                        }
                                      : l,
                                  ),
                                );
                              }}
                              min="0"
                              step="0.001"
                            />
                          </td>
                          <td className="w-24">
                            <input
                              type="text"
                              className="input bg-slate-100 dark:bg-slate-700"
                              value={line.uom || ""}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="input"
                              value={line.batchNumber}
                              onChange={(e) =>
                                setLines(
                                  lines.map((l) =>
                                    l.id === line.id
                                      ? { ...l, batchNumber: e.target.value }
                                      : l,
                                  ),
                                )
                              }
                              placeholder="Batch No"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="input"
                              value={line.serialNumber}
                              onChange={(e) =>
                                setLines(
                                  lines.map((l) =>
                                    l.id === line.id
                                      ? { ...l, serialNumber: e.target.value }
                                      : l,
                                  ),
                                )
                              }
                              placeholder="Serial No"
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeLine(line.id)}
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
              <button onClick={() => window.history.back()} className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, "DRAFT")}
                className="btn-success"
                disabled={saving}
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
