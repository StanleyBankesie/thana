import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Building2, Plus, Search, Filter, Layers, MapPin, 
  User, CheckCircle2, AlertTriangle, ChevronRight, X, Eye, ArrowLeft,
  ClipboardList, CheckCircle, RefreshCw, Calendar, Edit
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ViewToggle from "../../../../components/ViewToggle.jsx";

const STAGE_COLORS = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  PENDING_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  OPERATIONAL: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  ON_HOLD: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

const STAGES = ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "APPROVED", "OPERATIONAL", "ON_HOLD"];

const getInitialOnboardingForm = () => ({
  property_id: "",
  client_id: "",
  target_handover_date: "",
  property_manager_name: "",
  condition_summary: "",
});

export default function PropertiesList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("properties"); // 'properties' | 'onboarding'
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState("table");
  
  // Properties Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [selectedHierarchyProperty, setSelectedHierarchyProperty] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);

  // Form State - clean initial state (no prefilled values)
  const getInitialFormData = () => ({
    property_name: "",
    property_type: "",
    address: "",
    city: "",
    state: "",
    total_area_sqm: "",
    contact_person_name: "",
    contact_person_phone: "",
    contact_person_email: "",
    property_manager_name: "",
    notes: ""
  });

  const [formData, setFormData] = useState(getInitialFormData());
  const [saving, setSaving] = useState(false);

  // Clients
  const [clients, setClients] = useState([]);

  // === ONBOARDING STATE ===
  const [onboardings, setOnboardings] = useState([]);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [filterStage, setFilterStage] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState(getInitialOnboardingForm());
  const [submittingOnboarding, setSubmittingOnboarding] = useState(false);

  // Detail panel state
  const [detailRecord, setDetailRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [detailStage, setDetailStage] = useState("");
  const [markingItem, setMarkingItem] = useState(null);

  useEffect(() => {
    fetchProperties();
    fetchClients();
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    if (activeTab === "onboarding") {
      fetchOnboardings();
    }
  }, [activeTab, filterStage, filterSearch]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const params = {};
      if (typeFilter) params.propertyType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get("/facilities/properties", { params });
      setProperties(res.data?.data || []);
    } catch (err) {
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get("/sales/customers").catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.items || [];
      setClients(list);
    } catch {
      setClients([]);
    }
  };

  const fetchOnboardings = useCallback(async () => {
    setOnboardingLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStage) params.append("stage", filterStage);
      if (filterSearch) params.append("search", filterSearch);
      const res = await api.get(`/facilities/onboarding?${params.toString()}`);
      setOnboardings(res.data?.data || []);
    } catch {
      toast.error("Failed to load onboarding records");
    } finally {
      setOnboardingLoading(false);
    }
  }, [filterStage, filterSearch]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProperties();
  };

  const handleOpenHierarchy = async (property) => {
    setSelectedHierarchyProperty(property);
    try {
      setHierarchyLoading(true);
      const res = await api.get(`/facilities/properties/${property.id}/hierarchy`);
      setHierarchyData(res.data?.data || null);
    } catch (err) {
      toast.error("Failed to load property hierarchy tree");
    } finally {
      setHierarchyLoading(false);
    }
  };

  const handleEditProperty = (prop) => {
    setEditingProperty(prop);
    setFormData({
      property_name: prop.property_name || "",
      property_type: prop.property_type || "",
      client_id: prop.client_id || "",
      address: prop.address || "",
      city: prop.city || "",
      state: prop.state || "",
      total_area_sqm: prop.total_area_sqm || "",
      contact_person_name: prop.contact_person_name || "",
      contact_person_phone: prop.contact_person_phone || "",
      contact_person_email: prop.contact_person_email || "",
      property_manager_name: prop.property_manager_name || "",
      notes: prop.notes || ""
    });
    setShowCreateModal(true);
  };

  const handleCreateProperty = async (e) => {
    e.preventDefault();
    if (!formData.property_name.trim()) {
      toast.warn("Property name is required");
      return;
    }
    try {
      setSaving(true);
      if (editingProperty) {
        await api.put(`/facilities/properties/${editingProperty.id}`, formData);
        toast.success("Property updated successfully");
      } else {
        await api.post("/facilities/properties", formData);
        toast.success("Property created successfully");
      }
      setShowCreateModal(false);
      setEditingProperty(null);
      setFormData(getInitialFormData());
      fetchProperties();
    } catch (err) {
      toast.error(err.response?.data?.message || (editingProperty ? "Failed to update property" : "Failed to create property"));
    } finally {
      setSaving(false);
    }
  };

  // === ONBOARDING HANDLERS ===
  const handleCreateOnboarding = async (e) => {
    e.preventDefault();
    if (!onboardingForm.property_id) {
      toast.warn("Please select a property.");
      return;
    }
    setSubmittingOnboarding(true);
    try {
      await api.post("/facilities/onboarding", onboardingForm);
      toast.success("Property onboarding record created successfully!");
      setShowOnboardingModal(false);
      setOnboardingForm(getInitialOnboardingForm());
      fetchOnboardings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create onboarding");
    } finally {
      setSubmittingOnboarding(false);
    }
  };

  const openOnboardingDetail = async (id) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    setDetailRecord(null);
    try {
      const res = await api.get(`/facilities/onboarding/${id}`);
      const rec = res.data?.data || {};
      setDetailRecord(rec);
      setDetailStage(rec.stage || "");
    } catch {
      toast.error("Failed to load onboarding details");
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStage = async () => {
    if (!detailRecord || !detailStage) return;
    setUpdatingStage(true);
    try {
      await api.put(`/facilities/onboarding/${detailRecord.id}`, { stage: detailStage });
      toast.success("Stage updated successfully");
      setDetailRecord((prev) => ({ ...prev, stage: detailStage }));
      fetchOnboardings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update stage");
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleMarkChecklistItem = async (item) => {
    setMarkingItem(item.id);
    try {
      await api.put(`/facilities/onboarding/checklist/${item.id}`, {
        status: "COMPLETE",
        completed_by: "Current User",
        notes: "",
      });
      toast.success("Checklist item marked complete");
      const res = await api.get(`/facilities/onboarding/${detailRecord.id}`);
      setDetailRecord(res.data?.data || detailRecord);
      fetchOnboardings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update checklist item");
    } finally {
      setMarkingItem(null);
    }
  };

  const propertyTypes = [
    { value: "COMMERCIAL_OFFICE", label: "Commercial Office" },
    { value: "RESIDENTIAL_ESTATE", label: "Residential Estate" },
    { value: "SHOPPING_MALL", label: "Shopping Mall / Retail" },
    { value: "HEALTHCARE_HOSPITAL", label: "Healthcare / Hospital" },
    { value: "INDUSTRIAL_WAREHOUSE", label: "Industrial / Warehouse" },
    { value: "EDUCATIONAL_CAMPUS", label: "Educational Campus" },
    { value: "MIXED_USE", label: "Mixed-Use Complex" },
    { value: "HOTEL_HOSPITALITY", label: "Hotel / Hospitality" },
    { value: "GOVERNMENT_PUBLIC", label: "Government / Public Building" },
    { value: "OTHER", label: "Other" }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
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
              <Building2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Properties, Estates & Onboarding
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Manage client facility portfolios, properties, site onboarding, and handover workflows.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (activeTab === "properties") {
              setFormData(getInitialFormData());
              setShowCreateModal(true);
            } else {
              setOnboardingForm(getInitialOnboardingForm());
              setShowOnboardingModal(true);
            }
          }}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} /> {activeTab === "properties" ? "Register Property" : "New Onboarding"}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab("properties")}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "properties"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Building2 size={15} /> Properties & Estates Register ({properties.length})
        </button>
        <button
          onClick={() => setActiveTab("onboarding")}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "onboarding"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <ClipboardList size={15} /> Property Onboarding & Handover ({onboardings.length})
        </button>
      </div>

      {/* ======================= TAB 1: PROPERTIES ======================= */}
      {activeTab === "properties" && (
        <>
          {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            className="input w-full pl-9 text-sm"
            placeholder="Search by property name, code, address, city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>

        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          <select
            className="input text-sm py-1.5"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Property Types</option>
            {propertyTypes.map((pt) => (
              <option key={pt.value} value={pt.value}>{pt.label}</option>
            ))}
          </select>

          <select
            className="input text-sm py-1.5"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Property Cards / Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : properties.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-900 dark:text-white">No properties found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Get started by registering a client facility or site.</p>
          <button
            onClick={() => {
              setFormData(getInitialFormData());
              setShowCreateModal(true);
            }}
            className="btn btn-primary mt-4 text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Add Property
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Property Name</th>
                  <th className="py-3 px-4">Property Type</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Address / City</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4 text-center">Structures</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 text-sm">
                {properties.map((prop) => (
                  <tr key={prop.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-xs text-brand-600 dark:text-brand-400">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                        {prop.property_code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {prop.property_name}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {prop.property_type?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                      {prop.client_name || "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {prop.address ? `${prop.address}, ` : ""}{prop.city || "Accra"}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-300">
                      {prop.total_area_sqm ? `${Number(prop.total_area_sqm).toLocaleString()} m²` : "—"}
                    </td>
                    <td className="py-3 px-4 text-center text-xs">
                      <span className="font-mono text-slate-600 dark:text-slate-300">
                        {prop.building_count || 0} bld • {prop.space_count || 0} spc • {prop.asset_count || 0} ast
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        prop.status === "ACTIVE" 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}>
                        {prop.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenHierarchy(prop)}
                          className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                          title="View Hierarchy & Structure"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleEditProperty(prop)}
                          className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                          title="Edit Facility Details"
                        >
                          <Edit size={13} />
                          <span>Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

        </>
      )}

      {/* ======================= TAB 2: ONBOARDING ======================= */}
      {activeTab === "onboarding" && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Onboardings", value: onboardings.length, color: "slate" },
              { label: "In Progress", value: onboardings.filter(o => o.stage === "IN_PROGRESS").length, color: "blue" },
              { label: "Pending Review", value: onboardings.filter(o => o.stage === "PENDING_REVIEW").length, color: "amber" },
              { label: "Operational", value: onboardings.filter(o => o.stage === "OPERATIONAL").length, color: "emerald" },
            ].map((card) => (
              <div key={card.label} className={`card p-4 border border-${card.color}-200 dark:border-${card.color}-800 bg-${card.color}-50 dark:bg-${card.color}-950/30`}>
                <p className={`text-xs text-${card.color}-600 dark:text-${card.color}-400 font-medium`}>{card.label}</p>
                <p className={`text-2xl font-bold text-${card.color}-700 dark:text-${card.color}-300 mt-1`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                className="input w-full pl-9 text-sm"
                placeholder="Search by property or manager name..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
              <select
                className="input text-sm py-1.5"
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
              >
                <option value="">All Stages</option>
                {STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
              <button onClick={fetchOnboardings} className="btn btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1.5">
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>

          {/* Onboarding Table */}
          {onboardingLoading ? (
            <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : onboardings.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-medium text-slate-900 dark:text-white">No onboarding records found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Start by creating a new property onboarding workflow.</p>
              <button
                onClick={() => { setOnboardingForm(getInitialOnboardingForm()); setShowOnboardingModal(true); }}
                className="btn btn-primary mt-4 text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
              >
                <Plus size={14} /> New Onboarding
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Onboarding No</th>
                      <th className="py-3 px-4">Property Name</th>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Stage</th>
                      <th className="py-3 px-4">Manager</th>
                      <th className="py-3 px-4">Target Date</th>
                      <th className="py-3 px-4">Checklist Progress</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 text-sm">
                    {onboardings.map((ob) => {
                      const total = ob.checklist_total || 0;
                      const done = ob.checklist_done || 0;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <tr key={ob.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-xs text-brand-600 dark:text-brand-400">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                              {ob.onboarding_no || ob.id}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{ob.property_name || "—"}</td>
                          <td className="py-3 px-4 text-xs text-slate-500">{ob.client_name || "—"}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STAGE_COLORS[ob.stage] || "bg-slate-100 text-slate-700"}`}>
                              {ob.stage?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs">{ob.property_manager_name || "—"}</td>
                          <td className="py-3 px-4 text-xs font-mono">{ob.target_handover_date ? new Date(ob.target_handover_date).toLocaleDateString() : "—"}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 min-w-[60px]">
                                <div className={`h-1.5 rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-mono text-slate-500">{done}/{total}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openOnboardingDetail(ob.id)}
                                className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                                title="View Onboarding Details"
                              >
                                <Eye size={13} /> View
                              </button>
                              <button
                                onClick={() => openOnboardingDetail(ob.id)}
                                className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                                title="Edit Stage & Complete Checklist"
                              >
                                <Edit size={13} /> Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================= MODALS (shared, outside tab conditionals) ======================= */}

      {/* Visual Hierarchy Tree Modal */}
      {selectedHierarchyProperty && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Facility Space Hierarchy: {selectedHierarchyProperty.property_name}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">{selectedHierarchyProperty.property_code}</span>
                </div>
              </div>
              <button
                onClick={() => { setSelectedHierarchyProperty(null); setHierarchyData(null); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {hierarchyLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !hierarchyData || !hierarchyData.buildings || hierarchyData.buildings.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No buildings configured under this property yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {hierarchyData.buildings.map((bld) => (
                    <div key={bld.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex items-center justify-between font-semibold text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                        <span className="flex items-center gap-2">
                          <Building2 size={16} className="text-emerald-600" />
                          {bld.name} <span className="text-xs font-mono text-slate-400">({bld.code})</span>
                        </span>
                        <span className="text-xs font-normal text-slate-500">{bld.zones?.length || 0} Floors / Zones</span>
                      </div>

                      {/* Zones */}
                      <div className="pl-4 mt-2 space-y-2 border-l-2 border-emerald-500/20 ml-2">
                        {bld.zones?.map((zone) => (
                          <div key={zone.id} className="bg-white dark:bg-slate-800 p-2.5 rounded border border-slate-200/80 dark:border-slate-700/80">
                            <div className="text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center justify-between">
                              <span>Floor {zone.floor}: {zone.name}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{zone.code}</span>
                            </div>

                            {/* Spaces */}
                            {zone.spaces?.length > 0 && (
                              <div className="pl-3 mt-2 space-y-1.5 border-l-2 border-dashed border-slate-200 dark:border-slate-700 ml-1">
                                {zone.spaces.map((sp) => (
                                  <div key={sp.id} className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-slate-700 dark:text-slate-300">
                                        ðŸ“ {sp.name} {sp.occupant ? `(Tenant: ${sp.occupant})` : ""}
                                      </span>
                                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        {sp.space_type}
                                      </span>
                                    </div>

                                    {/* Assets in this space */}
                                    {sp.assets?.length > 0 && (
                                      <div className="mt-1.5 pt-1.5 border-t border-slate-200/50 dark:border-slate-800 flex flex-wrap gap-1.5">
                                        {sp.assets.map((ast) => (
                                          <span
                                            key={ast.id}
                                            className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                          >
                                            Asset: {ast.name} ({ast.code})
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-850">
              <button
                onClick={() => { setSelectedHierarchyProperty(null); setHierarchyData(null); }}
                className="btn-secondary text-xs px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Property Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {editingProperty ? `Edit Facility: ${editingProperty.property_name}` : "Register New Facility / Property & Estate"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingProperty ? "Update facility boundaries, manager details, and contact person." : "Define property hierarchy master site, location boundaries, and operational contacts."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-750"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="p-6 sm:p-8 space-y-6 text-xs">
              {/* Section 1: Identification & Classification */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <Building2 size={14} className="text-emerald-500" /> Site Identification & Category
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                      Property / Site Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="input w-full text-xs"
                      placeholder="e.g. World Trade Center Tower A, Apex Technology Park, Ridge Estate"
                      value={formData.property_name}
                      onChange={(e) => setFormData({ ...formData, property_name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Property Type</label>
                    <select
                      className="input w-full text-xs font-medium"
                      value={formData.property_type}
                      onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                    >
                      <option value="">-- Choose Property Type --</option>
                      {propertyTypes.map((pt) => (
                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Client / Landlord Organization</label>
                    <select
                      className="input w-full text-xs"
                      value={formData.client_id || ""}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    >
                      <option value="">Select Client / Landlord Organization (Optional)...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.customer_name || c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Location & Physical Dimensions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <MapPin size={14} className="text-blue-500" /> Location & Physical Dimensions
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Physical Address / Street / Zone</label>
                    <input
                      type="text"
                      className="input w-full text-xs"
                      placeholder="Street, District, Plot number, Major Landmark"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">City / Metropolis</label>
                    <input
                      type="text"
                      className="input w-full text-xs"
                      placeholder="e.g. Accra, Kumasi, Tema"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">State / Region</label>
                    <input
                      type="text"
                      className="input w-full text-xs"
                      placeholder="e.g. Greater Accra, Ashanti"
                      value={formData.state || ""}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Total Floor Area (m²)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input w-full text-xs font-mono"
                      placeholder="e.g. 15000"
                      value={formData.total_area_sqm}
                      onChange={(e) => setFormData({ ...formData, total_area_sqm: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Property Administration & Contact Person */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <User size={14} className="text-purple-500" /> Property Administration & Key Contacts
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Facilities Manager</label>
                    <input
                      type="text"
                      className="input w-full text-xs"
                      placeholder="Name of facilities manager"
                      value={formData.property_manager_name}
                      onChange={(e) => setFormData({ ...formData, property_manager_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Site Contact Person</label>
                    <input
                      type="text"
                      className="input w-full text-xs"
                      placeholder="Primary site liaison"
                      value={formData.contact_person_name}
                      onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Site Contact Phone</label>
                    <input
                      type="text"
                      className="input w-full text-xs"
                      placeholder="e.g. 0244123456"
                      value={formData.contact_person_phone}
                      onChange={(e) => setFormData({ ...formData, contact_person_phone: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Site Contact Email</label>
                    <input
                      type="email"
                      className="input w-full text-xs"
                      placeholder="e.g. site@property.com"
                      value={formData.contact_person_email}
                      onChange={(e) => setFormData({ ...formData, contact_person_email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Operational Notes */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                  Operational Guidelines & Site Scope Notes
                </label>
                <textarea
                  rows={2}
                  className="input w-full text-xs"
                  placeholder="Access control regulations, loading bay hours, building management guidelines..."
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary text-xs px-5 py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary text-xs px-6 py-2.5 font-bold"
                >
                  {saving ? "Saving..." : editingProperty ? "Update Facility" : "Save & Register Facility"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= New Onboarding Modal ======================= */}
      {showOnboardingModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">New Property Onboarding</h3>
                  <p className="text-xs text-slate-500">Initiate a new property site handover workflow</p>
                </div>
              </div>
              <button onClick={() => setShowOnboardingModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateOnboarding} className="p-6 space-y-4 text-xs">
              <div>
                <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Property / Site <span className="text-red-500">*</span></label>
                <select
                  className="input w-full text-xs"
                  value={onboardingForm.property_id}
                  onChange={(e) => setOnboardingForm({ ...onboardingForm, property_id: e.target.value })}
                  required
                >
                  <option value="">-- Select Property --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.property_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Client / Customer</label>
                <select
                  className="input w-full text-xs"
                  value={onboardingForm.client_id}
                  onChange={(e) => setOnboardingForm({ ...onboardingForm, client_id: e.target.value })}
                >
                  <option value="">-- Select Client (Optional) --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.customer_name || c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Target Handover Date</label>
                  <input type="date" className="input w-full text-xs" value={onboardingForm.target_handover_date}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, target_handover_date: e.target.value })} />
                </div>
                <div>
                  <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Property Manager Name</label>
                  <input type="text" className="input w-full text-xs" placeholder="Manager name" value={onboardingForm.property_manager_name}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, property_manager_name: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Condition Summary</label>
                <textarea rows={3} className="input w-full text-xs" placeholder="Current state of the property, outstanding issues..."
                  value={onboardingForm.condition_summary} onChange={(e) => setOnboardingForm({ ...onboardingForm, condition_summary: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowOnboardingModal(false)} className="btn btn-secondary text-xs px-5 py-2">Cancel</button>
                <button type="submit" disabled={submittingOnboarding} className="btn btn-primary text-xs px-6 py-2 font-bold">
                  {submittingOnboarding ? "Creating..." : "Create Onboarding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= Onboarding Detail / Checklist Modal ======================= */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <CheckCircle size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Onboarding Progress</h3>
                  {detailRecord && <p className="text-xs text-slate-500 font-mono">{detailRecord.onboarding_no}</p>}
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {detailLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : detailRecord ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-slate-500">Property:</span> <span className="font-semibold ml-1">{detailRecord.property_name}</span></div>
                    <div><span className="text-slate-500">Client:</span> <span className="font-semibold ml-1">{detailRecord.client_name || "—"}</span></div>
                    <div><span className="text-slate-500">Manager:</span> <span className="font-semibold ml-1">{detailRecord.property_manager_name || "—"}</span></div>
                    <div><span className="text-slate-500">Target Date:</span> <span className="font-semibold ml-1">{detailRecord.target_handover_date ? new Date(detailRecord.target_handover_date).toLocaleDateString() : "—"}</span></div>
                  </div>
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">Update Stage:</label>
                    <select className="input text-xs flex-1" value={detailStage} onChange={(e) => setDetailStage(e.target.value)}>
                      {STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                    <button onClick={handleUpdateStage} disabled={updatingStage} className="btn btn-primary text-xs px-3 py-1.5 shrink-0">
                      {updatingStage ? "Saving..." : "Update"}
                    </button>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Checklist Items</h4>
                    {(!detailRecord.checklist || detailRecord.checklist.length === 0) ? (
                      <p className="text-xs text-slate-400 text-center py-4">No checklist items defined for this onboarding.</p>
                    ) : (
                      <div className="space-y-2">
                        {detailRecord.checklist.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                            <div className="flex items-center gap-2.5">
                              {item.status === "COMPLETE" ? (
                                <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                              )}
                              <div>
                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{item.item_name || item.description}</p>
                                {item.completed_by && <p className="text-[11px] text-slate-400">Completed by: {item.completed_by}</p>}
                              </div>
                            </div>
                            {item.status !== "COMPLETE" && (
                              <button onClick={() => handleMarkChecklistItem(item)} disabled={markingItem === item.id}
                                className="btn btn-secondary text-xs px-2.5 py-1 shrink-0">
                                {markingItem === item.id ? "..." : "Mark Done"}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">Failed to load onboarding details.</p>
              )}
            </div>
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button onClick={() => setShowDetailModal(false)} className="btn btn-secondary text-xs px-4 py-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}