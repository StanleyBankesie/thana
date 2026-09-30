/**
 * @fileoverview MaintenanceContractForm component.
 * Provides functionality for MaintenanceContractForm.
 */

import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Upload, FileText, X } from "lucide-react";
import { usePermission } from "@/auth/PermissionContext.jsx";

const STATUSES = ["ACTIVE", "PENDING", "EXPIRED", "CANCELLED"];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceContractForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    contract_no: "",
    supplier_id: "",
    supplier_name: "",
    start_date: "",
    end_date: "",
    contract_value: 0,
    scope: "",
    payment_terms: "30 days",
    status: "ACTIVE",
    notes: "",
    contract_file_url: "",
    contract_file_name: "",
  });
  const [assets, setAssets] = useState([{ asset_id: "", asset_name: "" }]);
  const [suppliers, setSuppliers] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let m = true;
    api
      .get("/maintenance/setup/catalog")
      .then((r) => {
        const providers = r.data?.catalogs?.serviceProviders || [];
        if (m) setSuppliers(providers.map((p) => ({ id: p.id, supplier_name: p.item_name })));
      })
      .catch(() => {});
    api
      .get("/maintenance/equipment")
      .then((r) => {
        if (m) setEquipment(Array.isArray(r.data?.items) ? r.data.items : []);
      })
      .catch(() => {});
    if (isEdit) {
      api
        .get(`/maintenance/contracts/${id}`)
        .then((r) => {
          const item = r.data?.item || {};
          if (m) {
            setForm((p) => ({
              ...p,
              ...item,
              start_date: (item.start_date || "").slice(0, 10),
              end_date: (item.end_date || "").slice(0, 10),
            }));
            if (Array.isArray(r.data?.assets) && r.data.assets.length)
              setAssets(r.data.assets);
          }
        })
        .catch(() => toast.error("Failed to load contract"));
    }
    return () => {
      m = false;
    };
  }, [id]);

  const addAsset = () =>
    setAssets((p) => [...p, { asset_id: "", asset_name: "" }]);
  const removeAsset = (i) => setAssets((p) => p.filter((_, idx) => idx !== i));
  const updateAsset = (i, eid) => {
    const eq = equipment.find((e) => String(e.id) === String(eid));
    setAssets((p) =>
      p.map((a, idx) =>
        idx === i ? { asset_id: eid, asset_name: eq?.equipment_name || "" } : a,
      ),
    );
  };

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/upload", fd);
      const data = res.data;
      update("contract_file_url", data.url || data.path);
      update("contract_file_name", data.filename || file.name);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeFile() {
    update("contract_file_url", "");
    update("contract_file_name", "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.supplier_id) {
      toast.error("Please select a service contractor");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, assets };
      if (isEdit) {
        await api.put(`/maintenance/contracts/${id}`, payload);
        toast.success("Contract updated");
      } else {
        const r = await api.post("/maintenance/contracts", payload);
        toast.success(`Contract ${r.data?.contract_no} created`);
      }
      navigate("/maintenance/contracts", { state: { refresh: true } });
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
            {isEdit ? "Edit" : "New"} Maintenance Contract
          </h1>
          <p className="text-sm mt-1">
            Manage external maintenance service contracts
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold flex items-center justify-between">
            <span>Contract Details</span>
            {/* <span className="text-xs font-normal text-white/80">
              {isEdit ? `Ref: ${form.contract_no}` : "New Contract"}
            </span> */}
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Service Contractor *</label>
              <select
                className="input w-56"
                value={form.supplier_id}
                onChange={(e) => {
                  const s = suppliers.find(
                    (x) => String(x.id) === e.target.value,
                  );
                  update("supplier_id", e.target.value);
                  update("supplier_name", s?.supplier_name || s?.name || "");
                }}
                required
              >
                <option value="">-- Select Service Contractor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplier_name || s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input
                className="input w-56"
                type="date"
                value={form.start_date}
                onChange={(e) => update("start_date", e.target.value)}
              
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                className="input w-56"
                type="date"
                value={form.end_date}
                onChange={(e) => update("end_date", e.target.value)}
              
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="label">Contract Value</label>
              <input
                className="input w-56 text-right"
                type="number"
                step="0.01"
                value={form.contract_value}
                onChange={(e) => update("contract_value", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Payment Terms</label>
              <input
                className="input w-56"
                value={form.payment_terms}
                onChange={(e) => update("payment_terms", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input w-56"
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Scope of Contract</label>
                <textarea
                  className="input w-full"
                  rows={3}
                  value={form.scope}
                  onChange={(e) => update("scope", e.target.value)}
                  placeholder="Services covered, response times, exclusions..."
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input w-full"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="label">Contract Document</label>
              <div className="space-y-2">
                {form.contract_file_url ? (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border">
                    <FileText size={16} className="text-brand shrink-0" />
                    <a
                      href={form.contract_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand hover:underline truncate flex-1"
                    >
                      {form.contract_file_name || "View Document"}
                    </a>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-1 hover:bg-slate-200 rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary btn-sm flex items-center gap-1"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={14} />{" "}
                  {uploading ? "Uploading..." : "Upload Contract"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="label">Assets / Equipment Covered</label>
              <div className="space-y-2">
                {assets.map((a, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      className="input flex-1"
                      value={a.asset_id}
                      onChange={(e) => updateAsset(i, e.target.value)}
                    >
                      <option value="">-- Select Equipment --</option>
                      {equipment.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.equipment_code} – {eq.equipment_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      onClick={() => removeAsset(i)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={addAsset}
                >
                  + Add Asset
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Contract"}
          </button>
        </div>
      </form>
    </div>
  );
}
