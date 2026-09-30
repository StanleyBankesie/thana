/**
 * @fileoverview MaintenanceRosterForm — Modern ERP-standard, using app standard CSS classes.
 */

import React, { useState, useEffect } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import {
  Save,
  Cpu,
  ClipboardList,
  AlertCircle,
  ArrowRight,
  X,
} from "lucide-react";
import { usePermission } from "@/auth/PermissionContext.jsx";

/* Thin section label used as visual group separators inside the card body */
function SectionLabel({ icon: Icon, text }) {
  return (
    <div className="col-span-full flex items-center gap-2 mt-2 mb-1 border-b border-slate-100 dark:border-slate-700 pb-1">
      <Icon size={13} className="text-brand-500 flex-shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
        {text}
      </span>
    </div>
  );
}

export default function MaintenanceRosterForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const isView = searchParams.get("mode") === "view";

  const [form, setForm] = useState({
    roster_name: "",
    status: "POSTED",
    roster_date: "",
    schedule_id: "",
    asset_classification: "",
    asset_category: "",
    asset_group: "",
    primary_asset: "",
    remarks: "",
    period_start: "",
    period_end: "",
    selected_assets: [], // multi-select array
    frequency: "",
    maintenance_days: "",
    maintenance_routine: "",
    task_description: "",
    estimated_duration: "",
  });

  const [catalog, setCatalog] = useState({
    classifications: [],
    categories: [],
    groups: [],
  });
  const [equipment, setEquipment] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  /* Cascaded asset dropdowns based on setup hierarchy */
  const selectedCls = catalog.classifications.find(
    (c) => c.item_name === form.asset_classification,
  );
  const filteredCats = selectedCls
    ? catalog.categories.filter((c) => c.parent_id === selectedCls.id)
    : [];
  const selectedCat = catalog.categories.find(
    (c) => c.item_name === form.asset_category,
  );
  const filteredGroups = selectedCat
    ? catalog.groups.filter((g) => g.parent_id === selectedCat.id)
    : [];

  /* Equipment filtering for temporal multi-select */
  const availableAssets = equipment.filter(
    (eq) =>
      (!form.asset_group || eq.group_name === form.asset_group) &&
      !(form.selected_assets || []).includes(eq.id),
  );
  const confirmedAssets = equipment.filter((eq) =>
    (form.selected_assets || []).includes(eq.id),
  );

  useEffect(() => {
    let m = true;
    Promise.all([
      api.get("/maintenance/setup/catalog"),
      api.get("/maintenance/equipment"),
      api.get("/maintenance/schedules"),
    ])
      .then(([setupRes, eqRes, schRes]) => {
        if (!m) return;
        const c = setupRes.data?.catalogs || {};
        setCatalog({
          classifications: c.classifications || [],
          categories: c.categories || [],
          groups: c.groups || [],
        });
        setEquipment(Array.isArray(eqRes.data?.items) ? eqRes.data.items : []);
        setSchedules(
          Array.isArray(schRes.data?.items) ? schRes.data.items : [],
        );
      })
      .catch(() => {});

    if (isEdit) {
      api
        .get(`/maintenance/rosters/${id}`)
        .then((r) => {
          if (!m) return;
          const item = r.data?.item || {};
          setForm((p) => ({
            ...p,
            ...item,
            roster_date: (item.roster_date || "").slice(0, 10),
            period_start: (item.period_start || "").slice(0, 10),
            period_end: (item.period_end || "").slice(0, 10),
            selected_assets: item.selected_assets
              ? typeof item.selected_assets === "string"
                ? JSON.parse(item.selected_assets)
                : item.selected_assets
              : [],
          }));
        })
        .catch(() => toast.error("Failed to load roster"));
    }
    return () => {
      m = false;
    };
  }, [id]);

  function validate() {
    const e = {};
    if (!form.roster_name.trim()) e.roster_name = "Roster name is required";
    return e;
  }

  const handleScheduleSelect = (e) => {
    const sid = e.target.value;
    update("schedule_id", sid);
    if (!sid) {
      // Clear all schedule-sourced fields when deselected
      setForm((p) => ({
        ...p,
        schedule_id: "",
        period_start: "",
        period_end: "",
        asset_classification: "",
        asset_category: "",
        asset_group: "",
        frequency: "",
        maintenance_days: "",
        maintenance_routine: "",
        task_description: "",
        estimated_duration: "",
        selected_assets: [],
      }));
      return;
    }

    const s = schedules.find((sch) => sch.id.toString() === sid);
    if (s) {
      let tDesc = "";
      let tDur = "";
      if (s.tasks) {
        try {
          const tasksArr = typeof s.tasks === 'string' ? JSON.parse(s.tasks) : s.tasks;
          if (Array.isArray(tasksArr) && tasksArr.length > 0) {
            tDesc = tasksArr.map(t => t.task_description).filter(Boolean).join(" | ");
            const totalDur = tasksArr.reduce((sum, t) => sum + (parseFloat(t.estimated_duration) || 0), 0);
            tDur = totalDur > 0 ? totalDur.toString() : "";
          }
        } catch (err) {}
      }

      // Parse selected_assets from the schedule
      let scheduleAssets = [];
      if (s.selected_assets) {
        try {
          scheduleAssets = typeof s.selected_assets === 'string'
            ? JSON.parse(s.selected_assets)
            : s.selected_assets;
          if (!Array.isArray(scheduleAssets)) scheduleAssets = [];
        } catch (err) { scheduleAssets = []; }
      }

      setForm((p) => ({
        ...p,
        schedule_id: sid,
        period_start: (s.start_date || "").slice(0, 10),
        period_end: (s.end_date || "").slice(0, 10),
        asset_classification: s.classification || "",
        asset_category: s.category || "",
        asset_group: s.group_name || "",
        frequency: s.frequency || "",
        maintenance_days: s.maintenance_days || "",
        maintenance_routine: s.maintenance_routine || "",
        task_description: tDesc,
        estimated_duration: tDur,
        selected_assets: scheduleAssets,
      }));
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/maintenance/rosters/${id}`, form);
        toast.success("Roster updated");
      } else {
        const res = await api.post("/maintenance/rosters", form);
        const count = res.data?.generatedCount || 1;
        toast.success(
          count > 1
            ? `✅ ${count} roster dates generated successfully!`
            : "Roster created successfully!"
        );
      }
      navigate("/maintenance/rosters", { state: { refresh: true } });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save roster");
    } finally {
      setSaving(false);
    }
  }

  // Multi-select handlers
  const addAsset = (eqId) => {
    update("selected_assets", [...(form.selected_assets || []), eqId]);
  };
  const removeAsset = (eqId) => {
    update(
      "selected_assets",
      (form.selected_assets || []).filter((id) => id !== eqId),
    );
  };
  const addAllAssets = () => {
    update("selected_assets", [
      ...(form.selected_assets || []),
      ...availableAssets.map((a) => a.id),
    ]);
  };
  const removeAllAssets = () => {
    update("selected_assets", []);
  };

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="btn-secondary">
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isEdit ? (isView ? "View" : "Edit") : "New"} Maintenance Roster
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Schedule maintenance activities and link to plans
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          {/* ── Card header ── */}
          <div className="card-header bg-brand text-white rounded-t-xl font-semibold flex items-center justify-between">
            <span>Roster Details</span>
            {!isView && (
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                <Save size={14} />
                {saving ? "Saving…" : "Save Roster"}
              </button>
            )}
          </div>

          {/* ── Single body grid ── */}
          <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* ─ ROSTER INFORMATION ─ */}
            <SectionLabel icon={ClipboardList} text="Roster Information" />

            <div>
              <label className="label">
                Roster Name <span className="text-red-500">*</span>
              </label>
              <input
                className={`input w-full ${errors.roster_name ? "border-red-400 focus:border-red-400" : ""}`}
                value={form.roster_name}
                onChange={(e) => update("roster_name", e.target.value)}
                placeholder="e.g. Week 28 — Generator Service"
                disabled={isView}
              />
              {errors.roster_name && (
                <p className="flex items-center gap-1 text-red-500 text-xs mt-1">
                  <AlertCircle size={11} />
                  {errors.roster_name}
                </p>
              )}
            </div>

            {/* Linked schedule */}
            <div>
              <label className="label">Linked Maintenance Schedule</label>
              <select
                className="input w-full"
                value={form.schedule_id}
                onChange={handleScheduleSelect}
                disabled={isView}
              >
                <option value="">— Not linked to a schedule —</option>
                {schedules.filter(s => s.status === 'ACTIVE').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.schedule_name}
                    {s.frequency ? ` · ${s.frequency}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Generation preview panel */}
            {form.schedule_id && (
              <div className="md:col-span-4 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-900/20 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400 mb-2">
                  📋 Schedule Loaded — Saving will auto-generate all roster dates
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {[
                    { label: "Start Date", value: form.period_start },
                    { label: "End Date", value: form.period_end },
                    { label: "Frequency / Routine", value: form.maintenance_routine || form.frequency },
                    { label: "Maintenance Day", value: form.maintenance_days },
                    { label: "Task Description", value: form.task_description, span: true },
                    { label: "Est. Duration", value: form.estimated_duration ? `${form.estimated_duration} hrs` : "" },
                    { label: "Assets Linked", value: (form.selected_assets || []).length > 0 ? `${form.selected_assets.length} asset(s)` : "" },
                  ].map(({ label, value, span }) => value ? (
                    <div key={label} className={span ? "col-span-2" : ""}>
                      <span className="block text-slate-400">{label}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{value}</span>
                    </div>
                  ) : null)}
                </div>
                {(!form.period_start || !form.period_end || (!form.maintenance_routine && !form.frequency) || !form.maintenance_days) && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                    ⚠️ Some generation fields are missing. The linked schedule must have: Start Date, End Date, Frequency, and Maintenance Day filled in.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.period_start}
                onChange={(e) => update("period_start", e.target.value)}
                disabled={isView}
              />
            </div>

            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.period_end}
                onChange={(e) => update("period_end", e.target.value)}
                disabled={isView}
              />
            </div>

            {/* ─ ASSET ASSIGNMENT ─ */}
            <SectionLabel
              icon={Cpu}
              text="Equipment Classification & Grouping"
            />

            <div>
              <label className="label">Asset Classification</label>
              <select
                className="input w-full"
                value={form.asset_classification}
                onChange={(e) => {
                  update("asset_classification", e.target.value);
                  update("asset_category", "");
                  update("asset_group", "");
                }}
                disabled={isView}
              >
                <option value="">— Select Classification —</option>
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
                className="input w-full"
                value={form.asset_category}
                onChange={(e) => {
                  update("asset_category", e.target.value);
                  update("asset_group", "");
                }}
                disabled={isView}
              >
                <option value="">— Select Category —</option>
                {filteredCats.map((c) => (
                  <option key={c.id} value={c.item_name}>
                    {c.item_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Asset Group</label>
              <select
                className="input w-full"
                value={form.asset_group}
                onChange={(e) => update("asset_group", e.target.value)}
                disabled={isView}
              >
                <option value="">— Select Group —</option>
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.item_name}>
                    {g.item_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Multi-select logic for temporal asset assignment */}
            <div className="md:col-span-4 mt-2">
              <label className="label">Select Assets</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Available Assets */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                  <div className="bg-slate-50 dark:bg-slate-800/80 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Available Assets{" "}
                      {form.asset_group && `(${form.asset_group})`}
                    </span>
                    {!isView && (
                      <button
                        type="button"
                        onClick={addAllAssets}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                      >
                        Select All
                      </button>
                    )}
                  </div>
                  <ul className="h-48 overflow-y-auto p-2 space-y-1">
                    {availableAssets.length === 0 && (
                      <li className="text-xs text-slate-400 p-2 text-center">
                        No available assets match the group.
                      </li>
                    )}
                    {availableAssets.map((eq) => (
                      <li
                        key={eq.id}
                        className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-sm group"
                      >
                        <span className="truncate pr-2">
                          {eq.equipment_name}{" "}
                          {eq.equipment_code ? `(${eq.equipment_code})` : ""}
                        </span>
                        {!isView && (
                          <button
                            type="button"
                            onClick={() => addAsset(eq.id)}
                            className="text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ArrowRight size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Confirmed Assets */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-brand-50/30 dark:bg-brand-900/10">
                  <div className="bg-brand-100/50 dark:bg-brand-900/30 px-3 py-2 border-b border-brand-200 dark:border-brand-800 flex justify-between items-center">
                    <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                      Confirmed Assets
                    </span>
                    {!isView && (
                      <button
                        type="button"
                        onClick={removeAllAssets}
                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        Remove All
                      </button>
                    )}
                  </div>
                  <ul className="h-48 overflow-y-auto p-2 space-y-1">
                    {confirmedAssets.length === 0 && (
                      <li className="text-xs text-slate-400 p-2 text-center">
                        No assets confirmed yet.
                      </li>
                    )}
                    {confirmedAssets.map((eq) => (
                      <li
                        key={eq.id}
                        className="flex justify-between items-center p-2 hover:bg-brand-50 dark:hover:bg-brand-900/40 rounded text-sm border border-transparent hover:border-brand-200 dark:hover:border-brand-700 group"
                      >
                        <span className="truncate pr-2">
                          {eq.equipment_name}{" "}
                          {eq.equipment_code ? `(${eq.equipment_code})` : ""}
                        </span>
                        {!isView && (
                          <button
                            type="button"
                            onClick={() => removeAsset(eq.id)}
                            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="md:col-span-4 mt-2">
              <label className="label">Remarks</label>
              <textarea
                className="input w-full"
                rows={2}
                value={form.remarks}
                onChange={(e) => update("remarks", e.target.value)}
                placeholder="Enter any additional remarks..."
                disabled={isView}
              />
            </div>
            
            <input type="hidden" name="frequency" value={form.frequency} />
            <input type="hidden" name="maintenance_days" value={form.maintenance_days} />
            <input type="hidden" name="maintenance_routine" value={form.maintenance_routine} />
            <input type="hidden" name="task_description" value={form.task_description} />
            <input type="hidden" name="estimated_duration" value={form.estimated_duration} />
          </div>
          {/* end card-body */}
        </div>
        {/* end card */}

        {/* ── Footer actions ── */}
        {!isView && (
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => window.history.back()} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <Save size={15} className="mr-1.5" />
              {saving ? "Saving…" : isEdit ? "Update Roster" : "Create Roster"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
