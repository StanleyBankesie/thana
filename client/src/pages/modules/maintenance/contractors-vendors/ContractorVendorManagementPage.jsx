import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Handshake, Star, Plus, CheckCircle, ArrowLeft,
  Building2, Phone, Mail, Award, Clock, ShieldCheck, DollarSign,
  Eye, FileText, Edit
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function ContractorVendorManagementPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("vendors"); // "vendors" | "contracts"
  const [vendors, setVendors] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [viewingVendor, setViewingVendor] = useState(null);
  const [viewingContract, setViewingContract] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [vendorForm, setVendorForm] = useState({
    vendor_name: "",
    service_specialty: "HVAC & Air Conditioning",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    insurance_policy_no: "",
  });

  const [rateForm, setRateForm] = useState({
    quality_rating: 5,
    timeliness_rating: 5,
    safety_compliance_rating: 5,
    feedback_notes: "",
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "vendors") {
        const res = await api.get("/facilities/vendors");
        setVendors(res.data?.data || []);
      } else if (activeTab === "contracts") {
        const res = await api.get("/facilities/vendors/contracts");
        setContracts(res.data?.data || []);
      }
    } catch {
      toast.error(`Failed to load ${activeTab} data`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVendor = async (e) => {
    e.preventDefault();
    if (!vendorForm.vendor_name.trim()) {
      toast.warn("Vendor name is required");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/facilities/vendors", vendorForm);
      toast.success("Vendor profile registered successfully");
      setShowVendorModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create vendor");
    } finally {
      setSubmitting(false);
    }
  };

  const openRateModal = (v) => {
    setSelectedVendor(v);
    setRateForm({
      quality_rating: 5,
      timeliness_rating: 5,
      safety_compliance_rating: 5,
      feedback_notes: "",
    });
    setShowRateModal(true);
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/facilities/vendors/rate", {
        vendor_id: selectedVendor.id,
        ...rateForm,
      });
      toast.success("Vendor performance rating submitted!");
      setShowRateModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to rate vendor");
    } finally {
      setSubmitting(false);
    }
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
              <Handshake className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Contractor and Vendor Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Managing service providers, supplier contracts, quotations, service-level agreements (SLAs), insurance documents, performance ratings and invoices.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowVendorModal(true)}
          className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
        >
          <Plus size={15} /> Add Service Provider
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("vendors")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "vendors"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Users size={14} />
          Service Providers Directory ({vendors.length})
        </button>

        <button
          onClick={() => setActiveTab("contracts")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "contracts"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Handshake size={14} />
          Supplier Contracts & SLAs ({contracts.length})
        </button>
      </div>

      {/* TAB 1: VENDORS DIRECTORY */}
      {activeTab === "vendors" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Vendor Name / Code</th>
                  <th className="px-3 py-3">Service Specialty</th>
                  <th className="px-3 py-3">Key Contact</th>
                  <th className="px-3 py-3">Contact Phone / Email</th>
                  <th className="px-3 py-3">Insurance Policy</th>
                  <th className="px-3 py-3">Performance Score</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] text-slate-400 block">{v.vendor_code}</span>
                      <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{v.vendor_name}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                        {v.service_specialty}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800 dark:text-slate-200">{v.contact_person || "Operations Desk"}</td>
                    <td className="px-3 py-3 space-y-0.5">
                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        <Phone size={11} className="text-slate-400" />
                        <span>{v.phone || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <Mail size={11} className="text-slate-400" />
                        <span>{v.email || "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-emerald-600 flex items-center gap-1 text-[11px]">
                        <ShieldCheck size={13} /> Active
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 text-amber-500 font-bold">
                        <Star size={13} fill="currentColor" />
                        <span>{parseFloat(v.average_rating || 5).toFixed(2)} / 5</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {v.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setViewingVendor(v)}
                          className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                          title="View Vendor Details"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          onClick={() => openRateModal(v)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                          title="Score Contractor Quality & Timeliness"
                        >
                          <Star size={12} /> Rate
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

      {/* TAB 2: CONTRACTS & SLAS */}
      {activeTab === "contracts" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Contract Ref / Title</th>
                  <th className="px-3 py-3">Vendor Partner</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Annual Value (GHS)</th>
                  <th className="px-3 py-3">SLA Guarantee</th>
                  <th className="px-3 py-3">Validity Period</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] text-slate-400 block">{c.contract_ref}</span>
                      <span className="font-bold text-slate-900 dark:text-white block">{c.contract_title}</span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-indigo-600">{c.vendor_name}</td>
                    <td className="px-3 py-3">{c.property_name || "Entire Portfolio"}</td>
                    <td className="px-3 py-3 font-mono font-bold">
                      GHS {parseFloat(c.annual_contract_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      <span className="text-emerald-600 font-bold block">{c.sla_response_time_hours}h response</span>
                      <span className="text-slate-400 text-[10px]">{c.sla_resolution_time_hours}h resolution</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px]">
                      {String(c.start_date).slice(0, 10)} to {String(c.end_date).slice(0, 10)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewingContract(c)}
                        className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                        title="View Contract & SLA Details"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER VENDOR */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-fadeIn text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus size={16} className="text-indigo-500" />
              Register Service Provider / Contractor
            </h3>
            <form onSubmit={handleCreateVendor} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Company / Vendor Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Air Conditioning Ltd"
                    value={vendorForm.vendor_name}
                    onChange={(e) => setVendorForm({ ...vendorForm, vendor_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Service Specialty</label>
                  <select
                    value={vendorForm.service_specialty}
                    onChange={(e) => setVendorForm({ ...vendorForm, service_specialty: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    <option value="HVAC & Air Conditioning">HVAC & Air Conditioning</option>
                    <option value="Elevators & Escalators">Elevators & Escalators</option>
                    <option value="Generators & Power Systems">Generators & Power Systems</option>
                    <option value="Fire Protection & Alarms">Fire Protection & Alarms</option>
                    <option value="Cleaning & Janitorial Services">Cleaning & Janitorial</option>
                    <option value="Security Guard Force & CCTV">Security & CCTV</option>
                    <option value="Pest Control & Fumigation">Pest Control & Fumigation</option>
                    <option value="Plumbing & Drainage">Plumbing & Drainage</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Patrick Mensah"
                    value={vendorForm.contact_person}
                    onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +233 24 000 0000"
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="service@vendor.com"
                    value={vendorForm.email}
                    onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Insurance Policy No</label>
                  <input
                    type="text"
                    placeholder="e.g. GL-788912-A"
                    value={vendorForm.insurance_policy_no}
                    onChange={(e) => setVendorForm({ ...vendorForm, insurance_policy_no: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowVendorModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {submitting ? "Saving..." : "Register Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RATE VENDOR */}
      {showRateModal && selectedVendor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-fadeIn text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Star size={16} className="text-amber-500" />
              Rate Vendor: {selectedVendor.vendor_name}
            </h3>
            <form onSubmit={handleSubmitRating} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Quality of Workmanship (1 - 5)</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={rateForm.quality_rating}
                  onChange={(e) => setRateForm({ ...rateForm, quality_rating: parseInt(e.target.value) })}
                  className="w-full"
                />
                <span className="font-bold text-amber-500">{rateForm.quality_rating} Stars</span>
              </div>
              <div>
                <label className="block font-semibold mb-1">Timeliness & SLA Adherence (1 - 5)</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={rateForm.timeliness_rating}
                  onChange={(e) => setRateForm({ ...rateForm, timeliness_rating: parseInt(e.target.value) })}
                  className="w-full"
                />
                <span className="font-bold text-amber-500">{rateForm.timeliness_rating} Stars</span>
              </div>
              <div>
                <label className="block font-semibold mb-1">Safety & PPE Compliance (1 - 5)</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={rateForm.safety_compliance_rating}
                  onChange={(e) => setRateForm({ ...rateForm, safety_compliance_rating: parseInt(e.target.value) })}
                  className="w-full"
                />
                <span className="font-bold text-amber-500">{rateForm.safety_compliance_rating} Stars</span>
              </div>
              <div>
                <label className="block font-semibold mb-1">Feedback Notes</label>
                <textarea
                  rows={2}
                  placeholder="Technicians were professional, completed PM within agreed turnaround..."
                  value={rateForm.feedback_notes}
                  onChange={(e) => setRateForm({ ...rateForm, feedback_notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowRateModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {submitting ? "Submitting..." : "Submit Scorecard"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: VIEW VENDOR */}
      {viewingVendor && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <span className="font-mono text-[10px] text-slate-400 block">{viewingVendor.vendor_code}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 size={17} className="text-indigo-500" />
                  {viewingVendor.vendor_name}
                </h3>
              </div>
              <button onClick={() => setViewingVendor(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Service Specialty</span>
                  <span className="font-bold text-indigo-600 text-xs">{viewingVendor.service_specialty}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {viewingVendor.status?.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Primary Contact Person</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingVendor.contact_person || "Operations Desk"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Phone / Mobile</span>
                  <span className="font-mono text-slate-800 dark:text-white text-xs">{viewingVendor.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Email Address</span>
                  <span className="text-slate-800 dark:text-white text-xs">{viewingVendor.email || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Average Rating</span>
                  <div className="flex items-center gap-1 text-amber-500 font-bold">
                    <Star size={13} fill="currentColor" />
                    <span>{parseFloat(viewingVendor.average_rating || 5).toFixed(2)} / 5</span>
                  </div>
                </div>
                {viewingVendor.insurance_policy_no && (
                  <div>
                    <span className="text-slate-400 text-[11px] block">Insurance Policy No</span>
                    <span className="font-mono text-slate-800 dark:text-white text-xs">{viewingVendor.insurance_policy_no}</span>
                  </div>
                )}
                {viewingVendor.tax_identification_number && (
                  <div>
                    <span className="text-slate-400 text-[11px] block">TIN / Tax ID</span>
                    <span className="font-mono text-slate-800 dark:text-white text-xs">{viewingVendor.tax_identification_number}</span>
                  </div>
                )}
              </div>

              {viewingVendor.address && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Office / Workshop Address:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                    {viewingVendor.address}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  const v = viewingVendor;
                  setViewingVendor(null);
                  openRateModal(v);
                }}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
              >
                <Star size={12} /> Rate Performance
              </button>
              <button
                type="button"
                onClick={() => setViewingVendor(null)}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW CONTRACT */}
      {viewingContract && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <span className="font-mono text-[10px] text-slate-400 block">{viewingContract.contract_ref}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Handshake size={17} className="text-indigo-500" />
                  {viewingContract.contract_title}
                </h3>
              </div>
              <button onClick={() => setViewingContract(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Vendor Partner</span>
                  <span className="font-bold text-indigo-600 text-xs">{viewingContract.vendor_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Target Property</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingContract.property_name || "Entire Portfolio"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Annual Contract Value</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                    GHS {parseFloat(viewingContract.annual_contract_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {viewingContract.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Response SLA</span>
                  <span className="font-mono font-bold text-emerald-600 text-xs">{viewingContract.sla_response_time_hours} hours</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Resolution SLA</span>
                  <span className="font-mono font-bold text-blue-600 text-xs">{viewingContract.sla_resolution_time_hours} hours</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Start Date</span>
                  <span className="font-mono text-slate-800 dark:text-white text-xs">{String(viewingContract.start_date).slice(0, 10)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">End Date</span>
                  <span className="font-mono text-slate-800 dark:text-white text-xs">{String(viewingContract.end_date).slice(0, 10)}</span>
                </div>
              </div>

              {viewingContract.scope_of_work && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Scope of Work / Deliverables:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                    {viewingContract.scope_of_work}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingContract(null)}
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
