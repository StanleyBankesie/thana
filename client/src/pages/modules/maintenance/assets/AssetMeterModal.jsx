import React, { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  Loader2, 
  Calendar, 
  Activity,
  History,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";

export default function AssetMeterModal({ asset, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [formData, setFormData] = useState({
    reading_date: new Date().toISOString().split('T')[0],
    reading_value: "",
    uom: asset?.uom || "Hours"
  });

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/maintenance/assets/meters?asset_id=${asset.id}`);
      setHistory(res.data?.items || []);
    } catch (error) {
      toast.error("Failed to load meter history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (asset?.id) fetchHistory();
  }, [asset]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.reading_value) return toast.error("Please enter a reading value");
    
    setSaving(true);
    try {
      await api.post("/maintenance/assets/meters", {
        ...formData,
        asset_id: asset.id
      });
      toast.success("Meter reading recorded");
      setFormData({ ...formData, reading_value: "" });
      fetchHistory();
    } catch (error) {
      toast.error("Failed to save reading");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl text-indigo-600">
              <Activity size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Meter Readings</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{asset.asset_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Add Reading Form */}
          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 dark:shadow-none">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-80">Reading Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" size={16} />
                  <input 
                    type="date"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-white/40 outline-none font-bold text-sm"
                    value={formData.reading_date}
                    onChange={e => setFormData({...formData, reading_date: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-80">Current Value ({formData.uom})</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-white/40 outline-none font-bold text-sm text-center"
                  value={formData.reading_value}
                  onChange={e => setFormData({...formData, reading_value: e.target.value})}
                />
              </div>
              <button 
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-white text-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-900/20 disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Record Reading
              </button>
            </form>
          </div>

          {/* History Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wide">
                <History size={18} className="text-slate-400" />
                Reading History
              </h3>
              {history.length > 0 && (
                <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <TrendingUp size={10} />
                  Usage Tracking Active
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {loading ? (
                <div className="text-center py-10 text-slate-400 animate-pulse font-bold">Syncing records...</div>
              ) : history.length > 0 ? history.map((row, idx) => (
                <div key={row.id} className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm">
                      <span className="text-xs font-bold">{history.length - idx}</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {new Date(row.reading_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Verified Reading</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-slate-900 dark:text-white">{Number(row.reading_value).toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-indigo-500 uppercase">{row.uom || 'Units'}</div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                  <AlertCircle size={32} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-slate-400 text-sm font-medium">No readings recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
