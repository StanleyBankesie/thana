import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client.js";
import {
  DashboardPageShell,
  MetricCard,
  SectionCard,
  HorizontalBarList,
  RecordsTable,
  ShortcutGrid,
  formatCurrency,
  formatDate,
  formatNumber,
  groupCounts,
  sumBy,
} from "../../../components/dashboard/ModuleDashboardWidgets.jsx";

function priorityTone(priority) {
  const value = String(priority || "").toUpperCase();
  if (value === "HIGH" || value === "URGENT") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  }
  if (value === "MEDIUM" || value === "NORMAL") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
}

function statusBadge(status) {
  const value = String(status || "UNKNOWN").toUpperCase();
  const palette =
    value === "COMPLETED" || value === "CLOSED" || value === "POSTED"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : value === "IN_PROGRESS" || value === "ACTIVE" || value === "APPROVED"
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

export default function MaintenanceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    stats: null,
    requests: [],
    jobs: [],
    schedules: [],
    downtime: [],
    requisitions: [],
    receipts: [],
    bills: [],
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [
          statsRes,
          requestsRes,
          jobsRes,
          schedulesRes,
          downtimeRes,
          requisitionsRes,
          receiptsRes,
          billsRes,
        ] = await Promise.allSettled([
          api.get("/maintenance/dashboard/stats"),
          api.get("/maintenance/maintenance-requests"),
          api.get("/maintenance/job-orders"),
          api.get("/maintenance/schedules"),
          api.get("/maintenance/assets/downtime"),
          api.get("/maintenance/material-requisitions"),
          api.get("/maintenance/material-receipts"),
          api.get("/maintenance/bills"),
        ]);

        if (!mounted) return;

        setData({
          stats: statsRes.status === "fulfilled" ? statsRes.value.data || {} : {},
          requests:
            requestsRes.status === "fulfilled"
              ? requestsRes.value.data?.items || []
              : [],
          jobs:
            jobsRes.status === "fulfilled" ? jobsRes.value.data?.items || [] : [],
          schedules:
            schedulesRes.status === "fulfilled"
              ? schedulesRes.value.data?.items || []
              : [],
          downtime:
            downtimeRes.status === "fulfilled"
              ? downtimeRes.value.data?.items || []
              : [],
          requisitions:
            requisitionsRes.status === "fulfilled"
              ? requisitionsRes.value.data?.items || []
              : [],
          receipts:
            receiptsRes.status === "fulfilled"
              ? receiptsRes.value.data?.items || []
              : [],
          bills:
            billsRes.status === "fulfilled"
              ? billsRes.value.data?.items || []
              : [],
        });
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.message || "Failed to load maintenance dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const insights = useMemo(() => {
    const requests = data.requests || [];
    const jobs = data.jobs || [];
    const schedules = data.schedules || [];
    const downtime = data.downtime || [];
    const requisitions = data.requisitions || [];
    const receipts = data.receipts || [];
    const bills = data.bills || [];

    const outstandingBills = bills.filter(
      (bill) => String(bill.payment_status || "").toUpperCase() !== "PAID",
    );
    const approvedRequisitions = requisitions.filter((item) =>
      ["APPROVED", "POSTED"].includes(String(item.status || "").toUpperCase()),
    );
    const postedReceipts = receipts.filter((item) =>
      ["POSTED", "APPROVED"].includes(String(item.status || "").toUpperCase()),
    );
    const recentRequests = requests.slice(0, 6);
    const recentJobs = jobs.slice(0, 6);
    const recentBills = outstandingBills.slice(0, 6);

    return {
      outstandingBills,
      requestStatus: groupCounts(requests, (item) => item.status),
      requestPriority: groupCounts(requests, (item) => item.priority),
      jobStatus: groupCounts(jobs, (item) => item.status),
      scheduleMix: groupCounts(schedules, (item) => item.frequency || item.classification),
      downtimeImpact: groupCounts(downtime, (item) => item.impact_level || item.category),
      requisitionFlow: [
        { label: "Approved Requisitions", value: approvedRequisitions.length },
        { label: "Posted Receipts", value: postedReceipts.length },
        { label: "Open Requisitions", value: Math.max(requisitions.length - approvedRequisitions.length, 0) },
      ],
      totalOutstandingValue: sumBy(outstandingBills, (item) => item.total_amount),
      recentRequests,
      recentJobs,
      recentBills,
    };
  }, [data]);

  return (
    <DashboardPageShell
      title="Maintenance Operations Dashboard"
      subtitle="Live maintenance workload, asset support flow, downtime risk, and material movement based on current maintenance transactions and reports."
      backTo="/maintenance"
      actions={[
        {
          label: "Open Requests",
          path: "/maintenance/maintenance-requests",
          icon: "📝",
          description: "Review the incoming maintenance demand queue.",
        },
        {
          label: "Job Orders",
          path: "/maintenance/job-orders",
          icon: "🛠️",
          description: "Track jobs currently assigned and in progress.",
        },
        {
          label: "Downtime Report",
          path: "/maintenance/reports/downtime",
          icon: "📉",
          description: "Jump straight to the downtime analytics report.",
        },
        {
          label: "Materials",
          path: "/maintenance/material-requisitions",
          icon: "📦",
          description: "Monitor requisitions and warehouse receipts.",
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
          title="Active Assets"
          value={formatNumber(data.stats?.totalAssets)}
          helper="Live count of assets marked active."
          icon="🧰"
          tone="indigo"
        />
        <MetricCard
          title="Open Requests"
          value={formatNumber(data.stats?.openRequests)}
          helper={`${formatNumber(data.requests.length)} total requests in the current list.`}
          icon="📨"
          tone="amber"
        />
        <MetricCard
          title="Jobs In Progress"
          value={formatNumber(data.stats?.activeJobs)}
          helper={`${formatNumber(insights.jobStatus.find((item) => item.label === "COMPLETED")?.value || 0)} completed jobs captured.`}
          icon="🛠️"
          tone="emerald"
        />
        <MetricCard
          title="Overdue PM"
          value={formatNumber(data.stats?.overduePm)}
          helper={`${formatNumber(data.schedules.length)} schedules currently configured.`}
          icon="⏰"
          tone="rose"
        />
        <MetricCard
          title="Downtime Incidents"
          value={formatNumber(data.downtime.length)}
          helper="Downtime logs currently recorded in the maintenance register."
          icon="📉"
          tone="teal"
        />
        <MetricCard
          title="Material Requisitions"
          value={formatNumber(data.requisitions.length)}
          helper={`${formatNumber(data.receipts.length)} material receipts posted or drafted.`}
          icon="📦"
          tone="slate"
        />
        <MetricCard
          title="Outstanding Bills"
          value={formatNumber(insights.outstandingBills.length)}
          helper={formatCurrency(insights.totalOutstandingValue)}
          icon="💳"
          tone="indigo"
        />
        <MetricCard
          title="Asset Coverage"
          value={`${formatNumber(data.stats?.assetHealth || 0)}%`}
          helper="From the current maintenance summary feed."
          icon="🛡️"
          tone="emerald"
        />
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading maintenance dashboard...
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Request Pipeline"
              subtitle="Demand and urgency mix across live maintenance requests."
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <HorizontalBarList
                  items={insights.requestStatus}
                  tone="indigo"
                  emptyText="No request activity yet."
                />
                <HorizontalBarList
                  items={insights.requestPriority}
                  tone="amber"
                  emptyText="No priority information captured yet."
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Execution And Materials"
              subtitle="Active jobs, support material flow, and schedule distribution."
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <HorizontalBarList
                  items={insights.jobStatus}
                  tone="emerald"
                  emptyText="No job orders available."
                />
                <HorizontalBarList
                  items={insights.requisitionFlow}
                  tone="teal"
                  emptyText="No material activity available."
                />
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard
              title="Recent Maintenance Requests"
              subtitle="Latest requests to triage, prioritize, and convert to work."
            >
              <RecordsTable
                rows={insights.recentRequests}
                columns={[
                  { key: "request_no", label: "Request" },
                  { key: "asset_name", label: "Asset" },
                  { key: "requester_name", label: "Requester" },
                  {
                    key: "priority",
                    label: "Priority",
                    render: (row) => (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityTone(row.priority)}`}>
                        {row.priority || "Normal"}
                      </span>
                    ),
                  },
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
                emptyText="No maintenance requests recorded."
              />
            </SectionCard>

            <SectionCard
              title="Downtime And PM Mix"
              subtitle="Current downtime severity and schedule distribution."
            >
              <div className="space-y-6">
                <HorizontalBarList
                  items={insights.downtimeImpact}
                  tone="rose"
                  emptyText="No downtime incidents recorded."
                />
                <HorizontalBarList
                  items={insights.scheduleMix}
                  tone="slate"
                  emptyText="No schedules configured."
                />
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Current Job Orders"
              subtitle="Latest work assignments and delivery status."
            >
              <RecordsTable
                rows={insights.recentJobs}
                columns={[
                  { key: "order_no", label: "Job Order" },
                  { key: "asset_name", label: "Asset" },
                  { key: "assigned_technician", label: "Technician" },
                  {
                    key: "scheduled_date",
                    label: "Scheduled",
                    render: (row) => formatDate(row.scheduled_date || row.order_date),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => statusBadge(row.status),
                  },
                ]}
                emptyText="No maintenance job orders recorded."
              />
            </SectionCard>

            <SectionCard
              title="Outstanding Maintenance Bills"
              subtitle="Bills not yet fully paid, with the latest posting activity."
            >
              <RecordsTable
                rows={insights.recentBills}
                columns={[
                  { key: "bill_no", label: "Bill" },
                  { key: "supplier_name", label: "Supplier" },
                  {
                    key: "total_amount",
                    label: "Amount",
                    align: "right",
                    render: (row) => formatCurrency(row.total_amount),
                  },
                  {
                    key: "payment_status",
                    label: "Payment",
                    render: (row) => statusBadge(row.payment_status),
                  },
                  {
                    key: "bill_date",
                    label: "Bill Date",
                    render: (row) => formatDate(row.bill_date),
                  },
                ]}
                emptyText="No outstanding maintenance bills."
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Maintenance Shortcuts"
            subtitle="Open the operational pages and reports most used from this dashboard."
          >
            <ShortcutGrid
              items={[
                {
                  label: "Maintenance Requests",
                  path: "/maintenance/maintenance-requests",
                  description: "Inspect new and pending requests.",
                  icon: "📝",
                },
                {
                  label: "Job Orders",
                  path: "/maintenance/job-orders",
                  description: "Manage work orders and scheduling.",
                  icon: "🛠️",
                },

                {
                  label: "Material Requisitions",
                  path: "/maintenance/material-requisitions",
                  description: "Monitor materials requested from stores.",
                  icon: "📦",
                },
                {
                  label: "Material Receipts",
                  path: "/maintenance/material-receipts",
                  description: "Check what has been received back from inventory.",
                  icon: "📥",
                },
                {
                  label: "Downtime Report",
                  path: "/maintenance/reports/downtime",
                  description: "Jump into the detailed downtime analytics report.",
                  icon: "📊",
                },
              ]}
            />
          </SectionCard>
        </>
      )}
    </DashboardPageShell>
  );
}
