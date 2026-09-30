/**
 * @fileoverview LeaveRoster component.
 * Provides functionality for LeaveRoster.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Download, Printer } from "lucide-react";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LeaveRoster() {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [filter, setFilter] = useState({ type: "NONE", value: "" });
  const [showEmpOverlay, setShowEmpOverlay] = useState(false);
  const [startSel, setStartSel] = useState({ year: "", month: "", day: "" });
  const [endSel, setEndSel] = useState({ year: "", month: "", day: "" });
  const [selDepts, setSelDepts] = useState([]);
  const [selLocs, setSelLocs] = useState([]);
  const [selEmpTypes, setSelEmpTypes] = useState([]);
  const [selCats, setSelCats] = useState([]);
  const [selShifts, setSelShifts] = useState([]);

  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  // Draft items for building a roster before saving
  const [drafts, setDrafts] = useState([]);

  // Draft form
  const [draftForm, setDraftForm] = useState({
    employee_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
  });
  const [targetDeptId, setTargetDeptId] = useState("");

  const loadData = async () => {
    try {
      const [
        depRes,
        empRes,
        typeRes,
        recRes,
        locRes,
        etRes,
        catRes,
        shiftRes,
        wsRes,
      ] = await Promise.all([
        api.get("/admin/departments").catch(() => ({ data: { items: [] } })),
        api.get("/hr/employees?status=ACTIVE").catch(() => ({ data: { items: [] } })),
        api.get("/hr/leave/types").catch(() => ({ data: { items: [] } })),
        api.get(`/hr/leave/records?source=ROSTER&start_date=${year}-01-01&end_date=${year}-12-31`).catch(() => ({ data: { items: [] } })),
        api.get("/hr/setup/locations").catch(() => ({ data: { items: [] } })),
        api.get("/hr/setup/employment-types").catch(() => ({ data: { items: [] } })),
        api.get("/hr/setup/employee-categories").catch(() => ({ data: { items: [] } })),
        api.get("/hr/shifts").catch(() => ({ data: { items: [] } })),
        api.get("/hr/work-schedules").catch(() => ({ data: { items: [] } })),
      ]);
      setDepartments(depRes.data?.items || []);
      setEmployees(empRes.data?.items || []);
      setLeaveTypes(typeRes.data?.items || []);
      setRecords(recRes.data?.items || []);
      setLocations(locRes.data?.items || []);
      setEmploymentTypes(etRes.data?.items || []);
      setCategories(catRes.data?.items || []);
      setShifts(shiftRes.data?.items || []);
      setSchedules(wsRes.data?.items || []);
    } catch {
      toast.error("Failed to load roster data");
    }
  };

  useEffect(() => {
    loadData();
  }, [year]);

  useEffect(() => {
    setStartSel((s) => ({ ...s, year: String(year), day: "" }));
    setEndSel((s) => ({ ...s, year: String(year), day: "" }));
  }, [year]);

  const years = useMemo(() => {
    const y = Number(year);
    return Array.from({ length: 6 }, (_, i) => String(y - 2 + i));
  }, [year]);

  const months = [
    { value: "01", label: "Jan" },
    { value: "02", label: "Feb" },
    { value: "03", label: "Mar" },
    { value: "04", label: "Apr" },
    { value: "05", label: "May" },
    { value: "06", label: "Jun" },
    { value: "07", label: "Jul" },
    { value: "08", label: "Aug" },
    { value: "09", label: "Sep" },
    { value: "10", label: "Oct" },
    { value: "11", label: "Nov" },
    { value: "12", label: "Dec" },
  ];

  const startDays = useMemo(() => {
    if (!startSel.month) return [];
    const total = new Date(
      Number(startSel.year),
      Number(startSel.month),
      0,
    ).getDate();
    return Array.from({ length: total }, (_, i) =>
      String(i + 1).padStart(2, "0"),
    );
  }, [startSel]);

  const endDays = useMemo(() => {
    if (!endSel.month) return [];
    const total = new Date(
      Number(endSel.year),
      Number(endSel.month),
      0,
    ).getDate();
    return Array.from({ length: total }, (_, i) =>
      String(i + 1).padStart(2, "0"),
    );
  }, [endSel]);

  useEffect(() => {
    if (startSel.year && startSel.month && startSel.day) {
      setDraftForm((f) => ({
        ...f,
        start_date: `${startSel.year}-${startSel.month}-${startSel.day}`,
      }));
    } else {
      setDraftForm((f) => ({ ...f, start_date: "" }));
    }
  }, [startSel]);

  useEffect(() => {
    if (endSel.year && endSel.month && endSel.day) {
      setDraftForm((f) => ({
        ...f,
        end_date: `${endSel.year}-${endSel.month}-${endSel.day}`,
      }));
    } else {
      setDraftForm((f) => ({ ...f, end_date: "" }));
    }
  }, [endSel]);

  const handleAddDraft = (e) => {
    e.preventDefault();
    if (
      !draftForm.employee_id ||
      !draftForm.leave_type_id ||
      !draftForm.start_date ||
      !draftForm.end_date
    ) {
      return toast.warn("Fill all draft fields");
    }

    const emp = employees.find((x) => x.id === Number(draftForm.employee_id));
    const type = leaveTypes.find(
      (x) => x.id === Number(draftForm.leave_type_id),
    );

    setDrafts([
      ...drafts,
      {
        ...draftForm,
        employee_id: Number(draftForm.employee_id),
        leave_type_id: Number(draftForm.leave_type_id),
        employee_name: `${emp?.first_name} ${emp?.last_name}`,
        type_name: type?.type_name,
      },
    ]);

    setDraftForm({
      ...draftForm,
      employee_id: "",
      start_date: "",
      end_date: "",
    });
  };

  const handleGenerateDepartment = () => {
    if (!targetDeptId) return toast.warn("Select a department to generate for");
    if (!draftForm.leave_type_id)
      return toast.warn("Select a default leave type first");

    let targetEmps = employees;
    if (targetDeptId !== "ALL") {
      targetEmps = employees.filter((e) => e.dept_id === Number(targetDeptId));
    }

    if (!targetEmps.length)
      return toast.warn("No employees in this department");

    const newDrafts = targetEmps.map((emp) => ({
      employee_id: emp.id,
      leave_type_id: Number(draftForm.leave_type_id),
      start_date: `${year}-01-01`, // Placeholder dates
      end_date: `${year}-01-05`,
      employee_name: `${emp.first_name} ${emp.last_name}`,
      type_name:
        leaveTypes.find((t) => t.id === Number(draftForm.leave_type_id))
          ?.type_name || "Annual",
    }));

    setDrafts([...drafts, ...newDrafts]);
    toast.success(
      `Generated ${newDrafts.length} draft entries. Please adjust dates manually.`,
    );
  };

  const filteredEmployees = useMemo(() => {
    const deptSet = new Set(selDepts.map(String));
    const locSet = new Set(selLocs.map(String));
    const empTypeSet = new Set(selEmpTypes.map(String));
    const catSet = new Set(selCats.map(String));
    const shiftSet = new Set(selShifts.map(String));
    let allowedByShift = null;
    if (shiftSet.size > 0) {
      allowedByShift = new Set(
        schedules
          .filter((s) => shiftSet.has(String(s.shift_id)))
          .map((s) => String(s.employee_id)),
      );
    }
    return employees.filter((e) => {
      if (deptSet.size > 0 && !deptSet.has(String(e.dept_id || "")))
        return false;
      if (locSet.size > 0 && !locSet.has(String(e.location_id || "")))
        return false;
      if (
        empTypeSet.size > 0 &&
        !empTypeSet.has(String(e.employment_type_id || ""))
      )
        return false;
      if (catSet.size > 0 && !catSet.has(String(e.category_id || "")))
        return false;
      if (allowedByShift && !allowedByShift.has(String(e.id))) return false;
      return true;
    });
  }, [
    employees,
    selDepts,
    selLocs,
    selEmpTypes,
    selCats,
    selShifts,
    schedules,
  ]);

  const submitRoster = async () => {
    if (!drafts.length) return toast.warn("No drafts to save");
    setLoading(true);
    try {
      const payload = {
        year,
        items: drafts.map((d) => ({
          employee_id: d.employee_id,
          leave_type_id: d.leave_type_id,
          start_date: d.start_date,
          end_date: d.end_date,
        })),
      };
      const res = await api.post("/hr/leave/roster", payload);
      toast.success(
        `Successfully saved ${res.data?.rostered} roster record(s)`,
      );
      setDrafts([]);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save roster");
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const rows = records.map((r) => ({
      Employee: `${r.first_name} ${r.last_name}`,
      Code: r.emp_code,
      Type: r.type_name,
      Start: r.start_date.slice(0, 10),
      End: r.end_date.slice(0, 10),
      Status: r.status,
      Days: r.total_days,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Annual Roster");
    XLSX.writeFile(wb, `Leave_Roster_${year}.xlsx`);
  };

  const activeRecords = useMemo(
    () => records.filter((r) => r.status === "ACTIVE"),
    [records],
  );
  const overriddenRecords = useMemo(
    () => records.filter((r) => r.status === "OVERRIDDEN"),
    [records],
  );

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Leave Roster {year}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Annual planning & bulk exports
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            className="input w-24"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Year"
          />
          <button className="btn-secondary" onClick={exportExcel}>
            Export Excel
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Left: Draft Builder */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
          <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-white border-b pb-2">
            Roster Builder (Drafts)
          </h2>
          <div className="mb-4">
            <label className="label text-xs">Filter By</label>
            <div className="flex flex-wrap gap-3">
              {[
                { key: "NONE", label: "All" },
                { key: "DEPARTMENT", label: "Department" },
                { key: "LOCATION", label: "Location" },
                { key: "EMPLOYMENT_TYPE", label: "Employee Type" },
                { key: "CATEGORY", label: "Category" },
                { key: "SHIFT", label: "Shift" },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className="inline-flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="rosterFilterType"
                    checked={filter.type === opt.key}
                    onChange={() => setFilter({ type: opt.key, value: "" })}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            {filter.type !== "NONE" && (
              <div className="mt-3 space-y-2 max-h-36 overflow-y-auto pr-1">
                {filter.type === "DEPARTMENT" &&
                  departments.map((d) => {
                    const checked = selDepts.includes(String(d.id));
                    return (
                      <label key={d.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelDepts((prev) =>
                              checked
                                ? prev.filter((x) => x !== String(d.id))
                                : [...prev, String(d.id)],
                            )
                          }
                        />
                        <span className="text-sm">{d.dept_name}</span>
                      </label>
                    );
                  })}
                {filter.type === "LOCATION" &&
                  locations.map((l) => {
                    const checked = selLocs.includes(String(l.id));
                    return (
                      <label key={l.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelLocs((prev) =>
                              checked
                                ? prev.filter((x) => x !== String(l.id))
                                : [...prev, String(l.id)],
                            )
                          }
                        />
                        <span className="text-sm">{l.location_name}</span>
                      </label>
                    );
                  })}
                {filter.type === "EMPLOYMENT_TYPE" &&
                  employmentTypes.map((t) => {
                    const checked = selEmpTypes.includes(String(t.id));
                    return (
                      <label key={t.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelEmpTypes((prev) =>
                              checked
                                ? prev.filter((x) => x !== String(t.id))
                                : [...prev, String(t.id)],
                            )
                          }
                        />
                        <span className="text-sm">{t.name}</span>
                      </label>
                    );
                  })}
                {filter.type === "CATEGORY" &&
                  categories.map((c) => {
                    const checked = selCats.includes(String(c.id));
                    return (
                      <label key={c.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelCats((prev) =>
                              checked
                                ? prev.filter((x) => x !== String(c.id))
                                : [...prev, String(c.id)],
                            )
                          }
                        />
                        <span className="text-sm">{c.name}</span>
                      </label>
                    );
                  })}
                {filter.type === "SHIFT" &&
                  shifts.map((s) => {
                    const checked = selShifts.includes(String(s.id));
                    return (
                      <label key={s.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelShifts((prev) =>
                              checked
                                ? prev.filter((x) => x !== String(s.id))
                                : [...prev, String(s.id)],
                            )
                          }
                        />
                        <span className="text-sm">
                          {s.name}{" "}
                          <span className="text-xs text-slate-500">
                            ({s.code})
                          </span>
                        </span>
                      </label>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="hidden"></div>

          <div className="grid grid-cols-2 gap-3 mb-4 border-b border-slate-200 dark:border-slate-700 pb-4">
            <div className="col-span-2">
              <label className="label text-xs">Employee</label>
              <button
                type="button"
                className="input text-sm flex items-center justify-between"
                onClick={() => setShowEmpOverlay(true)}
              >
                <span>
                  {draftForm.employee_id
                    ? (() => {
                        const e = employees.find(
                          (x) => String(x.id) === String(draftForm.employee_id),
                        );
                        return e
                          ? `${e.first_name} ${e.last_name} (${e.emp_code})`
                          : "Select Employee...";
                      })()
                    : "Select Employee..."}
                </span>
                <span className="text-xs text-slate-500">Open Selector</span>
              </button>
            </div>
            <div className="col-span-2">
              <label className="label text-xs">Leave Type</label>
              <select
                className="input text-sm"
                value={draftForm.leave_type_id}
                onChange={(e) =>
                  setDraftForm({ ...draftForm, leave_type_id: e.target.value })
                }
              >
                <option value="">Select Type...</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.type_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs">Start Date</label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  className="input text-sm"
                  value={startSel.year}
                  onChange={(e) =>
                    setStartSel({ ...startSel, year: e.target.value, day: "" })
                  }
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  className="input text-sm"
                  value={startSel.month}
                  onChange={(e) =>
                    setStartSel({ ...startSel, month: e.target.value, day: "" })
                  }
                >
                  <option value="">MM</option>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="input text-sm"
                  value={startSel.day}
                  onChange={(e) =>
                    setStartSel({ ...startSel, day: e.target.value })
                  }
                >
                  <option value="">DD</option>
                  {startDays.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label text-xs">End Date</label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  className="input text-sm"
                  value={endSel.year}
                  onChange={(e) =>
                    setEndSel({ ...endSel, year: e.target.value, day: "" })
                  }
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  className="input text-sm"
                  value={endSel.month}
                  onChange={(e) =>
                    setEndSel({ ...endSel, month: e.target.value, day: "" })
                  }
                >
                  <option value="">MM</option>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="input text-sm"
                  value={endSel.day}
                  onChange={(e) =>
                    setEndSel({ ...endSel, day: e.target.value })
                  }
                >
                  <option value="">DD</option>
                  {endDays.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="col-span-2 mt-2">
              <button
                type="button"
                onClick={handleAddDraft}
                className="btn-secondary w-full border-dashed border-2"
              >
                Add to Drafts
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {drafts.length === 0 ? (
              <div className="text-center text-slate-400 text-sm mt-8">
                No drafts. Add an entry or generate a department.
              </div>
            ) : (
              <ul className="space-y-2">
                {drafts.map((d, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-sm relative group"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {d.employee_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {d.type_name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="input bg-white dark:bg-slate-800 px-2 py-1 h-8 w-32 text-xs"
                        value={d.start_date}
                        onChange={(e) => {
                          const newD = [...drafts];
                          newD[i].start_date = e.target.value;
                          setDrafts(newD);
                        }}
                      />
                      <span className="text-slate-400">to</span>
                      <input
                        type="date"
                        className="input bg-white dark:bg-slate-800 px-2 py-1 h-8 w-32 text-xs"
                        value={d.end_date}
                        onChange={(e) => {
                          const newD = [...drafts];
                          newD[i].end_date = e.target.value;
                          setDrafts(newD);
                        }}
                      />
                      <button
                        onClick={() =>
                          setDrafts(drafts.filter((_, idx) => idx !== i))
                        }
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-4 mt-auto border-t border-slate-200 dark:border-slate-700">
            <button
              className="btn-primary w-full"
              onClick={submitRoster}
              disabled={loading || !drafts.length}
            >
              {loading ? "Saving..." : `Save ${drafts.length} Drafts to Roster`}
            </button>
          </div>
        </div>

        {showEmpOverlay && (
          <div className="fixed inset-0 bg-black/30 z-50 flex">
            <div className="m-auto w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">Select Employee</div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEmpOverlay(false)}
                >
                  Done
                </button>
              </div>
              <div className="h-80 overflow-y-auto">
                {filteredEmployees.map((e) => {
                  const selected =
                    String(draftForm.employee_id) === String(e.id);
                  return (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    >
                      <input
                        type="radio"
                        name="rosterEmployee"
                        checked={selected}
                        onChange={() =>
                          setDraftForm({
                            ...draftForm,
                            employee_id: String(e.id),
                          })
                        }
                      />
                      <span className="text-sm">
                        {e.first_name} {e.last_name}{" "}
                        <span className="text-xs text-slate-500">
                          ({e.emp_code})
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Right: Existing Roster View */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Saved Roster Records
            </h2>
            <div className="text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded">
              {activeRecords.length} Active / {overriddenRecords.length}{" "}
              Overridden
            </div>
          </div>

          <div className="overflow-x-auto flex-1 h-full overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
                <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Employee</th>
                  <th className="p-4 font-medium">Dates</th>
                  <th className="p-4 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-500">
                      No roster records found for {year}.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${r.status === "OVERRIDDEN" ? "opacity-60 grayscale" : ""}`}
                    >
                      <td className="p-4 font-medium dark:text-slate-200">
                        {r.first_name} {r.last_name}
                        <div className="text-xs font-normal text-slate-400">
                          {r.type_name}
                        </div>
                      </td>
                      <td className="p-4 dark:text-slate-300">
                        {r.start_date.slice(0, 10)} <br />
                        <span className="text-slate-400">to</span>{" "}
                        {r.end_date.slice(0, 10)}
                      </td>
                      <td className="p-4 text-right">
                        {r.status === "ACTIVE" ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400 uppercase">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase">
                            Overridden
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
