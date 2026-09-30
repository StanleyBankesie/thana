/**
 * @fileoverview SalaryProcessing component.
 * Provides functionality for SalaryProcessing.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// ─── stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = "blue" }) {
  const colors = {
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300",
    green:
      "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300",
    amber:
      "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300",
    purple:
      "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300",
  };
  return (
    <div
      className={`border rounded-lg px-4 py-3 flex flex-col gap-0.5 ${colors[color]}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
        {label}
      </span>
      <span className="text-lg font-bold font-mono">{value}</span>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SalaryProcessing() {
  const navigate = useNavigate();
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [previewData, setPreviewData] = useState(null); // { source, items }
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [expandedLoans, setExpandedLoans] = useState({});
  const [components, setComponents] = useState([]);

  // load payroll periods and components on mount
  useEffect(() => {
    api
      .get("/hr/payroll/periods")
      .then((r) => setPeriods(r?.data?.items || []))
      .catch(() => toast.error("Failed to load payroll periods"));
    api
      .get("/hr/salary-components")
      .then((r) => setComponents(r?.data?.items || []))
      .catch(() => toast.warn("Failed to load salary components"));
  }, []);

  // ── preview ────────────────────────────────────────────────────────────────
  const loadPreview = useCallback(async () => {
    if (!selectedPeriod) return toast.error("Select a payroll period first");
    setLoading(true);
    setPreviewData(null);
    try {
      // Primary: try the actual computed breakdown (from hr_payroll_items)
      const bRes = await api.get(
        `/hr/payroll/breakdown?period_id=${selectedPeriod}`,
      );
      const breakdownItems = bRes?.data?.items || [];

      if (breakdownItems.length > 0) {
        setPreviewData({ source: "actual", items: breakdownItems });
        toast.success(
          `Loaded actual breakdown for ${breakdownItems.length} employee(s)`,
        );
      } else {
        // Fallback: no payroll generated yet → show employees with base salary estimate
        const eRes = await api.get("/hr/employees");
        const emps = (eRes?.data?.items || []).filter(
          (e) => e.status === "ACTIVE" || !e.status,
        );
        const estimated = emps.map((e) => ({
          employee_id: e.id,
          emp_code: e.emp_code,
          first_name: e.first_name,
          last_name: e.last_name,
          basic_salary: Number(e.base_salary || 0),
          allowances_total: 0,
          ssf_employee: 0,
          tier3_employee: 0,
          income_tax: 0,
          deductions: 0,
          net_salary: Number(e.base_salary || 0),
        }));
        setPreviewData({ source: "estimate", items: estimated });
        toast.info("No payroll generated yet — showing base salary estimates");
      }
    } catch (err) {
      toast.error("Failed to load preview");
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  // ── generate payroll ───────────────────────────────────────────────────────
  const processSalaries = async () => {
    if (!selectedPeriod) return toast.error("Select a payroll period first");
    setProcessing(true);
    try {
      await api.post("/hr/payroll/generate", { period_id: Number(selectedPeriod) });
      toast.success("Payroll generated successfully!");
      setTimeout(() => loadPreview(), 800);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to process salaries";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };
  const items = previewData?.items || [];

  // Identify dynamic columns (allowances and loans) present in the data
  const dynamicAllowCols = Array.from(
    new Set(
      items.flatMap((r) => Object.keys(r.allowances || {}).map((id) => `allowance_${id}`))
    )
  );
  const dynamicLoanCols = Array.from(
    new Set(
      items.flatMap((r) => Object.keys(r.loan_items || {}).map((id) => `loan_${id}`))
    )
  );

  const totals = items.reduce(
    (acc, r) => {
      const next = {
        basic: acc.basic + Number(r.basic_salary || 0),
        allowances: acc.allowances + Number(r.allowances_total || 0),
        ssf: acc.ssf + Number(r.ssf_employee || 0),
        tier3: acc.tier3 + Number(r.tier3_employee || 0),
        loans: acc.loans + Number(r.loan_deductions || 0),
        income_tax: acc.income_tax + Number(r.income_tax || 0),
        deductions: acc.deductions + Number(r.deductions || 0),
        net: acc.net + Number(r.net_salary || 0),
      };
      // Sum for dynamic allowance cols
      dynamicAllowCols.forEach((col) => {
        const aid = col.replace("allowance_", "");
        acc.dynamicAllowances[aid] =
          (acc.dynamicAllowances[aid] || 0) + Number(r.allowances?.[aid] || 0);
      });
      // Sum for dynamic loan cols
      dynamicLoanCols.forEach((col) => {
        const lid = col.replace("loan_", "");
        const val =
          r.loan_items?.[lid]?.amount ?? r.loan_items?.[lid] ?? 0;
        acc.dynamicLoans[lid] = (acc.dynamicLoans[lid] || 0) + Number(val);
      });
      return {
        ...next,
        dynamicAllowances: acc.dynamicAllowances,
        dynamicLoans: acc.dynamicLoans,
      };
    },
    {
      basic: 0,
      allowances: 0,
      ssf: 0,
      tier3: 0,
      loans: 0,
      income_tax: 0,
      deductions: 0,
      net: 0,
      dynamicAllowances: {},
      dynamicLoans: {},
    },
  );

  const selectedPeriodObj = periods.find(
    (p) => String(p.id) === String(selectedPeriod),
  );

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-5">
        {/* ── header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            ← Back
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Process Salaries
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a payroll period, preview computed salaries, then generate
              payroll.
            </p>
          </div>
        </div>

        {/* ── period selector + actions ────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Payroll Period <span className="text-red-500">*</span>
              </label>
              <select
                className="input w-full"
                value={selectedPeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value);
                  setPreviewData(null);
                }}
              >
                <option value="">— Select Period —</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_name} ({fmtDate(p.start_date)} →{" "}
                    {fmtDate(p.end_date)})
                    {p.status === "CLOSED" ? " ✓ Closed" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn-secondary h-10 px-5 flex items-center gap-2"
              onClick={loadPreview}
              disabled={loading || !selectedPeriod}
            >
              {loading ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />{" "}
                  Loading…
                </>
              ) : (
                <>
                  <span>👁</span> Preview Salaries
                </>
              )}
            </button>

            <button
              className="btn-primary h-10 px-5 flex items-center gap-2"
              onClick={processSalaries}
              disabled={processing || !selectedPeriod}
            >
              {processing ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />{" "}
                  Generating…
                </>
              ) : (
                <>
                  <span>⚡</span> Generate Payroll
                </>
              )}
            </button>

            {previewData?.source === "actual" && (
              <button
                className="btn-success h-10 px-5 flex items-center gap-2"
                onClick={() => navigate("/human-resources/payslips")}
              >
                <span>📄</span> View Payslips
              </button>
            )}
          </div>
        </div>

        {/* ── preview section ──────────────────────────────────────────────── */}
        {previewData && (
          <>
            {/* source badge */}
            <div className="flex items-center gap-2">
              {previewData.source !== "actual" && (
                <span className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold px-3 py-1 rounded-full border border-amber-200 dark:border-amber-700">
                  ⚠ Estimated preview — source:{" "}
                  <code className="font-mono">hr_employees.base_salary</code> ·
                  Click Generate to compute actual values
                </span>
              )}
            </div>

            {/* summary stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Employees" value={items.length} color="blue" />
              <StatCard
                label="Gross Payroll"
                value={fmt(totals.basic + totals.allowances)}
                color="green"
              />
              <StatCard
                label="Total SSF"
                value={fmt(totals.ssf)}
                color="amber"
              />
              <StatCard
                label="Total Tier 3"
                value={fmt(totals.tier3)}
                color="purple"
              />
              <StatCard
                label="Total PAYE"
                value={fmt(totals.income_tax)}
                color="red"
              />
              <StatCard
                label="Net Payroll"
                value={fmt(totals.net)}
                color="green"
              />
            </div>

            {/* breakdown table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Salary Breakdown — {items.length} employee
                  {items.length !== 1 ? "s" : ""}
                </h3>
                <span className="text-[10px] text-slate-400">
                  All amounts in base currency
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-2.5 text-left sticky left-0 bg-slate-50 dark:bg-slate-900/50 z-10">
                        Employee
                      </th>
                      <th className="px-3 py-2.5 text-left">Code</th>
                      <th className="px-3 py-2.5 text-right">Basic Salary</th>
                      
                      {/* Dynamic Allowance Columns */}
                      {dynamicAllowCols.length > 0 ? (
                        dynamicAllowCols.map((col) => {
                          const comp = components.find((c) => c.column_name === col);
                          return (
                            <th key={col} className="px-3 py-2.5 text-right font-bold text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/10">
                              {comp?.label || col.replace("allowance_", "Allow. ")}
                            </th>
                          );
                        })
                      ) : (
                        <th className="px-3 py-2.5 text-right">Allowances</th>
                      )}

                      <th className="px-3 py-2.5 text-right bg-amber-50/50 dark:bg-amber-900/10">
                        SSF (Emp)
                      </th>
                      <th className="px-3 py-2.5 text-right bg-amber-50/50 dark:bg-amber-900/10">
                        Tier 3
                      </th>
                      <th className="px-3 py-2.5 text-right bg-red-50/50 dark:bg-red-900/10">
                        PAYE Tax
                      </th>

                      {/* Dynamic Loan Columns */}
                      {dynamicLoanCols.length > 0 ? (
                        dynamicLoanCols.map((col) => {
                          const comp = components.find((c) => c.column_name === col);
                          return (
                            <th key={col} className="px-3 py-2.5 text-right font-bold text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10">
                              {comp?.label || col.replace("loan_", "Loan ")}
                            </th>
                          );
                        })
                      ) : (
                        <th className="px-3 py-2.5 text-right bg-red-50/50 dark:bg-red-900/10">
                          Loan Deductions
                        </th>
                      )}
                      <th className="px-3 py-2.5 text-right bg-red-50/50 dark:bg-red-900/10">
                        Total Deductions
                      </th>
                      <th className="px-3 py-2.5 text-right bg-green-50/50 dark:bg-green-900/10 font-extrabold text-green-700 dark:text-green-400">
                        Net Salary
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map((row) => (
                      <tr
                        key={row.employee_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-800 z-10 whitespace-nowrap">
                          {row.first_name} {row.last_name}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                          {row.emp_code}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {fmt(row.basic_salary)}
                        </td>

                        {/* Dynamic Allowance Cells */}
                        {dynamicAllowCols.length > 0 ? (
                          dynamicAllowCols.map((col) => {
                            const aid = col.replace("allowance_", "");
                            const val = row.allowances?.[aid] || 0;
                            return (
                              <td key={col} className="px-3 py-2.5 text-right font-mono text-blue-700 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-900/5">
                                {fmt(val)}
                              </td>
                            );
                          })
                        ) : (
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                            {fmt(row.allowances_total)}
                          </td>
                        )}

                        <td className="px-3 py-2.5 text-right font-mono text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/10">
                          {fmt(row.ssf_employee)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/10">
                          {fmt(row.tier3_employee)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-red-600 dark:text-red-400 bg-red-50/30 dark:bg-red-900/10">
                          {fmt(row.income_tax)}
                        </td>

                        {/* Dynamic Loan Cells */}
                        {dynamicLoanCols.length > 0 ? (
                          dynamicLoanCols.map((col) => {
                            const lid = col.replace("loan_", "");
                            const val = row.loan_items?.[lid]?.amount ?? row.loan_items?.[lid] ?? 0;
                            return (
                              <td key={col} className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-400 bg-red-50/30 dark:bg-red-900/10">
                                {fmt(val)}
                              </td>
                            );
                          })
                        ) : (
                          <td className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-300 bg-red-50/30 dark:bg-red-900/10">
                            <span>{fmt(row.loan_deductions || 0)}</span>
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-300 bg-red-50/30 dark:bg-red-900/10 font-semibold">
                          {fmt(row.deductions)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-green-700 dark:text-green-400 bg-green-50/30 dark:bg-green-900/10">
                          {fmt(row.net_salary)}
                        </td>
                      </tr>
                    ))}
                    {items.map((row) =>
                      expandedLoans[row.employee_id] &&
                      row.loan_items &&
                      Object.keys(row.loan_items).length > 0 ? (
                        <tr
                          key={`${row.employee_id}-loans`}
                          className="bg-slate-50/70 dark:bg-slate-700/40"
                        >
                          <td colSpan={8 + dynamicAllowCols.length + dynamicLoanCols.length} className="px-3 py-2">
                            <div className="text-xs">
                              <div className="font-semibold mb-1">
                                Loan Breakdown
                              </div>
                              <div className="flex flex-wrap gap-3">
                                {Object.entries(row.loan_items || {}).map(
                                  ([lid, item]) => (
                                    <div
                                      key={lid}
                                      className="px-2 py-1 border rounded bg-white dark:bg-slate-800 shadow-sm"
                                    >
                                      <span className="mr-2 text-slate-600 dark:text-slate-300 font-semibold">
                                        {item.loan_type ? `${item.loan_type}` : `Loan ${lid}`}
                                      </span>
                                      <span className="font-mono text-slate-900 dark:text-slate-100 italic">
                                        {fmt(item.amount !== undefined ? item.amount : item)}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    )}
                  </tbody>

                  {/* grand totals row */}
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-700 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-200 border-t-2 border-slate-300 dark:border-slate-600">
                      <td className="px-3 py-2.5 sticky left-0 bg-slate-100 dark:bg-slate-700 z-10">
                        TOTAL ({items.length})
                      </td>
                      <td className="px-3 py-2.5" />
                      <td className="px-3 py-2.5 text-right font-mono">
                        {fmt(totals.basic)}
                      </td>

                      {/* Dynamic Allowance Totals */}
                      {dynamicAllowCols.length > 0 ? (
                        dynamicAllowCols.map((col) => {
                          const aid = col.replace("allowance_", "");
                          return (
                            <td key={col} className="px-3 py-2.5 text-right font-mono bg-blue-50/50 dark:bg-blue-900/20">
                              {fmt(totals.dynamicAllowances?.[aid] || 0)}
                            </td>
                          );
                        })
                      ) : (
                        <td className="px-3 py-2.5 text-right font-mono">
                          {fmt(totals.allowances)}
                        </td>
                      )}

                      <td className="px-3 py-2.5 text-right font-mono text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/20">
                        {fmt(totals.ssf)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/20">
                        {fmt(totals.tier3)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/20">
                        {fmt(totals.income_tax)}
                      </td>

                      {/* Dynamic Loan Totals */}
                      {dynamicLoanCols.length > 0 ? (
                        dynamicLoanCols.map((col) => {
                          const lid = col.replace("loan_", "");
                          return (
                            <td key={col} className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-900/20">
                              {fmt(totals.dynamicLoans?.[lid] || 0)}
                            </td>
                          );
                        })
                      ) : (
                        <td className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-900/20">
                          {fmt(totals.loans)}
                        </td>
                      )}

                      <td className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-900/20">
                        {fmt(totals.deductions)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-900/20 text-sm">
                        {fmt(totals.net)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── empty state ─────────────────────────────────────────────────── */}
        {!previewData && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-slate-500">
            <span className="text-5xl mb-4">📊</span>
            <p className="text-base font-medium">
              Select a payroll period and click{" "}
              <strong>Preview Salaries</strong>
            </p>
            <p className="text-sm mt-1">
              If payroll has already been generated for the period, you'll see
              actual computed values.
              <br />
              Otherwise a base-salary estimate is shown and you can click{" "}
              <strong>Generate Payroll</strong> to compute exact figures.
            </p>
          </div>
        )}
      </div>
    </Guard>
  );
}
