/**
 * @file QualityControlPage.jsx
 * @description Construction Quality Assurance & Quality Control (QA/QC).
 * Tracks Inspection Requests (IR), Non-Conformance Reports (NCR), Snag List, and Material Testing.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Plus,
  ArrowLeft,
  ClipboardList,
  AlertOctagon,
  CheckCircle2,
  FlaskConical,
  X,
  Search,
  RefreshCw
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ProjectModal from "../components/ProjectModal.jsx";

export default function QualityControlPage() {
  const [activeTab, setActiveTab] = useState("inspections"); // 'inspections' | 'ncrs' | 'snag' | 'tests'
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Tab data
  const [inspections, setInspections] = useState([]);
  const [ncrs, setNcrs] = useState([]);
  const [snags, setSnags] = useState([]);
  const [tests, setTests] = useState([]);

  // Modals
  const [showIRModal, setShowIRModal] = useState(false);
  const [showNCRModal, setShowNCRModal] = useState(false);
  const [showSnagModal, setShowSnagModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  // Forms
  const [irForm, setIrForm] = useState({
    inspection_title: "",
    inspection_type: "STRUCTURAL",
    location_grid: "",
    scheduled_date: new Date().toISOString().split("T")[0],
    inspector_name: "",
    remarks: "",
  });

  const [ncrForm, setNcrForm] = useState({
    issue_description: "",
    location_grid: "",
    root_cause: "",
    corrective_action: "",
    severity: "MEDIUM",
  });

  const [snagForm, setSnagForm] = useState({
    room_area: "",
    defect_description: "",
    trade_responsible: "Carpentry",
    priority: "MEDIUM",
  });

  const [testForm, setTestForm] = useState({
    test_name: "Concrete 28-Day Cube Test",
    material_type: "CONCRETE",
    batch_number: "",
    sample_date: new Date().toISOString().split("T")[0],
    required_strength: "C25/30",
    achieved_strength: "28.5 MPa",
    result: "PASS",
    lab_name: "Ghana Standards Authority",
  });

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
    fetchQAQCData();
  }, [selectedProjectId, activeTab]);

  const fetchQAQCData = async () => {
    setLoading(true);
    try {
      const params = { project_id: selectedProjectId };
      if (activeTab === "inspections") {
        const res = await api.get("/construction/inspections", { params });
        setInspections(res.data?.items || []);
      } else if (activeTab === "ncrs") {
        const res = await api.get("/construction/ncrs", { params });
        setNcrs(res.data?.items || []);
      } else if (activeTab === "snag") {
        const res = await api.get("/construction/snag-list", { params });
        setSnags(res.data?.items || []);
      } else if (activeTab === "tests") {
        const res = await api.get("/construction/material-tests", { params });
        setTests(res.data?.items || []);
      }
    } catch (e) {
      toast.error("Failed to load QA/QC records");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIR = async (e) => {
    e.preventDefault();
    try {
      await api.post("/construction/inspections", { ...irForm, project_id: selectedProjectId });
      toast.success("Inspection scheduled");
      setShowIRModal(false);
      fetchQAQCData();
    } catch (e) {
      toast.error("Failed to schedule inspection");
    }
  };

  const handleCreateNCR = async (e) => {
    e.preventDefault();
    try {
      await api.post("/construction/ncrs", { ...ncrForm, project_id: selectedProjectId });
      toast.success("Non-Conformance Report issued");
      setShowNCRModal(false);
      fetchQAQCData();
    } catch (e) {
      toast.error("Failed to issue NCR");
    }
  };

  const handleCreateSnag = async (e) => {
    e.preventDefault();
    try {
      await api.post("/construction/snag-list", { ...snagForm, project_id: selectedProjectId });
      toast.success("Snag defect recorded");
      setShowSnagModal(false);
      fetchQAQCData();
    } catch (e) {
      toast.error("Failed to record snag item");
    }
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    try {
      await api.post("/construction/material-tests", { ...testForm, project_id: selectedProjectId });
      toast.success("Material test result recorded");
      setShowTestModal(false);
      fetchQAQCData();
    } catch (e) {
      toast.error("Failed to record test result");
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
              <ShieldCheck size={24} className="text-brand-900 dark:text-brand-400" /> Quality Assurance & Control (QA/QC)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Inspection requests (RFI/IR), Non-Conformance Reports (NCR), Snag lists, and Material testing
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
              placeholder="Search QA/QC..."
              className="input pl-9 pr-3 py-1.5 text-sm h-auto w-48"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchQAQCData}
            className="btn btn-secondary p-2"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          {activeTab === "inspections" && (
            <button onClick={() => setShowIRModal(true)} className="btn btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> Schedule Inspection
            </button>
          )}
          {activeTab === "ncrs" && (
            <button onClick={() => setShowNCRModal(true)} className="btn btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> Issue NCR
            </button>
          )}
          {activeTab === "snag" && (
            <button onClick={() => setShowSnagModal(true)} className="btn btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> Add Snag
            </button>
          )}
          {activeTab === "tests" && (
            <button onClick={() => setShowTestModal(true)} className="btn btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> Log Material Test
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {[
          { key: "inspections", label: "Inspection Requests (IR)", icon: <ClipboardList size={16} /> },
          { key: "ncrs", label: "Non-Conformance Reports (NCR)", icon: <AlertOctagon size={16} /> },
          { key: "snag", label: "Snag & Punch List", icon: <CheckCircle2 size={16} /> },
          { key: "tests", label: "Material Test Certificates", icon: <FlaskConical size={16} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === tab.key
                ? "border-brand-600 text-brand-600 dark:text-brand-300"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Inspection Requests */}
      {activeTab === "inspections" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 uppercase font-bold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3">IR Number</th>
                <th className="p-3">Title of Inspection</th>
                <th className="p-3">Discipline</th>
                <th className="p-3">Location / Grid</th>
                <th className="p-3">Date</th>
                <th className="p-3">Inspector</th>
                <th className="p-3 text-center">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">No inspection requests recorded.</td>
                </tr>
              ) : (
                inspections.map(ir => (
                  <tr key={ir.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-brand-600">{ir.ir_number}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{ir.inspection_title}</td>
                    <td className="p-3 uppercase text-[10px] font-bold text-slate-500">{ir.inspection_type}</td>
                    <td className="p-3">{ir.location_grid || "-"}</td>
                    <td className="p-3 font-mono">{ir.scheduled_date ? ir.scheduled_date.split("T")[0] : "-"}</td>
                    <td className="p-3">{ir.inspector_name || "Consultant"}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        ir.result === "PASSED" ? "bg-emerald-100 text-emerald-700" : ir.result === "REJECTED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {ir.result}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* TAB 2: NCRs */}
      {activeTab === "ncrs" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 uppercase font-bold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3">NCR #</th>
                <th className="p-3">Defect / Non-Conformance Description</th>
                <th className="p-3">Location</th>
                <th className="p-3">Root Cause</th>
                <th className="p-3">Severity</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {ncrs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 italic">No non-conformance reports registered. High compliance!</td>
                </tr>
              ) : (
                ncrs.map(n => (
                  <tr key={n.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-rose-600">{n.ncr_number}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{n.issue_description}</td>
                    <td className="p-3">{n.location_grid || "-"}</td>
                    <td className="p-3 text-slate-500">{n.root_cause || "-"}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800">
                        {n.severity}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        n.status === "CLOSED" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}>
                        {n.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* TAB 3: Snag List */}
      {activeTab === "snag" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 uppercase font-bold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3">Area / Room</th>
                <th className="p-3">Defect Description</th>
                <th className="p-3">Trade Responsible</th>
                <th className="p-3">Priority</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {snags.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">No snag defects recorded.</td>
                </tr>
              ) : (
                snags.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold">{s.room_area || "General Area"}</td>
                    <td className="p-3 text-slate-800 dark:text-slate-200">{s.defect_description}</td>
                    <td className="p-3">{s.trade_responsible}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100">
                        {s.priority}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        s.status === "VERIFIED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* TAB 4: Material Tests */}
      {activeTab === "tests" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 uppercase font-bold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3">Test Name</th>
                <th className="p-3">Material</th>
                <th className="p-3">Batch #</th>
                <th className="p-3">Test Date</th>
                <th className="p-3">Target Strength</th>
                <th className="p-3">Achieved Strength</th>
                <th className="p-3 text-center">Result</th>
                <th className="p-3">Laboratory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {tests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">No material testing records found.</td>
                </tr>
              ) : (
                tests.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-brand-600">{t.test_name}</td>
                    <td className="p-3 uppercase text-[10px] font-bold text-slate-500">{t.material_type}</td>
                    <td className="p-3 font-mono">{t.batch_number || "-"}</td>
                    <td className="p-3 font-mono">{t.test_date ? t.test_date.split("T")[0] : "-"}</td>
                    <td className="p-3 font-mono">{t.required_strength || "-"}</td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{t.achieved_strength || "-"}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        t.result === "PASS" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}>
                        {t.result}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{t.lab_name || "Internal Lab"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal: Schedule IR */}
      <ProjectModal
        open={showIRModal}
        onClose={() => setShowIRModal(false)}
        title="Schedule Inspection Request (IR)"
        subtitle="Submit work inspection request for consultant / QA-QC verification"
        icon={ClipboardList}
        onSubmit={handleCreateIR}
        submitLabel="Submit IR"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Inspection Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              placeholder="e.g. Pre-pour inspection for first floor slab"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={irForm.inspection_title}
              onChange={e => setIrForm({ ...irForm, inspection_title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Discipline</label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={irForm.inspection_type}
                onChange={e => setIrForm({ ...irForm, inspection_type: e.target.value })}
              >
                <option value="STRUCTURAL">Structural</option>
                <option value="ARCHITECTURAL">Architectural</option>
                <option value="MEP">MEP</option>
                <option value="GEOTECHNICAL">Geotechnical</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Grid / Level Location</label>
              <input
                type="text"
                placeholder="e.g. Grid A-D / L2"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={irForm.location_grid}
                onChange={e => setIrForm({ ...irForm, location_grid: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Scheduled Date & Time <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={irForm.scheduled_at}
                onChange={e => setIrForm({ ...irForm, scheduled_at: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Lead Inspector / QA Engineer</label>
              <input
                type="text"
                placeholder="Name of inspector"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={irForm.inspector_name}
                onChange={e => setIrForm({ ...irForm, inspector_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Inspection Notes / Scope</label>
            <textarea
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[70px]"
              placeholder="Specific items to check, drawing references, tolerance standards..."
              value={irForm.remarks}
              onChange={e => setIrForm({ ...irForm, remarks: e.target.value })}
            />
          </div>
        </div>
      </ProjectModal>

            {/* Modal: Issue NCR */}
      <ProjectModal
        open={showNCRModal}
        onClose={() => setShowNCRModal(false)}
        title="Issue Non-Conformance Report (NCR)"
        subtitle="Record quality defect, standard deviation, and required corrective actions"
        icon={AlertOctagon}
        onSubmit={handleCreateNCR}
        submitLabel="Issue NCR"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Defect / Issue Description <span className="text-red-500">*</span></label>
            <textarea
              required
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[70px]"
              placeholder="Describe deviation from spec or drawings..."
              value={ncrForm.description}
              onChange={e => setNcrForm({ ...ncrForm, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Discipline</label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={ncrForm.discipline}
                onChange={e => setNcrForm({ ...ncrForm, discipline: e.target.value })}
              >
                <option value="STRUCTURAL">Structural</option>
                <option value="ARCHITECTURAL">Architectural</option>
                <option value="MEP">MEP</option>
                <option value="CIVIL">Civil</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Severity Level</label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={ncrForm.severity}
                onChange={e => setNcrForm({ ...ncrForm, severity: e.target.value })}
              >
                <option value="MINOR">Minor - Touch up / superficial</option>
                <option value="MAJOR">Major - Rework required</option>
                <option value="CRITICAL">Critical - Structural / safety concern</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Root Cause Analysis</label>
            <input
              type="text"
              placeholder="e.g. Inadequate formwork support"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={ncrForm.root_cause}
              onChange={e => setNcrForm({ ...ncrForm, root_cause: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Proposed Corrective & Preventive Action (CAPA)</label>
            <textarea
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[70px]"
              placeholder="Action plan to remediate and prevent reoccurrence..."
              value={ncrForm.corrective_action}
              onChange={e => setNcrForm({ ...ncrForm, corrective_action: e.target.value })}
            />
          </div>
        </div>
      </ProjectModal>

            {/* Modal: Add Snag */}
      <ProjectModal
        open={showSnagModal}
        onClose={() => setShowSnagModal(false)}
        title="Log Snag Item"
        subtitle="Log punch list defect, rectification trade, and completion priority"
        icon={CheckCircle2}
        onSubmit={handleCreateSnag}
        submitLabel="Log Snag Item"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Room / Area <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="e.g. Master Bedroom / North Corridor"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={snagForm.location}
                onChange={e => setSnagForm({ ...snagForm, location: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Responsible Trade</label>
              <input
                type="text"
                placeholder="e.g. Painter / Joinery / Electrician"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={snagForm.trade}
                onChange={e => setSnagForm({ ...snagForm, trade: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Defect Description <span className="text-red-500">*</span></label>
            <textarea
              required
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[70px]"
              placeholder="e.g. Paint blister on east wall; skirting gap near balcony"
              value={snagForm.description}
              onChange={e => setSnagForm({ ...snagForm, description: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Priority</label>
            <select
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={snagForm.priority}
              onChange={e => setSnagForm({ ...snagForm, priority: e.target.value })}
            >
              <option value="LOW">Low - Cosmetic / non-urgent</option>
              <option value="MEDIUM">Medium - Rectify before handover</option>
              <option value="HIGH">High - Immediate attention</option>
            </select>
          </div>
        </div>
      </ProjectModal>

            {/* Modal: Material Test */}
      <ProjectModal
        open={showTestModal}
        onClose={() => setShowTestModal(false)}
        title="Log Material Test Record"
        subtitle="Record laboratory test results, sample references, and compliance status"
        icon={FlaskConical}
        onSubmit={handleCreateTest}
        submitLabel="Save Test Record"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Test Title / Standard <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="e.g. Concrete 28-day Cube Compressive Test"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={testForm.test_type}
                onChange={e => setTestForm({ ...testForm, test_type: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Sample Batch Ref <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="e.g. BATCH-SLAB-L3"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={testForm.sample_reference}
                onChange={e => setTestForm({ ...testForm, sample_reference: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Required Specification</label>
              <input
                type="text"
                placeholder="e.g. >= 25 N/mm²"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={testForm.spec_requirement}
                onChange={e => setTestForm({ ...testForm, spec_requirement: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Actual Measured Value</label>
              <input
                type="text"
                placeholder="e.g. 28.4 N/mm²"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                value={testForm.result_value}
                onChange={e => setTestForm({ ...testForm, result_value: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Pass / Fail Compliance</label>
            <select
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={testForm.status}
              onChange={e => setTestForm({ ...testForm, status: e.target.value })}
            >
              <option value="PASS">PASS - Meets design specifications</option>
              <option value="FAIL">FAIL - Out of specification tolerance</option>
              <option value="PENDING">PENDING - Awaiting lab report</option>
            </select>
          </div>
        </div>
      </ProjectModal>    </div>
  );
}
