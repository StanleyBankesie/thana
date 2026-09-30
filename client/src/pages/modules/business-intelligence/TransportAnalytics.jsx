import React, { useState, useEffect, useCallback } from "react";
import { Truck } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, KpiCard, SectionCard, MiniBar, DataTable, StatusBar, ErrorAlert, fmtNum } from "./bi.shared.jsx";

export default function TransportAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api.get("/bi/transport"); setData(res.data?.data || null); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const v = data?.vehicles || {};
  const t = data?.trips || {};

  return (
    <div className="space-y-6">
      <PageHeader title="Transport Analytics" description="Fleet status, trip performance, and driver productivity" onRefresh={load} loading={loading} />
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Fleet" value={loading ? "..." : fmtNum(v.total)} icon={Truck} color="brand" />
        <KpiCard label="Available" value={loading ? "..." : fmtNum(v.available)} icon={Truck} color="success" />
        <KpiCard label="In Use" value={loading ? "..." : fmtNum(v.inUse)} icon={Truck} color="brand" />
        <KpiCard label="Trips Today" value={loading ? "..." : fmtNum(t.today)} icon={Truck} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Fleet Status">
          <div className="p-5 space-y-3">
            {loading ? Array.from({length:3}).map((_,i)=><div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)
              : [
                  { label: "Available",    value: v.available,    color: "#2E8B1F" },
                  { label: "In Use",       value: v.inUse,        color: "#0E3646" },
                  { label: "Maintenance",  value: v.maintenance,  color: "#F57C00" },
                ].map((r) => <StatusBar key={r.label} label={r.label} value={r.value} total={Number(v.total||0)} color={r.color} />)}
          </div>
        </SectionCard>

        <SectionCard title="Trips Trend (Last 6 Months)">
          <div className="p-5">
            {loading ? <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              : <MiniBar data={data?.tripsTrend || []} valueKey="trips" labelKey="month" color="#0E3646" height={100} />}
          </div>
        </SectionCard>

        <SectionCard title="Top Drivers (Last 30 Days)" className="lg:col-span-2">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <DataTable
                columns={[
                  { key: "idx", label: "#", className: "text-slate-400 font-bold w-8" },
                  { key: "driver_name", label: "Driver", className: "font-semibold text-slate-800 dark:text-slate-200" },
                  { key: "trips", label: "Total Trips", className: "text-brand-600 font-bold", render: v => fmtNum(v) },
                  { key: "completed", label: "Completed", className: "text-secondary font-bold", render: v => fmtNum(v) },
                  { key: "completion", label: "Rate", render: (_, row) => { const r = Number(row.trips)>0 ? (Number(row.completed)/Number(row.trips)*100).toFixed(0) : 0; return `${r}%`; }},
                ]}
                rows={(data?.topDrivers || []).map((r, i) => ({ ...r, idx: i + 1 }))}
                emptyMessage="No driver data found."
              />}
        </SectionCard>
      </div>
    </div>
  );
}
