import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, ArrowLeft, Filter, RefreshCw, Search,
  Clock, UserCog, CalendarDays, Eye, Edit
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const rosterStatusBadge = (status) => {
  const map = {
    SCHEDULED:  "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    ACTIVE:     "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    COMPLETED:  "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
    CANCELLED:  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  };
  return map[status] || "bg-slate-100 text-slate-500";
};

const attendanceBadge = (status) => {
  const map = {
    PRESENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    ABSENT:  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
    LATE:    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    LEAVE:   "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  };
  return map[status] || "bg-slate-100 text-slate-500";
};

const ALL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// ─── Initial form states ──────────────────────────────────────────────────────
const getInitialRosterForm = () => ({
  property_id: "",
  employee_name: "",
  role_required: "",
  shift_name: "",
  start_date: "",
  end_date: "",
  days_of_week: ["MON", "TUE", "WED", "THU", "FRI"],
  hours_per_shift: 8,
  hourly_rate: 25,
});

const getInitialAttendanceForm = () => ({
  attendance_status: "PRESENT",
  overtime_hours: 0,
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function FMWorkforceRosterPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [filters, setFilters] = useState({ propertyId: "", status: "", search: "" });

  const [showRosterModal, setShowRosterModal] = useState(false);
  const [viewingRoster, setViewingRoster] = useState(null);
  const [rosterForm, setRosterForm] = useState(getInitialRosterForm());

  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedRoster, setSelectedRoster] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState(getInitialAttendanceForm());

  // ── Fetch helpers ──
  const fetchProperties = useCallback(async () => {
    try {
      const res = await api.get("/facilities/properties");
      const list = res.data?.data || [];
      setProperties(list);
      if (list.length > 0) {
        setRosterForm((f) => ({ ...f, property_id: list[0].id }));
      }
    } catch {}
  }, []);

  const fetchRosters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.propertyId) params.set("propertyId", filters.propertyId);
      if (filters.status)     params.set("status", filters.status);
      if (filters.search)     params.set("search", filters.search);
      const res = await api.get(`/facilities/workforce/rosters?${params.toString()}`);
      setRosters(res.data?.data || []);
    } catch {
      toast.error("Failed to load workforce roster");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);
  useEffect(() => { fetchRosters(); }, [fetchRosters]);

  // ── Summary stats ──
  const totalAssignments = rosters.length;
  const activeToday      = rosters.filter((r) => r.status === "ACTIVE").length;
  const absentToday      = rosters.filter((r) => r.attendance_status === "ABSENT").length;
  const totalOvertime    = rosters.reduce((sum, r) => sum + (parseFloat(r.overtime_hours) || 0), 0);

  // ── Day toggle ──
  const toggleDay = (day) => {
    setRosterForm((f) => {
      const existing = f.days_of_week || [];
      return {
        ...f,
        days_of_week: existing.includes(day)
          ? existing.filter((d) => d !== day)
          : [...existing, day],
      };
    });
  };

  // ── Handlers ──
  const handleCreateRoster = async (e) => {
    e.preventDefault();
    if ((rosterForm.days_of_week || []).length === 0) {
      toast.warn("Please select at least one day of week.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/facilities/workforce/rosters", rosterForm);
      toast.success("Employee assigned to roster successfully");
      setShowRosterModal(false);
      setRosterForm(getInitialRosterForm());
      fetchRosters();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign employee");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAttendance = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/facilities/workforce/rosters/${selectedRoster.id}`, attendanceForm);
      toast.success("Attendance updated successfully");
      setShowAttendanceModal(false);
      setAttendanceForm(getInitialAttendanceForm());
      fetchRosters();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const ff = (field) => (e) => setFilters((f) => ({ ...f, [field]: e.target.value }));
  const fr = (field) => (e) => setRosterForm((f) => ({ ...f, [field]: e.target.value }));
  const fa = (field) => (e) => setAttendanceForm((f) => ({ ...f, [field]: e.target.value }));

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs"
            title="Go Back"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              Workforce Roster Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              FM staff deployment, shift assignments, attendance tracking and overtime monitoring across properties.
            </p>
          </div>
        </div>
        <button
          onClick={() => { setRosterForm(getInitialRosterForm()); setShowRosterModal(true); }}
          className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
        >
          <Plus size={15} /> Assign Employee
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Total Assignments</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{totalAssignments}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Active Today</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeToday}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Absent Today</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{absentToday}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Total Overtime Hrs</p>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">{totalOvertime.toFixed(1)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter size={13} />
            <span className="text-xs font-semibold text-slate-500">Filters</span>
          </div>
          <select
            value={filters.propertyId}
            onChange={ff("propertyId")}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
          >
            <option value="">All Properties</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.property_name}</option>)}
          </select>
          <select
            value={filters.status}
            onChange={ff("status")}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
          >
            <option value="">All Status</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <div className="flex-1 min-w-[200px] relative">
            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee name or role..."
              value={filters.search}
              onChange={ff("search")}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-1.5 text-xs"
            />
          </div>
          <button
            onClick={fetchRosters}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5 px-3"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Roster No</th>
                <th className="px-3 py-3">Employee Name</th>
                <th className="px-3 py-3">Role Required</th>
                <th className="px-3 py-3">Property</th>
                <th className="px-3 py-3">Shift</th>
                <th className="px-3 py-3">Start Date</th>
                <th className="px-3 py-3">End Date</th>
                <th className="px-3 py-3">Days</th>
                <th className="px-3 py-3">Hrs / Shift</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Attendance</th>
                <th className="px-3 py-3">OT Hrs</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="13" className="text-center py-10 text-slate-400">Loading workforce roster…</td>
                </tr>
              ) : rosters.length === 0 ? (
                <tr>
                  <td colSpan="13" className="text-center py-10 text-slate-400 italic">No roster assignments found.</td>
                </tr>
              ) : (
                rosters.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">{r.roster_no}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">{r.employee_name}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{r.role_required}</td>
                    <td className="px-3 py-3">{r.property_name || "—"}</td>
                    <td className="px-3 py-3 font-medium">{r.shift_name}</td>
                    <td className="px-3 py-3 font-mono text-[11px]">{r.start_date ? String(r.start_date).slice(0, 10) : "—"}</td>
                    <td className="px-3 py-3 font-mono text-[11px]">{r.end_date ? String(r.end_date).slice(0, 10) : "—"}</td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        {Array.isArray(r.days_of_week)
                          ? r.days_of_week.join(", ")
                          : (r.days_of_week || "—")}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-center">{r.hours_per_shift ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rosterStatusBadge(r.status)}`}>
                        {r.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {r.attendance_status ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${attendanceBadge(r.attendance_status)}`}>
                          {r.attendance_status}
                        </span>
                      ) : <span className="text-slate-400 text-[11px]">—</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-center">
                      {r.overtime_hours != null ? (
                        <span className={parseFloat(r.overtime_hours) > 0 ? "text-violet-600 font-bold" : "text-slate-400"}>
                          {parseFloat(r.overtime_hours).toFixed(1)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setViewingRoster(r)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-semibold transition-all"
                          title="View Deployment Details"
                        >
                          <Eye size={11} /> View
                        </button>
                        {r.status !== "CANCELLED" && r.status !== "COMPLETED" && (
                          <button
                            onClick={() => {
                              setSelectedRoster(r);
                              setAttendanceForm({
                                attendance_status: r.attendance_status || "PRESENT",
                                overtime_hours: r.overtime_hours ?? 0,
                              });
                              setShowAttendanceModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10px] font-semibold"
                          >
                            <UserCog size={11} /> Edit / Attendance
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: ASSIGN EMPLOYEE
      ══════════════════════════════════════════════════════════════════════ */}
      {showRosterModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays size={18} className="text-violet-500" />
                Assign Employee to Roster
              </h3>
              <button type="button" onClick={() => setShowRosterModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleCreateRoster} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Property *</label>
                  <select value={rosterForm.property_id} onChange={fr("property_id")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required>
                    <option value="">Select property...</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.property_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Employee Name *</label>
                  <input type="text" placeholder="e.g. Abena Gyamfi" value={rosterForm.employee_name} onChange={fr("employee_name")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Role Required *</label>
                  <input type="text" placeholder="e.g. Cleaning Supervisor, Security Guard..." value={rosterForm.role_required} onChange={fr("role_required")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Shift Name *</label>
                  <input type="text" placeholder="e.g. Day Shift, Night Shift..." value={rosterForm.shift_name} onChange={fr("shift_name")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Start Date *</label>
                  <input type="date" value={rosterForm.start_date} onChange={fr("start_date")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required />
                </div>
                <div>
                  <label className="block font-semibold mb-1">End Date *</label>
                  <input type="date" value={rosterForm.end_date} onChange={fr("end_date")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required />
                </div>
              </div>

              {/* Days of Week */}
              <div>
                <label className="block font-semibold mb-2">Days of Week *</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DAYS.map((day) => {
                    const checked = (rosterForm.days_of_week || []).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                          checked
                            ? "bg-violet-600 text-white border-violet-600"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-400"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Hours per Shift</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    value={rosterForm.hours_per_shift}
                    onChange={(e) => setRosterForm((f) => ({ ...f, hours_per_shift: parseFloat(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Hourly Rate</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rosterForm.hourly_rate}
                    onChange={(e) => setRosterForm((f) => ({ ...f, hourly_rate: parseFloat(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowRosterModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold shadow-sm">
                  {submitting ? "Assigning…" : "Assign to Roster"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: UPDATE ATTENDANCE
      ══════════════════════════════════════════════════════════════════════ */}
      {showAttendanceModal && selectedRoster && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock size={18} className="text-violet-500" />
                Update Attendance
              </h3>
              <button type="button" onClick={() => setShowAttendanceModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleUpdateAttendance} className="p-6 space-y-4 text-xs">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-600 dark:text-slate-300">
                <span className="font-bold">{selectedRoster.employee_name}</span>
                <span className="text-slate-400 ml-2">— {selectedRoster.role_required}</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">{selectedRoster.shift_name} · {selectedRoster.property_name || "—"}</span>
              </div>
              <div>
                <label className="block font-semibold mb-1">Attendance Status *</label>
                <select value={attendanceForm.attendance_status} onChange={fa("attendance_status")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs">
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LATE">Late</option>
                  <option value="LEAVE">On Leave</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Overtime Hours</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={attendanceForm.overtime_hours}
                  onChange={(e) => setAttendanceForm((f) => ({ ...f, overtime_hours: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowAttendanceModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold shadow-sm">
                  {submitting ? "Saving…" : "Save Attendance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: View Workforce Deployment Details ── */}
      {viewingRoster && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-violet-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Roster Assignment — {viewingRoster.roster_no}
                </h3>
              </div>
              <button onClick={() => setViewingRoster(null)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Employee Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{viewingRoster.employee_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Role Required</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingRoster.role_required}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Property</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingRoster.property_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Shift</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingRoster.shift_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Schedule Window</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {viewingRoster.start_date ? String(viewingRoster.start_date).slice(0, 10) : "—"} to {viewingRoster.end_date ? String(viewingRoster.end_date).slice(0, 10) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Shift Hours</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{viewingRoster.hours_per_shift} hrs / shift</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block mt-0.5 ${rosterStatusBadge(viewingRoster.status)}`}>
                    {viewingRoster.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Attendance Record</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block mt-0.5 ${attendanceBadge(viewingRoster.attendance_status)}`}>
                    {viewingRoster.attendance_status || "PENDING"} (OT: {viewingRoster.overtime_hours || 0} hrs)
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
                <button onClick={() => setViewingRoster(null)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
