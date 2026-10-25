/**
 * @file SubcontractorManager.jsx
 * @description Subcontractor agreements and Interim Payment Certificates (IPCs).
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Plus,
  FileCheck,
  DollarSign,
  ArrowLeft,
  X,
  FileSpreadsheet,
  CheckCircle,
  Briefcase,
  Search,
  RefreshCw,
  Building
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ProjectModal from "../components/ProjectModal.jsx";

export default function SubcontractorManager() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [subcontracts, setSubcontracts] = useState([]);
  const [valuations, setValuations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showContractModal, setShowContractModal] = useState(false);
  const [showValuationModal, setShowValuationModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);

  const [contractForm, setContractForm] = useState({
    project_id: "",
    subcontract_number: "",
    subcontractor_id: "",
    trade: "CONCRETE_FRAME",
    scope_of_work: "",
    contract_sum: 0,
    retention_percent: 5,
    advance_payment: 0,
    advance_recovery_percent: 10,
    start_date: "",
    completion_date: "",
  });

  const [valuationForm, setValuationForm] = useState({
    valuation_number: "",
    period_from: "",
    period_to: "",
    cumulative_work_done: 0,
    previous_certified: 0,
    remarks: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const pRes = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = pRes.data?.items || [];
        setProjects(prjs);
        if (prjs.length > 0) {
          setSelectedProjectId(String(prjs[0].id));
        } else {
          setLoading(false);
        }

        const sRes = await api.get("/purchase/suppliers?contractor=Y");
        const list = sRes.data?.items || sRes.data?.data?.items || [];
        if (list.length > 0) {
          setSuppliers(list);
        } else {
          const fallbackRes = await api.get("/purchase/suppliers");
          setSuppliers(fallbackRes.data?.items || fallbackRes.data?.data?.items || []);
        }
      } catch (e) {
        toast.error("Failed to load initial data");
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    fetchSubcontracts();
  }, [selectedProjectId]);

  const fetchSubcontracts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/construction/subcontracts", {
        params: selectedProjectId ? { project_id: selectedProjectId } : {}
      });
      setSubcontracts(res.data?.items || []);
      const valRes = await api.get("/construction/subcontract-valuations", {
        params: selectedProjectId ? { project_id: selectedProjectId } : {}
      });
      setValuations(valRes.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load subcontracts");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContract = async (e) => {
    e.preventDefault();
    const projId = contractForm.project_id || selectedProjectId;
    if (!projId) {
      return toast.error("Please select a project");
    }
    if (!contractForm.subcontractor_id) {
      return toast.error("Please select a subcontractor");
    }
    try {
      await api.post("/construction/subcontracts", {
        ...contractForm,
        project_id: projId,
      });
      toast.success("Subcontract agreement registered");
      setShowContractModal(false);
      fetchSubcontracts();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to register subcontract");
    }
  };

  const openValuationModal = (sc) => {
    setSelectedContract(sc);
    const prev = valuations.filter(v => String(v.subcontract_id) === String(sc.id));
    const lastCertified = prev.reduce(
      (acc, curr) => Math.max(acc, Number(curr.cumulative_work_done ?? curr.gross_claimed ?? 0)),
      0
    );
    const subNo = sc.subcontract_number || sc.contract_no || "SC";
    setValuationForm({
      valuation_number: `IPC-${subNo}-${prev.length + 1}`,
      period_from: "",
      period_to: new Date().toISOString().split("T")[0],
      cumulative_work_done: lastCertified,
      previous_certified: lastCertified,
      remarks: "",
    });
    setShowValuationModal(true);
  };

  const handleCreateValuation = async (e) => {
    e.preventDefault();
    try {
      await api.post("/construction/subcontract-valuations", {
        ...valuationForm,
        subcontract_id: selectedContract.id,
      });
      toast.success("Interim Payment Certificate (IPC) certified");
      setShowValuationModal(false);
      fetchSubcontracts();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to certify valuation");
    }
  };

  const currentWork = Math.max(0, Number(valuationForm.cumulative_work_done || 0) - Number(valuationForm.previous_certified || 0));
  const retentionDeducted = (currentWork * Number(selectedContract?.retention_percent ?? 5)) / 100;
  const advanceRecovered = (currentWork * Number(selectedContract?.advance_recovery_percent ?? selectedContract?.advance_percent ?? 10)) / 100;
  const netPayable = Math.max(0, currentWork - retentionDeducted - advanceRecovered);

  const filteredSubcontracts = subcontracts.filter(sc => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      sc.subcontract_number?.toLowerCase().includes(q) ||
      sc.contract_no?.toLowerCase().includes(q) ||
      sc.supplier_name?.toLowerCase().includes(q) ||
      sc.subcontractor_name?.toLowerCase().includes(q) ||
      sc.trade?.toLowerCase().includes(q) ||
      sc.trade_category?.toLowerCase().includes(q) ||
      sc.project_name?.toLowerCase().includes(q) ||
      sc.status?.toLowerCase().includes(q)
    );
  });

  const totalContractValue = subcontracts.reduce((a, c) => a + Number(c.contract_sum ?? c.contract_value ?? 0), 0);
  const activeCount = subcontracts.filter(c => c.status === "ACTIVE").length;
  const totalValuationsCertified = valuations.reduce((a, c) => a + Number(c.net_certified_amount ?? c.net_payable ?? 0), 0);

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
              <Users size={24} className="text-brand-900 dark:text-brand-400" /> Subcontractor Management & Valuations (IPC)
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              Trade agreements, certified interim valuations, retention withholding, and advance recovery
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input text-sm py-1.5 h-auto min-w-[180px]"
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            <option value="">All Projects</option>
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
              placeholder="Search subcontracts..."
              className="input pl-9 pr-3 py-1.5 text-sm h-auto w-48"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchSubcontracts}
            className="btn btn-secondary p-2"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => {
              setContractForm({
                ...contractForm,
                project_id: selectedProjectId || (projects[0]?.id ? String(projects[0].id) : "")
              });
              setShowContractModal(true);
            }}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> New Subcontract
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Subcontracts</p>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{subcontracts.length}</p>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Agreements</p>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{activeCount}</p>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Committed Value</p>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            GHS {totalContractValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-brand-700 dark:text-brand-400 uppercase tracking-wider">Total Certified IPCs</p>
          <p className="text-xl font-bold font-mono text-brand-900 dark:text-brand-400">
            GHS {totalValuationsCertified.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Subcontracts Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
            Subcontract Agreements ({filteredSubcontracts.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Contract #</th>
                <th>Project</th>
                <th>Subcontractor</th>
                <th>Trade</th>
                <th className="text-right">Contract Sum (GHS)</th>
                <th className="text-center">Retention %</th>
                <th className="text-center">Advance Rec %</th>
                <th className="text-center">Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubcontracts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                    {subcontracts.length === 0
                      ? 'No subcontracts registered yet. Click "New Subcontract" to add one.'
                      : 'No subcontracts match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredSubcontracts.map(sc => (
                  <tr key={sc.id}>
                    <td className="font-mono font-bold text-brand-900 dark:text-brand-400">
                      {sc.subcontract_number || sc.contract_no}
                    </td>
                    <td>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{sc.project_code || "-"}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[150px]">{sc.project_name}</div>
                    </td>
                    <td className="font-semibold text-slate-900 dark:text-white">
                      {sc.supplier_name || sc.subcontractor_name || "Specialist Contractor"}
                    </td>
                    <td className="uppercase text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {sc.trade || sc.trade_category}
                    </td>
                    <td className="text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {Number(sc.contract_sum ?? sc.contract_value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-center font-mono">{sc.retention_percent}%</td>
                    <td className="text-center font-mono">{sc.advance_recovery_percent ?? sc.advance_percent ?? 0}%</td>
                    <td className="text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                        {sc.status || "ACTIVE"}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => openValuationModal(sc)}
                        className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"
                      >
                        <FileCheck size={14} className="text-brand-900 dark:text-brand-400" /> Certify Valuation
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interim Valuations Table */}
      {valuations.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
              Certified Interim Payment Certificates (IPCs) ({valuations.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>IPC Number</th>
                  <th>Subcontractor</th>
                  <th className="text-right">Cumulative Work</th>
                  <th className="text-right">Previous Certified</th>
                  <th className="text-right">Current Work</th>
                  <th className="text-right">Retention Held</th>
                  <th className="text-right">Advance Rec</th>
                  <th className="text-right">Net Certified (GHS)</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {valuations.map(v => (
                  <tr key={v.id}>
                    <td className="font-mono font-bold text-brand-900 dark:text-brand-400">
                      {v.valuation_number || v.valuation_no}
                    </td>
                    <td className="font-semibold text-slate-900 dark:text-white">{v.supplier_name}</td>
                    <td className="text-right font-mono">
                      {Number(v.cumulative_work_done ?? v.gross_claimed ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right font-mono">
                      {Number(v.previous_certified || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right font-mono font-bold">
                      {Number(v.current_work_done ?? v.current_certified ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right font-mono text-rose-500">
                      -{Number(v.retention_deducted || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right font-mono text-amber-500">
                      -{Number(v.advance_recovered || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      GHS {Number(v.net_payable ?? v.net_certified_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                        {v.status || "CERTIFIED"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: New Subcontract */}
      <ProjectModal
        open={showContractModal}
        onClose={() => setShowContractModal(false)}
        title="Register Subcontract Agreement"
        subtitle="Record agreed package scope, trade specialty, contract sum, and retention terms"
        icon={Briefcase}
        onSubmit={handleCreateContract}
        submitLabel="Register Agreement"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              required
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={contractForm.project_id || selectedProjectId}
              onChange={e => setContractForm({ ...contractForm, project_id: e.target.value })}
            >
              <option value="">Select Project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Subcontractor <span className="text-red-500">*</span>
            </label>
            <select
              required
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={contractForm.subcontractor_id}
              onChange={e => setContractForm({ ...contractForm, subcontractor_id: e.target.value })}
            >
              <option value="">Select Subcontractor...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.supplier_name}</option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                No contractors found. You can register them in Operations Setup.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Trade / Specialty <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Electrical / Formwork / Plumbing / HVAC"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={contractForm.trade}
            onChange={e => setContractForm({ ...contractForm, trade: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Agreed Contract Sum (GHS) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
              value={contractForm.contract_sum}
              onChange={e => setContractForm({ ...contractForm, contract_sum: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Retention (%)</label>
            <input
              type="number"
              step="0.1"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              value={contractForm.retention_percent}
              onChange={e => setContractForm({ ...contractForm, retention_percent: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Advance Rec (%)</label>
            <input
              type="number"
              step="0.1"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              value={contractForm.advance_recovery_percent}
              onChange={e => setContractForm({ ...contractForm, advance_recovery_percent: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Start Date</label>
            <input
              type="date"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              value={contractForm.start_date}
              onChange={e => setContractForm({ ...contractForm, start_date: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Expected Completion</label>
            <input
              type="date"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              value={contractForm.completion_date}
              onChange={e => setContractForm({ ...contractForm, completion_date: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Package Scope / Terms</label>
          <textarea
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[70px]"
            placeholder="Detailed scope, milestone requirements, or specifications..."
            value={contractForm.scope_of_work}
            onChange={e => setContractForm({ ...contractForm, scope_of_work: e.target.value })}
          />
        </div>
      </ProjectModal>

      {/* Modal: Certify Valuation (IPC) */}
      <ProjectModal
        open={Boolean(showValuationModal && selectedContract)}
        onClose={() => setShowValuationModal(false)}
        title="Interim Payment Certificate (IPC)"
        subtitle={`${selectedContract?.subcontract_number || selectedContract?.contract_no || ""} - ${selectedContract?.supplier_name || selectedContract?.subcontractor_name || ""}`}
        icon={FileCheck}
        onSubmit={handleCreateValuation}
        submitLabel="Certify Payment"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Valuation / IPC Ref <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              value={valuationForm.valuation_number}
              onChange={e => setValuationForm({ ...valuationForm, valuation_number: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Valuation Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              value={valuationForm.period_to}
              onChange={e => setValuationForm({ ...valuationForm, period_to: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Cumulative Work Done (GHS) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
              value={valuationForm.cumulative_work_done}
              onChange={e => setValuationForm({ ...valuationForm, cumulative_work_done: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Previous Certified (GHS)
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              value={valuationForm.previous_certified}
              onChange={e => setValuationForm({ ...valuationForm, previous_certified: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Deductions Breakdown */}
        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl space-y-2 text-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
            <span>Current Period Gross Work:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              GHS {currentWork.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center text-rose-600 dark:text-rose-400">
            <span>Less Retention ({selectedContract?.retention_percent ?? 5}%):</span>
            <span className="font-mono font-bold">-GHS {retentionDeducted.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {advanceRecovered > 0 && (
            <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
              <span>Less Advance Recovery ({selectedContract?.advance_recovery_percent ?? selectedContract?.advance_percent ?? 10}%):</span>
              <span className="font-mono font-bold">-GHS {advanceRecovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        <div className="p-4 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 rounded-xl flex justify-between items-center">
          <div>
            <p className="text-xs font-bold uppercase text-brand-900 dark:text-brand-300">Net Certified Payable</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gross Work less Retention and Advance recovered</p>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            GHS {netPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </ProjectModal>
    </div>
  );
}
