/**
 * @fileoverview LoanDisbursementPage component.
 * Complete staff loan disbursement page with attached Finance Payment Voucher
 * (Direct Payment) generation and automated payroll deduction initiation.
 */

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import {
  ArrowLeft,
  Calculator,
  User,
  CheckCircle2,
  Wallet,
  CreditCard,
  Calendar,
  Loader2,
  DollarSign,
} from "lucide-react";

export default function LoanDisbursementPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loan, setLoan] = useState(null);

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

  // Attached Finance Payment Voucher parameters (NO default selections)
  const [voucherData, setVoucherData] = useState({
    payment_account_id: "",
    payment_method: "",
    reference_no: "",
    cheque_date: "",
    cost_center_id: "",
    project_id: "",
    narration: "",
  });

  // Load employees, loan types, finance accounts, cost centers & projects
  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        const [empRes, ltRes, accRes, ccRes, projRes] = await Promise.allSettled([
          api.get("/hr/employees"),
          api.get("/hr/loan-types"),
          api.get("/finance/accounts?active=1&postable=1"),
          api.get("/finance/cost-centers"),
          api.get("/finance/projects"),
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

        if (accRes.status === "fulfilled") {
          const allAccs = accRes.value.data?.items || accRes.value.data || [];
          setPaymentAccounts(allAccs);
        }

        if (ccRes.status === "fulfilled") {
          setCostCenters(ccRes.value.data?.items || ccRes.value.data || []);
        }

        if (projRes.status === "fulfilled") {
          setProjects(projRes.value.data?.items || projRes.value.data || []);
        }

        // If an existing approved loan ID is passed, load its details
        if (isEdit) {
          const loanRes = await api.get(`/hr/loans/${id}`).catch(() =>
            api.get(`/hr/loans?id=${id}`)
          );
          const found = loanRes.data?.item || loanRes.data?.items?.find((i) => String(i.id) === String(id));
          if (found) {
            setLoan(found);
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
            const empName = `${found.first_name || ""} ${found.last_name || ""}`.trim();
            setVoucherData((prev) => ({
              ...prev,
              narration: `Staff loan disbursement to ${empName} - ${found.loan_type || "Loan"}`,
            }));
          }
        }
      } catch (err) {
        toast.error("Failed to load initial disbursement data");
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, [id, isEdit]);

  // Determine if payment method is bank-like
  const isBankLike = useMemo(
    () => ["Cheque", "Bank Transfer", "Credit Card"].includes(voucherData.payment_method || ""),
    [voucherData.payment_method]
  );

  // Filter disbursement accounts strictly based on chosen payment method
  const filteredPaymentAccounts = useMemo(() => {
    if (!voucherData.payment_method) return paymentAccounts;
    return paymentAccounts.filter((a) => {
      const gc = String(a.group_code || "").toUpperCase();
      const gn = String(a.group_name || "").toUpperCase();
      return isBankLike
        ? gc === "AST_BANK" || gn.includes("BANK") || gc === "1006"
        : gc === "AST_CASH" || gn.includes("CASH") || gc === "1005";
    });
  }, [paymentAccounts, voucherData.payment_method, isBankLike]);

  // Calculations for monthly installment & projected end date
  const { monthlyInstallment, totalPayable, projectedEndDate, selectedEmp, selectedLoanTypeObj, empDept, empTitle, empSalary } =
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

      const emp = employees.find((e) => String(e.id) === String(formData.employee_id)) || (loan ? {
        ...loan,
        id: loan.employee_id,
        dept_name: loan.department || loan.dept_name,
        pos_name: loan.job_title || loan.pos_name || loan.position_name,
        base_salary: loan.base_salary,
      } : null);
      const ltObj = loanTypes.find(
        (lt) => String(lt.name).trim().toLowerCase() === String(formData.loan_type).trim().toLowerCase()
      );

      const empDept = emp?.dept_name || emp?.department_name || loan?.department || loan?.dept_name || "-";
      const empTitle = emp?.pos_name || emp?.job_title || emp?.designation || loan?.job_title || loan?.pos_name || loan?.position_name || "-";
      const empSalary = emp?.base_salary ?? emp?.basic_salary ?? loan?.base_salary ?? loan?.basic_salary;

      return {
        monthlyInstallment: Math.round(installment * 100) / 100,
        totalPayable: Math.round(total * 100) / 100,
        projectedEndDate: end,
        selectedEmp: emp,
        selectedLoanTypeObj: ltObj,
        empDept,
        empTitle,
        empSalary,
      };
    }, [formData, employees, loanTypes, loan]);

  // Auto-fill voucher narration when employee changes
  useEffect(() => {
    if (selectedEmp && !voucherData.narration) {
      const empName = `${selectedEmp.first_name || ""} ${selectedEmp.last_name || ""}`.trim();
      setVoucherData((prev) => ({
        ...prev,
        narration: `Staff loan disbursement to ${empName} - ${formData.loan_type}`,
      }));
    }
  }, [selectedEmp, formData.loan_type]);

  const handleDisburse = async (e) => {
    if (e) e.preventDefault();

    if (!formData.employee_id) {
      toast.error("Please select an employee");
      return;
    }
    const amt = Number(formData.amount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid loan disbursement amount");
      return;
    }
    if (!formData.start_date) {
      toast.error("Please specify the Disbursement / Start Repayment Date");
      return;
    }
    if (!voucherData.payment_method) {
      toast.error("Please select a Payment Method");
      return;
    }
    if (!voucherData.payment_account_id) {
      toast.error("Please select a Disbursement Account");
      return;
    }

    setSubmitting(true);
    try {
      const empName = selectedEmp
        ? `${selectedEmp.first_name || ""} ${selectedEmp.last_name || ""}`.trim()
        : "";
      const finalNarration =
        voucherData.narration ||
        `Staff loan disbursement to ${empName} - ${formData.loan_type}${formData.purpose ? ` (${formData.purpose})` : ""}`;

      if (isEdit) {
        // Disbursing an existing approved loan
        const payload = {
          payment_account_id: Number(voucherData.payment_account_id),
          disbursement_date: formData.start_date,
          disbursement_method: voucherData.payment_method,
          payment_method: voucherData.payment_method,
          cheque_date: isBankLike && voucherData.cheque_date ? voucherData.cheque_date : null,
          reference_no: voucherData.reference_no || null,
          cost_center_id: voucherData.cost_center_id ? Number(voucherData.cost_center_id) : null,
          project_id: voucherData.project_id ? Number(voucherData.project_id) : null,
          disbursement_notes: finalNarration,
        };

        const res = await api.post(`/hr/loans/${id}/disburse`, payload);
        toast.success(
          res.data?.message ||
            `Loan disbursed successfully! Payment Voucher ${res.data?.disbursement_voucher_no || ""} posted to Finance.`
        );
      } else {
        // Direct new loan disbursement with payment voucher creation
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
          status: "ACTIVE",
          auto_disburse: true,
          affect_payslip: formData.affect_payslip ? 1 : 0,
          payment_account_id: Number(voucherData.payment_account_id),
          payment_method: voucherData.payment_method,
          disbursement_method: voucherData.payment_method,
          reference_no: voucherData.reference_no,
          cheque_no: voucherData.reference_no,
          cheque_date: voucherData.cheque_date || null,
          cost_center_id: voucherData.cost_center_id ? Number(voucherData.cost_center_id) : null,
          project_id: voucherData.project_id ? Number(voucherData.project_id) : null,
          narration: finalNarration,
          disbursement_notes: finalNarration,
        };

        const res = await api.post("/hr/loans", payload);
        toast.success(
          res.data?.message ||
            "Loan disbursed successfully and Payment Voucher generated in Finance!"
        );
      }

      navigate("/human-resources/loans");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to process loan disbursement"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAccount = paymentAccounts.find(
    (a) => String(a.id) === String(voucherData.payment_account_id)
  );

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/human-resources/loans")}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Back to Loan Management"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {isEdit ? "Disburse Approved Staff Loan" : "Loan Disbursement"}
                </h1>
                {loan && (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                    {loan.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Disburse employee loan with Finance Payment Voucher and automated payroll deduction initiation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/human-resources/loans")}
              className="btn-secondary text-xs sm:text-sm"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDisburse}
              className="btn-primary flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm"
              disabled={submitting || loading}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Disbursing...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Disburse Loan
                </>
              )}
            </button>
          </div>
        </div>

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
                    disabled={isEdit}
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
                    disabled={isEdit}
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

              {(selectedEmp || loan) && (
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Department</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {empDept}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Job Title</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {empTitle}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Basic Salary</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {empSalary ? `GHS ${Number(empSalary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
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
                    disabled={isEdit}
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
                    disabled={isEdit}
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
                    disabled={isEdit}
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
                  disabled={isEdit}
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
                  />
                  <span>Deduct monthly installments automatically via Payroll</span>
                </label>
                <p className="text-xs text-slate-400 ml-6 mt-0.5">
                  When active, installments will automatically deduct from the employee's monthly payslip starting from the Disbursement / Start Repayment Date.
                </p>
              </div>
            </div>

            {/* Restored: Finance Payment Voucher (Direct Payment) Card */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Wallet size={16} className="text-emerald-600 dark:text-emerald-400" />
                  Finance Payment Voucher (Direct Payment)
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Payment Method *</label>
                  <select
                    className="input w-full"
                    required
                    value={voucherData.payment_method}
                    onChange={(e) => {
                      setVoucherData({
                        ...voucherData,
                        payment_method: e.target.value,
                        payment_account_id: "",
                      });
                    }}
                  >
                    <option value="">-- Select Payment Method --</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>

                <div>
                  <label className="label">
                    Disbursement Account ({isBankLike ? "Bank Account" : "Cash Account"}) <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="input w-full"
                    required
                    value={voucherData.payment_account_id}
                    onChange={(e) =>
                      setVoucherData({ ...voucherData, payment_account_id: e.target.value })
                    }
                  >
                    <option value="">-- Select {isBankLike ? "Bank Account" : "Cash Account"} --</option>
                    {filteredPaymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code ? `${a.code} - ` : ""}{a.name} ({a.group_name || a.nature})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Cheque / Reference No</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. CHQ-00192 or TRX-58392"
                    value={voucherData.reference_no}
                    onChange={(e) =>
                      setVoucherData({ ...voucherData, reference_no: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="label">Cheque Date</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={voucherData.cheque_date}
                    onChange={(e) =>
                      setVoucherData({ ...voucherData, cheque_date: e.target.value })
                    }
                  />
                </div>
              </div>

              {projects.length > 0 && (
                <div>
                  <label className="label">Project (Optional)</label>
                  <select
                    className="input w-full"
                    value={voucherData.project_id}
                    onChange={(e) =>
                      setVoucherData({ ...voucherData, project_id: e.target.value })
                    }
                  >
                    <option value="">-- None / Default --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code ? `${p.code} - ` : ""}{p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Payment Voucher Narration</label>
                <textarea
                  rows="2"
                  className="input w-full"
                  placeholder="Narration for the payment voucher in Finance..."
                  value={voucherData.narration}
                  onChange={(e) =>
                    setVoucherData({ ...voucherData, narration: e.target.value })
                  }
                />
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

            {/* GL Double Entry Summary Preview */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-200 block">
                Accounting GL Preview
              </span>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Dr: Staff Loan Asset ({selectedLoanTypeObj?.account_code || "1010"})</span>
                  <span>+{Number(formData.amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Cr: {selectedAccount ? selectedAccount.code : "Disbursement Account"}</span>
                  <span>-{Number(formData.amount || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Guard>
  );
}
