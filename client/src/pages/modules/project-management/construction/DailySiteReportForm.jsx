/**
 * @file DailySiteReportForm.jsx
 * @description Detailed Daily Site Report (DSR) entry & view form.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Save,
  ArrowLeft,
  CloudSun,
  Users,
  Truck,
  Package,
  CheckSquare,
  ShieldAlert,
  Plus,
  Trash2,
  CheckCircle2
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function DailySiteReportForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  const [projects, setProjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const [form, setForm] = useState({
    project_id: searchParams.get("project_id") || "",
    report_date: new Date().toISOString().split("T")[0],
    report_number: "",
    weather_morning: "SUNNY",
    weather_afternoon: "SUNNY",
    site_condition: "DRY",
    working_hours_from: "08:00:00",
    working_hours_to: "17:00:00",
    site_engineer_name: "",
    general_remarks: "",
    safety_observations: "",
    status: "DRAFT",
  });

    const [subcontractors, setSubcontractors] = useState([]);

  // Sub-items (clean initial state, no dummy typed data)
  const [activities, setActivities] = useState(
    isEdit ? [] : [{ location_grid: "", description: "", quantity_completed: "", unit: "M3", progress_percent: "" }]
  );
  const [workforce, setWorkforce] = useState(
    isEdit ? [] : [{ trade_category: "SKILLED", trade_name: "", subcontractor_name: "", headcount: "", total_hours: "" }]
  );
  const [equipment, setEquipment] = useState([]);
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
        // Do not auto-select project if not preselected
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const sRes = await api.get("/purchase/suppliers?contractor=Y");
        const list = sRes.data?.items || sRes.data?.data?.items || [];
        if (list.length > 0) {
          setSubcontractors(list);
        } else {
          const fallback = await api.get("/purchase/suppliers");
          setSubcontractors(fallback.data?.items || fallback.data?.data?.items || []);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (isEdit) {
      (async () => {
        try {
          const res = await api.get(`/construction/daily-reports/${id}`);
          if (res.data?.item) {
            const itm = res.data.item;
            setForm({
              ...itm,
              report_date: itm.report_date ? itm.report_date.split("T")[0] : "",
            });
            setActivities(res.data.activities || []);
            setWorkforce(res.data.workforce || []);
            setEquipment(res.data.equipment || []);
            setMaterials(res.data.materials || []);
          }
        } catch (e) {
          toast.error("Failed to load daily report");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.project_id) return toast.error("Please select a project");
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/construction/daily-reports/${id}`, {
          ...form,
          activities,
          workforce,
          equipment,
          materials,
        });
        toast.success("Daily site report updated successfully");
      } else {
        await api.post("/construction/daily-reports", {
          ...form,
          activities,
          workforce,
          equipment,
          materials,
        });
        toast.success("Daily site report saved successfully");
      }
      navigate("/project-management/daily-reports");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save daily site report");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-400">Loading daily report...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Canonical Form Page Header */}
      <div>
        <Link to="/project-management/daily-reports" className="btn btn-secondary inline-flex items-center gap-1.5 mb-3">
          <ArrowLeft size={16} /> Back to Daily Reports
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BookOpen size={24} className="text-brand-900 dark:text-brand-400" />
              {isEdit ? `Daily Site Diary: ${form.report_number}` : "New Daily Site Diary Entry"}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">Official construction site daily record and measurements</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/project-management/daily-reports" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Save size={16} /> {saving ? "Saving..." : "Save Diary"}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Site & Weather Metadata */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 text-brand-900 dark:text-brand-400 border-b border-slate-100 dark:border-slate-800 pb-2">
            <CloudSun size={18} />
            <h2 className="font-bold text-xs uppercase tracking-wider">Site Conditions & Weather</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1">
              <label className="label text-xs uppercase font-bold text-slate-500 dark:text-slate-400">Project</label>
              <select
                className="input w-full"
                value={form.project_id || ""}
                onChange={e => setForm({ ...form, project_id: e.target.value })}
                disabled={isEdit}
              >
                <option value="">-- Select Project --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.project_code ? `${p.project_code} - ` : ""}{p.project_name || p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="label text-xs uppercase font-bold text-slate-500 dark:text-slate-400">Report Date</label>
              <input
                type="date"
                required
                className="input w-full font-mono"
                value={form.report_date}
                onChange={e => setForm({ ...form, report_date: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="label text-xs uppercase font-bold text-slate-500 dark:text-slate-400">Weather (Morning)</label>
              <select
                className="input w-full"
                value={form.weather_morning}
                onChange={e => setForm({ ...form, weather_morning: e.target.value })}
              >
                <option value="SUNNY">Sunny / Clear</option>
                <option value="OVERCAST">Overcast / Cloudy</option>
                <option value="LIGHT_RAIN">Light Rain / Drizzle</option>
                <option value="HEAVY_RAIN">Heavy Rain / Downpour</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="label text-xs uppercase font-bold text-slate-500 dark:text-slate-400">Site Condition</label>
              <select
                className="input w-full"
                value={form.site_condition}
                onChange={e => setForm({ ...form, site_condition: e.target.value })}
              >
                <option value="DRY">Dry & Workable</option>
                <option value="DAMP">Damp</option>
                <option value="MUDDY">Muddy / Slowed Traffic</option>
                <option value="FLOODED">Waterlogged / Work Stoppage</option>
              </select>
            </div>
          </div>
        </div>

        {/* Workforce Headcount */}
        <div className="card p-6 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="flex items-center gap-2 text-brand-600">
              <Users size={18} />
              <h2 className="font-bold text-xs uppercase tracking-wider">Site Workforce Deployment</h2>
            </div>
            <button
              type="button"
              onClick={() => setWorkforce([...workforce, { trade_category: "SKILLED", trade_name: "", subcontractor_name: "", headcount: "", total_hours: "" }])}
              className="btn btn-secondary text-xs flex items-center gap-1"
            >
              <Plus size={14} /> Add Trade
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 font-bold uppercase">
              <tr>
                <th className="p-2">Category</th>
                <th className="p-2">Trade / Role</th>
                <th className="p-2">Company / Subcontractor</th>
                <th className="p-2 text-right w-24">Headcount</th>
                <th className="p-2 text-right w-24">Total Hours</th>
                <th className="p-2 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {workforce.map((w, idx) => (
                <tr key={idx}>
                  <td className="p-1.5">
                    <select
                      className="w-full p-1 border rounded bg-transparent text-xs"
                      value={w.trade_category || "SKILLED"}
                      onChange={e => {
                        const copy = [...workforce];
                        copy[idx].trade_category = e.target.value;
                        setWorkforce(copy);
                      }}
                    >
                      <option value="SKILLED">Skilled</option>
                      <option value="SEMI_SKILLED">Semi-Skilled</option>
                      <option value="UNSKILLED">Unskilled</option>
                      <option value="SUPERVISORY">Supervisory</option>
                    </select>
                  </td>
                  <td className="p-1.5">
                    <input
                      type="text"
                      className="w-full p-1 border rounded bg-transparent text-xs"
                      placeholder="e.g. Carpenters, Steel Benders, Mason..."
                      value={w.trade_name || ""}
                      onChange={e => {
                        const copy = [...workforce];
                        copy[idx].trade_name = e.target.value;
                        setWorkforce(copy);
                      }}
                    />
                  </td>
                  <td className="p-1.5">
                    <select
                      className="w-full p-1 border rounded bg-transparent text-xs"
                      value={w.subcontractor_name || ""}
                      onChange={e => {
                        const copy = [...workforce];
                        copy[idx].subcontractor_name = e.target.value;
                        setWorkforce(copy);
                      }}
                    >
                      <option value="">-- Select Subcontractor / Direct --</option>
                      <option value="Direct">Direct (Internal Workforce)</option>
                      {subcontractors.map(s => {
                        const sName = s.supplier_name || s.name;
                        return (
                          <option key={s.id || sName} value={sName}>
                            {sName} {s.supplier_code ? `(${s.supplier_code})` : ""}
                          </option>
                        );
                      })}
                      {w.subcontractor_name &&
                        w.subcontractor_name !== "Direct" &&
                        !subcontractors.some(s => (s.supplier_name || s.name) === w.subcontractor_name) && (
                          <option value={w.subcontractor_name}>{w.subcontractor_name}</option>
                      )}
                    </select>
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      min="0"
                      className="w-full p-1 border rounded text-right bg-transparent font-mono text-xs"
                      placeholder="0"
                      value={w.headcount ?? ""}
                      onChange={e => {
                        const val = e.target.value === "" ? "" : Number(e.target.value);
                        const copy = [...workforce];
                        copy[idx].headcount = val;
                        copy[idx].total_hours = val === "" ? "" : val * 8;
                        setWorkforce(copy);
                      }}
                    />
                  </td>
                  <td className="p-1.5 text-right font-mono font-bold text-xs">
                    {w.total_hours ? `${w.total_hours} hrs` : "0 hrs"}
                  </td>
                  <td className="p-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => setWorkforce(workforce.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Site Activities Completed */}
        <div className="card p-6 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="flex items-center gap-2 text-brand-600">
              <CheckSquare size={18} />
              <h2 className="font-bold text-xs uppercase tracking-wider">Site Activities & Works Executed</h2>
            </div>
            <button
              type="button"
              onClick={() => setActivities([...activities, { location_grid: "", description: "", quantity_completed: "", unit: "M3", progress_percent: "" }])}
              className="btn btn-secondary text-xs flex items-center gap-1"
            >
              <Plus size={14} /> Add Activity
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 font-bold uppercase">
              <tr>
                <th className="p-2 w-32">Location / Grid</th>
                <th className="p-2">Description of Work Executed</th>
                <th className="p-2 w-24 text-right">Measured Qty</th>
                <th className="p-2 w-20">Unit</th>
                <th className="p-2 w-28 text-right">% Complete</th>
                <th className="p-2 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activities.map((act, idx) => (
                <tr key={idx}>
                  <td className="p-1.5">
                    <input
                      type="text"
                      className="w-full p-1 border rounded bg-transparent text-xs"
                      placeholder="e.g. Grid A-C / Level 1"
                      value={act.location_grid || ""}
                      onChange={e => {
                        const copy = [...activities];
                        copy[idx].location_grid = e.target.value;
                        setActivities(copy);
                      }}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="text"
                      className="w-full p-1 border rounded bg-transparent text-xs"
                      placeholder="e.g. Formwork and reinforcement installation..."
                      value={act.description || ""}
                      onChange={e => {
                        const copy = [...activities];
                        copy[idx].description = e.target.value;
                        setActivities(copy);
                      }}
                    />
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="w-full p-1 border rounded text-right bg-transparent font-mono text-xs"
                      placeholder="0.00"
                      value={act.quantity_completed ?? ""}
                      onChange={e => {
                        const val = e.target.value === "" ? "" : Number(e.target.value);
                        const copy = [...activities];
                        copy[idx].quantity_completed = val;
                        setActivities(copy);
                      }}
                    />
                  </td>
                  <td className="p-1.5">
                    <select
                      className="w-full p-1 border rounded bg-transparent text-xs"
                      value={act.unit || "M3"}
                      onChange={e => {
                        const copy = [...activities];
                        copy[idx].unit = e.target.value;
                        setActivities(copy);
                      }}
                    >
                      {["M3", "M2", "M", "KG", "TON", "NR", "SUM"].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-full p-1 border rounded text-right bg-transparent font-mono font-bold text-xs"
                      placeholder="0"
                      value={act.progress_percent ?? ""}
                      onChange={e => {
                        const val = e.target.value === "" ? "" : Number(e.target.value);
                        const copy = [...activities];
                        copy[idx].progress_percent = val;
                        setActivities(copy);
                      }}
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => setActivities(activities.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Safety & Remarks */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 text-brand-900 dark:text-brand-400 border-b border-slate-100 dark:border-slate-800 pb-2">
            <ShieldAlert size={18} />
            <h2 className="font-bold text-xs uppercase tracking-wider">HSE & Remarks</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="label text-xs uppercase font-bold text-slate-500 dark:text-slate-400">HSE Observations & Incidents</label>
              <textarea
                className="input w-full min-h-[90px]"
                placeholder="Toolbox talks conducted, near misses, PPE compliance..."
                value={form.safety_observations}
                onChange={e => setForm({ ...form, safety_observations: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="label text-xs uppercase font-bold text-slate-500 dark:text-slate-400">Site Engineer Remarks</label>
              <textarea
                className="input w-full min-h-[90px]"
                placeholder="Inspections held with consultant, delayed deliveries, instructions received..."
                value={form.general_remarks}
                onChange={e => setForm({ ...form, general_remarks: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Canonical Form Footer */}
        <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Link to="/project-management/daily-reports" className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save Diary"}
          </button>
        </div>
      </form>
    </div>
  );
}
