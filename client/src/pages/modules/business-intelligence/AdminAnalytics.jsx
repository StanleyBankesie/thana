import React, { useState, useEffect, useCallback } from "react";
import { Shield } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, KpiCard, SectionCard, DataTable, StatusBar, ErrorAlert, fmtNum } from "./bi.shared.jsx";

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api.get("/bi/administration"); setData(res.data?.data || null); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const u = data?.users || {};
  const total = Number(u.total || 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Administration Analytics" description="User accounts, roles, and system activity" onRefresh={load} loading={loading} />
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Users" value={loading ? "..." : fmtNum(u.total)} icon={Shield} color="brand" />
        <KpiCard label="Active Users" value={loading ? "..." : fmtNum(u.active)} icon={Shield} color="success" />
        <KpiCard label="Inactive Users" value={loading ? "..." : fmtNum(u.inactive)} icon={Shield} color="danger" />
        <KpiCard label="Roles Configured" value={loading ? "..." : fmtNum(data?.roleDistribution?.length)} icon={Shield} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="User Status">
          <div className="p-5 space-y-3">
            {loading ? Array.from({length:2}).map((_,i)=><div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)
              : [
                  { label: "Active", value: u.active, color: "#2E8B1F" },
                  { label: "Inactive", value: u.inactive, color: "#ef4444" },
                ].map((row) => <StatusBar key={row.label} label={row.label} value={row.value} total={total} color={row.color} />)}
          </div>
        </SectionCard>

        <SectionCard title="Users by Role">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <DataTable
                columns={[
                  { key: "role_name", label: "Role", className: "font-semibold text-slate-800 dark:text-slate-200" },
                  { key: "userCount", label: "Users", className: "text-brand-600 dark:text-brand-400 font-bold", render: v => fmtNum(v) },
                ]}
                rows={data?.roleDistribution || []}
                emptyMessage="No role data found."
              />}
        </SectionCard>
      </div>
    </div>
  );
}
