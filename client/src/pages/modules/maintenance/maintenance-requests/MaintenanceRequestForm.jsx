/**
 * @fileoverview MaintenanceRequestForm component.
 * Provides functionality for MaintenanceRequestForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

const DEFAULT_MAINT_TYPES = [
  "Corrective",
  "Preventive",
  "Predictive",
  "Emergency",
  "Routine",
];
const DEFAULT_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];

const today = () => new Date().toISOString().slice(0, 10);

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceRequestForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const location = useLocation();
  const readOnly = new URLSearchParams(location.search).get("mode") === "view";
  const [form, setForm] = useState({
    request_no: "",
    request_date: today(),
    breakdown_date: "",
    location: "",
    maintenance_section_id: null,
    maintenance_section_name: "",
    location_item_id: null,
    requester_name: "",
    department: "",
    asset_id: null,
    asset_name: "",
    asset_key: "",
    maintenance_type: "",
    priority: "NORMAL",
    description: "",
    status: "DRAFT",
    notes: "",
  });
  const [departments, setDepartments] = useState([]);
  const [setupCatalogs, setSetupCatalogs] = useState({
    maintenanceTypes: [],
    priorities: [],
    sections: [],
    locations: [],
  });
  const [assets, setAssets] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const assetOptions = useMemo(() => {
    const assetItems = assets.map((item) => ({
      key: `asset:${item.id}`,
      id: item.id,
      name: item.asset_name || "",
      code: item.asset_no || "",
      location: item.location || "",
      source: "Asset",
    }));
    const equipmentItems = equipment.map((item) => ({
      key: `equipment:${item.id}`,
      id: item.id,
      name: item.equipment_name || "",
      code: item.equipment_code || "",
      location: item.location || "",
      source: "Equipment",
    }));
    return [...assetItems, ...equipmentItems].filter((item) => item.name);
  }, [assets, equipment]);

  const maintenanceTypeOptions = useMemo(() => {
    const items = Array.isArray(setupCatalogs.maintenanceTypes)
      ? setupCatalogs.maintenanceTypes
          .filter((item) => item.is_active)
          .map((item) => item.item_name)
      : [];
    return items.length ? items : DEFAULT_MAINT_TYPES;
  }, [setupCatalogs.maintenanceTypes]);

  const priorityOptions = useMemo(() => {
    const items = Array.isArray(setupCatalogs.priorities)
      ? setupCatalogs.priorities
          .filter((item) => item.is_active)
          .map((item) => item.item_name)
      : [];
    return items.length ? items : DEFAULT_PRIORITIES;
  }, [setupCatalogs.priorities]);

  const sectionOptions = useMemo(
    () =>
      Array.isArray(setupCatalogs.sections)
        ? setupCatalogs.sections.filter((item) => item.is_active)
        : [],
    [setupCatalogs.sections],
  );

  const locationOptions = useMemo(
    () =>
      Array.isArray(setupCatalogs.locations)
        ? setupCatalogs.locations.filter((item) => item.is_active)
        : [],
    [setupCatalogs.locations],
  );

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [deptRes, equipmentRes, assetRes, setupRes, meRes, requestRes] =
          await Promise.all([
            api
              .get("/admin/departments")
              .catch(() => ({ data: { items: [] } })),
            api
              .get("/maintenance/equipment")
              .catch(() => ({ data: { items: [] } })),
            api
              .get("/maintenance/assets")
              .catch(() => ({ data: { items: [] } })),
            api
              .get("/maintenance/setup/catalog")
              .catch(() => ({ data: { catalogs: {} } })),
            api
              .get("/admin/me")
              .catch(() => ({ data: { data: { user: {} } } })),
            isEdit
              ? api.get(`/maintenance/maintenance-requests/${id}`)
              : api
                  .get("/maintenance/maintenance-requests/next-no")
                  .catch(() => ({ data: {} })),
          ]);

        if (!mounted) return;

        const currentUser = meRes?.data?.data?.user || meRes?.data?.user || {};
        const currentName = String(
          currentUser.full_name ||
            currentUser.name ||
            currentUser.username ||
            "",
        ).trim();

        setDepartments(
          Array.isArray(deptRes.data?.items) ? deptRes.data.items : [],
        );
        setEquipment(
          Array.isArray(equipmentRes.data?.items)
            ? equipmentRes.data.items
            : [],
        );
        setAssets(
          Array.isArray(assetRes.data?.items) ? assetRes.data.items : [],
        );
        setSetupCatalogs(
          setupRes.data?.catalogs || {
            maintenanceTypes: [],
            priorities: [],
            sections: [],
            locations: [],
          },
        );

        if (isEdit) {
          const item = requestRes.data?.item || {};
          setForm((prev) => ({
            ...prev,
            ...item,
            request_date: String(item.request_date || "").slice(0, 10),
            breakdown_date: String(item.breakdown_date || "").slice(0, 10),
            requester_name: item.requester_name || currentName,
            asset_key: "",
          }));
        } else {
          setForm((prev) => ({
            ...prev,
            request_no: String(requestRes.data?.request_no || "").trim(),
            requester_name: currentName,
          }));
        }
      } catch {
        toast.error(
          isEdit ? "Failed to load request" : "Failed to load form data",
        );
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id, isEdit]);

  useEffect(() => {
    if (!assetOptions.length) return;
    setForm((prev) => {
      const currentOption = assetOptions.find(
        (item) => item.key === prev.asset_key,
      );
      if (currentOption) return prev;

      const matchedOption =
        assetOptions.find(
          (item) =>
            Number(prev.asset_id) > 0 &&
            Number(item.id) === Number(prev.asset_id) &&
            item.name === prev.asset_name,
        ) ||
        assetOptions.find((item) => item.name === prev.asset_name) ||
        null;

      if (!matchedOption) return prev;

      return {
        ...prev,
        asset_key: matchedOption.key,
        location: prev.location || matchedOption.location || "",
      };
    });
  }, [assetOptions]);

  useEffect(() => {
    if (!sectionOptions.length && !locationOptions.length) return;
    setForm((prev) => {
      let next = prev;

      if (!prev.maintenance_section_id && prev.maintenance_section_name) {
        const matchedSection = sectionOptions.find(
          (item) => item.item_name === prev.maintenance_section_name,
        );
        if (matchedSection) {
          next = {
            ...next,
            maintenance_section_id: matchedSection.id,
          };
        }
      }

      if (!prev.location_item_id && prev.location) {
        const matchedLocation = locationOptions.find(
          (item) => item.item_name === prev.location,
        );
        if (matchedLocation) {
          next = {
            ...next,
            location_item_id: matchedLocation.id,
          };
        }
      }

      return next;
    });
  }, [sectionOptions, locationOptions]);

  function handleAssetChange(value) {
    const selected = assetOptions.find((item) => item.key === value) || null;
    setForm((prev) => ({
      ...prev,
      asset_key: value,
      asset_id: selected ? selected.id : null,
      asset_name: selected ? selected.name : "",
      location: prev.location || selected?.location || "",
    }));
  }

  function handleSectionChange(value) {
    const selected =
      sectionOptions.find((item) => Number(item.id) === Number(value)) || null;
    setForm((prev) => ({
      ...prev,
      maintenance_section_id: selected ? selected.id : null,
      maintenance_section_name: selected ? selected.item_name : "",
    }));
  }

  function handleLocationChange(value) {
    const selected =
      locationOptions.find((item) => Number(item.id) === Number(value)) || null;
    setForm((prev) => ({
      ...prev,
      location_item_id: selected ? selected.id : null,
      location: selected ? selected.item_name : "",
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.maintenance_type || !form.description) {
      toast.error("Please fill all required fields");
      return;
    }
    setSaving(true);
    try {
      const { asset_key, ...payload } = form;
      if (isEdit) {
        await api.put(`/maintenance/maintenance-requests/${id}`, payload);
        toast.success("Request updated");
      } else {
        const r = await api.post("/maintenance/maintenance-requests", payload);
        toast.success(`Request ${r.data?.request_no} created`);
      }
      navigate("/maintenance/maintenance-requests", {
        state: { refresh: true },
      });
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
            {isEdit ? "Edit" : "New"} Maintenance Request
          </h1>
          <p className="text-sm mt-1">
            Record and track an internal maintenance request
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">
            Request Details
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Requisition No</label>
              <input
                className="input w-56"
                value={form.request_no}
                readOnly
                placeholder="Auto-generated"
              />
            </div>
            <div>
              <label className="label">Request Date *</label>
              <input
                className="input w-56"
                type="date"
                value={form.request_date}
                onChange={(e) => update("request_date", e.target.value)}
                required
              
                disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
              />
            </div>
            <div>
              <label className="label">Breakdown Date</label>
              <input
                className="input w-56"
                type="date"
                value={form.breakdown_date || ""}
                onChange={(e) => update("breakdown_date", e.target.value)}
              
                disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
              />
            </div>
            <div>
              <label className="label">Department</label>
              <select
                className="input w-56"
                value={form.department}
                onChange={(e) => update("department", e.target.value)}
              >
                <option value="">-- Select --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Maintenance Section</label>
              <select
                className="input w-56"
                value={form.maintenance_section_id || ""}
                onChange={(e) => handleSectionChange(e.target.value)}
              >
                <option value="">-- Select Section --</option>
                {sectionOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <select
                className="input w-56"
                value={form.location_item_id || ""}
                onChange={(e) => handleLocationChange(e.target.value)}
              >
                <option value="">-- Select Location --</option>
                {locationOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Asset / Equipment</label>
              <select
                className="input w-56"
                value={form.asset_key}
                onChange={(e) => handleAssetChange(e.target.value)}
              >
                <option value="">-- Select Asset / Equipment --</option>
                {assetOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.source}: {item.code ? `${item.code} - ` : ""}
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Maintenance Type *</label>
              <select
                className="input"
                value={form.maintenance_type}
                onChange={(e) => update("maintenance_type", e.target.value)}
                required
              >
                <option value="">-- Select Type --</option>
                {maintenanceTypeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select
                className="input w-56"
                value={form.priority}
                onChange={(e) => update("priority", e.target.value)}
              >
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex gap-3">
              <div className="flex-1">
                <label className="label">Description *</label>
                <textarea
                  className="input w-96"
                  rows={6}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Describe the issue or maintenance needed"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="label">Notes</label>
                <textarea
                  className="input w-96"
                  rows={6}
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Additional notes"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Request"}
          </button>
        </div>
      </form>
    </div>
  );
}
