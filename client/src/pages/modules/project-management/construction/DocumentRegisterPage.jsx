/**
 * @file DocumentRegisterPage.jsx
 * @description Technical Drawing Register and Requests for Information (RFI) workflow.
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
  RefreshCw
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

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
  });

  const [rfiForm, setRfiForm] = useState({
    rfi_number: "",
    subject: "",
    question: "",
    drawing_reference: "",
    due_date: "",
    cost_impact: "N",
    schedule_impact: "N",
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
    try {
      await api.post("/construction/documents", {
        ...docForm,
        project_id: selectedProjectId,
      });
      toast.success("Document registered");
      setShowDocModal(false);
      fetchRecords();
    } catch (e) {
      toast.error("Failed to register document");
    }
  };

  const handleCreateRFI = async (e) => {
    e.preventDefault();
    try {
      await api.post("/construction/rfis", {
        ...rfiForm,
        project_id: selectedProjectId,
      });
      toast.success("RFI raised");
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
                setDocForm(f => ({ ...f, document_number: `DWG-${Date.now().toString().slice(-4)}` }));
                setShowDocModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus size={16} /> Register Drawing
            </button>
          ) : (
            <button
              onClick={() => {
                setRfiForm(f => ({ ...f, rfi_number: `RFI-${Date.now().toString().slice(-4)}` }));
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

      {/* TAB 1: Documents */}
      {activeTab === "documents" && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 font-bold uppercase text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3">Drawing #</th>
                <th className="p-3">Title</th>
                <th className="p-3">Discipline</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-center">Rev</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                    No drawings registered for this project yet. Click "Register Drawing" to log drawing sheets.
                  </td>
                </tr>
              ) : (
                documents.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-brand-600">{d.document_number}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{d.title}</td>
                    <td className="p-3 uppercase text-[10px] font-bold text-slate-500">{d.discipline}</td>
                    <td className="p-3 uppercase text-[10px] text-slate-500">{d.category}</td>
                    <td className="p-3 text-center font-mono font-bold">Rev {d.current_revision}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        d.status === "APPROVED_FOR_CONSTRUCTION" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {d.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {d.file_url ? (
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-800 inline-block">
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: RFIs */}
      {activeTab === "rfis" && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 font-bold uppercase text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3">RFI #</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Clarification Question</th>
                <th className="p-3">Drawing Ref</th>
                <th className="p-3 text-center">Cost Impact</th>
                <th className="p-3 text-center">Schedule Impact</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {rfis.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                    No requests for information raised. Click "Raise RFI" to submit a question to the design team.
                  </td>
                </tr>
              ) : (
                rfis.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-brand-600">{r.rfi_number}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{r.subject}</td>
                    <td className="p-3">
                      <div className="text-slate-700 dark:text-slate-300">{r.question}</div>
                      {r.answer && (
                        <div className="mt-1 p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded text-[11px] text-emerald-800 dark:text-emerald-300 border-l-2 border-emerald-500">
                          <span className="font-bold">Consultant Response: </span>{r.answer}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono">{r.drawing_reference || "-"}</td>
                    <td className="p-3 text-center font-bold text-[10px]">
                      {r.cost_impact === "Y" ? <span className="text-rose-600">YES</span> : <span className="text-slate-400">NO</span>}
                    </td>
                    <td className="p-3 text-center font-bold text-[10px]">
                      {r.schedule_impact === "Y" ? <span className="text-rose-600">YES</span> : <span className="text-slate-400">NO</span>}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        r.status === "CLOSED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {r.status !== "CLOSED" && (
                        <button
                          onClick={() => {
                            setActiveRFIForAnswer(r);
                            setAnswerText(r.answer || "");
                          }}
                          className="btn btn-secondary text-[10px] py-1 px-2.5 rounded font-bold"
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
      )}

      {/* Modal: Register Drawing */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <FileCode size={18} className="text-brand-600" /> Register Technical Drawing
              </h3>
              <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateDocument} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Drawing Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AR-101-PLN"
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                  value={docForm.document_number}
                  onChange={e => setDocForm({ ...docForm, document_number: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Drawing Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Floor GA Layout"
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  value={docForm.title}
                  onChange={e => setDocForm({ ...docForm, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Discipline</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
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
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Revision No.</label>
                  <input
                    type="text"
                    required
                    placeholder="0"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={docForm.current_revision}
                    onChange={e => setDocForm({ ...docForm, current_revision: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">File URL / Storage Link</label>
                <input
                  type="text"
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  value={docForm.file_url}
                  onChange={e => setDocForm({ ...docForm, file_url: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowDocModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Save Drawing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Raise RFI */}
      {showRFIModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle size={18} className="text-brand-600" /> Raise Request for Information (RFI)
              </h3>
              <button onClick={() => setShowRFIModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateRFI} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">RFI Number</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={rfiForm.rfi_number}
                    onChange={e => setRfiForm({ ...rfiForm, rfi_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Drawing Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. ST-201 / Detail 4"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                    value={rfiForm.drawing_reference}
                    onChange={e => setRfiForm({ ...rfiForm, drawing_reference: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Beam rebar clash with HVAC duct at Grid 3"
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  value={rfiForm.subject}
                  onChange={e => setRfiForm({ ...rfiForm, subject: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Clarification Question</label>
                <textarea
                  required
                  placeholder="State technical conflict and requested consultant direction..."
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 min-h-[80px]"
                  value={rfiForm.question}
                  onChange={e => setRfiForm({ ...rfiForm, question: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Potential Cost Impact?</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                    value={rfiForm.cost_impact}
                    onChange={e => setRfiForm({ ...rfiForm, cost_impact: e.target.value })}
                  >
                    <option value="N">No Cost Impact</option>
                    <option value="Y">Yes (Potential Variation)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Schedule Impact?</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                    value={rfiForm.schedule_impact}
                    onChange={e => setRfiForm({ ...rfiForm, schedule_impact: e.target.value })}
                  >
                    <option value="N">No Delay</option>
                    <option value="Y">Critical Path Delay</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowRFIModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Submit RFI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Answer RFI */}
      {activeRFIForAnswer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare size={18} className="text-emerald-600" /> Respond to {activeRFIForAnswer.rfi_number}
              </h3>
              <button onClick={() => setActiveRFIForAnswer(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAnswerRFI} className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">{activeRFIForAnswer.subject}</p>
                <p className="text-slate-600 dark:text-slate-300">{activeRFIForAnswer.question}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Consultant / Engineer Determination</label>
                <textarea
                  required
                  placeholder="Official technical instructions, resolution, revised specification..."
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 min-h-[90px]"
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setActiveRFIForAnswer(null)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Save Response & Close RFI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
