import React, { useState } from "react";
import {
  FileText,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Download,
  Send,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
} from "lucide-react";

export default function InteractiveFormCard({ form, onFormSubmit }) {
  if (!form || !form.fields || !Array.isArray(form.fields)) {
    return null;
  }

  // Initialize form values with defaults
  const [formData, setFormData] = useState(() => {
    const initial = {};
    form.fields.forEach((f) => {
      initial[f.name] = f.defaultValue !== undefined ? f.defaultValue : (f.type === "checkbox" ? false : "");
    });
    return initial;
  });

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedData, setCopiedData] = useState(false);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleFillSample = () => {
    const samples = {};
    const today = new Date().toISOString().split("T")[0];
    const nowTime = new Date().toTimeString().slice(0, 5);
    const nowDateTime = new Date().toISOString().slice(0, 16);

    form.fields.forEach((f) => {
      const lower = (f.name + " " + f.label).toLowerCase();
      if (f.type === "checkbox") {
        samples[f.name] = true;
      } else if (f.type === "select" || f.type === "radio") {
        const firstOpt = Array.isArray(f.options) && f.options.length > 0
          ? (typeof f.options[0] === "string" ? f.options[0] : f.options[0].value || f.options[0].label)
          : "Standard";
        samples[f.name] = firstOpt;
      } else if (f.type === "date") {
        samples[f.name] = today;
      } else if (f.type === "time") {
        samples[f.name] = nowTime;
      } else if (f.type === "datetime-local") {
        samples[f.name] = nowDateTime;
      } else if (f.type === "number") {
        if (lower.includes("odometer") || lower.includes("km")) samples[f.name] = 124500;
        else if (lower.includes("amount") || lower.includes("cost") || lower.includes("price")) samples[f.name] = 450.00;
        else if (lower.includes("qty") || lower.includes("quantity")) samples[f.name] = 10;
        else samples[f.name] = 25;
      } else if (f.type === "email" || lower.includes("email")) {
        samples[f.name] = "contact@omnisuite-erp.com";
      } else if (f.type === "tel" || lower.includes("phone")) {
        samples[f.name] = "+233 24 555 0199";
      } else if (f.type === "textarea") {
        samples[f.name] = `Standard operational entry recorded for ${form.title}. All parameters checked and verified.`;
      } else {
        // General text
        if (lower.includes("driver") || lower.includes("employee") || lower.includes("requester") || lower.includes("name")) {
          samples[f.name] = "Kwame Mensah";
        } else if (lower.includes("vehicle") || lower.includes("car") || lower.includes("plate")) {
          samples[f.name] = "GT-4421-20 (Toyota HiAce)";
        } else if (lower.includes("company") || lower.includes("vendor") || lower.includes("supplier")) {
          samples[f.name] = "Apex Global Logistics Ltd";
        } else if (lower.includes("customer")) {
          samples[f.name] = "Accra Premium Stores";
        } else if (lower.includes("item") || lower.includes("product") || lower.includes("equipment")) {
          samples[f.name] = "Industrial Air Compressor AC-400";
        } else if (lower.includes("ref") || lower.includes("invoice") || lower.includes("tag") || lower.includes("code")) {
          samples[f.name] = "TRX-2026-9042";
        } else if (lower.includes("location") || lower.includes("address") || lower.includes("site")) {
          samples[f.name] = "Accra Main Terminal / Warehouse A";
        } else {
          samples[f.name] = "Sample Specification";
        }
      }
    });

    setFormData(samples);
    setErrors({});
  };

  const handleReset = () => {
    const reset = {};
    form.fields.forEach((f) => {
      reset[f.name] = f.defaultValue !== undefined ? f.defaultValue : (f.type === "checkbox" ? false : "");
    });
    setFormData(reset);
    setErrors({});
    setSubmitted(false);
    setSubmittedData(null);
  };

  const handleValidateAndSubmit = (e) => {
    if (e) e.preventDefault();
    const newErrors = {};

    form.fields.forEach((f) => {
      if (f.required) {
        const val = formData[f.name];
        if (f.type === "checkbox") {
          if (!val) newErrors[f.name] = `${f.label} is required`;
        } else if (val === undefined || val === null || String(val).trim() === "") {
          newErrors[f.name] = `${f.label} is required`;
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitted(true);
    setSubmittedData({ ...formData });

    if (typeof onFormSubmit === "function") {
      onFormSubmit({ formId: form.id, title: form.title, data: formData });
    }
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(JSON.stringify(form, null, 2));
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  const handleCopyData = () => {
    if (!submittedData) return;
    navigator.clipboard.writeText(JSON.stringify(submittedData, null, 2));
    setCopiedData(true);
    setTimeout(() => setCopiedData(false), 2000);
  };

  const handleExportCSV = () => {
    const dataToExport = submittedData || formData;
    const headers = form.fields.map((f) => `"${f.label.replace(/"/g, '""')}"`).join(",");
    const values = form.fields.map((f) => `"${String(dataToExport[f.name] ?? "").replace(/"/g, '""')}"`).join(",");
    const csvContent = "data:text/csv;charset=utf-8," + [headers, values].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${(form.title || "form").toLowerCase().replace(/[^a-z0-9]/g, "_")}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="my-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-apple-md overflow-hidden text-left transition-all">
      {/* Form Top Banner */}
      <div className="p-4 bg-gradient-to-r from-slate-50 via-brand-50/40 to-slate-50 dark:from-slate-800/80 dark:via-brand-950/40 dark:to-slate-800/80 border-b border-slate-200/90 dark:border-slate-700/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-900 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <FileText size={20} className="text-secondary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  {form.title || "Interactive Form"}
                </h3>
                {form.category && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-800 dark:text-brand-300">
                    {form.category}
                  </span>
                )}
              </div>
              {form.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {form.description}
                </p>
              )}
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleFillSample}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 hover:bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:hover:bg-brand-900/60 dark:text-brand-300 border border-brand-200 dark:border-brand-700/60 transition-all shadow-apple-xs active:scale-95"
              title="Populate realistic dummy data into all fields"
            >
              <Sparkles size={13} className="text-secondary" />
              <span>Fill Sample Data</span>
            </button>

            <button
              type="button"
              onClick={handleCopySchema}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all"
              title="Copy JSON form schema"
            >
              {copiedSchema ? <Check size={13} className="text-secondary" /> : <Copy size={13} />}
              <span>{copiedSchema ? "Copied" : "Copy Schema"}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Reset fields"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Submission Success Alert */}
      {submitted && submittedData && (
        <div className="m-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={18} className="text-secondary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Form Entry Captured Successfully!
                </h4>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  The data for <strong>{form.title}</strong> has been validated and captured.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={handleCopyData}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-apple-xs hover:bg-emerald-50 transition"
                  >
                    {copiedData ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedData ? "Copied Data" : "Copy JSON Data"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-apple-xs hover:bg-emerald-50 transition"
                  >
                    <Download size={12} />
                    <span>Download CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="underline text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 ml-2"
                  >
                    Edit / Submit Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Body */}
      <form onSubmit={handleValidateAndSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {form.fields.map((field) => {
            const isFullWidth = field.width === "full" || field.type === "textarea";
            const isHalfWidth = field.width === "half";
            const colSpan = isFullWidth
              ? "col-span-1 md:col-span-2 lg:col-span-3"
              : isHalfWidth
              ? "col-span-1 md:col-span-1 lg:col-span-2"
              : "col-span-1";

            const error = errors[field.name];
            const val = formData[field.name] ?? "";

            return (
              <div key={field.name} className={`${colSpan} space-y-1.5`}>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-rose-500 font-bold">*</span>}
                  </span>
                  {field.helpText && (
                    <span className="text-[10px] font-normal text-slate-400">
                      {field.helpText}
                    </span>
                  )}
                </label>

                {field.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={val}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 outline-none transition-all shadow-apple-xs focus:ring-2 focus:ring-brand-500/20 ${
                      error
                        ? "border-rose-400 focus:border-rose-500 ring-rose-500/10"
                        : "border-slate-200 dark:border-slate-700 focus:border-brand-600 dark:focus:border-brand-400"
                    }`}
                  />
                ) : field.type === "select" ? (
                  <select
                    value={val}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 outline-none transition-all shadow-apple-xs focus:ring-2 focus:ring-brand-500/20 ${
                      error
                        ? "border-rose-400 focus:border-rose-500"
                        : "border-slate-200 dark:border-slate-700 focus:border-brand-600 dark:focus:border-brand-400"
                    }`}
                  >
                    <option value="">-- Select {field.label} --</option>
                    {(field.options || []).map((opt, oIdx) => {
                      const optLabel = typeof opt === "string" ? opt : opt.label || opt.value;
                      const optVal = typeof opt === "string" ? opt : opt.value ?? opt.label;
                      return (
                        <option key={oIdx} value={optVal}>
                          {optLabel}
                        </option>
                      );
                    })}
                  </select>
                ) : field.type === "checkbox" ? (
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(val)}
                      onChange={(e) => handleChange(field.name, e.target.checked)}
                      className="w-4 h-4 rounded text-brand-900 focus:ring-brand-500/20 border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {field.placeholder || field.label}
                    </span>
                  </label>
                ) : (
                  <input
                    type={field.type || "text"}
                    value={val}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 outline-none transition-all shadow-apple-xs focus:ring-2 focus:ring-brand-500/20 ${
                      error
                        ? "border-rose-400 focus:border-rose-500 ring-rose-500/10"
                        : "border-slate-200 dark:border-slate-700 focus:border-brand-600 dark:focus:border-brand-400"
                    }`}
                  />
                )}

                {error && (
                  <p className="flex items-center gap-1 text-[11px] text-rose-500 font-medium animate-fade-in">
                    <AlertCircle size={11} />
                    <span>{error}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit & Reset Bar */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            {form.fields.filter((f) => f.required).length} required field(s)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Clear
            </button>
            <button
              type="submit"
              className="btn btn-primary inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-apple-xs hover:shadow-apple-md transition active:scale-95"
            >
              <Send size={13} />
              <span>{form.submitLabel || "Submit Form"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
