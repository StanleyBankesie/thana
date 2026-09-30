/**
 * @fileoverview SalaryConfigForm component.
 * Provides functionality for SalaryConfigForm.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SalaryConfigForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    name: '', 
    description: '', 
    is_active: true 
  });

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/hr/salary-structures");
        const item = res.data.items.find(i => String(i.id) === String(id));
        if (item) {
          setForm({
            ...item,
            is_active: !!item.is_active
          });
        }
      } catch {
        toast.error("Failed to load salary structure");
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
    setLoading(true);
    try {
      await api.post('/hr/salary-structures', form);
      toast.success(isEdit ? "Updated successfully" : "Created successfully");
      navigate('/human-resources/salary-config');
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Salary Config' : 'New Salary Config'}</h1>
          <button onClick={() => window.history.back()} className="btn-secondary">Back</button>
        </div>

        <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Name *</label>
              <input 
                className="input" 
                value={form.name} 
                onChange={(e) => update('name', e.target.value)} 
                required 
                placeholder="e.g. Standard Monthly"
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select 
                className="input" 
                value={form.is_active ? '1' : '0'} 
                onChange={(e) => update('is_active', e.target.value === '1')}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea 
              className="input h-32" 
              value={form.description || ''} 
              onChange={(e) => update('description', e.target.value)}
              placeholder="Structure details, components, etc."
            />
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md space-y-3">
            <h2 className="text-lg font-semibold">Salary Components Calculation</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Basic salary plus selected allowances forms the gross salary component. Statutory deductions apply in this order:
            </p>
            <ol className="list-decimal ml-5 text-sm text-slate-700 dark:text-slate-200">
              <li>Compute taxable base from selected components.</li>
              <li>Apply income tax brackets (PAYE) to the taxable base.</li>
              <li>Apply SSNIT employee contribution on basic salary.</li>
              <li>Net salary equals basic + allowances − (PAYE + SSNIT + other deductions).</li>
            </ol>
            <p className="text-xs text-slate-500">All calculations use the base currency.</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => window.history.back()} className="btn-secondary">Cancel</button>
            <button className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Config'}
            </button>
          </div>
        </form>
      </div>
    </Guard>
  );
}







