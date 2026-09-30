/**
 * @fileoverview MachineList component.
 * Provides functionality for MachineList.
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2,
  Cpu,
  Activity,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MachineList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentMachine, setCurrentMachine] = useState({ machine_name: "", machine_code: "", is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchMachines = async () => {
    try {
      const res = await api.get("/production/setup/machines");
      setItems(res.data?.items || []);
    } catch (error) {
      toast.error("Failed to load machines");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (currentMachine.id) {
        await api.put(`/production/setup/machines/${currentMachine.id}`, currentMachine);
        toast.success("Machine updated");
      } else {
        await api.post("/production/setup/machines", currentMachine);
        toast.success("Machine created");
      }
      setShowModal(false);
      fetchMachines();
    } catch (error) {
      toast.error("Failed to save machine");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await api.delete(`/production/setup/machines/${id}`);
      toast.success("Machine deleted");
      fetchMachines();
    } catch (error) {
      toast.error("Failed to delete machine");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/production?section=Manufacturing%20Masters%20%26%20Setup" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Machines & Equipment</h1>
            <p className="text-slate-500 text-sm">Register and track factory assets</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setCurrentMachine({ machine_name: "", machine_code: "", is_active: true });
            setShowModal(true);
          }}
          className="btn-success flex items-center gap-2"
        >
          <Plus size={20} />
          Register Machine
        </button>
      </div>

      <div className="card overflow-hidden shadow-sm">
        
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
          <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <th>Machine Details</th>
                <th>Serial Number</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Loading equipment...</td>
                </tr>
              ) : items.length > 0 ? items.map((item) => (
                <tr key={item.id} className="group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-brand-600">
                        <Cpu size={18} />
                      </div>
                      <span className="font-bold text-brand-700 dark:text-brand-300">{item.machine_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400 font-bold">
                    {item.machine_code || <span className="italic opacity-50 font-medium">N/A</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`badge ${item.is_active ? 'badge-success' : 'badge-secondary'}`}>
                      {item.is_active ? 'Operational' : 'Maintenance'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => {
                          setCurrentMachine(item);
                          setShowModal(true);
                        }}
                        className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Cpu size={48} className="opacity-20" />
                      <p className="font-medium">No machines registered</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center text-slate-900 dark:text-white">
              <h2 className="text-xl font-bold">
                {currentMachine.id ? 'Edit Machine' : 'New Registration'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Machine Name</label>
                <input 
                  type="text" 
                  required
                  className="input py-3 w-full"
                  value={currentMachine.machine_name}
                  onChange={e => setCurrentMachine({...currentMachine, machine_name: e.target.value})}
                  placeholder="e.g. CNC Lathe, Hydraulic Press..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Serial Number</label>
                <input 
                  type="text" 
                  className="input py-3 w-full font-bold font-mono"
                  value={currentMachine.machine_code}
                  onChange={e => setCurrentMachine({...currentMachine, machine_code: e.target.value})}
                  placeholder="e.g. SN-994021"
                />
              </div>
              <div className="flex items-center gap-3 py-1">
                <input 
                  type="checkbox" 
                  id="mac_active"
                  className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={currentMachine.is_active}
                  onChange={e => setCurrentMachine({...currentMachine, is_active: e.target.checked})}
                />
                <label htmlFor="mac_active" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">Available for scheduling</label>
              </div>
              <div className="pt-2 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary flex-1 py-3"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="btn-success flex-1 py-3 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={18} className="animate-spin" />}
                  {currentMachine.id ? 'Update' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
