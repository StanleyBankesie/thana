/**
 * @file ClientValuationList.jsx
 * @description Client Interim Payment Applications (IPAs), cumulative measured work done, retention withholding, and advance recovery.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileCheck2,
  Plus,
  DollarSign,
  ArrowLeft,
  Calendar,
  CheckCircle,
  X,
  FileSpreadsheet,
  Search,
  RefreshCw
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function ClientValuationList() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeProject, setActiveProject] = useState(null);
  const [valuations, setValuations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    application_number: "",
    valuation_date: new Date().toISOString().split("T")[0],
    cumulative_work_done: 0,
    previously_certified: 0,
    remarks: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
        if (prjs.length > 0) {
          setSelectedProjectId(String(prjs[0].id));
          setActiveProject(prjs[0]);
        }
      } catch (e) {
        toast.error("Failed to load projects");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const prj = projects.find(p => String(p.id) === String(selectedProjectId));
    setActiveProject(prj || null);
    fetchValuations();
  }, [selectedProjectId]);

  const fetchValuations = async () => {
    setLoading(true);
    try {
      const res = await api.get("/construction/client-valuations", { params: { project_id: selectedProjectId } });
      const items = res.data?.items || [];
      setValuations(items);
    } catch (e) {
      toast.error("Failed to load client valuations");
    } finally {
      setLoading(false);
    }
  };

  const openNewValuationModal = () => {
    const lastCertified = valuations.reduce((acc, curr) => Math.max(acc, Number(curr.cumulative_work_done || 0)), 0);
    setForm({
      application_number: `IPA-${activeProject?.project_code || "PRJ"}-${valuations.length + 1}`,
      valuation_date: new Date().toISOString().split("T")[0],
      cumulative_work_done: lastCertified,
      previously_certified: lastCertified,
      remarks: "",
    });
    setShowModal(true);
  };

  const handleCreateValuation = async (e) => {
    e.preventDefault();
    try {
      await api.post("/construction/client-valuations", {
        ...form,
        project_id: selectedProjectId,
      });
      toast.success("Client Interim Payment Application submitted");
      setShowModal(false);
      fetchValuations();
    } catch (e) {
      toast.error("Failed to create client valuation");
    }
  };

  const currentClaim = Math.max(0, Number(form.cumulative_work_done || 0) - Number(form.previously_certified || 0));
  const retPct = Number(activeProject?.retention_percent || 5);
  const retentionDeducted = (currentClaim * retPct) / 100;
  const advRecPct = Number(activeProject?.advance_recovery_percent || 10);
  const advanceRecovered = (currentClaim * advRecPct) / 100;
  const netCertified = Math.max(0, currentClaim - retentionDeducted - advanceRecovered);

  const filteredValuations = valuations.filter(v => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      v.application_number?.toLowerCase().includes(q) ||
      v.client_name?.toLowerCase().includes(q) ||
      v.status?.toLowerCase().includes(q)
    );
  });

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
              <FileCheck2 size={24} className="text-brand-900 dark:text-brand-400" /> Client Interim Payment Applications (IPAs)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Certify measured contract work, deduct statutory retention, and recover advance mobilisations
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
              placeholder="Search applications..."
              className="input pl-9 pr-3 py-1.5 text-sm h-auto w-48"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchValuations}
            className="btn btn-secondary p-2"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={openNewValuationModal}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> New Application
          </button>
        </div>
      </div>

      {/* Contract Financial Health Cards */}
      {activeProject && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Revised Contract Sum</span>
            <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              GHS {Number(activeProject.revised_contract_sum || activeProject.contract_sum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="card p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Certified to Date</span>
            <p className="text-xl font-bold font-mono text-emerald-600">
              GHS {valuations.reduce((a, c) => a + Number(c.net_certified_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="card p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Retention Held</span>
            <p className="text-xl font-bold font-mono text-rose-600">
              GHS {valuations.reduce((a, c) => a + Number(c.retention_deducted || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="card p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Advance Recovered</span>
            <p className="text-xl font-bold font-mono text-blue-600">
              GHS {valuations.reduce((a, c) => a + Number(c.advance_recovery || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Valuations Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
            Interim Payment Applications Register ({filteredValuations.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Application #</th>
                <th>Date</th>
                <th>Client</th>
                <th className="text-right">Cumulative Work</th>
                <th className="text-right">Previous Certified</th>
                <th className="text-right">Gross Claim</th>
                <th className="text-right">Retention</th>
                <th className="text-right">Advance Rec</th>
                <th className="text-right">Net Certified (GHS)</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredValuations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                    {valuations.length === 0
                      ? 'No client payment applications submitted for this project yet. Click "New Application" to create one.'
                      : 'No payment applications match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredValuations.map(v => (
                  <tr key={v.id}>
                    <td className="font-mono font-bold text-brand-600 dark:text-brand-400">{v.application_number}</td>
                    <td className="font-mono">{v.valuation_date ? v.valuation_date.split("T")[0] : "-"}</td>
                    <td>{v.client_name || activeProject?.client_name || "Client"}</td>
                    <td className="text-right font-mono">{Number(v.cumulative_work_done || 0).toLocaleString()}</td>
                    <td className="text-right font-mono">{Number(v.previously_certified || 0).toLocaleString()}</td>
                    <td className="text-right font-mono font-bold">{Number(v.current_claim || 0).toLocaleString()}</td>
                    <td className="text-right font-mono text-rose-500">-{Number(v.retention_deducted || 0).toLocaleString()}</td>
                    <td className="text-right font-mono text-amber-500">-{Number(v.advance_recovery || 0).toLocaleString()}</td>
                    <td className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      GHS {Number(v.net_certified_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Valuation */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck2 size={18} className="text-brand-900 dark:text-brand-400" /> Interim Payment Application (IPA)
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateValuation} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="label text-xs uppercase font-bold text-slate-500">Application Ref</label>
                  <input
                    type="text"
                    required
                    className="input w-full font-mono"
                    value={form.application_number}
                    onChange={e => setForm({ ...form, application_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="label text-xs uppercase font-bold text-slate-500">Valuation Date</label>
                  <input
                    type="date"
                    required
                    className="input w-full font-mono"
                    value={form.valuation_date}
                    onChange={e => setForm({ ...form, valuation_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="label text-xs uppercase font-bold text-slate-500">Cumulative Work Done (GHS)</label>
                  <input
                    type="number"
                    required
                    className="input w-full font-mono font-bold"
                    value={form.cumulative_work_done}
                    onChange={e => setForm({ ...form, cumulative_work_done: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="label text-xs uppercase font-bold text-slate-500">Previously Certified (GHS)</label>
                  <input
                    type="number"
                    className="input w-full font-mono"
                    value={form.previously_certified}
                    onChange={e => setForm({ ...form, previously_certified: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl space-y-2 text-xs border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Current Period Measured Claim:</span>
                  <span className="font-mono font-bold">GHS {currentClaim.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-rose-600">
                  <span>Less Retention ({retPct}%):</span>
                  <span className="font-mono">-GHS {retentionDeducted.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-amber-600">
                  <span>Less Advance Recovery ({advRecPct}%):</span>
                  <span className="font-mono">-GHS {advanceRecovered.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-4 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 rounded-xl flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold uppercase text-brand-800 dark:text-brand-300">Net Claim Amount</p>
                  <p className="text-[10px] text-slate-500">Gross claim minus retention and advance recovery</p>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  GHS {netCertified.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary inline-flex items-center gap-1.5">
                  Submit Payment Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
