import React, { useState, useEffect, useCallback } from "react";
import { Layers, DollarSign, ShoppingCart, Package, Zap } from "lucide-react";
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
        description="Unified correlations across Sales, Purchase, Inventory, Finance, and POS"
        onRefresh={load}
        loading={loading}
      />
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Receivables vs Sales */}
        <SectionCard title="Sales & Receivables Overview (Finance + Sales)">
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
                  key: "customer_name",
                  label: "Account / Entity",
                  className: "font-semibold text-slate-800 dark:text-slate-200",
                  render: (v, row) => v || row.project_name || "General Sales",
                },
                {
                  key: "revenue",
                  label: "Invoiced Revenue",
                  className: "text-emerald-600 dark:text-emerald-400 font-bold",
                  render: (v) => fmtCurrency(v),
                },
                {
                  key: "cost",
                  label: "Balance / Outstanding",
                  className: "text-slate-600 dark:text-slate-300 font-bold",
                  render: (v) => fmtCurrency(v),
                },
                {
                  key: "profit",
                  label: "Collected / Net",
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
              rows={data?.projectProfitability || data?.salesReceivables || []}
              emptyMessage="No sales and receivables cross-module data available."
            />
          )}
        </SectionCard>

        {/* Procurement vs Current Inventory */}
        <SectionCard title="Procurement vs Available Inventory (Purchase + Inventory)">
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
                  label: "Product Name",
                  className: "font-semibold text-slate-800 dark:text-slate-200",
                },
                {
                  key: "producedQty",
                  label: "Purchased Qty",
                  className: "text-brand-600 font-bold",
                  render: (v) => `${fmtNum(v)} units`,
                },
                {
                  key: "inStockQty",
                  label: "Current Stock",
                  className: "text-emerald-600 dark:text-emerald-400 font-bold",
                  render: (v) => `${fmtNum(v)} units`,
                },
              ]}
              rows={data?.productionVsInventory || data?.purchaseVsInventory || []}
              emptyMessage="No procurement vs inventory correlations found."
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
