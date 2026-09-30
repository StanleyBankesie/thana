import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/* ─── Ghana PAYE default bands ─── */
const GRA_DEFAULT_BANDS = [
  { chargeableIncome: 490, rate: 0 },
  { chargeableIncome: 110, rate: 5 },
  { chargeableIncome: 130, rate: 10 },
  { chargeableIncome: 3000, rate: 17.5 },
  { chargeableIncome: 16395, rate: 25 },
  { chargeableIncome: 0, rate: 30 }, // 0 = excess / no limit
];

/* ─── Helpers ─── */
const fmt = (n) =>
  Number(n || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function bandLabel(idx, width) {
  if (idx === 0) return `First ${fmt(width)}`;
  if (!width || Number(width) === 0) return "Excess (above)";
  return `Next ${fmt(width)}`;
}

/** Calculate cumulative min/max from band widths */
function bandsToRanges(bands) {
  let cursor = 0;
  return bands.map((b, i) => {
    const w = Number(b.chargeableIncome || 0);
    const min = cursor;
    const max = w === 0 ? null : cursor + w; // null = no limit
    cursor += w;
    return { ...b, min_amount: min, max_amount: max };
  });
}

/** Compute PAYE for a given monthly income using graduated bands */
function computePAYE(grossMonthly, bands) {
  let remaining = Number(grossMonthly || 0);
  let totalTax = 0;
  const breakdown = [];
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    const width = Number(b.chargeableIncome || 0);
    const rate = Number(b.rate || 0) / 100;
    const isExcess = width === 0;
    const taxableInBand = isExcess ? remaining : Math.min(remaining, width);
    const taxOnBand = taxableInBand * rate;
    breakdown.push({
      idx: i,
      chargeableIncome: width,
      rate: Number(b.rate || 0),
      taxableInBand,
      taxOnBand,
      isExcess,
    });
    totalTax += taxOnBand;
    remaining -= taxableInBand;
    if (remaining <= 0) break;
  }
  return { totalTax, breakdown };
}

/* ─── PAYE Calculator Preview ─── */
function PAYECalculator({ bands }) {
  const [salary, setSalary] = useState(5000);
  const { totalTax, breakdown } = useMemo(
    () => computePAYE(salary, bands),
    [salary, bands],
  );

  return (
    <div className="mt-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900/60 dark:to-indigo-900/30 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60">
        <div className="flex items-center gap-3">
          <span className="text-lg">🧮</span>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              PAYE Calculator Preview
            </h3>
            <p className="text-xs text-slate-500">
              Enter a monthly salary to see the graduated tax breakdown
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              GHS
            </span>
            <input
              type="number"
              className="input w-36 py-1.5 text-sm font-mono text-right font-bold"
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value) || 0)}
              min={0}
              step={100}
            />
          </div>
        </div>
      </div>

      <div className="p-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="pb-2 pr-3">Band</th>
              <th className="pb-2 pr-3 text-right">Chargeable Income</th>
              <th className="pb-2 pr-3 text-right">Rate</th>
              <th className="pb-2 pr-3 text-right">Taxable Amount</th>
              <th className="pb-2 text-right">Tax</th>
                        <th>Created By</th>
            <th>Created Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
            {breakdown.map((b) => (
              <tr
                key={b.idx}
                className={
                  b.taxableInBand > 0
                    ? "text-slate-800 dark:text-slate-200"
                    : "text-slate-400 dark:text-slate-600"
                }
              >
                <td className="py-1.5 pr-3">
                  <span className="text-xs font-medium">
                    {bandLabel(b.idx, b.chargeableIncome)}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-xs">
                  {b.isExcess ? "∞" : fmt(b.chargeableIncome)}
                </td>
                <td className="py-1.5 pr-3 text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      b.rate === 0
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                        : b.rate <= 10
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                          : b.rate <= 20
                            ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                            : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {b.rate}%
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-xs">
                  {fmt(b.taxableInBand)}
                </td>
                <td className="py-1.5 text-right font-mono text-xs font-bold">
                  {fmt(b.taxOnBand)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 dark:border-slate-600">
              <td
                colSpan={4}
                className="py-2 pr-3 text-right font-bold text-sm text-slate-700 dark:text-slate-200"
              >
                ✅ Total PAYE
              </td>
              <td className="py-2 text-right font-mono font-bold text-sm text-brand">
                GHS {fmt(totalTax)}
              </td>
            </tr>
            <tr className="text-[11px] text-slate-500">
              <td colSpan={4} className="py-1 pr-3 text-right">
                Net After Tax
              </td>
              <td className="py-1 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                GHS {fmt(salary - totalTax)}
              </td>
            </tr>
            <tr className="text-[11px] text-slate-500">
              <td colSpan={4} className="py-1 pr-3 text-right">
                Effective Rate
              </td>
              <td className="py-1 text-right font-mono font-semibold">
                {salary > 0 ? ((totalTax / salary) * 100).toFixed(2) : "0.00"}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function TaxConfigList() {
  const [viewMode, setViewMode] = useViewMode();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [payeBands, setPayeBands] = useState([]);
  const [ssfTaxes, setSsfTaxes] = useState([]);
  const [tier3Taxes, setTier3Taxes] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [showInfo, setShowInfo] = useState(false);

  /** Convert DB rows (min/max range) → graduated bands */
  const dbRowsToBands = useCallback((rows) => {
    const sorted = [...rows].sort(
      (a, b) => Number(a.min_amount || 0) - Number(b.min_amount || 0),
    );
    return sorted.map((row, i) => {
      const min = Number(row.min_amount || 0);
      const max = row.max_amount === null || row.max_amount === "" 
        ? null 
        : Number(row.max_amount);
      const chargeableIncome = max === null ? 0 : max - min;
      return {
        ...row,
        chargeableIncome,
        rate: Number(row.tax_rate || 0),
      };
    });
  }, []);

  /** Convert graduated bands → DB rows (min/max range) for saving */
  const bandsToDbRows = useCallback((bands) => {
    let cursor = 0;
    return bands.map((band, i) => {
      const width = Number(band.chargeableIncome || 0);
      const min = cursor;
      const max = width === 0 ? null : cursor + width;
      cursor += width;
      return {
        ...band,
        min_amount: min,
        max_amount: max === null ? "" : max,
        tax_rate: Number(band.rate || 0),
      };
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [taxRes, alwRes] = await Promise.all([
        api.get("/hr/tax-configs").catch(() => ({ data: { items: [] } })),
        api.get("/hr/allowances").catch(() => ({ data: { items: [] } })),
      ]);
      const items = taxRes.data.items || [];
      setAllowances(alwRes.data.items || []);

      const incomeTaxRows = items
        .filter((i) => i.tax_type === "INCOME_TAX")
        .sort((a, b) => Number(a.min_amount) - Number(b.min_amount));
      setPayeBands(dbRowsToBands(incomeTaxRows));
      setSsfTaxes(items.filter((i) => i.tax_type === "SOCIAL_SECURITY"));
      setTier3Taxes(items.filter((i) => i.tax_type === "PROVIDENT_FUND"));
      setDeletedIds([]);
    } catch {
      toast.error("Failed to load tax configurations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ─── Band handlers ─── */
  const addBand = () => {
    setPayeBands((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        tax_name: "PAYE",
        tax_type: "INCOME_TAX",
        chargeableIncome: 0,
        rate: 0,
        taxable_components: prev.length > 0 
          ? (Array.isArray(prev[0].taxable_components) ? prev[0].taxable_components : [])
          : [],
        is_active: true,
      },
    ]);
  };

  const removeBand = (id) => {
    if (!String(id).startsWith("new")) {
      setDeletedIds((prev) => [...prev, id]);
    }
    setPayeBands((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBand = (id, field, value) => {
    setPayeBands((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    );
  };

  const moveBand = (idx, direction) => {
    setPayeBands((prev) => {
      const arr = [...prev];
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= arr.length) return arr;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const loadDefaults = () => {
    // Keep existing IDs for deletion
    const existingIds = payeBands
      .filter((b) => !String(b.id).startsWith("new"))
      .map((b) => b.id);
    setDeletedIds((prev) => [...prev, ...existingIds]);

    setPayeBands(
      GRA_DEFAULT_BANDS.map((b, i) => ({
        id: `new-${Date.now()}-${i}`,
        tax_name: "PAYE",
        tax_type: "INCOME_TAX",
        chargeableIncome: b.chargeableIncome,
        rate: b.rate,
        taxable_components: [],
        is_active: true,
      })),
    );
    toast.info("Loaded GRA default PAYE bands");
  };

  const savePAYE = async () => {
    setSaving(true);
    try {
      const dbRows = bandsToDbRows(payeBands);
      await api.post("/hr/tax-configs", {
        configs: dbRows,
        idsToDelete: deletedIds,
      });
      toast.success("PAYE bands saved successfully");
      loadData();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to save PAYE bands",
      );
    } finally {
      setSaving(false);
    }
  };

  /* ─── Cumulative ranges (for display) ─── */
  const cumulativeRanges = useMemo(() => {
    let cursor = 0;
    return payeBands.map((b) => {
      const width = Number(b.chargeableIncome || 0);
      const from = cursor;
      const to = width === 0 ? null : cursor + width;
      cursor += width;
      return { from, to };
    });
  }, [payeBands]);

  /* ─── SSF / Tier 3 handlers (unchanged) ─── */
  const handleAddRow = (type, setter) => {
    setter((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        tax_name:
          type === "SOCIAL_SECURITY" ? "SSF Tier" : "Tier 3",
        tax_type: type,
        min_amount: 0,
        max_amount: "",
        tax_rate: 0,
        fixed_amount: 0,
        employee_contribution_rate: 0,
        employer_contribution_rate: 0,
        is_active: true,
      },
    ]);
  };

  const handleRemoveRow = (id, setter) => {
    if (!String(id).startsWith("new")) {
      setDeletedIds((prev) => [...prev, id]);
    }
    setter((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdate = (id, field, value, setter) => {
    setter((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">
              Statutory Contributions & Taxes
            </h1>
            <p className="text-sm text-slate-500">
              Configure PAYE graduated bands, SSF, and Tier 3 contributions
              based on Ghana Revenue Authority guidelines
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.history.back()} className="btn-secondary">
              Back to Menu
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Loading configurations...
          </div>
        ) : (
          <div className="space-y-8">
            {/* ════════════════════════════════════════════════════════════ */}
            {/* PAYE GRADUATED TAX BANDS */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Section Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                      <span className="text-white text-lg">📊</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        PAYE Income Tax — Graduated Band Setup
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Ghana Revenue Authority (GRA) Pay-As-You-Earn system •
                        Income is taxed progressively across bands
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => setShowInfo(!showInfo)}
                      className="btn-secondary py-1 text-xs"
                      title="How PAYE works"
                    >
                      {showInfo ? "Hide Info" : "ℹ️ How It Works"}
                    </button>
                    <button
                      onClick={loadDefaults}
                      className="btn-secondary py-1 text-xs"
                      title="Load GRA default bands"
                    >
                      🔄 Load GRA Defaults
                    </button>
                    <button
                      onClick={addBand}
                      className="btn-secondary py-1 text-xs"
                    >
                      + Add Band
                    </button>
                    <button
                      onClick={savePAYE}
                      disabled={saving || loading}
                      className="btn-primary py-1 text-xs"
                    >
                      {saving ? "Saving..." : "💾 Save PAYE Bands"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Info Panel (collapsible) */}
              {showInfo && (
                <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900/80 dark:to-indigo-900/30 border-b border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* How PAYE Works */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <span>🔑</span> How the PAYE Graduated System Works
                      </h3>
                      <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5">
                            1
                          </span>
                          <p>
                            <strong className="text-slate-700 dark:text-slate-200">
                              It's Progressive:
                            </strong>{" "}
                            Instead of taxing your full salary at one rate, your
                            income is split into portions (bands). Each portion
                            is taxed at its own percentage.
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5">
                            2
                          </span>
                          <p>
                            <strong className="text-slate-700 dark:text-slate-200">
                              Tax-Free Threshold:
                            </strong>{" "}
                            The first band (e.g. GHS 490) enjoys a 0% tax rate —
                            everyone gets this benefit.
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5">
                            3
                          </span>
                          <p>
                            <strong className="text-slate-700 dark:text-slate-200">
                              Deducted at Source:
                            </strong>{" "}
                            Employers calculate and deduct PAYE before salary is
                            paid. Applies to basic salary, allowances, bonuses,
                            etc.
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5">
                            4
                          </span>
                          <p>
                            <strong className="text-slate-700 dark:text-slate-200">
                              Only Extra Income Taxed More:
                            </strong>{" "}
                            The more you earn, the higher the marginal rate — but
                            only the extra income above each threshold is taxed at
                            the higher rate.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Applies to */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <span>📋</span> What PAYE Applies To
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: "💰", label: "Basic Salary", desc: "Core monthly pay" },
                          { icon: "🏠", label: "Housing Allowance", desc: "Residential benefits" },
                          { icon: "🚗", label: "Transport Allowance", desc: "Commuting benefits" },
                          { icon: "🎁", label: "Bonuses", desc: "Performance/seasonal" },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center gap-2 p-2 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60"
                          >
                            <span className="text-sm">{item.icon}</span>
                            <div>
                              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                {item.label}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {item.desc}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                          <strong>⚠️ Note:</strong> The order of bands matters.
                          Bands are applied sequentially from top to bottom. The
                          last band with "Chargeable Income" set to 0 captures
                          all excess income.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* PAYE Calculator Preview */}
                  <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
                    <PAYECalculator bands={payeBands} />
                  </div>
                </div>
              )}

              {/* Bands Table */}
              <div className="p-4 space-y-4">
                {payeBands.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-4xl mb-3">📊</div>
                    <p className="text-sm font-medium text-slate-500 mb-1">
                      No PAYE bands defined yet
                    </p>
                    <p className="text-xs text-slate-400 mb-4">
                      Click "Load GRA Defaults" to start with Ghana's current
                      tax bands, or add bands manually.
                    </p>
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={loadDefaults}
                        className="btn-primary py-1.5 text-xs"
                      >
                        🔄 Load GRA Default Bands
                      </button>
                      <button
                        onClick={addBand}
                        className="btn-secondary py-1.5 text-xs"
                      >
                        + Add Band Manually
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Taxable Components selector (shared across all bands) */}
                    <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Taxable Salary Components
                        </span>
                        <span className="text-[10px] text-slate-400">
                          (applied to all bands)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {(() => {
                          let comps = [];
                          try {
                            comps = Array.isArray(payeBands[0]?.taxable_components)
                              ? payeBands[0].taxable_components
                              : JSON.parse(payeBands[0]?.taxable_components || "[]");
                          } catch {}
                          
                          const toggleComp = (key) => {
                            const set = new Set(comps);
                            if (set.has(key)) set.delete(key);
                            else set.add(key);
                            const newComps = Array.from(set);
                            setPayeBands((prev) =>
                              prev.map((b) => ({
                                ...b,
                                taxable_components: newComps,
                              })),
                            );
                          };

                          return (
                            <>
                              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={comps.includes("BASIC")}
                                  onChange={() => toggleComp("BASIC")}
                                  className="rounded"
                                />
                                <span className="text-xs font-medium">BASIC</span>
                              </label>
                              {allowances.map((a) => {
                                const key = `ALLOWANCE:${a.id}`;
                                return (
                                  <label
                                    key={a.id}
                                    className="inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={comps.includes(key)}
                                      onChange={() => toggleComp(key)}
                                      className="rounded"
                                    />
                                    <span className="text-xs">
                                      {a.allowance_name}
                                    </span>
                                  </label>
                                );
                              })}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Band Rows */}
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                      <table className="min-w-full">
                        <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
                          <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <th className="px-3 py-3 w-10">#</th>
                            <th className="px-3 py-3">Band Description</th>
                            <th className="px-3 py-3 text-right">
                              Chargeable Income (GHS)
                            </th>
                            <th className="px-3 py-3 text-right">
                              Cumulative Range
                            </th>
                            <th className="px-3 py-3 text-center">
                              Rate (%)
                            </th>
                            <th className="px-3 py-3 w-24 text-center">
                              Order
                            </th>
                            <th className="px-3 py-3 w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {payeBands.map((band, idx) => {
                            const range = cumulativeRanges[idx] || {
                              from: 0,
                              to: null,
                            };
                            const isExcess =
                              Number(band.chargeableIncome || 0) === 0;
                            const rateColor =
                              Number(band.rate) === 0
                                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700"
                                : Number(band.rate) <= 10
                                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                                  : Number(band.rate) <= 20
                                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700"
                                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700";

                            return (
                              <tr
                                key={band.id}
                                className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors"
                              >
                                {/* Band number */}
                                <td className="px-3 py-2.5">
                                  <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                    {idx + 1}
                                  </span>
                                </td>

                                {/* Band label */}
                                <td className="px-3 py-2.5">
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {bandLabel(
                                      idx,
                                      band.chargeableIncome,
                                    )}
                                  </span>
                                  {isExcess && (
                                    <span className="ml-2 text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                                      Catch-all
                                    </span>
                                  )}
                                  {idx === 0 &&
                                    Number(band.rate) === 0 && (
                                      <span className="ml-2 text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">
                                        Tax-Free
                                      </span>
                                    )}
                                </td>

                                {/* Chargeable income input */}
                                <td className="px-3 py-2.5 text-right">
                                  <input
                                    type="number"
                                    className="input py-1 text-sm w-32 text-right font-mono"
                                    value={band.chargeableIncome}
                                    onChange={(e) =>
                                      updateBand(
                                        band.id,
                                        "chargeableIncome",
                                        Number(e.target.value) || 0,
                                      )
                                    }
                                    min={0}
                                    placeholder="0 = excess"
                                    title="Enter 0 for the excess/catch-all band"
                                  />
                                </td>

                                {/* Cumulative range display */}
                                <td className="px-3 py-2.5 text-right">
                                  <span className="text-xs text-slate-500 font-mono">
                                    {fmt(range.from)} –{" "}
                                    {range.to === null ? "∞" : fmt(range.to)}
                                  </span>
                                </td>

                                {/* Rate input */}
                                <td className="px-3 py-2.5 text-center">
                                  <div className="flex justify-center">
                                    <div
                                      className={`inline-flex items-center rounded-lg border px-1 ${rateColor}`}
                                    >
                                      <input
                                        type="number"
                                        step="0.1"
                                        className="w-16 py-1 text-sm text-center font-bold bg-transparent border-none outline-none appearance-none"
                                        value={band.rate}
                                        onChange={(e) =>
                                          updateBand(
                                            band.id,
                                            "rate",
                                            Number(e.target.value) || 0,
                                          )
                                        }
                                        min={0}
                                        max={100}
                                      />
                                      <span className="text-xs font-bold pr-1">
                                        %
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Reorder buttons */}
                                <td className="px-3 py-2.5 text-center">
                                  <div className="flex gap-0.5 justify-center">
                                    <button
                                      onClick={() => moveBand(idx, -1)}
                                      disabled={idx === 0}
                                      className="w-6 h-6 text-xs rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                                      title="Move up"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      onClick={() => moveBand(idx, 1)}
                                      disabled={idx === payeBands.length - 1}
                                      className="w-6 h-6 text-xs rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                                      title="Move down"
                                    >
                                      ↓
                                    </button>
                                  </div>
                                </td>

                                {/* Remove */}
                                <td className="px-3 py-2.5 text-right">
                                  <button
                                    onClick={() => removeBand(band.id)}
                                    className="text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors font-bold px-1"
                                    title="Remove band"
                                  >
                                    &times;
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Visual Band Summary / Bar */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Visual Band Breakdown
                      </div>
                      <div className="flex rounded-lg overflow-hidden h-8 border border-slate-200 dark:border-slate-700">
                        {(() => {
                          const total = payeBands.reduce(
                            (s, b) =>
                              s + (Number(b.chargeableIncome) || 0),
                            0,
                          );
                          const displayTotal = total || 1;
                          const colors = [
                            "bg-emerald-400",
                            "bg-blue-400",
                            "bg-cyan-400",
                            "bg-amber-400",
                            "bg-orange-400",
                            "bg-red-400",
                            "bg-rose-400",
                          ];
                          return payeBands.map((b, i) => {
                            const w = Number(b.chargeableIncome) || 0;
                            const isExcess = w === 0;
                            const pct = isExcess
                              ? 15
                              : (w / displayTotal) * 85;
                            return (
                              <div
                                key={b.id}
                                className={`${colors[i % colors.length]} flex items-center justify-center text-[9px] font-bold text-white transition-all relative group`}
                                style={{
                                  width: `${Math.max(pct, 4)}%`,
                                }}
                                title={`Band ${i + 1}: ${isExcess ? "Excess" : fmt(w)} @ ${b.rate}%`}
                              >
                                {pct > 8 && (
                                  <span>{b.rate}%</span>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                      <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
                        {payeBands.map((b, i) => {
                          const colors = [
                            "bg-emerald-400",
                            "bg-blue-400",
                            "bg-cyan-400",
                            "bg-amber-400",
                            "bg-orange-400",
                            "bg-red-400",
                            "bg-rose-400",
                          ];
                          return (
                            <span key={b.id} className="inline-flex items-center gap-1">
                              <span
                                className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`}
                              ></span>
                              {bandLabel(i, b.chargeableIncome)} @{" "}
                              <strong>{b.rate}%</strong>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* Social Security Fund */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-brand">
                  Social Security Fund (SSF) Setup
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddRow("SOCIAL_SECURITY", setSsfTaxes)}
                    className="btn-secondary py-1 text-xs"
                  >
                    + Add SSF Tier
                  </button>
                  <button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await api.post("/hr/tax-configs", {
                          configs: ssfTaxes,
                          idsToDelete: deletedIds,
                        });
                        toast.success("SSF saved");
                        loadData();
                      } catch (err) {
                        toast.error(
                          err?.response?.data?.message || "Failed to save SSF",
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving || loading}
                    className="btn-primary py-1 text-xs"
                  >
                    Save SSF
                  </button>
                </div>
              </div>
              
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
                <table className={ "min-w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
                  <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-3">Tier Name</th>
                      <th className="px-4 py-3">Employee Contribution (%)</th>
                      <th className="px-4 py-3">Employer Contribution (%)</th>
                      <th className="px-4 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {ssfTaxes.map((tax) => (
                      <tr key={tax.id}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="input py-1 text-sm"
                            value={tax.tax_name}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "tax_name",
                                e.target.value,
                                setSsfTaxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="input py-1 text-sm font-mono"
                            value={tax.employee_contribution_rate}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "employee_contribution_rate",
                                e.target.value,
                                setSsfTaxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="input py-1 text-sm font-mono bg-emerald-50 dark:bg-emerald-900/20"
                            value={tax.employer_contribution_rate}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "employer_contribution_rate",
                                e.target.value,
                                setSsfTaxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleRemoveRow(tax.id, setSsfTaxes)}
                            className="text-red-500 hover:text-red-700 font-bold px-2"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                    {ssfTaxes.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-slate-500 text-sm"
                        >
                          No SSF tiers defined.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* Provident Fund Tier 3 */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-brand">
                  Provident Fund (Tier 3) Setup
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      handleAddRow("PROVIDENT_FUND", setTier3Taxes)
                    }
                    className="btn-secondary py-1 text-xs"
                  >
                    + Add Tier 3 Profile
                  </button>
                  <button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await api.post("/hr/tax-configs", {
                          configs: tier3Taxes,
                          idsToDelete: deletedIds,
                        });
                        toast.success("Tier 3 saved");
                        loadData();
                      } catch (err) {
                        toast.error(
                          err?.response?.data?.message ||
                            "Failed to save Tier 3",
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving || loading}
                    className="btn-primary py-1 text-xs"
                  >
                    Save Tier 3
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-3">Profile Name</th>
                      <th className="px-4 py-3">Employee Contribution (%)</th>
                      <th className="px-4 py-3">Employer Contribution (%)</th>
                        <th className="px-4 py-3">Employee Contribution (%)</th>
                        <th className="px-4 py-3">Employer Contribution (%)</th>
                        <th className="px-4 py-3">Created By</th>
                        <th className="px-4 py-3">Created Date</th>
                        <th className="px-4 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tier3Taxes.map((tax) => (
                      <tr key={tax.id}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="input py-1 text-sm"
                            value={tax.tax_name}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "tax_name",
                                e.target.value,
                                setTier3Taxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="input py-1 text-sm font-mono"
                            value={tax.employee_contribution_rate}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "employee_contribution_rate",
                                e.target.value,
                                setTier3Taxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="input py-1 text-sm font-mono bg-emerald-50 dark:bg-emerald-900/20"
                            value={tax.employer_contribution_rate}
                            onChange={(e) =>
                              handleUpdate(
                                tax.id,
                                "employer_contribution_rate",
                                e.target.value,
                                setTier3Taxes,
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-sm">{tax.created_by_name || "-"}</td>
                        <td className="px-4 py-2 text-sm">{tax.created_at ? new Date(tax.created_at).toLocaleDateString() : "-"}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() =>
                              handleRemoveRow(tax.id, setTier3Taxes)
                            }
                            className="text-red-500 hover:text-red-700 font-bold px-2"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                    {tier3Taxes.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-slate-500 text-sm"
                        >
                          No Tier 3 profiles defined.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </Guard>
  );
}
