/**
 * @fileoverview TaxConfigForm component.
 * Provides functionality for TaxConfigForm.
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
export default function TaxConfigForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [finTaxCodes, setFinTaxCodes] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [form, setForm] = useState({ 
    tax_name: '', 
    tax_type: 'INCOME_TAX', 
    min_amount: 0, 
    max_amount: '', 
    tax_rate: 0, 
    fixed_amount: 0, 
    employee_contribution_rate: 0,
    employer_contribution_rate: 0,
    is_active: true,
    taxable_components: []
  });

  useEffect(() => {
    async function loadTaxCodes() {
      try {
        const res = await api.get("/finance/setup/tax-codes"); // Assuming this endpoint exists
        setFinTaxCodes(res.data.items || []);
      } catch {}
    }
    loadTaxCodes();
    async function loadAllowances() {
      try {
        const res = await api.get("/hr/allowances");
        setAllowances(res.data.items || []);
      } catch {}
    }
    loadAllowances();

    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/hr/tax-configs");
        const item = res.data.items.find(i => String(i.id) === String(id));
        if (item) {
          setForm({
            ...item,
            max_amount: item.max_amount || '',
            is_active: !!item.is_active
          });
        }
      } catch {
        toast.error("Failed to load tax config");
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
      await api.post('/hr/tax-configs', form);
      toast.success(isEdit ? "Updated successfully" : "Created successfully");
      navigate('/human-resources/tax-config');
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
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Statutory Configuration' : 'New Statutory Configuration'}</h1>
          <button onClick={() => window.history.back()} className="btn-secondary">Back</button>
        </div>

        <form onSubmit={submit} className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Configuration Name *</label>
                <input 
                  className="input" 
                  value={form.tax_name} 
                  onChange={(e) => update('tax_name', e.target.value)} 
                  required 
                  placeholder="e.g. Income Tax Bracket 1, SSF Tier 1"
                />
              </div>
              <div>
                <label className="label">Statutory Type *</label>
                <select 
                  className="input" 
                  value={form.tax_type} 
                  onChange={(e) => update('tax_type', e.target.value)}
                  required
                >
                  <option value="INCOME_TAX">Income Tax</option>
                  <option value="SOCIAL_SECURITY">Social Security Fund (SSF)</option>
                  <option value="PROVIDENCE_FUND">Providence Fund (PF)</option>
                  <option value="OTHER">Other Deduction</option>
                  {finTaxCodes.map(tc => (
                    <option key={tc.id} value={tc.name}>{tc.name} ({tc.code})</option>
                  ))}
                </select>
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
          </div>

          {form.tax_type === 'INCOME_TAX' && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
              <h2 className="text-lg font-semibold border-b pb-2 text-brand">Income Tax Bracket Setup</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Min Taxable Amount *</label>
                  <input 
                    className="input" 
                    type="number"
                    step="0.01"
                    value={form.min_amount} 
                    onChange={(e) => update('min_amount', e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label className="label">Max Taxable Amount (Optional)</label>
                  <input 
                    className="input" 
                    type="number"
                    step="0.01"
                    value={form.max_amount} 
                    onChange={(e) => update('max_amount', e.target.value)} 
                    placeholder="Leave blank for no upper limit"
                  />
                </div>
                <div>
                  <label className="label">Tax Rate (%) *</label>
                  <input 
                    className="input" 
                    type="number"
                    step="0.01"
                    value={form.tax_rate} 
                    onChange={(e) => update('tax_rate', e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label className="label">Fixed Amount (Base Tax)</label>
                  <input 
                    className="input" 
                    type="number"
                    step="0.01"
                    value={form.fixed_amount} 
                    onChange={(e) => update('fixed_amount', e.target.value)} 
                  />
                </div>
              </div>
            </div>
          )}

          {(form.tax_type === 'SOCIAL_SECURITY' || form.tax_type === 'PROVIDENCE_FUND') && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
              <h2 className="text-lg font-semibold border-b pb-2 text-brand">Fund Contribution Setup</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Employee Contribution Rate (%)</label>
                  <input 
                    className="input font-mono" 
                    type="number"
                    step="0.01"
                    value={form.employee_contribution_rate} 
                    onChange={(e) => update('employee_contribution_rate', e.target.value)} 
                  />
                </div>
                <div>
                  <label className="label">Employer Contribution Rate (%)</label>
                  <input 
                    className="input font-mono" 
                    type="number"
                    step="0.01"
                    value={form.employer_contribution_rate} 
                    onChange={(e) => update('employer_contribution_rate', e.target.value)} 
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 italic">These rates will be applied to the employee's gross or base salary during payroll processing.</p>
            </div>
          )}
          {form.tax_type === 'INCOME_TAX' && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-4">
              <h2 className="text-lg font-semibold border-b pb-2">Taxable Salary Components</h2>
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.taxable_components.includes('BASIC')}
                    onChange={(e) => {
                      const set = new Set(form.taxable_components);
                      if (e.target.checked) set.add('BASIC'); else set.delete('BASIC');
                      update('taxable_components', Array.from(set));
                    }}
                  />
                  <span>BASIC</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {allowances.map(a => {
                    const key = `ALLOWANCE:${a.id}`;
                    const checked = form.taxable_components.includes(key);
                    return (
                      <label key={a.id} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const set = new Set(form.taxable_components);
                            if (e.target.checked) set.add(key); else set.delete(key);
                            update('taxable_components', Array.from(set));
                          }}
                        />
                        <span>{a.allowance_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => window.history.back()} className="btn-secondary">Cancel</button>
            <button className="btn-primary px-8" disabled={loading}>
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </Guard>
  );
}







