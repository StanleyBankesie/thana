import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, AlertTriangle, Plus, ArrowLeft, RefreshCw,
  FileText, Calendar, CheckCircle, Filter, Eye, Edit, X,
  Cloud, ExternalLink, Paperclip, Upload
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import CloudinaryDocumentUploader from "../../project-management/components/CloudinaryDocumentUploader.jsx";

// ─── Obligation helpers ───────────────────────────────────────────────────────
const OBLIGATION_STATUS_COLORS = {
  VALID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  EXPIRING_SOON: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  EXPIRED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  UNDER_RENEWAL: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

const OBLIGATION_CATEGORIES = [
  "STATUTORY", "ENVIRONMENTAL", "FIRE_SAFETY", "ELECTRICAL_SAFETY",
  "OCCUPATIONAL_HEALTH", "ELEVATOR_REGULATION", "INSURANCE",
];

// ─── Hazard helpers ───────────────────────────────────────────────────────────
const RISK_COLORS = {
  CRITICAL: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  HIGH: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  LOW: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

const HAZARD_STATUS_COLORS = {
  ACTIVE: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  MITIGATED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  ARCHIVED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const LIKELIHOOD_LABELS = { 1: "Rare", 2: "Unlikely", 3: "Possible", 4: "Likely", 5: "Almost Certain" };
const SEVERITY_LABELS = { 1: "Insignificant", 2: "Minor", 3: "Moderate", 4: "Major", 5: "Catastrophic" };

function computeRiskRating(likelihood, severity) {
  const score = Number(likelihood) * Number(severity);
  if (score >= 12) return "CRITICAL";
  if (score >= 8) return "HIGH";
  if (score >= 4) return "MEDIUM";
  return "LOW";
}

// ─── Initial forms ────────────────────────────────────────────────────────────
const getInitialObligationForm = () => ({
  property_id: "",
  title: "",
  category: "",
  issuing_authority: "",
  document_reference: "",
  document_url: "",
  document_name: "",
  attachments: [],
  attachments_json: "",
  issue_date: "",
  expiry_date: "",
  renewal_lead_days: 30,
  responsible_person: "",
  notes: "",
});

const getInitialUpdateForm = () => ({
  status: "",
  expiry_date: "",
  document_reference: "",
  document_url: "",
  document_name: "",
  attachments: [],
  attachments_json: "",
  notes: "",
});

const getInitialHazardForm = () => ({
  property_id: "",
  hazard_title: "",
  work_activity: "",
  likelihood_score: "",
  severity_score: "",
  existing_controls: "",
  additional_mitigations: "",
  action_owner: "",
  review_date: "",
});

export default function FMCompliancePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("obligations"); // "obligations" | "hazards"
  const [properties, setProperties] = useState([]);

  // Obligations state
  const [obligations, setObligations] = useState([]);
  const [obLoading, setObLoading] = useState(true);
  const [obFilterProperty, setObFilterProperty] = useState("");
  const [obFilterCategory, setObFilterCategory] = useState("");
  const [obFilterStatus, setObFilterStatus] = useState("");
  const [obFilterSearch, setObFilterSearch] = useState("");
  const [showObCreateModal, setShowObCreateModal] = useState(false);
  const [showObUpdateModal, setShowObUpdateModal] = useState(false);
  const [viewingObligation, setViewingObligation] = useState(null);
  const [selectedObligation, setSelectedObligation] = useState(null);
  const [obForm, setObForm] = useState(getInitialObligationForm());
  const [obUpdateForm, setObUpdateForm] = useState(getInitialUpdateForm());
  const [directUploadObligation, setDirectUploadObligation] = useState(null);
  const [directUploadFiles, setDirectUploadFiles] = useState([]);

  // Hazards state
  const [hazards, setHazards] = useState([]);
  const [hzLoading, setHzLoading] = useState(true);
  const [hzFilterProperty, setHzFilterProperty] = useState("");
  const [hzFilterStatus, setHzFilterStatus] = useState("");
  const [hzFilterSearch, setHzFilterSearch] = useState("");
  const [showHzCreateModal, setShowHzCreateModal] = useState(false);
  const [viewingHazard, setViewingHazard] = useState(null);
  const [hzForm, setHzForm] = useState(getInitialHazardForm());

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (activeTab === "obligations") fetchObligations();
  }, [activeTab, obFilterProperty, obFilterCategory, obFilterStatus, obFilterSearch]);

  useEffect(() => {
    if (activeTab === "hazards") fetchHazards();
  }, [activeTab, hzFilterProperty, hzFilterStatus]);

  const fetchProperties = async () => {
    try {
      const res = await api.get("/facilities/properties");
      setProperties(res.data?.data || []);
    } catch {}
  };

  const fetchObligations = useCallback(async () => {
    setObLoading(true);
    try {
      const params = new URLSearchParams();
      if (obFilterProperty) params.append("propertyId", obFilterProperty);
      if (obFilterCategory) params.append("category", obFilterCategory);
      if (obFilterStatus) params.append("status", obFilterStatus);
      if (obFilterSearch) params.append("search", obFilterSearch);
      const res = await api.get(`/facilities/compliance/obligations?${params.toString()}`);
      setObligations(res.data?.data || []);
    } catch {
      toast.error("Failed to load compliance obligations");
    } finally {
      setObLoading(false);
    }
  }, [obFilterProperty, obFilterCategory, obFilterStatus, obFilterSearch]);

  const fetchHazards = useCallback(async () => {
    setHzLoading(true);
    try {
      const params = new URLSearchParams();
      if (hzFilterProperty) params.append("propertyId", hzFilterProperty);
      if (hzFilterStatus) params.append("status", hzFilterStatus);
      if (hzFilterSearch) params.append("search", hzFilterSearch);
      const res = await api.get(`/facilities/hazards?${params.toString()}`);
      setHazards(res.data?.data || []);
    } catch {
      toast.error("Failed to load hazard assessments");
    } finally {
      setHzLoading(false);
    }
  }, [hzFilterProperty, hzFilterStatus, hzFilterSearch]);

  const handleCreateObligation = async (e) => {
    e.preventDefault();
    if (!obForm.title.trim() || !obForm.expiry_date || !obForm.category || !obForm.issuing_authority) {
      toast.warn("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/facilities/compliance/obligations", obForm);
      toast.success("Compliance obligation registered successfully!");
      setShowObCreateModal(false);
      setObForm(getInitialObligationForm());
      fetchObligations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to register obligation");
    } finally {
      setSubmitting(false);
    }
  };

  const openDirectUploadModal = (ob) => {
    setDirectUploadObligation(ob);
    let files = [];
    if (ob.attachments_json) {
      try {
        const parsed = JSON.parse(ob.attachments_json);
        if (Array.isArray(parsed) && parsed.length > 0) files = parsed;
      } catch {}
    }
    if (files.length === 0 && ob.document_url) {
      files = [{ url: ob.document_url, filename: ob.document_name || ob.document_url.split("/").pop() || "Document" }];
    }
    setDirectUploadFiles(files);
  };

  const handleSaveDirectUpload = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!directUploadObligation) return;
    setSubmitting(true);
    try {
      const docUrl = directUploadFiles.length > 0 ? directUploadFiles[0].url : "";
      const docName = directUploadFiles.length > 0 ? directUploadFiles[0].filename : "";
      const attJson = directUploadFiles.length > 0 ? JSON.stringify(directUploadFiles) : "";
      await api.put(`/facilities/compliance/obligations/${directUploadObligation.id}`, {
        document_url: docUrl,
        document_name: docName,
        attachments_json: attJson,
        document_ref: directUploadObligation.document_ref || directUploadObligation.document_reference,
      });
      toast.success("Document attached to compliance obligation successfully!");
      setDirectUploadObligation(null);
      fetchObligations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update document");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateObligation = async (e) => {
    e.preventDefault();
    if (!selectedObligation) return;
    setSubmitting(true);
    try {
      await api.put(`/facilities/compliance/obligations/${selectedObligation.id}`, obUpdateForm);
      toast.success("Compliance obligation updated");
      setShowObUpdateModal(false);
      setSelectedObligation(null);
      fetchObligations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update obligation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateHazard = async (e) => {
    e.preventDefault();
    if (!hzForm.hazard_title.trim() || !hzForm.work_activity.trim() || !hzForm.likelihood_score || !hzForm.severity_score) {
      toast.warn("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...hzForm,
        risk_rating: computeRiskRating(hzForm.likelihood_score, hzForm.severity_score),
      };
      await api.post("/facilities/hazards", payload);
      toast.success("Hazard assessment registered successfully!");
      setShowHzCreateModal(false);
      setHzForm(getInitialHazardForm());
      fetchHazards();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to register hazard");
    } finally {
      setSubmitting(false);
    }
  };

  // Obligation summary
  const obTotal = obligations.length;
  const obValid = obligations.filter((o) => o.status === "VALID").length;
  const obExpiringSoon = obligations.filter((o) => o.status === "EXPIRING_SOON").length;
  const obExpired = obligations.filter((o) => o.status === "EXPIRED").length;

  // Hazard summary
  const hzTotal = hazards.length;
  const hzCritical = hazards.filter((h) => h.risk_rating === "CRITICAL").length;
  const hzHigh = hazards.filter((h) => h.risk_rating === "HIGH").length;
  const hzActive = hazards.filter((h) => h.status === "ACTIVE").length;

  const isExpiredOrSoon = (status) => status === "EXPIRED" || status === "EXPIRING_SOON";

  const liveRating = computeRiskRating(hzForm.likelihood_score, hzForm.severity_score);

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
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Compliance Obligations &amp; Documents Register
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Statutory obligations, certifications, hazard assessments and risk management across all managed properties.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "obligations" && (
            <button
              onClick={() => {
                setObForm(getInitialObligationForm());
                setShowObCreateModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Register Obligation
            </button>
          )}
          {activeTab === "hazards" && (
            <button
              onClick={() => {
                setHzForm(getInitialHazardForm());
                setShowHzCreateModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Register Hazard
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("obligations")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "obligations"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <FileText size={14} />
          Compliance Obligations
        </button>
        <button
          onClick={() => setActiveTab("hazards")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "hazards"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <AlertTriangle size={14} />
          Hazard Assessments
        </button>
      </div>

      {/* ── OBLIGATIONS TAB ─────────────────────────────────────────────────── */}
      {activeTab === "obligations" && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total</span>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">{obTotal}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Valid</span>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">{obValid}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Expiring Soon</span>
              <div className="text-2xl font-bold font-mono text-amber-600 mt-1">{obExpiringSoon}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Expired</span>
              <div className="text-2xl font-bold font-mono text-rose-600 mt-1">{obExpired}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap gap-3 items-center">
            <select
              value={obFilterProperty}
              onChange={(e) => setObFilterProperty(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.property_name}</option>
              ))}
            </select>
            <select
              value={obFilterCategory}
              onChange={(e) => setObFilterCategory(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <option value="">All Categories</option>
              {OBLIGATION_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </select>
            <select
              value={obFilterStatus}
              onChange={(e) => setObFilterStatus(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <option value="">All Statuses</option>
              <option value="VALID">Valid</option>
              <option value="EXPIRING_SOON">Expiring Soon</option>
              <option value="EXPIRED">Expired</option>
              <option value="UNDER_RENEWAL">Under Renewal</option>
            </select>
            <input
              type="text"
              placeholder="Search title or authority..."
              value={obFilterSearch}
              onChange={(e) => setObFilterSearch(e.target.value)}
              className="flex-1 min-w-[160px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
            <button
              onClick={fetchObligations}
              className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-2 px-3"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Statutory &amp; Regulatory Obligations
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-3 py-3">Title</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Property</th>
                    <th className="px-3 py-3">Issuing Authority</th>
                    <th className="px-3 py-3">Certificate / Document</th>
                    <th className="px-3 py-3">Issue Date</th>
                    <th className="px-3 py-3">Expiry Date</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Responsible</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {obLoading ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400 italic">
                        Loading obligations...
                      </td>
                    </tr>
                  ) : obligations.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-slate-400 italic">
                        No compliance obligations found. Click &apos;+ Register Obligation&apos; to add one.
                      </td>
                    </tr>
                  ) : (
                    obligations.map((ob) => (
                      <tr key={ob.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">
                          {ob.obligation_code || `OBL-${ob.id}`}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200 max-w-[180px] truncate">
                          {ob.title}
                        </td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {ob.category?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{ob.property_name || "—"}</td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{ob.issuing_authority}</td>
                        <td className="px-3 py-3">
                          {ob.document_url ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <a
                                href={ob.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 text-[10px] font-semibold transition-colors"
                                title={ob.document_name || "View Document"}
                              >
                                <Cloud size={11} className="text-sky-500 flex-shrink-0" />
                                <span className="max-w-[110px] truncate">{ob.document_name || "View Doc"}</span>
                                <ExternalLink size={9} className="opacity-70 flex-shrink-0" />
                              </a>
                              <button
                                onClick={() => openDirectUploadModal(ob)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Update Document in Cloudinary"
                              >
                                <Upload size={11} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openDirectUploadModal(ob)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-300 text-[10px] font-medium transition-colors"
                              title="Upload Statutory Certificate or Document"
                            >
                              <Upload size={10} className="text-emerald-500" />
                              <span>Upload Doc</span>
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono">{ob.issue_date ? String(ob.issue_date).slice(0, 10) : "—"}</td>
                        <td className={`px-3 py-3 font-mono font-bold ${isExpiredOrSoon(ob.status) ? "text-rose-600" : ""}`}>
                          {ob.expiry_date ? String(ob.expiry_date).slice(0, 10) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${OBLIGATION_STATUS_COLORS[ob.status] || "bg-slate-100 text-slate-700"}`}>
                            {ob.status?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-500">{ob.responsible_person || "—"}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setViewingObligation(ob)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-semibold transition-all"
                              title="View Obligation Details"
                            >
                              <Eye size={11} /> View
                            </button>
                            <button
                              onClick={() => {
                                setSelectedObligation(ob);
                                let atts = [];
                                if (ob.attachments_json) {
                                  try {
                                    const parsed = JSON.parse(ob.attachments_json);
                                    if (Array.isArray(parsed) && parsed.length > 0) atts = parsed;
                                  } catch {}
                                }
                                if (atts.length === 0 && ob.document_url) {
                                  atts = [{ url: ob.document_url, filename: ob.document_name || ob.document_url.split("/").pop() || "Document" }];
                                }
                                setObUpdateForm({
                                  status: ob.status || "",
                                  expiry_date: ob.expiry_date ? String(ob.expiry_date).slice(0, 10) : "",
                                  document_reference: ob.document_reference || "",
                                  document_url: ob.document_url || "",
                                  document_name: ob.document_name || "",
                                  attachments: atts,
                                  attachments_json: ob.attachments_json || "",
                                  notes: ob.notes || "",
                                });
                                setShowObUpdateModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-bold transition-colors"
                            >
                              <Edit size={11} /> Edit / Update
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── HAZARDS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === "hazards" && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Hazards</span>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">{hzTotal}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Critical</span>
              <div className="text-2xl font-bold font-mono text-rose-600 mt-1">{hzCritical}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">High Risk</span>
              <div className="text-2xl font-bold font-mono text-amber-600 mt-1">{hzHigh}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Active</span>
              <div className="text-2xl font-bold font-mono text-blue-600 mt-1">{hzActive}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap gap-3 items-center">
            <select
              value={hzFilterProperty}
              onChange={(e) => setHzFilterProperty(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.property_name}</option>
              ))}
            </select>
            <select
              value={hzFilterStatus}
              onChange={(e) => setHzFilterStatus(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="MITIGATED">Mitigated</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <input
              type="text"
              placeholder="Search hazard or activity..."
              value={hzFilterSearch}
              onChange={(e) => setHzFilterSearch(e.target.value)}
              className="flex-1 min-w-[160px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
            <button
              onClick={fetchHazards}
              className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-2 px-3"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Hazard &amp; Risk Assessment Register
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Hazard Title</th>
                    <th className="px-3 py-3">Work Activity</th>
                    <th className="px-3 py-3">Property</th>
                    <th className="px-3 py-3 text-center">Likelihood</th>
                    <th className="px-3 py-3 text-center">Severity</th>
                    <th className="px-3 py-3">Risk Rating</th>
                    <th className="px-3 py-3">Action Owner</th>
                    <th className="px-3 py-3">Review Date</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {hzLoading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400 italic">
                        Loading hazard assessments...
                      </td>
                    </tr>
                  ) : hazards.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-slate-400 italic">
                        No hazard assessments found. Click &apos;+ Register Hazard&apos; to add one.
                      </td>
                    </tr>
                  ) : (
                    hazards.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white max-w-[160px] truncate">
                          {h.hazard_title}
                        </td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{h.work_activity}</td>
                        <td className="px-3 py-3 text-slate-500">{h.property_name || "—"}</td>
                        <td className="px-3 py-3 text-center font-mono font-bold">{h.likelihood_score}</td>
                        <td className="px-3 py-3 text-center font-mono font-bold">{h.severity_score}</td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${RISK_COLORS[h.risk_rating] || "bg-slate-100 text-slate-700"}`}>
                            {h.risk_rating}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-500">{h.action_owner || "—"}</td>
                        <td className="px-3 py-3 font-mono">{h.review_date ? String(h.review_date).slice(0, 10) : "—"}</td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${HAZARD_STATUS_COLORS[h.status] || "bg-slate-100 text-slate-700"}`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => setViewingHazard(h)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-semibold transition-all"
                            title="View Hazard Assessment"
                          >
                            <Eye size={11} /> View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL: Register Obligation ─────────────────────────────────────── */}
      {showObCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText size={18} className="text-emerald-500" />
                Register Compliance Obligation
              </h3>
              <button type="button" onClick={() => setShowObCreateModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleCreateObligation} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Property *</label>
                  <select
                    value={obForm.property_id}
                    onChange={(e) => setObForm({ ...obForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  >
                    <option value="">-- Select Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Category *</label>
                  <select
                    value={obForm.category}
                    onChange={(e) => setObForm({ ...obForm, category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  >
                    <option value="">-- Select Category --</option>
                    {OBLIGATION_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Annual Fire Safety Inspection Certificate"
                  value={obForm.title}
                  onChange={(e) => setObForm({ ...obForm, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Issuing Authority *</label>
                  <input
                    type="text"
                    placeholder="e.g. Ghana National Fire Service"
                    value={obForm.issuing_authority}
                    onChange={(e) => setObForm({ ...obForm, issuing_authority: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Document Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. GNFS-ACC-2026-001"
                    value={obForm.document_reference}
                    onChange={(e) => setObForm({ ...obForm, document_reference: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={obForm.issue_date}
                    onChange={(e) => setObForm({ ...obForm, issue_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    value={obForm.expiry_date}
                    onChange={(e) => setObForm({ ...obForm, expiry_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Renewal Lead Days</label>
                  <input
                    type="number"
                    min={1}
                    value={obForm.renewal_lead_days}
                    onChange={(e) => setObForm({ ...obForm, renewal_lead_days: parseInt(e.target.value) || 30 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Responsible Person</label>
                <input
                  type="text"
                  placeholder="e.g. Abena Mensah (Compliance Officer)"
                  value={obForm.responsible_person}
                  onChange={(e) => setObForm({ ...obForm, responsible_person: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                />
              </div>
              <div>
                <CloudinaryDocumentUploader
                  folder="omnisuite/facilities/compliance"
                  label="Statutory Certificate / Compliance Document (Cloudinary)"
                  value={
                    obForm.attachments && obForm.attachments.length > 0
                      ? obForm.attachments
                      : obForm.document_url
                      ? [{ url: obForm.document_url, filename: obForm.document_name || obForm.document_url.split("/").pop() || "Document" }]
                      : []
                  }
                  onChange={(files) => {
                    const first = files[0];
                    setObForm((prev) => ({
                      ...prev,
                      attachments: files,
                      document_url: first ? first.url : "",
                      document_name: first ? (first.filename || first.name || "") : "",
                      attachments_json: files.length > 0 ? JSON.stringify(files) : "",
                    }));
                  }}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional notes or renewal instructions..."
                  value={obForm.notes}
                  onChange={(e) => setObForm({ ...obForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowObCreateModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5">
                  <CheckCircle size={14} />
                  {submitting ? "Registering..." : "Register Obligation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Update Obligation ───────────────────────────────────────── */}
      {showObUpdateModal && selectedObligation && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-500" />
                Update Obligation — {selectedObligation.title}
              </h3>
              <button type="button" onClick={() => setShowObUpdateModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleUpdateObligation} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Status</label>
                <select
                  value={obUpdateForm.status}
                  onChange={(e) => setObUpdateForm({ ...obUpdateForm, status: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                >
                  <option value="">-- Select Status --</option>
                  <option value="VALID">Valid</option>
                  <option value="EXPIRING_SOON">Expiring Soon</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="UNDER_RENEWAL">Under Renewal</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={obUpdateForm.expiry_date}
                    onChange={(e) => setObUpdateForm({ ...obUpdateForm, expiry_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Document Reference</label>
                  <input
                    type="text"
                    value={obUpdateForm.document_reference}
                    onChange={(e) => setObUpdateForm({ ...obUpdateForm, document_reference: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <CloudinaryDocumentUploader
                  folder="omnisuite/facilities/compliance"
                  label="Statutory Certificate / Compliance Document (Cloudinary)"
                  value={
                    obUpdateForm.attachments && obUpdateForm.attachments.length > 0
                      ? obUpdateForm.attachments
                      : obUpdateForm.document_url
                      ? [{ url: obUpdateForm.document_url, filename: obUpdateForm.document_name || obUpdateForm.document_url.split("/").pop() || "Document" }]
                      : []
                  }
                  onChange={(files) => {
                    const first = files[0];
                    setObUpdateForm((prev) => ({
                      ...prev,
                      attachments: files,
                      document_url: first ? first.url : "",
                      document_name: first ? (first.filename || first.name || "") : "",
                      attachments_json: files.length > 0 ? JSON.stringify(files) : "",
                    }));
                  }}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={obUpdateForm.notes}
                  onChange={(e) => setObUpdateForm({ ...obUpdateForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowObUpdateModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm">
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Quick Upload Document (List Page) ────────────────────── */}
      {directUploadObligation && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Cloud size={18} className="text-sky-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Upload Statutory Document — {directUploadObligation.obligation_code || `OBL-${directUploadObligation.id}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDirectUploadObligation(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveDirectUpload} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{directUploadObligation.title}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Authority: {directUploadObligation.issuing_authority} | Property: {directUploadObligation.property_name || "—"}
                </div>
              </div>

              <div>
                <CloudinaryDocumentUploader
                  folder="omnisuite/facilities/compliance"
                  label="Statutory Certificate / File (Cloudinary)"
                  value={directUploadFiles}
                  onChange={(files) => setDirectUploadFiles(files)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setDirectUploadObligation(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle size={14} />
                  {submitting ? "Saving..." : "Save Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Register Hazard ─────────────────────────────────────────── */}
      {showHzCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                Register Hazard Assessment
              </h3>
              <button type="button" onClick={() => setShowHzCreateModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleCreateHazard} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Property *</label>
                  <select
                    value={hzForm.property_id}
                    onChange={(e) => setHzForm({ ...hzForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  >
                    <option value="">-- Select Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Hazard Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Slip hazard from wet flooring"
                    value={hzForm.hazard_title}
                    onChange={(e) => setHzForm({ ...hzForm, hazard_title: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Work Activity *</label>
                <input
                  type="text"
                  placeholder="e.g. Cleaning operations on tiled corridors"
                  value={hzForm.work_activity}
                  onChange={(e) => setHzForm({ ...hzForm, work_activity: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block font-semibold mb-1">Likelihood Score * (1–5)</label>
                  <select
                    value={hzForm.likelihood_score}
                    onChange={(e) => setHzForm({ ...hzForm, likelihood_score: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  >
                    <option value="">-- Select --</option>
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>{v} — {LIKELIHOOD_LABELS[v]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Severity Score * (1–5)</label>
                  <select
                    value={hzForm.severity_score}
                    onChange={(e) => setHzForm({ ...hzForm, severity_score: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  >
                    <option value="">-- Select --</option>
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>{v} — {SEVERITY_LABELS[v]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Computed Risk Rating</label>
                  <div className={`px-3 py-2 rounded-xl font-bold text-xs text-center border-2 ${
                    hzForm.likelihood_score && hzForm.severity_score
                      ? liveRating === "CRITICAL" ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700"
                      : liveRating === "HIGH" ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700"
                      : liveRating === "MEDIUM" ? "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-700"
                      : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700"
                      : "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700"
                  }`}>
                    {hzForm.likelihood_score && hzForm.severity_score
                      ? `${liveRating} (${Number(hzForm.likelihood_score) * Number(hzForm.severity_score)})`
                      : "Select scores above"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Existing Controls</label>
                  <textarea
                    rows={2}
                    placeholder="Current safety controls in place..."
                    value={hzForm.existing_controls}
                    onChange={(e) => setHzForm({ ...hzForm, existing_controls: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Additional Mitigations</label>
                  <textarea
                    rows={2}
                    placeholder="Further actions required to reduce risk..."
                    value={hzForm.additional_mitigations}
                    onChange={(e) => setHzForm({ ...hzForm, additional_mitigations: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Action Owner</label>
                  <input
                    type="text"
                    placeholder="e.g. Kwame Boateng (HSE Lead)"
                    value={hzForm.action_owner}
                    onChange={(e) => setHzForm({ ...hzForm, action_owner: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Review Date</label>
                  <input
                    type="date"
                    value={hzForm.review_date}
                    onChange={(e) => setHzForm({ ...hzForm, review_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowHzCreateModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  {submitting ? "Registering..." : "Register Hazard"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: View Compliance Obligation ── */}
      {viewingObligation && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Compliance Obligation — {viewingObligation.obligation_code || viewingObligation.id}
                </h3>
              </div>
              <button onClick={() => setViewingObligation(null)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Obligation Title</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{viewingObligation.title}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Category</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{viewingObligation.category?.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Property</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{viewingObligation.property_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Issuing Authority</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{viewingObligation.issuing_authority}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Issue Date</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{viewingObligation.issue_date ? String(viewingObligation.issue_date).slice(0, 10) : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Expiry Date</span>
                  <span className="font-mono font-bold text-rose-600">{viewingObligation.expiry_date ? String(viewingObligation.expiry_date).slice(0, 10) : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block mt-0.5 ${OBLIGATION_STATUS_COLORS[viewingObligation.status] || ""}`}>
                    {viewingObligation.status?.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Responsible Person</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{viewingObligation.responsible_person || "—"}</span>
                </div>
              </div>

              {viewingObligation.document_reference && (
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-0.5">Document Reference</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{viewingObligation.document_reference}</span>
                </div>
              )}

              {viewingObligation.document_url && (
                <div className="p-3 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-850 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Cloud size={18} className="text-sky-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Statutory Certificate / Cloudinary Doc</span>
                      <span className="font-semibold text-sky-800 dark:text-sky-300 text-xs truncate block max-w-xs">
                        {viewingObligation.document_name || viewingObligation.document_url.split("/").pop()}
                      </span>
                    </div>
                  </div>
                  <a
                    href={viewingObligation.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-sm flex-shrink-0 transition-colors"
                  >
                    <span>View in Cloudinary</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {viewingObligation.notes && (
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-0.5">Notes</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{viewingObligation.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => {
                    const ob = viewingObligation;
                    setViewingObligation(null);
                    setSelectedObligation(ob);
                    let atts = [];
                    if (ob.attachments_json) {
                      try {
                        const parsed = JSON.parse(ob.attachments_json);
                        if (Array.isArray(parsed) && parsed.length > 0) atts = parsed;
                      } catch {}
                    }
                    if (atts.length === 0 && ob.document_url) {
                      atts = [{ url: ob.document_url, filename: ob.document_name || ob.document_url.split("/").pop() || "Document" }];
                    }
                    setObUpdateForm({
                      status: ob.status || "",
                      expiry_date: ob.expiry_date ? String(ob.expiry_date).slice(0, 10) : "",
                      document_reference: ob.document_reference || "",
                      document_url: ob.document_url || "",
                      document_name: ob.document_name || "",
                      attachments: atts,
                      attachments_json: ob.attachments_json || "",
                      notes: ob.notes || "",
                    });
                    setShowObUpdateModal(true);
                  }}
                  className="btn btn-primary text-xs px-4 py-2"
                >
                  Edit / Update
                </button>
                <button onClick={() => setViewingObligation(null)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: View Hazard Assessment ── */}
      {viewingHazard && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Hazard Assessment — {viewingHazard.hazard_title}
                </h3>
              </div>
              <button onClick={() => setViewingHazard(null)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Work Activity</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingHazard.work_activity}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Property</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingHazard.property_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Likelihood x Severity</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{viewingHazard.likelihood_score} x {viewingHazard.severity_score}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Risk Rating</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block mt-0.5 ${RISK_COLORS[viewingHazard.risk_rating] || ""}`}>
                    {viewingHazard.risk_rating}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Action Owner</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingHazard.action_owner || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Review Date</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{viewingHazard.review_date ? String(viewingHazard.review_date).slice(0, 10) : "—"}</span>
                </div>
              </div>

              {viewingHazard.existing_controls && (
                <div>
                  <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1">Existing Controls</span>
                  <p className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {viewingHazard.existing_controls}
                  </p>
                </div>
              )}

              {viewingHazard.additional_mitigations && (
                <div>
                  <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1">Additional Mitigations Required</span>
                  <p className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-xl leading-relaxed whitespace-pre-wrap">
                    {viewingHazard.additional_mitigations}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
                <button onClick={() => setViewingHazard(null)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
