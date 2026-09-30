/**
 * @fileoverview BI Data Quality & Quarantine Dashboard
 * Monitors enterprise data quality scores, validation checks, and quarantined records inspection.
 */
import React, { useState, useEffect } from "react";
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2,
  RefreshCw, Filter, Search, FileSpreadsheet, Eye, ArrowUpDown
} from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, SectionCard, KpiCard, DataTable, ErrorAlert } from "./bi.shared.jsx";
import { toast } from "react-toastify";

export default function DataQualityPage() {
  const [qualityData, setQualityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected quarantined record for inspection modal
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchQuality = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/bi/data-quality/summary");
      setQualityData(res.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load data quality summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuality();
  }, []);

  const quarantinedColumns = [
    {
      key: "quarantined_at",
      label: "Timestamp",
      render: (v) => <span className="text-xs text-slate-500">{new Date(v).toLocaleString()}</span>
    },
    {
      key: "pipeline_name",
      label: "Pipeline / Dataset",
      render: (v, row) => (
        <div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{v || "Manual Import"}</div>
          <div className="text-[10px] text-slate-400">{row.dataset_name || "Custom Dataset"}</div>
        </div>
      )
    },
    {
      key: "rejection_stage",
      label: "Stage",
      render: (v) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          {v}
        </span>
      )
    },
    {
      key: "reason",
      label: "Rejection Reason",
      render: (v) => (
        <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
          {v}
        </span>
      )
    },
    {
      key: "actions",
      label: "Inspect",
      className: "text-right",
      render: (_, row) => (
        <button
          onClick={() => setSelectedRecord(row)}
          className="btn-secondary text-xs px-2.5 py-1 gap-1"
        >
          <Eye size={12} /> Inspect Payload
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Quality & Integrity Management"
        description="Automated schema validation, missing data detection, duplicate checking, and quarantined rejected records tracking across all ETL pipelines."
        onRefresh={fetchQuality}
        loading={loading}
      />

      {error && <ErrorAlert message={error} onRetry={fetchQuality} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Data Quality Score"
          value={`${qualityData?.summary?.qualityScore ?? 100.0}%`}
          sub="Enterprise Validation Benchmark"
          icon={ShieldCheck}
          color="success"
        />
        <KpiCard
          label="Total Extracted"
          value={Number(qualityData?.summary?.totalRecords || 0).toLocaleString()}
          sub="Records evaluated"
          icon={ArrowUpDown}
          color="brand"
        />
        <KpiCard
          label="Valid & Loaded"
          value={Number(qualityData?.summary?.validRecords || 0).toLocaleString()}
          sub="Clean analytical records"
          icon={CheckCircle2}
          color="success"
        />
        <KpiCard
          label="Rejected & Quarantined"
          value={Number(qualityData?.summary?.rejectedRecords || 0).toLocaleString()}
          sub="Failed quality rules"
          icon={XCircle}
          color={Number(qualityData?.summary?.rejectedRecords || 0) > 0 ? "danger" : "slate"}
        />
      </div>

      {/* Issues by Rule Table */}
      {qualityData?.issuesByRule?.length > 0 && (
        <SectionCard title="Quality Check Breakdown by Rule">
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Rule Name</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Type</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Severity</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] text-right">Violations Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {qualityData.issuesByRule.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{rule.rule_name}</td>
                    <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{rule.rule_type}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rule.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                        rule.severity === 'WARNING' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                        'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}>
                        {rule.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                      {Number(rule.failedCount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Quarantined Records Section */}
      <SectionCard title="Quarantined Records Inspector">
        <DataTable
          columns={quarantinedColumns}
          rows={qualityData?.quarantinedRecords || []}
          emptyMessage="No quarantined records. All processed data meets quality standards."
        />
      </SectionCard>

      {/* Inspect Record Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-erp-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <XCircle size={18} className="text-rose-600" />
                  Quarantined Record Inspection
                </h3>
                <p className="text-xs text-slate-400">Reason: {selectedRecord.reason}</p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Raw Payload</div>
              <pre className="text-[11px] font-mono overflow-auto max-h-60 text-slate-800 dark:text-slate-200">
                {JSON.stringify(selectedRecord.raw_record, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setSelectedRecord(null)} className="btn-secondary text-xs px-4 py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
