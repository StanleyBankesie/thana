import React, { useState, useEffect, useCallback } from "react";
import Modal from "@/components/Modal";
import { History, DollarSign, RotateCcw, Plus, Receipt } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function LoanRepaymentsModal({
  open,
  onClose,
  loan,
  onOpenManualPay,
  onSuccess,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revertingId, setRevertingId] = useState(null);

  const loadRepayments = useCallback(async () => {
    if (!loan?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/hr/loans/${loan.id}/repayments`);
      setData(res.data);
    } catch {
      toast.error("Failed to load loan repayment ledger");
    } finally {
      setLoading(false);
    }
  }, [loan?.id]);

  useEffect(() => {
    if (open && loan) {
      loadRepayments();
    }
  }, [open, loan, loadRepayments]);

  if (!loan) return null;

  const handleRevert = async (repayment) => {
    if (
      !window.confirm(
        `Are you sure you want to revert this manual payment of GHS ${repayment.amount_paid.toLocaleString()}? This will restore the loan's balance.`
      )
    ) {
      return;
    }

    setRevertingId(repayment.id);
    try {
      const res = await api.delete(
        `/hr/loans/${loan.id}/repayments/${repayment.id}`
      );
      toast.success(res.data?.message || "Manual repayment reverted successfully");
      await loadRepayments();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to revert payment");
    } finally {
      setRevertingId(null);
    }
  };

  const loanInfo = data?.loan || loan;
  const items = data?.items || [];
  const totalRepaid = data?.total_repaid ?? 0;
  const amountDue = data?.amount_due ?? Number(loanInfo.amount_due ?? loanInfo.amount ?? 0);
  const principal = Number(loanInfo.amount || 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Loan Repayment Ledger & History"
      subtitle={`Complete payment ledger for ${loanInfo.first_name} ${loanInfo.last_name} (${loanInfo.loan_type})`}
      icon={<History size={20} />}
      maxWidth="max-w-4xl"
      showFooter={false}
    >
      <div className="space-y-4">
        {/* Top 3 Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Original Principal
            </span>
            <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100">
              GHS {principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block font-mono">
              Installment: GHS {Number(loanInfo.monthly_installment || 0).toFixed(2)}/mo
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
              Total Repaid to Date
            </span>
            <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
              GHS {totalRepaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">
              {principal > 0 ? `${((totalRepaid / principal) * 100).toFixed(1)}% repaid` : ""}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
              Remaining Balance Due
            </span>
            <span className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300">
              GHS {amountDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 block font-medium">
              Status: {loanInfo.status}
            </span>
          </div>
        </div>

        {/* Action Header above table */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            All Repayments ({items.length})
          </div>
          {amountDue > 0 && onOpenManualPay && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenManualPay(loanInfo);
              }}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Record Manual Payment
            </button>
          )}
        </div>

        {/* Ledger Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-slate-500">Date</th>
                <th className="px-3 py-2 text-left font-bold text-slate-500">Source / Type</th>
                <th className="px-3 py-2 text-left font-bold text-slate-500">Method & Reference</th>
                <th className="px-3 py-2 text-right font-bold text-slate-500">Amount Paid</th>
                <th className="px-3 py-2 text-right font-bold text-slate-500">Balance</th>
                <th className="px-3 py-2 text-left font-bold text-slate-500">Recorded By / Notes</th>
                <th className="px-3 py-2 text-right font-bold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.map((r) => {
                const isManual = r.payment_type === "MANUAL" || (!r.payroll_id && r.payment_type !== "PAYROLL");
                return (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                      {new Date(r.payment_date).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {isManual ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Manual Payment
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                          Payroll Deduction
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-700 dark:text-slate-200">
                        {r.payment_method || (r.period_name ? `Payroll: ${r.period_name}` : "Automated")}
                      </div>
                      {(r.voucher_no || r.reference) && (
                        <div className="text-[11px] text-brand-600 dark:text-brand-400 font-mono font-semibold flex items-center gap-1 mt-0.5">
                          <Receipt className="w-3 h-3" /> {r.voucher_no ? `RV #${r.voucher_no}` : r.reference}
                        </div>
                      )}
                      {r.deposit_account_name && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          Into: {r.deposit_account_name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      GHS {r.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.remaining_balance !== null
                        ? `GHS ${Number(r.remaining_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "-"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-600 dark:text-slate-300">
                        {r.created_by_name || "System"}
                      </div>
                      {r.notes && (
                        <div className="text-[11px] text-slate-400 italic">
                          "{r.notes}"
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {isManual && (
                        <button
                          type="button"
                          onClick={() => handleRevert(r)}
                          disabled={revertingId === r.id}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 font-medium text-[11px] flex items-center gap-1 ml-auto"
                          title="Revert this manual payment"
                        >
                          <RotateCcw className="w-3 h-3" /> Revert
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                    No repayments recorded yet for this loan.
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
