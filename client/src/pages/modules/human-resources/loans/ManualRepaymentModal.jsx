import React, { useState, useEffect } from "react";
import Modal from "@/components/Modal";
import { DollarSign, CheckCircle2, Building, Calendar, Wallet } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function ManualRepaymentModal({ open, onClose, loan, onSuccess }) {
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [chequeDate, setChequeDate] = useState("");
  const [depositAccountId, setDepositAccountId] = useState("");
  const [depositAccounts, setDepositAccounts] = useState([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const amountDue = Number(loan?.amount_due ?? loan?.amount ?? 0);
  const installment = Number(loan?.monthly_installment ?? 0);

  // Load finance accounts and loan types to auto-detect the linked deposit account
  useEffect(() => {
    if (open) {
      setLoadingData(true);
      Promise.allSettled([
        api.get("/finance/accounts?active=1&postable=1"),
        api.get("/hr/loan-types"),
      ])
        .then(([accRes, ltRes]) => {
          const accs =
            accRes.status === "fulfilled"
              ? accRes.value.data?.items || accRes.value.data || []
              : [];
          const ltList =
            ltRes.status === "fulfilled"
              ? ltRes.value.data?.items || ltRes.value.data || []
              : [];

          // Auto-detect the account linked to this loan type in setup page
          const matchedLt = ltList.find(
            (lt) =>
              String(lt.name || "").trim().toLowerCase() ===
                String(loan?.loan_type || "").trim().toLowerCase() ||
              (loan?.loan_id && Number(lt.id) === Number(loan.loan_id))
          );

          const linkedAccountId =
            matchedLt?.account_id ||
            loan?.loan_type_account_id ||
            loan?.account_id ||
            null;

          // Filter cash, bank, and asset accounts
          const cashBank = accs.filter((a) => {
            const gc = String(a.group_code || "").toUpperCase();
            const gn = String(a.group_name || "").toUpperCase();
            return (
              gc === "AST_BANK" ||
              gn.includes("BANK") ||
              gc === "AST_CASH" ||
              gn.includes("CASH") ||
              gc === "1005" ||
              gc === "1006" ||
              a.nature === "ASSET"
            );
          });

          let allAccs = cashBank.length ? cashBank : accs;
          // Ensure the linked account is in the options list
          if (
            linkedAccountId &&
            !allAccs.some((a) => String(a.id) === String(linkedAccountId))
          ) {
            const found = accs.find(
              (a) => String(a.id) === String(linkedAccountId)
            );
            if (found) allAccs = [found, ...allAccs];
          }
          setDepositAccounts(allAccs);

          // Automatically populate the linked account in the Deposit Account field
          if (linkedAccountId) {
            setDepositAccountId(String(linkedAccountId));
          } else if (allAccs.length > 0) {
            setDepositAccountId(String(allAccs[0].id));
          }
        })
        .finally(() => setLoadingData(false));
    }
  }, [open, loan]);

  useEffect(() => {
    if (open && loan) {
      const initialAmt = Math.min(amountDue, installment > 0 ? installment : amountDue);
      setAmountPaid(initialAmt > 0 ? initialAmt.toFixed(2) : "");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod("Cash");
      setChequeDate("");
      setNotes("");
    }
  }, [open, loan, amountDue, installment]);

  if (!loan) return null;

  const isBankLike = [
    "CHEQUE",
    "BANK_TRANSFER",
    "CREDIT_CARD",
    "MOBILE_MONEY",
  ].includes(String(paymentMethod).toUpperCase().replace(/\s+/g, "_"));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payAmt = Number(amountPaid);
    if (!payAmt || payAmt <= 0) {
      toast.error("Please enter a valid payment amount greater than zero");
      return;
    }
    if (payAmt > amountDue) {
      toast.error(
        `Payment amount (GHS ${payAmt.toLocaleString()}) cannot exceed remaining balance of GHS ${amountDue.toLocaleString()}`
      );
      return;
    }

    if (!depositAccountId) {
      toast.error("Please select a Deposit Account for this direct receipt");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/hr/loans/${loan.id}/manual-repayment`, {
        amount_paid: payAmt,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        deposit_account_id: depositAccountId ? Number(depositAccountId) : null,
        cheque_date: isBankLike && chequeDate ? chequeDate : null,
        notes,
      });

      toast.success(
        res.data?.message ||
          `Direct receipt repayment of GHS ${payAmt.toLocaleString()} recorded successfully!`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to record direct receipt payment"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Direct Receipt Loan Payment"
      subtitle={`Post direct receipt voucher & deduct loan balance for ${loan.first_name} ${loan.last_name}`}
      icon={<DollarSign size={20} />}
      maxWidth="max-w-2xl"
      showFooter={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Loan Summary Header Card - code removed from Loan Type field */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-3 gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Loan Type
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {loan.loan_type}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Remaining Balance
            </span>
            <span className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
              GHS{" "}
              {amountDue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[11px] text-slate-400 block">
              of GHS {Number(loan.amount || 0).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Std. Installment
            </span>
            <span className="text-sm font-semibold font-mono text-slate-700 dark:text-slate-200">
              GHS{" "}
              {installment.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[11px] text-slate-400 block">/ month</span>
          </div>
        </div>

        {/* Quick Amount Shortcuts & Payment Amount */}
        <div>
          <label className="label">
            Payment / Deduction Amount (GHS) <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setAmountPaid(amountDue.toFixed(2))}
              className="text-xs px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-700 font-medium transition-colors"
            >
              Pay Full Balance (GHS {amountDue.toFixed(2)})
            </button>
            {installment > 0 && installment < amountDue && (
              <button
                type="button"
                onClick={() => setAmountPaid(installment.toFixed(2))}
                className="text-xs px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-medium transition-colors"
              >
                1 Installment (GHS {installment.toFixed(2)})
              </button>
            )}
          </div>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={amountDue}
            required
            className="input font-mono text-base font-semibold"
            placeholder="0.00"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
          />
          {Number(amountPaid) > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              New remaining balance after this payment:{" "}
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                GHS{" "}
                {Math.max(0, amountDue - Number(amountPaid)).toLocaleString(
                  undefined,
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </strong>
            </p>
          )}
        </div>

        {/* Direct Receipt Features: Date, Payment Method & Cheque Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">
              Payment / Voucher Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              className="input"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              className="input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Direct Deposit">Direct Deposit</option>
            </select>
          </div>
        </div>

        {/* Deposit Account Section - Balance removed */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <label className="label text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-0">
              <Wallet className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              Deposit Account (Debit) <span className="text-red-500">*</span>
            </label>
          </div>

          <div>
            <select
              className="input w-full"
              required
              value={depositAccountId}
              onChange={(e) => setDepositAccountId(e.target.value)}
            >
              <option value="">-- Select Deposit Account --</option>
              {depositAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name} ({a.group_name || a.nature})
                </option>
              ))}
            </select>
          </div>

          {/* Conditional Cheque Date if Bank-like */}
          {isBankLike && (
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/40">
              <label className="label text-xs">Cheque / Transfer Date</label>
              <input
                type="date"
                className="input max-w-xs"
                value={chequeDate}
                onChange={(e) => setChequeDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Full-width Notes / Remarks field */}
        <div className="w-full col-span-full">
          <label className="label">Notes / Remarks</label>
          <textarea
            className="input w-full"
            rows="3"
            placeholder="Reason for manual payment, direct receipt details or additional remarks..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center gap-2"
            disabled={
              submitting || !amountPaid || Number(amountPaid) <= 0 || !depositAccountId
            }
          >
            {submitting ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Posting Receipt Voucher...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Post Direct Receipt & Update Loan
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
