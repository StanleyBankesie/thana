/**
 * @fileoverview OverheadList component.
 * Management UI for Operational Overhead Rates set in Manufacturing Setup.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import { Plus, Trash2, Edit, DollarSign, ArrowLeft, Check, X } from "lucide-react";

export default function OverheadList() {
  const [overheads, setOverheads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentOverhead, setCurrentOverhead] = useState({
    overhead_name: "",
    code: "",
    allocation_basis: "per Hour",
    default_cost_rate: "",
    description: "",
    is_active: true
  });

  const fetchOverheads = async () => {
    try {
      setLoading(true);
      const res = await api.get("/production/setup/overheads");
      setOverheads(res.data?.items || []);
    } catch {
      toast.error("Failed to load operational overheads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverheads();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentOverhead.overhead_name.trim()) return toast.error("Overhead name is required");

    try {
      if (currentOverhead.id) {
        await api.put(`/production/setup/overheads/${currentOverhead.id}`, currentOverhead);
        toast.success("Operational overhead updated successfully");
      } else {
        await api.post("/production/setup/overheads", currentOverhead);
        toast.success("Operational overhead created successfully");
      }
      setShowModal(false);
      fetchOverheads();
    } catch {
      toast.error("Failed to save operational overhead");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this operational overhead?")) return;
    try {
      await api.delete(`/production/setup/overheads/${id}`);
      toast.success("Operational overhead deleted successfully");
      fetchOverheads();
    } catch {
      toast.error("Failed to delete operational overhead");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/production/setup" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Operational Overheads</h1>
            <p className="text-slate-500 text-sm">Configure standard overhead rates, categories, and allocation bases (per Hour, per Unit, per Batch, per Shift)</p>
          </div>
        </div>
        <button
          onClick={() => {
            const nextSeq = overheads.length + 1;
            const autoCode = `OVH-${String(nextSeq).padStart(6, '0')}`;
            setCurrentOverhead({ overhead_name: "", code: autoCode, allocation_basis: "per Hour", default_cost_rate: "", description: "", is_active: true });
            setShowModal(true);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Add Overhead Category
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 uppercase tracking-wider text-xs border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Overhead Category / Description</th>
                <th className="px-6 py-4">Allocation Basis</th>
                <th className="px-6 py-4">Default Cost Rate</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">Loading operational overheads...</td>
                </tr>
              ) : overheads.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">
                    <DollarSign className="mx-auto mb-2 opacity-50" size={32} />
                    No operational overhead categories configured yet.
                  </td>
                </tr>
              ) : (
                overheads.map((ov) => (
                  <tr key={ov.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-brand-900 dark:text-brand-300 flex items-center gap-2">
                      <DollarSign size={16} className="text-indigo-500" />
                      {ov.overhead_name}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{ov.allocation_basis || "per Hour"}</td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-600">
                      {parseFloat(ov.default_cost_rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      {ov.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                          <Check size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          <X size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setCurrentOverhead(ov);
                          setShowModal(true);
                        }}
                        className="btn btn-secondary p-1.5 text-blue-600 hover:text-blue-700"
                        title="Edit Overhead"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(ov.id)}
                        className="btn btn-secondary p-1.5 text-rose-600 hover:text-rose-700"
                        title="Delete Overhead"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-150">
            <div className="p-6 bg-brand-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <DollarSign size={20} />
                {currentOverhead.id ? "Edit Operational Overhead" : "New Operational Overhead"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white text-xl">&times;</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Overhead Category / Description *
                </label>
                <input
                  type="text"
                  required
                  value={currentOverhead.overhead_name}
                  onChange={(e) => setCurrentOverhead({ ...currentOverhead, overhead_name: e.target.value })}
                  placeholder="e.g. Direct Machine Labor, Electricity, Tool Wear"
                  className="input w-full font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Allocation Basis *
                </label>
                <select
                  value={currentOverhead.allocation_basis || "per Hour"}
                  onChange={(e) => setCurrentOverhead({ ...currentOverhead, allocation_basis: e.target.value })}
                  className="input w-full font-semibold text-xs"
                >
                  <option value="per Hour">per Hour</option>
                  <option value="per Unit">per Unit Produced</option>
                  <option value="per Batch">Fixed per Batch</option>
                  <option value="per Shift">per Shift</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Default Cost Rate
                </label>
                <input
                  type="number"
                  step="any"
                  value={currentOverhead.default_cost_rate === 0 || currentOverhead.default_cost_rate === "0" ? "" : (currentOverhead.default_cost_rate ?? "")}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                    setCurrentOverhead({ ...currentOverhead, default_cost_rate: isNaN(val) ? "" : val });
                  }}
                  placeholder="e.g. 15.00"
                  className="input w-full font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Notes & Details
                </label>
                <textarea
                  rows="2"
                  value={currentOverhead.description || ""}
                  onChange={(e) => setCurrentOverhead({ ...currentOverhead, description: e.target.value })}
                  placeholder="Standard costing notes or machine overhead rate calculations..."
                  className="input w-full text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="ovhActive"
                  checked={!!currentOverhead.is_active}
                  onChange={(e) => setCurrentOverhead({ ...currentOverhead, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600"
                />
                <label htmlFor="ovhActive" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Active for Manufacturing Processes
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Save Overhead Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
