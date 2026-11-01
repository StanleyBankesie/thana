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
  const [componentDefs, setComponentDefs] = useState([]);
  const [form, setForm] = useState({ 
    tax_name: '', 
    tax_type: 'INCOME_TAX', 
    min_amount: 0, 
    max_amount: '', 
    tax_rate: 0, 
    fixed_amount: 0, 
    employee_contribution_rate: 0,
    employer_contribution_rate: 0,
    base_component: 'BASIC',
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
        const [alwRes, compDefRes] = await Promise.all([
          api.get("/hr/allowances").catch(() => ({ data: { items: [] } })),
          api.get("/hr/salary-component-definitions").catch(() => ({ data: { items: [] } })),
        ]);
        setAllowances(alwRes.data.items || []);
        const rawDefs = compDefRes.data?.items || compDefRes.data || [];
        const earningDefs = rawDefs.filter(
          (c) =>
            c.component_type === "ALLOWANCE" ||
            c.component_type === "EARNING" ||
            c.component_type === "BENEFIT",
        );
        setComponentDefs(earningDefs);
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
            base_component: item.base_component || 'BASIC',
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

          {(form.tax_type === 'SOCIAL_SECURITY' || form.tax_type === 'PROVIDENCE_FUND' || form.tax_type === 'PROVIDENT_FUND') && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
              <h2 className="text-lg font-semibold border-b pb-2 text-brand">Fund Contribution Setup</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="label">Based On Salary Component *</label>
                  <select
                    className="input"
                    value={form.base_component || "BASIC"}
                    onChange={(e) => update("base_component", e.target.value)}
                  >
                    <option value="BASIC">Basic Salary (Default)</option>
                    <option value="GROSS">Gross Salary (Basic + Allowances)</option>
                    <option value="ALLOWANCES">Total Allowances</option>
                    {componentDefs
                      .filter((c) => c.component_type === "ALLOWANCE")
                      .map((c) => (
                        <option key={c.id} value={`CMP:${c.id}`}>
                          {c.component_name || c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="label">
                    Employee Contribution Rate (%)
                    <span className="text-xs text-slate-400 font-normal ml-1">
                      (% of {form.base_component === "GROSS" ? "Gross Salary" : form.base_component === "ALLOWANCES" ? "Total Allowances" : (componentDefs.find(c => `CMP:${c.id}` === form.base_component)?.component_name || "Basic Salary")})
                    </span>
                  </label>
                  <input 
                    className="input font-mono" 
                    type="number"
                    step="0.01"
                    value={form.employee_contribution_rate} 
                    onChange={(e) => update('employee_contribution_rate', e.target.value)} 
                  />

                  {(form.tax_type === 'PROVIDENCE_FUND' || form.tax_type === 'PROVIDENT_FUND') && Number(form.employee_contribution_rate) > 16.5 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium block mt-1">
                      ⚠️ 16.5% is tax-exempt. The remaining {(Number(form.employee_contribution_rate) - 16.5).toFixed(2)}% above 16.5% will be taxable under PAYE.
                    </span>
                  )}
                </div>
                <div>
                  <label className="label">
                    Employer Contribution Rate (%)
                    <span className="text-xs text-slate-400 font-normal ml-1">
                      (% of {form.base_component === "GROSS" ? "Gross Salary" : form.base_component === "ALLOWANCES" ? "Total Allowances" : (componentDefs.find(c => `CMP:${c.id}` === form.base_component)?.component_name || "Basic Salary")})
                    </span>
                  </label>
                  <input 
                    className="input font-mono" 
                    type="number"
                    step="0.01"
                    value={form.employer_contribution_rate} 
                    onChange={(e) => update('employer_contribution_rate', e.target.value)} 
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 italic">Contributions are calculated as a percentage of the selected salary component. For Provident Fund (Tier 3), employee contributions up to 16.5% are tax-exempt; any remaining percentage above 16.5% is taxable under PAYE.</p>
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
                  <span>BASIC (Basic Salary)</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {componentDefs.map((c) => {
                    const key = `CMP:${c.id}`;
                    const checked =
                      form.taxable_components.includes(key) ||
                      form.taxable_components.includes(c.component_name) ||
                      form.taxable_components.includes(c.name) ||
                      (form.taxable_components.includes("ALLOWANCES") && c.is_taxable !== false);

                    return (
                      <label key={c.id} className="inline-flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const set = new Set(form.taxable_components);
                            if (e.target.checked) {
                              set.add(key);
                            } else {
                              set.delete(key);
                              set.delete(c.component_name);
                              set.delete(c.name);
                              set.delete("ALLOWANCES");
                            }
                            update("taxable_components", Array.from(set));
                          }}
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{c.component_name || c.name}</span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">
                            {c.component_type || "Allowance"}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                  {allowances.map(a => {
                    const key = `ALLOWANCE:${a.id}`;
                    const checked = form.taxable_components.includes(key);
                    return (
                      <label key={a.id} className="inline-flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const set = new Set(form.taxable_components);
                            if (e.target.checked) set.add(key); else set.delete(key);
                            update('taxable_components', Array.from(set));
                          }}
                        />
                        <span className="text-sm">{a.allowance_name}</span>
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







