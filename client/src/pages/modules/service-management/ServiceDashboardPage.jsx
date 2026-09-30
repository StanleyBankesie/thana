import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../../api/client.js";
import {
  DashboardPageShell,
  MetricCard,
  SectionCard,
  HorizontalBarList,
  LineTrendChart,
  RecordsTable,
  ShortcutGrid,
  formatCurrency,
  formatDate,
  formatNumber,
  getCurrentDateRange,
  groupCounts,
  sumBy,
} from "../../../components/dashboard/ModuleDashboardWidgets.jsx";

function statusBadge(status) {
  const value = String(status || "").toUpperCase();
  const palette =
    value === "COMPLETED" || value === "DONE" || value === "CLOSED"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : value === "PENDING" || value === "OPEN" || value === "IN_PROGRESS"
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        : value === "CANCELLED" || value === "REJECTED"
          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${palette}`}>
      {String(status || "Unknown").replaceAll("_", " ")}
    </span>
  );
}

export default function ServiceDashboardPage() {
  const location = useLocation();
  const backTo =
    location.state?.fromExecutiveOverview === true
      ? "/executive-overview"
      : "/service-management";
  const range = useMemo(() => getCurrentDateRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [topN, setTopN] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    metrics: null,
    visitors: null,
    requests: [],
    orders: [],
    revenue: { items: [], metrics: {} },
    sla: { items: [], metrics: {} },
    technicians: [],
    outstandingBills: [],
    costAnalysis: [],
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = { from: from || null, to: to || null, top: topN };
        const [
          metricsRes,
          visitorsRes,
          requestsRes,
          ordersRes,
          revenueRes,
          slaRes,
          techniciansRes,
          outstandingRes,
          costRes,
        ] = await Promise.allSettled([
          api.get("/purchase/service/dashboard/metrics", { params }),
          api.get("/visitors/dashboard/stats"),
          api.get("/service-management/reports/request-summary", { params }),
          api.get("/service-management/reports/order-status", { params }),
          api.get("/service-management/reports/service-revenue", { params }),
          api.get("/service-management/reports/sla-compliance", { params }),
          api.get("/service-management/reports/technician-utilization", { params }),
          api.get("/service-management/reports/outstanding-bills"),
          api.get("/service-management/reports/cost-analysis"),
        ]);

        if (!mounted) return;

        setData({
          metrics:
            metricsRes.status === "fulfilled" ? metricsRes.value.data || {} : {},
          visitors:
            visitorsRes.status === "fulfilled"
              ? visitorsRes.value.data?.stats || {}
              : {},
          requests:
            requestsRes.status === "fulfilled"
              ? requestsRes.value.data?.items || []
              : [],
          orders:
            ordersRes.status === "fulfilled"
              ? ordersRes.value.data?.items || []
              : [],
          revenue:
            revenueRes.status === "fulfilled"
              ? {
                  items: revenueRes.value.data?.items || [],
                  metrics: revenueRes.value.data?.metrics || {},
                }
              : { items: [], metrics: {} },
          sla:
            slaRes.status === "fulfilled"
              ? {
                  items: slaRes.value.data?.items || [],
                  metrics: slaRes.value.data?.metrics || {},
                }
              : { items: [], metrics: {} },
          technicians:
            techniciansRes.status === "fulfilled"
              ? techniciansRes.value.data?.items || []
              : [],
          outstandingBills:
            outstandingRes.status === "fulfilled"
              ? outstandingRes.value.data?.items || []
              : [],
          costAnalysis:
            costRes.status === "fulfilled"
              ? costRes.value.data?.items || []
              : [],
        });
      } catch (err) {
        if (!mounted) return;
        setError(
          err?.response?.data?.message || "Failed to load service dashboard.",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [from, to, topN]);

  const insights = useMemo(() => {
    const cards = data.metrics?.cards || {};
    const topCategories = (data.metrics?.top_categories || []).map((item) => ({
      label: item.label,
      value: Number(item.value || 0),
    }));
    const technicianLeaderboard = [...(data.technicians || [])]
      .sort((a, b) => Number(b.total_jobs || 0) - Number(a.total_jobs || 0))
      .slice(0, 6)
      .map((item) => ({
        label: item.technician || "Unassigned",
        value: Number(item.total_jobs || 0),
      }));
    const riskyJobs = [...(data.costAnalysis || [])]
      .filter((item) => Number(item.profit_loss || 0) < 0)
      .sort((a, b) => Number(a.profit_loss || 0) - Number(b.profit_loss || 0))
      .slice(0, 6);

    return {
      cards,
      topCategories,
      technicianLeaderboard,
      requestStatus: groupCounts(data.requests, (item) => item.status),
      requestPriority: groupCounts(data.requests, (item) => item.priority),
      orderStatus: groupCounts(data.orders, (item) => item.status),
      totalOutstandingBalance: sumBy(data.outstandingBills, (item) => item.balance),
      riskyJobs,
    };
  }, [data]);

  return (
    <DashboardPageShell
      title="Service Management Dashboard"
      subtitle="Comprehensive live view of service demand, order pipeline, SLA performance, technician output, revenue, receivables, and visitor activity."
      backTo={backTo}
      backLabel="Return"
      filters={
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/70">
              From
            </label>
            <input
              type="date"
              className="input w-full"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/70">
              To
            </label>
            <input
              type="date"
              className="input w-full"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/70">
              Top Categories
            </label>
            <select
              className="input w-full"
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
            >
              {[3, 5, 10, 15, 20].map((value) => (
                <option key={value} value={value}>
                  Top {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      }
      actions={[
        {
          label: "Service Requests",
          path: "/service-management/customer-service-requests",
          icon: "📨",
          description: "Open live request intake and service demand.",
        },
        {
          label: "Service Orders",
          path: "/service-management/service-orders",
          icon: "🧾",
          description: "Track order execution and operational progress.",
        },
        {
          label: "Service Revenue",
          path: "/service-management/reports/service-revenue",
          icon: "💵",
          description: "Review billing and service revenue detail.",
        },
        {
          label: "SLA Report",
          path: "/service-management/reports/sla-compliance",
          icon: "⏱️",
          description: "Inspect compliance versus agreed service levels.",
        },
      ]}
    >
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="YTD Requests"
          value={formatNumber(insights.cards.ytd_requests)}
          helper={`${formatNumber(insights.cards.mtd_requests)} this month.`}
          icon="📨"
          tone="indigo"
        />
        <MetricCard
          title="YTD Orders"
          value={formatNumber(insights.cards.ytd_orders)}
          helper={`${formatNumber(insights.cards.wtd_orders)} this week.`}
          icon="🧾"
          tone="amber"
        />
        <MetricCard
          title="YTD Executions"
          value={formatNumber(insights.cards.ytd_executions)}
          helper={`${formatNumber(insights.cards.mtd_executions)} executed this month.`}
          icon="⚙️"
          tone="emerald"
        />
        <MetricCard
          title="YTD Confirmations"
          value={formatNumber(insights.cards.ytd_confirmations)}
          helper={`${formatNumber(insights.cards.mtd_confirmations)} confirmations this month.`}
          icon="✅"
          tone="teal"
        />
        <MetricCard
          title="MTD Service Revenue"
          value={formatCurrency(data.revenue.metrics?.total_revenue || insights.cards.mtd_service_bill_value || 0)}
          helper={`${formatCurrency(data.revenue.metrics?.outstanding_amount || 0)} outstanding from billed work.`}
          icon="💵"
          tone="rose"
        />
        <MetricCard
          title="SLA Compliance"
          value={`${Number(data.sla.metrics?.sla_compliance_percent || 0).toFixed(1)}%`}
          helper={`${formatNumber(data.sla.metrics?.breached_sla || 0)} breached requests in period.`}
          icon="⏱️"
          tone="indigo"
        />
        <MetricCard
          title="Outstanding Bills"
          value={formatNumber(data.outstandingBills.length)}
          helper={formatCurrency(insights.totalOutstandingBalance)}
          icon="📑"
          tone="amber"
        />
        <MetricCard
          title="Active Visitors"
          value={formatNumber(data.visitors?.active_visitors)}
          helper={`${formatNumber(data.visitors?.today_visitors)} visitors recorded today.`}
          icon="🏢"
          tone="slate"
        />
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading service dashboard...
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              title="Monthly Service Trend"
              subtitle="Orders, executions, and confirmations over time."
            >
              <LineTrendChart
                data={data.metrics?.month_wise_trend || []}
                series={[
                  { key: "orders", label: "Orders" },
                  { key: "executions", label: "Executions" },
                  { key: "confirmations", label: "Confirmations" },
                ]}
              />
            </SectionCard>

            <SectionCard
              title="Top Service Categories"
              subtitle={`Top ${topN} service categories by current dashboard activity.`}
            >
              <HorizontalBarList
                items={insights.topCategories}
                tone="teal"
                emptyText="No category activity available."
              />
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <SectionCard
              title="Request Priority Mix"
              subtitle="Current urgency levels in the request queue."
            >
              <HorizontalBarList
                items={insights.requestPriority}
                tone="amber"
                emptyText="No request data available."
              />
            </SectionCard>
            <SectionCard
              title="Request Status"
              subtitle="How the incoming request pipeline is moving."
            >
              <HorizontalBarList
                items={insights.requestStatus}
                tone="indigo"
                emptyText="No request statuses available."
              />
            </SectionCard>
            <SectionCard
              title="Order Status"
              subtitle="Operational flow of service orders in the selected period."
            >
              <HorizontalBarList
                items={insights.orderStatus}
                tone="emerald"
                emptyText="No service orders available."
              />
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard
              title="Technician Workload"
              subtitle="Technicians with the highest assigned service volume."
            >
              <HorizontalBarList
                items={insights.technicianLeaderboard}
                tone="rose"
                emptyText="No technician utilization data available."
              />
            </SectionCard>

            <SectionCard
              title="Recent Service Requests"
              subtitle="Newest customer demand entering the service pipeline."
            >
              <RecordsTable
                rows={data.requests.slice(0, 6)}
                columns={[
                  { key: "request_no", label: "Request" },
                  { key: "customer_name", label: "Customer" },
                  { key: "service_type", label: "Service" },
                  { key: "priority", label: "Priority" },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => statusBadge(row.status),
                  },
                  {
                    key: "request_date",
                    label: "Date",
                    render: (row) => formatDate(row.request_date),
                  },
                ]}
                emptyText="No service requests available."
              />
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Current Service Orders"
              subtitle="Latest service orders and their execution position."
            >
              <RecordsTable
                rows={data.orders.slice(0, 6)}
                columns={[
                  { key: "order_no", label: "Order" },
                  { key: "technician", label: "Technician" },
                  {
                    key: "estimated_cost",
                    label: "Est. Cost",
                    align: "right",
                    render: (row) => formatCurrency(row.estimated_cost || 0),
                  },
                  {
                    key: "actual_cost",
                    label: "Actual Cost",
                    align: "right",
                    render: (row) => formatCurrency(row.actual_cost || 0),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => statusBadge(row.status),
                  },
                ]}
                emptyText="No service orders available."
              />
            </SectionCard>

            <SectionCard
              title="Outstanding Receivables"
              subtitle="Open service bills waiting for collection."
            >
              <RecordsTable
                rows={data.outstandingBills.slice(0, 6)}
                columns={[
                  { key: "bill_no", label: "Bill" },
                  { key: "customer", label: "Customer" },
                  { key: "aging", label: "Aging" },
                  {
                    key: "balance",
                    label: "Balance",
                    align: "right",
                    render: (row) => formatCurrency(row.balance || 0),
                  },
                  {
                    key: "due_date",
                    label: "Due Date",
                    render: (row) => formatDate(row.due_date),
                  },
                ]}
                emptyText="No outstanding bills available."
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Loss-Making Jobs"
            subtitle="Service jobs where current cost exceeds billed value."
          >
            <RecordsTable
              rows={insights.riskyJobs}
              columns={[
                { key: "order_no", label: "Order" },
                {
                  key: "total_cost",
                  label: "Total Cost",
                  align: "right",
                  render: (row) => formatCurrency(row.total_cost || 0),
                },
                {
                  key: "billed_amount",
                  label: "Billed",
                  align: "right",
                  render: (row) => formatCurrency(row.billed_amount || 0),
                },
                {
                  key: "profit_loss",
                  label: "Profit/Loss",
                  align: "right",
                  render: (row) => formatCurrency(row.profit_loss || 0),
                },
              ]}
              emptyText="No negative-margin service jobs detected."
            />
          </SectionCard>

          <SectionCard
            title="Service Shortcuts"
            subtitle="Jump directly from the dashboard into the operational and reporting pages that matter most."
          >
            <ShortcutGrid
              items={[
                {
                  label: "Customer Service Requests",
                  path: "/service-management/customer-service-requests",
                  description: "Open the request register and intake queue.",
                  icon: "📨",
                },
                {
                  label: "Service Orders",
                  path: "/service-management/service-orders",
                  description: "Manage created service orders.",
                  icon: "🧾",
                },
                {
                  label: "Execution Performance",
                  path: "/service-management/reports/execution-performance",
                  description: "Review technician productivity and throughput.",
                  icon: "⚙️",
                },
                {
                  label: "SLA Compliance",
                  path: "/service-management/reports/sla-compliance",
                  description: "Inspect within-SLA versus breached tickets.",
                  icon: "⏱️",
                },
                {
                  label: "Service Revenue",
                  path: "/service-management/reports/service-revenue",
                  description: "Billing and revenue analytics.",
                  icon: "💵",
                },
                {
                  label: "Outstanding Bills",
                  path: "/service-management/reports/outstanding-bills",
                  description: "Focus on customer balances awaiting collection.",
                  icon: "📑",
                },
              ]}
            />
          </SectionCard>
        </>
      )}
    </DashboardPageShell>
  );
}
