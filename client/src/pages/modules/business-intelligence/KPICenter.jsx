/**
 * @fileoverview KPI Center — define, view, and track custom KPIs with targets and thresholds.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Target, Plus, TrendingUp, TrendingDown, Minus, Trash2, Edit } from "lucide-react";
import { PageHeader, SectionCard } from "./bi.shared.jsx";

const STORAGE_KEY = "bi_kpis";
const MODULES = ["Sales", "Finance", "Inventory", "Purchase", "HR", "Projects", "Maintenance", "Production", "Transport", "Service", "POS", "Administration"];
const TREND_OPTIONS = ["Up is good", "Down is good", "Neutral"];
const FORMAT_OPTIONS = ["Number", "Currency (GHS)", "Percentage (%)"];

function KpiForm({ onSave, onCancel, initial }) {
  const [name, setName] = useState(initial?.name || "");
  const [module, setModule] = useState(initial?.module || MODULES[0]);
  const [target, setTarget] = useState(initial?.target || "");
  const [current, setCurrent] = useState(initial?.current || "");
  const [trend, setTrend] = useState(initial?.trend || TREND_OPTIONS[0]);
  const [format, setFormat] = useState(initial?.format || FORMAT_OPTIONS[0]);
  const [description, setDescription] = useState(initial?.description || "");

  const fmt = (v) => {
    const n = Number(v);
    if (!v && v !== 0) return "—";
    if (format === "Currency (GHS)") return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    if (format === "Percentage (%)") return `${n}%`;
    return n.toLocaleString();
  };

  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">KPI Name *</label>
          <input className="input w-full text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Monthly Revenue" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Module</label>
          <select className="input w-full text-sm" value={module} onChange={e => setModule(e.target.value)}>
            {MODULES.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Target Value</label>
          <input type="number" className="input w-full text-sm" value={target} onChange={e => setTarget(e.target.value)} placeholder="e.g. 100000" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Current Value</label>
          <input type="number" className="input w-full text-sm" value={current} onChange={e => setCurrent(e.target.value)} placeholder="Enter current value" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Trend Direction</label>
          <select className="input w-full text-sm" value={trend} onChange={e => setTrend(e.target.value)}>
            {TREND_OPTIONS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Format</label>
          <select className="input w-full text-sm" value={format} onChange={e => setFormat(e.target.value)}>
            {FORMAT_OPTIONS.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Description</label>
          <textarea className="input w-full text-sm" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes about this KPI" />
        </div>
      </div>
      <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button className="btn-primary text-sm px-4" onClick={() => {
          if (!name.trim()) return;
          onSave({ id: initial?.id || Date.now(), name, module, target: Number(target), current: Number(current), trend, format, description, updatedAt: new Date().toISOString() });
        }}>
          {initial ? "Update KPI" : "Save KPI"}
        </button>
        <button className="btn-secondary text-sm px-4" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function KpiCard({ kpi, onEdit, onDelete }) {
  const progress = kpi.target > 0 ? Math.min(200, Math.round(kpi.current / kpi.target * 100)) : 0;
  const isGood = (kpi.trend === "Up is good" && kpi.current >= kpi.target) ||
                 (kpi.trend === "Down is good" && kpi.current <= kpi.target) ||
                 kpi.trend === "Neutral";
  const barColor = progress >= 100 ? "#2E8B1F" : progress >= 70 ? "#F57C00" : "#ef4444";

  const fmt = (v) => {
    const n = Number(v);
    if (kpi.format === "Currency (GHS)") return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    if (kpi.format === "Percentage (%)") return `${n}%`;
    return n.toLocaleString();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-erp transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-0.5">{kpi.module}</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{kpi.name}</div>
        </div>
        <div className="flex gap-1 ml-2">
          <button onClick={() => onEdit(kpi)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-600"><Edit size={13} /></button>
          <button onClick={() => onDelete(kpi.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
        </div>
      </div>
      <div className="flex items-end gap-3 mt-3">
        <div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{fmt(kpi.current)}</div>
          <div className="text-[10px] text-slate-400">Target: {fmt(kpi.target)}</div>
        </div>
        <div className="ml-auto text-right">
          <div className={`text-xs font-bold ${isGood ? "text-secondary" : "text-red-500"}`}>{progress}%</div>
          <div className="text-[10px] text-slate-400">of target</div>
        </div>
      </div>
      <div className="mt-3">
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, progress)}%`, backgroundColor: barColor }} />
        </div>
      </div>
      {kpi.description && <div className="mt-2 text-[10px] text-slate-400 line-clamp-1">{kpi.description}</div>}
    </div>
  );
}

export default function KPICenter() {
  const [kpis, setKpis] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [editKpi, setEditKpi] = useState(null);
  const [filterModule, setFilterModule] = useState("All");

  const save = (updated) => { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); setKpis(updated); };

  const handleSave = (kpi) => {
    const updated = editKpi
      ? kpis.map(k => k.id === kpi.id ? kpi : k)
      : [...kpis, kpi];
    save(updated);
    setShowForm(false); setEditKpi(null);
  };

  const handleDelete = (id) => { if (confirm("Delete this KPI?")) save(kpis.filter(k => k.id !== id)); };
  const handleEdit = (kpi) => { setEditKpi(kpi); setShowForm(true); };

  const filtered = filterModule === "All" ? kpis : kpis.filter(k => k.module === filterModule);
  const usedModules = [...new Set(kpis.map(k => k.module))];

  return (
    <div className="space-y-6">
      <PageHeader title="KPI Center" description="Define, track, and monitor custom KPIs with targets and thresholds">
        <button onClick={() => { setEditKpi(null); setShowForm(true); }} className="btn-secondary text-xs px-3 py-1.5 gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20">
          <Plus size={13} /> Add KPI
        </button>
      </PageHeader>

      {showForm && (
        <SectionCard title={editKpi ? "Edit KPI" : "New KPI"}>
          <KpiForm initial={editKpi} onSave={handleSave} onCancel={() => { setShowForm(false); setEditKpi(null); }} />
        </SectionCard>
      )}

      {/* Filter */}
      {kpis.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {["All", ...usedModules].map(m => (
            <button key={m} onClick={() => setFilterModule(m)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterModule === m ? "bg-brand-900 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-brand-400"}`}>
              {m} {m !== "All" && <span className="ml-1 opacity-60">({kpis.filter(k => k.module === m).length})</span>}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
            <Target size={28} className="text-brand-600 dark:text-brand-400" />
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">No KPIs defined yet</div>
            <div className="text-xs text-slate-400">Add your first KPI to start tracking business performance</div>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-4 gap-1.5">
            <Plus size={13} /> Add First KPI
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(kpi => (
            <KpiCard key={kpi.id} kpi={kpi} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
