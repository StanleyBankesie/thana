import React, { useState, useEffect, useCallback } from "react";
import { Wrench } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, KpiCard, SectionCard, DataTable, StatusBar, ErrorAlert, fmtNum } from "./bi.shared.jsx";

export default function MaintenanceAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api.get("/bi/maintenance-analytics"); setData(res.data?.data || null); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const j = data?.jobs || {};
  const a = data?.assets || {};

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance Analytics" description="Job orders, asset status, and maintenance workload" onRefresh={load} loading={loading} />
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Job Orders" value={loading ? "..." : fmtNum(j.total)} icon={Wrench} color="brand" />
        <KpiCard label="Open Jobs" value={loading ? "..." : fmtNum(j.open)} icon={Wrench} color="danger" />
        <KpiCard label="Completed Jobs" value={loading ? "..." : fmtNum(j.completed)} icon={Wrench} color="success" />
        <KpiCard label="Total Assets" value={loading ? "..." : fmtNum(a.total)} sub={`${fmtNum(a.underMaintenance)} under service`} icon={Wrench} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Job Order Status">
          <div className="p-5 space-y-3">
            {loading ? Array.from({length:2}).map((_,i)=><div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)
              : [
                  { label: "Open", value: j.open, color: "#ef4444" },
                  { label: "Completed", value: j.completed, color: "#2E8B1F" },
                ].map((row) => <StatusBar key={row.label} label={row.label} value={row.value} total={Number(j.total||0)} color={row.color} />)}
          </div>
        </SectionCard>

        <SectionCard title="Asset Status">
          <div className="p-5 space-y-3">
            {loading ? Array.from({length:2}).map((_,i)=><div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)
              : [
                  { label: "Active", value: a.active, color: "#2E8B1F" },
                  { label: "Under Maintenance", value: a.underMaintenance, color: "#F57C00" },
                ].map((row) => <StatusBar key={row.label} label={row.label} value={row.value} total={Number(a.total||0)} color={row.color} />)}
          </div>
        </SectionCard>

        <SectionCard title="Recent Job Orders" className="lg:col-span-2">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <DataTable
                columns={[
                  { key: "job_number", label: "Job #", className: "font-mono text-brand-700 dark:text-brand-300" },
                  { key: "description", label: "Description", className: "text-slate-700 dark:text-slate-300" },
                  { key: "status", label: "Status" },
                  { key: "priority", label: "Priority", className: "text-slate-500" },
                  { key: "created_at", label: "Created", render: v => String(v || "").split("T")[0] },
                ]}
                rows={data?.recentJobs || []}
                emptyMessage="No maintenance jobs found."
              />}
        </SectionCard>
      </div>
    </div>
  );
}
