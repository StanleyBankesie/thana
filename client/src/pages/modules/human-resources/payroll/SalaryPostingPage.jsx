/**
 * @fileoverview SalaryPostingPage component.
 * Provides double-entry journal mapping and general ledger posting
 * based on current payroll, statutory contributions, and staff loan deductions.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function SalaryPostingPage() {
  const navigate = useNavigate();
  const [periods, setPeriods] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [salaryComponents, setSalaryComponents] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState(null); // { payroll_id, items, loan_summary }
  const [narration, setNarration] = useState("");
  const [activeTab, setActiveTab] = useState("detailed"); // 'detailed' | 'summary'

  // Account mappings state (mappable key -> account_id)
  const [mappings, setMappings] = useState({
    salary_expense: "",
    allowances_expense: "",
    ssf_employer_expense: "",
    tier3_employer_expense: "",
    salary_payable: "",
    ssnit_payable: "",
    tier3_payable: "",
    paye_payable: "",
    deductions_payable: "",
  });

  // Fetch breakdown for a given period
  const fetchBreakdown = useCallback(async (periodId, periodList = periods) => {
    if (!periodId) {
      setPreviewData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/hr/payroll/breakdown?period_id=${periodId}`);
      const items = res?.data?.items || [];
      const loanSummary = res?.data?.loan_summary || [];

      if (items.length === 0) {
        toast.info("No processed payroll items found for this period. Click 'Sync Current Salary Data' to calculate.");
        setPreviewData(null);
      } else {
        setPreviewData({
          payroll_id: res.data.payroll_id,
          items,
          loan_summary: loanSummary,
        });

        // Seed loan account mappings dynamically from detected loan recoveries
        setMappings((prev) => {
          const updated = { ...prev };
          loanSummary.forEach((ls) => {
            const key = `loan_account_${ls.account_id || ls.loan_type}`;
            if (!updated[key] && ls.account_id) {
              updated[key] = String(ls.account_id);
            }
          });
          return updated;
        });

        const periodObj = periodList.find((p) => String(p.id) === String(periodId));
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
  }, [periods]);

  // Load periods, accounts, and component mappings on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/hr/payroll/periods").catch(() => {
        toast.error("Failed to load payroll periods");
        return { data: { items: [] } };
      }),
      api.get("/finance/accounts").catch(() => {
        toast.error("Failed to load accounts");
        return { data: { items: [] } };
      }),
      api.get("/hr/salary-components").catch(() => {
        return { data: { items: [] } };
      }),
    ])
      .then(([pRes, aRes, scRes]) => {
        const periodList = pRes?.data?.items || [];
        const accList = aRes?.data?.items || [];
        const compList = scRes?.data?.items || [];

        setPeriods(periodList);
        setAccounts(accList);
        setSalaryComponents(compList);

        // Build component account mapping lookup from HR Setup
        const compMap = {};
        for (const c of compList) {
          if (c.account_id) {
            compMap[c.column_name] = c.account_id;
          }
        }

        // Account lookup helpers
        const findAcc = (regex, balanceType) =>
          accList.find((a) => regex.test(a.name) && (!balanceType || a.balance_type === balanceType)) ||
          accList.find((a) => regex.test(a.name));

        const salaryExp = compMap["basic_salary"] || findAcc(/salaries\s*and\s*wages|salary.*expense/i, "DEBIT")?.id || "";
        const allowancesExp = compMap["allowances"] || findAcc(/staff\s*allowance/i, "DEBIT")?.id || salaryExp || "";
        const ssfEmplrExp = compMap["ssf_employer"] || salaryExp || "";
        const tier3EmplrExp = compMap["tier3_employer"] || salaryExp || "";

        const salaryPay = compMap["net_salary"] || findAcc(/salaries\s*payable|salary.*payable/i, "CREDIT")?.id || "";
        const ssnitPay = compMap["ssnit"] || compMap["ssf_employee"] || findAcc(/ssnit|pension\s*payable/i, "CREDIT")?.id || "";
        const tier3Pay = compMap["tier3_employee"] || compMap["tier3"] || compMap["tier2"] || findAcc(/tier\s*3.*payable|tier\s*2.*payable/i, "CREDIT")?.id || "";
        const payePay = compMap["income_tax"] || findAcc(/paye\s*payable/i, "CREDIT")?.id || "";
        const deductionsPay = compMap["deductions"] || salaryPay || "";

        setMappings((prev) => ({
          ...prev,
          salary_expense: salaryExp,
          allowances_expense: allowancesExp,
          ssf_employer_expense: ssfEmplrExp,
          tier3_employer_expense: tier3EmplrExp,
          salary_payable: salaryPay,
          ssnit_payable: ssnitPay,
          tier3_payable: tier3Pay,
          paye_payable: payePay,
          deductions_payable: deductionsPay,
        }));

        // Auto-select latest open or first period
        if (periodList.length > 0 && !selectedPeriod) {
          const defaultP = periodList.find((p) => p.status === "OPEN") || periodList[0];
          setSelectedPeriod(String(defaultP.id));
          fetchBreakdown(defaultP.id, periodList);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handlePeriodChange = (periodId) => {
    setSelectedPeriod(periodId);
    fetchBreakdown(periodId);
  };

  // Sync / Recalculate payroll based on current employee salaries and setup
  const handleSyncCurrentSalaries = async () => {
    if (!selectedPeriod) {
      toast.warn("Please select a payroll period first");
      return;
    }
    setSyncing(true);
    try {
      await api.post("/hr/payroll/generate", {
        period_id: Number(selectedPeriod),
      });
      toast.success("Payroll synchronized with current employee salaries and loan deductions!");
      await fetchBreakdown(selectedPeriod);
    } catch (err) {
      const errMsg = err?.response?.data?.message || "Failed to synchronize current salary data";
      toast.error(errMsg);
    } finally {
      setSyncing(false);
    }
  };

  const periodObj = useMemo(() => {
    return periods.find((p) => String(p.id) === String(selectedPeriod));
  }, [periods, selectedPeriod]);

  // Detected staff loan recoveries
  const loanSummaries = useMemo(() => {
    return previewData?.loan_summary || [];
  }, [previewData]);

  // Generate detailed balanced Journal Entry lines based on current salary data
  const detailedJournalLines = useMemo(() => {
    if (!previewData || !previewData.items || !previewData.items.length) return [];

    const items = previewData.items;
    const lines = [];

    // 1. Basic Salaries Total
    const totalBasic = items.reduce((sum, r) => sum + Number(r.basic_salary || 0), 0);

    // 2. Allowances Total (from raw allowances or sum of custom earnings)
    const totalAllowances = items.reduce((sum, r) => {
      const raw = Number(r.allowances_raw ?? r.allowances_total ?? 0);
      if (raw > 0) return sum + raw;
      const compSum = (r.employee_components || [])
        .filter((c) => c.is_earning)
        .reduce((s, c) => s + Number(c.amount || 0), 0);
      return sum + compSum;
    }, 0);

    // 3. Statutory & Deductions Totals
    const totalPAYE = items.reduce((sum, r) => sum + Number(r.income_tax || 0), 0);
    const totalSSFEmp = items.reduce((sum, r) => sum + Number(r.ssf_employee || 0), 0);
    const totalSSFEmplr = items.reduce(
      (sum, r) =>
        sum +
        Number(
          r.ssf_employer ||
            Math.round(Number(r.basic_salary || 0) * 0.13 * 100) / 100,
        ),
      0,
    );
    const totalTier3Emp = items.reduce((sum, r) => sum + Number(r.tier3_employee || 0), 0);
    const totalTier3Emplr = items.reduce(
      (sum, r) =>
        sum +
        Number(
          r.tier3_employer ||
            Math.round(Number(r.basic_salary || 0) * 0.10 * 100) / 100,
        ),
      0,
    );

    // 4. Loan Deductions Total
    const totalLoans = (previewData.loan_summary || []).reduce(
      (sum, l) => sum + Number(l.total_amount || 0),
      0,
    );

    const totalDeductions = items.reduce((sum, r) => sum + Number(r.deductions || 0), 0);
    const totalOtherDeductions = Math.max(
      0,
      Math.round(
        (totalDeductions - totalPAYE - totalSSFEmp - totalTier3Emp - totalLoans) * 100,
      ) / 100,
    );

    // ─── DEBITS (EXPENSES) ───
    // 1. Basic Salaries (Debit)
    lines.push({
      accountKey: "salary_expense",
      defaultName: "Salaries and Wages",
      debit: Math.round(totalBasic * 100) / 100,
      credit: 0,
      label: "BASIC SALARIES",
    });

    // 2. Staff Allowances (Debit)
    if (totalAllowances > 0) {
      lines.push({
        accountKey: "allowances_expense",
        defaultName: "Staff Allowances",
        debit: Math.round(totalAllowances * 100) / 100,
        credit: 0,
        label: "STAFF ALLOWANCES & EARNINGS",
      });
    }

    // 3. Employer SSF Contribution (Debit)
    if (totalSSFEmplr > 0) {
      lines.push({
        accountKey: "ssf_employer_expense",
        defaultName: "Employer SSF Expense",
        debit: Math.round(totalSSFEmplr * 100) / 100,
        credit: 0,
        label: "EMPLOYER SSF CONTRIBUTION (13%)",
      });
    }

    // 4. Employer Tier 3 Contribution (Debit)
    if (totalTier3Emplr > 0) {
      lines.push({
        accountKey: "tier3_employer_expense",
        defaultName: "Employer Tier 3 Expense",
        debit: Math.round(totalTier3Emplr * 100) / 100,
        credit: 0,
        label: "EMPLOYER TIER 3 PROVIDENT FUND (10%)",
      });
    }

    // ─── CREDITS (LIABILITIES, PAYABLES & LOAN ASSET RECOVERIES) ───
    // 5. Net Salary Accruals by Employee (Credit)
    items.forEach((item) => {
      const net = Number(item.net_salary || 0);
      if (net > 0) {
        const empName =
          `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
          item.emp_code;
        const bName = item.bank_name ? ` (${item.bank_name})` : "";
        lines.push({
          accountKey: "salary_payable",
          defaultName: "Salaries Payable",
          debit: 0,
          credit: Math.round(net * 100) / 100,
          label: `${empName}${bName}`,
        });
      }
    });

    // 6. SSNIT / SSF Payable (Credit)
    const totalSSNIT = Math.round((totalSSFEmp + totalSSFEmplr) * 100) / 100;
    if (totalSSNIT > 0) {
      lines.push({
        accountKey: "ssnit_payable",
        defaultName: "SSNIT/Pension Payable",
        debit: 0,
        credit: totalSSNIT,
        label: `SSNIT / FIRST TIER PENSION (Emp ${fmt(totalSSFEmp)} + Emplr ${fmt(totalSSFEmplr)})`,
      });
    }

    // 7. Tier 3 Provident Fund Payable (Credit)
    const totalTier3 = Math.round((totalTier3Emp + totalTier3Emplr) * 100) / 100;
    if (totalTier3 > 0) {
      lines.push({
        accountKey: "tier3_payable",
        defaultName: "Tier 3 Payable",
        debit: 0,
        credit: totalTier3,
        label: `TIER 3 PROVIDENT FUND (Emp ${fmt(totalTier3Emp)} + Emplr ${fmt(totalTier3Emplr)})`,
      });
    }

    // 8. Income Tax / PAYE (Credit)
    if (totalPAYE > 0) {
      lines.push({
        accountKey: "paye_payable",
        defaultName: "PAYE Payable",
        debit: 0,
        credit: Math.round(totalPAYE * 100) / 100,
        label: "GRA PAYE INCOME TAX",
      });
    }

    // 9. Staff Loan Recoveries Credited to Respective Loan Accounts (Credit)
    (previewData.loan_summary || []).forEach((ls) => {
      if (Number(ls.total_amount || 0) > 0) {
        const accKey = `loan_account_${ls.account_id || ls.loan_type}`;
        lines.push({
          accountKey: accKey,
          accountId: ls.account_id,
          defaultName: ls.account_name || `Staff Loan - ${ls.loan_type}`,
          debit: 0,
          credit: Math.round(Number(ls.total_amount) * 100) / 100,
          label: `STAFF LOAN RECOVERY: ${ls.loan_type} (${ls.repayment_count} repayment${ls.repayment_count > 1 ? "s" : ""})`,
        });
      }
    });

    // 10. Other Deductions Payable (Credit)
    if (totalOtherDeductions > 0) {
      lines.push({
        accountKey: "deductions_payable",
        defaultName: "Other Deductions Payable",
        debit: 0,
        credit: Math.round(totalOtherDeductions * 100) / 100,
        label: "OTHER PAYROLL DEDUCTIONS",
      });
    }

    return lines;
  }, [previewData, mappings]);

  // Account-wise Summary Tab
  const summaryLines = useMemo(() => {
    const summaryMap = {};

    detailedJournalLines.forEach((line) => {
      const mappedAccId = mappings[line.accountKey] || line.accountId;
      const actualAccObj = accounts.find((a) => String(a.id) === String(mappedAccId));
      const accDisplay = actualAccObj
        ? `${actualAccObj.code ? actualAccObj.code + " - " : ""}${actualAccObj.name}`
        : line.defaultName;

      if (!summaryMap[accDisplay]) {
        summaryMap[accDisplay] = {
          accountName: accDisplay,
          debit: 0,
          credit: 0,
        };
      }
      summaryMap[accDisplay].debit += line.debit;
      summaryMap[accDisplay].credit += line.credit;
    });

    return Object.values(summaryMap).sort((a, b) =>
      a.accountName.localeCompare(b.accountName),
    );
  }, [detailedJournalLines, mappings, accounts]);

  // Grand totals
  const totalDebitSum = useMemo(() => {
    return (
      Math.round(
        detailedJournalLines.reduce((sum, l) => sum + l.debit, 0) * 100,
      ) / 100
    );
  }, [detailedJournalLines]);

  const totalCreditSum = useMemo(() => {
    return (
      Math.round(
        detailedJournalLines.reduce((sum, l) => sum + l.credit, 0) * 100,
      ) / 100
    );
  }, [detailedJournalLines]);

  const isBalanced = useMemo(() => {
    return Math.abs(totalDebitSum - totalCreditSum) < 0.01 && totalDebitSum > 0;
  }, [totalDebitSum, totalCreditSum]);

  // Key KPI totals for current salary dataset
  const kpiStats = useMemo(() => {
    if (!previewData || !previewData.items || !previewData.items.length) {
      return { basic: 0, allowances: 0, employerContrib: 0, loans: 0, net: 0, taxStatutory: 0 };
    }
    const items = previewData.items;
    const basic = items.reduce((s, r) => s + Number(r.basic_salary || 0), 0);
    const allowances = items.reduce((sum, r) => {
      const raw = Number(r.allowances_raw ?? r.allowances_total ?? 0);
      if (raw > 0) return sum + raw;
      const compSum = (r.employee_components || [])
        .filter((c) => c.is_earning)
        .reduce((s, c) => s + Number(c.amount || 0), 0);
      return sum + compSum;
    }, 0);
    const ssfEmplr = items.reduce(
      (s, r) =>
        s +
        Number(
          r.ssf_employer ||
            Math.round(Number(r.basic_salary || 0) * 0.13 * 100) / 100,
        ),
      0,
    );
    const tier3Emplr = items.reduce(
      (s, r) =>
        s +
        Number(
          r.tier3_employer ||
            Math.round(Number(r.basic_salary || 0) * 0.10 * 100) / 100,
        ),
      0,
    );
    const loans = (previewData.loan_summary || []).reduce(
      (s, l) => s + Number(l.total_amount || 0),
      0,
    );
    const net = items.reduce((s, r) => s + Number(r.net_salary || 0), 0);
    const paye = items.reduce((s, r) => s + Number(r.income_tax || 0), 0);
    const ssfEmp = items.reduce((s, r) => s + Number(r.ssf_employee || 0), 0);
    const tier3Emp = items.reduce((s, r) => s + Number(r.tier3_employee || 0), 0);

    return {
      basic,
      allowances,
      employerContrib: ssfEmplr + tier3Emplr,
      loans,
      net,
      taxStatutory: paye + ssfEmp + ssfEmplr + tier3Emp + tier3Emplr,
    };
  }, [previewData]);

  // Submit and post journal to General Ledger
  const handlePostJournal = async () => {
    if (!previewData?.payroll_id) {
      toast.error("Invalid payroll period selected.");
      return;
    }
    if (!mappings.salary_expense) {
      toast.error("Please select the Basic Salary Expense Account.");
      return;
    }
    if (!mappings.salary_payable) {
      toast.error("Please select the Salaries Payable Account.");
      return;
    }
    if (!isBalanced) {
      toast.error("Cannot post an unbalanced journal voucher.");
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
        mappings: mappings,
      });

      toast.success("Salary posting journal voucher successfully posted to General Ledger!");
      // Refresh period and preview
      const pRes = await api.get("/hr/payroll/periods");
      const updatedPeriods = pRes?.data?.items || [];
      setPeriods(updatedPeriods);
      fetchBreakdown(selectedPeriod, updatedPeriods);
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="btn-secondary text-sm"
            >
              ← Back
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>📓</span> Salary Posting Journal Workspace
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify detailed double-entry mappings and post salary journals to the general ledger based on current salary data and staff loan recoveries.
              </p>
            </div>
          </div>

          {selectedPeriod && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncCurrentSalaries}
                disabled={syncing || loading || periodObj?.status === "CLOSED"}
                className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                title="Recalculates payroll items using latest employee salary profiles, allowances, and statutory settings"
              >
                <span className={syncing ? "animate-spin" : ""}>🔄</span>
                <span>{syncing ? "Syncing..." : "Sync Current Salary Data"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Configuration: Period & Double-Entry Account Mappings */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Select Payroll Period
              </label>
              <div className="flex items-center gap-2">
                <select
                  className="input flex-1"
                  value={selectedPeriod}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                >
                  <option value="">— Select Payroll Period —</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.period_name} ({new Date(p.start_date).toLocaleDateString()} -{" "}
                      {new Date(p.end_date).toLocaleDateString()})
                      {p.status === "CLOSED" ? " ✓ Closed" : " [Open]"}
                    </option>
                  ))}
                </select>
                {periodObj && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1.5 rounded-md ${
                      periodObj.status === "CLOSED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {periodObj.status === "CLOSED" ? "POSTED / CLOSED" : "OPEN FOR POSTING"}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Posting Narration
              </label>
              <input
                type="text"
                className="input w-full text-xs"
                placeholder="Narration for general ledger voucher..."
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                disabled={periodObj?.status === "CLOSED"}
              />
            </div>
          </div>

          {/* Account Mappings: Debits & Credits Grid */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                Double-Entry Account Mappings
              </span>
              <span className="text-[11px] text-slate-400">
                Pre-loaded from HR Setup &gt; Salary Mapping &amp; Loan Setup. Adjustable before posting.
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* DEBIT ACCOUNTS (EXPENSES) */}
              <div className="bg-slate-50/70 dark:bg-slate-900/30 p-3.5 rounded-lg border border-slate-200/80 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                  <span>📈</span> Debit Accounts (Company Expenses)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                      Basic Salary Expense (Dr) *
                    </label>
                    <select
                      className="input text-xs w-full"
                      value={mappings.salary_expense}
                      onChange={(e) =>
                        setMappings((p) => ({ ...p, salary_expense: e.target.value }))
                      }
                      disabled={periodObj?.status === "CLOSED"}
                    >
                      <option value="">— Select Account —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} - ` : ""}{a.name} ({a.balance_type || "EXPENSE"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                      Allowances &amp; Earnings (Dr)
                    </label>
                    <select
                      className="input text-xs w-full"
                      value={mappings.allowances_expense}
                      onChange={(e) =>
                        setMappings((p) => ({ ...p, allowances_expense: e.target.value }))
                      }
                      disabled={periodObj?.status === "CLOSED"}
                    >
                      <option value="">— Select Account —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} - ` : ""}{a.name} ({a.balance_type || "EXPENSE"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                      Employer SSF (13%) Expense (Dr)
                    </label>
                    <select
                      className="input text-xs w-full"
                      value={mappings.ssf_employer_expense}
                      onChange={(e) =>
                        setMappings((p) => ({ ...p, ssf_employer_expense: e.target.value }))
                      }
                      disabled={periodObj?.status === "CLOSED"}
                    >
                      <option value="">— Select Account —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} - ` : ""}{a.name} ({a.balance_type || "EXPENSE"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                      Employer Tier 3 (10%) Expense (Dr)
                    </label>
                    <select
                      className="input text-xs w-full"
                      value={mappings.tier3_employer_expense}
                      onChange={(e) =>
                        setMappings((p) => ({ ...p, tier3_employer_expense: e.target.value }))
                      }
                      disabled={periodObj?.status === "CLOSED"}
                    >
                      <option value="">— Select Account —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} - ` : ""}{a.name} ({a.balance_type || "EXPENSE"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* CREDIT ACCOUNTS (LIABILITIES, PAYABLES & LOAN RECOVERIES) */}
              <div className="bg-slate-50/70 dark:bg-slate-900/30 p-3.5 rounded-lg border border-slate-200/80 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <span>📉</span> Credit Accounts (Payables &amp; Loan Recoveries)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                      Salaries Payable (Net Pay) (Cr) *
                    </label>
                    <select
                      className="input text-xs w-full"
                      value={mappings.salary_payable}
                      onChange={(e) =>
                        setMappings((p) => ({ ...p, salary_payable: e.target.value }))
                      }
                      disabled={periodObj?.status === "CLOSED"}
                    >
                      <option value="">— Select Account —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} - ` : ""}{a.name} ({a.balance_type || "LIABILITY"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                      SSNIT / First Tier Payable (Cr)
                    </label>
                    <select
                      className="input text-xs w-full"
                      value={mappings.ssnit_payable}
                      onChange={(e) =>
                        setMappings((p) => ({ ...p, ssnit_payable: e.target.value }))
                      }
                      disabled={periodObj?.status === "CLOSED"}
                    >
                      <option value="">— Select Account —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} - ` : ""}{a.name} ({a.balance_type || "LIABILITY"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                      Tier 3 Provident Fund Payable (Cr)
                    </label>
                    <select
                      className="input text-xs w-full"
                      value={mappings.tier3_payable}
                      onChange={(e) =>
                        setMappings((p) => ({ ...p, tier3_payable: e.target.value }))
                      }
                      disabled={periodObj?.status === "CLOSED"}
                    >
                      <option value="">— Select Account —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} - ` : ""}{a.name} ({a.balance_type || "LIABILITY"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                      GRA PAYE Income Tax Payable (Cr)
                    </label>
                    <select
                      className="input text-xs w-full"
                      value={mappings.paye_payable}
                      onChange={(e) =>
                        setMappings((p) => ({ ...p, paye_payable: e.target.value }))
                      }
                      disabled={periodObj?.status === "CLOSED"}
                    >
                      <option value="">— Select Account —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} - ` : ""}{a.name} ({a.balance_type || "LIABILITY"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dynamic Staff Loan Recovery Accounts */}
                  {loanSummaries.map((ls) => {
                    const accKey = `loan_account_${ls.account_id || ls.loan_type}`;
                    return (
                      <div key={accKey} className="sm:col-span-2 bg-indigo-50/60 dark:bg-indigo-950/20 p-2 rounded-lg border border-indigo-200/60 dark:border-indigo-800/40">
                        <label className="block text-[11px] font-bold text-indigo-900 dark:text-indigo-300 mb-0.5">
                          Staff Loan Recovery Account: {ls.loan_type} (Cr)
                          <span className="text-[10px] font-normal text-indigo-600 dark:text-indigo-400 ml-1.5">
                            (GHS {fmt(ls.total_amount)} recovered)
                          </span>
                        </label>
                        <select
                          className="input text-xs w-full"
                          value={mappings[accKey] || ls.account_id || ""}
                          onChange={(e) =>
                            setMappings((p) => ({ ...p, [accKey]: e.target.value }))
                          }
                          disabled={periodObj?.status === "CLOSED"}
                        >
                          <option value="">— Select Loan Asset Account —</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? `${a.code} - ` : ""}{a.name} ({a.balance_type || "ASSET"})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5">
                      Other Deductions / Withholding Payable (Cr)
                    </label>
                    <select
                      className="input text-xs w-full"
                      value={mappings.deductions_payable}
                      onChange={(e) =>
                        setMappings((p) => ({ ...p, deductions_payable: e.target.value }))
                      }
                      disabled={periodObj?.status === "CLOSED"}
                    >
                      <option value="">— Select Account (Optional) —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} - ` : ""}{a.name} ({a.balance_type || "LIABILITY"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current Salary Data Summary Cards */}
        {previewData && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Basic Salaries</span>
              <div className="text-base font-bold text-slate-800 dark:text-white mt-0.5 font-mono">
                GHS {fmt(kpiStats.basic)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Allowances</span>
              <div className="text-base font-bold text-slate-800 dark:text-white mt-0.5 font-mono">
                GHS {fmt(kpiStats.allowances)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Employer SSF/Tier3</span>
              <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
                GHS {fmt(kpiStats.employerContrib)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 uppercase font-bold">Loan Recoveries</span>
              <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono">
                GHS {fmt(kpiStats.loans)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Net Payables</span>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                GHS {fmt(kpiStats.net)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Debits</span>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5 font-mono">
                GHS {fmt(totalDebitSum)}
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="animate-spin inline-block w-8 h-8 border-4 border-brand border-t-transparent rounded-full mb-2" />
            <p className="text-sm text-slate-500">Loading current salary data, staff loans, and journal breakdown...</p>
          </div>
        )}

        {/* Main Double Entry Workspace */}
        {!loading && previewData && (
          <div className="space-y-4">
            {/* View Switcher Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
              <button
                className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-all ${
                  activeTab === "detailed"
                    ? "border-brand text-brand"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
                onClick={() => setActiveTab("detailed")}
              >
                Detailed Journal Entries ({detailedJournalLines.length})
              </button>
              <button
                className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-all ${
                  activeTab === "summary"
                    ? "border-brand text-brand"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
                onClick={() => setActiveTab("summary")}
              >
                Account-wise Summary ({summaryLines.length})
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
                        <th className="px-4 py-3 text-right">Debit (GHS)</th>
                        <th className="px-4 py-3 text-right">Credit (GHS)</th>
                        <th className="px-4 py-3 text-left">Label / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {detailedJournalLines.map((line, idx) => {
                        const mappedAccId = mappings[line.accountKey] || line.accountId;
                        const accObj = accounts.find((a) => String(a.id) === String(mappedAccId));
                        return (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                            <td className="px-4 py-3 text-center font-mono text-slate-400 text-xs">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                              {accObj ? (
                                <span>
                                  {accObj.code && <span className="font-mono text-slate-400 mr-1.5">{accObj.code}</span>}
                                  {accObj.name}
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 italic">
                                  {line.defaultName} (Unmapped)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {line.debit > 0 ? fmt(line.debit) : ""}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {line.credit > 0 ? fmt(line.credit) : ""}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs font-medium">
                              {line.label}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                        <td className="px-4 py-3 text-center text-xs text-slate-400">Total</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          Journal Balance Check
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white text-base font-extrabold">
                          {fmt(totalDebitSum)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white text-base font-extrabold">
                          {fmt(totalCreditSum)}
                        </td>
                        <td className="px-4 py-3">
                          {isBalanced ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 text-xs">
                              <span>✓</span> Perfectly Balanced
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 text-xs">
                              <span>⚠️</span> Unbalanced (Diff: GHS {fmt(Math.abs(totalDebitSum - totalCreditSum))})
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Account-wise Summary */}
            {activeTab === "summary" && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="bg-slate-50/50 dark:bg-slate-900/10 px-4 py-3.5 border-b border-slate-200 dark:border-slate-700 font-extrabold text-sm text-slate-800 dark:text-white flex justify-between items-center">
                  <span>General Ledger Account Totals</span>
                  <span className="text-xs font-normal text-slate-500">
                    Aggregated double-entry posting lines by account (including loan accounts)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <th className="px-4 py-3 text-left">Account Name</th>
                        <th className="px-4 py-3 text-right">Debit (GHS)</th>
                        <th className="px-4 py-3 text-right">Credit (GHS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {summaryLines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
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
                      <tr className="bg-slate-50 dark:bg-slate-900/60 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">Total</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white font-extrabold">
                          {fmt(totalDebitSum)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white font-extrabold">
                          {fmt(totalCreditSum)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/10 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <button
                    onClick={() => setActiveTab("detailed")}
                    className="btn-secondary text-xs uppercase tracking-wider"
                  >
                    ← Back to Detailed Entries
                  </button>
                  <span className="text-xs text-slate-400 font-medium">
                    {summaryLines.length} general ledger accounts affected
                  </span>
                </div>
              </div>
            )}

            {/* Posting Controls */}
            <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-end">
              {periodObj?.status !== "CLOSED" ? (
                <button
                  className="btn-success h-11 px-8 font-bold text-sm tracking-wide rounded-lg shadow hover:shadow-md transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                  onClick={handlePostJournal}
                  disabled={submitting || !isBalanced || !mappings.salary_expense || !mappings.salary_payable}
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Posting to General Ledger...
                    </>
                  ) : (
                    <>
                      <span>📓</span> Post Salary Journal to General Ledger
                    </>
                  )}
                </button>
              ) : (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-2">
                  <span>✓</span> Journal Voucher Posted &amp; Period Closed
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
              No Payroll Data Loaded
            </p>
            <p className="text-sm mt-1 max-w-md mx-auto mb-4">
              Please choose an active or closed payroll period from the dropdown above to view the detailed journal entry rows and account-wise summaries.
            </p>
            {selectedPeriod && (
              <button
                onClick={handleSyncCurrentSalaries}
                disabled={syncing}
                className="btn-primary text-xs flex items-center gap-2 py-2 px-4 shadow"
              >
                <span>🔄</span>
                <span>{syncing ? "Generating..." : "Generate from Current Salary Data"}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </Guard>
  );
}
