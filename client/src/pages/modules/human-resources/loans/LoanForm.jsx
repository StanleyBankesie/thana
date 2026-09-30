/**
 * @fileoverview LoanForm component.
 * Provides functionality for LoanForm.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LoanForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [form, setForm] = useState({ 
    employee_id: '', 
    loan_type: 'Personal Loan', 
    amount: 0, 
    interest_rate: 0, 
    repayment_period_months: 12, 
    monthly_installment: 0, 
    start_date: '', 
    amount_due: 0,
    end_date: '',
    status: 'PENDING',
    affect_payslip: true
  });

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const res = await api.get("/hr/employees");
        setEmployees(res.data.items || []);
      } catch {
        toast.error("Failed to load employees");
      }
    };
    loadEmployees();
    const loadLoanTypes = async () => {
      try {
        const res = await api.get("/hr/loan-types");
        setLoanTypes(res.data.items || []);
      } catch {
        // silent
      }
    };
    loadLoanTypes();

    if (!isEdit) return;
    const loadLoan = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/hr/loans?id=${id}`);
        // Ensure we find the right item since list endpoint is used
        const item = res.data.items?.find(i => String(i.id) === String(id));
        if (item) {
          setForm({
            ...item,
            start_date: item.start_date ? item.start_date.slice(0, 10) : '',
            end_date: item.end_date ? item.end_date.slice(0, 10) : ''
          });
        }
      } catch {
        toast.error("Failed to load loan details");
      } finally {
        setLoading(false);
      }
    };
    loadLoan();
  }, [id, isEdit]);

  // Auto-calculate monthly installment
  useEffect(() => {
    const amt = Number(form.amount) || 0;
    const rate = Number(form.interest_rate) || 0;
    const months = Number(form.repayment_period_months) || 1;
    
    const totalInterest = amt * (rate / 100);
    const totalRepayment = amt + totalInterest;
    const installment = totalRepayment / months;
    
    setForm(prev => ({ ...prev, monthly_installment: installment.toFixed(2) }));
  }, [form.amount, form.interest_rate, form.repayment_period_months]);

  // Calculate Amount Due and End Date
  useEffect(() => {
    const amt = Number(form.amount) || 0;
    const months = Number(form.repayment_period_months) || 1;
    const installment = Number(form.monthly_installment) || 0;
    const start = form.start_date;

    if (!start) {
      setForm(p => ({ ...p, end_date: '', amount_due: amt.toFixed(2) }));
      return;
    }

    const startDate = new Date(start);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + months);
    const endDateStr = endDate.toISOString().split('T')[0];

    const today = new Date();
    let due = amt;
    if (today > startDate) {
      const diffYears = today.getFullYear() - startDate.getFullYear();
      const diffMonths = today.getMonth() - startDate.getMonth();
      const monthsPassed = diffYears * 12 + diffMonths;
      if (monthsPassed > 0) {
        due = Math.max(0, amt - (installment * monthsPassed));
      }
    }

    setForm(p => ({ ...p, end_date: endDateStr, amount_due: due.toFixed(2) }));
  }, [form.amount, form.monthly_installment, form.repayment_period_months, form.start_date]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.post('/hr/loans', { ...form, id });
      } else {
        await api.post('/hr/loans', form);
      }
      toast.success(isEdit ? "Loan updated" : "Loan created");
      navigate('/human-resources/loans');
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
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Loan' : 'New Loan Request'}</h1>
          <button onClick={() => window.history.back()} className="btn-secondary">Back</button>
        </div>

        <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Employee *</label>
              <select 
                className="input" 
                value={form.employee_id} 
                onChange={(e) => update('employee_id', e.target.value)} 
                required
                disabled={isEdit}
              >
                <option value="">Select Employee</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.emp_code} - {e.first_name} {e.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Loan Type *</label>
              <select
                className="input"
                value={form.loan_type}
                onChange={(e) => update("loan_type", e.target.value)}
                required
              >
                <option value="">Select Loan Type</option>
                {loanTypes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Principal Amount *</label>
              <input 
                className="input" 
                type="number" 
                step="0.01" 
                value={form.amount} 
                onChange={(e) => update('amount', e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="label">Interest Rate (%)</label>
              <input 
                className="input" 
                type="number" 
                step="0.01" 
                value={form.interest_rate} 
                onChange={(e) => update('interest_rate', e.target.value)} 
              />
            </div>
            <div>
              <label className="label">Repayment Period (Months) *</label>
              <input 
                className="input" 
                type="number" 
                value={form.repayment_period_months} 
                onChange={(e) => update('repayment_period_months', e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="label">Monthly Installment (Auto-calculated)</label>
              <input 
                className="input bg-slate-50 dark:bg-slate-700 font-mono" 
                type="number" 
                value={form.monthly_installment} 
                readOnly 
              />
            </div>
            <div>
              <label className="label">Amount Due (Calculated)</label>
              <input 
                className="input bg-slate-50 dark:bg-slate-700 font-mono" 
                type="number" 
                value={form.amount_due} 
                readOnly 
              />
            </div>
            <div>
              <label className="label">End Date (Calculated)</label>
              <input 
                className="input bg-slate-50 dark:bg-slate-700 font-mono" 
                type="date" 
                value={form.end_date} 
                readOnly 
              
                disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
              />
            </div>
            <div>
              <label className="label">Start Date</label>
              <input 
                className="input" 
                type="date" 
                value={form.start_date} 
                onChange={(e) => update('start_date', e.target.value)} 
                placeholder="loan takes effect when start date is set"
              
                disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
              />
              <p className="text-[10px] text-slate-400 mt-1">Loan takes effect when start date is set</p>
            </div>
            <div>
              <label className="label">Status</label>
              <select 
                className="input" 
                value={form.status} 
                onChange={(e) => update('status', e.target.value)}
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="COMPLETED">Completed</option>
                <option value="ACTIVE">Active</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input 
                type="checkbox" 
                className="checkbox" 
                checked={form.affect_payslip} 
                onChange={e => update('affect_payslip', e.target.checked)}
              />
              <label className="text-sm font-medium">Affect Payslip? (Auto-deduct installment)</label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => window.history.back()} className="btn-secondary">Cancel</button>
            <button className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Loan'}
            </button>
          </div>
        </form>
      </div>
    </Guard>
  );
}
