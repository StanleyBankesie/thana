/**
 * @fileoverview OperatorList component.
 * Allows managing Machine Operators in Manufacturing Setup.
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2,
  Users,
  Cpu,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function OperatorList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [machines, setMachines] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentOperator, setCurrentOperator] = useState({
    operator_name: "",
    employee_code: "",
    machine_id: "",
    shift_id: "",
    is_active: true
  });

  const fetchData = async () => {
    try {
      const [opRes, macRes, shiftRes] = await Promise.all([
        api.get("/production/setup/operators"),
        api.get("/production/setup/machines"),
        api.get("/production/setup/shifts")
      ]);
      setItems(opRes.data?.items || []);
      setMachines(macRes.data?.items || []);
      setShifts(shiftRes.data?.items || []);
    } catch {
      toast.error("Failed to load machine operators");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentOperator.operator_name.trim()) {
      return toast.error("Operator Name is required");
    }
    setSaving(true);
    try {
      if (currentOperator.id) {
        await api.put(`/production/setup/operators/${currentOperator.id}`, currentOperator);
        toast.success("Machine operator updated");
      } else {
        await api.post("/production/setup/operators", currentOperator);
        toast.success("Machine operator created");
      }
      setShowModal(false);
      fetchData();
    } catch {
      toast.error("Failed to save operator");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this operator?")) return;
    try {
      await api.delete(`/production/setup/operators/${id}`);
      toast.success("Operator deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete operator");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="text-brand-600" size={22} /> Machine Operators Setup
          </h2>
          <p className="text-xs text-slate-500 font-medium">Configure operators and assign default work centers/shifts for job execution</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          <button 
            type="button"
            onClick={() => {
              setCurrentOperator({ operator_name: "", employee_code: "", machine_id: "", shift_id: "", is_active: true });
              setShowModal(true);
            }}
            className="btn btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus size={16} /> Add Machine Operator
          </button>
        </div>
      </div>

      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="overflow-x-auto">
          <table className={"w-full text-left text-xs " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="bg-brand-900 text-white dark:bg-brand-950 font-bold uppercase tracking-wider border-b border-brand-800">
              <tr>
                <th className="px-5 py-3">Operator Name</th>
                <th className="px-5 py-3">Emp Code</th>
                <th className="px-5 py-3">Assigned Work Center</th>
                <th className="px-5 py-3">Assigned Shift</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                    Loading machine operators...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((op) => {
                  const mac = machines.find(m => String(m.id) === String(op.machine_id));
                  const sh = shifts.find(s => String(s.id) === String(op.shift_id));
                  return (
                    <tr key={op.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                        {op.operator_name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-500">
                        {op.employee_code || "—"}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-600 dark:text-slate-300">
                        {mac ? mac.machine_name : (op.machine_name || "Any Work Center")}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-600 dark:text-slate-300">
                        {sh ? sh.shift_name : (op.shift_name || "All Shifts")}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          op.is_active !== false && op.is_active !== 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}>
                          {op.is_active !== false && op.is_active !== 0 ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {op.is_active !== false && op.is_active !== 0 ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentOperator(op);
                            setShowModal(true);
                          }}
                          className="btn btn-secondary text-xs p-1.5"
                          title="Edit Operator"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(op.id)}
                          className="btn btn-secondary text-xs p-1.5 text-red-600 hover:bg-red-50"
                          title="Delete Operator"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    No machine operators registered. Click "Add Machine Operator" above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 border border-slate-200 dark:border-slate-700">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck size={18} className="text-brand-600" />
                {currentOperator.id ? "Edit Machine Operator" : "Add Machine Operator"}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Operator Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe / Machine Operator 1"
                  className="input w-full font-bold"
                  value={currentOperator.operator_name}
                  onChange={(e) => setCurrentOperator({ ...currentOperator, operator_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Employee Code / Badge No
                </label>
                <input
                  type="text"
                  placeholder="e.g. EMP-1092"
                  className="input w-full font-mono"
                  value={currentOperator.employee_code || ""}
                  onChange={(e) => setCurrentOperator({ ...currentOperator, employee_code: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Cpu size={13} /> Default Machine
                  </label>
                  <select
                    className="input w-full font-bold"
                    value={currentOperator.machine_id || ""}
                    onChange={(e) => setCurrentOperator({ ...currentOperator, machine_id: e.target.value })}
                  >
                    <option value="">Any Machine</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>{m.machine_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Clock size={13} /> Default Shift
                  </label>
                  <select
                    className="input w-full font-bold"
                    value={currentOperator.shift_id || ""}
                    onChange={(e) => setCurrentOperator({ ...currentOperator, shift_id: e.target.value })}
                  >
                    <option value="">All Shifts</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.shift_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={currentOperator.is_active !== false && currentOperator.is_active !== 0}
                    onChange={(e) => setCurrentOperator({ ...currentOperator, is_active: e.target.checked })}
                  />
                  Active Operator Status
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-1.5"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {currentOperator.id ? "Update Operator" : "Save Operator"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
