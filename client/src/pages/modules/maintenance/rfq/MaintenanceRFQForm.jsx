/**
 * @fileoverview MaintenanceRFQForm component.
 * Provides functionality for MaintenanceRFQForm.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

const STATUSES = ["DRAFT", "SENT", "RESPONDED", "CLOSED"];

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceRFQForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isEdit = !!id;

  const [form, setForm] = useState({
    rfq_no: "",
    rfq_date: new Date().toISOString().slice(0, 10),
    request_id: params.get("request_id") || "",
    scope_of_work: "",
    response_deadline: "",
    status: "DRAFT",
    notes: "",
  });
  const [suppliers, setSuppliers] = useState([
    { supplier_id: "", supplier_name: "" },
  ]);
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let mounted = true;
    api
      .get("/purchase/suppliers")
      .then((r) => {
        if (mounted)
          setAllSuppliers(Array.isArray(r.data?.items) ? r.data.items : []);
      })
      .catch(() => {});
    api
      .get("/maintenance/maintenance-requests")
      .then((r) => {
        if (mounted)
          setRequests(Array.isArray(r.data?.items) ? r.data.items : []);
      })
      .catch(() => {});
    if (isEdit) {
      api
        .get(`/maintenance/rfqs/${id}`)
        .then((r) => {
          const item = r.data?.item || {};
          if (mounted) {
            setForm((p) => ({
              ...p,
              ...item,
              rfq_date: (item.rfq_date || "").slice(0, 10),
              response_deadline: (item.response_deadline || "").slice(0, 10),
            }));
            if (Array.isArray(r.data?.suppliers) && r.data.suppliers.length)
              setSuppliers(r.data.suppliers);
          }
        })
        .catch(() => toast.error("Failed to load RFQ"));
    }
    return () => {
      mounted = false;
    };
  }, [id]);

  const addSupplier = () =>
    setSuppliers((p) => [...p, { supplier_id: "", supplier_name: "" }]);
  const removeSupplier = (i) =>
    setSuppliers((p) => p.filter((_, idx) => idx !== i));
  const updateSupplier = (i, sid) => {
    const found = allSuppliers.find((s) => String(s.id) === String(sid));
    setSuppliers((p) =>
      p.map((x, idx) =>
        idx === i
          ? {
              supplier_id: sid,
              supplier_name: found?.supplier_name || found?.name || "",
            }
          : x,
      ),
    );
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.scope_of_work) {
      toast.error("Scope of work is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, suppliers };
      if (isEdit) {
        await api.put(`/maintenance/rfqs/${id}`, payload);
        toast.success("RFQ updated");
      } else {
        const r = await api.post("/maintenance/rfqs", payload);
        toast.success(`RFQ ${r.data?.rfq_no} created`);
      }
      navigate("/maintenance/rfq", { state: { refresh: true } });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="btn-secondary">
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit" : "New"} Request for Quotation
          </h1>
          <p className="text-sm mt-1">
            Send to external service providers for maintenance quotations
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">
            RFQ Details
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">RFQ Date</label>
              <input
                className="input w-56"
                type="date"
                value={form.rfq_date}
                onChange={(e) => update("rfq_date", e.target.value)}
              
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="label">Linked Request</label>
              <select
                className="input w-56"
                value={form.request_id}
                onChange={(e) => update("request_id", e.target.value)}
              >
                <option value="">-- None --</option>
                {requests.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.request_no} – {r.requester_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Response Deadline</label>
              <input
                className="input w-56"
                type="date"
                value={form.response_deadline}
                onChange={(e) => update("response_deadline", e.target.value)}
              
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
          </div>
          <div className="card-body mt-2 space-y-4">
            <div>
              <label className="label">Scope of Work *</label>
              <textarea
                className="input w-full"
                rows={5}
                value={form.scope_of_work}
                onChange={(e) => update("scope_of_work", e.target.value)}
                placeholder="Describe maintenance work required..."
                required
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                className="input w-full"
                rows={2}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </div>
            {(() => {
              const selectedRequest = requests.find(
                (r) => String(r.id) === String(form.request_id),
              );
              if (!selectedRequest) return null;
              return (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3 border-b pb-2">
                    Maintenance Request Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 font-medium">
                        Asset/Equipment:
                      </span>{" "}
                      {selectedRequest.asset_name || "N/A"}
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">
                        Maintenance Type:
                      </span>{" "}
                      {selectedRequest.maintenance_type || "N/A"}
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">
                        Priority:
                      </span>{" "}
                      {selectedRequest.priority || "N/A"}
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">
                        Location:
                      </span>{" "}
                      {selectedRequest.location || "N/A"}
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-slate-500 font-medium">
                        Description:
                      </span>{" "}
                      {selectedRequest.description || "N/A"}
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-slate-500 font-medium">Notes:</span>{" "}
                      {selectedRequest.notes || "N/A"}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="card-header bg-brand text-white font-semibold flex justify-between items-center px-4 py-3">
            <span>Invited Service Contractor</span>
            <button
              type="button"
              onClick={addSupplier}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-sm"
            >
              + Add Service Contractor
            </button>
          </div>
          <div className="p-0">
            {suppliers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border-b border-x border-slate-200 rounded-b-lg bg-slate-50/50">
                No Service Contractor invited yet. Click "Add Contractor" to
                start.
              </div>
            ) : (
              <div className="overflow-x-auto border-x border-b border-slate-200 rounded-b-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Contractor Name</th>
                      <th className="px-4 py-3 w-24 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {suppliers.map((s, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-2">
                          <select
                            className="input w-full max-w-md bg-white text-sm"
                            value={s.supplier_id}
                            onChange={(e) => updateSupplier(i, e.target.value)}
                          >
                            <option value="">
                              -- Select Service Contractor --
                            </option>
                            {allSuppliers.map((sup) => (
                              <option key={sup.id} value={sup.id}>
                                {sup.supplier_name || sup.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            type="button"
                            className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors flex items-center justify-center mx-auto"
                            onClick={() => removeSupplier(i)}
                            title="Remove Supplier"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save RFQ"}
          </button>
        </div>
      </form>
    </div>
  );
}
