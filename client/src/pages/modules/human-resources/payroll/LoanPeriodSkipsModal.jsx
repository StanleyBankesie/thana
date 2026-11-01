import React, { useState, useEffect, useCallback } from "react";
import Modal from "@/components/Modal";
import { SkipForward, CheckCircle2, AlertCircle, Trash2, Plus, DollarSign } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function LoanPeriodSkipsModal({
  open,
  onClose,
  periodId,
  periodName,
  onRefresh,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [skippingLoanId, setSkippingLoanId] = useState(null);
  const [promptSkipLoan, setPromptSkipLoan] = useState(null);
  const [skipReason, setSkipReason] = useState("");

  const loadStatus = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const res = await api.get(`/hr/loans/period-status?period_id=${periodId}`);
      setData(res.data);
    } catch (err) {
      console.warn("Could not load period loans status:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    if (open && periodId) {
      loadStatus();
      setPromptSkipLoan(null);
      setSkipReason("");
    }
  }, [open, periodId, loadStatus]);

  if (!periodId) return null;

  const handleConfirmSkip = async (e) => {
    e.preventDefault();
    if (!promptSkipLoan) return;

    setSkippingLoanId(promptSkipLoan.id);
    try {
      await api.post(`/hr/loans/${promptSkipLoan.id}/skips`, {
        period_id: Number(periodId),
        skip_month: data?.period_month,
        reason: skipReason.trim() || "Skipped by HR during payroll processing",
      });
      toast.success(
        `Loan deduction for ${promptSkipLoan.first_name} ${promptSkipLoan.last_name} skipped for this month`
      );
      setPromptSkipLoan(null);
      setSkipReason("");
      await loadStatus();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to skip loan deduction");
    } finally {
      setSkippingLoanId(null);
    }
  };

  const handleResume = async (loan) => {
    if (
      !window.confirm(
        `Resume loan deduction for ${loan.first_name} ${loan.last_name} for this month?`
      )
    ) {
      return;
    }

    setSkippingLoanId(loan.id);
    try {
      await api.delete(`/hr/loans/${loan.id}/skips/${loan.skip_id}`);
      toast.success(`Loan deduction resumed for this month`);
      await loadStatus();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resume deduction");
    } finally {
      setSkippingLoanId(null);
    }
  };

  const items = data?.items || [];
  const skippedCount = items.filter((l) => l.is_skipped).length;
  const activeCount = items.length - skippedCount;
  const totalScheduledDeductions = items
    .filter((l) => !l.is_skipped)
    .reduce((sum, l) => sum + Math.min(Number(l.monthly_installment || 0), Number(l.amount_due || 0)), 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Monthly Loan Deductions & Skips"
      subtitle={`Manage loan deductions scheduled for ${periodName || "current payroll run"}`}
      icon={<SkipForward size={20} />}
      maxWidth="max-w-4xl"
      showFooter={false}
    >
      <div className="space-y-4">
        {/* Stat badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Active Loans
            </span>
            <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100">
              {items.length} employee loans
            </span>
          </div>

          <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
              Scheduled to Deduct
            </span>
            <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
              {activeCount} loans (GHS {totalScheduledDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </span>
          </div>

          <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
              Skipped for This Month
            </span>
            <span className="text-lg font-bold font-mono text-rose-700 dark:text-rose-300">
              {skippedCount} loans skipped
            </span>
          </div>
        </div>

        {/* Prompt skip reason sub-form if clicked */}
        {promptSkipLoan && (
          <form
            onSubmit={handleConfirmSkip}
            className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Skip deduction for {promptSkipLoan.first_name} {promptSkipLoan.last_name} ({promptSkipLoan.loan_type})
              </span>
              <button
                type="button"
                onClick={() => setPromptSkipLoan(null)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
            <div>
              <label className="label text-xs">Reason for skipping this month:</label>
              <input
                type="text"
                className="input"
                autoFocus
                placeholder="e.g. Employee requested emergency leave / salary adjustment"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPromptSkipLoan(null)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary text-xs bg-rose-600 hover:bg-rose-700 border-rose-600"
                disabled={skippingLoanId === promptSkipLoan.id}
              >
                {skippingLoanId === promptSkipLoan.id ? "Skipping..." : "Confirm Skip for this Month"}
              </button>
            </div>
          </form>
        )}

        {/* Loans Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-slate-500">Employee</th>
                <th className="px-3 py-2 text-left font-bold text-slate-500">Loan Type</th>
                <th className="px-3 py-2 text-right font-bold text-slate-500">Balance Due</th>
                <th className="px-3 py-2 text-right font-bold text-slate-500">Installment</th>
                <th className="px-3 py-2 text-center font-bold text-slate-500">Status for this Month</th>
                <th className="px-3 py-2 text-right font-bold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2.5 font-medium">
                    <div>{loan.first_name} {loan.last_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{loan.emp_code}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                    {loan.loan_type}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                    GHS {loan.amount_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                    GHS {loan.monthly_installment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {loan.is_skipped ? (
                      <div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                          Skipped This Month
                        </span>
                        {loan.skip_reason && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px] mx-auto mt-0.5" title={loan.skip_reason}>
                            "{loan.skip_reason}"
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Will Deduct
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {loan.is_skipped ? (
                      <button
                        type="button"
                        onClick={() => handleResume(loan)}
                        disabled={skippingLoanId === loan.id}
                        className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 font-medium text-xs flex items-center gap-1 ml-auto"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resume
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPromptSkipLoan(loan);
                          setSkipReason("");
                        }}
                        disabled={skippingLoanId === loan.id}
                        className="text-rose-600 hover:text-rose-800 dark:text-rose-400 font-medium text-xs flex items-center gap-1 ml-auto"
                      >
                        <SkipForward className="w-3.5 h-3.5" /> Skip Month
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    No active loan deductions found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-xs">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
