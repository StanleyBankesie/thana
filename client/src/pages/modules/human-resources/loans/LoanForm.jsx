/**
 * @fileoverview LoanForm component.
 * Provides functionality for LoanForm, with Monthly Skip and Manual Repayment support.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { DollarSign, SkipForward, History } from "lucide-react";
import ManualRepaymentModal from "./ManualRepaymentModal";
import LoanSkipModal from "./LoanSkipModal";
import LoanRepaymentsModal from "./LoanRepaymentsModal";

/**
 * LoanForm component
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
  const [showManualPay, setShowManualPay] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [form, setForm] = useState({
    employee_id: "",
    loan_type: "Personal Loan",
    amount: 0,
    interest_rate: 0,
    repayment_period_months: 12,
    monthly_installment: 0,
    start_date: "",
    amount_due: 0,
    end_date: "",
    status: "PENDING",
    affect_payslip: true,
  });

  const loadLoan = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/hr/loans?id=${id}`);
      const item = res.data.items?.find((i) => String(i.id) === String(id));
      if (item) {
        setForm({
          ...item,
          start_date: item.start_date ? item.start_date.slice(0, 10) : "",
          end_date: item.end_date ? item.end_date.slice(0, 10) : "",
          amount_due: Number(item.amount_due ?? item.amount ?? 0).toFixed(2),
        });
      }
    } catch {
      toast.error("Failed to load loan details");
    } finally {
      setLoading(false);
    }
  }, [id]);

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

    if (isEdit) {
      loadLoan();
    }
  }, [id, isEdit, loadLoan]);

  // Auto-calculate monthly installment
  useEffect(() => {
    const amt = Number(form.amount) || 0;
    const rate = Number(form.interest_rate) || 0;
    const months = Number(form.repayment_period_months) || 1;

    const totalInterest = amt * (rate / 100);
    const totalRepayment = amt + totalInterest;
    const installment = totalRepayment / months;

    setForm((prev) => ({
      ...prev,
      monthly_installment: installment.toFixed(2),
    }));
  }, [form.amount, form.interest_rate, form.repayment_period_months]);

  // Calculate Amount Due and End Date ONLY for new loans
  useEffect(() => {
    if (isEdit) return; // Prevent overwriting actual repayment balance on existing loans!

    const amt = Number(form.amount) || 0;
    const months = Number(form.repayment_period_months) || 1;
    const start = form.start_date;

    if (!start) {
      setForm((p) => ({ ...p, end_date: "", amount_due: amt.toFixed(2) }));
      return;
    }

    const startDate = new Date(start);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + months);
    const endDateStr = endDate.toISOString().split("T")[0];

    setForm((p) => ({ ...p, end_date: endDateStr, amount_due: amt.toFixed(2) }));
  }, [form.amount, form.repayment_period_months, form.start_date, isEdit]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.post("/hr/loans", { ...form, id });
      } else {
        await api.post("/hr/loans", form);
      }
      toast.success(isEdit ? "Loan updated" : "Loan created");
      navigate("/human-resources/loans");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  const remainingDue = Number(form.amount_due ?? form.amount ?? 0);
  const isCompleted = form.status === "COMPLETED" || remainingDue <= 0;

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        {/* Top Header & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit ? "Edit Loan Facility" : "New Loan Request"}
            </h1>
            <p className="text-sm text-slate-500">
              {isEdit
                ? "Manage loan details, skip monthly deductions, or record manual payments"
                : "Create a new employee staff loan facility"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEdit && !isCompleted && (
              <>
                <button
                  type="button"
                  onClick={() => setShowManualPay(true)}
                  className="btn-primary text-xs flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 border-amber-600"
                >
                  <DollarSign className="w-4 h-4" /> Record Manual Payment
                </button>
                <button
                  type="button"
                  onClick={() => setShowSkipModal(true)}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <SkipForward className="w-4 h-4" /> Skip Month
                </button>
              </>
            )}
            {isEdit && (
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <History className="w-4 h-4" /> Payment Ledger
              </button>
            )}
            <button
              type="button"
              onClick={() => window.history.back()}
              className="btn-secondary"
            >
              Back
            </button>
          </div>
        </div>

        {/* Loan Balance Highlight when editing */}
        {isEdit && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Principal Amount
              </span>
              <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100">
                GHS {Number(form.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                Remaining Balance Due
              </span>
              <span className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300">
                GHS {remainingDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Monthly Installment
              </span>
              <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                GHS {Number(form.monthly_installment || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Employee *</label>
              <select
                className="input"
                value={form.employee_id}
                onChange={(e) => update("employee_id", e.target.value)}
                required
                disabled={isEdit}
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.middle_name ? `${e.middle_name} ` : ""}{e.last_name}
                  </option>
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
                className="input font-mono"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => update("amount", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Interest Rate (%)</label>
              <input
                className="input font-mono"
                type="number"
                step="0.01"
                value={form.interest_rate}
                onChange={(e) => update("interest_rate", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Repayment Period (Months) *</label>
              <input
                className="input"
                type="number"
                value={form.repayment_period_months}
                onChange={(e) => update("repayment_period_months", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Monthly Installment (Auto-calculated)</label>
              <input
                className="input bg-slate-50 dark:bg-slate-900 font-mono font-semibold"
                type="number"
                value={form.monthly_installment}
                readOnly
              />
            </div>
            <div>
              <label className="label">Remaining Balance Due</label>
              <input
                className="input bg-slate-50 dark:bg-slate-900 font-mono font-bold text-amber-600 dark:text-amber-400"
                type="number"
                value={form.amount_due}
                readOnly={!hasExceptional("DOCUMENT.EDIT_DATE")}
                onChange={(e) => update("amount_due", e.target.value)}
              />
            </div>
            <div>
              <label className="label">End Date (Calculated)</label>
              <input
                className="input bg-slate-50 dark:bg-slate-900 font-mono"
                type="date"
                value={form.end_date}
                readOnly
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="label">Start Date</label>
              <input
                className="input"
                type="date"
                value={form.start_date}
                onChange={(e) => update("start_date", e.target.value)}
                placeholder="loan takes effect when start date is set"
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Loan deduction begins from this date onwards
              </p>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
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
                onChange={(e) => update("affect_payslip", e.target.checked)}
              />
              <label className="text-sm font-medium">
                Affect Payslip? (Auto-deduct installment during payroll)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button className="btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Save Loan"}
            </button>
          </div>
        </form>
      </div>

      {/* Manual Repayment Modal */}
      {showManualPay && (
        <ManualRepaymentModal
          open={showManualPay}
          onClose={() => setShowManualPay(false)}
          loan={{ ...form, id }}
          onSuccess={loadLoan}
        />
      )}

      {/* Skip Month Modal */}
      {showSkipModal && (
        <LoanSkipModal
          open={showSkipModal}
          onClose={() => setShowSkipModal(false)}
          loan={{ ...form, id }}
          onSuccess={loadLoan}
        />
      )}

      {/* Repayments History Modal */}
      {showHistoryModal && (
        <LoanRepaymentsModal
          open={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          loan={{ ...form, id }}
          onOpenManualPay={() => setShowManualPay(true)}
          onSuccess={loadLoan}
        />
      )}
    </Guard>
  );
}
