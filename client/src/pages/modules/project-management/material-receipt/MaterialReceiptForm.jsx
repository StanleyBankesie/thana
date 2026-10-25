/**
 * @fileoverview MaterialReceiptForm component.
 * Provides functionality for MaterialReceiptForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, Save, PackageCheck, Plus, Trash2 } from "lucide-react";
import { api } from "api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

function normalizeDate(v) {
  if (!v) return new Date().toISOString().split("T")[0];
  const s = String(v);
  return s.includes("T") ? s.split("T")[0] : s;
}

/**
 * MaterialReceiptForm component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaterialReceiptForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new" || !id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pendingIssues, setPendingIssues] = useState([]);

  const [formData, setFormData] = useState({
    receiptDate: new Date().toISOString().split("T")[0],
    issueId: "",
    warehouseId: "",
    departmentId: "",
    remarks: "",
  });

  const [items, setItems] = useState([
    { id: 1, item_id: "", itemName: "", uom: "PCS", transferQty: 0, receiptQty: 0, batchNo: "", expiryDate: "", mfgDate: "" }
  ]);

  useEffect(() => {
    let mounted = true;
    api.get("/inventory/warehouses").then(res => {
      if (!mounted) return;
      setWarehouses(Array.isArray(res.data?.items) ? res.data.items : []);
    }).catch(() => {});
    api.get("/admin/departments").then(res => {
      if (!mounted) return;
      const depts = Array.isArray(res.data?.items) ? res.data.items : [];
      setDepartments(depts);
      const projectDept = depts.find(d => (d.name || "").toLowerCase().includes("project"));
      if (projectDept && isNew) {
        setFormData(prev => ({ ...prev, departmentId: String(projectDept.id) }));
        api.get("/projects/issue-to-requirement/pm", { params: { department_id: projectDept.id } }).then(r => {
          if (!mounted) return;
          setPendingIssues(Array.isArray(r.data?.items) ? r.data.items : []);
        }).catch(() => {});
      } else if (isNew) {
        api.get("/projects/issue-to-requirement/pm").then(r => {
          if (!mounted) return;
          setPendingIssues(Array.isArray(r.data?.items) ? r.data.items : []);
        }).catch(() => {});
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    setLoading(true);
    setError("");

    api.get(`/projects/material-receipts/${id}`).then(res => {
      if (!mounted) return;
      const d = res.data?.item;
      const dets = res.data?.details || [];
      if (!d) return;
      setFormData({
        receiptDate: normalizeDate(d.receipt_date),
        issueId: d.issue_id ? String(d.issue_id) : "",
        warehouseId: d.warehouse_id ? String(d.warehouse_id) : "",
        departmentId: d.department_id ? String(d.department_id) : "",
        remarks: d.remarks || "",
      });
      setItems(dets.length ? dets.map(dd => ({
        id: dd.id,
        item_id: dd.item_id ? String(dd.item_id) : "",
        itemName: dd.item_name || "",
        uom: dd.uom || "PCS",
        transferQty: dd.transfer_qty || 0,
        receiptQty: dd.receipt_qty || 0,
        batchNo: dd.batch_no || "",
        expiryDate: dd.expiry_date ? dd.expiry_date.split("T")[0] : "",
        mfgDate: dd.mfg_date ? dd.mfg_date.split("T")[0] : "",
      })) : [{
        id: 1, item_id: "", itemName: "", uom: "PCS",
        transferQty: 0, receiptQty: 0, batchNo: "", expiryDate: "", mfgDate: "",
      }]);
    }).catch(e => {
      if (!mounted) return;
      setError(e?.response?.data?.message || "Failed to load receipt");
    }).finally(() => {
      if (!mounted) return;
      setLoading(false);
    });

    return () => { mounted = false; };
  }, [id, isNew]);

  const loadIssueDetails = async (issueId) => {
    if (!issueId) {
      setItems([{ id: 1, item_id: "", itemName: "", uom: "PCS", transferQty: 0, receiptQty: 0, batchNo: "", expiryDate: "", mfgDate: "" }]);
      return;
    }
    try {
      const res = await api.get(`/projects/issue-to-requirement/pm/${issueId}`);
      const src = res.data?.item;
      if (src) {
        setFormData(prev => ({
          ...prev,
          issueId: issueId,
          warehouseId: src.warehouse_id ? String(src.warehouse_id) : prev.warehouseId,
          departmentId: src.department_id ? String(src.department_id) : prev.departmentId,
        }));
      }
      const dets = res.data?.details || [];
      if (dets.length) {
        setItems(dets.map(dd => ({
          id: dd.id || Date.now() + Math.random(),
          item_id: dd.item_id ? String(dd.item_id) : "",
          itemName: dd.item_name || "",
          uom: dd.uom || "PCS",
          transferQty: Number(dd.qty_issued || 0),
          receiptQty: Number(dd.qty_issued || 0),
          batchNo: dd.batch_number || "",
          expiryDate: "",
          mfgDate: "",
        })));
      }
    } catch {
      setError("Failed to load issue details");
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        receipt_date: normalizeDate(formData.receiptDate),
        issue_id: formData.issueId || null,
        warehouse_id: formData.warehouseId || null,
        department_id: formData.departmentId || null,
        remarks: formData.remarks || null,
        status: "POSTED",
        details: items.filter(d => d.item_id).map(d => ({
          item_id: d.item_id ? Number(d.item_id) : null,
          item_name: d.itemName || null,
          uom: d.uom || "PCS",
          transfer_qty: Number(d.transferQty || 0),
          receipt_qty: Number(d.receiptQty || 0),
          batch_no: d.batchNo || null,
          expiry_date: d.expiryDate || null,
          mfg_date: d.mfgDate || null,
        })),
      };

      if (isNew) {
        await api.post("/projects/material-receipts", payload);
      } else {
        await api.put(`/projects/material-receipts/${id}`, payload);
      }

      toast.success(
        isNew ? "Receipt created successfully" : "Receipt updated successfully",
      );
      navigate("/project-management/material-receipts", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save receipt");
    } finally {
      setSaving(false);
    }
  };

  const addLine = () => {
    setItems(prev => [...prev, { id: Date.now(), item_id: "", itemName: "", uom: "PCS", transferQty: 0, receiptQty: 0, batchNo: "", expiryDate: "", mfgDate: "" }]);
  };

  const removeLine = (idx) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, field, val) => {
    setItems(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };

  return (
    <div className="space-y-6">
      {/* Canonical ERP Flex Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <PackageCheck size={26} className="text-brand-900 dark:text-brand-400" />
              {isNew ? "New Materials Receipt" : "Edit Materials Receipt"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Receive materials issued from Inventory
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save Receipt"}
          </button>
        </div>
      </div>

      <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {loading ? <div className="text-sm text-slate-500">Loading receipt details...</div> : null}
          {error ? <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{error}</div> : null}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Receipt Date *</label>
              <input type="date" className="input w-full text-sm" value={formData.receiptDate}
                onChange={e => setFormData({ ...formData, receiptDate: e.target.value })} required 
                disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="label">Department / Location</label>
              <select className="input w-full text-sm" value={formData.departmentId}
                onChange={e => {
                  const deptId = e.target.value;
                  setFormData({ ...formData, departmentId: deptId, issueId: "" });
                  if (deptId) {
                    api.get("/projects/issue-to-requirement/pm", { params: { department_id: deptId } }).then(res => {
                      setPendingIssues(Array.isArray(res.data?.items) ? res.data.items : []);
                    }).catch(() => {});
                  } else {
                    setPendingIssues([]);
                  }
                }}>
                <option value="">Select Department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            {isNew && (
              <div>
                <label className="label">Issued Document</label>
                <select className="input w-full text-sm" value={formData.issueId}
                  onChange={e => loadIssueDetails(e.target.value)}>
                  <option value="">Select issue...</option>
                  {pendingIssues.map(iss => (
                    <option key={iss.id} value={iss.id}>{iss.issue_no}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Temporal Storage/Warehouse</label>
              <select className="input w-full text-sm" value={formData.warehouseId}
                onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}>
                <option value="">Select Warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Remarks</label>
            <textarea className="input w-full text-sm" rows="3" value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Enter any additional notes..."></textarea>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Items Received</h3>
              <button
                type="button"
                onClick={addLine}
                className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="table w-full text-sm">
                <thead className="bg-white dark:bg-slate-900 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="min-w-[180px]">Item Name</th>
                    <th className="w-20">UOM</th>
                    <th className="w-24 text-right">Transfer Qty</th>
                    <th className="w-24 text-right">Receipt Qty</th>
                    <th className="w-28">Batch No</th>
                    <th className="w-28">Expiry Date</th>
                    <th className="w-28">Mfg Date</th>
                    <th className="w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                      <td>
                        <input type="text" className="input w-full text-sm bg-white dark:bg-slate-900" value={item.itemName}
                          readOnly placeholder="Auto-populated" />
                      </td>
                      <td className="font-medium text-slate-600 dark:text-slate-300">{item.uom}</td>
                      <td>
                        <input type="number" className="input w-full text-sm text-right bg-white dark:bg-slate-900 font-mono" value={item.transferQty} readOnly />
                      </td>
                      <td>
                        <input type="number" className="input w-full text-sm text-right font-mono" value={item.receiptQty}
                          onChange={e => updateLine(idx, "receiptQty", Number(e.target.value))} />
                      </td>
                      <td>
                        <input type="text" className="input w-full text-sm" value={item.batchNo}
                          onChange={e => updateLine(idx, "batchNo", e.target.value)} />
                      </td>
                      <td>
                        <input type="date" className="input w-full text-sm" value={item.expiryDate}
                          onChange={e => updateLine(idx, "expiryDate", e.target.value)} 
                          disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                        />
                      </td>
                      <td>
                        <input type="date" className="input w-full text-sm" value={item.mfgDate}
                          onChange={e => updateLine(idx, "mfgDate", e.target.value)} 
                          disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                        />
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="btn btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
              disabled={saving}
            >
              <Save size={16} /> {saving ? "Saving..." : "Save Receipt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
