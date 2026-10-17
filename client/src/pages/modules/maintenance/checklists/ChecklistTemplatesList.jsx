import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ClipboardList, Plus, Search, CheckSquare, 
  Settings, ChevronRight, X, AlertCircle, ArrowLeft
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function ChecklistTemplatesList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
    template_name: "",
    service_line: "HVAC_AIR_CONDITIONING",
    description: "",
    items: [
      { item_text: "Visual inspection for leaks, vibrations, or noise", field_type: "PASS_FAIL", is_critical: false },
      { item_text: "Measure operational voltage / pressure rating", field_type: "NUMERIC_READING", min_reading: 220, max_reading: 240, unit_of_measure: "V", is_critical: true }
    ]
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get("/facilities/checklists/templates");
      setTemplates(res.data?.data || []);
    } catch {
      toast.error("Failed to load checklist templates");
    } finally {
      setLoading(false);
    }
  };

  const handleViewTemplate = async (tpl) => {
    try {
      const res = await api.get(`/facilities/checklists/templates/${tpl.id}`);
      setSelectedTemplate(res.data?.data);
    } catch {
      toast.error("Failed to fetch template details");
    }
  };

  const handleAddItemRow = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { item_text: "", field_type: "PASS_FAIL", is_critical: false }
      ]
    });
  };

  const handleRemoveItemRow = (index) => {
    const updated = [...formData.items];
    updated.splice(index, 1);
    setFormData({ ...formData, items: updated });
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!formData.template_name.trim() || formData.items.length === 0) {
      toast.warn("Template name and at least one item are required");
      return;
    }

    try {
      setSaving(true);
      await api.post("/facilities/checklists/templates", formData);
      toast.success("Inspection Checklist Template created successfully");
      setShowCreateModal(false);
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  const serviceLines = [
    { value: "HVAC_AIR_CONDITIONING", label: "HVAC & Air Conditioning" },
    { value: "GENERATOR_POWER", label: "Diesel Generators & Power" },
    { value: "ELECTRICAL_SERVICES", label: "Electrical Distribution & Panels" },
    { value: "PLUMBING_WATER_SYSTEMS", label: "Plumbing, Pumps & Water" },
    { value: "FIRE_SAFETY_SYSTEMS", label: "Fire Alarms & Safety Systems" },
    { value: "LIFT_ELEVATOR_MAINTENANCE", label: "Elevators & Escalators" },
    { value: "CLEANING_JANITORIAL", label: "Janitorial & Hygiene Audits" },
    { value: "SECURITY_PATROL", label: "Security Patrol Rounds" },
    { value: "PEST_CONTROL", label: "Pest Control & Bait Stations" },
    { value: "GENERAL_BUILDING_FABRIC", label: "Building Fabric & Civil" }
  ];

  const totalTemplates = templates.length;
  const totalCheckpoints = templates.reduce((acc, t) => acc + (parseInt(t.item_count) || 0), 0);
  const totalServiceLines = new Set(templates.map((t) => t.service_line)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/maintenance?section=Inspections %26 Soft Services"
            className="btn btn-secondary inline-flex items-center gap-1.5"
            title="Back to Inspections & Soft Services"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Inspection Checklists & Audit Templates
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Standard operating procedure checklists for PMs, condition surveys, and supervisor hygiene audits.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} /> Create Template
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Checklist Templates</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalTemplates}</span>
            <span className="badge badge-sm badge-info">SOPs</span>
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Checkpoints</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalCheckpoints}</span>
            <span className="badge badge-sm badge-success">Auditable</span>
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Covered Disciplines</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalServiceLines}</span>
            <span className="badge badge-sm badge-ghost">Trades</span>
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Field Readiness</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">100%</span>
            <span className="badge badge-sm badge-primary">Standardized</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 p-12 flex justify-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:border-emerald-500/50 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {tpl.template_code}
                  </span>
                  <span className="text-xs font-medium text-emerald-600 font-mono">
                    {tpl.item_count} Checkpoints
                  </span>
                </div>

                <h3 className="font-semibold text-slate-900 dark:text-white text-base mb-1">
                  {tpl.template_name}
                </h3>
                <span className="text-xs text-slate-400 block mb-2 font-mono">
                  {tpl.service_line?.replace(/_/g, " ")}
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {tpl.description || "Pre-defined checklist form for field service technicians."}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => handleViewTemplate(tpl)}
                  className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                >
                  View Checkpoints <ChevronRight size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Template View Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <ClipboardList size={18} className="text-emerald-600" />
                  {selectedTemplate.template_name}
                </h3>
                <span className="text-xs font-mono text-slate-400">{selectedTemplate.template_code} • {selectedTemplate.service_line}</span>
              </div>
              <button onClick={() => setSelectedTemplate(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2">
              {(selectedTemplate.items || []).map((item, idx) => (
                <div key={item.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-xs flex justify-between items-center gap-2">
                  <div>
                    {item.section_header && (
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{item.section_header}</span>
                    )}
                    <span className="font-medium text-slate-800 dark:text-slate-200">{idx + 1}. {item.item_text}</span>
                    {item.min_reading && item.max_reading && (
                      <span className="text-[11px] text-slate-500 font-mono ml-2">
                        (Expected: {item.min_reading} to {item.max_reading} {item.unit_of_measure})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[11px]">
                      {item.field_type}
                    </span>
                    {item.is_critical === 1 && (
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[10px]">
                        CRITICAL
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-850">
              <button onClick={() => setSelectedTemplate(null)} className="btn-secondary text-xs px-4 py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
              <h3 className="font-semibold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Plus size={18} className="text-emerald-600" />
                Configure New Inspection Template
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1">Template Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Elevators Monthly Safety Inspection"
                    value={formData.template_name}
                    onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label mb-1">Service Line</label>
                  <select
                    className="input w-full"
                    value={formData.service_line}
                    onChange={(e) => setFormData({ ...formData, service_line: e.target.value })}
                  >
                    {serviceLines.map((sl) => (
                      <option key={sl.value} value={sl.value}>{sl.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="label mb-1">Description / Purpose</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Scope of work and instructions..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Dynamic Checkpoints */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Checklist Inspection Items ({formData.items.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="btn-outline text-xs px-2.5 py-1 inline-flex items-center gap-1 text-emerald-600"
                  >
                    <Plus size={13} /> Add Checkpoint
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="input flex-1 text-xs"
                          placeholder="Inspection task or question..."
                          value={item.item_text}
                          onChange={(e) => {
                            const updated = [...formData.items];
                            updated[idx].item_text = e.target.value;
                            setFormData({ ...formData, items: updated });
                          }}
                          required
                        />
                        <select
                          className="input text-xs py-1.5 w-36"
                          value={item.field_type}
                          onChange={(e) => {
                            const updated = [...formData.items];
                            updated[idx].field_type = e.target.value;
                            setFormData({ ...formData, items: updated });
                          }}
                        >
                          <option value="PASS_FAIL">Pass / Fail</option>
                          <option value="NUMERIC_READING">Numeric Reading</option>
                          <option value="YES_NO_NA">Yes / No / NA</option>
                          <option value="RATING_1_5">1-5 Rating</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={item.is_critical || false}
                            onChange={(e) => {
                              const updated = [...formData.items];
                              updated[idx].is_critical = e.target.checked;
                              setFormData({ ...formData, items: updated });
                            }}
                            className="rounded text-red-600"
                          />
                          Critical Checkpoint (Failing auto-triggers corrective work order)
                        </label>

                        {item.field_type === "NUMERIC_READING" && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="input text-xs py-0.5 px-1.5 w-16"
                              placeholder="Min"
                              value={item.min_reading || ""}
                              onChange={(e) => {
                                const updated = [...formData.items];
                                updated[idx].min_reading = e.target.value;
                                setFormData({ ...formData, items: updated });
                              }}
                            />
                            <span>to</span>
                            <input
                              type="number"
                              className="input text-xs py-0.5 px-1.5 w-16"
                              placeholder="Max"
                              value={item.max_reading || ""}
                              onChange={(e) => {
                                const updated = [...formData.items];
                                updated[idx].max_reading = e.target.value;
                                setFormData({ ...formData, items: updated });
                              }}
                            />
                            <input
                              type="text"
                              className="input text-xs py-0.5 px-1.5 w-16"
                              placeholder="Unit (V, bar)"
                              value={item.unit_of_measure || ""}
                              onChange={(e) => {
                                const updated = [...formData.items];
                                updated[idx].unit_of_measure = e.target.value;
                                setFormData({ ...formData, items: updated });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary text-sm px-4 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary text-sm px-5 py-2 font-medium">
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
