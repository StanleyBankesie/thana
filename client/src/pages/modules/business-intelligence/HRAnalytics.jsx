import React, { useState, useEffect, useCallback } from "react";
import { Users } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, KpiCard, SectionCard, DataTable, StatusBar, ErrorAlert, fmtNum } from "./bi.shared.jsx";

export default function HRAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api.get("/bi/hr"); setData(res.data?.data || null); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};
  const att = data?.attendanceToday || {};
  const totalAtt = Number(att.total || 0);
  const attPct = totalAtt > 0 ? Math.round(Number(att.present || 0) / totalAtt * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="HR Analytics" description="Employee headcount, attendance, and department breakdown" onRefresh={load} loading={loading} />
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Headcount" value={loading ? "..." : fmtNum(s.total)} icon={Users} color="brand" />
        <KpiCard label="Active Employees" value={loading ? "..." : fmtNum(s.active)} icon={Users} color="success" />
        <KpiCard label="On Probation" value={loading ? "..." : fmtNum(s.probation)} icon={Users} color="primary" />
        <KpiCard label="Attendance Today" value={loading ? "..." : `${attPct}%`} sub={`${fmtNum(att.present)} present`} icon={Users} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Today's Attendance">
          <div className="p-5 space-y-3">
            {loading ? Array.from({length:3}).map((_,i)=><div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)
              : [
                  { label: "Present", value: att.present, color: "#2E8B1F" },
                  { label: "Absent",  value: att.absent,  color: "#ef4444" },
                  { label: "Late",    value: att.late,    color: "#F57C00" },
                ].map((r) => <StatusBar key={r.label} label={r.label} value={r.value} total={totalAtt} color={r.color} />)}
            {!totalAtt && !loading && <div className="text-xs text-slate-400 text-center py-4">No attendance records for today.</div>}
          </div>
        </SectionCard>

        <SectionCard title="Headcount by Department">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <DataTable
                columns={[
                  { key: "department_name", label: "Department", className: "font-semibold text-slate-800 dark:text-slate-200" },
                  { key: "count", label: "Employees", className: "text-brand-600 dark:text-brand-400 font-bold", render: v => fmtNum(v) },
                ]}
                rows={data?.byDepartment || []}
                emptyMessage="No department data."
              />}
        </SectionCard>

        <SectionCard title="Recent Hires" className="lg:col-span-2">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(data?.recentHires || []).map((h, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-300 text-xs font-bold">
                        {String(h.first_name||"?")[0]}{String(h.last_name||"?")[0]}
                      </div>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{h.first_name} {h.last_name}</span>
                    </div>
                    <span className="text-xs text-slate-400">{String(h.date_joined||"").split("T")[0]}</span>
                  </div>
                ))}
                {!data?.recentHires?.length && <div className="p-8 text-center text-slate-400 text-sm">No recent hires found.</div>}
              </div>}
        </SectionCard>
      </div>
    </div>
  );
}
