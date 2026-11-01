/**
 * @fileoverview SalaryStructurePage component.
 * Provides configuration for company-wide salary structures, net pay formula rules,
 * Ghana GRA statutory deduction ordering, and taxability definitions.
 * Follows OmniSuite ERP application page design specifications.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sliders,
  ShieldCheck,
  Save,
  Check,
  RefreshCw,
  Sparkles,
  Award,
  Landmark,
  Wallet,
  Calculator,
  CheckCircle2,
} from "lucide-react";

export default function SalaryStructurePage() {
  const [loading, setLoading] = useState(false);
  const [componentDefs, setComponentDefs] = useState([]);
  const [tier3Taxes, setTier3Taxes] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [allIncomeTaxRows, setAllIncomeTaxRows] = useState([]);

  const [structureName, setStructureName] = useState(
    "Ghana Statutory GRA & SSNIT Structure",
  );
  const [structureDesc, setStructureDesc] = useState(
    "Compliant with Ghana Revenue Authority (Act 896/1094/1111) and National Pensions Act (Act 766)",
  );
  const [isActive, setIsActive] = useState(true);

  const [structure, setStructure] = useState({
    taxable_components: ["BASIC", "ALLOWANCES"],
    apply_ssf_basic: true,
    formula: [
      { op: "+", token: "BASIC" },
      { op: "+", token: "ALLOWANCES" },
      { op: "-", token: "SSF" },
      { op: "-", token: "TIER3" },
      { op: "-", token: "TAX_RELIEF" },
      { op: "-", token: "PAYE" },
      { op: "-", token: "DEDUCTIONS" },
      { op: "-", token: "LOANS" },
    ],
  });
  const [savingStructure, setSavingStructure] = useState(false);

  // Separate component definitions into earnings and deductions
  const earningsComponents = useMemo(() => {
    return componentDefs.filter(
      (c) =>
        c.component_type === "ALLOWANCE" ||
        c.component_type === "EARNING" ||
        c.component_type === "BENEFIT",
    );
  }, [componentDefs]);

  const deductionComponents = useMemo(() => {
    return componentDefs.filter(
      (c) =>
        c.component_type === "DEDUCTION" || c.component_type === "RECOVERY",
    );
  }, [componentDefs]);

  // Statistics for top metric cards
  const stats = useMemo(() => {
    const totalSteps = structure.formula?.length || 0;
    const earningsCount = (structure.formula || []).filter(
      (s) => s.op === "+",
    ).length;
    const statutoryCount = (structure.formula || []).filter((s) =>
      ["SSF", "TIER3", "TAX_RELIEF", "PAYE"].includes(s.token),
    ).length;
    const deductionsCount = (structure.formula || []).filter(
      (s) => s.op === "-" && !["SSF", "TIER3", "TAX_RELIEF", "PAYE"].includes(s.token),
    ).length;

    return {
      totalSteps,
      earningsCount,
      statutoryCount,
      deductionsCount,
    };
  }, [structure.formula]);

  // Resolve token classification, statutory type, and badges
  const resolveTokenInfo = (token) => {
    const t = String(token || "");

    if (t === "BASIC") {
      return {
        label: "Basic Salary",
        badge: "Base Pay",
        type: "Base Emolument",
        phase: "Phase 1: Pensionable Base",
        isEarning: true,
      };
    }
    if (t === "ALLOWANCES") {
      return {
        label: "All Cash Allowances & Benefits",
        badge: "Allowances",
        type: "Cash Emolument",
        phase: "Phase 2: Cash Emoluments",
        isEarning: true,
      };
    }
    if (t === "SSF") {
      return {
        label: "SSNIT Employee Contribution (5.5%)",
        badge: "SSNIT 5.5%",
        type: "Statutory Relief",
        phase: "Phase 3: Pre-Tax Relief",
        isEarning: false,
      };
    }
    if (t === "TIER3") {
      return {
        label: "Tier 3 Voluntary Provident Fund",
        badge: "Tier 3 Fund",
        type: "Statutory Relief",
        phase: "Phase 3: Pre-Tax Relief",
        isEarning: false,
      };
    }
    if (t === "TAX_RELIEF") {
      return {
        label: "GRA Statutory Personal Tax Reliefs",
        badge: "Tax Relief",
        type: "Statutory Relief",
        phase: "Phase 3: Pre-Tax Relief",
        isEarning: false,
      };
    }
    if (t === "PAYE") {
      return {
        label: "Statutory PAYE Income Tax",
        badge: "GRA PAYE",
        type: "Income Tax",
        phase: "Phase 4: Statutory Tax",
        isEarning: false,
      };
    }
    if (t === "DEDUCTIONS") {
      return {
        label: "All Company & Voluntary Deductions",
        badge: "Deductions",
        type: "Post-Tax Deduction",
        phase: "Phase 5: Company Deductions",
        isEarning: false,
      };
    }
    if (t === "LOANS") {
      return {
        label: "Staff Loan Monthly Installments",
        badge: "Staff Loans",
        type: "Loan Amortization",
        phase: "Phase 6: Staff Loans",
        isEarning: false,
      };
    }

    if (t.startsWith("CMP:")) {
      const id = Number(t.split(":")[1]);
      const cmp = componentDefs.find((c) => Number(c.id) === id);
      const isDed =
        cmp?.component_type === "DEDUCTION" ||
        cmp?.component_type === "RECOVERY";
      return {
        label: cmp ? `${cmp.name}` : `Component #${id}`,
        badge: isDed ? "Deduction" : "Allowance",
        type: isDed ? "Post-Tax Deduction" : "Cash Emolument",
        phase: isDed
          ? "Phase 5: Company Deductions"
          : "Phase 2: Cash Emoluments",
        isEarning: !isDed,
      };
    }
    if (t.startsWith("TIER3:")) {
      const id = Number(t.split(":")[1]);
      const x = tier3Taxes.find((r) => Number(r.id) === id);
      return {
        label: x ? `Tier 3: ${x.tax_name}` : "Tier 3 Fund",
        badge: "Tier 3",
        type: "Statutory Relief",
        phase: "Phase 3: Pre-Tax Relief",
        isEarning: false,
      };
    }
    if (t.startsWith("LOAN_TYPE:")) {
      const id = Number(t.split(":")[1]);
      const x = loanTypes.find((r) => Number(r.id) === id);
      return {
        label: x ? `Loan: ${x.name}` : "Staff Loan",
        badge: "Staff Loan",
        type: "Loan Amortization",
        phase: "Phase 6: Staff Loans",
        isEarning: false,
      };
    }

    return {
      label: t,
      badge: "Custom",
      type: "Custom Component",
      phase: "Custom Phase",
      isEarning: true,
    };
  };

  /**
   * Automatically enter all components based on their types into the Ghana statutory order:
   * 1. Base Pay (BASIC) (+)
   * 2. All Allowance / Earning Components (+)
   * 3. Statutory Pre-Tax Reliefs (SSF 5.5%, Tier 3, Tax Relief) (−)
   * 4. Statutory PAYE Income Tax (−)
   * 5. All Company & Voluntary Deductions (−)
   * 6. Staff Loans (−)
   */
  const autoEnterComponentsByType = (defs = componentDefs) => {
    const steps = [];

    // 1. Base Pay
    steps.push({ op: "+", token: "BASIC" });

    // 2. All Allowance/Earning components by type
    const earnings = defs.filter(
      (c) =>
        c.component_type === "ALLOWANCE" ||
        c.component_type === "EARNING" ||
        c.component_type === "BENEFIT",
    );
    if (earnings.length > 0) {
      for (const e of earnings) {
        steps.push({ op: "+", token: `CMP:${e.id}` });
      }
    } else {
      steps.push({ op: "+", token: "ALLOWANCES" });
    }

    // 3. Pre-Tax Statutory Reliefs & Pensions by type
    steps.push({ op: "-", token: "SSF" });
    steps.push({ op: "-", token: "TIER3" });
    steps.push({ op: "-", token: "TAX_RELIEF" });

    // 4. Statutory PAYE Income Tax
    steps.push({ op: "-", token: "PAYE" });

    // 5. Post-Tax Deductions by type
    const deductions = defs.filter(
      (c) =>
        c.component_type === "DEDUCTION" || c.component_type === "RECOVERY",
    );
    if (deductions.length > 0) {
      for (const d of deductions) {
        steps.push({ op: "-", token: `CMP:${d.id}` });
      }
    } else {
      steps.push({ op: "-", token: "DEDUCTIONS" });
    }

    // 6. Staff Loans by type
    steps.push({ op: "-", token: "LOANS" });

    // Deduplicate any repeated tokens
    const seen = new Set();
    const finalSteps = steps.filter((s) => {
      const key = `${s.op}:${s.token}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setStructure((prev) => ({
      ...prev,
      formula: finalSteps,
    }));
    setStructureName("Ghana Statutory GRA & SSNIT Structure");
    setStructureDesc(
      "All allowances, statutory reliefs, taxes, deductions, and loans automatically entered based on their types",
    );
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [compDefRes, structRes, taxRes, loanTypeRes] = await Promise.all([
        api
          .get("/hr/salary-component-definitions")
          .catch(() => ({ data: { items: [] } })),
        api
          .get("/hr/salary-structure/active")
          .catch(() => ({ data: { item: null } })),
        api.get("/hr/tax-configs").catch(() => ({ data: { items: [] } })),
        api.get("/hr/setup/loan-types").catch(() => ({ data: { items: [] } })),
      ]);

      const rawDefs = compDefRes.data?.items || compDefRes.data || [];
      const normalizedDefs = rawDefs.map((d) => ({
        id: d.id,
        code: d.code || `CMP-${d.id}`,
        name: d.component_name || d.name || "Component",
        component_name: d.component_name || d.name || "Component",
        component_type: d.component_type || "ALLOWANCE",
        is_taxable: d.is_taxable !== undefined ? Boolean(d.is_taxable) : true,
      }));
      setComponentDefs(normalizedDefs);

      const taxItems = taxRes.data?.items || [];
      const incomeTaxRows = taxItems.filter((i) => i.tax_type === "INCOME_TAX");
      setAllIncomeTaxRows(incomeTaxRows);

      setTier3Taxes(
        taxItems.filter(
          (i) =>
            i.tax_type === "PROVIDENT_FUND" || i.tax_type === "PROVIDENCE_FUND",
        ),
      );

      setLoanTypes(loanTypeRes.data?.items || loanTypeRes.data || []);

      // 1. Pick Taxable Salary Components directly from Statutory Contributions (INCOME_TAX config)
      let statutoryTaxable = null;
      if (incomeTaxRows.length > 0 && incomeTaxRows[0].taxable_components) {
        try {
          const raw = incomeTaxRows[0].taxable_components;
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed) && parsed.length > 0) {
            statutoryTaxable = parsed;
          }
        } catch {}
      }

      const activeItem = structRes.data?.item;
      let loadedFormula = null;
      let savedTaxable = ["BASIC"];
      let savedApplySsf = true;
      let activeStructName = structureName;
      let activeStructDesc = structureDesc;
      let activeIsActive = true;

      if (activeItem) {
        if (activeItem.name) {
          activeStructName = activeItem.name;
          setStructureName(activeItem.name);
        }
        if (activeItem.description) {
          activeStructDesc = activeItem.description;
          setStructureDesc(activeItem.description);
        }
        if (activeItem.is_active !== undefined) {
          activeIsActive = Boolean(activeItem.is_active);
          setIsActive(activeIsActive);
        }

        const comp = activeItem.components;
        if (comp) {
          try {
            const parsed = typeof comp === "string" ? JSON.parse(comp) : comp;
            if (Array.isArray(parsed?.formula) && parsed.formula.length > 0) {
              loadedFormula = parsed.formula;
            }
            if (Array.isArray(parsed?.taxable_components)) {
              savedTaxable = parsed.taxable_components;
            }
            if (parsed?.apply_ssf_basic !== undefined) {
              savedApplySsf = Boolean(parsed.apply_ssf_basic);
            }
          } catch {}
        }
      }

      // Prioritize statutory contributions page taxable components
      const effectiveTaxable =
        statutoryTaxable && statutoryTaxable.length > 0
          ? statutoryTaxable
          : savedTaxable;

      if (!loadedFormula || loadedFormula.length === 0) {
        // Initial build if no formula has ever been saved
        const initialSteps = [];
        initialSteps.push({ op: "+", token: "BASIC" });

        const earnings = normalizedDefs.filter(
          (c) =>
            c.component_type === "ALLOWANCE" ||
            c.component_type === "EARNING" ||
            c.component_type === "BENEFIT",
        );
        for (const e of earnings) {
          initialSteps.push({ op: "+", token: `CMP:${e.id}` });
        }
        if (earnings.length === 0) {
          initialSteps.push({ op: "+", token: "ALLOWANCES" });
        }

        initialSteps.push({ op: "-", token: "SSF" });
        initialSteps.push({ op: "-", token: "TIER3" });
        initialSteps.push({ op: "-", token: "TAX_RELIEF" });
        initialSteps.push({ op: "-", token: "PAYE" });

        const deductions = normalizedDefs.filter(
          (c) =>
            c.component_type === "DEDUCTION" || c.component_type === "RECOVERY",
        );
        for (const d of deductions) {
          initialSteps.push({ op: "-", token: `CMP:${d.id}` });
        }
        if (deductions.length === 0) {
          initialSteps.push({ op: "-", token: "DEDUCTIONS" });
        }

        initialSteps.push({ op: "-", token: "LOANS" });

        setStructure({
          taxable_components: effectiveTaxable,
          apply_ssf_basic: savedApplySsf,
          formula: initialSteps,
        });

        // Pull once and save initial structure
        await api
          .post("/hr/salary-structures", {
            name: activeStructName,
            description: activeStructDesc,
            is_active: activeIsActive,
            components: {
              taxable_components: effectiveTaxable,
              apply_ssf_basic: savedApplySsf,
              formula: initialSteps,
            },
          })
          .catch(() => {});
      } else {
        // Existing formula loaded: normalize legacy tokens
        let normalizedFormula = loadedFormula.map((step) => {
          if (String(step.token || "").startsWith("ALLOWANCE:")) {
            return { ...step, token: "ALLOWANCES" };
          }
          return step;
        });

        // Deduplicate any repeated tokens
        const seenTokens = new Set();
        normalizedFormula = normalizedFormula.filter((step) => {
          const key = `${step.op}:${step.token}`;
          if (seenTokens.has(key)) return false;
          seenTokens.add(key);
          return true;
        });

        // Automatically detect any new component definitions not yet in the sequence
        const existingTokens = new Set(normalizedFormula.map((s) => s.token));

        const earnings = normalizedDefs.filter(
          (c) =>
            c.component_type === "ALLOWANCE" ||
            c.component_type === "EARNING" ||
            c.component_type === "BENEFIT",
        );
        const deductions = normalizedDefs.filter(
          (c) =>
            c.component_type === "DEDUCTION" || c.component_type === "RECOVERY",
        );

        const missingEarnings = earnings.filter(
          (e) => !existingTokens.has(`CMP:${e.id}`),
        );
        const missingDeductions = deductions.filter(
          (d) => !existingTokens.has(`CMP:${d.id}`),
        );

        let formulaModified = false;

        // If new allowances/earnings were added, insert them into Phase 2
        if (missingEarnings.length > 0) {
          formulaModified = true;
          const firstDedIdx = normalizedFormula.findIndex(
            (s) =>
              s.op === "-" ||
              [
                "SSF",
                "TIER3",
                "TAX_RELIEF",
                "PAYE",
                "DEDUCTIONS",
                "LOANS",
              ].includes(s.token),
          );
          const newSteps = missingEarnings.map((e) => ({
            op: "+",
            token: `CMP:${e.id}`,
          }));
          if (firstDedIdx !== -1) {
            normalizedFormula.splice(firstDedIdx, 0, ...newSteps);
          } else {
            normalizedFormula.push(...newSteps);
          }
        }

        // If new deductions were added, insert them into Phase 5
        if (missingDeductions.length > 0) {
          formulaModified = true;
          const loansIdx = normalizedFormula.findIndex(
            (s) => s.token === "LOANS",
          );
          const newSteps = missingDeductions.map((d) => ({
            op: "-",
            token: `CMP:${d.id}`,
          }));
          if (loansIdx !== -1) {
            normalizedFormula.splice(loansIdx, 0, ...newSteps);
          } else {
            normalizedFormula.push(...newSteps);
          }
        }

        // Clean up legacy generic tokens if individual components now exist
        if (earnings.length > 0) {
          const filtered = normalizedFormula.filter(
            (s) => s.token !== "ALLOWANCES",
          );
          if (filtered.length !== normalizedFormula.length) {
            normalizedFormula = filtered;
            formulaModified = true;
          }
        }
        if (deductions.length > 0) {
          const filtered = normalizedFormula.filter(
            (s) => s.token !== "DEDUCTIONS",
          );
          if (filtered.length !== normalizedFormula.length) {
            normalizedFormula = filtered;
            formulaModified = true;
          }
        }

        setStructure({
          taxable_components: effectiveTaxable,
          apply_ssf_basic: savedApplySsf,
          formula: normalizedFormula,
        });

        // "do not always pull Payroll Formula Sequence but pull once and save"
        // If modified due to new components, save once so custom edits and orders are preserved on subsequent loads
        if (formulaModified) {
          await api
            .post("/hr/salary-structures", {
              name: activeStructName,
              description: activeStructDesc,
              is_active: activeIsActive,
              components: {
                taxable_components: effectiveTaxable,
                apply_ssf_basic: savedApplySsf,
                formula: normalizedFormula,
              },
            })
            .catch(() => {});
        }
      }
    } catch {
      toast.error("Failed to load salary structure definitions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    if (!structureName.trim()) {
      toast.error("Structure Name is required");
      return;
    }
    if (!structure.formula || structure.formula.length === 0) {
      toast.error("Please add at least one component to the formula");
      return;
    }

    setSavingStructure(true);
    try {
      await api.post("/hr/salary-structures", {
        name: structureName.trim(),
        description: structureDesc.trim(),
        is_active: isActive,
        components: {
          taxable_components: structure.taxable_components,
          apply_ssf_basic: structure.apply_ssf_basic,
          formula: structure.formula,
        },
      });

      // Synchronize taxable_components back to Statutory Contributions (INCOME_TAX)
      if (allIncomeTaxRows.length > 0) {
        const updatedTaxConfigs = allIncomeTaxRows.map((r) => ({
          ...r,
          taxable_components: structure.taxable_components,
        }));
        await api
          .post("/hr/tax-configs", { configs: updatedTaxConfigs })
          .catch(() => {});
      }

      toast.success("Salary structure configuration saved successfully");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save salary structure",
      );
    } finally {
      setSavingStructure(false);
    }
  };

  // In-Place Visual Table Handlers
  const handleToggleOp = (idx) => {
    const formula = [...structure.formula];
    formula[idx] = {
      ...formula[idx],
      op: formula[idx].op === "+" ? "-" : "+",
    };
    setStructure({ ...structure, formula });
  };

  const handleChangeToken = (idx, newToken) => {
    const formula = [...structure.formula];
    const info = resolveTokenInfo(newToken);
    formula[idx] = {
      ...formula[idx],
      token: newToken,
      op: info.isEarning ? "+" : "-",
    };
    setStructure({ ...structure, formula });
  };

  const handleMoveStep = (idx, direction) => {
    const formula = [...structure.formula];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= formula.length) return;
    const tmp = formula[targetIdx];
    formula[targetIdx] = formula[idx];
    formula[idx] = tmp;
    setStructure({ ...structure, formula });
  };

  const handleRemoveStep = (idx) => {
    const formula = structure.formula.filter((_, i) => i !== idx);
    setStructure({ ...structure, formula });
  };

  const handleAddStep = () => {
    const formula = [...(structure.formula || [])];
    formula.push({ op: "+", token: "ALLOWANCES" });
    setStructure({ ...structure, formula });
  };

  const toggleTaxableComponent = (token) => {
    const current = [...(structure.taxable_components || [])];
    const idx = current.indexOf(token);
    if (idx > -1) {
      current.splice(idx, 1);
    } else {
      current.push(token);
    }
    setStructure({ ...structure, taxable_components: current });
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 md:p-8 space-y-6">
        {/* Page Header - Aligned with Application Design */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Salary Structure Configuration
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ghana GRA Statutory
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Define the gross-to-net payroll formula, statutory sequence, and taxable component rules
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/human-resources/salary-config" className="btn-secondary">
              ← Back to Menu
            </Link>
            <button
              type="button"
              onClick={() => {
                autoEnterComponentsByType();
                toast.success("Automatically entered all components based on their types");
              }}
              className="btn-secondary flex items-center gap-1.5"
              title="Automatically categorize and enter all configured salary components based on their types"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Auto-Enter by Type</span>
            </button>
            <button
              onClick={handleSave}
              disabled={savingStructure || loading}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{savingStructure ? "Saving..." : "Save Structure"}</span>
            </button>
          </div>
        </div>

        {/* Application Metric Cards (Standard 4-Column Metric Grid) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Calculation Sequence
            </span>
            <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
              {stats.totalSteps}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Active formula steps
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Earnings & Allowances
            </span>
            <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
              {stats.earningsCount}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Additions to gross pay (+)
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Statutory Reliefs & PAYE
            </span>
            <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
              {stats.statutoryCount}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              SSF 5.5%, Tier 3, Reliefs & Tax
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Deductions & Loans
            </span>
            <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
              {stats.deductionsCount}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Post-tax company & amortizations
            </span>
          </div>
        </div>

        {/* Live Mathematical Formula Ribbon */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>Net Pay Calculation Sequence (Formula Ribbon)</span>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {structure.formula.length} Steps Active
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono py-1 overflow-x-auto">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
              Net Take-Home Pay
            </span>
            <span className="text-slate-400 font-bold px-1">=</span>
            {(structure.formula || []).map((step, idx) => {
              const info = resolveTokenInfo(step.token);
              const isAdd = step.op === "+";
              return (
                <div key={idx} className="flex items-center gap-1">
                  <span
                    className={`font-bold px-1 ${
                      isAdd ? "text-emerald-600" : "text-rose-500"
                    }`}
                  >
                    {step.op}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-sans font-medium border ${
                      isAdd
                        ? "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                        : "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {info.badge || info.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-400" />
            Loading salary structure and component definitions...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main Column: Formula Sequence Table (Editable In-Place) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Payroll Formula Sequence (Editable)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Toggle addition/deduction, change components, or reorder steps directly in the table
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3 w-12 text-center">#</th>
                        <th className="px-4 py-3 w-20 text-center">Type</th>
                        <th className="px-4 py-3">Salary Component</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {(structure.formula || []).map((step, idx) => {
                        const info = resolveTokenInfo(step.token);
                        const isAdd = step.op === "+";

                        // Intermediate Ghanaian statutory milestone checkpoints
                        const isAfterAllowances =
                          step.token === "ALLOWANCES" ||
                          (String(step.token).startsWith("CMP:") &&
                            idx < structure.formula.length - 1 &&
                            structure.formula[idx + 1]?.op === "-");
                        const isAfterReliefs =
                          step.token === "TAX_RELIEF" ||
                          (step.token === "TIER3" &&
                            idx < structure.formula.length - 1 &&
                            structure.formula[idx + 1]?.token === "PAYE");
                        const isAfterPaye = step.token === "PAYE";

                        return (
                          <React.Fragment key={idx}>
                            <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                              {/* Sequence Number */}
                              <td className="px-4 py-3 text-center font-mono text-xs text-slate-400">
                                {String(idx + 1).padStart(2, "0")}
                              </td>

                              {/* Interactive Operator Toggle (+ or -) */}
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleOp(idx)}
                                  title={`Click to switch to ${isAdd ? "Deduction (−)" : "Addition (+)"}`}
                                  className={`w-7 h-7 rounded-lg text-xs font-bold font-mono inline-flex items-center justify-center transition-all border ${
                                    isAdd
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                                      : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-100"
                                  }`}
                                >
                                  {step.op}
                                </button>
                              </td>

                              {/* Component Dropdown Selector */}
                              <td className="px-4 py-3">
                                <select
                                  className="input w-full text-xs font-semibold py-1.5"
                                  value={step.token}
                                  onChange={(e) => handleChangeToken(idx, e.target.value)}
                                >
                                  <optgroup label="Ghana GRA Statutory Core Components">
                                    <option value="BASIC">Basic Salary (Core Base)</option>
                                    <option value="ALLOWANCES">All Cash Allowances & Benefits</option>
                                    <option value="SSF">SSNIT Employee Contribution (5.5%)</option>
                                    <option value="TIER3">Tier 3 Voluntary Provident Fund</option>
                                    <option value="TAX_RELIEF">GRA Statutory Personal Tax Reliefs</option>
                                    <option value="PAYE">Statutory PAYE (Progressive Brackets)</option>
                                    <option value="DEDUCTIONS">All Company Deductions</option>
                                    <option value="LOANS">Staff Loan Monthly Installments</option>
                                  </optgroup>

                                  {earningsComponents.length > 0 && (
                                    <optgroup label="Configured Allowance Components (+)">
                                      {earningsComponents.map((c) => (
                                        <option key={c.id} value={`CMP:${c.id}`}>
                                          {c.name} ({c.code})
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}

                                  {deductionComponents.length > 0 && (
                                    <optgroup label="Configured Deduction Components (−)">
                                      {deductionComponents.map((c) => (
                                        <option key={c.id} value={`CMP:${c.id}`}>
                                          {c.name} ({c.code})
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}

                                  {tier3Taxes.length > 0 && (
                                    <optgroup label="Tier 3 Funds">
                                      {tier3Taxes.map((t) => (
                                        <option key={t.id} value={`TIER3:${t.id}`}>
                                          Tier 3: {t.tax_name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}

                                  {loanTypes.length > 0 && (
                                    <optgroup label="Staff Loan Types">
                                      {loanTypes.map((l) => (
                                        <option key={l.id} value={`LOAN_TYPE:${l.id}`}>
                                          Loan: {l.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                              </td>

                              {/* Component Classification Badge */}
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {info.type}
                                </span>
                              </td>

                              {/* Actions (Reordering & Delete) */}
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    title="Move Step Up"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveStep(idx, -1)}
                                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition-colors"
                                  >
                                    <ArrowUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Move Step Down"
                                    disabled={idx === structure.formula.length - 1}
                                    onClick={() => handleMoveStep(idx, 1)}
                                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition-colors"
                                  >
                                    <ArrowDown className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Delete Step"
                                    onClick={() => handleRemoveStep(idx)}
                                    className="p-1.5 rounded text-slate-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Milestone Subtotal Rows */}
                            {isAfterAllowances && (
                              <tr className="bg-teal-50/50 dark:bg-teal-950/20 text-teal-800 dark:text-teal-300 font-medium text-xs">
                                <td colSpan={5} className="px-4 py-2 border-y border-teal-100 dark:border-teal-900/40">
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 font-bold">
                                      <Award className="w-4 h-4 text-teal-600" />
                                      Subtotal: Total Gross Cash Emoluments
                                    </span>
                                    <span className="text-[11px] uppercase opacity-75 font-mono">
                                      Basic Salary + Cash Allowances
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {isAfterReliefs && (
                              <tr className="bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 font-medium text-xs">
                                <td colSpan={5} className="px-4 py-2 border-y border-amber-100 dark:border-amber-900/40">
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 font-bold">
                                      <Landmark className="w-4 h-4 text-amber-600" />
                                      Subtotal: Chargeable / Assessable Taxable Income
                                    </span>
                                    <span className="text-[11px] uppercase opacity-75 font-mono">
                                      Gross Emoluments − Statutory Pre-Tax Reliefs
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {isAfterPaye && (
                              <tr className="bg-violet-50/50 dark:bg-violet-950/20 text-violet-800 dark:text-violet-300 font-medium text-xs">
                                <td colSpan={5} className="px-4 py-2 border-y border-violet-100 dark:border-violet-900/40">
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 font-bold">
                                      <Wallet className="w-4 h-4 text-violet-600" />
                                      Subtotal: Net Salary After Statutory Taxes
                                    </span>
                                    <span className="text-[11px] uppercase opacity-75 font-mono">
                                      Taxable Income − GRA PAYE Tax
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Final Net Pay Footer Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-emerald-600" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Final Net Take-Home Pay (Disbursement)
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Final amount disbursed to employee bank or MoMo account
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    Net Take-Home Pay
                  </span>
                </div>
              </div>
            </div>

            {/* Side Column: Structure Details & Taxability Rules */}
            <div className="lg:col-span-4 space-y-4">
              {/* Properties Card */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                  <Sliders className="w-4 h-4 text-slate-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Structure Information
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Structure Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    value={structureName}
                    onChange={(e) => setStructureName(e.target.value)}
                    placeholder="e.g. Ghana Statutory GRA & SSNIT Structure"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    className="input w-full text-xs"
                    value={structureDesc}
                    onChange={(e) => setStructureDesc(e.target.value)}
                    placeholder="Describe structure and statutory rules"
                  />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900 dark:peer-checked:bg-brand-500" />
                  </label>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Active Company Structure
                  </span>
                </div>
              </div>

              {/* Taxable Earning Inclusions Card */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Taxable Earning Inclusions
                  </h2>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(structure.taxable_components || []).includes("BASIC")}
                      onChange={() => toggleTaxableComponent("BASIC")}
                      className="rounded border-slate-300 text-slate-900"
                    />
                    <span>Basic Salary (Taxable Core)</span>
                  </label>

                  {earningsComponents.length === 0 && (
                    <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(structure.taxable_components || []).includes("ALLOWANCES")}
                        onChange={() => toggleTaxableComponent("ALLOWANCES")}
                        className="rounded border-slate-300 text-slate-900"
                      />
                      <span>Cash Allowances (Taxable)</span>
                    </label>
                  )}

                  {earningsComponents.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(structure.taxable_components || []).includes(`CMP:${c.id}`)}
                        onChange={() => toggleTaxableComponent(`CMP:${c.id}`)}
                        className="rounded border-slate-300 text-slate-900"
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      SSNIT 5.5% on Basic Only
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Pensions Act 766 statutory rule
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                    <input
                      type="checkbox"
                      checked={structure.apply_ssf_basic}
                      onChange={(e) =>
                        setStructure({ ...structure, apply_ssf_basic: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900 dark:peer-checked:bg-brand-500" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Guard>
  );
}
