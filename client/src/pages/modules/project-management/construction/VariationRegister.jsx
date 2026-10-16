/**
 * @file VariationRegister.jsx
 * @description Variations, change orders, scope additions, and contract adjustments.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileEdit,
  Plus,
  DollarSign,
  ArrowLeft,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  X,
  AlertTriangle
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function VariationRegister() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [activeVariation, setActiveVariation] = useState(null);

  const [form, setForm] = useState({
    variation_number: "",
    title: "",
    reason: "",
    initiator: "CLIENT",
    amount_claimed: 0,
    schedule_impact_days: 0,
    submission_date: new Date().toISOString().split("T")[0],
  });

  const [approvalData, setApprovalData] = useState({
    amount_approved: 0,
    schedule_impact_days: 0,
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
    fetchVariations();
  }, [selectedProjectId]);

  const fetchVariations = async () => {
    setLoading(true);
    try {
      const res = await api.get("/construction/variations", { params: { project_id: selectedProjectId } });
      setVariations(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load variations");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVariation = async (e) => {
    e.preventDefault();
    if (!form.title) return toast.error("Please enter a title");
    try {
      await api.post("/construction/variations", {
        ...form,
        project_id: selectedProjectId,
      });
      toast.success("Variation order proposal registered");
      setShowModal(false);
      setForm({
        variation_number: "",
        title: "",
        reason: "",
        initiator: "CLIENT",
        amount_claimed: 0,
        schedule_impact_days: 0,
        submission_date: new Date().toISOString().split("T")[0],
      });
      fetchVariations();
    } catch (e) {
      toast.error("Failed to register variation");
    }
  };

  const openApproveModal = (v) => {
    setActiveVariation(v);
    setApprovalData({
      amount_approved: Number(v.amount_claimed || 0),
      schedule_impact_days: Number(v.schedule_impact_days || 0),
    });
    setShowApproveModal(true);
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    if (!activeVariation) return;
    try {
      await api.post(`/construction/variations/${activeVariation.id}/approve`, approvalData);
      toast.success("Variation approved and contract sum adjusted");
      setShowApproveModal(false);
      fetchVariations();
    } catch (e) {
      toast.error("Failed to approve variation");
    }
  };

  const totalClaimed = variations.reduce((a, c) => a + Number(c.amount_claimed || 0), 0);
  const totalApproved = variations.filter(v => v.status === "APPROVED").reduce((a, c) => a + Number(c.amount_approved || 0), 0);

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
                <FileEdit size={24} /> Variations & Change Orders Register
              </h1>
            </div>
            <p className="text-sm mt-1 opacity-80">
              Manage contract variations, scope additions, cost adjustments, and time impact claims
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
              onClick={() => {
                setForm(f => ({ ...f, variation_number: `VO-${Date.now().toString().slice(-4)}` }));
                setShowModal(true);
              }}
              className="btn-success flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
            >
              <Plus size={16} /> New Variation Order
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Variations</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{variations.length} Change Orders</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Value Claimed</span>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            GHS {totalClaimed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved Variations Sum</span>
          <p className="text-xl font-bold font-mono text-emerald-600">
            GHS {totalApproved.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time Impact (Approved)</span>
          <p className="text-xl font-bold font-mono text-blue-600">
            {variations.filter(v => v.status === "APPROVED").reduce((a, c) => a + Number(c.schedule_impact_days || 0), 0)} Days
          </p>
        </div>
      </div>

      {/* Variations Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
            Change Orders & Scope Adjustments ({variations.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3">VO #</th>
                <th className="p-3">Title & Scope Change</th>
                <th className="p-3">Initiated By</th>
                <th className="p-3">Date</th>
                <th className="p-3 text-right">Claimed (GHS)</th>
                <th className="p-3 text-right">Approved (GHS)</th>
                <th className="p-3 text-center">Days Impact</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {variations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                    No variation orders recorded for this project yet.
                  </td>
                </tr>
              ) : (
                variations.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-brand-600">{v.variation_number}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white">{v.title}</div>
                      {v.reason && <div className="text-[10px] text-slate-500 truncate max-w-xs">{v.reason}</div>}
                    </td>
                    <td className="p-3 uppercase text-[10px] font-bold text-slate-500">{v.initiator}</td>
                    <td className="p-3 font-mono">{v.submission_date ? v.submission_date.split("T")[0] : "-"}</td>
                    <td className="p-3 text-right font-mono font-bold">{Number(v.amount_claimed || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      {v.status === "APPROVED" ? Number(v.amount_approved || 0).toLocaleString() : "-"}
                    </td>
                    <td className="p-3 text-center font-mono">{v.schedule_impact_days || 0} d</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        v.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : v.status === "REJECTED"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {v.status !== "APPROVED" && (
                        <button
                          onClick={() => openApproveModal(v)}
                          className="btn-success text-[10px] py-1 px-2.5 rounded font-bold"
                        >
                          Approve
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

      {/* Modal: Create Variation */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <FileEdit size={18} className="text-brand-600" /> New Variation Order (VO)
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateVariation} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Variation Ref #</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={form.variation_number}
                    onChange={e => setForm({ ...form, variation_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Initiated By</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                    value={form.initiator}
                    onChange={e => setForm({ ...form, initiator: e.target.value })}
                  >
                    <option value="CLIENT">Client / Employer</option>
                    <option value="CONSULTANT">Consultant / Architect</option>
                    <option value="CONTRACTOR">Contractor Value Engineering</option>
                    <option value="SITE_CONDITION">Unforeseen Site Condition</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Variation Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Addition of acoustic ceiling in conference room"
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Amount Claimed (GHS)</label>
                  <input
                    type="number"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono font-bold"
                    value={form.amount_claimed}
                    onChange={e => setForm({ ...form, amount_claimed: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Schedule Impact (Days)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={form.schedule_impact_days}
                    onChange={e => setForm({ ...form, schedule_impact_days: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Detailed Justification & Scope</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 min-h-[80px]"
                  placeholder="Reason for change, drawing reference, specification change..."
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Submit Variation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Approve Variation */}
      {showApproveModal && activeVariation && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle size={18} className="text-emerald-600" /> Approve Variation Order
              </h3>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleApprove} className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Approving this variation will automatically increment the project's revised contract sum and baseline budget.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Approved Amount (GHS)</label>
                <input
                  type="number"
                  required
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono font-bold text-emerald-600"
                  value={approvalData.amount_approved}
                  onChange={e => setApprovalData({ ...approvalData, amount_approved: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Approved Time Extension (Days)</label>
                <input
                  type="number"
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                  value={approvalData.schedule_impact_days}
                  onChange={e => setApprovalData({ ...approvalData, schedule_impact_days: Number(e.target.value) })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowApproveModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Confirm Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
