import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Wrench, Navigation, CheckCircle, Clock, MapPin, 
  ShieldAlert, Camera, Star, UserCheck, AlertTriangle, FileCheck, ArrowRight, ArrowLeft
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function FieldTechnicianJobCard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState(null);

  // Status transition state
  const [transitioning, setTransitioning] = useState(false);
  const [safetyChecked, setSafetyChecked] = useState(false);
  const [hazardNotes, setHazardNotes] = useState("");

  // Inspection Checklist state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [checklistValues, setChecklistValues] = useState({});
  const [checklistSubmitting, setChecklistSubmitting] = useState(false);
  const [checklistCompleted, setChecklistCompleted] = useState(false);

  // Completion & Signoff state
  const [showSignoffModal, setShowSignoffModal] = useState(false);
  const [signoffData, setSignoffData] = useState({
    actual_hours: 1.5,
    completion_notes: "",
    work_performed: "",
    root_cause: "",
    corrective_action: "",
    customer_signature_name: "",
    customer_satisfaction_rating: 5,
    customer_feedback: ""
  });
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    fetchJobs();
    fetchChecklistTemplates();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/facilities/technician/jobs");
      const list = res.data?.data || [];
      setJobs(list);
      if (list.length > 0 && !activeJob) {
        setActiveJob(list[0]);
      }
    } catch {
      toast.error("Failed to load assigned field jobs");
    } finally {
      setLoading(false);
    }
  };

  const fetchChecklistTemplates = async () => {
    try {
      const res = await api.get("/facilities/checklists/templates");
      setTemplates(res.data?.data || []);
    } catch {
      // Ignore
    }
  };

  const handleSelectJob = (job) => {
    setActiveJob(job);
    setSafetyChecked(job.safety_briefing_acknowledged === 1);
    setSelectedTemplate(null);
    setChecklistValues({});
    setChecklistCompleted(false);
  };

  const handleStatusTransition = async (newStatus) => {
    if (!activeJob) return;
    if (newStatus === "IN_PROGRESS" && !safetyChecked) {
      toast.warn("Please acknowledge safety briefing & risk assessment before beginning work");
      return;
    }

    try {
      setTransitioning(true);
      await api.post(`/facilities/jobs/${activeJob.id}/status-transition`, {
        new_status: newStatus,
        safety_briefing_acknowledged: safetyChecked,
        risk_assessment_notes: hazardNotes
      });
      toast.success(`Job marked as ${newStatus}`);
      setActiveJob({ ...activeJob, status: newStatus });
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.message || "Status transition failed");
    } finally {
      setTransitioning(false);
    }
  };

  const handleLoadChecklistTemplate = async (templateId) => {
    if (!templateId) return;
    try {
      const res = await api.get(`/facilities/checklists/templates/${templateId}`);
      const tpl = res.data?.data;
      setSelectedTemplate(tpl);
      // Initialize items
      const initialValues = {};
      (tpl.items || []).forEach((item) => {
        initialValues[item.id] = {
          template_item_id: item.id,
          item_text: item.item_text,
          field_type: item.field_type,
          min_reading: item.min_reading,
          max_reading: item.max_reading,
          is_critical: item.is_critical,
          status_result: item.field_type === "PASS_FAIL" ? "PASS" : "YES",
          numeric_value: item.min_reading || "",
          text_value: ""
        };
      });
      setChecklistValues(initialValues);
    } catch {
      toast.error("Failed to load checklist details");
    }
  };

  const handleChecklistSubmit = async (e) => {
    e.preventDefault();
    if (!activeJob || !selectedTemplate) return;

    try {
      setChecklistSubmitting(true);
      const itemsPayload = Object.values(checklistValues);
      const res = await api.post("/facilities/checklists/execute", {
        work_order_id: activeJob.id,
        template_id: selectedTemplate.id,
        overall_notes: "Field technician inspection execution",
        item_values: itemsPayload
      });

      if (res.data?.overall_result === "FAIL") {
        toast.error("Critical failure detected! Automatic corrective action order triggered.");
      } else {
        toast.success(`Checklist passed with status: ${res.data?.overall_result}`);
      }
      setChecklistCompleted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Checklist submission failed");
    } finally {
      setChecklistSubmitting(false);
    }
  };

  const handleCompleteWithSignoff = async (e) => {
    e.preventDefault();
    if (!activeJob) return;
    if (!signoffData.customer_signature_name.trim()) {
      toast.warn("Customer representative name is required for formal sign-off");
      return;
    }

    try {
      setCompleting(true);
      const res = await api.post(`/facilities/jobs/${activeJob.id}/complete`, signoffData);
      toast.success(`Job completed! Official report generated: ${res.data?.report_no}`);
      setShowSignoffModal(false);
      setActiveJob({ ...activeJob, status: "COMPLETED" });
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to complete job");
    } finally {
      setCompleting(false);
    }
  };

  const stages = ["ASSIGNED", "TRAVELING", "ON_SITE", "IN_PROGRESS", "COMPLETED"];
  const currentStageIndex = stages.indexOf(activeJob?.status || "ASSIGNED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/maintenance?section=Facilities Management"
            className="btn btn-secondary inline-flex items-center gap-1.5"
            title="Back to Facilities Management"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Field Service Technician Workspace
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Mobile-optimized job execution: dispatch stages, safety acknowledgment, digital checklists, and client sign-off.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <UserCheck size={14} />
          Active Technician Session
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Jobs List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white px-1">
            Assigned Work Orders ({jobs.length})
          </h2>

          {loading ? (
            <div className="p-8 flex justify-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-6 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 text-xs">
              No active jobs currently assigned.
            </div>
          ) : (
            <div className="space-y-2.5">
              {jobs.map((job) => {
                const isSelected = activeJob?.id === job.id;
                return (
                  <div
                    key={job.id}
                    onClick={() => handleSelectJob(job)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500 dark:border-emerald-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                        {job.order_no}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        job.priority === "CRITICAL"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}>
                        {job.priority || "NORMAL"}
                      </span>
                    </div>

                    <h4 className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2 mb-2">
                      {job.instructions || job.asset_name || "Facilities Service Order"}
                    </h4>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{job.property_name || "Site Location"} {job.space_name ? `• ${job.space_name}` : ""}</span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">{job.service_line?.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{job.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 2 Columns: Active Job Workspace */}
        <div className="lg:col-span-2 space-y-5">
          {!activeJob ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 text-sm">
              Select a work order from the left to view job card and begin execution.
            </div>
          ) : (
            <>
              {/* Job Card Header & Status Stepper */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 mr-2">
                      {activeJob.order_no}
                    </span>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                      {activeJob.service_line?.replace(/_/g, " ")}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                      {activeJob.asset_name || "Facility Work Order"}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Assigned Tech</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {activeJob.assigned_technician || "Current Technician"}
                    </span>
                  </div>
                </div>

                {/* Dispatch Stages Visual Stepper */}
                <div className="grid grid-cols-5 gap-1 pt-1">
                  {stages.map((stage, idx) => {
                    const isPassed = idx <= currentStageIndex;
                    const isCurrent = idx === currentStageIndex;
                    return (
                      <div key={stage} className="text-center">
                        <div
                          className={`h-2 rounded-full mb-1 transition-all ${
                            isCurrent
                              ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                              : isPassed
                              ? "bg-emerald-300 dark:bg-emerald-700"
                              : "bg-slate-200 dark:bg-slate-700"
                          }`}
                        />
                        <span className={`text-[10px] font-medium block truncate ${
                          isCurrent
                            ? "text-emerald-600 dark:text-emerald-400 font-bold"
                            : isPassed
                            ? "text-slate-700 dark:text-slate-300"
                            : "text-slate-400"
                        }`}>
                          {stage.replace(/_/g, " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Location & Instructions Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-lg text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">Property / Site:</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {activeJob.property_name || "Client Property"}
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">{activeJob.property_address || "Accra, Ghana"}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium">Specific Space & Location:</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {activeJob.building_name ? `${activeJob.building_name} • ` : ""}
                      {activeJob.space_name || "General Facility Area"}
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">Client: {activeJob.client_name || "Direct Client"}</p>
                  </div>

                  {activeJob.instructions && (
                    <div className="sm:col-span-2 pt-2 border-t border-slate-200/50 dark:border-slate-800">
                      <span className="text-slate-400 font-medium">Work Instructions:</span>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                        {activeJob.instructions}
                      </p>
                    </div>
                  )}
                </div>

                {/* Interactive Status Transition Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {activeJob.status === "ASSIGNED" && (
                    <button
                      onClick={() => handleStatusTransition("TRAVELING")}
                      disabled={transitioning}
                      className="btn-primary text-xs px-4 py-2 flex items-center gap-2 font-medium"
                    >
                      <Navigation size={14} /> Start Travel to Site
                    </button>
                  )}

                  {activeJob.status === "TRAVELING" && (
                    <button
                      onClick={() => handleStatusTransition("ON_SITE")}
                      disabled={transitioning}
                      className="btn-primary text-xs px-4 py-2 flex items-center gap-2 font-medium bg-amber-600 hover:bg-amber-700 border-amber-600"
                    >
                      <MapPin size={14} /> Arrived at Site
                    </button>
                  )}

                  {activeJob.status === "ON_SITE" && (
                    <div className="w-full space-y-3 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                        <ShieldAlert size={16} /> Pre-Work Safety Briefing & Risk Assessment
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={safetyChecked}
                          onChange={(e) => setSafetyChecked(e.target.checked)}
                          className="rounded text-emerald-600"
                        />
                        I confirm all PPE is donned, lock-out/tag-out verified, and hazard inspection completed.
                      </label>
                      <button
                        onClick={() => handleStatusTransition("IN_PROGRESS")}
                        disabled={transitioning || !safetyChecked}
                        className="btn-primary text-xs px-4 py-2 flex items-center gap-2 font-medium"
                      >
                        <Clock size={14} /> Begin Work / Clock In
                      </button>
                    </div>
                  )}

                  {activeJob.status === "IN_PROGRESS" && (
                    <button
                      onClick={() => setShowSignoffModal(true)}
                      className="btn-primary text-xs px-4 py-2 flex items-center gap-2 font-medium bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle size={14} /> Complete Job & Client Sign-off
                    </button>
                  )}

                  {activeJob.status === "COMPLETED" && (
                    <span className="text-xs text-green-700 dark:text-green-400 font-semibold flex items-center gap-1.5 bg-green-50 dark:bg-green-950/40 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle size={15} /> Job Completed & Signed Off by Client
                    </span>
                  )}
                </div>
              </div>

              {/* Digital Inspection Checklist Runner */}
              {activeJob.status !== "COMPLETED" && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-emerald-600" />
                      Digital Inspection Checklist
                    </h4>

                    {/* Template Picker */}
                    <select
                      className="input text-xs py-1.5 max-w-xs"
                      onChange={(e) => handleLoadChecklistTemplate(e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>Load Inspection Template...</option>
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.template_name} ({tpl.service_line?.slice(0, 4)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {!selectedTemplate ? (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      Select an inspection template above to run equipment/facility checks.
                    </p>
                  ) : checklistCompleted ? (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2">
                      <CheckCircle size={16} /> Checklist successfully executed and saved.
                    </div>
                  ) : (
                    <form onSubmit={handleChecklistSubmit} className="space-y-3">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {selectedTemplate.template_name}
                      </div>

                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {(selectedTemplate.items || []).map((item) => {
                          const val = checklistValues[item.id] || {};
                          return (
                            <div
                              key={item.id}
                              className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
                                item.is_critical 
                                  ? "bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50" 
                                  : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              <div className="flex-1">
                                {item.section_header && (
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                    {item.section_header}
                                  </span>
                                )}
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {item.item_text}
                                </span>
                                {item.is_critical && (
                                  <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-red-100 text-red-700 font-bold">
                                    CRITICAL
                                  </span>
                                )}
                              </div>

                              {/* Input by field type */}
                              <div className="flex items-center gap-2 shrink-0">
                                {item.field_type === "PASS_FAIL" && (
                                  <div className="inline-flex rounded-md shadow-sm">
                                    <button
                                      type="button"
                                      onClick={() => setChecklistValues({
                                        ...checklistValues,
                                        [item.id]: { ...val, status_result: "PASS" }
                                      })}
                                      className={`px-3 py-1 text-xs font-medium rounded-l-md border ${
                                        val.status_result === "PASS"
                                          ? "bg-green-600 text-white border-green-600"
                                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                      }`}
                                    >
                                      PASS
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setChecklistValues({
                                        ...checklistValues,
                                        [item.id]: { ...val, status_result: "FAIL" }
                                      })}
                                      className={`px-3 py-1 text-xs font-medium rounded-r-md border-t border-b border-r ${
                                        val.status_result === "FAIL"
                                          ? "bg-red-600 text-white border-red-600"
                                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                      }`}
                                    >
                                      FAIL
                                    </button>
                                  </div>
                                )}

                                {item.field_type === "NUMERIC_READING" && (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      step="0.01"
                                      className="input text-xs py-1 px-2 w-24 font-mono text-right"
                                      placeholder="Value"
                                      value={val.numeric_value}
                                      onChange={(e) => setChecklistValues({
                                        ...checklistValues,
                                        [item.id]: { ...val, numeric_value: e.target.value }
                                      })}
                                      required
                                    />
                                    <span className="text-slate-400 font-mono text-xs">
                                      {item.unit_of_measure || ""}
                                    </span>
                                    {item.min_reading && item.max_reading && (
                                      <span className="text-[10px] text-slate-400">
                                        ({item.min_reading}-{item.max_reading})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={checklistSubmitting}
                          className="btn-primary text-xs px-4 py-2 font-medium"
                        >
                          {checklistSubmitting ? "Recording Checklist..." : "Save Checklist Evaluation"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Customer Sign-off & Completion Modal */}
      {showSignoffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
              <h3 className="font-semibold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <UserCheck size={18} className="text-emerald-600" />
                Work Order Completion & Client Sign-Off
              </h3>
              <button onClick={() => setShowSignoffModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ×
              </button>
            </div>

            <form onSubmit={handleCompleteWithSignoff} className="p-6 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="label mb-1">Work Performed Summary <span className="text-red-500">*</span></label>
                  <textarea
                    rows={2}
                    className="input w-full text-xs"
                    placeholder="Describe maintenance or repairs conducted..."
                    value={signoffData.work_performed}
                    onChange={(e) => setSignoffData({ ...signoffData, work_performed: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label mb-1">Total Labor Hours</label>
                    <input
                      type="number"
                      step="0.25"
                      className="input w-full text-xs font-mono"
                      value={signoffData.actual_hours}
                      onChange={(e) => setSignoffData({ ...signoffData, actual_hours: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label mb-1">Customer Satisfaction (1-5)</label>
                    <div className="flex items-center gap-1.5 pt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSignoffData({ ...signoffData, customer_satisfaction_rating: star })}
                          className={`p-1 rounded ${signoffData.customer_satisfaction_rating >= star ? "text-amber-500" : "text-slate-300"}`}
                        >
                          <Star size={18} fill="currentColor" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label mb-1">Customer / Facility Rep Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input w-full text-xs"
                    placeholder="Representative name acknowledging work completion"
                    value={signoffData.customer_signature_name}
                    onChange={(e) => setSignoffData({ ...signoffData, customer_signature_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label mb-1">Customer Feedback / Observations</label>
                  <textarea
                    rows={2}
                    className="input w-full text-xs"
                    placeholder="Optional remarks from customer representative..."
                    value={signoffData.customer_feedback}
                    onChange={(e) => setSignoffData({ ...signoffData, customer_feedback: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowSignoffModal(false)}
                  className="btn btn-secondary text-xs px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completing}
                  className="btn btn-primary text-xs px-4 py-2 font-medium"
                >
                  {completing ? "Submitting..." : "Confirm Sign-off & Close Job"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
