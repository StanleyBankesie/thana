/**
 * @fileoverview RoutingForm component.
 * Provides functionality for RoutingForm.
 */

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  GripVertical,
  Clock,
  Settings2,
  ChevronDown,
  Loader2,
  Activity
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function RoutingForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  
  const [items, setItems] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [machines, setMachines] = useState([]);
  const [shifts, setShifts] = useState([]);
  
  const [formData, setFormData] = useState({
    item_id: "",
    routing_name: "",
    is_default: false,
    steps: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, procRes, macRes, shiftRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/production/setup/processes"),
          api.get("/production/setup/machines"),
          api.get("/production/setup/shifts")
        ]);
        setItems(itemsRes.data?.items || []);
        setProcesses(procRes.data?.items || []);
        setMachines(macRes.data?.items || []);
        setShifts(shiftRes.data?.items || []);

        if (id) {
          const res = await api.get(`/production/routings/${id}`);
          setFormData(res.data);
          setLoading(false);
        }
      } catch (error) {
        toast.error("Failed to load dependency data");
      }
    };
    fetchData();
  }, [id]);

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [...formData.steps, { process_id: "", machine_id: "", shift_id: "", setup_time_mins: 0, cycle_time_mins: 0 }]
    });
  };

  const removeStep = (index) => {
    const newSteps = [...formData.steps];
    newSteps.splice(index, 1);
    setFormData({ ...formData, steps: newSteps });
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[index][field] = value;
    setFormData({ ...formData, steps: newSteps });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.steps.length === 0) return toast.error("Add at least one process step");
    if (formData.steps.some(s => !s.process_id)) return toast.error("All steps must have a process selected");

    setSaving(true);
    try {
      if (id) {
        await api.put(`/production/routings/${id}`, formData);
        toast.success("Routing updated");
      } else {
        await api.post("/production/routings", formData);
        toast.success("Routing created");
      }
      navigate("/production/routings");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save routing");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading Routing Details...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/production/routings" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">
              {id ? 'Edit Routing Setup' : 'New Routing Setup'}
            </h1>
            <p className="text-xs text-slate-500 font-medium">Configure operation sequence and cycle times for manufactured items</p>
          </div>
        </div>

        <button 
          form="routing-form"
          type="submit"
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {id ? 'Update Routing' : 'Save Routing'}
        </button>
      </div>

      <form id="routing-form" onSubmit={handleSubmit} className="space-y-8">
        
        {/* Main Routing Details Card */}
        <div className="card p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Target Product / Item *
              </label>
              <select 
                required
                disabled={!!id}
                className="input w-full font-bold disabled:opacity-60"
                value={formData.item_id}
                onChange={e => setFormData({...formData, item_id: e.target.value})}
              >
                <option value="">Select Target Item...</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>{item.item_name} ({item.item_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Routing Name / Version *
              </label>
              <input 
                type="text" 
                required
                className="input w-full font-bold"
                value={formData.routing_name}
                onChange={e => setFormData({...formData, routing_name: e.target.value})}
                placeholder="e.g. Fanta Routes / Standard Assembly V1"
              />
              <p className="text-[10px] text-slate-400 font-medium mt-1">Use names that differentiate between product variations</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700 dark:text-slate-300">
              <input 
                type="checkbox" 
                className="checkbox"
                checked={formData.is_default}
                onChange={e => setFormData({...formData, is_default: e.target.checked})}
              />
              Set as Default Production Routing for this item
            </label>
          </div>
        </div>

        {/* Process Sequence Card */}
        <div className="card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings2 size={18} className="text-brand-600" /> Process Sequence
            </h2>
            <button 
              type="button" 
              onClick={addStep}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              <Plus size={16} /> Add Step
            </button>
          </div>

          <div className="space-y-4">
            {formData.steps.map((step, index) => (
              <div 
                key={index} 
                className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="w-7 h-7 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 max-w-xs">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Process Operation *</label>
                      <select 
                        required
                        className="input w-full font-bold text-xs"
                        value={step.process_id}
                        onChange={e => updateStep(index, 'process_id', e.target.value)}
                      >
                        <option value="">Select Process...</option>
                        {processes.map(p => (
                          <option key={p.id} value={p.id}>{p.process_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Clock size={10} /> Setup Time (Mins)
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        className="input w-full font-bold text-xs"
                        value={step.setup_time_mins}
                        onChange={e => updateStep(index, 'setup_time_mins', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Activity size={10} /> Cycle Time (Mins)
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        className="input w-full font-bold text-xs"
                        value={step.cycle_time_mins}
                        onChange={e => updateStep(index, 'cycle_time_mins', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Work Center / Machine</label>
                      <select 
                        className="input w-full font-bold text-xs"
                        value={step.machine_id || ""}
                        onChange={e => updateStep(index, 'machine_id', e.target.value)}
                      >
                        <option value="">Default Machine</option>
                        {machines.map(m => (
                          <option key={m.id} value={m.id}>{m.machine_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Work Shift</label>
                      <select 
                        className="input w-full font-bold text-xs"
                        value={step.shift_id || ""}
                        onChange={e => updateStep(index, 'shift_id', e.target.value)}
                      >
                        <option value="">Default Shift</option>
                        {shifts.map(s => (
                          <option key={s.id} value={s.id}>{s.shift_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button 
                    type="button" 
                    onClick={() => removeStep(index)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors self-end md:self-center"
                    title="Remove Step"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {formData.steps.length === 0 && (
              <div className="p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 text-xs">
                <p className="font-medium">No process steps added yet. Click "+ Add Step" to build sequence.</p>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
