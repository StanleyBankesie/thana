/**
 * @fileoverview LoanDisbursementModal component.
 * Implements Payment Voucher (PV) Direct Payment standard for disbursing approved staff loans.
 * Automatically posts a Payment Voucher (PV) to Finance upon disbursement:
 * - Debit: Employee Loan Receivable asset account (from hr_setup_loan_types)
 * - Credit: Selected Bank or Cash payment account
 */

import React, { useState, useEffect } from "react";
import Modal from "@/components/Modal";
import { DollarSign, CheckCircle2, Wallet, Calendar, AlertCircle, Building2, FolderKanban } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function LoanDisbursementModal({ open, onClose, loan, onSuccess }) {
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [disbursementDate, setDisbursementDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [costCenters, setCostCenters] = useState([]);
  const [costCenterId, setCostCenterId] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [disbursementNotes, setDisbursementNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const loanAmount = Number(loan?.amount || 0);

  // Load finance bank/cash accounts, cost centers, projects
  useEffect(() => {
    if (open) {
      setLoadingData(true);
      Promise.allSettled([
        api.get("/finance/accounts?active=1&postable=1"),
        api.get("/finance/cost-centers"),
        api.get("/projects").catch(() => ({ data: { items: [] } })),
      ])
        .then(([accRes, ccRes, prjRes]) => {
          const accs =
            accRes.status === "fulfilled"
              ? accRes.value.data?.items || []
              : [];
          // Filter cash and bank accounts
          const cashBank = accs.filter((a) => {
            const gc = String(a.group_code || "").toUpperCase();
            const gn = String(a.group_name || "").toUpperCase();
            const nat = String(a.nature || "").toUpperCase();
            return (
              gc === "AST_BANK" ||
              gn.includes("BANK") ||
              gc === "AST_CASH" ||
              gn.includes("CASH") ||
              gc === "1005" ||
              gc === "1006" ||
              nat === "ASSET"
            );
          });
          const list = cashBank.length ? cashBank : accs;
          setPaymentAccounts(list);
          // Do not select default account - user must select explicitly

          if (ccRes.status === "fulfilled") {
            setCostCenters(ccRes.value.data?.items || ccRes.value.data || []);
          }
          if (prjRes.status === "fulfilled") {
            setProjects(prjRes.value.data?.items || prjRes.value.data || []);
          }
        })
        .finally(() => setLoadingData(false));
    }
  }, [open, selectedAccountId]);

  useEffect(() => {
    if (open && loan) {
      setDisbursementDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod("");
      setSelectedAccountId("");
      setChequeDate("");
      setCostCenterId("");
      setProjectId("");
      setDisbursementNotes(
        `Loan disbursement for ${loan.first_name || ""} ${loan.last_name || ""} - ${loan.loan_type || "Employee Loan"}`
      );
    }
  }, [open, loan]);

  if (!loan) return null;

  const isBankLike = ["CHEQUE", "BANK_TRANSFER", "CREDIT_CARD", "MOBILE_MONEY"].includes(
    String(paymentMethod).toUpperCase()
  );

  const selectedAccount = paymentAccounts.find(
    (a) => String(a.id) === String(selectedAccountId)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!paymentMethod) {
      toast.error("Please select a Payment Method");
      return;
    }

    if (!selectedAccountId) {
      toast.error("Please select a Disbursement Account");
      return;
    }

    if (!disbursementDate) {
      toast.error("Please choose a Disbursement Date");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/hr/loans/${loan.id}/disburse`, {
        payment_account_id: Number(selectedAccountId),
        disbursement_date: disbursementDate,
        disbursement_method: paymentMethod,
        cheque_date: isBankLike && chequeDate ? chequeDate : null,
        cost_center_id: costCenterId ? Number(costCenterId) : null,
        project_id: projectId ? Number(projectId) : null,
        disbursement_notes: disbursementNotes,
      });

      toast.success(
        res.data?.message ||
          `Loan disbursed successfully! Payment Voucher ${res.data?.disbursement_voucher_no || ""} posted to Finance.`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Failed to disburse loan. Ensure loan is approved and finance account is configured."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Disburse Staff Loan"
      subtitle={`Payment Voucher Direct Payment for ${loan.first_name || ""} ${loan.last_name || ""}`}
      icon={<DollarSign size={20} />}
      maxWidth="max-w-2xl"
      showFooter={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Approved Loan Summary Card */}
        <div className="bg-gradient-to-r from-emerald-50/80 to-teal-50/60 dark:from-emerald-950/20 dark:to-teal-950/20 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-800/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Employee
              </span>
              <span className="font-semibold text-slate-900 dark:text-white block">
                {loan.first_name} {loan.last_name}
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {loan.emp_code || `Emp #${loan.employee_id}`}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Loan Facility
              </span>
              <span className="font-semibold text-slate-900 dark:text-white block">
                {loan.loan_type}
              </span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                {loan.loan_account_code ? `Acc: ${loan.loan_account_code}` : "Receivable Asset"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Approved Amount
              </span>
              <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300 text-base block">
                GHS {loanAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-slate-500">Principal</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Repayment
              </span>
              <span className="font-semibold font-mono text-slate-800 dark:text-slate-200 block">
                GHS {Number(loan.monthly_installment || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-slate-500">
                {loan.repayment_period_months} months
              </span>
            </div>
          </div>

          {loan.approved_by_name && (
            <div className="mt-2.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                Approved by <strong>{loan.approved_by_name}</strong>
              </span>
              {loan.approved_at && (
                <span className="text-[11px] opacity-80">
                  {new Date(loan.approved_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Voucher Info Notice */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-3 rounded-lg flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
          <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Automated Finance Payment Voucher (PV)</p>
            Disbursing this loan will automatically generate and post an official <strong>Payment Voucher (PV)</strong> in the General Ledger: <strong>Debiting</strong> the staff loan receivable asset account and <strong>Crediting</strong> your selected bank/cash account.
          </div>
        </div>

        {/* Payment Account Selection (Credit) */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <label className="label text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-0">
              <Wallet className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              Payment Account (Credit) <span className="text-red-500">*</span>
            </label>
          </div>

          <div>
            <select
              className="input w-full"
              required
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={loadingData || submitting}
            >
              <option value="">-- Select Disbursement Account --</option>
              {paymentAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name} ({a.group_name || a.nature}) {a.currency_code ? `[${a.currency_code}]` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="label text-xs">
                Disbursement Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="input"
                value={disbursementDate}
                onChange={(e) => setDisbursementDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="">-- Select Payment Method --</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Direct Deposit">Direct Deposit</option>
              </select>
            </div>
          </div>

          {/* Conditional Cheque / Transfer Date */}
          {isBankLike && (
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/40">
              <label className="label text-xs">Cheque / Transfer Value Date</label>
              <input
                type="date"
                className="input max-w-xs"
                value={chequeDate}
                onChange={(e) => setChequeDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Full-width Remarks */}
        <div className="w-full col-span-full">
          <label className="label">Disbursement Remarks / PV Narration</label>
          <textarea
            className="input w-full"
            rows="3"
            placeholder="Disbursement details, approval references or payment narration..."
            value={disbursementNotes}
            onChange={(e) => setDisbursementNotes(e.target.value)}
          />
        </div>

        {/* Actions */}
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
            className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
            disabled={submitting || !selectedAccountId}
          >
            {submitting ? (
              "Posting PV..."
            ) : (
              <>
                <CheckCircle2 size={16} />
                Disburse & Post Payment Voucher
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
