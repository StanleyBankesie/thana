/**
 * @fileoverview AllowanceForm component.
 * Provides functionality for AllowanceForm.
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
export default function AllowanceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [allowanceTypes, setAllowanceTypes] = useState([]);
  const [form, setForm] = useState({ 
    allowance_code: '', 
    allowance_name: '', 
    amount_type: 'FIXED', 
    amount: 0, 
    is_taxable: true, 
    is_active: true,
    affect_payslip: true
  });

  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await api.get("/hr/setup/allowance-types");
        setAllowanceTypes(res.data?.items || []);
      } catch {}
    }
    loadOptions();

    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/hr/allowances");
        const item = res.data.items.find(i => String(i.id) === String(id));
        if (item) {
          setForm({
            ...item,
            is_taxable: !!item.is_taxable,
            is_active: !!item.is_active,
            affect_payslip: !!item.affect_payslip
          });
        }
      } catch {
        toast.error("Failed to load allowance");
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
    
    // Auto-generate code if empty
    const payload = { ...form };
    if (!payload.allowance_code) {
      payload.allowance_code = `ALW-${Date.now()}`;
    }
    
    try {
      await api.post('/hr/allowances', payload);
      toast.success(isEdit ? "Updated successfully" : "Created successfully");
      navigate('/human-resources/allowances');
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
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Allowance' : 'New Allowance'}</h1>
          <button onClick={() => window.history.back()} className="btn-secondary">Back</button>
        </div>

        <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div>
              <label className="label">Allowance Name *</label>
              <select 
                className="input" 
                value={form.allowance_name} 
                onChange={(e) => update('allowance_name', e.target.value)} 
                required 
              >
                <option value="">-- Select Type --</option>
                {allowanceTypes.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount Type *</label>
              <select 
                className="input" 
                value={form.amount_type} 
                onChange={(e) => update('amount_type', e.target.value)}
                required
              >
                <option value="FIXED">Fixed Amount</option>
                <option value="PERCENTAGE">Percentage of Base Salary</option>
              </select>
            </div>
            <div>
              <label className="label">
                {form.amount_type === 'PERCENTAGE' ? 'Percentage (%) *' : 'Amount *'}
              </label>
              <div className="relative">
                <input 
                  className="input pr-8" 
                  type="number"
                  step="0.01"
                  value={form.amount} 
                  onChange={(e) => update('amount', e.target.value)} 
                  required 
                />
                {form.amount_type === 'PERCENTAGE' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">%</span>
                )}
              </div>
            </div>
            <div>
              <label className="label">Taxable</label>
              <select 
                className="input" 
                value={form.is_taxable ? '1' : '0'} 
                onChange={(e) => update('is_taxable', e.target.value === '1')}
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input 
                type="checkbox" 
                className="checkbox" 
                checked={form.affect_payslip} 
                onChange={e => update('affect_payslip', e.target.checked)}
              />
              <label className="text-sm font-medium">Affect Payslip?</label>
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

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => window.history.back()} className="btn-secondary">Cancel</button>
            <button className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Allowance'}
            </button>
          </div>
        </form>
      </div>
    </Guard>
  );
}







