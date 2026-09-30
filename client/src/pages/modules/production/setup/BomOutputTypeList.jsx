/**
 * @fileoverview BomOutputTypeList component.
 * Provides CRUD management for BOM Output Types set in Manufacturing Setup.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import { Plus, Trash2, Edit, Layers, ArrowLeft, Check, X } from "lucide-react";

export default function BomOutputTypeList() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentType, setCurrentType] = useState({ type_name: "", code: "", description: "", is_active: true });

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const res = await api.get("/production/setup/bom-output-types");
      setTypes(res.data?.items || []);
    } catch {
      toast.error("Failed to load BOM output types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentType.type_name.trim()) return toast.error("Type name is required");

    try {
      if (currentType.id) {
        await api.put(`/production/setup/bom-output-types/${currentType.id}`, currentType);
        toast.success("BOM Output Type updated successfully");
      } else {
        await api.post("/production/setup/bom-output-types", currentType);
        toast.success("BOM Output Type created successfully");
      }
      setShowModal(false);
      fetchTypes();
    } catch {
      toast.error("Failed to save BOM output type");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this BOM Output Type?")) return;
    try {
      await api.delete(`/production/setup/bom-output-types/${id}`);
      toast.success("BOM Output Type deleted successfully");
      fetchTypes();
    } catch {
      toast.error("Failed to delete BOM output type");
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
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">BOM Output Types</h1>
            <p className="text-slate-500 text-sm">Classify output classifications (Main Finished Good, Sub-Assembly, Co-Product, By-Product)</p>
          </div>
        </div>
        <button
          onClick={() => {
            setCurrentType({ type_name: "", code: "", description: "", is_active: true });
            setShowModal(true);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Add Output Type
        </button>
      </div>

      {/* Output Types Table */}
      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 uppercase tracking-wider text-xs border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">BOM Output Type</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">Loading BOM output types...</td>
                </tr>
              ) : types.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">
                    <Layers className="mx-auto mb-2 opacity-50" size={32} />
                    No BOM output types configured yet.
                  </td>
                </tr>
              ) : (
                types.map((tp) => (
                  <tr key={tp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-brand-900 dark:text-brand-300 flex items-center gap-2">
                      <Layers size={16} className="text-purple-500" />
                      {tp.type_name}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{tp.code || "—"}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{tp.description || "—"}</td>
                    <td className="px-6 py-4">
                      {tp.is_active ? (
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
                          setCurrentType(tp);
                          setShowModal(true);
                        }}
                        className="btn btn-secondary p-1.5 text-blue-600 hover:text-blue-700"
                        title="Edit Output Type"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(tp.id)}
                        className="btn btn-secondary p-1.5 text-rose-600 hover:text-rose-700"
                        title="Delete Output Type"
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {currentType.id ? "Edit Output Type" : "New BOM Output Type"}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  BOM Output Type Name *
                </label>
                <input
                  type="text"
                  required
                  value={currentType.type_name}
                  onChange={(e) => setCurrentType({ ...currentType, type_name: e.target.value })}
                  placeholder="e.g. Sub-Assembly Component"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Type Code
                </label>
                <input
                  type="text"
                  value={currentType.code || ""}
                  onChange={(e) => setCurrentType({ ...currentType, code: e.target.value })}
                  placeholder="e.g. BOT-SUBASSY"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows="3"
                  value={currentType.description || ""}
                  onChange={(e) => setCurrentType({ ...currentType, description: e.target.value })}
                  placeholder="Details regarding output type category"
                  className="input w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="typeActive"
                  checked={!!currentType.is_active}
                  onChange={(e) => setCurrentType({ ...currentType, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="typeActive" className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  Active Output Type
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Output Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
