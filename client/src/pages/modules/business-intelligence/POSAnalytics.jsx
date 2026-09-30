import React, { useState, useEffect, useCallback } from "react";
import { Zap } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, KpiCard, SectionCard, MiniBar, DataTable, ErrorAlert, fmtCurrency, fmtNum } from "./bi.shared.jsx";

export default function POSAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api.get("/bi/pos"); setData(res.data?.data || null); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};

  return (
    <div className="space-y-6">
      <PageHeader title="POS Analytics" description="Daily sales, top products, branch performance" onRefresh={load} loading={loading} />
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Sales Today" value={loading ? "..." : fmtCurrency(s.todaySales)} icon={Zap} color="primary" />
        <KpiCard label="Transactions Today" value={loading ? "..." : fmtNum(s.todayTxns)} icon={Zap} color="brand" />
        <KpiCard label="This Month" value={loading ? "..." : fmtCurrency(s.monthSales)} icon={Zap} color="success" />
        <KpiCard label="Avg Transaction" value={loading ? "..." : fmtCurrency(s.avgTxn)} icon={Zap} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Daily Sales Trend (Last 7 Days)">
          <div className="p-5">
            {loading ? <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              : <MiniBar data={data?.dailyTrend || []} valueKey="sales" labelKey="day" color="#F57C00" height={100} />}
          </div>
        </SectionCard>

        <SectionCard title="Sales by Branch">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <DataTable
                columns={[
                  { key: "branch_name", label: "Branch", className: "font-semibold text-slate-800 dark:text-slate-200" },
                  { key: "sales", label: "Sales", className: "text-secondary font-bold", render: v => fmtCurrency(v) },
                  { key: "txns", label: "Txns", className: "text-slate-500", render: v => fmtNum(v) },
                ]}
                rows={data?.byBranch || []}
                emptyMessage="No branch data."
              />}
        </SectionCard>

        <SectionCard title="Top Selling Products" className="lg:col-span-2">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <DataTable
                columns={[
                  { key: "idx", label: "#", className: "text-slate-400 font-bold w-8" },
                  { key: "item_name", label: "Product", className: "font-semibold text-slate-800 dark:text-slate-200" },
                  { key: "qty", label: "Units Sold", className: "text-brand-600 font-bold", render: v => fmtNum(v) },
                  { key: "revenue", label: "Revenue", className: "text-secondary font-bold", render: v => fmtCurrency(v) },
                ]}
                rows={(data?.topProducts || []).map((r, i) => ({ ...r, idx: i + 1 }))}
                emptyMessage="No product data."
              />}
        </SectionCard>
      </div>
    </div>
  );
}
