/**
 * @file DocumentRegisterPage.jsx
 * @description Technical Drawing Register and Requests for Information (RFI) workflow.
 * Fully integrated with Cloudinary for document uploads, featuring intelligent previous-file
 * detection with Keep vs Discard options.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Plus,
  ArrowLeft,
  FileCode,
  HelpCircle,
  CheckCircle,
  Clock,
  X,
  ExternalLink,
  MessageSquare,
  Search,
  RefreshCw,
  Cloud,
  Paperclip
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ProjectModal from "../components/ProjectModal.jsx";
import CloudinaryDocumentUploader from "../components/CloudinaryDocumentUploader.jsx";

export default function DocumentRegisterPage() {
  const [activeTab, setActiveTab] = useState("documents"); // 'documents' | 'rfis'
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [documents, setDocuments] = useState([]);
  const [rfis, setRfis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showDocModal, setShowDocModal] = useState(false);
  const [showRFIModal, setShowRFIModal] = useState(false);
  const [activeRFIForAnswer, setActiveRFIForAnswer] = useState(null);

  const [docForm, setDocForm] = useState({
    document_number: "",
    title: "",
    discipline: "ARCHITECTURAL",
    category: "DRAWING",
    current_revision: "0",
    status: "APPROVED_FOR_CONSTRUCTION",
    file_url: "",
    attachments: [],
    attachments_json: null,
  });

  const [rfiForm, setRfiForm] = useState({
    rfi_number: "",
    subject: "",
    question: "",
    drawing_reference: "",
    due_date: "",
    cost_impact: "N",
    schedule_impact: "N",
    file_url: "",
    attachments: [],
    attachments_json: null,
  });

  const [answerText, setAnswerText] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
        if (prjs.length > 0) setSelectedProjectId(String(prjs[0].id));
      } catch (e) {
        toast.error("Failed to load projects");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchRecords();
  }, [selectedProjectId, activeTab]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = { project_id: selectedProjectId };
      if (activeTab === "documents") {
        const res = await api.get("/construction/documents", { params });
        setDocuments(res.data?.items || []);
      } else {
        const res = await api.get("/construction/rfis", { params });
        setRfis(res.data?.items || []);
      }
    } catch (e) {
      toast.error("Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }
    try {
      await api.post("/construction/documents", {
        ...docForm,
        project_id: selectedProjectId,
      });
      toast.success("Document registered in drawing register");
      setShowDocModal(false);
      fetchRecords();
    } catch (e) {
      toast.error("Failed to register document");
    }
  };

  const handleCreateRFI = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }
    try {
      await api.post("/construction/rfis", {
        ...rfiForm,
        project_id: selectedProjectId,
      });
      toast.success("RFI raised successfully");
      setShowRFIModal(false);
      fetchRecords();
    } catch (e) {
      toast.error("Failed to raise RFI");
    }
  };

  const handleAnswerRFI = async (e) => {
    e.preventDefault();
    if (!activeRFIForAnswer) return;
    try {
      await api.put(`/construction/rfis/${activeRFIForAnswer.id}`, {
        answer: answerText,
        status: "CLOSED",
      });
      toast.success("RFI resolved and closed");
      setActiveRFIForAnswer(null);
      setAnswerText("");
      fetchRecords();
    } catch (e) {
      toast.error("Failed to answer RFI");
    }
  };

  return (
    <div className="space-y-6">
      {/* Canonical List Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileCode size={24} className="text-brand-900 dark:text-brand-400" /> Drawing Register & RFIs
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Approved-for-construction drawing control, revision history, and technical requests for information
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input text-sm py-1.5 h-auto min-w-[180px]"
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_code} - {p.project_name}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search drawings & RFIs..."
              className="input pl-9 pr-3 py-1.5 text-sm h-auto w-48"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchRecords}
            className="btn btn-secondary p-2"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          {activeTab === "documents" ? (
            <button
              onClick={() => {
                setDocForm({
                  document_number: `DWG-${Date.now().toString().slice(-4)}`,
                  title: "",
                  discipline: "ARCHITECTURAL",
                  category: "DRAWING",
                  current_revision: "0",
                  status: "APPROVED_FOR_CONSTRUCTION",
                  file_url: "",
                  attachments: [],
                  attachments_json: null,
                });
                setShowDocModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus size={16} /> Register Drawing
            </button>
          ) : (
            <button
              onClick={() => {
                setRfiForm({
                  rfi_number: `RFI-${Date.now().toString().slice(-4)}`,
                  subject: "",
                  question: "",
                  drawing_reference: "",
                  due_date: "",
                  cost_impact: "N",
                  schedule_impact: "N",
                  file_url: "",
                  attachments: [],
                  attachments_json: null,
                });
                setShowRFIModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus size={16} /> Raise RFI
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === "documents"
              ? "border-brand-600 text-brand-600 dark:text-brand-300"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileCode size={16} />
          Drawing Register ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab("rfis")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === "rfis"
              ? "border-brand-600 text-brand-600 dark:text-brand-300"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <HelpCircle size={16} />
          Requests for Information (RFIs) ({rfis.length})
        </button>
      </div>

      {/* TAB 1: Documents / Drawings */}
      {activeTab === "documents" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Drawing #</th>
                  <th>Title</th>
                  <th>Discipline</th>
                  <th>Category</th>
                  <th className="text-center">Revision</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Cloudinary File</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      No drawings or documents uploaded for this project yet. Click "Register Drawing" to upload files to Cloudinary.
                    </td>
                  </tr>
                ) : (
                  documents.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="font-mono font-bold text-xs text-brand-900 dark:text-brand-400">
                        {d.document_number || d.doc_number}
                      </td>
                      <td className="font-bold text-xs text-slate-900 dark:text-white">{d.title}</td>
                      <td className="uppercase text-[10px] font-bold text-slate-500">{d.discipline || d.doc_category}</td>
                      <td className="uppercase text-[10px] text-slate-500">{d.category || d.doc_category}</td>
                      <td className="text-center font-mono font-bold text-xs">Rev {d.current_revision}</td>
                      <td className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          d.status === "APPROVED_FOR_CONSTRUCTION"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        }`}>
                          {d.status?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="text-center">
                        {d.file_url ? (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800 transition"
                            title="Open Cloudinary file"
                          >
                            <Cloud size={13} className="text-sky-500" /> View <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RFIs */}
      {activeTab === "rfis" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>RFI #</th>
                  <th>Subject</th>
                  <th>Clarification Question</th>
                  <th>Drawing Ref</th>
                  <th>Cloudinary File</th>
                  <th className="text-center">Cost Impact</th>
                  <th className="text-center">Schedule Impact</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {rfis.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                      No requests for information raised. Click "Raise RFI" to submit a question to the design team.
                    </td>
                  </tr>
                ) : (
                  rfis.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="font-mono font-bold text-xs text-brand-900 dark:text-brand-400 whitespace-nowrap">
                        {r.rfi_number || r.rfi_no}
                      </td>
                      <td className="font-bold text-xs text-slate-900 dark:text-white max-w-[180px] truncate" title={r.subject}>
                        {r.subject}
                      </td>
                      <td className="text-xs max-w-[260px]">
                        <div className="text-slate-700 dark:text-slate-300 line-clamp-2">{r.question}</div>
                        {r.answer && (
                          <div className="mt-1 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded text-[11px] text-emerald-800 dark:text-emerald-300 border-l-2 border-emerald-500">
                            <span className="font-bold">Consultant Response: </span>{r.answer}
                          </div>
                        )}
                      </td>
                      <td className="font-mono text-xs">{r.drawing_reference || r.drawing_ref || "-"}</td>
                      <td>
                        {r.file_url ? (
                          <a
                            href={r.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:underline"
                            title="View Cloudinary document"
                          >
                            <Cloud size={11} className="text-sky-500" />
                            <span>Attachment</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="text-center font-bold text-[10px]">
                        {r.cost_impact === "Y" ? (
                          <span className="text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">YES</span>
                        ) : (
                          <span className="text-slate-400">NO</span>
                        )}
                      </td>
                      <td className="text-center font-bold text-[10px]">
                        {r.schedule_impact === "Y" ? (
                          <span className="text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">YES</span>
                        ) : (
                          <span className="text-slate-400">NO</span>
                        )}
                      </td>
                      <td className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          r.status === "CLOSED"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="text-center">
                        {r.status !== "CLOSED" && (
                          <button
                            onClick={() => {
                              setActiveRFIForAnswer(r);
                              setAnswerText(r.answer || "");
                            }}
                            className="btn btn-secondary text-[11px] py-1 px-2.5 rounded font-bold"
                          >
                            Respond
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Register Drawing */}
      <ProjectModal
        open={showDocModal}
        onClose={() => setShowDocModal(false)}
        title="Register Technical Drawing"
        subtitle="Catalog approved-for-construction drawing, revision tag, and Cloudinary storage link"
        icon={FileCode}
        onSubmit={handleCreateDocument}
        submitLabel="Register Drawing"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Drawing Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. AR-101-PLN"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={docForm.document_number}
                onChange={e => setDocForm({ ...docForm, document_number: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Revision No. <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="0"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={docForm.current_revision}
                onChange={e => setDocForm({ ...docForm, current_revision: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Drawing Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ground Floor GA Layout"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={docForm.title}
              onChange={e => setDocForm({ ...docForm, title: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Discipline <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={docForm.discipline}
              onChange={e => setDocForm({ ...docForm, discipline: e.target.value })}
            >
              <option value="ARCHITECTURAL">Architectural</option>
              <option value="STRUCTURAL">Structural</option>
              <option value="ELECTRICAL">Electrical</option>
              <option value="MECHANICAL">Mechanical / HVAC</option>
              <option value="PLUMBING">Plumbing & Drainage</option>
              <option value="CIVIL">Civil Infrastructure</option>
              <option value="AS_BUILT">As-Built Record</option>
            </select>
          </div>

          {/* Cloudinary Document Uploader Component */}
          <div>
            <CloudinaryDocumentUploader
              value={docForm.attachments || (docForm.file_url ? [{ url: docForm.file_url, filename: docForm.file_url.split("/").pop() }] : [])}
              onChange={(files) => {
                setDocForm({
                  ...docForm,
                  attachments: files,
                  file_url: files.length > 0 ? files[0].url : "",
                  attachments_json: JSON.stringify(files),
                });
              }}
              folder="omnisuite/construction/drawings"
              label="Drawing & CAD Files (Cloudinary)"
              description="Upload PDF, DWG, DXF, PNG, JPG directly to Cloudinary (Max 50MB)"
            />
          </div>
        </div>
      </ProjectModal>

      {/* Modal: Raise RFI */}
      <ProjectModal
        open={showRFIModal}
        onClose={() => setShowRFIModal(false)}
        title="Raise Request for Information (RFI)"
        subtitle="Submit technical query, attach clash evidence to Cloudinary, and request consultant direction"
        icon={HelpCircle}
        onSubmit={handleCreateRFI}
        submitLabel="Submit RFI"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                RFI Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={rfiForm.rfi_number}
                onChange={e => setRfiForm({ ...rfiForm, rfi_number: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Drawing Ref
              </label>
              <input
                type="text"
                placeholder="e.g. ST-201 / Detail 4"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={rfiForm.drawing_reference}
                onChange={e => setRfiForm({ ...rfiForm, drawing_reference: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Beam rebar clash with HVAC duct at Grid 3"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={rfiForm.subject}
              onChange={e => setRfiForm({ ...rfiForm, subject: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Clarification Question <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              placeholder="State technical conflict and requested consultant direction..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[90px]"
              value={rfiForm.question}
              onChange={e => setRfiForm({ ...rfiForm, question: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Potential Cost Impact?
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={rfiForm.cost_impact}
                onChange={e => setRfiForm({ ...rfiForm, cost_impact: e.target.value })}
              >
                <option value="N">No Cost Impact</option>
                <option value="Y">Yes (Potential Variation)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Schedule Impact?
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={rfiForm.schedule_impact}
                onChange={e => setRfiForm({ ...rfiForm, schedule_impact: e.target.value })}
              >
                <option value="N">No Delay</option>
                <option value="Y">Critical Path Delay</option>
              </select>
            </div>
          </div>

          {/* Cloudinary Document Uploader Component for RFI */}
          <div>
            <CloudinaryDocumentUploader
              value={rfiForm.attachments || (rfiForm.file_url ? [{ url: rfiForm.file_url, filename: rfiForm.file_url.split("/").pop() }] : [])}
              onChange={(files) => {
                setRfiForm({
                  ...rfiForm,
                  attachments: files,
                  file_url: files.length > 0 ? files[0].url : "",
                  attachments_json: JSON.stringify(files),
                });
              }}
              folder="omnisuite/construction/rfis"
              label="Supporting Documents & Evidence (Cloudinary)"
              description="Upload clash photo, sketch, markup, or specification (Max 50MB)"
            />
          </div>
        </div>
      </ProjectModal>

      {/* Modal: Answer RFI */}
      <ProjectModal
        open={Boolean(activeRFIForAnswer)}
        onClose={() => setActiveRFIForAnswer(null)}
        title={activeRFIForAnswer ? `Respond to ${activeRFIForAnswer.rfi_number || activeRFIForAnswer.rfi_no}` : "Respond to RFI"}
        subtitle="Record official consultant or engineer determination and close RFI"
        icon={MessageSquare}
        onSubmit={handleAnswerRFI}
        submitLabel="Save Response & Close RFI"
      >
        <div className="space-y-4">
          {activeRFIForAnswer && (
            <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs space-y-2">
              <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-brand-600 font-mono">{activeRFIForAnswer.rfi_number || activeRFIForAnswer.rfi_no}</span> - {activeRFIForAnswer.subject}
              </p>
              <p className="text-slate-600 dark:text-slate-300">{activeRFIForAnswer.question}</p>

              {activeRFIForAnswer.file_url && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">Supporting Document:</span>
                  <a
                    href={activeRFIForAnswer.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100"
                  >
                    <Cloud size={13} className="text-sky-500" /> View in Cloudinary <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Consultant / Engineer Determination <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              placeholder="Official technical instructions, resolution, revised specification..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[110px]"
              value={answerText}
              onChange={e => setAnswerText(e.target.value)}
            />
          </div>
        </div>
      </ProjectModal>
    </div>
  );
}
