/**
 * @fileoverview BI Data Sources Management Page
 * Allows authorized users to connect to internal ERP modules, import Excel/CSV files,
 * test connections, run manual & scheduled syncs, and view sync history logs.
 */
import React, { useState, useEffect, useRef } from "react";
import {
  Database, Plus, RefreshCw, Upload, CheckCircle2, AlertTriangle,
  XCircle, Clock, FileSpreadsheet, Server, Play, History, Settings2, Trash2, Eye
} from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, SectionCard, DataTable, ErrorAlert } from "./bi.shared.jsx";
import { toast } from "react-toastify";

export default function DataSourcesManagement() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal / Drawer states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [syncingId, setSyncingId] = useState(null);

  // Upload Form State
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchSources = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/bi/data-sources");
      setSources(res.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load data sources.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleTestConnection = async (source) => {
    setTestingId(source.id);
    setTestResult(null);
    try {
      const res = await api.post(`/bi/data-sources/${source.id}/test`);
      setTestResult({ sourceId: source.id, ...res.data });
      toast.success(res.data?.message || "Connection verified successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Connection test failed.");
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncNow = async (source) => {
    setSyncingId(source.id);
    try {
      const res = await api.post(`/bi/data-sources/${source.id}/sync`);
      toast.success(`Sync completed! ${res.data?.recordsExtracted || 0} records extracted.`);
      fetchSources();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Sync failed.");
    } finally {
      setSyncingId(null);
    }
  };

  const handleViewHistory = async (source) => {
    setSelectedSource(source);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/bi/data-sources/${source.id}/history`);
      setSyncHistory(res.data?.data || []);
    } catch (err) {
      toast.error("Failed to load sync logs.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.warn("Please select an Excel (.xlsx) or CSV file");
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);

    setUploading(true);
    try {
      const res = await api.post("/bi/upload-source-file", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(res.data?.message || "Dataset imported successfully!");
      setShowUploadModal(false);
      setUploadFile(null);
      fetchSources();
    } catch (err) {
      toast.error(err?.response?.data?.message || "File upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Data Source Name",
      render: (v, row) => (
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            row.source_type === 'ERP' ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300' :
            row.source_type === 'EXCEL' || row.source_type === 'CSV' ? 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
            'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
          }`}>
            {row.source_type === 'ERP' ? <Database size={17} /> :
             row.source_type === 'EXCEL' || row.source_type === 'CSV' ? <FileSpreadsheet size={17} /> :
             <Server size={17} />}
          </div>
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">{v}</div>
            <div className="text-xs text-slate-400">
              {row.erp_module ? `Module: ${row.erp_module.toUpperCase()}` : row.source_type}
            </div>
          </div>
        </div>
      )
    },
    {
      key: "source_type",
      label: "Type",
      render: (v) => (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {v}
        </span>
      )
    },
    {
      key: "status",
      label: "Connection Status",
      render: (v) => {
        const isOk = v === 'CONNECTED';
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
            isOk ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                   'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {v}
          </span>
        );
      }
    },
    {
      key: "last_sync_at",
      label: "Last Sync",
      render: (v, row) => (
        <div>
          <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {v ? new Date(v).toLocaleString() : "Never Synced"}
          </div>
          {row.last_sync_status && (
            <div className="text-[10px] text-slate-400">
              Status: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{row.last_sync_status}</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: "total_records",
      label: "Records",
      render: (v) => <span className="font-mono text-xs">{Number(v || 0).toLocaleString()}</span>
    },
    {
      key: "sync_frequency",
      label: "Frequency",
      render: (v) => (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
          <Clock size={12} /> {v}
        </span>
      )
    },
    {
      key: "actions",
      label: "Actions",
      className: "text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleTestConnection(row)}
            disabled={testingId === row.id}
            title="Test Connection"
            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
          >
            <CheckCircle2 size={15} className={testingId === row.id ? "animate-spin text-brand-600" : ""} />
          </button>
          <button
            onClick={() => handleSyncNow(row)}
            disabled={syncingId === row.id}
            title="Sync Now"
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
          >
            <RefreshCw size={15} className={syncingId === row.id ? "animate-spin text-emerald-600" : ""} />
          </button>
          <button
            onClick={() => handleViewHistory(row)}
            title="Sync History"
            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
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
        title="Data Sources & Ingestion"
        description="Connect operational ERP modules, upload external Excel/CSV spreadsheets, and manage ETL sync pipelines."
        onRefresh={fetchSources}
        loading={loading}
      >
        <button
          onClick={() => setShowUploadModal(true)}
          className="btn-primary text-sm px-4 py-2 gap-2 flex items-center shadow-erp"
        >
          <Upload size={14} /> Import File Source
        </button>
      </PageHeader>

      {error && <ErrorAlert message={error} onRetry={fetchSources} />}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 flex items-center justify-center">
            <Database size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{sources.length}</div>
            <div className="text-xs text-slate-400">Total Configured Sources</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {sources.filter(s => s.status === 'CONNECTED').length}
            </div>
            <div className="text-xs text-slate-400">Connected & Verified</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center">
            <Server size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {sources.reduce((sum, s) => sum + Number(s.total_records || 0), 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400">Total Records Ingested</div>
          </div>
        </div>
      </div>

      {/* Main Sources Table */}
      <SectionCard title="Configured Data Sources">
        <DataTable
          columns={columns}
          rows={sources}
          emptyMessage="No data sources configured yet."
        />
      </SectionCard>

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-erp-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-brand-600" />
                Import External Dataset
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleFileUpload} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload an Excel (.xlsx, .xls) or CSV file. The BI ETL engine will parse headers, validate rows, and auto-register a new analytical dataset.
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files[0] || null)}
                />
                <Upload size={28} className="text-slate-400 mb-2" />
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {uploadFile ? uploadFile.name : "Click to select or drag & drop file"}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Supports XLSX, XLS, CSV (up to 50MB)</div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="btn-primary text-xs px-4 py-2 gap-2 flex items-center"
                >
                  {uploading ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                  {uploading ? "Ingesting Dataset..." : "Import & Process"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sync History Drawer/Modal */}
      {showHistoryModal && selectedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-2xl shadow-erp-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History size={18} className="text-brand-600" />
                  Sync History: {selectedSource.name}
                </h3>
                <p className="text-xs text-slate-400">Execution logs and record count checkpoints</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {historyLoading ? (
              <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading sync logs...</div>
            ) : syncHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic">No sync logs found for this data source.</div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {syncHistory.map((h) => (
                  <div key={h.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {h.sync_type} SYNC — {h.status}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Started: {new Date(h.started_at).toLocaleString()} • Duration: {h.duration_ms}ms
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-emerald-600 font-semibold">{Number(h.records_extracted || 0).toLocaleString()}</span> extracted
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setShowHistoryModal(false)} className="btn-secondary text-xs px-4 py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
