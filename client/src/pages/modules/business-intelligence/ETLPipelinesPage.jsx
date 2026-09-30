/**
 * @fileoverview BI ETL Pipelines Management & Execution Page
 * Visual pipeline manager showing 6-stage ETL progression:
 * EXTRACT -> VALIDATE -> TRANSFORM -> QUALITY CHECK -> LOAD -> COMPLETE
 */
import React, { useState, useEffect } from "react";
import {
  GitPullRequest, Play, Plus, RefreshCw, CheckCircle2,
  XCircle, Clock, AlertTriangle, FileText, ArrowRight, ShieldCheck, History
} from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, SectionCard, DataTable, ErrorAlert } from "./bi.shared.jsx";
import { toast } from "react-toastify";

const STAGES = ["EXTRACT", "VALIDATE", "TRANSFORM", "QUALITY_CHECK", "LOAD", "COMPLETE"];

export default function ETLPipelinesPage() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Execution & Logs Drawer State
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [showRunsModal, setShowRunsModal] = useState(false);

  const [selectedRun, setSelectedRun] = useState(null);
  const [runLogs, setRunLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [runningId, setRunningId] = useState(null);

  const fetchPipelines = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/bi/etl-pipelines");
      setPipelines(res.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load ETL pipelines.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipelines();
  }, []);

  const handleRunPipeline = async (pipeline) => {
    setRunningId(pipeline.id);
    try {
      const res = await api.post(`/bi/etl-pipelines/${pipeline.id}/run`);
      toast.success(`Pipeline "${pipeline.name}" completed! ${res.data?.recordsLoaded || 0} records loaded.`);
      fetchPipelines();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Pipeline execution failed.");
    } finally {
      setRunningId(null);
    }
  };

  const handleOpenRuns = async (pipeline) => {
    setSelectedPipeline(pipeline);
    setShowRunsModal(true);
    setRunsLoading(true);
    setSelectedRun(null);
    setRunLogs([]);
    try {
      const res = await api.get(`/bi/etl-pipelines/${pipeline.id}/runs`);
      setRuns(res.data?.data || []);
    } catch (err) {
      toast.error("Failed to load pipeline runs.");
    } finally {
      setRunsLoading(false);
    }
  };

  const handleViewLogs = async (run) => {
    setSelectedRun(run);
    setLogsLoading(true);
    try {
      const res = await api.get(`/bi/etl-pipeline-runs/${run.id}/logs`);
      setRunLogs(res.data?.data || []);
    } catch (err) {
      toast.error("Failed to load stage logs.");
    } finally {
      setLogsLoading(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Pipeline Name & Route",
      render: (v, row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 flex items-center justify-center">
            <GitPullRequest size={17} />
          </div>
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">{v}</div>
            <div className="text-xs text-slate-400">
              Source: <span className="text-slate-600 dark:text-slate-300 font-medium">{row.source_name}</span> → Dest: <span className="text-slate-600 dark:text-slate-300 font-medium">{row.target_dataset_name}</span>
            </div>
          </div>
        </div>
      )
    },
    {
      key: "status",
      label: "Status",
      render: (v) => {
        const isOk = v === 'ACTIVE';
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
            isOk ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {v}
          </span>
        );
      }
    },
    {
      key: "last_run_at",
      label: "Last Execution",
      render: (v, row) => (
        <div>
          <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {v ? new Date(v).toLocaleString() : "Never Run"}
          </div>
          <div className="text-[10px] text-slate-400">
            Duration: <span className="font-mono">{row.last_run_duration || 1}s</span>
          </div>
        </div>
      )
    },
    {
      key: "records_loaded",
      label: "Records Ingested",
      render: (v, row) => (
        <div className="text-xs">
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{Number(v || 0).toLocaleString()}</span> loaded
          {row.records_rejected > 0 && (
            <span className="text-rose-500 font-mono ml-1">({row.records_rejected} rej)</span>
          )}
        </div>
      )
    },
    {
      key: "schedule_cron",
      label: "Schedule",
      render: (v) => (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 font-mono">
          <Clock size={12} /> {v || "0 1 * * *"}
        </span>
      )
    },
    {
      key: "actions",
      label: "Actions",
      className: "text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleRunPipeline(row)}
            disabled={runningId === row.id}
            title="Execute Pipeline Now"
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
          >
            <Play size={15} className={runningId === row.id ? "animate-spin text-emerald-600" : ""} />
          </button>
          <button
            onClick={() => handleOpenRuns(row)}
            title="View Execution History & Logs"
            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
          >
            <History size={15} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="ETL Pipeline Orchestration"
        description="Automated Extract, Transform, Validate, Quality Check, and Load data workflows running on scheduled background cron or manual execution."
        onRefresh={fetchPipelines}
        loading={loading}
      />

      {error && <ErrorAlert message={error} onRetry={fetchPipelines} />}

      {/* Visual Pipeline Workflow Architecture Stepper */}
      <SectionCard title="ETL Pipeline Workflow Stages">
        <div className="p-5 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px] gap-2">
            {STAGES.map((stg, idx) => (
              <React.Fragment key={stg}>
                <div className="flex flex-col items-center gap-1.5 text-center flex-1">
                  <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/30 border-2 border-brand-500 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-xs">
                    {idx + 1}
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{stg.replace(/_/g, ' ')}</span>
                  <span className="text-[9px] text-slate-400">
                    {stg === 'EXTRACT' ? 'ERP / File Query' :
                     stg === 'VALIDATE' ? 'Schema Check' :
                     stg === 'TRANSFORM' ? 'Formulas & Cast' :
                     stg === 'QUALITY_CHECK' ? 'Quarantine & Score' :
                     stg === 'LOAD' ? 'Fact Upsert' : 'Complete & Audit'}
                  </span>
                </div>
                {idx < STAGES.length - 1 && (
                  <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Pipelines Table */}
      <SectionCard title="Configured ETL Pipelines">
        <DataTable
          columns={columns}
          rows={pipelines}
          emptyMessage="No ETL pipelines configured yet."
        />
      </SectionCard>

      {/* Pipeline Runs & Stage Logs Modal */}
      {showRunsModal && selectedPipeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-4xl shadow-erp-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History size={18} className="text-brand-600" />
                  Pipeline Runs: {selectedPipeline.name}
                </h3>
                <p className="text-xs text-slate-400">Execution history, quality scores, duration, and stage logs</p>
              </div>
              <button onClick={() => setShowRunsModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Runs List */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Historical Runs</div>
                {runsLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading runs...</div>
                ) : runs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 italic">No execution runs yet.</div>
                ) : (
                  runs.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => handleViewLogs(r)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-1 ${
                        selectedRun?.id === r.id
                          ? "border-brand-500 bg-brand-50/40 dark:bg-brand-900/30"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Run #{r.id} ({r.run_type})
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                                     'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{new Date(r.started_at).toLocaleString()}</span>
                        <span>{r.duration_seconds || 1}s</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        Extracted: {r.records_extracted} • Loaded: {r.records_loaded} • Quality: <span className="font-bold text-emerald-600">{r.quality_score}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Right Column: Stage Logs */}
              <div className="space-y-2 border-l border-slate-100 dark:border-slate-800 pl-4 max-h-80 overflow-y-auto">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {selectedRun ? `Stage Logs (Run #${selectedRun.id})` : "Select a run to view stage logs"}
                </div>
                {logsLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading logs...</div>
                ) : runLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 italic">No logs recorded for this run.</div>
                ) : (
                  <div className="space-y-2">
                    {runLogs.map((l) => (
                      <div key={l.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-brand-900 dark:text-brand-300 text-[11px] font-mono">
                            [{l.stage}] {l.level}
                          </span>
                          <span className="text-[10px] text-slate-400">{new Date(l.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 text-[11px]">{l.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setShowRunsModal(false)} className="btn-secondary text-xs px-4 py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
