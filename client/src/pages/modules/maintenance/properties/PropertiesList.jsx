import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Building2, Plus, Search, Filter, Layers, MapPin, 
  User, CheckCircle2, AlertTriangle, ChevronRight, X, Eye, ArrowLeft
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function PropertiesList() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedHierarchyProperty, setSelectedHierarchyProperty] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    property_name: "",
    property_type: "COMMERCIAL_OFFICE",
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
  const [saving, setSaving] = useState(false);

  // Clients
  const [clients, setClients] = useState([]);

  useEffect(() => {
    fetchProperties();
    fetchClients();
  }, [typeFilter, statusFilter]);

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
      const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setClients(list);
    } catch {
      setClients([]);
    }
  };

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

  const handleCreateProperty = async (e) => {
    e.preventDefault();
    if (!formData.property_name.trim()) {
      toast.warn("Property name is required");
      return;
    }
    try {
      setSaving(true);
      await api.post("/facilities/properties", formData);
      toast.success("Property created successfully");
      setShowCreateModal(false);
      setFormData({
        property_name: "",
        property_type: "COMMERCIAL_OFFICE",
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
      fetchProperties();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create property");
    } finally {
      setSaving(false);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to="/maintenance?section=Facilities Management"
            className="btn btn-secondary p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title="Back to Facilities Management"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Client Properties & Site Register
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage client facility portfolios, buildings, floors/zones, spaces, and equipment locations.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg"
        >
          <Plus size={16} />
          Register Property
        </button>
      </div>

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

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
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
            onClick={() => setShowCreateModal(true)}
            className="btn-primary mt-4 text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Add Property
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {properties.map((prop) => (
            <div
              key={prop.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:border-emerald-500/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 mr-2">
                      {prop.property_code}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      {prop.property_type.replace(/_/g, " ")}
                    </span>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-1">
                      {prop.property_name}
                    </h3>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    prop.status === "ACTIVE" 
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}>
                    {prop.status}
                  </span>
                </div>

                {prop.client_name && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-2">
                    <User size={13} className="text-slate-400" />
                    Client: <span className="font-medium text-slate-700 dark:text-slate-200">{prop.client_name}</span>
                  </p>
                )}

                <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 mb-3">
                  <MapPin size={13} className="text-slate-400 shrink-0" />
                  {prop.address ? `${prop.address}, ` : ""}{prop.city || "Accra"}
                  {prop.total_area_sqm && <span className="ml-2 text-slate-400 font-mono">({Number(prop.total_area_sqm).toLocaleString()} m²)</span>}
                </p>

                {/* Sub-counts */}
                <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-center text-xs">
                  <div>
                    <span className="block font-bold text-slate-800 dark:text-slate-100">{prop.building_count}</span>
                    <span className="text-[11px] text-slate-400">Buildings</span>
                  </div>
                  <div>
                    <span className="block font-bold text-slate-800 dark:text-slate-100">{prop.zone_count}</span>
                    <span className="text-[11px] text-slate-400">Floors/Zones</span>
                  </div>
                  <div>
                    <span className="block font-bold text-slate-800 dark:text-slate-100">{prop.space_count}</span>
                    <span className="text-[11px] text-slate-400">Spaces</span>
                  </div>
                  <div>
                    <span className="block font-bold text-emerald-600 dark:text-emerald-400">{prop.asset_count}</span>
                    <span className="text-[11px] text-slate-400">Assets</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500">
                  {prop.open_tickets_count > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <AlertTriangle size={13} /> {prop.open_tickets_count} Active Helpdesk Ticket(s)
                    </span>
                  ) : (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 size={13} /> All Systems Operational
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenHierarchy(prop)}
                    className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
                  >
                    <Layers size={13} />
                    View Hierarchy
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visual Hierarchy Tree Modal */}
      {selectedHierarchyProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                    Facility Hierarchy: {selectedHierarchyProperty.property_name}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">{selectedHierarchyProperty.property_code}</span>
                </div>
              </div>
              <button
                onClick={() => { setSelectedHierarchyProperty(null); setHierarchyData(null); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded"
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
                                        📍 {sp.name} {sp.occupant ? `(Tenant: ${sp.occupant})` : ""}
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
                                            ⚙️ {ast.name} ({ast.code})
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
              <h3 className="font-semibold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Building2 size={18} className="text-emerald-600" />
                Register New Facility / Property
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label mb-1">Property / Site Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. World Trade Center Tower A, Apex Mall"
                    value={formData.property_name}
                    onChange={(e) => setFormData({ ...formData, property_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label mb-1">Property Type</label>
                  <select
                    className="input w-full"
                    value={formData.property_type}
                    onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                  >
                    {propertyTypes.map((pt) => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label mb-1">Client Organization</label>
                  <select
                    className="input w-full"
                    value={formData.client_id || ""}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  >
                    <option value="">Select Client / Landlord...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.customer_name || c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="label mb-1">Address / Location</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Street, District, Landmark"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label mb-1">City</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Accra, Kumasi"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label mb-1">Total Floor Area (m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input w-full"
                    placeholder="e.g. 15000"
                    value={formData.total_area_sqm}
                    onChange={(e) => setFormData({ ...formData, total_area_sqm: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label mb-1">Property Manager</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Name of facilities manager"
                    value={formData.property_manager_name}
                    onChange={(e) => setFormData({ ...formData, property_manager_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label mb-1">Site Contact Phone</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Contact phone number"
                    value={formData.contact_person_phone}
                    onChange={(e) => setFormData({ ...formData, contact_person_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-sm px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-sm px-5 py-2 font-medium"
                >
                  {saving ? "Saving..." : "Save Property"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
