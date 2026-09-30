/**
 * @fileoverview AttendanceList component.
 * Provides functionality for AttendanceList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import { filterAndSort } from "@/utils/searchUtils.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
import AttendanceForm from "./AttendanceForm.jsx";

export default function AttendanceList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeSuggestions, setShowEmployeeSuggestions] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { from_date: first, to_date: last, employee_id: "" };
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/attendance", { params: filters });
      setItems(res?.data?.items || []);
    } catch {
      toast.error("Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/hr/employees");
        setEmployees(res.data?.items || []);
      } catch {}
    };
    load();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters.from_date, filters.to_date, filters.employee_id]);

  const employeeSuggestions = useMemo(() => {
    const q = String(employeeSearch || "").trim().toLowerCase();
    if (!q) return [];
    return (employees || [])
      .filter((e) => {
        const fullName = `${e.first_name || ""} ${e.last_name || ""}`.toLowerCase();
        const code = String(e.emp_code || "").toLowerCase();
        return fullName.includes(q) || code.includes(q);
      })
      .slice(0, 8);
  }, [employees, employeeSearch]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedEmployeeId) {
      result = result.filter(
        (item) => String(item.employee_id) === String(selectedEmployeeId)
      );
    }
    if (employeeSearch.trim() && !selectedEmployeeId) {
      const q = employeeSearch.toLowerCase().trim();
      result = result.filter((item) => {
        const fn = String(item.first_name || "").toLowerCase();
        const ln = String(item.last_name || "").toLowerCase();
        const fullName = `${fn} ${ln}`;
        const code = String(item.emp_code || "").toLowerCase();
        const status = String(item.status || "").toLowerCase();
        return (
          fullName.includes(q) ||
          fn.includes(q) ||
          ln.includes(q) ||
          code.includes(q) ||
          status.includes(q)
        );
      });
    }
    return result;
  }, [items, employeeSearch, selectedEmployeeId]);

  return (
    <div className="space-y-4 p-4">
      {/* Modal */}
      {isModalOpen && (
        <AttendanceForm
          isOpen={isModalOpen}
          attendanceId={editingId}
          onClose={() => {
            setIsModalOpen(false);
            setEditingId(null);
          }}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            Back
          </button>
          <h2 className="text-lg font-semibold">Attendance Records</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingId(null);
              setIsModalOpen(true);
            }}
            className="btn-primary"
          >
            + New Entry
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <label className="text-xs font-medium text-slate-500 uppercase block mb-1">
                Employee Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="input pr-8 bg-white dark:bg-slate-800"
                  placeholder="Search by name or code..."
                  value={employeeSearch}
                  onFocus={() => setShowEmployeeSuggestions(true)}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value);
                    setSelectedEmployeeId("");
                    setFilters((prev) => ({ ...prev, employee_id: "" }));
                    setShowEmployeeSuggestions(true);
                  }}
                />
                {employeeSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeSearch("");
                      setSelectedEmployeeId("");
                      setFilters((prev) => ({ ...prev, employee_id: "" }));
                    }}
                    className="absolute right-2 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showEmployeeSuggestions && employeeSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto py-1">
                  {employeeSuggestions.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-brand/10 dark:hover:bg-slate-700/60 flex items-center justify-between transition-colors border-b border-slate-100 dark:border-slate-700/40 last:border-0"
                      onClick={() => {
                        const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim();
                        setEmployeeSearch(fullName);
                        setSelectedEmployeeId(emp.id);
                        setFilters((prev) => ({ ...prev, employee_id: emp.id }));
                        setShowEmployeeSuggestions(false);
                      }}
                    >
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {emp.first_name} {emp.last_name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {emp.dept_name ? `${emp.dept_name} • ` : ""}{emp.pos_name || "Employee"}
                        </div>
                      </div>
                      <span className="text-xs font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded text-brand">
                        {emp.emp_code || `#${emp.id}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase block mb-1">From Date</label>
              <input
                type="date"
                className="input bg-white dark:bg-slate-800"
                value={filters.from_date}
                onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase block mb-1">To Date</label>
              <input
                type="date"
                className="input bg-white dark:bg-slate-800"
                value={filters.to_date}
                onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
        <div className="overflow-x-auto">
          <table className={ "min-w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
            <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
              <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employee</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.first_name} {r.last_name}</div>
                    <div className="text-xs text-slate-500">{r.emp_code}</div>
                  </td>
                  <td className="px-4 py-2">{new Date(r.attendance_date).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${
                      r.status === 'PRESENT' ? 'badge-success' : 
                      r.status === 'ABSENT' ? 'badge-error' : 'badge-warning'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        setEditingId(r.id);
                        setIsModalOpen(true);
                      }}
                      className="text-brand hover:underline text-sm font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-500">No records found for selected filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}







