import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Leaf, Recycle, Sun, Droplet, Plus, ArrowLeft,
  Building2, Calendar, CheckCircle, TrendingDown, Target, Zap,
  Eye, FileText, Edit
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function SustainabilityManagementPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "initiatives"
  const [properties, setProperties] = useState([]);

  const [metrics, setMetrics] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [viewingInitiative, setViewingInitiative] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Clean initial state (no prefilled values)
  const getInitialInitiativeForm = () => ({
    property_id: "",
    initiative_name: "",
    category: "",
    target_description: "",
    estimated_annual_co2_reduction_tons: "",
    estimated_annual_cost_savings: "",
    status: "",
    target_completion_date: "",
  });

  const [initiativeForm, setInitiativeForm] = useState(getInitialInitiativeForm());

  useEffect(() => {
    fetchProperties();
    fetchData();
  }, []);

  const fetchProperties = async () => {
    try {
      const res = await api.get("/facilities/properties");
      const list = res.data?.data || [];
      setProperties(list);
      if (list.length > 0) {
        setInitiativeForm((f) => ({ ...f, property_id: list[0].id }));
      }
    } catch {}
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/facilities/sustainability/metrics");
      setMetrics(res.data?.data?.metrics || []);
      setInitiatives(res.data?.data?.initiatives || []);
    } catch {
      toast.error("Failed to load sustainability metrics");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInitiative = async (e) => {
    e.preventDefault();
    if (!initiativeForm.initiative_name.trim()) {
      toast.warn("Initiative title is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/facilities/sustainability/initiatives", initiativeForm);
      toast.success("Environmental sustainability initiative registered!");
      setShowInitiativeModal(false);
      setInitiativeForm(getInitialInitiativeForm());
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create initiative");
    } finally {
      setSubmitting(false);
    }
  };

  const latestMetric = metrics[0] || {
    scope1_co2e_tons: 14.8,
    scope2_co2e_tons: 48.2,
    total_co2e_tons: 63.0,
    water_recycled_liters: 32000,
    waste_diverted_from_landfill_percent: 68.5,
    solar_generation_kwh: 18500,
    energy_use_intensity_kwh_per_sqm: 92.4,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs"
            title="Go Back"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Sustainability and Environmental Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Tracking waste, recycling, water consumption, energy efficiency, carbon emissions and environmental improvement initiatives.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setInitiativeForm(getInitialInitiativeForm());
            setShowInitiativeModal(true);
          }}
          className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
        >
          <Plus size={15} /> Add Green Initiative
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "overview"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Leaf size={14} />
          Carbon, Waste & Water Overview
        </button>

        <button
          onClick={() => setActiveTab("initiatives")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "initiatives"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Target size={14} />
          Environmental Initiatives ({initiatives.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & HISTORIC METRICS */}
      {activeTab === "overview" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Quarterly Environmental Performance Scorecard
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Reporting Period</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Scope 1 (Generator/Fleet)</th>
                  <th className="px-3 py-3">Scope 2 (Grid Power)</th>
                  <th className="px-3 py-3">Total CO₂e</th>
                  <th className="px-3 py-3">Landfill Diversion</th>
                  <th className="px-3 py-3">Water Recycled</th>
                  <th className="px-3 py-3">Solar PV Produced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {metrics.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{m.reporting_period}</td>
                    <td className="px-3 py-3">{m.property_name || "Enterprise Estate"}</td>
                    <td className="px-3 py-3 font-mono">{m.scope1_co2e_tons} t</td>
                    <td className="px-3 py-3 font-mono">{m.scope2_co2e_tons} t</td>
                    <td className="px-3 py-3 font-mono font-bold text-emerald-600">{m.total_co2e_tons} tCO₂e</td>
                    <td className="px-3 py-3 font-bold text-emerald-600">{m.waste_diverted_from_landfill_percent}%</td>
                    <td className="px-3 py-3 font-mono">{parseFloat(m.water_recycled_liters).toLocaleString()} L</td>
                    <td className="px-3 py-3 font-mono font-bold text-amber-500">
                      {parseFloat(m.solar_generation_kwh).toLocaleString()} kWh
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GREEN INITIATIVES */}
      {activeTab === "initiatives" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initiatives.map((ini) => (
            <div
              key={ini.id}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-emerald-500/50 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                    {ini.category?.replace(/_/g, " ")}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    ini.status === "IMPLEMENTED" ? "bg-emerald-100 text-emerald-800" :
                    ini.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                  }`}>
                    {ini.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{ini.initiative_name}</h3>
                <span className="text-[11px] text-slate-400 block mb-2">{ini.property_name || "Entire Portfolio"}</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{ini.target_description}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">Est. CO₂ Reduction</span>
                  <span className="font-bold text-emerald-600 font-mono">-{ini.estimated_annual_co2_reduction_tons} t/yr</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">Annual Savings</span>
                  <span className="font-bold text-slate-800 dark:text-white font-mono">
                    GHS {parseFloat(ini.estimated_annual_cost_savings).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setViewingInitiative(ini)}
                  className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1 w-full justify-center"
                >
                  <Eye size={12} /> View Full Initiative Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: ADD GREEN INITIATIVE */}
      {showInitiativeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Leaf size={18} className="text-emerald-500" />
                Register Environmental Improvement Initiative
              </h3>
              <button
                type="button"
                onClick={() => setShowInitiativeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateInitiative} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Property</label>
                  <select
                    value={initiativeForm.property_id}
                    onChange={(e) => setInitiativeForm({ ...initiativeForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Category</label>
                  <select
                    value={initiativeForm.category}
                    onChange={(e) => setInitiativeForm({ ...initiativeForm, category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    <option value="ENERGY_EFFICIENCY">Energy Efficiency & Retrofits</option>
                    <option value="SOLAR_RENEWABLE">Solar PV & Renewable Energy</option>
                    <option value="WATER_CONSERVATION">Water Conservation & Harvesting</option>
                    <option value="WASTE_REDUCTION">Waste Reduction & Zero Landfill</option>
                    <option value="CARBON_OFFSET">Carbon Offset & Green Landscaping</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Initiative Name</label>
                <input
                  type="text"
                  placeholder="e.g. Smart Sensor LED Retrofit & Chiller VFDs"
                  value={initiativeForm.initiative_name}
                  onChange={(e) => setInitiativeForm({ ...initiativeForm, initiative_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Target Description & Scope</label>
                <textarea
                  rows={2}
                  placeholder="Describe engineering scope, expected ROI, environmental benefits..."
                  value={initiativeForm.target_description}
                  onChange={(e) => setInitiativeForm({ ...initiativeForm, target_description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Est. CO₂ Reduction (Tons/Yr)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={initiativeForm.estimated_annual_co2_reduction_tons}
                    onChange={(e) => setInitiativeForm({ ...initiativeForm, estimated_annual_co2_reduction_tons: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Est. Annual Cost Savings (GHS)</label>
                  <input
                    type="number"
                    value={initiativeForm.estimated_annual_cost_savings}
                    onChange={(e) => setInitiativeForm({ ...initiativeForm, estimated_annual_cost_savings: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowInitiativeModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {submitting ? "Saving..." : "Register Initiative"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: VIEW INITIATIVE */}
      {viewingInitiative && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <span className="font-mono text-[10px] text-emerald-600 font-bold block">
                  {viewingInitiative.category?.replace(/_/g, " ")}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Leaf size={17} className="text-emerald-500" />
                  {viewingInitiative.initiative_name}
                </h3>
              </div>
              <button onClick={() => setViewingInitiative(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Target Property</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingInitiative.property_name || "Entire Portfolio"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    viewingInitiative.status === "IMPLEMENTED" ? "bg-emerald-100 text-emerald-800" :
                    viewingInitiative.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                  }`}>
                    {viewingInitiative.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">CO₂ Reduction Target</span>
                  <span className="font-mono font-bold text-emerald-600 text-xs">-{viewingInitiative.estimated_annual_co2_reduction_tons} Tons / Year</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Annual Cost Savings</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                    GHS {parseFloat(viewingInitiative.estimated_annual_cost_savings || 0).toLocaleString()}
                  </span>
                </div>
                {viewingInitiative.target_completion_date && (
                  <div>
                    <span className="text-slate-400 text-[11px] block">Target Completion Date</span>
                    <span className="font-mono text-slate-800 dark:text-white text-xs">{String(viewingInitiative.target_completion_date).slice(0, 10)}</span>
                  </div>
                )}
              </div>

              {viewingInitiative.target_description && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Scope & Objectives:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50 leading-relaxed">
                    {viewingInitiative.target_description}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingInitiative(null)}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
