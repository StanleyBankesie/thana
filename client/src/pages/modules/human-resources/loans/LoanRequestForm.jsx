/**
 * @fileoverview LoanRequestForm component.
 * Allows employees/HR to submit staff loan requests for approval.
 * Once approved, the loan request becomes visible in the Loan Disbursements
 * queue (/human-resources/loans) where finance executes the disbursement
 * and generates the corresponding Payment Voucher.
 */

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import {
  Save,
  ArrowLeft,
  Calculator,
  User,
  CheckCircle2,
  XCircle,
  Send,
  Calendar,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";

export default function LoanRequestForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [loanStatus, setLoanStatus] = useState("DRAFT");
  const [approving, setApproving] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: "",
    loan_type: "Personal Loan",
    amount: "",
    interest_rate: 0,
    repayment_period_months: 12,
    start_date: new Date().toISOString().slice(0, 10),
    purpose: "",
    affect_payslip: true,
  });

  // Load employees & loan types
  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        const [empRes, ltRes] = await Promise.allSettled([
          api.get("/hr/employees"),
          api.get("/hr/loan-types"),
        ]);

        if (empRes.status === "fulfilled") {
          setEmployees(empRes.value.data?.items || []);
        }

        if (ltRes.status === "fulfilled") {
          const lts = ltRes.value.data?.items || [];
          setLoanTypes(lts);
          if (lts.length > 0 && !isEdit) {
            setFormData((prev) => ({
              ...prev,
              loan_type: lts[0].name || prev.loan_type,
            }));
          }
        }

        if (isEdit) {
          const loanRes = await api.get(`/hr/loans?id=${id}`);
          const found = loanRes.data?.items?.find((i) => String(i.id) === String(id));
          if (found) {
            setLoanStatus(found.status || "DRAFT");
            setFormData({
              employee_id: String(found.employee_id || ""),
              loan_type: found.loan_type || "Personal Loan",
              amount: String(found.amount || ""),
              interest_rate: found.interest_rate || 0,
              repayment_period_months: found.repayment_period_months || 12,
              start_date: found.start_date
                ? found.start_date.slice(0, 10)
                : new Date().toISOString().slice(0, 10),
              purpose: found.purpose || "",
              affect_payslip: found.affect_payslip !== false,
            });
          }
        }
      } catch (err) {
        toast.error("Failed to load initial form data");
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, [id, isEdit]);

  // Calculations for monthly installment & projected end date
  const { monthlyInstallment, totalPayable, projectedEndDate, selectedEmp, selectedLoanTypeObj } =
    useMemo(() => {
      const amt = Number(formData.amount) || 0;
      const rate = Number(formData.interest_rate) || 0;
      const months = Math.max(1, Number(formData.repayment_period_months) || 1);

      let total = amt;
      if (rate > 0) {
        const interest = amt * (rate / 100) * (months / 12);
        total = amt + interest;
      }
      const installment = total / months;

      let end = "";
      if (formData.start_date) {
        const d = new Date(formData.start_date);
        if (!isNaN(d.getTime())) {
          d.setMonth(d.getMonth() + months);
          end = d.toISOString().slice(0, 10);
        }
      }

      const emp = employees.find((e) => String(e.id) === String(formData.employee_id));
      const ltObj = loanTypes.find(
        (lt) => String(lt.name).trim().toLowerCase() === String(formData.loan_type).trim().toLowerCase()
      );

      return {
        monthlyInstallment: Math.round(installment * 100) / 100,
        totalPayable: Math.round(total * 100) / 100,
        projectedEndDate: end,
        selectedEmp: emp,
        selectedLoanTypeObj: ltObj,
      };
    }, [formData, employees, loanTypes]);

  // Save loan request and automatically submit for approval
  const handleSubmit = async () => {
    if (!formData.employee_id) {
      toast.error("Please select an employee");
      return;
    }
    const amt = Number(formData.amount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid loan request amount");
      return;
    }
    if (!formData.start_date) {
      toast.error("Please specify the Disbursement / Start Repayment Date");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employee_id: Number(formData.employee_id),
        loan_type_id: selectedLoanTypeObj?.id || null,
        loan_type: formData.loan_type,
        debit_account_id: selectedLoanTypeObj?.account_id || null,
        amount: amt,
        interest_rate: Number(formData.interest_rate) || 0,
        repayment_period_months: Number(formData.repayment_period_months) || 12,
        monthly_installment: monthlyInstallment,
        start_date: formData.start_date,
        purpose: formData.purpose,
        status: "PENDING_APPROVAL",
        affect_payslip: formData.affect_payslip ? 1 : 0,
      };

      if (isEdit) {
        await api.put(`/hr/loans/${id}`, payload);
        await api.post(`/hr/loans/${id}/forward`, { notes: "Submitted for approval" }).catch(() => {});
        toast.success("Loan request updated and submitted for approval!");
      } else {
        const res = await api.post("/hr/loan-requests", payload);
        const newId = res.data?.id || res.data?.item?.id;
        if (newId) {
          await api.post(`/hr/loans/${newId}/forward`, { notes: "Submitted for approval" }).catch(() => {});
        }
        toast.success("Loan request saved and submitted for approval!");
      }

      navigate("/human-resources/loan-requests");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save loan request");
    } finally {
      setSaving(false);
    }
  };

  // Direct Approval
  const handleApprove = async () => {
    if (!id) return;
    setApproving(true);
    try {
      await api.post(`/hr/loans/${id}/approve`, {});
      toast.success(
        "Loan request approved! It is now visible in Loan Disbursements for payout."
      );
      setLoanStatus("APPROVED");
      navigate("/human-resources/loans?tab=awaiting_disbursement");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve loan request");
    } finally {
      setApproving(false);
    }
  };

  // Direct Reject
  const handleReject = async () => {
    if (!id) return;
    const reason = window.prompt("Please provide a reason for rejecting this loan request:");
    if (!reason || !reason.trim()) return;

    setApproving(true);
    try {
      await api.post(`/hr/loans/${id}/reject`, { rejection_reason: reason.trim() });
      toast.info("Loan request has been rejected.");
      setLoanStatus("REJECTED");
      navigate("/human-resources/loan-requests");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject loan request");
    } finally {
      setApproving(false);
    }
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/human-resources/loan-requests")}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Back to Loan Requests"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {isEdit ? "Edit Loan Request" : "New Loan Request"}
                </h1>
                {isEdit && (
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${
                      loanStatus === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300"
                        : loanStatus === "PENDING_APPROVAL"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300"
                        : loanStatus === "REJECTED"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300"
                        : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300"
                    }`}
                  >
                    {loanStatus}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Submit employee loan request for managerial and financial approval before disbursement
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/human-resources/loan-requests")}
              className="btn-secondary text-xs sm:text-sm"
              disabled={saving || approving}
            >
              Cancel
            </button>

            {/* Approval actions for PENDING_APPROVAL */}
            {isEdit && loanStatus === "PENDING_APPROVAL" && (
              <>
                <button
                  type="button"
                  onClick={handleReject}
                  className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 flex items-center gap-1.5 transition-colors"
                  disabled={saving || approving}
                >
                  <XCircle size={16} />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="btn-primary flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm"
                  disabled={saving || approving}
                >
                  <CheckCircle2 size={16} />
                  Approve Request
                </button>
              </>
            )}

            {/* If approved, provide direct jump to disbursement */}
            {isEdit && loanStatus === "APPROVED" && (
              <Link
                to={`/human-resources/loans/${id}/disburse`}
                className="btn-primary flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm"
              >
                <span>Disburse This Loan</span>
                <ArrowRight size={16} />
              </Link>
            )}

            {/* Single Save button (automatically submits for approval) */}
            {(!isEdit || loanStatus === "DRAFT" || loanStatus === "REJECTED" || loanStatus === "PENDING_APPROVAL") && (
              <button
                type="button"
                onClick={handleSubmit}
                className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm"
                disabled={saving || loading}
              >
                <Save size={16} />
                Save
              </button>
            )}
          </div>
        </div>

        {/* Informational Banner if Approved */}
        {isEdit && loanStatus === "APPROVED" && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                <strong>This loan request has been approved!</strong> It is now ready for fund disbursement in the Loan Disbursements queue.
              </span>
            </div>
            <Link
              to="/human-resources/loans?tab=awaiting_disbursement"
              className="btn-secondary shrink-0 text-xs py-1.5 px-3 bg-white dark:bg-slate-800"
            >
              Go to Loan Disbursements
            </Link>
          </div>
        )}

        {/* Form Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Details (2 cols) */}
          <div className="lg:col-span-2 space-y-5">
            {/* Employee & Loan Type Card */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <User size={16} className="text-brand-600 dark:text-brand-400" />
                Employee & Facility
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="input w-full"
                    required
                    value={formData.employee_id}
                    onChange={(e) =>
                      setFormData({ ...formData, employee_id: e.target.value })
                    }
                    disabled={isEdit && loanStatus !== "DRAFT"}
                  >
                    <option value="">-- Select Employee --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.first_name} {e.middle_name ? `${e.middle_name} ` : ""}{e.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">
                    Loan Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="input w-full"
                    required
                    value={formData.loan_type}
                    onChange={(e) =>
                      setFormData({ ...formData, loan_type: e.target.value })
                    }
                    disabled={isEdit && loanStatus !== "DRAFT"}
                  >
                    {loanTypes.length > 0 ? (
                      loanTypes.map((lt) => (
                        <option key={lt.id} value={lt.name}>
                          {lt.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Personal Loan">Personal Loan</option>
                        <option value="Car Loan">Car Loan</option>
                        <option value="Salary Advance">Salary Advance</option>
                      </>
                    )}
                  </select>

                </div>
              </div>

              {selectedEmp && (
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Department</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedEmp.dept_name || selectedEmp.department_name || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Job Title</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedEmp.pos_name || selectedEmp.job_title || selectedEmp.designation || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Basic Salary</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {(selectedEmp.base_salary ?? selectedEmp.basic_salary) ? `GHS ${Number(selectedEmp.base_salary ?? selectedEmp.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Loan Amount & Repayment Terms - Perfectly Aligned 2-Column Grid */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Calculator size={16} className="text-brand-600 dark:text-brand-400" />
                Loan Terms & Amount
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Disbursement Amount (GHS) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    placeholder="e.g. 5000.00"
                    className="input w-full font-mono text-base font-bold text-slate-900 dark:text-white"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    disabled={isEdit && loanStatus !== "DRAFT"}
                  />
                </div>

                <div>
                  <label className="label">
                    Repayment Duration (Months) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    className="input w-full font-mono"
                    value={formData.repayment_period_months}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        repayment_period_months: e.target.value,
                      })
                    }
                    disabled={isEdit && loanStatus !== "DRAFT"}
                  />
                </div>

                <div>
                  <label className="label">Interest Rate (% p.a.)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="input w-full font-mono"
                    value={formData.interest_rate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        interest_rate: e.target.value,
                      })
                    }
                    disabled={isEdit && loanStatus !== "DRAFT"}
                  />
                </div>

                <div>
                  <label className="label">
                    Disbursement / Start Repayment Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="input w-full"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    disabled={isEdit && loanStatus !== "DRAFT"}
                  />
                </div>

                <div>
                  <label className="label">Projected End Date</label>
                  <input
                    type="date"
                    readOnly
                    className="input w-full bg-slate-100 dark:bg-slate-900/60 font-mono text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    value={projectedEndDate}
                  />
                </div>
              </div>

              {/* Purpose */}
              <div className="pt-2">
                <label className="label">Purpose / Reason for Loan Request</label>
                <textarea
                  rows="2"
                  className="input w-full"
                  placeholder="e.g. Medical emergency, tuition, housing, or personal advance"
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value })
                  }
                  disabled={isEdit && loanStatus !== "DRAFT"}
                />
              </div>

              {/* Affect payslip option */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    className="rounded text-brand-600 focus:ring-brand-500"
                    checked={formData.affect_payslip}
                    onChange={(e) =>
                      setFormData({ ...formData, affect_payslip: e.target.checked })
                    }
                    disabled={isEdit && loanStatus !== "DRAFT"}
                  />
                  <span>Deduct monthly installments automatically via Payroll</span>
                </label>
                <p className="text-xs text-slate-400 ml-6 mt-0.5">
                  When active, installments will automatically deduct from the employee's monthly payslip starting from the Disbursement / Start Repayment Date.
                </p>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Repayment Projection Summary */}
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Repayment Projection
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Principal Amount</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    GHS {Number(formData.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Interest ({formData.interest_rate || 0}%)</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    GHS {Number(totalPayable - (Number(formData.amount) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Total Payable</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    GHS {totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Monthly Installment Highlight */}
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 block">
                  Monthly Deduction ({formData.repayment_period_months} Months)
                </span>
                <span className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 block mt-1">
                  GHS {monthlyInstallment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 ml-1">/ month</span>
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                <div className="flex justify-between">
                  <span>Disbursement Date:</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                    {formData.start_date || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Maturity Date:</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                    {projectedEndDate || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Payroll Deduction:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formData.affect_payslip ? "Automatic" : "Manual"}
                  </span>
                </div>
              </div>
            </div>

            {/* Workflow Guidance Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-200 block">
                Workflow Guidance
              </span>
              <p>
                1. Submit request for review and approval.
              </p>
              <p>
                2. Once approved, the loan request enters the <strong>Loan Disbursements</strong> queue.
              </p>
              <p>
                3. Finance generates the official Payment Voucher and disburses funds to the employee.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Guard>
  );
}
