/**
 * @fileoverview SalaryStructurePage component.
 * Provides functionality for SalaryStructurePage.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SalaryStructurePage() {
  const [loading, setLoading] = useState(false);
  const [allowances, setAllowances] = useState([]);
  const [incomeTaxes, setIncomeTaxes] = useState([]);
  const [ssfTaxes, setSsfTaxes] = useState([]);
  const [tier3Taxes, setTier3Taxes] = useState([]);
  const [loans, setLoans] = useState([]);
  const [structure, setStructure] = useState({
    taxable_components: ["BASIC"],
    apply_ssf_basic: true,
    formula: [
      { op: "+", token: "BASIC" },
      { op: "+", token: "ALLOWANCES" },
      { op: "-", token: "PAYE" },
      { op: "-", token: "SSF" },
    ],
  });
  const [savingStructure, setSavingStructure] = useState(false);

  const incomeTaxGroups = useMemo(() => {
    const acc = {};
    for (const it of incomeTaxes) {
      const key = String(it.tax_name || `BRACKET-${it.id || "new"}`);
      if (!acc[key]) acc[key] = [];
      acc[key].push(it);
    }
    return Object.keys(acc).map((name) => ({ name, rows: acc[name] }));
  }, [incomeTaxes]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [alwRes, structRes, taxRes, loanRes] = await Promise.all([
        api.get("/hr/allowances").catch(() => {
          toast.error("Failed to load allowances");
          return { data: { items: [] } };
        }),
        api.get("/hr/salary-structure/active").catch(() => {
          toast.error("Failed to load salary structure");
          return { data: { item: null } };
        }),
        api.get("/hr/tax-configs").catch(() => {
          toast.error("Failed to load tax configurations");
          return { data: { items: [] } };
        }),
        api.get("/hr/loans").catch(() => {
          toast.error("Failed to load loans");
          return { data: { items: [] } };
        }),
      ]);
      setAllowances(alwRes.data.items || []);
      const taxItems = taxRes.data.items || [];
      setIncomeTaxes(taxItems.filter((i) => i.tax_type === "INCOME_TAX"));
      setSsfTaxes(taxItems.filter((i) => i.tax_type === "SOCIAL_SECURITY"));
      setTier3Taxes(taxItems.filter((i) => i.tax_type === "PROVIDENT_FUND"));
      setLoans(
        (loanRes.data?.items || []).filter(
          (l) => String(l.status || "").toUpperCase() !== "CLOSED",
        ),
      );
      const comp = structRes.data?.item?.components;
      if (comp) {
        try {
          const parsed = typeof comp === "string" ? JSON.parse(comp) : comp;
          setStructure({
            taxable_components: Array.isArray(parsed?.taxable_components)
              ? parsed.taxable_components
              : ["BASIC"],
            apply_ssf_basic:
              parsed?.apply_ssf_basic !== undefined
                ? !!parsed.apply_ssf_basic
                : true,
            formula: Array.isArray(parsed?.formula)
              ? parsed.formula
              : [
                  { op: "+", token: "BASIC" },
                  { op: "+", token: "ALLOWANCES" },
                  { op: "-", token: "PAYE" },
                  { op: "-", token: "SSF" },
                ],
          });
        } catch {}
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Salary Structure</h1>
            <p className="text-sm text-slate-500">
              Define the net pay formula for payroll calculations
            </p>
          </div>
          <button onClick={() => window.history.back()} className="btn-secondary"
          >
            ← Back
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading…</div>
        ) : (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold mb-4">
              Structure Formula Builder
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Builder */}
              <div className="space-y-2">
                {(structure.formula || []).map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex flex-col gap-1 pr-1">
                      <button
                        title="Move Up"
                        className="text-slate-400 hover:text-brand disabled:opacity-30 p-0.5"
                        disabled={idx === 0}
                        onClick={() => {
                          const formula = [...(structure.formula || [])];
                          if (idx > 0) {
                            const tmp = formula[idx - 1];
                            formula[idx - 1] = formula[idx];
                            formula[idx] = tmp;
                            setStructure({ ...structure, formula });
                          }
                        }}
                      >
                        ▲
                      </button>
                      <button
                        title="Move Down"
                        className="text-slate-400 hover:text-brand disabled:opacity-30 p-0.5"
                        disabled={idx === (structure.formula || []).length - 1}
                        onClick={() => {
                          const formula = [...(structure.formula || [])];
                          if (idx < formula.length - 1) {
                            const tmp = formula[idx + 1];
                            formula[idx + 1] = formula[idx];
                            formula[idx] = tmp;
                            setStructure({ ...structure, formula });
                          }
                        }}
                      >
                        ▼
                      </button>
                    </div>
                    <select
                      className="input w-20"
                      value={row.op}
                      onChange={(e) => {
                        const formula = [...(structure.formula || [])];
                        formula[idx] = { ...formula[idx], op: e.target.value };
                        setStructure({ ...structure, formula });
                      }}
                    >
                      <option value="+">+</option>
                      <option value="-">-</option>
                    </select>
                    <select
                      className="input flex-1"
                      value={row.token}
                      onChange={(e) => {
                        const formula = [...(structure.formula || [])];
                        formula[idx] = {
                          ...formula[idx],
                          token: e.target.value,
                        };
                        setStructure({ ...structure, formula });
                      }}
                    >
                      <option value="BASIC">BASIC</option>
                      {allowances.map((a) => (
                        <option key={a.id} value={`ALLOWANCE:${a.id}`}>
                          {a.allowance_name}
                        </option>
                      ))}
                      {incomeTaxGroups.map((g) => (
                        <option
                          key={g.name}
                          value={`INCOME_TAX_BRACKET:${g.name}`}
                        >
                          PAYE: {g.name}
                        </option>
                      ))}
                      {ssfTaxes.map((t) => (
                        <option key={t.id} value={`SSF:${t.id}`}>
                          SSF: {t.tax_name}
                        </option>
                      ))}
                      {tier3Taxes.map((t) => (
                        <option key={t.id} value={`TIER3:${t.id}`}>
                          Tier3: {t.tax_name}
                        </option>
                      ))}
                      {loans.map((l) => (
                        <option key={l.id} value={`LOAN:${l.id}`}>
                          LOAN: {l.loan_type}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-secondary text-red-500 hover:bg-red-50"
                      title="Remove component"
                      onClick={() => {
                        const formula = (structure.formula || []).filter(
                          (_, i) => i !== idx,
                        );
                        setStructure({ ...structure, formula });
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2 items-center">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const formula = [...(structure.formula || [])];
                      formula.push({ op: "+", token: "BASIC" });
                      setStructure({ ...structure, formula });
                    }}
                  >
                    + Add Component
                  </button>
                  <button
                    className="btn-primary"
                    disabled={savingStructure}
                    onClick={async () => {
                      setSavingStructure(true);
                      try {
                        await api.post("/hr/salary-structures", {
                          name: "Default Structure",
                          description: "Standard salary structure",
                          is_active: true,
                          components: { formula: structure.formula },
                        });
                        toast.success("Salary structure saved");
                      } catch {
                        toast.error("Failed to save structure");
                      } finally {
                        setSavingStructure(false);
                      }
                    }}
                  >
                    {savingStructure ? "Saving..." : "Save Structure"}
                  </button>
                </div>
              </div>

              {/* Formula Preview — ERP Infographic */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  Formula Preview
                </div>

                {(structure.formula || []).length === 0 ? (
                  <div className="text-sm text-slate-400 italic">
                    No components added yet.
                  </div>
                ) : (() => {
                  // resolve label + category for each row
                  const resolved = (structure.formula || []).map((f, i) => {
                    const t = String(f.token || "");
                    let label = t;
                    let category = "other";
                    if (t === "BASIC") { label = "Basic Salary"; category = "basic"; }
                    else if (t === "ALLOWANCES") { label = "All Allowances"; category = "earning"; }
                    else if (t.startsWith("ALLOWANCE:")) {
                      const id = Number(t.split(":")[1]);
                      const a = allowances.find((x) => Number(x.id) === id);
                      label = a ? a.allowance_name : "Allowance";
                      category = "earning";
                    } else if (t.startsWith("INCOME_TAX_BRACKET:")) {
                      label = `PAYE – ${t.split(":").slice(1).join(":")}`;
                      category = "tax";
                    } else if (t.startsWith("INCOME_TAX:")) {
                      const id = Number(t.split(":")[1]);
                      const x = incomeTaxes.find((r) => Number(r.id) === id);
                      label = x ? `PAYE – ${x.tax_name}` : "Income Tax";
                      category = "tax";
                    } else if (t.startsWith("SSF:")) {
                      const id = Number(t.split(":")[1]);
                      const x = ssfTaxes.find((r) => Number(r.id) === id);
                      label = x ? `SSF – ${x.tax_name}` : "SSF";
                      category = "tax";
                    } else if (t.startsWith("TIER3:")) {
                      const id = Number(t.split(":")[1]);
                      const x = tier3Taxes.find((r) => Number(r.id) === id);
                      label = x ? `Tier 3 – ${x.tax_name}` : "Tier 3";
                      category = "tax";
                    } else if (t.startsWith("LOAN:")) {
                      const id = Number(t.split(":")[1]);
                      const x = loans.find((r) => Number(r.id) === id);
                      label = x ? `Loan – ${x.loan_type}` : "Loan";
                      category = "deduction";
                    }
                    return { ...f, label, category, idx: i };
                  });

                  const styleMap = {
                    basic:     { dot: "bg-indigo-500",   pill: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700", badge: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400", badgeLabel: "Base" },
                    earning:   { dot: "bg-emerald-500",  pill: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700", badge: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400", badgeLabel: "Earning" },
                    tax:       { dot: "bg-amber-500",    pill: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700", badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400", badgeLabel: "Tax" },
                    deduction: { dot: "bg-red-500",      pill: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700", badge: "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400", badgeLabel: "Deduction" },
                    other:     { dot: "bg-slate-400",    pill: "bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600", badge: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400", badgeLabel: "Other" },
                  };

                  return (
                    <div className="relative flex flex-col gap-0">
                      {resolved.map((row, i) => {
                        const s = styleMap[row.category] || styleMap.other;
                        const isAdd = row.op === "+";
                        const isFirst = i === 0;
                        return (
                          <div key={`${i}-${row.token}`} className="relative flex items-start gap-3">
                            {/* Left timeline rail */}
                            <div className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full mt-3 shrink-0 ${s.dot} ring-2 ring-white dark:ring-slate-800`} />
                              {i < resolved.length - 1 && (
                                <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-600 min-h-[24px]" />
                              )}
                            </div>

                            {/* Card */}
                            <div className={`flex-1 mb-2 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2 ${s.pill}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                {/* Step operator badge (not shown for first) */}
                                {!isFirst && (
                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded font-mono shrink-0 ${
                                    isAdd
                                      ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
                                      : "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200"
                                  }`}>
                                    {isAdd ? "+" : "−"}
                                  </span>
                                )}
                                <span className="text-sm font-semibold truncate">{row.label}</span>
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${s.badge}`}>
                                {s.badgeLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Net Pay result node */}
                      <div className="flex items-start gap-3 mt-1">
                        <div className="flex flex-col items-center">
                          <div className="w-4 h-4 rounded-full mt-2.5 shrink-0 bg-gradient-to-br from-indigo-600 to-purple-600 ring-2 ring-white dark:ring-slate-800 shadow" />
                        </div>
                        <div className="flex-1 rounded-xl px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💳</span>
                            <div>
                              <div className="text-xs font-semibold opacity-75 uppercase tracking-wider">Result</div>
                              <div className="text-sm font-bold">Net Pay</div>
                            </div>
                          </div>
                          <span className="text-xs font-bold bg-white/20 rounded-full px-2.5 py-1">= OUTPUT</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Info panel */}
            <div className="mt-6 bg-slate-50 dark:bg-slate-900 p-4 rounded-md space-y-2 border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                How the formula works
              </h3>
              <ol className="list-decimal ml-5 text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li>Compute taxable base from selected components.</li>
                <li>Apply income tax brackets (PAYE) to the taxable base.</li>
                <li>Apply SSNIT employee contribution on basic salary.</li>
                <li>
                  Net salary = basic + allowances − (PAYE + SSNIT + other
                  deductions).
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </Guard>
  );
}
