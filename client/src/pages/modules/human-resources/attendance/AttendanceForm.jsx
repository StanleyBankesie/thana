/**
 * @fileoverview AttendanceForm component.
 * Provides functionality for AttendanceForm.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { filterAndSort } from "../../../../utils/searchUtils.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function AttendanceForm({ isOpen = true, onClose, onSuccess, attendanceId }) {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const id = attendanceId || paramId;
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    employee_id: '',
    attendance_date: new Date().toISOString().split('T')[0],
    status: 'PRESENT',
  });

  const handleClose = () => {
    if (onClose) onClose();
    else navigate('/human-resources/attendance');
  };

  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await api.get("/hr/employees");
        setEmployees(res.data?.items || []);
      } catch {}
    }
    loadEmployees();

    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/hr/attendance/${id}`);
        const item = res.data?.item;
        if (item) {
          setForm({
            ...item,
            attendance_date: item.attendance_date ? item.attendance_date.slice(0, 10) : ''
          });
        }
      } catch {
        toast.error("Failed to load attendance");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.employee_id) {
      toast.error("Please select an employee");
      return;
    }
    setLoading(true);
    try {
      await api.post('/hr/attendance', form);
      toast.success(isEdit ? "Attendance updated" : "Attendance marked");
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>⏰</span> {isEdit ? 'Edit Attendance Entry' : 'New Attendance Entry'}
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-semibold leading-none p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={submit} className="p-6 space-y-5 overflow-y-auto">
          <div>
            <label className="label font-semibold text-xs uppercase tracking-wider text-slate-500 mb-1 block">Employee *</label>
            <select
              className="input text-sm"
              value={form.employee_id}
              onChange={(e) => update('employee_id', e.target.value)}
              required
            >
              <option value="">-- Select Employee --</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label font-semibold text-xs uppercase tracking-wider text-slate-500 mb-1 block">Date *</label>
              <input className="input text-sm" type="date" value={form.attendance_date} onChange={(e) => update('attendance_date', e.target.value)} required 
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="label font-semibold text-xs uppercase tracking-wider text-slate-500 mb-1 block">Status</label>
              <select className="input text-sm" value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="LEAVE">Leave</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half Day</option>
              </select>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/60 mt-6">
            <button type="button" onClick={handleClose} className="btn-secondary text-sm">Cancel</button>
            <button className="btn-primary px-6 text-sm" type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}







