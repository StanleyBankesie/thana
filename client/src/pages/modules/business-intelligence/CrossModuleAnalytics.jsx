import React, { useState, useEffect, useCallback } from "react";
import { Layers, Factory, DollarSign, ShoppingCart, FolderKanban } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, SectionCard, DataTable, ErrorAlert, fmtCurrency, fmtNum } from "./bi.shared.jsx";

export default function CrossModuleAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/bi/cross-module");
      setData(res.data?.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load cross-module analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cross Module Analytics & Intelligence"
        description="Unified correlations across Projects, Production, Inventory, and POS Sales"
        onRefresh={load}
        loading={loading}
      />
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Profitability */}
        <SectionCard title="Project Margin & Profitability (Finance + Projects)">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: "project_name",
                  label: "Project",
                  className: "font-semibold text-slate-800 dark:text-slate-200",
                },
                {
                  key: "revenue",
                  label: "Revenue / Billing",
                  className: "text-emerald-600 dark:text-emerald-400 font-bold",
                  render: (v) => fmtCurrency(v),
                },
                {
                  key: "cost",
                  label: "Expenses",
                  className: "text-slate-600 dark:text-slate-300 font-bold",
                  render: (v) => fmtCurrency(v),
                },
                {
                  key: "profit",
                  label: "Net Profit",
                  className: "font-bold",
                  render: (_, row) => {
                    const p = Number(row.revenue || 0) - Number(row.cost || 0);
                    return (
                      <span className={p >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {fmtCurrency(p)}
                      </span>
                    );
                  },
                },
              ]}
              rows={data?.projectProfitability || []}
              emptyMessage="No completed projects with profitability data."
            />
          )}
        </SectionCard>

        {/* Manufacturing Output vs Inventory */}
        <SectionCard title="Production Output vs Current Inventory (Production + Inventory)">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: "item_name",
                  label: "Manufactured Product",
                  className: "font-semibold text-slate-800 dark:text-slate-200",
                },
                {
                  key: "producedQty",
                  label: "Produced Qty",
                  className: "text-brand-600 font-bold",
                  render: (v) => `${fmtNum(v)} units`,
                },
                {
                  key: "inStockQty",
                  label: "Available in Stock",
                  className: "text-emerald-600 dark:text-emerald-400 font-bold",
                  render: (v) => `${fmtNum(v)} units`,
                },
              ]}
              rows={data?.productionVsInventory || []}
              emptyMessage="No production output data correlated with inventory yet."
            />
          )}
        </SectionCard>

        {/* Top POS Items vs Inventory */}
        <SectionCard title="Top POS Items vs Inventory (Last 30 Days)" className="lg:col-span-2">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: "item_name",
                  label: "Item",
                  className: "font-semibold text-slate-800 dark:text-slate-200",
                },
                {
                  key: "unitsSold",
                  label: "Units Sold",
                  className: "text-brand-600 font-bold",
                  render: (v) => fmtNum(v),
                },
                {
                  key: "posRevenue",
                  label: "POS Revenue",
                  className: "text-emerald-600 dark:text-emerald-400 font-bold",
                  render: (v) => fmtCurrency(v),
                },
              ]}
              rows={data?.inventoryPosSales || []}
              emptyMessage="No POS sales data found."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
