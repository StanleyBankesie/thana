/**
 * @fileoverview HRSetup component.
 * Provides functionality for HRSetup.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../hooks/usePermissions.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function HRSetup() {
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  
  const getTabFromLocation = useCallback(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) return tabParam;
    const path = location.pathname.toLowerCase();
    if (path.includes("/departments")) return "departments";
    if (path.includes("/designations") || path.includes("/job-roles")) return "positions";
    if (path.includes("/branches") || path.includes("/locations")) return "locations";
    if (path.includes("/shifts")) return "shifts";
    if (path.includes("/leave-types") || path.includes("/leave-setup")) return "leave-types";
    return "departments";
  }, [location.pathname, searchParams]);

  const [activeTab, setActiveTab] = useState(getTabFromLocation());

  useEffect(() => {
    setActiveTab(getTabFromLocation());
  }, [location.pathname, location.search, getTabFromLocation]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [form, setForm] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  const shiftTotalHours = useMemo(() => {
    const toMins = (t) => {
      if (!t || typeof t !== "string") return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + (m || 0);
    };
    const start = toMins(form.start_time);
    const end = toMins(form.end_time);
    let diff = end - start;
    if (diff < 0) diff += 24 * 60;
    diff -= Number(form.break_minutes || 0);
    if (diff < 0) return "N/A";
    return `${Math.floor(diff / 60)}h ${String(diff % 60).padStart(2, "0")}m`;
  }, [form.start_time, form.end_time, form.break_minutes]);

  const filteredAccounts = useMemo(() => {
    const q = String(accountSearch || "")
      .trim()
      .toLowerCase();
    const postable = accounts.filter((a) => a.is_postable);
    if (!q) return postable;
    return postable.filter((a) => {
      const code = String(a.code || "").toLowerCase();
      const name = String(a.name || "").toLowerCase();
      const nature = String(a.nature || "").toLowerCase();
      return code.includes(q) || name.includes(q) || nature.includes(q);
    });
  }, [accounts, accountSearch]);

  const extractItems = (res) => {
    if (!res) return [];
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.items)) return res.data.items;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.data?.data?.items)) return res.data.data.items;
    return [];
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let endpoint = "";
      if (activeTab === "departments") endpoint = "/hr/departments";
      else if (activeTab === "positions") endpoint = "/hr/positions";
      else if (activeTab === "locations") endpoint = "/hr/setup/locations";
      else if (activeTab === "leave-types") endpoint = "/hr/leave/types";
      else if (activeTab === "payroll-periods")
        endpoint = "/hr/payroll/periods";
      else if (activeTab === "employment-types")
        endpoint = "/hr/setup/employment-types";
      else if (activeTab === "employee-categories")
        endpoint = "/hr/setup/employee-categories";
      else if (activeTab === "allowance-types")
        endpoint = "/hr/setup/allowance-types";
      else if (activeTab === "loan-types") endpoint = "/hr/loan-types";
      else if (activeTab === "shifts") endpoint = "/hr/shifts";
      else if (activeTab === "parameters") endpoint = "/hr/setup/parameters";
      else if (activeTab === "salary-mapping")
        endpoint = "/hr/salary-components";

      let res = null;
      try {
        res = await api.get(endpoint);
      } catch {
        if (activeTab === "departments") {
          res = await api.get("/admin/departments").catch(() => null);
        }
      }

      if (activeTab === "parameters") {
        setItems([]);
        const params = extractItems(res);
        const formObj = {};
        params.forEach((p) => {
          if (p?.param_key) formObj[p.param_key] = p.param_value;
        });
        setForm(formObj);
      } else if (activeTab === "salary-mapping") {
        setItems(extractItems(res));
        if (accounts.length === 0) {
          try {
            const accRes = await api.get("/finance/reports/chart-of-accounts");
            setAccounts(extractItems(accRes));
          } catch {}
        }
      } else {
        setItems(extractItems(res));
      }
    } catch (err) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setForm({});
    setIsEditing(false);
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let endpoint = "";
      if (activeTab === "departments") endpoint = "/hr/departments";
      else if (activeTab === "positions") endpoint = "/hr/positions";
      else if (activeTab === "locations") endpoint = "/hr/setup/locations";
      else if (activeTab === "leave-types") endpoint = "/hr/leave/types";
      else if (activeTab === "payroll-periods")
        endpoint = "/hr/payroll/periods";
      else if (activeTab === "employment-types")
        endpoint = "/hr/setup/employment-types";
      else if (activeTab === "employee-categories")
        endpoint = "/hr/setup/employee-categories";
      else if (activeTab === "allowance-types")
        endpoint = "/hr/setup/allowance-types";
      else if (activeTab === "loan-types") endpoint = "/hr/loan-types";
      else if (activeTab === "shifts") endpoint = "/hr/shifts";

      const payload = {
        ...form,
        dept_name: form.dept_name || form.name,
        dept_code: form.dept_code || form.code,
        name: form.name || form.dept_name || form.pos_name || form.location_name || form.type_name,
        code: form.code || form.dept_code || form.pos_code,
        pos_name: form.pos_name || form.name,
        pos_code: form.pos_code || form.code,
        location_name: form.location_name || form.name,
        type_name: form.type_name || form.name,
        days_per_year: form.days_per_year || form.max_days,
        max_days: form.max_days || form.days_per_year,
      };

      if (activeTab === "departments" || activeTab === "shifts") {
        if (isEditing && form.id) {
          await api.put(`${endpoint}/${form.id}`, payload);
        } else {
          await api.post(endpoint, payload);
        }
      } else if (activeTab === "parameters") {
        endpoint = "/hr/setup/parameters";
        await api.post(endpoint, { parameters: form });
        toast.success("Parameters saved");
        loadData();
        return;
      } else {
        await api.post(endpoint, payload);
      }

      toast.success("Saved successfully");
      setForm({});
      setIsEditing(false);
      loadData();
    } catch (err) {
      toast.error("Failed to save");
    }
  };

  const handleEdit = (item) => {
    setForm(item);
    setIsEditing(true);
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            Back to Menu
          </button>
          <h2 className="text-lg font-semibold">HR Setup & Parameters</h2>
        </div>

        <div className="flex border-b mb-6 overflow-x-auto">
          {[
            { id: "locations", label: "Branches" },
            { id: "departments", label: "Departments" },
            { id: "positions", label: "Job Roles Setup" },
            { id: "shifts", label: "Shifts" },
            { id: "leave-types", label: "Leave Types" },
            { id: "payroll-periods", label: "Payroll Periods" },
            { id: "employment-types", label: "Employment Types" },
            { id: "employee-categories", label: "Employee Categories" },
            { id: "allowance-types", label: "Allowance Types" },
            { id: "loan-types", label: "Loan Types" },
            { id: "parameters", label: "Parameters" },
            { id: "salary-mapping", label: "Salary Mapping" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-b-2 border-brand text-brand"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
              <h3 className="font-medium mb-4">
                {activeTab === "salary-mapping"
                  ? "Salary Component Account Mapping"
                  : activeTab === "parameters"
                    ? "Update Settings"
                    : (isEditing ? "Edit" : "Add New") +
                      " " +
                      activeTab.replace("-", " ")}
              </h3>

              {activeTab === "salary-mapping" ? (
                <div className="text-sm text-slate-500 mb-4">
                  Map each salary component to a general ledger account for
                  payroll journal entries.
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {activeTab === "shifts" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">Code</label>
                        <input
                          className="input"
                          value={form.code || ""}
                          onChange={(e) =>
                            setForm({ ...form, code: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Name</label>
                        <input
                          className="input"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm mb-1">
                            Start Time
                          </label>
                          <input
                            className="input"
                            type="time"
                            value={form.start_time || ""}
                            onChange={(e) =>
                              setForm({ ...form, start_time: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">End Time</label>
                          <input
                            className="input"
                            type="time"
                            value={form.end_time || ""}
                            onChange={(e) =>
                              setForm({ ...form, end_time: e.target.value })
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm mb-1">
                            Break Minutes
                          </label>
                          <input
                            className="input"
                            type="number"
                            value={form.break_minutes || 0}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                break_minutes: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">
                            Total Hours
                          </label>
                          <input
                            className="input"
                            type="text"
                            value={(() => {
                              const toMin = (t) => {
                                if (!t) return 0;
                                const [hh, mm] = String(t)
                                  .split(":")
                                  .map(Number);
                                return (hh % 24) * 60 + (mm || 0);
                              };
                              const s = toMin(form.start_time);
                              const e = toMin(form.end_time);
                              let d = e - s;
                              if (d < 0) d += 24 * 60;
                              d -= Number(form.break_minutes || 0);
                              const h = Math.max(0, d) / 60;
                              return isFinite(h) ? h.toFixed(2) : "0.00";
                            })()}
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Status</label>
                          <select
                            className="input"
                            value={form.is_active ? "1" : "0"}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                is_active: e.target.value === "1",
                              })
                            }
                          >
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                  {activeTab === "departments" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">Code</label>
                        <input
                          className="input"
                          value={form.code || ""}
                          onChange={(e) =>
                            setForm({ ...form, code: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Name</label>
                        <input
                          className="input"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "locations" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">
                          Location Name
                        </label>
                        <input
                          className="input"
                          value={form.location_name || ""}
                          onChange={(e) =>
                            setForm({ ...form, location_name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Address</label>
                        <textarea
                          className="input"
                          value={form.address || ""}
                          onChange={(e) =>
                            setForm({ ...form, address: e.target.value })
                          }
                          rows="2"
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "positions" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">Code</label>
                        <input
                          className="input"
                          value={form.pos_code || ""}
                          onChange={(e) =>
                            setForm({ ...form, pos_code: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Name</label>
                        <input
                          className="input"
                          value={form.pos_name || ""}
                          onChange={(e) =>
                            setForm({ ...form, pos_name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Reports To (Position)
                        </label>
                        <select
                          className="input"
                          value={form.reports_to_pos_id || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              reports_to_pos_id: e.target.value,
                            })
                          }
                        >
                          <option value="">-- None --</option>
                          {items
                            .filter((p) => !form.id || p.id !== form.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.pos_name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </>
                  )}
                  {activeTab === "leave-types" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">Type Name</label>
                        <input
                          className="input"
                          value={form.type_name || ""}
                          onChange={(e) =>
                            setForm({ ...form, type_name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Days Per Year
                        </label>
                        <input
                          className="input"
                          type="number"
                          value={form.max_days || ""}
                          onChange={(e) =>
                            setForm({ ...form, max_days: Number(e.target.value) })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "payroll-periods" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">
                          Period Name
                        </label>
                        <input
                          className="input"
                          placeholder="e.g. March 2026"
                          value={form.period_name || ""}
                          onChange={(e) =>
                            setForm({ ...form, period_name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Start Date</label>
                        <input
                          className="input"
                          type="date"
                          value={form.start_date || ""}
                          onChange={(e) =>
                            setForm({ ...form, start_date: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">End Date</label>
                        <input
                          className="input"
                          type="date"
                          value={form.end_date || ""}
                          onChange={(e) =>
                            setForm({ ...form, end_date: e.target.value })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "employment-types" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">Type Name</label>
                        <input
                          className="input"
                          placeholder="e.g. Full-Time, Contract"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "employee-categories" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">
                          Category Name
                        </label>
                        <input
                          className="input"
                          placeholder="e.g. Management, Staff"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "allowance-types" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">
                          Allowance Name
                        </label>
                        <input
                          className="input"
                          placeholder="e.g. Transport, Housing"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  {activeTab === "loan-types" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">
                          Loan Type Name
                        </label>
                        <input
                          className="input"
                          placeholder="e.g. Salary Advance, Personal Loan"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Status</label>
                        <select
                          className="input"
                          value={form.is_active ? "1" : "0"}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              is_active: e.target.value === "1",
                            })
                          }
                        >
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
                        </select>
                      </div>
                    </>
                  )}
                  {activeTab === "shifts" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1">
                          Shift Code *
                        </label>
                        <input
                          className="input"
                          placeholder="e.g. DAY, NIGHT"
                          value={form.code || ""}
                          onChange={(e) =>
                            setForm({ ...form, code: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Shift Name *
                        </label>
                        <input
                          className="input"
                          placeholder="e.g. Standard Day Shift"
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Start Time *
                        </label>
                        <input
                          className="input"
                          type="time"
                          value={form.start_time || "08:00"}
                          onChange={(e) =>
                            setForm({ ...form, start_time: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">End Time *</label>
                        <input
                          className="input"
                          type="time"
                          value={form.end_time || "17:00"}
                          onChange={(e) =>
                            setForm({ ...form, end_time: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Break Minutes
                        </label>
                        <input
                          className="input"
                          type="number"
                          value={form.break_minutes ?? 60}
                          onChange={(e) =>
                            setForm({ ...form, break_minutes: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Total Hours
                        </label>
                        <div className="input bg-slate-50 dark:bg-slate-900/50 font-semibold text-brand">
                          {shiftTotalHours}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Status</label>
                        <select
                          className="input"
                          value={form.is_active ? "1" : "0"}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              is_active: e.target.value === "1",
                            })
                          }
                        >
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
                        </select>
                      </div>
                    </>
                  )}
                  {activeTab === "parameters" && (
                    <>
                      <div>
                        <label className="block text-sm mb-1 font-semibold">
                          Regular Working Hours (Daily)
                        </label>
                        <input
                          className="input"
                          type="number"
                          step="0.5"
                          value={form.REGULAR_WORKING_HOURS || "8"}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              REGULAR_WORKING_HOURS: e.target.value,
                            })
                          }
                          required
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Used for OT calculations in timesheets.
                        </p>
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary flex-1">
                      Save
                    </button>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm({});
                          setIsEditing(false);
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* List Section */}
          <div className="lg:col-span-2">
            {activeTab === "salary-mapping" ? (
              <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                  <input
                    className="input w-full md:max-w-sm"
                    placeholder="Search by code, name, nature..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                  />
                </div>
                <table className="min-w-full">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr className="text-left font-bold text-xs text-slate-500 uppercase">
                      <th className="px-4 py-3">Component</th>
                      <th className="px-4 py-3">Finance Account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.column_name}
                        className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div className="font-medium">{item.label}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.column_name} • {item.component_type}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            className="input text-sm"
                            value={item.account_id || ""}
                            onChange={async (e) => {
                              const newAccountId = e.target.value;
                              try {
                                await api.post(
                                  "/hr/salary-components/map-account",
                                  {
                                    ...(item.id
                                      ? { componentId: item.id }
                                      : { columnName: item.column_name }),
                                    accountId: newAccountId || null,
                                  },
                                );
                                toast.success(`${item.label} mapping updated`);
                                // Update local state for immediate feedback
                                setItems(
                                  items.map((it) =>
                                    it.column_name === item.column_name
                                      ? { ...it, account_id: newAccountId }
                                      : it,
                                  ),
                                );
                              } catch {
                                toast.error("Failed to update mapping");
                              }
                            }}
                          >
                            <option value="">-- No Account Linked --</option>
                            {filteredAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name}
                                {acc.nature ? ` (${acc.nature})` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && !loading && (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-4 py-8 text-center text-slate-500"
                        >
                          No salary components found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              activeTab !== "parameters" && (
                <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                      <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Details
                        </th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-4 py-2">
                            {activeTab === "shifts" && (
                              <div>
                                <div className="font-medium">
                                  {item.name}{" "}
                                  <span className="text-xs text-slate-500">
                                    ({item.code})
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {item.start_time} - {item.end_time} •{" "}
                                  {(() => {
                                    const toMin = (t) => {
                                      if (!t) return 0;
                                      const [hh, mm] = String(t)
                                        .split(":")
                                        .map(Number);
                                      return (hh % 24) * 60 + (mm || 0);
                                    };
                                    const s = toMin(item.start_time);
                                    const e = toMin(item.end_time);
                                    let d = e - s;
                                    if (d < 0) d += 24 * 60;
                                    d -= Number(item.break_minutes || 0);
                                    const h = Math.max(0, d) / 60;
                                    return `${isFinite(h) ? h.toFixed(2) : "0.00"} hrs`;
                                  })()}{" "}
                                  {item.break_minutes
                                    ? `• Break ${item.break_minutes} min`
                                    : ""}
                                </div>
                              </div>
                            )}
                            {activeTab === "locations" && (
                              <div>
                                <div className="font-medium">
                                  {item.location_name || item.name || item.title || "Unnamed Location"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {item.address || "No address specified"}
                                </div>
                              </div>
                            )}
                            {activeTab === "departments" && (
                              <div>
                                <div className="font-medium">{item.dept_name || item.name || item.title || "Unnamed Department"}</div>
                                <div className="text-xs text-slate-500">
                                  {item.dept_code || item.code || "—"}
                                </div>
                              </div>
                            )}
                            {activeTab === "positions" && (
                              <div>
                                <div className="font-medium">
                                  {item.pos_name || item.name || item.title || "Unnamed Position"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Code: {item.pos_code || item.code || "—"} {item.parent_pos_name ? `• Reports to: ${item.parent_pos_name}` : ""} {item.dept_name ? `• Dept: ${item.dept_name}` : ""}
                                </div>
                              </div>
                            )}
                            {activeTab === "leave-types" && (
                              <div>
                                <div className="font-medium">
                                  {item.type_name || item.name || item.leave_type || "Unnamed Leave Type"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {item.days_per_year ?? item.max_days ?? 0} days/year
                                </div>
                              </div>
                            )}
                            {activeTab === "payroll-periods" && (
                              <div>
                                <div className="font-medium">
                                  {item.period_name || item.name || "Unnamed Period"}
                                </div>
                                {(item.start_date || item.end_date) && (
                                  <div className="text-xs text-slate-500">
                                    {item.start_date ? String(item.start_date).split("T")[0] : "—"} to{" "}
                                    {item.end_date ? String(item.end_date).split("T")[0] : "—"}
                                  </div>
                                )}
                              </div>
                            )}
                            {(activeTab === "employment-types" ||
                              activeTab === "employee-categories" ||
                              activeTab === "allowance-types" ||
                              activeTab === "loan-types") && (
                              <div>
                                <div className="font-medium">{item.name || item.type_name || item.category_name || item.allowance_name || item.loan_type_name || "Unnamed Record"}</div>
                                {(item.code || item.type_code) && (
                                  <div className="text-xs text-slate-500">{item.code || item.type_code}</div>
                                )}
                              </div>
                            )}
                            {activeTab === "shifts" && (
                              <div>
                                <div className="font-medium">
                                  {item.name || item.shift_name || "Unnamed Shift"}{" "}
                                  <span className="font-mono text-xs text-slate-500">
                                    ({item.code || item.shift_code || "—"})
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {item.start_time || "08:00"} – {item.end_time || "17:00"}{" "}
                                  &nbsp;|&nbsp; Break: {item.break_minutes ?? 60}min
                                  &nbsp;|&nbsp;{" "}
                                  {item.is_active !== false && item.is_active !== 0 ? (
                                    <span className="text-emerald-600 font-medium">
                                      Active
                                    </span>
                                  ) : (
                                    <span className="text-red-500">
                                      Inactive
                                    </span>
                                  )}
                                 </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-brand text-sm hover:underline"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && !loading && (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-4 py-8 text-center text-slate-500"
                          >
                            No records found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            )}
            {activeTab === "parameters" && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded border border-blue-100 dark:border-blue-800/30 text-blue-700 dark:text-blue-300">
                <h4 className="font-semibold mb-2">About Parameters</h4>
                <p className="text-sm">
                  These settings control module-wide calculations. For example,
                  "Regular Working Hours" defines the threshold above which
                  hours are considered Overtime (OT) in the Timesheet module.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Guard>
  );
}
