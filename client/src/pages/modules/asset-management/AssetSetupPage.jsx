import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Settings, Tag, Building2, Cpu, Plus, 
  Trash2, Edit3, Save, CheckCircle2, RefreshCw, ArrowLeft, ExternalLink 
} from "lucide-react";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";

export default function AssetSetupPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("nomenclature");

  // Nomenclature state
  const [nomenclature, setNomenclature] = useState({
    prefix: "AST",
    include_category: true,
    include_site: false,
    include_year: true,
    seq_digits: 4,
    separator_char: "-",
    current_sequence: 1,
  });
  const [nomenclatureSaving, setNomenclatureSaving] = useState(false);

  // Manufacturers state
  const [manufacturers, setManufacturers] = useState([]);
  const [mfgLoading, setMfgLoading] = useState(false);
  const [showMfgModal, setShowMfgModal] = useState(false);
  const [editingMfg, setEditingMfg] = useState(null);
  const [mfgForm, setMfgForm] = useState({ name: "", code: "", country: "" });

  // Properties / Sites state
  const [properties, setProperties] = useState([]);
  const [propLoading, setPropLoading] = useState(false);
  const [showPropModal, setShowPropModal] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [propForm, setPropForm] = useState({ property_code: "", property_name: "", property_type: "SITE", address: "", city: "" });

  useEffect(() => {
    fetchNomenclature();
    fetchManufacturers();
    fetchProperties();
  }, []);

  const fetchNomenclature = async () => {
    try {
      const res = await api.get("/assets/setup/nomenclature");
      const d = res.data?.data;
      if (d) {
        setNomenclature({
          prefix: d.prefix || "AST",
          include_category: Boolean(d.include_category),
          include_site: Boolean(d.include_site),
          include_year: Boolean(d.include_year),
          seq_digits: d.seq_digits || 4,
          separator_char: d.separator_char || "-",
          current_sequence: d.current_sequence || 1,
        });
      }
    } catch {
      // Ignored
    }
  };

  const fetchManufacturers = async () => {
    try {
      setMfgLoading(true);
      const res = await api.get("/assets/manufacturers");
      setManufacturers(res.data?.data || []);
    } catch {
      // Ignored
    } finally {
      setMfgLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      setPropLoading(true);
      const res = await api.get("/assets/properties");
      setProperties(res.data?.data || []);
    } catch {
      // Ignored
    } finally {
      setPropLoading(false);
    }
  };

  // Compute live sample tag
  const getSampleTag = () => {
    const parts = [nomenclature.prefix || "AST"];
    if (nomenclature.include_category) parts.push("CAT");
    if (nomenclature.include_site) parts.push("SITE");
    if (nomenclature.include_year) parts.push(new Date().getFullYear());
    parts.push(String(nomenclature.current_sequence || 1).padStart(nomenclature.seq_digits || 4, "0"));
    return parts.join(nomenclature.separator_char || "-");
  };

  const handleSaveNomenclature = async (e) => {
    e.preventDefault();
    try {
      setNomenclatureSaving(true);
      await api.post("/assets/setup/nomenclature", nomenclature);
      toast.success("Asset tagging nomenclature saved successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save nomenclature");
    } finally {
      setNomenclatureSaving(false);
    }
  };

  const handleSaveMfg = async (e) => {
    e.preventDefault();
    if (!mfgForm.name.trim()) {
      toast.error("Please enter manufacturer name");
      return;
    }
    try {
      const autoCode = mfgForm.code || `${mfgForm.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "MFG"}-${Date.now().toString().slice(-3)}`;
      const payload = {
        name: mfgForm.name.trim(),
        code: autoCode,
        country: mfgForm.country || null,
      };
      if (editingMfg) {
        await api.put(`/assets/manufacturers/${editingMfg.id}`, payload);
        toast.success("Manufacturer updated successfully");
      } else {
        await api.post("/assets/manufacturers", payload);
        toast.success("Manufacturer created successfully");
      }
      setShowMfgModal(false);
      fetchManufacturers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save manufacturer");
    }
  };

  const handleDeleteMfg = async (id) => {
    if (!window.confirm("Are you sure you want to remove this manufacturer?")) return;
    try {
      await api.delete(`/assets/manufacturers/${id}`);
      toast.success("Manufacturer removed");
      fetchManufacturers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete manufacturer");
    }
  };

  const handleSaveProp = async (e) => {
    e.preventDefault();
    if (!propForm.property_name.trim()) {
      toast.error("Please enter site / property name");
      return;
    }
    try {
      const autoCode = propForm.property_code || `SITE-${propForm.property_name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "LOC"}-${Date.now().toString().slice(-4)}`;
      const payload = {
        ...propForm,
        property_name: propForm.property_name.trim(),
        property_code: autoCode,
      };
      if (editingProp) {
        await api.put(`/assets/properties/${editingProp.id}`, payload);
        toast.success("Property / Site updated successfully");
      } else {
        await api.post("/assets/properties", payload);
        toast.success("Property / Site created successfully");
      }
      setShowPropModal(false);
      fetchProperties();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save property / site");
    }
  };

  const handleDeleteProp = async (id) => {
    if (!window.confirm("Are you sure you want to remove this property / site?")) return;
    try {
      await api.delete(`/assets/properties/${id}`);
      toast.success("Property removed");
      fetchProperties();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete property");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm"
            title="Go Back"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Settings className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              Fixed Asset Configurations & Master Setup
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Configure asset tagging nomenclature rules, facilities & sites, and manufacturer brands.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab("nomenclature")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-all border-b-2 ${
            activeTab === "nomenclature"
              ? "border-brand-600 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Tag size={16} /> Asset Tagging & Nomenclature Format
        </button>

        <button
          onClick={() => setActiveTab("properties")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-all border-b-2 ${
            activeTab === "properties"
              ? "border-brand-600 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Building2 size={16} /> Facility Sites & Properties ({properties.length})
        </button>

        <button
          onClick={() => setActiveTab("manufacturers")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-all border-b-2 ${
            activeTab === "manufacturers"
              ? "border-brand-600 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Cpu size={16} /> Manufacturers & Brands ({manufacturers.length})
        </button>


      </div>

      {/* Tab 1: Nomenclature */}
      {activeTab === "nomenclature" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Asset Tagging / Nomenclature Rules
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Define the automated naming rule for Asset Code / Tag numbers populated when capitalizing assets.
              </p>
            </div>

            <form onSubmit={handleSaveNomenclature} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prefix
                  </label>
                  <input
                    type="text"
                    required
                    value={nomenclature.prefix}
                    onChange={(e) => setNomenclature({ ...nomenclature, prefix: e.target.value.toUpperCase() })}
                    placeholder="e.g. AST, FA, EQP"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Separator Character
                  </label>
                  <select
                    value={nomenclature.separator_char}
                    onChange={(e) => setNomenclature({ ...nomenclature, separator_char: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="-">Hyphen (-)</option>
                    <option value="/">Slash (/)</option>
                    <option value=".">Dot (.)</option>
                    <option value="_">Underscore (_)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sequence Zero-Padding (Digits)
                  </label>
                  <select
                    value={nomenclature.seq_digits}
                    onChange={(e) => setNomenclature({ ...nomenclature, seq_digits: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value={3}>3 digits (e.g. 001)</option>
                    <option value={4}>4 digits (e.g. 0001)</option>
                    <option value={5}>5 digits (e.g. 00001)</option>
                    <option value={6}>6 digits (e.g. 000001)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Sequence Start / Counter
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={nomenclature.current_sequence}
                    onChange={(e) => setNomenclature({ ...nomenclature, current_sequence: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Checkbox Options */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={nomenclature.include_category}
                    onChange={(e) => setNomenclature({ ...nomenclature, include_category: e.target.checked })}
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  Include Asset Category Code / Short Slug (e.g. IT, VEH, BLD)
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={nomenclature.include_site}
                    onChange={(e) => setNomenclature({ ...nomenclature, include_site: e.target.checked })}
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  Include Facility / Site Code (e.g. HQ, PLANT)
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={nomenclature.include_year}
                    onChange={(e) => setNomenclature({ ...nomenclature, include_year: e.target.checked })}
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  Include Fiscal Capitalization Year (e.g. 2026)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={nomenclatureSaving}
                  className="btn btn-primary inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all disabled:opacity-50"
                >
                  <Save size={15} />
                  {nomenclatureSaving ? "Saving Rule..." : "Save Tagging Nomenclature"}
                </button>
              </div>
            </form>
          </div>

          {/* Preview Card */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-brand-50 to-blue-50 dark:from-brand-950/40 dark:to-slate-900 border border-brand-200 dark:border-brand-900/60 rounded-2xl p-6 shadow-sm space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
                <Tag size={15} /> Live Nomenclature Preview
              </span>

              <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-brand-200 dark:border-brand-800 text-center shadow-xs">
                <div className="text-xs text-slate-400 mb-1">Generated Asset Tag Format:</div>
                <div className="text-xl font-mono font-bold text-brand-700 dark:text-brand-300 tracking-wide">
                  {getSampleTag()}
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                When you click <strong>Generate Tag</strong> in the Fixed Asset Register or leave the tag field blank, the system automatically builds the asset tag according to this formula.
              </p>

              <div className="pt-3 border-t border-brand-200/60 dark:border-brand-900/40">
                <Link
                  to="/assets/new"
                  className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline flex items-center gap-1"
                >
                  Test in Capitalize Asset form <ExternalLink size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Properties / Facility Sites */}
      {activeTab === "properties" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Facility Sites & Properties Master List
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical premises, manufacturing plants, and branch locations selectable in Fixed Asset Register.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingProp(null);
                setPropForm({ property_code: "", property_name: "", property_type: "SITE", address: "", city: "" });
                setShowPropModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
            >
              <Plus size={14} /> Add Property / Site
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Site / Property Name</th>
                  <th>Type</th>
                  <th>City / Address</th>
                  <th className="text-center">Assets Assigned</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="font-medium text-slate-900 dark:text-slate-100">
                      {p.property_name}
                    </td>
                    <td>
                      <span className="badge">
                        {p.property_type}
                      </span>
                    </td>
                    <td className="text-slate-500">
                      {p.city ? `${p.city} ${p.address ? `(${p.address})` : ""}` : p.address || "—"}
                    </td>
                    <td className="text-center font-semibold text-brand-600 dark:text-brand-400">
                      {p.asset_count || 0}
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingProp(p);
                          setPropForm({
                            property_code: p.property_code,
                            property_name: p.property_name,
                            property_type: p.property_type,
                            address: p.address || "",
                            city: p.city || "",
                          });
                          setShowPropModal(true);
                        }}
                        className="text-slate-500 hover:text-brand-600"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteProp(p.id)}
                        className="text-slate-400 hover:text-rose-600"
                        title="Delete"
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
      )}

      {/* Tab 3: Manufacturers / Brands */}
      {activeTab === "manufacturers" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Manufacturers & Brands Master List
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Standard equipment OEMs and brands selectable when capitalizing assets in the Fixed Asset Register.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingMfg(null);
                setMfgForm({ name: "", code: "", country: "" });
                setShowMfgModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
            >
              <Plus size={14} /> Add Manufacturer / Brand
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Brand / Manufacturer</th>
                  <th>Country</th>
                  <th className="text-center">Assets Assigned</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manufacturers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="font-medium text-slate-900 dark:text-slate-100">
                      {m.name}
                    </td>
                    <td className="text-slate-600 dark:text-slate-400">
                      {m.country || "—"}
                    </td>
                    <td className="text-center font-semibold text-brand-600 dark:text-brand-400">
                      {m.asset_count || 0}
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingMfg(m);
                          setMfgForm({
                            name: m.name,
                            code: m.code || "",
                            country: m.country || "",
                          });
                          setShowMfgModal(true);
                        }}
                        className="text-slate-500 hover:text-brand-600"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteMfg(m.id)}
                        className="text-slate-400 hover:text-rose-600"
                        title="Delete"
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
      )}

      {/* Property Modal */}
      {showPropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {editingProp ? "Edit Facility Site / Property" : "Add Facility Site / Property"}
            </h3>

            <form onSubmit={handleSaveProp} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Site / Property Name *
                </label>
                <input
                  type="text"
                  required
                  value={propForm.property_name}
                  onChange={(e) => setPropForm({ ...propForm, property_name: e.target.value })}
                  placeholder="e.g. Corporate Headquarters, Tema Warehouse"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Property Type
                  </label>
                  <select
                    value={propForm.property_type}
                    onChange={(e) => setPropForm({ ...propForm, property_type: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="OFFICE">Office</option>
                    <option value="PLANT">Plant / Factory</option>
                    <option value="WAREHOUSE">Warehouse</option>
                    <option value="BRANCH">Branch</option>
                    <option value="SITE">Facility Site</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={propForm.city}
                    onChange={(e) => setPropForm({ ...propForm, city: e.target.value })}
                    placeholder="e.g. Accra"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={propForm.address}
                  onChange={(e) => setPropForm({ ...propForm, address: e.target.value })}
                  placeholder="Physical street address"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPropModal(false)}
                  className="btn btn-secondary px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold"
                >
                  Save Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manufacturer Modal */}
      {showMfgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {editingMfg ? "Edit Manufacturer / Brand" : "Add Manufacturer / Brand"}
            </h3>

            <form onSubmit={handleSaveMfg} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Manufacturer / Brand Name *
                </label>
                <input
                  type="text"
                  required
                  value={mfgForm.name}
                  onChange={(e) => setMfgForm({ ...mfgForm, name: e.target.value })}
                  placeholder="e.g. Caterpillar, Dell, Toyota"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={mfgForm.country}
                  onChange={(e) => setMfgForm({ ...mfgForm, country: e.target.value })}
                  placeholder="e.g. USA, Japan, Germany"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMfgModal(false)}
                  className="btn btn-secondary px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold"
                >
                  Save Manufacturer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
