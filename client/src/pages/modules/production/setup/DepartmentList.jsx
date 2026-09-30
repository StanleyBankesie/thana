/**
 * @fileoverview DepartmentList component.
 * Provides management for Production Departments set in Manufacturing Setup.
 * Features:
 * - Code system-populated & hidden from frontend modal.
 * - Active / Inactive status toggle button.
 * - Inactive departments are filtered out from the main frontend table.
 * - Tab to view Inactive / Archived departments with a "Reactivate" option.
 * - Delete button removed as requested.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import { Plus, Edit, Building2, ArrowLeft, Check, X, Eye, Power } from "lucide-react";

export default function DepartmentList() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [currentDept, setCurrentDept] = useState({ department_name: "", description: "", is_active: true });

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await api.get("/production/setup/departments");
      setDepartments(res.data?.items || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load production departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentDept.department_name.trim()) return toast.error("Department name is required");

    try {
      if (currentDept.id) {
        await api.put(`/production/setup/departments/${currentDept.id}`, currentDept);
        toast.success("Department updated successfully");
      } else {
        await api.post("/production/setup/departments", currentDept);
        toast.success("Department created successfully");
      }
      setShowModal(false);
      fetchDepartments();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save department");
    }
  };

  const handleToggleStatus = async (dept) => {
    const newStatus = !dept.is_active;
    try {
      await api.put(`/production/setup/departments/${dept.id}`, {
        ...dept,
        is_active: newStatus
      });
      toast.success(
        `Department "${dept.department_name}" set to ${newStatus ? "ACTIVE" : "INACTIVE"}`
      );
      fetchDepartments();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update status");
    }
  };

  // Filter visible departments: by default hide inactive items unless "Show Inactive" toggle is ON
  const visibleDepartments = departments.filter((d) => (showInactive ? true : !!d.is_active));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/production/setup" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Production Departments</h1>
            <p className="text-slate-500 text-sm">Configure manufacturing floor departments (Cutting, Machining, Assembly, QA, Staging)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`btn text-xs flex items-center gap-1.5 ${
              showInactive ? "btn-secondary bg-slate-200 dark:bg-slate-700" : "btn-secondary"
            }`}
            title="Toggle viewing inactive departments"
          >
            <Eye size={14} />
            {showInactive ? "Hide Inactive" : "Show Inactive"}
          </button>
          <button
            onClick={() => {
              setCurrentDept({ department_name: "", description: "", is_active: true });
              setShowModal(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Add Department
          </button>
        </div>
      </div>

      {/* Departments Table */}
      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 uppercase tracking-wider text-xs border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Department Name</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">Loading departments...</td>
                </tr>
              ) : visibleDepartments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">
                    <Building2 className="mx-auto mb-2 opacity-50" size={32} />
                    {showInactive ? "No production departments found." : "No active production departments configured."}
                  </td>
                </tr>
              ) : (
                visibleDepartments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-brand-900 dark:text-brand-300 flex items-center gap-2">
                      <Building2 size={16} className="text-brand-500" />
                      {dept.department_name}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{dept.code || "—"}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{dept.description || "—"}</td>
                    <td className="px-6 py-4">
                      {dept.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                          <Check size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400">
                          <X size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {/* Active / Inactive Toggle Button */}
                      <button
                        onClick={() => handleToggleStatus(dept)}
                        className={`btn p-1.5 text-xs font-bold ${
                          dept.is_active
                            ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                        }`}
                        title={dept.is_active ? "Set to Inactive" : "Set to Active"}
                      >
                        <Power size={14} className="inline mr-1" />
                        {dept.is_active ? "Deactivate" : "Activate"}
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => {
                          setCurrentDept(dept);
                          setShowModal(true);
                        }}
                        className="btn btn-secondary p-1.5 text-blue-600 hover:text-blue-700"
                        title="Edit Department"
                      >
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {currentDept.id ? "Edit Department" : "New Department"}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={currentDept.department_name}
                  onChange={(e) => setCurrentDept({ ...currentDept, department_name: e.target.value })}
                  placeholder="e.g. Cutting & Machining Dept"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows="3"
                  value={currentDept.description || ""}
                  onChange={(e) => setCurrentDept({ ...currentDept, description: e.target.value })}
                  placeholder="Details regarding operations performed in this department"
                  className="input w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="deptActive"
                  checked={!!currentDept.is_active}
                  onChange={(e) => setCurrentDept({ ...currentDept, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="deptActive" className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  Active Department
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
