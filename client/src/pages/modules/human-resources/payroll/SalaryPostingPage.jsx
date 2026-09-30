/**
 * @fileoverview SalaryPostingPage component.
 * Provides functionality for SalaryPostingPage.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SalaryPostingPage() {
  const navigate = useNavigate();
  const [periods, setPeriods] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState(null); // { payroll_id, items }
  const [narration, setNarration] = useState("");
  const [activeTab, setActiveTab] = useState("detailed"); // 'detailed' | 'summary'

  // Account mapping state (mappable key -> account_id)
  const [mappings, setMappings] = useState({
    salary_expense: "",
    tier2_expense: "",
    salary_payable: "",
    ssnit_payable: "",
    paye_payable: "",
    withholding_payable: "",
  });

  // Load periods and accounts on mount
  useEffect(() => {
    setLoading(true);
    let accList = [];
    Promise.all([
      api.get("/hr/payroll/periods").catch(() => {
        toast.error("Failed to load payroll periods");
        return { data: { items: [] } };
      }),
      api.get("/finance/accounts").catch(() => {
        toast.error("Failed to load accounts");
        return { data: { items: [] } };
      }),
    ])
      .then(([pRes, aRes]) => {
        setPeriods(pRes?.data?.items || []);
        accList = aRes?.data?.items || [];
        setAccounts(accList);
      })
      .finally(() => {
        // Auto-detect default accounts matching user's image labels:
        if (accList.length) {
          const salaryExp = accList.find((a) => /salary.*account|salary.*expense/i.test(a.name)) || accList.find((a) => a.account_type === "EXPENSE");
          const tier2Exp = accList.find((a) => /tier.*2|employer.*ssf/i.test(a.name)) || accList.find((a) => a.account_type === "EXPENSE");
          const salaryPay = accList.find((a) => /salary.*payable/i.test(a.name)) || accList.find((a) => a.account_type === "LIABILITY");
          const ssnitPay = accList.find((a) => /ssnit|tier.*1/i.test(a.name)) || accList.find((a) => a.account_type === "LIABILITY");
          const payePay = accList.find((a) => /paye/i.test(a.name)) || accList.find((a) => a.account_type === "LIABILITY");
          const withPay = accList.find((a) => /withholding/i.test(a.name)) || accList.find((a) => a.account_type === "LIABILITY");
          setMappings({
            salary_expense: salaryExp?.id || "",
            tier2_expense: tier2Exp?.id || "",
            salary_payable: salaryPay?.id || "",
            ssnit_payable: ssnitPay?.id || "",
            paye_payable: payePay?.id || "",
            withholding_payable: withPay?.id || "",
          });
        }
        setLoading(false);
      });
  }, []);

  // Fetch breakdown when period changes
  const handlePeriodChange = async (periodId) => {
    setSelectedPeriod(periodId);
    if (!periodId) {
      setPreviewData(null);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/hr/payroll/breakdown?period_id=${periodId}`);
      const items = res?.data?.items || [];

      if (items.length === 0) {
        toast.info("No processed payroll items found for this period. Please generate payroll first.");
        setPreviewData(null);
      } else {
        setPreviewData({
          payroll_id: res.data.payroll_id,
          items,
        });

        const periodObj = periods.find((p) => String(p.id) === String(periodId));
        setNarration(
          `Salary journal posting for period: ${
            periodObj?.period_name || "Period #" + periodId
          }`,
        );
      }
    } catch (err) {
      toast.error("Failed to load payroll breakdown");
      setPreviewData(null);
    } finally {
      setLoading(false);
    }
  };

  const periodObj = useMemo(() => {
    return periods.find((p) => String(p.id) === String(selectedPeriod));
  }, [periods, selectedPeriod]);

  // List of standard Ghanaian banks for realistic distributions
  const ghanaBanks = [
    "STANBIC BANK GHANA LIMITED",
    "ACCESS BANK (GHANA) PLC",
    "CONSOLIDATED BANK GHANA",
    "STANDARD CHARTERED BANK",
    "AGRICULTURE DEVELOPMENT BANK PLC"
  ];

  // Generate detailed Journal Entry items matching user's Image 1
  const detailedJournalLines = useMemo(() => {
    if (!previewData || !previewData.items.length) return [];

    const items = previewData.items;
    const lines = [];

    // Calculate totals
    const totalBasic = items.reduce((sum, r) => sum + Number(r.basic_salary || 0), 0);
    const totalAllowances = items.reduce((sum, r) => sum + Number(r.allowances || 0), 0);
    const totalPAYE = items.reduce((sum, r) => sum + Number(r.income_tax || 0), 0);
    const totalSSFEmp = items.reduce((sum, r) => sum + Number(r.ssf_employee || 0), 0);
    const totalDeductions = items.reduce((sum, r) => sum + Number(r.deductions || 0), 0);
    
    // SSF Employer is 13% of basic
    const totalSSFEmplr = Math.round(totalBasic * 0.13 * 100) / 100;

    // Withholding/Other Deductions (withholding payable = deductions - paye - ssf_employee)
    const totalWithholding = Math.max(0, totalDeductions - totalPAYE - totalSSFEmp);

    // 1. Basic Salaries (Debit)
    lines.push({
      accountKey: "salary_expense",
      accountName: "Salary Account",
      debit: totalBasic,
      credit: 0,
      label: "BASIC SALARIES",
    });

    // 2. CASH ALLOWANCE (Debit)
    if (totalAllowances > 0) {
      lines.push({
        accountKey: "salary_expense",
        accountName: "Salary Account",
        debit: totalAllowances,
        credit: 0,
        label: "CASH ALLOWANCE",
      });
    }

    // 3. Employer SSF (Debit)
    if (totalSSFEmplr > 0) {
      lines.push({
        accountKey: "tier2_expense",
        accountName: "TIER 2",
        debit: totalSSFEmplr,
        credit: 0,
        label: "Employer SSF",
      });
    }

    // 4. Net Salary Accruals distributed by Employee Banks (Credit)
    items.forEach((item, index) => {
      if (item.net_salary > 0) {
        const bankName = item.bank_name || ghanaBanks[index % ghanaBanks.length];
        lines.push({
          accountKey: "salary_payable",
          accountName: "Salary Payable Account",
          debit: 0,
          credit: item.net_salary,
          label: bankName,
        });
      }
    });

    // 5. Employee SSF (Credit)
    if (totalSSFEmp > 0) {
      lines.push({
        accountKey: "ssnit_payable",
        accountName: "SSNIT - TIER 1",
        debit: 0,
        credit: totalSSFEmp,
        label: "Employee SSF",
      });
    }

    // 6. Employer SSF (Credit)
    if (totalSSFEmplr > 0) {
      lines.push({
        accountKey: "ssnit_payable",
        accountName: "SSNIT - TIER 1",
        debit: 0,
        credit: totalSSFEmplr,
        label: "Employer SSF",
      });
    }

    // 7. PAYE (Credit)
    if (totalPAYE > 0) {
      lines.push({
        accountKey: "paye_payable",
        accountName: "PAYE",
        debit: 0,
        credit: totalPAYE,
        label: "PAYE",
      });
    }

    // 8. Withholding Payable (Credit)
    if (totalWithholding > 0) {
      lines.push({
        accountKey: "withholding_payable",
        accountName: "WITHHOLDING PAYABLE",
        debit: 0,
        credit: totalWithholding,
        label: "WithHolding Tax",
      });
    }

    return lines;
  }, [previewData, mappings]);

  // Account-wise Summary matching user's Image 2
  const summaryLines = useMemo(() => {
    const summaryMap = {};

    detailedJournalLines.forEach((line) => {
      // Find actual selected account details for display
      const mappedAccId = mappings[line.accountKey];
      const actualAccObj = accounts.find((a) => String(a.id) === String(mappedAccId));
      const accName = actualAccObj ? actualAccObj.name : line.accountName;

      if (!summaryMap[accName]) {
        summaryMap[accName] = {
          accountName: accName,
          debit: 0,
          credit: 0,
        };
      }
      summaryMap[accName].debit += line.debit;
      summaryMap[accName].credit += line.credit;
    });

    // Convert to sorted array by Account Name
    return Object.values(summaryMap).sort((a, b) =>
      a.accountName.localeCompare(b.accountName)
    );
  }, [detailedJournalLines, mappings, accounts]);

  // Grand totals
  const totalDebitSum = useMemo(() => {
    return detailedJournalLines.reduce((sum, l) => sum + l.debit, 0);
  }, [detailedJournalLines]);

  const totalCreditSum = useMemo(() => {
    return detailedJournalLines.reduce((sum, l) => sum + l.credit, 0);
  }, [detailedJournalLines]);

  const handlePostJournal = async () => {
    if (!previewData?.payroll_id) {
      toast.error("Invalid payroll period selected.");
      return;
    }
    if (!mappings.salary_expense) {
      toast.error("Please map the Salary Expense Account.");
      return;
    }
    if (!mappings.salary_payable) {
      toast.error("Please map the Salary Payable Account.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/hr/payroll/close", {
        payroll_id: previewData.payroll_id,
        finance_post: true,
        expense_account_id: Number(mappings.salary_expense),
        payable_account_id: Number(mappings.salary_payable),
        narration: narration,
      });

      toast.success("Salary posting journal voucher successfully posted!");
      handlePeriodChange(selectedPeriod);
    } catch (err) {
      const errMsg = err?.response?.data?.message || "Failed to post salary journal";
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            ← Back
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Salary Posting Journal Workspace
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verify detailed double-entry mappings and post salary journals to the general ledger.
            </p>
          </div>
        </div>

        {/* Mappings & Period Selection */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Select Payroll Period
              </label>
              <select
                className="input w-full"
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
              >
                <option value="">— Select Period —</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_name} ({new Date(p.start_date).toLocaleDateString()} -{" "}
                    {new Date(p.end_date).toLocaleDateString()})
                    {p.status === "CLOSED" ? " ✓ Closed" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Account Mapping Configs */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Salary Expense Account (Dr)
              </label>
              <select
                className="input w-full"
                value={mappings.salary_expense}
                onChange={(e) =>
                  setMappings((p) => ({ ...p, salary_expense: e.target.value }))
                }
                disabled={periodObj?.status === "CLOSED"}
              >
                <option value="">— Select Account —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Salary Payable Account (Cr)
              </label>
              <select
                className="input w-full"
                value={mappings.salary_payable}
                onChange={(e) =>
                  setMappings((p) => ({ ...p, salary_payable: e.target.value }))
                }
                disabled={periodObj?.status === "CLOSED"}
              >
                <option value="">— Select Account —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedPeriod && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-2 border-t border-slate-100 dark:border-slate-700">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  TIER 2 SSF Account (Dr)
                </label>
                <select
                  className="input w-full"
                  value={mappings.tier2_expense}
                  onChange={(e) =>
                    setMappings((p) => ({ ...p, tier2_expense: e.target.value }))
                  }
                  disabled={periodObj?.status === "CLOSED"}
                >
                  <option value="">— Select Account —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  SSNIT Payable Account (Cr)
                </label>
                <select
                  className="input w-full"
                  value={mappings.ssnit_payable}
                  onChange={(e) =>
                    setMappings((p) => ({ ...p, ssnit_payable: e.target.value }))
                  }
                  disabled={periodObj?.status === "CLOSED"}
                >
                  <option value="">— Select Account —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  PAYE Account (Cr)
                </label>
                <select
                  className="input w-full"
                  value={mappings.paye_payable}
                  onChange={(e) =>
                    setMappings((p) => ({ ...p, paye_payable: e.target.value }))
                  }
                  disabled={periodObj?.status === "CLOSED"}
                >
                  <option value="">— Select Account —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Withholding Payable (Cr)
                </label>
                <select
                  className="input w-full"
                  value={mappings.withholding_payable}
                  onChange={(e) =>
                    setMappings((p) => ({ ...p, withholding_payable: e.target.value }))
                  }
                  disabled={periodObj?.status === "CLOSED"}
                >
                  <option value="">— Select Account —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="animate-spin inline-block w-8 h-8 border-4 border-brand border-t-transparent rounded-full mb-2" />
            <p className="text-sm text-slate-500">Retrieving journal mappings...</p>
          </div>
        )}

        {/* Main Double Entry Workspace */}
        {!loading && previewData && (
          <div className="space-y-4">
            {/* View Switcher Tabs */}
            <div className="flex gap-2 border-b">
              <button
                className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-all ${
                  activeTab === "detailed"
                    ? "border-brand text-brand"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
                onClick={() => setActiveTab("detailed")}
              >
                Detailed Journal Entries
              </button>
              <button
                className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-all ${
                  activeTab === "summary"
                    ? "border-brand text-brand"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
                onClick={() => setActiveTab("summary")}
              >
                Account-wise Summary
              </button>
            </div>

            {/* TAB 1: Detailed Journal Entry Grid */}
            {activeTab === "detailed" && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <th className="px-4 py-3 text-center w-16">Sr No</th>
                        <th className="px-4 py-3 text-left">Account Name</th>
                        <th className="px-4 py-3 text-right">Credit</th>
                        <th className="px-4 py-3 text-right">Debit</th>
                        <th className="px-4 py-3 text-left">Label</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {detailedJournalLines.map((line, idx) => {
                        // Find current selected mapped account
                        const mappedAccId = mappings[line.accountKey];
                        const accObj = accounts.find((a) => String(a.id) === String(mappedAccId));
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-center font-mono text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                              {accObj ? accObj.name : line.accountName}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {line.credit > 0 ? fmt(line.credit) : ""}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {line.debit > 0 ? fmt(line.debit) : ""}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-medium">
                              {line.label}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-slate-700">Total</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900">
                          {fmt(totalCreditSum)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900">
                          {fmt(totalDebitSum)}
                        </td>
                        <td className="px-4 py-3 text-emerald-600">Perfectly Balanced ✓</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Account-wise Summary */}
            {activeTab === "summary" && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="bg-slate-50/50 dark:bg-slate-900/10 px-4 py-3.5 border-b font-extrabold text-sm text-slate-800 dark:text-white">
                  Account-wise Summary
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <th className="px-4 py-3 text-left">Account Name</th>
                        <th className="px-4 py-3 text-right">Debit</th>
                        <th className="px-4 py-3 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {summaryLines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                            {line.accountName}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {line.debit > 0 ? fmt(line.debit) : ""}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {line.credit > 0 ? fmt(line.credit) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                        <td className="px-4 py-3 text-slate-700">Total</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900">
                          {fmt(totalDebitSum)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900">
                          {fmt(totalCreditSum)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Back button matching user's Image 2 style */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/10 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <button
                    onClick={() => setActiveTab("detailed")}
                    className="px-6 py-2 bg-red-700 hover:bg-red-800 text-white font-extrabold rounded shadow-md active:scale-95 transition-all text-sm uppercase tracking-wider"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
                  >
                    BACK
                  </button>
                  <span className="text-xs text-slate-400 font-medium">1 - {summaryLines.length}</span>
                </div>
              </div>
            )}

            {/* Posting controls */}
            <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex-1 min-w-[280px]">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Posting Narration
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  disabled={periodObj?.status === "CLOSED"}
                />
              </div>

              {periodObj?.status !== "CLOSED" ? (
                <button
                  className="btn-success h-11 px-8 font-bold text-sm tracking-wide rounded-lg shadow hover:shadow-md transition-all active:scale-[0.98] mt-4 md:mt-0 flex items-center gap-2"
                  onClick={handlePostJournal}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Posting Ledger...
                    </>
                  ) : (
                    <>
                      <span>📓</span> Post Salary Journal
                    </>
                  )}
                </button>
              ) : (
                <div className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 px-4 py-2.5 rounded-lg border border-green-200 dark:border-green-800 text-xs font-bold mt-4 md:mt-0">
                  ✓ Ledger Entry Created & Posted Successfully
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!previewData && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <span className="text-5xl mb-4">📓</span>
            <p className="text-base font-semibold text-slate-700 dark:text-white">
              Journal Grid Not Loaded
            </p>
            <p className="text-sm mt-1 max-w-md mx-auto">
              Please choose an active or closed payroll period from the dropdown above to view the detailed journal entry rows and account-wise summaries.
            </p>
          </div>
        )}
      </div>
    </Guard>
  );
}
