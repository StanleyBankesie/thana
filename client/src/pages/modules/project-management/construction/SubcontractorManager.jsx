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
  Briefcase
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function SubcontractorManager() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [subcontracts, setSubcontracts] = useState([]);
  const [valuations, setValuations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showContractModal, setShowContractModal] = useState(false);
  const [showValuationModal, setShowValuationModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);

  const [contractForm, setContractForm] = useState({
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
        if (prjs.length > 0) setSelectedProjectId(String(prjs[0].id));

        const sRes = await api.get("/purchase/suppliers");
        setSuppliers(sRes.data?.items || sRes.data?.data?.items || []);
      } catch (e) {
        toast.error("Failed to load initial data");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchSubcontracts();
  }, [selectedProjectId]);

  const fetchSubcontracts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/construction/subcontracts", { params: { project_id: selectedProjectId } });
      setSubcontracts(res.data?.items || []);
      const valRes = await api.get("/construction/subcontract-valuations");
      setValuations(valRes.data?.items || []);
    } catch (e) {
      toast.error("Failed to load subcontracts");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContract = async (e) => {
    e.preventDefault();
    if (!contractForm.subcontractor_id || !contractForm.subcontract_number) {
      return toast.error("Please fill in contract number and select subcontractor");
    }
    try {
      await api.post("/construction/subcontracts", {
        ...contractForm,
        project_id: selectedProjectId,
      });
      toast.success("Subcontract agreement registered");
      setShowContractModal(false);
      fetchSubcontracts();
    } catch (e) {
      toast.error("Failed to register subcontract");
    }
  };

  const openValuationModal = (sc) => {
    setSelectedContract(sc);
    // Find previous valuations for this subcontract
    const prev = valuations.filter(v => v.subcontract_id === sc.id);
    const lastCertified = prev.reduce((acc, curr) => Math.max(acc, Number(curr.cumulative_work_done || 0)), 0);
    setValuationForm({
      valuation_number: `IPC-${sc.subcontract_number}-${prev.length + 1}`,
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
      toast.error("Failed to certify valuation");
    }
  };

  const currentWork = Math.max(0, Number(valuationForm.cumulative_work_done || 0) - Number(valuationForm.previous_certified || 0));
  const retentionDeducted = (currentWork * Number(selectedContract?.retention_percent || 5)) / 100;
  const advanceRecovered = (currentWork * Number(selectedContract?.advance_recovery_percent || 10)) / 100;
  const netPayable = Math.max(0, currentWork - retentionDeducted - advanceRecovered);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/project-management" className="text-white/80 hover:text-white">
                <ArrowLeft size={18} />
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users size={24} /> Subcontractor Management & Valuations (IPC)
              </h1>
            </div>
            <p className="text-sm mt-1 opacity-80">
              Trade agreements, certified interim valuations, retention withholding, and advance recovery
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm outline-none font-medium"
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id} className="text-slate-900">
                  {p.project_code} - {p.project_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowContractModal(true)}
              className="btn-success flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
            >
              <Plus size={16} /> New Subcontract
            </button>
          </div>
        </div>
      </div>

      {/* Subcontracts Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
            Subcontract Agreements ({subcontracts.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b">
              <tr>
                <th className="p-3">Contract #</th>
                <th className="p-3">Subcontractor</th>
                <th className="p-3">Trade</th>
                <th className="p-3 text-right">Contract Sum (GHS)</th>
                <th className="p-3 text-center">Retention %</th>
                <th className="p-3 text-center">Advance Rec %</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {subcontracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                    No subcontracts registered for this project yet. Click "New Subcontract" to add one.
                  </td>
                </tr>
              ) : (
                subcontracts.map(sc => (
                  <tr key={sc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-brand-600">{sc.subcontract_number}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{sc.supplier_name || "Specialist Contractor"}</td>
                    <td className="p-3 uppercase text-[10px] font-bold text-slate-500">{sc.trade}</td>
                    <td className="p-3 text-right font-mono font-bold">
                      {Number(sc.contract_sum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center font-mono">{sc.retention_percent}%</td>
                    <td className="p-3 text-center font-mono">{sc.advance_recovery_percent}%</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">
                        {sc.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => openValuationModal(sc)}
                        className="btn btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 mx-auto"
                      >
                        <FileCheck size={14} className="text-brand-600" /> Certify Valuation
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
          <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
              Certified Interim Payment Certificates (IPCs)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900 uppercase font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-3">IPC Number</th>
                  <th className="p-3">Subcontractor</th>
                  <th className="p-3 text-right">Cumulative Work</th>
                  <th className="p-3 text-right">Previous Certified</th>
                  <th className="p-3 text-right">Current Work</th>
                  <th className="p-3 text-right">Retention Held</th>
                  <th className="p-3 text-right">Advance Rec</th>
                  <th className="p-3 text-right">Net Certified (GHS)</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {valuations.map(v => (
                  <tr key={v.id}>
                    <td className="p-3 font-mono font-bold text-brand-600">{v.valuation_number}</td>
                    <td className="p-3 font-semibold">{v.supplier_name}</td>
                    <td className="p-3 text-right font-mono">{Number(v.cumulative_work_done || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono">{Number(v.previous_certified || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono">{Number(v.current_work_done || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-rose-500">-{Number(v.retention_deducted || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-amber-500">-{Number(v.advance_recovered || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      GHS {Number(v.net_payable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">
                        {v.status}
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
      {showContractModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase size={18} className="text-brand-600" /> Register Subcontract Agreement
              </h3>
              <button onClick={() => setShowContractModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateContract} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Subcontract No.</label>
                  <input
                    type="text"
                    required
                    placeholder="SC-2026-001"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                    value={contractForm.subcontract_number}
                    onChange={e => setContractForm({ ...contractForm, subcontract_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Subcontractor</label>
                  <select
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                    value={contractForm.subcontractor_id}
                    onChange={e => setContractForm({ ...contractForm, subcontractor_id: e.target.value })}
                  >
                    <option value="">Select Subcontractor...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.supplier_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Trade / Specialty</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electrical / Formwork"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                    value={contractForm.trade}
                    onChange={e => setContractForm({ ...contractForm, trade: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Agreed Contract Sum (GHS)</label>
                  <input
                    type="number"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={contractForm.contract_sum}
                    onChange={e => setContractForm({ ...contractForm, contract_sum: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Retention (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={contractForm.retention_percent}
                    onChange={e => setContractForm({ ...contractForm, retention_percent: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Advance Sum (GHS)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={contractForm.advance_payment}
                    onChange={e => setContractForm({ ...contractForm, advance_payment: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Advance Rec (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={contractForm.advance_recovery_percent}
                    onChange={e => setContractForm({ ...contractForm, advance_recovery_percent: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Scope of Work</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 min-h-[70px]"
                  placeholder="Summary of deliverables, specifications, milestones..."
                  value={contractForm.scope_of_work}
                  onChange={e => setContractForm({ ...contractForm, scope_of_work: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowContractModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Save Subcontract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Certify Valuation (IPC) */}
      {showValuationModal && selectedContract && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck size={18} className="text-brand-600" /> Interim Payment Certificate (IPC)
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedContract.subcontract_number} - {selectedContract.supplier_name}
                </p>
              </div>
              <button onClick={() => setShowValuationModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateValuation} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Valuation / IPC Ref</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={valuationForm.valuation_number}
                    onChange={e => setValuationForm({ ...valuationForm, valuation_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Valuation Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={valuationForm.period_to}
                    onChange={e => setValuationForm({ ...valuationForm, period_to: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Cumulative Work Done (GHS)</label>
                  <input
                    type="number"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono font-bold"
                    value={valuationForm.cumulative_work_done}
                    onChange={e => setValuationForm({ ...valuationForm, cumulative_work_done: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Previous Certified (GHS)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-100 dark:bg-slate-800 font-mono"
                    value={valuationForm.previous_certified}
                    onChange={e => setValuationForm({ ...valuationForm, previous_certified: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Current Period Gross Work:</span>
                  <span className="font-mono font-bold">GHS {currentWork.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-rose-600">
                  <span>Less Retention ({selectedContract.retention_percent}%):</span>
                  <span className="font-mono">-GHS {retentionDeducted.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-amber-600">
                  <span>Less Advance Recovery ({selectedContract.advance_recovery_percent}%):</span>
                  <span className="font-mono">-GHS {advanceRecovered.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-4 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 rounded-xl flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold uppercase text-brand-800 dark:text-brand-300">Net Certified Payable</p>
                  <p className="text-[10px] text-slate-500">Gross minus retention and advance recovery</p>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  GHS {netPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowValuationModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Certify & Issue IPC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
