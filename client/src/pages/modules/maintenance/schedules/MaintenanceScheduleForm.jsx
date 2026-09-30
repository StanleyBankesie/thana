/**
 * @fileoverview MaintenanceScheduleForm component.
 * Provides functionality for MaintenanceScheduleForm.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

const FREQUENCIES = [
  "Daily",
  "Weekly",
  "Biweekly",
  "Monthly",
  "Quarterly",
  "Biannual",
  "Annual",
];
const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"];

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceScheduleForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form, setForm] = useState({
    schedule_name: "",
    asset_name: "",
    frequency: "Monthly",
    start_date: "",
    end_date: "",
    classification: "",
    category: "",
    group_name: "",
    maintenance_days: "",
    maintenance_routine: "",
    assigned_to: "",
    description: "",
    status: "ACTIVE",
    tasks: [],
    selected_assets: [],
  });
  const [equipment, setEquipment] = useState([]);
  const [teams, setTeams] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [maintenanceRoutines, setMaintenanceRoutines] = useState([]);
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const addTask = () => {
    setForm((p) => ({
      ...p,
      tasks: [
        ...(p.tasks || []),
        { id: Date.now(), task_description: "", estimated_duration: "" },
      ],
    }));
  };

  const removeTask = (id) => {
    setForm((p) => ({
      ...p,
      tasks: (p.tasks || []).filter((t) => t.id !== id),
    }));
  };

  const updateTask = (id, field, value) => {
    setForm((p) => ({
      ...p,
      tasks: (p.tasks || []).map((t) =>
        t.id === id ? { ...t, [field]: value } : t,
      ),
    }));
  };

  /* Equipment filtering for temporal multi-select */
  const availableAssets = equipment.filter(
    (eq) =>
      (!form.group_name || eq.group_name === form.group_name) &&
      !(form.selected_assets || []).includes(eq.id),
  );
  const confirmedAssets = equipment.filter((eq) =>
    (form.selected_assets || []).includes(eq.id),
  );

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

  const selectedClass = classifications.find(
    (c) => c.item_name === form.classification,
  );
  const filteredCategories = selectedClass
    ? categories.filter((c) => c.parent_id === selectedClass.id)
    : categories;

  const selectedCat = categories.find((c) => c.item_name === form.category);
  const filteredGroups = selectedCat
    ? groups.filter((g) => g.parent_id === selectedCat.id)
    : groups;

  const handleDayChange = (day, isChecked) => {
    // kept for backward compatibility but not used with select
  };

  useEffect(() => {
    let m = true;
    Promise.all([
      api.get("/maintenance/equipment"),
      api.get("/maintenance/setup/catalog"),
    ])
      .then(([eqRes, setupRes]) => {
        if (m) {
          setEquipment(
            Array.isArray(eqRes.data?.items) ? eqRes.data.items : [],
          );
          setTeams(setupRes.data?.catalogs?.teams || []);
          setClassifications(setupRes.data?.catalogs?.classifications || []);
          setCategories(setupRes.data?.catalogs?.categories || []);
          setGroups(setupRes.data?.catalogs?.groups || []);
          setMaintenanceRoutines(
            setupRes.data?.catalogs?.maintenanceRoutines || [],
          );
        }
      })
      .catch(() => {});
    if (isEdit)
      api
        .get(`/maintenance/schedules/${id}`)
        .then((r) => {
          const item = r.data?.item || {};
          if (m)
            setForm((p) => ({
              ...p,
              ...item,
              start_date: (item.start_date || "").slice(0, 10),
              end_date: (item.end_date || "").slice(0, 10),
              tasks:
                typeof item.tasks === "string"
                  ? JSON.parse(item.tasks)
                  : item.tasks || [],
              selected_assets: item.selected_assets
                ? typeof item.selected_assets === "string"
                  ? JSON.parse(item.selected_assets)
                  : item.selected_assets
                : [],
            }));
        })
        .catch(() => toast.error("Failed to load"));
    return () => {
      m = false;
    };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.schedule_name) {
      toast.error("Schedule name is required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/maintenance/schedules/${id}`, form);
        toast.success("Schedule updated");
      } else {
        await api.post("/maintenance/schedules", form);
        toast.success("Schedule created");
      }
      navigate("/maintenance/schedules", { state: { refresh: true } });
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
            {isEdit ? "Edit" : "New"} Maintenance Schedule
          </h1>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">
            Schedule Details
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Schedule Name *</label>
              <input
                className="input w-56"
                value={form.schedule_name}
                onChange={(e) => update("schedule_name", e.target.value)}
                placeholder="e.g. Monthly Generator Service"
                required
              />
            </div>
            <div>
              <label className="label">Asset Classification</label>
              <select
                className="input w-56"
                value={form.classification}
                onChange={(e) => {
                  update("classification", e.target.value);
                  update("category", ""); // reset child
                  update("group_name", ""); // reset grand-child
                }}
              >
                <option value="">-- Select Classification --</option>
                {classifications.map((c) => (
                  <option key={c.id} value={c.item_name}>
                    {c.item_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Asset Category</label>
              <select
                className="input w-56"
                value={form.category}
                onChange={(e) => {
                  update("category", e.target.value);
                  update("group_name", ""); // reset child
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
                className="input w-56"
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

            <div className="md:col-span-3 mt-2">
              <label className="label">Select Assets</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Available Assets */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                  <div className="bg-slate-50 dark:bg-slate-800/80 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Available Assets{" "}
                      {form.group_name && `(${form.group_name})`}
                    </span>
                    <button
                      type="button"
                      onClick={addAllAssets}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      Select All
                    </button>
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
                        <button
                          type="button"
                          onClick={() => addAsset(eq.id)}
                          className="text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                        >
                          →
                        </button>
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
                    <button
                      type="button"
                      onClick={removeAllAssets}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      Remove All
                    </button>
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
                        <button
                          type="button"
                          onClick={() => removeAsset(eq.id)}
                          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Frequency</label>
              <select
                className="input w-56"
                value={form.frequency}
                onChange={(e) => update("frequency", e.target.value)}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
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
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Maintenance Days</label>
              <select
                className="input w-56"
                value={form.maintenance_days}
                onChange={(e) => update("maintenance_days", e.target.value)}
              >
                <option value="">-- Select Day --</option>
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Maintenance Routine</label>
              <select
                className="input w-56"
                value={form.maintenance_routine}
                onChange={(e) => update("maintenance_routine", e.target.value)}
              >
                <option value="">-- Select Routine --</option>
                {maintenanceRoutines.map((routine) => (
                  <option key={routine.id} value={routine.item_name}>
                    {routine.item_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* <div className="card-header bg-brand text-white font-semibold mt-4">
            Maintenance Days
          </div> */}
        </div>

        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold flex items-center justify-between">
            <span>Maintenance Tasks</span>
            <button
              type="button"
              onClick={addTask}
              className="text-sm bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded transition-colors"
            >
              + Add Task
            </button>
          </div>
          <div className="card-body">
            {!form.tasks || form.tasks.length === 0 ? (
              <div className="text-sm text-slate-500 py-6 text-center border rounded">
                No tasks added yet. Click <strong>+ Add Task</strong> to create
                one.
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                        #
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                        Task Description
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 w-48">
                        Est. Duration (hrs)
                      </th>
                      <th className="px-3 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {form.tasks.map((task, idx) => (
                      <tr key={task.id}>
                        <td className="px-3 py-2 text-slate-400 font-mono text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="input w-full"
                            value={task.task_description}
                            onChange={(e) =>
                              updateTask(
                                task.id,
                                "task_description",
                                e.target.value,
                              )
                            }
                            placeholder="Describe the maintenance task..."
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="input w-full"
                            type="number"
                            step="0.5"
                            min="0"
                            value={task.estimated_duration}
                            onChange={(e) =>
                              updateTask(
                                task.id,
                                "estimated_duration",
                                e.target.value,
                              )
                            }
                            placeholder="e.g. 1.5"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeTask(task.id)}
                            className="text-red-400 hover:text-red-600 text-lg leading-none font-bold"
                            title="Remove Task"
                          >
                            ×
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
            {saving ? "Saving..." : "Save Schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}
