/**
 * @fileoverview BI Datasets Catalog Page
 * Lists analytical datasets, metadata, schema definitions, data freshness,
 * and allows inspecting data lineage and tabular previews.
 */
import React, { useState, useEffect } from "react";
import {
  Layers, Database, Calendar, Clock, GitBranch, Eye,
  RefreshCw, CheckCircle2, FileText, ArrowRight, Table2
} from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, SectionCard, DataTable, ErrorAlert } from "./bi.shared.jsx";
import { toast } from "react-toastify";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Preview & Lineage state
  const [previewDataset, setPreviewDataset] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [lineageDataset, setLineageDataset] = useState(null);
  const [showLineageModal, setShowLineageModal] = useState(false);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/bi/datasets");
      setDatasets(res.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load datasets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleOpenPreview = async (ds) => {
    setPreviewDataset(ds);
    setShowPreviewModal(true);
    setPreviewLoading(true);
    try {
      const res = await api.get(`/bi/datasets/${ds.id}/preview`);
      setPreviewRows(res.data?.rows || []);
    } catch (err) {
      toast.error("Failed to load dataset preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenLineage = (ds) => {
    setLineageDataset(ds);
    setShowLineageModal(true);
  };

  const columns = [
    {
      key: "name",
      label: "Dataset Name & Code",
      render: (v, row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 flex items-center justify-center">
            <Layers size={17} />
          </div>
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">{v}</div>
            <div className="text-xs text-slate-400 font-mono">{row.code}</div>
          </div>
        </div>
      )
    },
    {
      key: "category",
      label: "Category",
      render: (v) => (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {v}
        </span>
      )
    },
    {
      key: "storage_type",
      label: "Storage Model",
      render: (v, row) => (
        <div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {v === 'FACT_TABLE' ? 'Star Schema Fact Table' : v}
          </span>
          {row.target_table && (
            <div className="text-[10px] text-slate-400 font-mono">{row.target_table}</div>
          )}
        </div>
      )
    },
    {
      key: "refresh_mode",
      label: "Refresh Mode",
      render: (v) => {
        const isRealTime = v === 'REAL_TIME';
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
            isRealTime ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                         'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isRealTime ? 'bg-blue-500' : 'bg-slate-400'}`} />
            {v}
          </span>
        );
      }
    },
    {
      key: "row_count",
      label: "Estimated Rows",
      render: (v) => <span className="font-mono text-xs">{Number(v || 0).toLocaleString()}</span>
    },
    {
      key: "last_refreshed_at",
      label: "Data Freshness",
      render: (v) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {v ? new Date(v).toLocaleString() : "Real-time query"}
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
            onClick={() => handleOpenLineage(row)}
            title="View Data Lineage"
            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
          >
            <GitBranch size={15} />
          </button>
          <button
            onClick={() => handleOpenPreview(row)}
            title="Preview Tabular Data"
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
          >
            <Eye size={15} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytical Datasets Catalog"
        description="Unified dimensional and fact datasets optimized for high-performance BI reporting, slicing, and drill-downs."
        onRefresh={fetchDatasets}
        loading={loading}
      />

      {error && <ErrorAlert message={error} onRetry={fetchDatasets} />}

      <SectionCard title="Registered Analytical Datasets">
        <DataTable
          columns={columns}
          rows={datasets}
          emptyMessage="No datasets registered yet."
        />
      </SectionCard>

      {/* Lineage Modal */}
      {showLineageModal && lineageDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-xl shadow-erp-lg space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <GitBranch size={18} className="text-brand-600" />
                  Data Lineage: {lineageDataset.name}
                </h3>
                <p className="text-xs text-slate-400">Complete end-to-end traceability of this dataset</p>
              </div>
              <button onClick={() => setShowLineageModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Lineage Steps Visualization */}
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">1. Operational Source</div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {lineageDataset.lineage_metadata?.source || "OmniSuite ERP Operational Database"}
                  </div>
                </div>
                <Database size={18} className="text-brand-600" />
              </div>

              <div className="flex justify-center text-slate-400">
                <ArrowRight size={16} className="rotate-90" />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">2. Transformation & Quality Pipeline</div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {lineageDataset.lineage_metadata?.pipeline || "Daily Incremental ETL Pipeline"}
                  </div>
                  <div className="text-[10px] text-slate-400">Validation: Missing checks, numeric casts, gross profit formulas</div>
                </div>
                <RefreshCw size={18} className="text-emerald-600" />
              </div>

              <div className="flex justify-center text-slate-400">
                <ArrowRight size={16} className="rotate-90" />
              </div>

              <div className="p-3 bg-brand-50 dark:bg-brand-900/30 rounded-xl border border-brand-200 dark:border-brand-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase">3. Target Analytical Store</div>
                  <div className="text-xs font-semibold text-brand-900 dark:text-brand-200">
                    {lineageDataset.target_table || lineageDataset.name}
                  </div>
                  <div className="text-[10px] text-brand-700 dark:text-brand-300">Optimized Fact Table with DimDate & DimCustomer indexes</div>
                </div>
                <CheckCircle2 size={18} className="text-brand-600" />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setShowLineageModal(false)} className="btn-secondary text-xs px-4 py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabular Preview Modal */}
      {showPreviewModal && previewDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-4xl shadow-erp-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Table2 size={18} className="text-brand-600" />
                  Dataset Preview: {previewDataset.name}
                </h3>
                <p className="text-xs text-slate-400">Sample of latest 50 records in the analytical layer</p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {previewLoading ? (
              <div className="py-12 text-center text-xs text-slate-400 animate-pulse">Loading preview records...</div>
            ) : previewRows.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 italic">No records loaded in this dataset yet.</div>
            ) : (
              <div className="max-h-96 overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-brand-50 dark:bg-brand-900/30 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      {Object.keys(previewRows[0] || {}).map((k) => (
                        <th key={k} className="py-2.5 px-3 font-semibold text-brand-900 dark:text-brand-200 uppercase tracking-wider text-[10px]">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewRows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {Object.keys(r).map((k) => (
                          <td key={k} className="py-2 px-3 text-slate-700 dark:text-slate-300">
                            {r[k] !== null && r[k] !== undefined ? String(r[k]) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400">Showing {previewRows.length} sample rows</span>
              <button onClick={() => setShowPreviewModal(false)} className="btn-secondary text-xs px-4 py-2">
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
