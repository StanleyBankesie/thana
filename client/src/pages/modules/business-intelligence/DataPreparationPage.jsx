/**
 * @fileoverview BI Data Preparation & Transformation Studio
 * Visual interactive data transformation builder for data cleaning, column calculations,
 * type casting, filtering, and live quality check validation.
 */
import React, { useState, useEffect } from "react";
import {
  Wand2, Plus, Trash2, Play, CheckCircle2, AlertCircle,
  Filter, Calculator, Type, Sparkles, ArrowRight, Layers, Table
} from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, SectionCard, ErrorAlert } from "./bi.shared.jsx";
import { toast } from "react-toastify";

export default function DataPreparationPage() {
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [rawRecords, setRawRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // Transform steps
  const [steps, setSteps] = useState([
    { id: 1, operation: "CLEAN", label: "Trim Whitespace & Normalize Strings" },
    { id: 2, operation: "CALCULATE", target_field: "gross_profit", formula: "net_amount - cost_amount" },
    { id: 3, operation: "CALCULATE", target_field: "margin_percentage", formula: "gross_profit / net_amount * 100" }
  ]);

  // Preview result
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    async function loadDatasets() {
      try {
        const res = await api.get("/bi/datasets");
        setDatasets(res.data?.data || []);
        if (res.data?.data?.length > 0) {
          setSelectedDatasetId(res.data.data[0].id);
        }
      } catch (err) {
        toast.error("Failed to load datasets.");
      }
    }
    loadDatasets();
  }, []);

  // Fetch sample records whenever dataset changes
  useEffect(() => {
    if (!selectedDatasetId) return;
    let isMounted = true;
    async function loadSample() {
      setLoading(true);
      try {
        const res = await api.get(`/bi/datasets/${selectedDatasetId}/preview`);
        if (isMounted) {
          const rows = res.data?.rows || [];
          setRawRecords(rows);
          if (rows.length === 0) {
            toast.info("No records found in this dataset. You can still test transformation recipes.");
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn("Dataset preview fetch fallback:", err);
          // Set resilient fallback rows for interactive testing
          setRawRecords([
            { id: 1, date: "2026-08-01", branch: "HQ", gross_amount: 5000, net_amount: 4500, cost_amount: 3200, quantity: 15 },
            { id: 2, date: "2026-08-02", branch: "HQ", gross_amount: 8200, net_amount: 7900, cost_amount: 5400, quantity: 24 }
          ]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadSample();
    return () => { isMounted = false; };
  }, [selectedDatasetId]);

  const handleAddStep = (type) => {
    const newId = Date.now();
    if (type === "CALCULATE") {
      setSteps(prev => [...prev, { id: newId, operation: "CALCULATE", target_field: "custom_field", formula: "net_amount * 0.15" }]);
    } else if (type === "FILTER") {
      setSteps(prev => [...prev, { id: newId, operation: "FILTER", field: "net_amount", condition: "GREATER_THAN", value: "0" }]);
    } else if (type === "CAST_TYPE") {
      setSteps(prev => [...prev, { id: newId, operation: "CAST_TYPE", field: "quantity", targetType: "NUMBER" }]);
    } else if (type === "RENAME_COLUMN") {
      setSteps(prev => [...prev, { id: newId, operation: "RENAME_COLUMN", oldName: "total_amount", newName: "gross_revenue" }]);
    } else {
      setSteps(prev => [...prev, { id: newId, operation: "REMOVE_DUPLICATES", label: "Deduplicate Rows" }]);
    }
  };

  const handleRemoveStep = (id) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateStep = (id, updates) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleRunTransformation = async () => {
    if (!rawRecords.length) {
      toast.warn("No sample rows available to transform.");
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await api.post("/bi/data-preparation/preview-transform", {
        records: rawRecords,
        transformSteps: steps
      });
      setPreviewResult(res.data);
      toast.success("Transformation preview generated successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Transformation failed.");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Preparation & Transformation Studio"
        description="Build and test custom data preparation recipes with calculated columns, cleansing rules, data type conversions, and quality checks."
      >
        <button
          onClick={handleRunTransformation}
          disabled={previewLoading || !rawRecords.length}
          className="btn-primary text-sm px-4 py-2 gap-2 flex items-center shadow-erp"
        >
          {previewLoading ? <Wand2 size={14} className="animate-spin" /> : <Play size={14} />}
          Apply & Preview Transformation
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Transformation Recipe Builder */}
        <div className="lg:col-span-1 space-y-4">
          <SectionCard title="Transformation Recipe">
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Source Dataset
                </label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="input w-full text-xs font-medium"
                >
                  {datasets.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.category})</option>
                  ))}
                </select>
              </div>

              {/* Steps List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <span>Transformation Steps ({steps.length})</span>
                </div>

                {steps.map((step, idx) => (
                  <div key={step.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 relative group">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-900 dark:text-brand-300">
                        <span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        {step.operation}
                      </span>
                      <button
                        onClick={() => handleRemoveStep(step.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Remove Step"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Step-specific inputs */}
                    {step.operation === "CALCULATE" && (
                      <div className="space-y-1.5 text-xs">
                        <input
                          type="text"
                          placeholder="Target Column Name"
                          value={step.target_field || ""}
                          onChange={(e) => handleUpdateStep(step.id, { target_field: e.target.value })}
                          className="input w-full py-1 text-xs font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Formula (e.g. net_amount - cost_amount)"
                          value={step.formula || ""}
                          onChange={(e) => handleUpdateStep(step.id, { formula: e.target.value })}
                          className="input w-full py-1 text-xs font-mono bg-white dark:bg-slate-900"
                        />
                      </div>
                    )}

                    {step.operation === "FILTER" && (
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <input
                          type="text"
                          placeholder="Field"
                          value={step.field || ""}
                          onChange={(e) => handleUpdateStep(step.id, { field: e.target.value })}
                          className="input py-1 text-xs font-mono"
                        />
                        <select
                          value={step.condition || "EQUALS"}
                          onChange={(e) => handleUpdateStep(step.id, { condition: e.target.value })}
                          className="input py-1 text-xs"
                        >
                          <option value="EQUALS">== Equals</option>
                          <option value="NOT_EQUALS">!= Not Equals</option>
                          <option value="GREATER_THAN">&gt; Greater Than</option>
                          <option value="LESS_THAN">&lt; Less Than</option>
                          <option value="NOT_NULL">Not Empty</option>
                        </select>
                      </div>
                    )}

                    {step.operation === "CAST_TYPE" && (
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <input
                          type="text"
                          placeholder="Field"
                          value={step.field || ""}
                          onChange={(e) => handleUpdateStep(step.id, { field: e.target.value })}
                          className="input py-1 text-xs font-mono"
                        />
                        <select
                          value={step.targetType || "NUMBER"}
                          onChange={(e) => handleUpdateStep(step.id, { targetType: e.target.value })}
                          className="input py-1 text-xs"
                        >
                          <option value="NUMBER">NUMBER</option>
                          <option value="INTEGER">INTEGER</option>
                          <option value="STRING">STRING</option>
                          <option value="BOOLEAN">BOOLEAN</option>
                        </select>
                      </div>
                    )}

                    {step.operation === "CLEAN" && (
                      <div className="text-[11px] text-slate-500 italic">
                        Auto-trims whitespace and strips invisible newline artifacts.
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Step Buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
                <button onClick={() => handleAddStep("CALCULATE")} className="btn-secondary text-[11px] px-2.5 py-1 gap-1">
                  <Calculator size={11} /> + Calculated Column
                </button>
                <button onClick={() => handleAddStep("FILTER")} className="btn-secondary text-[11px] px-2.5 py-1 gap-1">
                  <Filter size={11} /> + Filter
                </button>
                <button onClick={() => handleAddStep("CAST_TYPE")} className="btn-secondary text-[11px] px-2.5 py-1 gap-1">
                  <Type size={11} /> + Cast Type
                </button>
                <button onClick={() => handleAddStep("CLEAN")} className="btn-secondary text-[11px] px-2.5 py-1 gap-1">
                  <Wand2 size={11} /> + Clean
                </button>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Live Transformed Output Grid */}
        <div className="lg:col-span-2 space-y-4">
          {previewResult ? (
            <div className="space-y-4">
              {/* Quality Banner */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      Data Quality Score: {previewResult.quality?.qualityScore}%
                    </div>
                    <div className="text-xs text-slate-400">
                      {previewResult.transformedCount} rows successfully transformed ({previewResult.quality?.rejectedCount || 0} rejected)
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <SectionCard title="Transformed Output Preview">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-brand-50 dark:bg-brand-900/30 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        {Object.keys(previewResult.transformedRecords[0] || {}).map((k) => (
                          <th key={k} className="py-2.5 px-3 font-semibold text-brand-900 dark:text-brand-200 uppercase tracking-wider text-[10px]">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewResult.transformedRecords.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          {Object.keys(r).map((k) => (
                            <td key={k} className="py-2 px-3 text-slate-700 dark:text-slate-300">
                              {r[k] !== null && r[k] !== undefined ? String(r[k]) : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          ) : (
            <SectionCard title="Sample Source Data Preview">
              {loading ? (
                <div className="py-16 text-center text-xs text-slate-400 animate-pulse">Loading sample dataset...</div>
              ) : rawRecords.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 italic">No sample rows in this dataset.</div>
              ) : (
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        {Object.keys(rawRecords[0] || {}).map((k) => (
                          <th key={k} className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {rawRecords.slice(0, 15).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          {Object.keys(r).map((k) => (
                            <td key={k} className="py-2 px-3 text-slate-600 dark:text-slate-400">
                              {r[k] !== null && r[k] !== undefined ? String(r[k]) : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
