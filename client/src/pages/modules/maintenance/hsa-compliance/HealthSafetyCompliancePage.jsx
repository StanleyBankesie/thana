import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert, Flame, FileCheck, AlertTriangle, Plus,
  Calendar, CheckCircle, Clock, ArrowLeft, Filter, RefreshCw, FileText,
  Eye, Edit
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function HealthSafetyCompliancePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("incidents"); // "incidents" | "permits" | "certificates"
  const [properties, setProperties] = useState([]);

  const [incidents, setIncidents] = useState([]);
  const [permits, setPermits] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showPermitModal, setShowPermitModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [viewingIncident, setViewingIncident] = useState(null);
  const [viewingPermit, setViewingPermit] = useState(null);
  const [viewingCert, setViewingCert] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms - clean initial states (no prefilled values)
  const getInitialIncidentForm = () => ({
    property_id: "",
    incident_type: "",
    severity: "",
    location_details: "",
    reported_by: "",
    incident_description: "",
    immediate_action_taken: "",
  });

  const getInitialPermitForm = () => ({
    property_id: "",
    permit_type: "",
    work_description: "",
    contractor_or_team: "",
    authorized_supervisor: "",
    lead_worker_name: "",
    start_validity: "",
    end_validity: "",
  });

  const getInitialCertForm = () => ({
    property_id: "",
    certificate_no: "",
    certificate_type: "",
    issuing_authority: "",
    issue_date: "",
    expiry_date: "",
    renewal_lead_days: "",
    compliance_status: "",
  });

  const [incidentForm, setIncidentForm] = useState(getInitialIncidentForm());
  const [permitForm, setPermitForm] = useState(getInitialPermitForm());
  const [certForm, setCertForm] = useState(getInitialCertForm());

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchProperties = async () => {
    try {
      const res = await api.get("/facilities/properties");
      const list = res.data?.data || [];
      setProperties(list);
      if (list.length > 0) {
        setIncidentForm((p) => ({ ...p, property_id: list[0].id }));
        setPermitForm((p) => ({ ...p, property_id: list[0].id }));
        setCertForm((p) => ({ ...p, property_id: list[0].id }));
      }
    } catch {}
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "incidents") {
        const res = await api.get("/facilities/hsa/incidents");
        setIncidents(res.data?.data || []);
      } else if (activeTab === "permits") {
        const res = await api.get("/facilities/hsa/permits");
        setPermits(res.data?.data || []);
      } else if (activeTab === "certificates") {
        const res = await api.get("/facilities/hsa/certificates");
        setCertificates(res.data?.data || []);
      }
    } catch {
      toast.error(`Failed to load ${activeTab} data`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/facilities/hsa/incidents", incidentForm);
      toast.success("Incident / Hazard report logged successfully");
      setShowIncidentModal(false);
      setIncidentForm(getInitialIncidentForm());
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to log incident");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePermit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/facilities/hsa/permits", permitForm);
      toast.success("Permit to Work (PTW) issued successfully");
      setShowPermitModal(false);
      setPermitForm(getInitialPermitForm());
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to issue permit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCert = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/facilities/hsa/certificates", certForm);
      toast.success("Statutory compliance certificate recorded");
      setShowCertModal(false);
      setCertForm(getInitialCertForm());
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save certificate");
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
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              Health, Safety and Compliance
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Safety inspections, risk assessments, incident reporting, fire drills, statutory inspections, permits to work, environmental compliance and certification renewals.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "incidents" && (
            <button
              onClick={() => {
                setIncidentForm(getInitialIncidentForm());
                setShowIncidentModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Log Incident / Hazard
            </button>
          )}
          {activeTab === "permits" && (
            <button
              onClick={() => {
                setPermitForm(getInitialPermitForm());
                setShowPermitModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Issue Permit to Work (PTW)
            </button>
          )}
          {activeTab === "certificates" && (
            <button
              onClick={() => {
                setCertForm(getInitialCertForm());
                setShowCertModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Add Statutory Certificate
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("incidents")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "incidents"
              ? "border-rose-500 text-rose-600 dark:text-rose-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <AlertTriangle size={14} />
          Incident & Hazard Reporting
        </button>

        <button
          onClick={() => setActiveTab("permits")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "permits"
              ? "border-rose-500 text-rose-600 dark:text-rose-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Flame size={14} />
          Permits to Work (PTW)
        </button>

        <button
          onClick={() => setActiveTab("certificates")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "certificates"
              ? "border-rose-500 text-rose-600 dark:text-rose-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <FileCheck size={14} />
          Statutory Inspections & Certifications
        </button>
      </div>

      {/* TAB 1: INCIDENTS */}
      {activeTab === "incidents" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Safety Incident Register & Investigations
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Incident No</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Severity</th>
                  <th className="px-3 py-3">Description</th>
                  <th className="px-3 py-3">Reported By</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {incidents.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">{i.incident_no}</td>
                    <td className="px-3 py-3">{i.property_name || "Facility"}</td>
                    <td className="px-3 py-3 font-mono">{String(i.incident_date).slice(0, 16)}</td>
                    <td className="px-3 py-3 font-semibold">{i.incident_type?.replace(/_/g, " ")}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        i.severity === "CRITICAL" || i.severity === "HIGH"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}>
                        {i.severity}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{i.incident_description}</td>
                    <td className="px-3 py-3">{i.reported_by}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 dark:bg-slate-800">
                        {i.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewingIncident(i)}
                        className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                        title="View Incident Investigation"
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

      {/* TAB 2: PERMITS TO WORK */}
      {activeTab === "permits" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Active Permits to Work (PTW)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Permit No</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Scope / Description</th>
                  <th className="px-3 py-3">Contractor / Team</th>
                  <th className="px-3 py-3">Validity Window</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {permits.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">{p.permit_no}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                        {p.permit_type?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3">{p.property_name || "Main Site"}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">{p.work_description}</td>
                    <td className="px-3 py-3 font-semibold">{p.contractor_or_team}</td>
                    <td className="px-3 py-3 font-mono text-[11px]">
                      {String(p.start_validity).slice(0, 16)} to {String(p.end_validity).slice(11, 16)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewingPermit(p)}
                        className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                        title="View Permit Details"
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

      {/* TAB 3: STATUTORY CERTIFICATES */}
      {activeTab === "certificates" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Statutory Compliance & Certification Renewals
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Certificate No</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Issuing Authority</th>
                  <th className="px-3 py-3">Issue Date</th>
                  <th className="px-3 py-3">Expiry Date</th>
                  <th className="px-3 py-3">Days Remaining</th>
                  <th className="px-3 py-3">Compliance Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {certificates.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">{c.certificate_no}</td>
                    <td className="px-3 py-3 font-semibold">{c.certificate_type?.replace(/_/g, " ")}</td>
                    <td className="px-3 py-3">{c.property_name || "Facility"}</td>
                    <td className="px-3 py-3">{c.issuing_authority}</td>
                    <td className="px-3 py-3 font-mono">{String(c.issue_date).slice(0, 10)}</td>
                    <td className="px-3 py-3 font-mono font-bold">{String(c.expiry_date).slice(0, 10)}</td>
                    <td className="px-3 py-3">
                      <span className={`font-mono font-bold ${
                        (c.days_until_expiry != null && c.days_until_expiry < 30) ? "text-rose-500" : "text-emerald-600"
                      }`}>
                        {c.days_until_expiry != null ? `${c.days_until_expiry} days` : "Active"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.compliance_status === "VALID_COMPLIANT"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}>
                        {c.compliance_status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewingCert(c)}
                        className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                        title="View Certificate Details"
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

      {/* MODAL: LOG INCIDENT */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-500" />
                Report Safety Incident or Hazard
              </h3>
              <button
                type="button"
                onClick={() => setShowIncidentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateIncident} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Property</label>
                  <select
                    value={incidentForm.property_id}
                    onChange={(e) => setIncidentForm({ ...incidentForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Incident Type</label>
                  <select
                    value={incidentForm.incident_type}
                    onChange={(e) => setIncidentForm({ ...incidentForm, incident_type: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    <option value="NEAR_MISS">Near Miss</option>
                    <option value="FIRST_AID">First Aid</option>
                    <option value="LOST_TIME_INJURY">Lost Time Injury</option>
                    <option value="PROPERTY_DAMAGE">Property Damage</option>
                    <option value="ENVIRONMENTAL_SPILL">Environmental Spill</option>
                    <option value="FIRE_ALARM">Fire Alarm / Smoke</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Severity</label>
                  <select
                    value={incidentForm.severity}
                    onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Specific Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Stairwell B Floor 2"
                    value={incidentForm.location_details}
                    onChange={(e) => setIncidentForm({ ...incidentForm, location_details: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Incident Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe observed conditions, hazards, or event..."
                  value={incidentForm.incident_description}
                  onChange={(e) => setIncidentForm({ ...incidentForm, incident_description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Immediate Actions Taken</label>
                <textarea
                  rows={2}
                  placeholder="Area cordoned off, first aid administered, spill kit deployed..."
                  value={incidentForm.immediate_action_taken}
                  onChange={(e) => setIncidentForm({ ...incidentForm, immediate_action_taken: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {submitting ? "Logging..." : "Log Incident Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ISSUE PERMIT TO WORK */}
      {showPermitModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Flame size={18} className="text-amber-500" />
                Issue Permit to Work (PTW)
              </h3>
              <button
                type="button"
                onClick={() => setShowPermitModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePermit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Property</label>
                  <select
                    value={permitForm.property_id}
                    onChange={(e) => setPermitForm({ ...permitForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Permit Type</label>
                  <select
                    value={permitForm.permit_type}
                    onChange={(e) => setPermitForm({ ...permitForm, permit_type: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    <option value="HOT_WORK">Hot Work (Welding, Cutting)</option>
                    <option value="WORKING_AT_HEIGHT">Working at Height (&gt;2m)</option>
                    <option value="CONFINED_SPACE">Confined Space Entry</option>
                    <option value="ELECTRICAL_ISOLATION">Electrical Isolation / LOTO</option>
                    <option value="EXCAVATION">Excavation & Trenching</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Work Description</label>
                <input
                  type="text"
                  placeholder="e.g. Welding rooftop cooling tower steel support beams"
                  value={permitForm.work_description}
                  onChange={(e) => setPermitForm({ ...permitForm, work_description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Contractor / Working Team</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Engineering Ltd"
                    value={permitForm.contractor_or_team}
                    onChange={(e) => setPermitForm({ ...permitForm, contractor_or_team: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Authorizing Supervisor</label>
                  <input
                    type="text"
                    placeholder="e.g. David Osei (Safety Officer)"
                    value={permitForm.authorized_supervisor}
                    onChange={(e) => setPermitForm({ ...permitForm, authorized_supervisor: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Start Validity</label>
                  <input
                    type="datetime-local"
                    value={permitForm.start_validity}
                    onChange={(e) => setPermitForm({ ...permitForm, start_validity: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">End Validity</label>
                  <input
                    type="datetime-local"
                    value={permitForm.end_validity}
                    onChange={(e) => setPermitForm({ ...permitForm, end_validity: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowPermitModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {submitting ? "Issuing..." : "Issue Permit to Work"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD STATUTORY CERTIFICATE */}
      {showCertModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck size={18} className="text-emerald-500" />
                Register Statutory Inspection & Certification
              </h3>
              <button
                type="button"
                onClick={() => setShowCertModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCert} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Property</label>
                  <select
                    value={certForm.property_id}
                    onChange={(e) => setCertForm({ ...certForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Certificate Type</label>
                  <select
                    value={certForm.certificate_type}
                    onChange={(e) => setCertForm({ ...certForm, certificate_type: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    <option value="FIRE_SAFETY_PERMIT">Fire Safety Permit</option>
                    <option value="ELEVATOR_LIFT_STATUTORY">Elevator Statutory Inspection</option>
                    <option value="BOILER_PRESSURE_VESSEL">Boiler / Pressure Vessel</option>
                    <option value="ELECTRICAL_INSTALLATION_CERT">Electrical Integrity Certificate</option>
                    <option value="ENVIRONMENTAL_EPA_PERMIT">EPA Environmental Permit</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Certificate No</label>
                  <input
                    type="text"
                    placeholder="e.g. GNFS-ACC-2026-99"
                    value={certForm.certificate_no}
                    onChange={(e) => setCertForm({ ...certForm, certificate_no: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Issuing Authority</label>
                  <input
                    type="text"
                    placeholder="e.g. Ghana National Fire Service"
                    value={certForm.issuing_authority}
                    onChange={(e) => setCertForm({ ...certForm, issuing_authority: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={certForm.issue_date}
                    onChange={(e) => setCertForm({ ...certForm, issue_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={certForm.expiry_date}
                    onChange={(e) => setCertForm({ ...certForm, expiry_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCertModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {submitting ? "Saving..." : "Save Certificate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: VIEW INCIDENT */}
      {viewingIncident && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <span className="font-mono text-[10px] text-slate-400 block">{viewingIncident.incident_no}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert size={17} className="text-rose-500" />
                  Incident Investigation Report
                </h3>
              </div>
              <button onClick={() => setViewingIncident(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Property</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingIncident.property_name || "Facility"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Incident Type</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingIncident.incident_type?.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Severity Level</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    viewingIncident.severity === "CRITICAL" || viewingIncident.severity === "HIGH"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}>
                    {viewingIncident.severity}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className="font-mono text-slate-800 dark:text-white text-xs">{viewingIncident.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Incident Date / Time</span>
                  <span className="font-mono text-slate-800 dark:text-white text-xs">{String(viewingIncident.incident_date).slice(0, 16)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Reported By</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">{viewingIncident.reported_by}</span>
                </div>
              </div>

              {viewingIncident.location_details && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Exact Location:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                    {viewingIncident.location_details}
                  </p>
                </div>
              )}

              {viewingIncident.incident_description && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Incident Description:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50 leading-relaxed">
                    {viewingIncident.incident_description}
                  </p>
                </div>
              )}

              {viewingIncident.immediate_action_taken && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Immediate Actions Taken:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50 leading-relaxed">
                    {viewingIncident.immediate_action_taken}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingIncident(null)}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW PERMIT */}
      {viewingPermit && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <span className="font-mono text-[10px] text-slate-400 block">{viewingPermit.permit_no}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Flame size={17} className="text-amber-500" />
                  Permit to Work (PTW) Details
                </h3>
              </div>
              <button onClick={() => setViewingPermit(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Permit Type</span>
                  <span className="font-bold text-amber-600 text-xs">{viewingPermit.permit_type?.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Property</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingPermit.property_name || "Main Site"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Contractor / Working Team</span>
                  <span className="font-semibold text-slate-800 dark:text-white text-xs">{viewingPermit.contractor_or_team}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {viewingPermit.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Authorized Supervisor</span>
                  <span className="font-medium text-slate-800 dark:text-white text-xs">{viewingPermit.authorized_supervisor || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Lead Worker</span>
                  <span className="font-medium text-slate-800 dark:text-white text-xs">{viewingPermit.lead_worker_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Validity Start</span>
                  <span className="font-mono text-slate-800 dark:text-white text-xs">{String(viewingPermit.start_validity).slice(0, 16)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Validity End</span>
                  <span className="font-mono text-slate-800 dark:text-white text-xs">{String(viewingPermit.end_validity).slice(0, 16)}</span>
                </div>
              </div>

              {viewingPermit.work_description && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Work Scope & Hazards:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50 leading-relaxed">
                    {viewingPermit.work_description}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingPermit(null)}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW CERTIFICATE */}
      {viewingCert && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <span className="font-mono text-[10px] text-slate-400 block">{viewingCert.certificate_no}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck size={17} className="text-emerald-500" />
                  Statutory Certificate Details
                </h3>
              </div>
              <button onClick={() => setViewingCert(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Certificate Type</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingCert.certificate_type?.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Property</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingCert.property_name || "Facility"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Issuing Authority</span>
                  <span className="font-semibold text-slate-800 dark:text-white text-xs">{viewingCert.issuing_authority}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Compliance Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    viewingCert.compliance_status === "VALID_COMPLIANT"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}>
                    {viewingCert.compliance_status?.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Issue Date</span>
                  <span className="font-mono text-slate-800 dark:text-white text-xs">{String(viewingCert.issue_date).slice(0, 10)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Expiry Date</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">{String(viewingCert.expiry_date).slice(0, 10)}</span>
                </div>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
                <div>
                  <span className="text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold block">Days Remaining until Expiry</span>
                  <span className={`font-mono text-lg font-bold ${
                    (viewingCert.days_until_expiry != null && viewingCert.days_until_expiry < 30) ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {viewingCert.days_until_expiry != null ? `${viewingCert.days_until_expiry} days` : "Active"}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingCert(null)}
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
