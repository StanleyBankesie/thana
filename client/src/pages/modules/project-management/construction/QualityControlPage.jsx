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
      )}

      {/* TAB 2: NCRs */}
      {activeTab === "ncrs" && (
        <div className="card overflow-hidden">
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
      )}

      {/* TAB 3: Snag List */}
      {activeTab === "snag" && (
        <div className="card overflow-hidden">
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
      )}

      {/* TAB 4: Material Tests */}
      {activeTab === "tests" && (
        <div className="card overflow-hidden">
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
      )}

      {/* Modal: Schedule IR */}
      {showIRModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList size={18} className="text-brand-600" /> Schedule Inspection Request (IR)
              </h3>
              <button onClick={() => setShowIRModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateIR} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Inspection Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pre-pour inspection for first floor slab"
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                  value={irForm.inspection_title}
                  onChange={e => setIrForm({ ...irForm, inspection_title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Discipline</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={irForm.inspection_type}
                    onChange={e => setIrForm({ ...irForm, inspection_type: e.target.value })}
                  >
                    <option value="STRUCTURAL">Structural</option>
                    <option value="ARCHITECTURAL">Architectural</option>
                    <option value="MEP">MEP</option>
                    <option value="GEOTECHNICAL">Geotechnical</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Location / Grid</label>
                  <input
                    type="text"
                    placeholder="Grid 1-5 / Level 2"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={irForm.location_grid}
                    onChange={e => setIrForm({ ...irForm, location_grid: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Inspection Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={irForm.scheduled_date}
                    onChange={e => setIrForm({ ...irForm, scheduled_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Inspector</label>
                  <input
                    type="text"
                    placeholder="Consultant Engineer"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={irForm.inspector_name}
                    onChange={e => setIrForm({ ...irForm, inspector_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowIRModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Schedule IR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Issue NCR */}
      {showNCRModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <AlertOctagon size={18} className="text-rose-600" /> Issue Non-Conformance Report (NCR)
              </h3>
              <button onClick={() => setShowNCRModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateNCR} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Defect / Issue Description</label>
                <textarea
                  required
                  placeholder="Describe the non-conforming work..."
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 min-h-[70px]"
                  value={ncrForm.issue_description}
                  onChange={e => setNcrForm({ ...ncrForm, issue_description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Location / Grid</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={ncrForm.location_grid}
                    onChange={e => setNcrForm({ ...ncrForm, location_grid: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Severity</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={ncrForm.severity}
                    onChange={e => setNcrForm({ ...ncrForm, severity: e.target.value })}
                  >
                    <option value="LOW">Minor</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="CRITICAL">Critical Structural Defect</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Required Corrective Action</label>
                <textarea
                  placeholder="Remedial action plan to rectify..."
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 min-h-[60px]"
                  value={ncrForm.corrective_action}
                  onChange={e => setNcrForm({ ...ncrForm, corrective_action: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowNCRModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Issue NCR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Snag */}
      {showSnagModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-brand-600" /> Log Snag Item
              </h3>
              <button onClick={() => setShowSnagModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSnag} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Room / Area</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unit 302 / Master Bathroom"
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                  value={snagForm.room_area}
                  onChange={e => setSnagForm({ ...snagForm, room_area: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Defect Description</label>
                <textarea
                  required
                  placeholder="e.g. Uneven tiling joint next to shower drain"
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 min-h-[60px]"
                  value={snagForm.defect_description}
                  onChange={e => setSnagForm({ ...snagForm, defect_description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Responsible Trade</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={snagForm.trade_responsible}
                    onChange={e => setSnagForm({ ...snagForm, trade_responsible: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Priority</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={snagForm.priority}
                    onChange={e => setSnagForm({ ...snagForm, priority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowSnagModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Save Snag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Material Test */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <FlaskConical size={18} className="text-brand-600" /> Log Material Test Record
              </h3>
              <button onClick={() => setShowTestModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateTest} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Test Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Concrete 28-Day Compressive Cube Test"
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                  value={testForm.test_name}
                  onChange={e => setTestForm({ ...testForm, test_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Material Type</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={testForm.material_type}
                    onChange={e => setTestForm({ ...testForm, material_type: e.target.value })}
                  >
                    <option value="CONCRETE">Concrete</option>
                    <option value="STEEL_REBAR">Steel Rebar</option>
                    <option value="SOIL">Soil / Subgrade</option>
                    <option value="BLOCKS">Masonry Blocks</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Batch / Pour No.</label>
                  <input
                    type="text"
                    placeholder="Batch-092"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={testForm.batch_number}
                    onChange={e => setTestForm({ ...testForm, batch_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Required Strength</label>
                  <input
                    type="text"
                    placeholder="C25/30"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={testForm.required_strength}
                    onChange={e => setTestForm({ ...testForm, required_strength: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Achieved Strength</label>
                  <input
                    type="text"
                    placeholder="28.4 MPa"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono font-bold"
                    value={testForm.achieved_strength}
                    onChange={e => setTestForm({ ...testForm, achieved_strength: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Test Result</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={testForm.result}
                    onChange={e => setTestForm({ ...testForm, result: e.target.value })}
                  >
                    <option value="PASS">Pass / Compliant</option>
                    <option value="FAIL">Fail / Non-Compliant</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Testing Laboratory</label>
                  <input
                    type="text"
                    placeholder="Lab Name"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={testForm.lab_name}
                    onChange={e => setTestForm({ ...testForm, lab_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowTestModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Save Certificate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
