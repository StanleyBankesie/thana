import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

function normalizeDate(v) {
  if (!v) return new Date().toISOString().split("T")[0];
  const s = String(v);
  return s.includes("T") ? s.split("T")[0] : s;
}

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
  const [plans, setPlans] = useState([]);
  const [pendingIssues, setPendingIssues] = useState([]);

  const [formData, setFormData] = useState({
    receiptDate: new Date().toISOString().split("T")[0],
    issueId: "",
    planId: "",
    warehouseId: "",
    departmentId: "",
    remarks: "",
  });

  const [items, setItems] = useState([
    { id: 1, item_id: "", itemName: "", uom: "PCS", transferQty: 0, receiptQty: 0, batchNo: "", expiryDate: "", mfgDate: "" }
  ]);

  const loadPendingIssues = async (deptId, deptsList = departments) => {
    try {
      const selectedDept = deptsList.find(d => String(d.id) === String(deptId));

      const [issuesRes, receiptsRes] = await Promise.all([
        api.get("/inventory/issue-to-requirement").catch(() => api.get("/projects/issue-to-requirement/pm")),
        api.get("/production/execution/material-receipt").catch(() => ({ data: { items: [] } })),
      ]);

      const rawIssues = Array.isArray(issuesRes.data?.items) ? issuesRes.data.items : (Array.isArray(issuesRes.data) ? issuesRes.data : []);
      const savedReceipts = Array.isArray(receiptsRes.data?.items) ? receiptsRes.data.items : (Array.isArray(receiptsRes.data) ? receiptsRes.data : []);

      const usedIssueIds = new Set(
        savedReceipts
          .map(r => r.issue_id)
          .filter(Boolean)
          .map(String)
      );

      const filtered = rawIssues.filter(iss => {
        const issIdStr = String(iss.id);

        if (usedIssueIds.has(issIdStr) && (!id || String(formData.issueId) !== issIdStr)) {
          return false;
        }

        const statusPosted = String(iss.status || "").toUpperCase() === "POSTED";

        const isProdDept = (iss.department_name || "").toLowerCase().includes("production") ||
          (selectedDept && (String(selectedDept.name || "").toLowerCase().includes("production") || String(selectedDept.code || "").toLowerCase().includes("production")));

        const matchesDept = deptId
          ? (String(iss.department_id) === String(deptId) || (isProdDept && String(iss.department_name || "").toLowerCase().includes("production")))
          : isProdDept;

        return statusPosted && matchesDept;
      });

      setPendingIssues(filtered);
    } catch {
      setPendingIssues([]);
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchInitialData = async () => {
      try {
        const [whRes, prodWhRes, deptsRes, cfgRes, plansRes] = await Promise.allSettled([
          api.get("/inventory/warehouses"),
          api.get("/production/setup/warehouses"),
          api.get("/admin/departments"),
          api.get("/production/setup/config"),
          api.get("/production/planning/daily")
        ]);

        if (!mounted) return;

        const invWh = whRes.status === "fulfilled" && Array.isArray(whRes.value?.data?.items) ? whRes.value.data.items : [];
        const prodWh = prodWhRes.status === "fulfilled" && Array.isArray(prodWhRes.value?.data?.items) ? prodWhRes.value.data.items : [];

        const combinedWh = [...prodWh];
        invWh.forEach(iw => {
          if (!combinedWh.some(w => String(w.id) === String(iw.id))) {
            combinedWh.push(iw);
          }
        });
        setWarehouses(combinedWh);

        if (plansRes.status === "fulfilled") {
          setPlans(Array.isArray(plansRes.value?.data?.items) ? plansRes.value.data.items : []);
        }

        let depts = [];
        if (deptsRes.status === "fulfilled") {
          depts = Array.isArray(deptsRes.value?.data?.items) ? deptsRes.value.data.items : [];
          setDepartments(depts);
        }

        const prodDept = depts.find(d => {
          const n = String(d.name || d.department_name || "").toLowerCase();
          const c = String(d.code || d.dept_code || "").toLowerCase();
          return n.includes("production") || c.includes("production") || c.includes("prod");
        });

        let defaultWhId = "";
        if (cfgRes.status === "fulfilled" && cfgRes.value?.data?.settings) {
          const s = cfgRes.value.data.settings;
          defaultWhId = String(s.default_warehouse_id || s.production_warehouse_id || s.default_source_warehouse_id || "");
        }
        if (!defaultWhId && combinedWh.length > 0) {
          defaultWhId = String(combinedWh[0].id);
        }

        if (isNew) {
          setFormData(prev => ({
            ...prev,
            departmentId: prodDept ? String(prodDept.id) : prev.departmentId,
            warehouseId: defaultWhId || prev.warehouseId
          }));
          await loadPendingIssues(prodDept ? String(prodDept.id) : "", depts);
        }
      } catch {}
    };

    fetchInitialData();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    setLoading(true);
    setError("");

    api.get(`/production/execution/material-receipt/${id}`).then(res => {
      if (!mounted) return;
      const d = res.data?.item || res.data;
      const dets = res.data?.details || res.data?.items || [];
      if (!d) return;
      setFormData({
        receiptDate: normalizeDate(d.receipt_date),
        issueId: d.issue_id ? String(d.issue_id) : "",
        planId: d.plan_id ? String(d.plan_id) : "",
        warehouseId: d.warehouse_id ? String(d.warehouse_id) : "",
        departmentId: d.department_id ? String(d.department_id) : "",
        remarks: d.remarks || "",
      });
      setItems(dets.length ? dets.map(dd => ({
        id: dd.id,
        item_id: dd.item_id ? String(dd.item_id) : "",
        itemName: dd.item_name || "",
        uom: dd.uom || "PCS",
        transferQty: dd.transfer_qty || dd.qty_received || 0,
        receiptQty: dd.receipt_qty || dd.qty_received || 0,
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
      const res = await api.get(`/inventory/issue-to-requirement/${issueId}`).catch(() => api.get(`/projects/issue-to-requirement/pm/${issueId}`));
      const src = res.data?.item || res.data;

      let extractedPlanId = "";
      if (src) {
        if (src.plan_id) {
          extractedPlanId = String(src.plan_id);
        } else if (src.requisition_id) {
          try {
            const reqRawId = String(src.requisition_id).replace(/^(prod_|maint_|pm_)/, "");
            const reqRes = await api.get(`/production/execution/material-requisition/${reqRawId}`).catch(() => null);
            const reqData = reqRes?.data?.item || reqRes?.data;
            if (reqData && reqData.plan_id) {
              extractedPlanId = String(reqData.plan_id);
            }
          } catch {}
        }

        setFormData(prev => ({
          ...prev,
          issueId: issueId,
          warehouseId: prev.warehouseId || (src.warehouse_id ? String(src.warehouse_id) : ""),
          departmentId: src.department_id ? String(src.department_id) : prev.departmentId,
          planId: extractedPlanId || prev.planId,
        }));
      }

      const dets = res.data?.details || res.data?.items || [];
      if (dets.length) {
        setItems(dets.map(dd => ({
          id: dd.id || Date.now() + Math.random(),
          item_id: dd.item_id ? String(dd.item_id) : "",
          itemName: dd.item_name || "",
          uom: dd.uom || "PCS",
          transferQty: Number(dd.qty_issued || dd.qty || 0),
          receiptQty: Number(dd.qty_issued || dd.qty || 0),
          batchNo: dd.batch_number || dd.batch_no || "",
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
        plan_id: formData.planId ? Number(formData.planId) : null,
        warehouse_id: formData.warehouseId || null,
        department_id: formData.departmentId || null,
        remarks: formData.remarks || null,
        status: "COMPLETED",
        items: items.filter(d => d.item_id).map(d => ({
          item_id: d.item_id ? Number(d.item_id) : null,
          qty_received: Number(d.receiptQty || 0),
          uom: d.uom || "PCS",
          batch_no: d.batchNo || null
        })),
      };

      if (isNew) {
        await api.post("/production/execution/material-receipt", payload);
      } else {
        await api.put(`/production/execution/material-receipt/${id}`, payload);
      }

      toast.success(
        isNew ? "Receipt created successfully" : "Receipt updated successfully",
      );
      navigate("/production/execution/material-receipt", { state: { refresh: true } });
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
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew ? "New Production Material Receipt" : "Edit Production Material Receipt"}
              </h1>
              <p className="text-sm mt-1">Receive materials issued from Inventory to Production</p>
            </div>
            <button onClick={() => window.history.back()} type="button" className="btn-success">Back</button>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Receipt Date *</label>
                <input type="date" className="input" value={formData.receiptDate}
                  onChange={e => setFormData({ ...formData, receiptDate: e.target.value })} required 
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div className="hidden">
                <label className="label">Department / Location</label>
                <select className="input" value={formData.departmentId}
                  onChange={e => {
                    const deptId = e.target.value;
                    setFormData({ ...formData, departmentId: deptId, issueId: "" });
                    loadPendingIssues(deptId, departments);
                  }}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name || d.department_name}</option>)}
                </select>
              </div>
              {isNew && (
                <div>
                  <label className="label">Issued Document *</label>
                  <select required className="input" value={formData.issueId}
                    onChange={e => loadIssueDetails(e.target.value)}>
                    <option value="">Select issue...</option>
                    {pendingIssues.map(iss => (
                      <option key={iss.id} value={iss.id}>{iss.issue_no}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Production Plan</label>
                <select className="input" value={formData.planId}
                  onChange={e => setFormData({ ...formData, planId: e.target.value })}>
                  <option value="">Select Production Plan (Optional)</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.plan_no || `PLAN-${p.id}`}{p.product_name ? ` (${p.product_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Production Warehouse *</label>
                <select required className="input" value={formData.warehouseId}
                  onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}>
                  <option value="">Select Warehouse</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name || w.warehouse_code || w.name || w.id}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Remarks</label>
              <textarea className="input w-full" rows="3" value={formData.remarks}
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Enter any additional notes..."></textarea>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Items</h3>
                <button type="button" onClick={addLine} className="btn-success text-sm">+ Add Item</button>
              </div>

              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="min-w-[180px]">Item Name</th>
                      <th className="w-20">UOM</th>
                      <th className="w-24 text-right">Transfer Qty</th>
                      <th className="w-24 text-right">Receipt Qty</th>
                      <th className="w-28">Batch No</th>
                      <th className="w-28">Expiry Date</th>
                      <th className="w-28">Mfg Date</th>
                      <th className="w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id}>
                        <td>
                          <input type="text" className="input w-full bg-slate-50" value={item.itemName}
                            readOnly placeholder="Auto-populated" />
                        </td>
                        <td>{item.uom}</td>
                        <td>
                          <input type="number" className="input w-full bg-slate-50" value={item.transferQty} readOnly />
                        </td>
                        <td>
                          <input type="number" className="input w-full" value={item.receiptQty}
                            onChange={e => updateLine(idx, "receiptQty", Number(e.target.value))} />
                        </td>
                        <td>
                          <input type="text" className="input w-full" value={item.batchNo}
                            onChange={e => updateLine(idx, "batchNo", e.target.value)} />
                        </td>
                        <td>
                          <input type="date" className="input w-full" value={item.expiryDate}
                            onChange={e => updateLine(idx, "expiryDate", e.target.value)} 
                            disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                          />
                        </td>
                        <td>
                          <input type="date" className="input w-full" value={item.mfgDate}
                            onChange={e => updateLine(idx, "mfgDate", e.target.value)} 
                            disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                          />
                        </td>
                        <td>
                          <button type="button" onClick={() => removeLine(idx)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => window.history.back()} type="button" className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">Cancel</button>
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
