/**
 * @fileoverview DowntimeLogForm component.
 * Provides functionality for DowntimeLogForm.
 */

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Calendar, 
  Clock, 
  AlertTriangle,
  Zap,
  Tag,
  ChevronDown,
  Info
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DowntimeLogForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState([]);
  
  const [formData, setFormData] = useState({
    asset_id: "",
    start_time: new Date().toISOString().slice(0, 16),
    end_time: "",
    reason: "",
    category: "UNPLANNED",
    impact_level: "MEDIUM"
  });

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await api.get("/maintenance/assets");
        setAssets(res.data?.items || []);
      } catch (error) {
        toast.error("Failed to load assets");
      } finally {
        setLoading(false);
      }
    };
    fetchAssets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.asset_id) return toast.error("Please select an asset");
    
    setSaving(true);
    try {
      await api.post("/maintenance/assets/downtime", formData);
      toast.success("Downtime incident logged");
      navigate("/maintenance/assets/downtime");
    } catch (error) {
      toast.error("Failed to log incident");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading Environment...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/maintenance/assets/downtime" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Log Downtime Incident</h1>
        </div>
        <button 
          form="downtime-form"
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl transition-all shadow-xl shadow-rose-200 dark:shadow-none font-bold disabled:opacity-50"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          Record Entry
        </button>
      </div>

      <div className="bg-rose-50 dark:bg-rose-900/20 p-5 rounded-3xl border border-rose-100 dark:border-rose-900/30 flex items-start gap-4">
        <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-xl text-rose-600">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 className="text-sm font-black text-rose-900 dark:text-rose-400 uppercase tracking-wide">Production Impact Notice</h3>
          <p className="text-xs text-rose-700 dark:text-rose-400/80 font-medium leading-relaxed mt-1">
            Logging an unplanned downtime will automatically trigger a reliability recalculation for the selected asset. 
            Ensure timestamps are accurate to maintain MTBF (Mean Time Between Failures) integrity.
          </p>
        </div>
      </div>

      <form id="downtime-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm">
        
        <div className="space-y-2 col-span-2 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Tag size={12} className="text-indigo-500" /> Target Asset
          </label>
          <div className="relative">
            <select 
              required
              className="w-full pl-4 pr-10 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none font-bold text-slate-900 dark:text-white"
              value={formData.asset_id}
              onChange={e => setFormData({...formData, asset_id: e.target.value})}
            >
              <option value="">Select Asset...</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>{a.asset_name} ({a.asset_no})</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
          </div>
        </div>

        <div className="space-y-2 col-span-2 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Info size={12} className="text-indigo-500" /> Incident Category
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['UNPLANNED', 'PLANNED'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setFormData({...formData, category: cat})}
                className={`py-3 rounded-2xl text-[10px] font-black transition-all ${
                  formData.category === cat 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-400 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Zap size={12} className="text-rose-500" /> Failure Start
          </label>
          <input 
            type="datetime-local" 
            required
            className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white"
            value={formData.start_time}
            onChange={e => setFormData({...formData, start_time: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Clock size={12} className="text-emerald-500" /> Resolution Time
          </label>
          <input 
            type="datetime-local" 
            className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white"
            value={formData.end_time}
            onChange={e => setFormData({...formData, end_time: e.target.value})}
          />
        </div>

        <div className="space-y-2 col-span-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
             Impact Level
          </label>
          <div className="grid grid-cols-4 gap-2">
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(level => (
              <button
                key={level}
                type="button"
                onClick={() => setFormData({...formData, impact_level: level})}
                className={`py-3 rounded-2xl text-[10px] font-black transition-all ${
                  formData.impact_level === level 
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl' 
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-400 hover:bg-slate-100'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 col-span-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Root Cause / Reason</label>
          <textarea 
            required
            className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-900 border-none rounded-[2rem] focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700 dark:text-slate-200 min-h-[120px]"
            value={formData.reason}
            onChange={e => setFormData({...formData, reason: e.target.value})}
            placeholder="Describe what happened (e.g., Motor burnout, Sensor failure)..."
          />
        </div>
      </form>
    </div>
  );
}
