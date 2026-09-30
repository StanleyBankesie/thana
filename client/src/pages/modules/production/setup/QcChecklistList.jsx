/**
 * @fileoverview QcChecklistList component.
 * Provides management of Quality Control Checklists & Inspection Standards in Production Setup.
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ShieldCheck, 
  CheckCircle2, 
  X, 
  PlusCircle, 
  Loader2,
  Award,
  Save
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function QcChecklistList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [formData, setFormData] = useState({
    checklist_name: "",
    category: "General Inspection",
    min_pass_score: 80,
    items: [
      { check_item_name: "Visual Surface Inspection", max_points: 30, pass_criteria: "No cracks, dents, or discoloration", is_mandatory: true },
      { check_item_name: "Dimensional Tolerance Test", max_points: 40, pass_criteria: "Dimensions within ±0.05mm", is_mandatory: true },
      { check_item_name: "Functional Operational Test", max_points: 30, pass_criteria: "Powers on and completes test cycle", is_mandatory: false }
    ],
    is_active: true
  });

  const fetchChecklists = async () => {
    try {
      setLoading(true);
      const res = await api.get("/production/setup/qc-checklists").catch(() => ({ data: { items: [] } }));
      setItems(res.data?.items || []);
    } catch {
      toast.error("Failed to load Quality Control Checklists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklists();
  }, []);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      let parsedItems = [];
      try {
        parsedItems = typeof item.items === 'string' ? JSON.parse(item.items) : (item.items || []);
      } catch {}
      setFormData({
        checklist_name: item.checklist_name || "",
        category: item.category || "General Inspection",
        min_pass_score: item.min_pass_score || 80,
        items: parsedItems.length > 0 ? parsedItems : [
          { check_item_name: "Visual Inspection", max_points: 50, pass_criteria: "Clean finish", is_mandatory: true }
        ],
        is_active: item.is_active !== 0 && item.is_active !== false
      });
    } else {
      setEditingItem(null);
      setFormData({
        checklist_name: "",
        category: "General Inspection",
        min_pass_score: 80,
        items: [
          { check_item_name: "Visual Surface Inspection", max_points: 30, pass_criteria: "No cracks or dents", is_mandatory: true },
          { check_item_name: "Dimensional Accuracy", max_points: 40, pass_criteria: "Meets technical drawing specs", is_mandatory: true },
          { check_item_name: "Weight & Packaging Check", max_points: 30, pass_criteria: "Weight within ±2% margin", is_mandatory: false }
        ],
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.checklist_name.trim()) return toast.error("Please enter a Checklist Name");

    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/production/setup/qc-checklists/${editingItem.id}`, formData);
        toast.success("Quality Control Checklist updated");
      } else {
        await api.post("/production/setup/qc-checklists", formData);
        toast.success("Quality Control Checklist created");
      }
      setIsModalOpen(false);
      fetchChecklists();
    } catch {
      toast.error("Failed to save QC Checklist");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Quality Control Checklist?")) return;
    try {
      await api.delete(`/production/setup/qc-checklists/${id}`);
      toast.success("QC Checklist deleted");
      fetchChecklists();
    } catch {
      toast.error("Failed to delete QC Checklist");
    }
  };

  const filteredItems = items.filter(
    (i) =>
      i.checklist_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "checklist_name", "asc");

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck size={20} className="text-brand-600" /> Quality Control (QC) Inspection Checklists
          </h2>
          <p className="text-xs text-slate-500">Configure weighted quality verification criteria and minimum passing scores for production output items</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="btn-primary text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={16} /> Create QC Checklist
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        <input 
          type="text" 
          placeholder="Search checklists by name or category..." 
          className="input pl-9 w-full text-xs font-medium" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>

      {/* Checklists Table */}
      <div className="card overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
              <tr>
                <SortableHeader label="Checklist Name" sortKey="checklist_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3" />
                <SortableHeader label="Category" sortKey="category" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3" />
                <SortableHeader label="Min Pass Score" sortKey="min_pass_score" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3 text-center" />
                <th className="px-4 py-3 text-center">QC Items</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center animate-pulse text-slate-400 font-bold">
                    Loading QC Checklists...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? (
                sortedItems.map((item) => {
                  let itemCount = 0;
                  try {
                    const parsed = typeof item.items === 'string' ? JSON.parse(item.items) : (item.items || []);
                    itemCount = parsed.length;
                  } catch {}

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{item.checklist_name}</td>
                      <td className="px-4 py-3 font-semibold text-brand-600">{item.category}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.min_pass_score}% Pass
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">
                        {itemCount} Check Criteria
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${item.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button 
                          onClick={() => handleOpenModal(item)} 
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded"
                          title="Edit QC Checklist"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)} 
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete QC Checklist"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    No Quality Control Checklists found. Click <strong>Create QC Checklist</strong> to set inspection criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Award size={18} className="text-brand-600" />
                {editingItem ? "Edit Quality Control Checklist" : "New Quality Control Checklist"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Checklist Name *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Standard Electronics Assembly Quality Checklist"
                    className="input w-full font-semibold"
                    value={formData.checklist_name}
                    onChange={e => setFormData({ ...formData, checklist_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Min Passing Score (%)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    required 
                    className="input w-full font-bold text-emerald-600"
                    value={formData.min_pass_score}
                    onChange={e => setFormData({ ...formData, min_pass_score: parseFloat(e.target.value) || 70 })}
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs uppercase text-slate-600 dark:text-slate-400">Quality Inspection Criteria & Weightages</h4>
                  <button 
                    type="button" 
                    onClick={() => setFormData({
                      ...formData,
                      items: [...formData.items, { check_item_name: "", max_points: 10, pass_criteria: "", is_mandatory: false }]
                    })}
                    className="btn btn-secondary text-xs flex items-center gap-1"
                  >
                    <PlusCircle size={14} /> Add Criterion
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Check Item / Test</th>
                        <th className="px-3 py-2 text-right">Max Points</th>
                        <th className="px-3 py-2">Pass Criteria Description</th>
                        <th className="px-3 py-2 text-center">Mandatory</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {formData.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            <input 
                              type="text" 
                              required 
                              placeholder="e.g. Visual Surface Finish"
                              className="input w-full py-1 text-xs"
                              value={item.check_item_name}
                              onChange={e => {
                                const updated = [...formData.items];
                                updated[idx].check_item_name = e.target.value;
                                setFormData({ ...formData, items: updated });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input 
                              type="number" 
                              min="1" 
                              max="100" 
                              required 
                              className="input w-20 py-1 text-xs text-right font-bold"
                              value={item.max_points}
                              onChange={e => {
                                const updated = [...formData.items];
                                updated[idx].max_points = parseInt(e.target.value) || 10;
                                setFormData({ ...formData, items: updated });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="text" 
                              placeholder="Expected result criteria..."
                              className="input w-full py-1 text-xs"
                              value={item.pass_criteria}
                              onChange={e => {
                                const updated = [...formData.items];
                                updated[idx].pass_criteria = e.target.value;
                                setFormData({ ...formData, items: updated });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input 
                              type="checkbox" 
                              checked={item.is_mandatory}
                              onChange={e => {
                                const updated = [...formData.items];
                                updated[idx].is_mandatory = e.target.checked;
                                setFormData({ ...formData, items: updated });
                              }}
                              className="checkbox"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button 
                              type="button" 
                              onClick={() => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) })}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary px-4">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary px-6 flex items-center gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save QC Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
