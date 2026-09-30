/**
 * @fileoverview MaintenanceMaterialRequisitionForm component.
 * Provides functionality for MaintenanceMaterialRequisitionForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceMaterialRequisitionForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === "new" || !id || window.location.pathname.endsWith("/new");
  const isView = new URLSearchParams(window.location.search).get("view") === "1";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);

  const [form, setForm] = useState({
    requisition_no: "Auto-generated",
    requisition_date: new Date().toISOString().split("T")[0],
    warehouse_id: "",
    department_id: "",
    priority: "MEDIUM",
    requested_by: user?.username || "",
    remarks: "",
    status: "DRAFT"
  });

  const [details, setDetails] = useState([
    { id: 1, item_id: "", item_code: "", item_name: "", qty_requested: 0, qty_received: 0, uom: "PCS", batch_no: "" }
  ]);

  useEffect(() => {
    Promise.all([
      api.get("/inventory/warehouses").then(r => setWarehouses(r.data?.items || [])).catch(() => {}),
      api.get("/admin/departments").then(r => setDepartments(r.data?.items || [])).catch(() => {}),
      api.get("/inventory/items").then(r => setAvailableItems(r.data?.items || [])).catch(() => {}),
    ]);
    if (isNew) {
      api.get("/maintenance/material-requisitions/next-no")
        .then(r => { if (r.data?.nextNo) setForm(f => ({ ...f, requisition_no: r.data.nextNo })); })
        .catch(() => {});
    }
    if (!isNew && id) fetchReq();
  }, [id]);

  const fetchReq = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/maintenance/material-requisitions/${id}`);
      const d = res.data?.item;
      if (d) {
        setForm({
          requisition_no: d.requisition_no || "",
          requisition_date: d.requisition_date ? d.requisition_date.split("T")[0] : "",
          warehouse_id: d.warehouse_id ? String(d.warehouse_id) : "",
          department_id: d.department_id ? String(d.department_id) : "",
          priority: d.priority || "MEDIUM",
          requested_by: d.requested_by || "",
          remarks: d.remarks || "",
          status: d.status || "DRAFT"
        });
      }
      const dets = res.data?.details || [];
      if (dets.length) {
        setDetails(dets.map(dd => ({
          id: dd.id,
          item_id: dd.item_id ? String(dd.item_id) : "",
          item_code: dd.item_code || "",
          item_name: dd.item_name || "",
          qty_requested: dd.qty_requested || 0,
          qty_received: dd.qty_received || 0,
          uom: dd.uom || "PCS",
          batch_no: dd.batch_no || ""
        })));
      }
    } catch (e) { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  const addLine = () => {
    setDetails(prev => [...prev, { id: Date.now(), item_id: "", item_code: "", item_name: "", qty_requested: 0, qty_received: 0, uom: "PCS", batch_no: "" }]);
  };

  const removeLine = (idx) => {
    if (details.length === 1) return;
    setDetails(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, field, val) => {
    setDetails(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };

  const onItemSelect = (idx, itemId) => {
    const item = availableItems.find(i => String(i.id) === itemId);
    updateLine(idx, "item_id", itemId);
    if (item) {
      updateLine(idx, "item_code", item.item_code || "");
      updateLine(idx, "item_name", item.item_name || "");
      updateLine(idx, "uom", item.uom || "PCS");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, details: details.filter(d => d.item_id) };
      if (isNew) {
        await api.post("/maintenance/material-requisitions", payload);
        toast.success("Requisition created");
      } else {
        await api.put(`/maintenance/material-requisitions/${id}`, payload);
        toast.success("Requisition updated");
      }
      navigate("/maintenance/material-requisitions");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-300 uppercase italic">Loading...</div>;

  const readOnly = isView || (form.status !== "DRAFT");

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew ? "New Material Requisition" : `Requisition ${form.requisition_no}`}
              </h1>
              <p className="text-sm mt-1">
                {isNew ? "Request materials for maintenance" : `Status: ${form.status}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn-success">Back to List</button>
            </div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="label">Requisition Date *</label>
                <input type="date" className="input" value={form.requisition_date}
                  onChange={e => setForm({...form, requisition_date: e.target.value})} required disabled={readOnly} />
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} disabled={readOnly}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="label">Requested By *</label>
                <input type="text" className="input" value={form.requested_by} onChange={e => setForm({...form, requested_by: e.target.value})} required disabled={readOnly} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Source Warehouse</label>
                <select className="input" value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id: e.target.value})} disabled={readOnly}>
                  <option value="">Select Warehouse</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Destination Department</label>
                <select className="input" value={form.department_id} onChange={e => setForm({...form, department_id: e.target.value})} disabled={readOnly}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.dept_name || d.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Remarks</label>
              <textarea className="input w-full" rows="3" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} disabled={readOnly} placeholder="Enter any additional notes..."></textarea>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Items</h3>
                {!readOnly && (
                  <button type="button" onClick={addLine} className="btn-success text-sm">+ Add Item</button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="w-1/2 min-w-[200px]">Item</th>
                      <th className="w-24">Code</th>
                      <th className="w-20">UOM</th>
                      <th className="w-32">Qty Requested</th>
                      <th className="w-32">Qty Received</th>
                      <th className="w-32">Batch No</th>
                      {!readOnly && <th className="w-20">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d, idx) => (
                      <tr key={d.id}>
                        <td>
                          {readOnly ? (
                            <span className="text-sm">{d.item_name}</span>
                          ) : (
                            <select className="input w-full" value={d.item_id} onChange={e => onItemSelect(idx, e.target.value)}>
                              <option value="">Select item</option>
                              {availableItems.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="text-xs text-slate-500">{d.item_code}</td>
                        <td>
                          <select className="input" value={d.uom} onChange={e => updateLine(idx, "uom", e.target.value)} disabled={readOnly}>
                            <option value="PCS">PCS</option>
                            <option value="EA">EA</option>
                            <option value="KG">KG</option>
                            <option value="LTR">LTR</option>
                            <option value="MTR">MTR</option>
                          </select>
                        </td>
                        <td>
                          <input type="number" className="input" value={d.qty_requested} onChange={e => updateLine(idx, "qty_requested", Number(e.target.value))} disabled={readOnly} min="0" />
                        </td>
                        <td>{d.qty_received}</td>
                        <td>
                          <input type="text" className="input" value={d.batch_no} onChange={e => updateLine(idx, "batch_no", e.target.value)} disabled={readOnly} placeholder="Batch No" />
                        </td>
                        {!readOnly && (
                          <td>
                            <button type="button" onClick={() => removeLine(idx)} className="text-red-600 hover:text-red-800 text-sm font-medium">Remove</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {!readOnly && (
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button onClick={() => window.history.back()} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">Cancel</button>
                <button type="submit" className="btn-success" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
