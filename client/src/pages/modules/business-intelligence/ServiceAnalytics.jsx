import React, { useState, useEffect, useCallback } from "react";
import { HeadphonesIcon } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, KpiCard, SectionCard, DataTable, StatusBar, ErrorAlert, fmtNum } from "./bi.shared.jsx";

const STATUS_COLOR = { OPEN: "#F57C00", PENDING: "#F57C00", IN_PROGRESS: "#0E3646", COMPLETED: "#2E8B1F", CLOSED: "#2E8B1F" };

export default function ServiceAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api.get("/bi/service"); setData(res.data?.data || null); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};
  const total = Number(s.total || 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Service Analytics" description="Service orders, open requests, completion rates" onRefresh={load} loading={loading} />
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Service Orders" value={loading ? "..." : fmtNum(s.total)} icon={HeadphonesIcon} color="brand" />
        <KpiCard label="Open / Pending" value={loading ? "..." : fmtNum(s.open)} icon={HeadphonesIcon} color="primary" />
        <KpiCard label="In Progress" value={loading ? "..." : fmtNum(s.inProgress)} icon={HeadphonesIcon} color="brand" />
        <KpiCard label="Completed" value={loading ? "..." : fmtNum(s.completed)} icon={HeadphonesIcon} color="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Request Status Breakdown">
          <div className="p-5 space-y-3">
            {loading ? Array.from({length:3}).map((_,i)=><div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)
              : [
                  { label: "Open / Pending", value: s.open, color: "#F57C00" },
                  { label: "In Progress",    value: s.inProgress, color: "#0E3646" },
                  { label: "Completed",      value: s.completed, color: "#2E8B1F" },
                ].map((row) => <StatusBar key={row.label} label={row.label} value={row.value} total={total} color={row.color} />)}
          </div>
        </SectionCard>

        <SectionCard title="Recent Service Orders">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <DataTable
                columns={[
                  { key: "so_number", label: "Order #", className: "font-mono text-brand-700 dark:text-brand-300" },
                  { key: "status", label: "Status", render: (v) => <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: (STATUS_COLOR[v] || "#94a3b8") + "20", color: STATUS_COLOR[v] || "#94a3b8" }}>{v}</span> },
                  { key: "priority", label: "Priority", className: "text-slate-500" },
                  { key: "created_at", label: "Created", render: v => String(v || "").split("T")[0] },
                ]}
                rows={data?.recentRequests || []}
                emptyMessage="No service orders found."
              />}
        </SectionCard>
      </div>
    </div>
  );
}
