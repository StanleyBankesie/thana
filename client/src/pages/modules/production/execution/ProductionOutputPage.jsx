/**
 * @fileoverview ProductionOutputPage component.
 * Pure Quality Control (QC) & Inspection Page with Quality Checklist Scoring,
 * Execution linkage, and Production Warehouse Finished Goods Stock Transfer.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Save, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  PackageCheck,
  Building,
  ShieldCheck,
  Ban,
  FileText,
  Award,
  Sliders,
  Check
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function ProductionOutputPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executions, setExecutions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState("");

  const [qcCriteriaScores, setQcCriteriaScores] = useState([]);

  const [formData, setFormData] = useState({
    job_card_id: "",
    output_date: new Date().toISOString().split("T")[0],
    warehouse_id: "",
    planned_qty: 0,
    produced_qty: 0,
    good_qty: 0,
    rejected_qty: 0,
    scrap_qty: 0,
    uom: "Pcs",
    quality_status: "PASSED",
    batch_no: "",
    mfg_date: new Date().toISOString().split("T")[0],
    expiry_date: "",
    defect_reason: "",
    remarks: ""
  });

  const safeIsoDate = (d) => {
    if (!d) return "";
    try {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? "" : dt.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [execRes, whRes, qcRes] = await Promise.all([
          api.get("/production/qc/executions").catch(() => ({ data: { items: [] } })),
          api.get("/production/setup/warehouses").catch(() => ({ data: { items: [] } })),
          api.get("/production/setup/qc-checklists").catch(() => ({ data: { items: [] } }))
        ]);

        const execList = execRes.data?.items || [];
        setExecutions(execList);

        const activeWhs = (whRes.data?.items || []).filter(w => w.is_active !== 0 && w.is_active !== false);
        setWarehouses(activeWhs);
        
        // Find default Finished Goods Production Warehouse
        const defaultWh = activeWhs.find(w => 
          (w.warehouse_name || '').toLowerCase().includes('finished') || 
          (w.code || '').toLowerCase().includes('fg')
        ) || activeWhs[0];

        const chkList = qcRes.data?.items || [];
        setChecklists(chkList);

        if (chkList.length > 0) {
          setSelectedChecklistId(chkList[0].id);
          loadChecklistCriteria(chkList[0]);
        } else {
          // Default built-in criteria
          loadChecklistCriteria({
            min_pass_score: 75,
            items: [
              { check_item_name: "Visual Surface Inspection", max_points: 30, pass_criteria: "No cracks, scratches, or blemishes", is_mandatory: true },
              { check_item_name: "Dimensional Tolerance Test", max_points: 40, pass_criteria: "Within ±0.05mm margin", is_mandatory: true },
              { check_item_name: "Functional Operational Test", max_points: 30, pass_criteria: "Passes electrical & power cycle", is_mandatory: false }
            ]
          });
        }

        if (execList.length > 0) {
          handleExecutionSelect(execList[0].id, execList, defaultWh?.id);
        } else if (defaultWh) {
          setFormData(prev => ({ ...prev, warehouse_id: String(defaultWh.id) }));
        }
      } catch {
        toast.error("Failed to load Quality Control inspection data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const loadChecklistCriteria = (checklistObj) => {
    let items = [];
    try {
      items = typeof checklistObj.items === 'string' ? JSON.parse(checklistObj.items) : (checklistObj.items || []);
    } catch {}

    const initialScores = items.map(item => ({
      ...item,
      scored_points: item.max_points,
      is_passed: true
    }));
    setQcCriteriaScores(initialScores);
  };

  const handleChecklistSelect = (checklistId) => {
    setSelectedChecklistId(checklistId);
    const selected = checklists.find(c => String(c.id) === String(checklistId));
    if (selected) {
      loadChecklistCriteria(selected);
    }
  };

  const handleScoreChange = (index, points) => {
    const updated = [...qcCriteriaScores];
    const item = updated[index];
    const numPoints = Math.min(item.max_points, Math.max(0, parseFloat(points) || 0));
    updated[index].scored_points = numPoints;
    updated[index].is_passed = numPoints >= Math.round(item.max_points * 0.7);
    setQcCriteriaScores(updated);
  };

  const activeChecklist = checklists.find(c => String(c.id) === String(selectedChecklistId)) || { min_pass_score: 75 };
  const minPassPct = Number(activeChecklist.min_pass_score || 75);

  const totalMaxPoints = qcCriteriaScores.reduce((sum, item) => sum + (Number(item.max_points) || 0), 0);
  const totalScoredPoints = qcCriteriaScores.reduce((sum, item) => sum + (Number(item.scored_points) || 0), 0);
  const overallQualityScorePct = totalMaxPoints > 0 ? Math.round((totalScoredPoints / totalMaxPoints) * 100) : 100;

  const hasFailedMandatory = qcCriteriaScores.some(item => item.is_mandatory && item.scored_points < Math.round(item.max_points * 0.7));
  const autoQualityPassed = overallQualityScorePct >= minPassPct && !hasFailedMandatory;

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      quality_status: autoQualityPassed ? "PASSED" : "REJECTED"
    }));
  }, [overallQualityScorePct, hasFailedMandatory]);

  const handleExecutionSelect = (execId, list = executions, defaultWhId = null) => {
    const selected = list.find((e) => String(e.id) === String(execId));
    if (selected) {
      const goodQtyVal = Number(selected.good_qty !== undefined && selected.good_qty !== null && selected.good_qty !== "" ? selected.good_qty : (selected.planned_qty || 0));
      const rejQtyVal = Number(selected.rejected_qty || 0);
      const plannedQtyVal = Number(selected.planned_qty || selected.plan_quantity || 1);

      setFormData((prev) => ({
        ...prev,
        job_card_id: execId,
        warehouse_id: prev.warehouse_id || (defaultWhId ? String(defaultWhId) : (warehouses[0]?.id ? String(warehouses[0].id) : "")),
        planned_qty: plannedQtyVal,
        produced_qty: goodQtyVal + rejQtyVal,
        good_qty: goodQtyVal,
        rejected_qty: rejQtyVal,
        scrap_qty: Number(selected.scrap_qty || 0),
        uom: selected.uom || "Pcs",
        batch_no: selected.batch_no || selected.batch_number || `BATCH-${Date.now().toString().slice(-6)}`,
        mfg_date: safeIsoDate(selected.mfg_date || selected.manufacture_date) || safeIsoDate(new Date()),
        expiry_date: safeIsoDate(selected.expiry_date),
        remarks: `QC Inspection for Execution #${selected.job_card_no || execId} (${selected.item_name || 'Produced Product'})`
      }));
    }
  };

  const handleGoodQtyChange = (val) => {
    const good = parseFloat(val) || 0;
    setFormData((prev) => {
      const produced = good + prev.rejected_qty;
      return {
        ...prev,
        good_qty: good,
        produced_qty: produced
      };
    });
  };

  const handleRejectedQtyChange = (val) => {
    const rej = parseFloat(val) || 0;
    setFormData((prev) => {
      const produced = prev.good_qty + rej;
      return {
        ...prev,
        rejected_qty: rej,
        produced_qty: produced
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.job_card_id) return toast.error("Please select a completed Execution");
    if (!formData.warehouse_id) return toast.error("Please select a Finished Goods Warehouse");

    // STRICT QC WAREHOUSE TRANSFER RULE: If rejected or good_qty is 0, block transfer to inventory warehouse
    if (formData.quality_status === "REJECTED" || !autoQualityPassed) {
      return toast.error(`QC FAILED (Score: ${overallQualityScorePct}%): Item did not pass quality score requirement (${minPassPct}%) and CANNOT be transferred to the Finished Goods Warehouse!`);
    }

    if (formData.good_qty <= 0) {
      return toast.error("Good produced quantity must be greater than 0 to transfer stock to Finished Goods Warehouse!");
    }

    setSaving(true);
    try {
      const payload = {
        job_card_id: formData.job_card_id,
        checklist_id: selectedChecklistId || null,
        inspection_date: formData.output_date,
        warehouse_id: formData.warehouse_id,
        batch_no: formData.batch_no,
        mfg_date: formData.mfg_date,
        expiry_date: formData.expiry_date || null,
        planned_qty: formData.planned_qty,
        inspected_qty: formData.produced_qty,
        good_qty: formData.good_qty,
        rejected_qty: formData.rejected_qty,
        quality_score: overallQualityScorePct,
        quality_status: "PASSED",
        criteria_scores: qcCriteriaScores,
        remarks: formData.remarks
      };

      await api.post("/production/qc/inspections", payload);

      toast.success(`QC Passed (${overallQualityScorePct}% Score)! Stock successfully transferred to Finished Goods Warehouse.`);
      navigate("/production/execution/job-cards");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to complete quality transfer");
    } finally {
      setSaving(false);
    }
  };

  const handleLogRejectionOnly = async () => {
    if (!formData.job_card_id) return toast.error("Please select a completed Execution");
    setSaving(true);
    try {
      const payload = {
        job_card_id: formData.job_card_id,
        checklist_id: selectedChecklistId || null,
        inspection_date: formData.output_date,
        warehouse_id: formData.warehouse_id || null,
        batch_no: formData.batch_no,
        mfg_date: formData.mfg_date,
        expiry_date: formData.expiry_date || null,
        planned_qty: formData.planned_qty,
        inspected_qty: formData.produced_qty,
        good_qty: formData.good_qty,
        rejected_qty: formData.rejected_qty,
        quality_score: overallQualityScorePct,
        quality_status: "REJECTED",
        criteria_scores: qcCriteriaScores,
        remarks: formData.remarks
      };

      await api.post("/production/qc/inspections", payload);

      toast.info(`QC Rejection Logged (Score: ${overallQualityScorePct}%). Stock transfer to warehouse was blocked as requested.`);
      navigate("/production/execution/job-cards");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to log QC rejection");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading Quality Control Environment...</div>;
  }

  const isRejected = formData.quality_status === "REJECTED" || !autoQualityPassed || formData.good_qty <= 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="card">
        <div className="card-header bg-brand-900 text-white dark:bg-brand-950 rounded-t-lg flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link to="/production/execution/qc" className="btn btn-secondary p-2">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300 flex items-center gap-2">
                <ShieldCheck className="h-7 w-7 text-amber-400" />
                Quality Control Inspection & Scoring
              </h1>
              <p className="text-sm mt-1 text-slate-100">
                Score produced item quality from completed executions against setup checklists. Items failing minimum score requirements cannot be transferred to the Finished Goods Warehouse.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/production/execution/qc" className="font-sans btn btn-secondary text-xs">
              Return to QC List
            </Link>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6 bg-white dark:bg-slate-900 rounded-xl">
          
          {/* Execution & Target Warehouse Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Execution *</label>
              <select
                required
                value={formData.job_card_id}
                onChange={(e) => handleExecutionSelect(e.target.value)}
                className="input w-full font-bold text-xs"
              >
                <option value="">Select Completed Execution...</option>
                {executions.map((jc) => (
                  <option key={jc.id} value={jc.id}>
                    #{jc.job_card_no || `JC-${jc.id}`} — {jc.item_name || "Product"} ({jc.good_qty || jc.planned_qty} {jc.uom || 'Pcs'}) | Plan: {jc.plan_no || 'N/A'}
                  </option>
                ))}
              </select>
              {executions.length === 0 && (
                <p className="text-[11px] text-amber-600 font-semibold mt-1">
                  No uninspected completed executions available.
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Finished Goods Warehouse *</label>
              <select
                required
                value={formData.warehouse_id}
                onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                className="input w-full font-bold text-xs"
              >
                <option value="">Select Production Warehouse...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name} {w.code ? `(${w.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Inspection Date *</label>
              <input
                type="date"
                required
                value={formData.output_date}
                onChange={(e) => setFormData({ ...formData, output_date: e.target.value })}
                className="input w-full font-medium text-xs"
              />
            </div>
          </div>

          {/* Quality Control Checklist Selection & Live Score Summary */}
          <div className="p-5 rounded-2xl bg-brand-900 border border-brand-800 text-white space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-700/80 pb-3">
              <div className="flex items-center gap-3">
                <Award size={22} className="text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Quality Inspection Scoring System</h3>
                  <p className="text-[11px] text-brand-200">Score criteria items below to verify compliance against Quality Checklist standard</p>
                </div>
              </div>

              {checklists.length > 0 && (
                <div className="min-w-[220px]">
                  <select
                    className="input w-full bg-brand-950/90 border-brand-700 text-white font-bold text-xs"
                    value={selectedChecklistId}
                    onChange={e => handleChecklistSelect(e.target.value)}
                  >
                    {checklists.map(c => (
                      <option key={c.id} value={c.id}>{c.checklist_name} ({c.min_pass_score}% Min)</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Score Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-brand-950/70 rounded-xl border border-brand-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300 block mb-1">Calculated Quality Score</span>
                <span className={`text-3xl font-black font-mono ${overallQualityScorePct >= minPassPct ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {overallQualityScorePct}%
                </span>
                <span className="text-[10px] text-brand-300 block mt-0.5">({totalScoredPoints} / {totalMaxPoints} Points)</span>
              </div>

              <div className="p-3 bg-brand-950/70 rounded-xl border border-brand-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300 block mb-1">Min Required Score</span>
                <span className="text-3xl font-black font-mono text-amber-400">
                  {minPassPct}%
                </span>
                <span className="text-[10px] text-brand-300 block mt-0.5">Setup Pass Threshold</span>
              </div>

              <div className="p-3 bg-brand-950/70 rounded-xl border border-brand-800 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300 block mb-1">QC System Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  autoQualityPassed 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {autoQualityPassed ? 'PASSED QC' : 'REJECTED / FAILED QC'}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Criteria Scoring Table */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Sliders size={16} className="text-brand-600" /> Quality Criteria Scoring Breakdown
            </h4>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Quality Check Criterion</th>
                    <th className="px-4 py-3">Pass Criteria Expectation</th>
                    <th className="px-4 py-3 text-center">Mandatory</th>
                    <th className="px-4 py-3 text-right">Max Points</th>
                    <th className="px-4 py-3 text-right w-36">Scored Points</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {qcCriteriaScores.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{item.check_item_name}</td>
                      <td className="px-4 py-3 text-slate-500">{item.pass_criteria || "Comply with standards"}</td>
                      <td className="px-4 py-3 text-center">
                        {item.is_mandatory ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            Required
                          </span>
                        ) : (
                          <span className="text-slate-400">Optional</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">{item.max_points} pts</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max={item.max_points}
                          value={item.scored_points}
                          onChange={(e) => handleScoreChange(idx, e.target.value)}
                          className="input w-24 text-right font-black text-brand-600 py-1"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.scored_points >= Math.round(item.max_points * 0.7) ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <Check size={14} /> Pass
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-500 font-bold">
                            <XCircle size={14} /> Fail
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quantity Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Planned Target ({formData.uom})</label>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                {formData.planned_qty.toLocaleString()} <span className="text-xs text-slate-400 font-medium">{formData.uom}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-emerald-600 uppercase">Good Passed Qty *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.good_qty}
                onChange={(e) => handleGoodQtyChange(e.target.value)}
                className="input w-full mt-1 font-black text-xl text-emerald-600 border-emerald-300 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-rose-500 uppercase">Rejected Defect Qty</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.rejected_qty}
                onChange={(e) => handleRejectedQtyChange(e.target.value)}
                className="input w-full mt-1 font-black text-xl text-rose-500 border-rose-300 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Total Inspected</label>
              <div className="text-2xl font-black text-brand-600 dark:text-brand-400 mt-1">
                {formData.produced_qty.toLocaleString()} <span className="text-xs text-slate-400 font-medium">{formData.uom}</span>
              </div>
            </div>
          </div>

          {/* STRICT WARNING BANNER IF QC REJECTED */}
          {isRejected && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-rose-800 dark:text-rose-200">
              <Ban size={22} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <strong className="block font-bold text-sm">QUALITY INSPECTION REJECTED / FAILED (Score: {overallQualityScorePct}% / Required: {minPassPct}%)</strong>
                <p>
                  This execution did not pass quality scoring parameters or failed a mandatory quality criterion. Stock transfer to the Finished Goods Warehouse is <strong>BLOCKED</strong>.
                  Only passed items can be transferred into inventory stock.
                </p>
              </div>
            </div>
          )}

          {/* Batch / Lot & Date Tracking (MFG & EXP Date) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Finished Goods Lot / Batch No</label>
              <input
                type="text"
                value={formData.batch_no}
                onChange={(e) => setFormData({ ...formData, batch_no: e.target.value })}
                className="input w-full font-mono text-xs font-bold"
                placeholder="e.g. LOT-123456 / BATCH-01"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Manufacture Date (MFG Date) *</label>
              <input
                type="date"
                required
                value={formData.mfg_date}
                onChange={(e) => setFormData({ ...formData, mfg_date: e.target.value })}
                className="input w-full font-medium text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Expiry Date (EXP Date)</label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="input w-full font-medium text-xs"
              />
            </div>
          </div>

          {/* Defect Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">QC Defect Cause & Inspection Remarks</label>
            <textarea
              rows={2}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="input w-full text-xs"
              placeholder="Enter quality inspection notes, test results, or defect causes..."
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => navigate("/production/execution/job-cards")}
              className="btn-secondary px-5 text-xs font-bold"
            >
              Cancel
            </button>

            {isRejected ? (
              <button
                type="button"
                onClick={handleLogRejectionOnly}
                disabled={saving}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <FileText size={16} /> Log Defect Record (No Stock Transfer)
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving || isRejected}
                className="btn-primary px-6 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                Confirm QC Passed ({overallQualityScorePct}%) & Transfer to Finished Goods Warehouse
              </button>
            )}
          </div>

        </div>
      </form>
    </div>
  );
}
