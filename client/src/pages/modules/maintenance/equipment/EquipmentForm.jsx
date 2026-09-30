/**
 * @fileoverview EquipmentForm component.
 * Provides functionality for EquipmentForm.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

const STATUSES = ["ACTIVE", "INACTIVE", "UNDER_REPAIR", "DECOMMISSIONED"];

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function EquipmentForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form, setForm] = useState({
    equipment_code: "",
    equipment_name: "",
    category: "",
    location: "",
    brand: "",
    group_name: "",
    classification: "",
    manufacturer: "",
    model: "",
    serial_number: "",
    purchase_date: "",
    warranty_expiry: "",
    status: "ACTIVE",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState({
    locations: [],
    brands: [],
    classifications: [],
    categories: [],
    groups: [],
    models: [],
    manufacturers: [],
  });
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    api
      .get("/maintenance/setup/catalog")
      .then((r) =>
        setCatalog(
          r.data?.catalogs || {
            locations: [],
            brands: [],
            classifications: [],
            categories: [],
            groups: [],
            models: [],
            manufacturers: [],
          },
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let m = true;
    if (isEdit) {
      api
        .get(`/maintenance/equipment/${id}`)
        .then((r) => {
          const item = r.data?.item || {};
          if (m)
            setForm((p) => ({
              ...p,
              ...item,
              purchase_date: (item.purchase_date || "").slice(0, 10),
              warranty_expiry: (item.warranty_expiry || "").slice(0, 10),
            }));
        })
        .catch(() => toast.error("Failed to load equipment"));
    }
    return () => {
      m = false;
    };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.equipment_name) {
      toast.error("Equipment name is required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/maintenance/equipment/${id}`, form);
        toast.success("Equipment updated");
      } else {
        await api.post("/maintenance/equipment", form);
        toast.success("Equipment created");
      }
      navigate("/maintenance/equipment", { state: { refresh: true } });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const selectedCls = catalog.classifications.find(
    (c) => c.item_name === form.classification,
  );
  const filteredCategories = selectedCls
    ? catalog.categories.filter((c) => c.parent_id === selectedCls.id)
    : catalog.categories;

  const selectedCat = catalog.categories.find(
    (c) => c.item_name === form.category,
  );
  const filteredGroups = selectedCat
    ? catalog.groups.filter((g) => g.parent_id === selectedCat.id)
    : catalog.groups;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="btn-secondary">
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit" : "New"} Equipment
          </h1>
          <p className="text-sm mt-1">
            Register equipment and assets for maintenance tracking
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">
            Equipment Details
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Asset Code/Tag</label>
              <input
                className="input"
                value={form.equipment_code}
                onChange={(e) => update("equipment_code", e.target.value)}
                placeholder="e.g. SN00...."
              />
            </div>
            <div>
              <label className="label">Asset Name *</label>
              <input
                className="input"
                value={form.equipment_name}
                onChange={(e) => update("equipment_name", e.target.value)}
                placeholder="Equipment name"
                required
              />
            </div>
            <div>
              <label className="label">Asset Classification</label>
              <select
                className="input w-52"
                value={form.classification}
                onChange={(e) => {
                  update("classification", e.target.value);
                  update("category", "");
                  update("group_name", "");
                }}
              >
                <option value="">-- Select Classification --</option>
                {catalog.classifications.map((c) => (
                  <option key={c.id} value={c.item_name}>
                    {c.item_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Asset Category</label>
              <select
                className="input w-52"
                value={form.category}
                onChange={(e) => {
                  update("category", e.target.value);
                  update("group_name", "");
                }}
              >
                <option value="">-- Select Category --</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.item_name}>
                    {c.item_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Asset Group</label>
              <select
                className="input w-52"
                value={form.group_name}
                onChange={(e) => update("group_name", e.target.value)}
              >
                <option value="">-- Select Group --</option>
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.item_name}>
                    {g.item_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Brand</label>
              <select
                className="input w-52"
                value={form.brand}
                onChange={(e) => update("brand", e.target.value)}
              >
                <option value="">-- Select Brand --</option>
                {catalog.brands.map((b) => (
                  <option key={b.id} value={b.item_name}>
                    {b.item_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Model</label>
              <select
                className="input"
                value={form.model}
                onChange={(e) => update("model", e.target.value)}
              >
                <option value="">-- Select Model --</option>
                {(catalog.models || []).map((m) => (
                  <option key={m.id} value={m.item_name}>
                    {m.item_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Manufacturer</label>
              <select
                className="input"
                value={form.manufacturer}
                onChange={(e) => update("manufacturer", e.target.value)}
              >
                <option value="">-- Select Manufacturer --</option>
                {(catalog.manufacturers || []).map((m) => (
                  <option key={m.id} value={m.item_name}>
                    {m.item_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Serial Number</label>
              <input
                className="input"
                value={form.serial_number}
                onChange={(e) => update("serial_number", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Equipment Location</label>
              <select
                className="input w-52"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
              >
                <option value="">-- Select Location --</option>
                {catalog.locations.map((l) => (
                  <option key={l.id} value={l.item_name}>
                    {l.item_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
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
            <div>
              <label className="label">Purchase Date</label>
              <input
                className="input w-52"
                type="date"
                value={form.purchase_date}
                onChange={(e) => update("purchase_date", e.target.value)}
              
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="label">Warranty Expiry</label>
              <input
                className="input w-52"
                type="date"
                value={form.warranty_expiry}
                onChange={(e) => update("warranty_expiry", e.target.value)}
              
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Equipment"}
          </button>
        </div>
      </form>
    </div>
  );
}
