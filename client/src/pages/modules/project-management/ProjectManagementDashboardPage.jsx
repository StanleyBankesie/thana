import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Briefcase, TrendingUp, TrendingDown } from "lucide-react";
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
import TaskExecutionReportPage from "./reports/TaskExecutionReportPage.jsx";

function badgeTone(status) {
  const value = String(status || "").toUpperCase();
  if (value === "COMPLETED" || value === "APPROVED" || value === "POSTED") {
    return "bg-secondary-50 text-secondary dark:bg-green-900/30 dark:text-green-300";
  }
  if (value === "IN_PROGRESS" || value === "OPEN" || value === "PENDING") {
    return "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300";
  }
  if (value === "BLOCKED" || value === "ON_HOLD") {
    return "bg-primary-50 text-primary dark:bg-orange-900/30 dark:text-orange-300";
  }
  if (value === "CANCELLED" || value === "REJECTED") {
    return "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  }
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function badge(status) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeTone(status)}`}>
      {String(status || "Unknown").replaceAll("_", " ")}
    </span>
  );
}

export default function ProjectManagementDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    detail: null,
    budgetVsActual: [],
    statusItems: [],
    projects: [],
    tasks: [],
    timesheets: [],
    expenses: [],
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [
          detailRes,
          budgetRes,
          statusRes,
          projectsRes,
          tasksRes,
          timesheetsRes,
          expensesRes,
        ] = await Promise.allSettled([
          api.get("/projects/dashboard/detail"),
          api.get("/projects/budget-vs-actual"),
          api.get("/projects/reports/project-status"),
          api.get("/projects/projects?active=all"),
          api.get("/projects/tasks"),
          api.get("/projects/timesheets"),
          api.get("/projects/expenses"),
        ]);

        if (!mounted) return;

        setData({
          detail:
            detailRes.status === "fulfilled" ? detailRes.value.data || {} : {},
          budgetVsActual:
            budgetRes.status === "fulfilled"
              ? budgetRes.value.data?.items || []
              : [],
          statusItems:
            statusRes.status === "fulfilled"
              ? statusRes.value.data?.items || []
              : [],
          projects:
            projectsRes.status === "fulfilled"
              ? projectsRes.value.data?.items || []
              : [],
          tasks:
            tasksRes.status === "fulfilled" ? tasksRes.value.data?.items || [] : [],
          timesheets:
            timesheetsRes.status === "fulfilled"
              ? timesheetsRes.value.data?.items || []
              : [],
          expenses:
            expensesRes.status === "fulfilled"
              ? expensesRes.value.data?.items || []
              : [],
        });
      } catch (err) {
        if (!mounted) return;
        setError(
          err?.response?.data?.message ||
            "Failed to load the project management dashboard.",
        );
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
    const detail = data.detail || {};
    const statusItems = data.statusItems || [];
    const budgetRows = data.budgetVsActual || [];
    const tasks = data.tasks || [];
    const timesheets = data.timesheets || [];
    const expenses = data.expenses || [];

    const totalBudget = Number(detail.projects?.total_budget || 0);
    const totalSpent = sumBy(budgetRows, (item) => item.total_spent);
    const averageCompletion = statusItems.length
      ? sumBy(statusItems, (item) => item.completion_percent) / statusItems.length
      : 0;

    const atRiskProjects = [...budgetRows]
      .filter(
        (item) =>
          Number(item.spend_pct || 0) >= 80 ||
          Number(item.completion_percent || 0) < 50 ||
          ["ON_HOLD", "BLOCKED"].includes(String(item.project_status || "").toUpperCase()),
      )
      .sort((a, b) => Number(b.spend_pct || 0) - Number(a.spend_pct || 0))
      .slice(0, 6);

    const highSpendProjects = [...budgetRows]
      .sort((a, b) => Number(b.total_spent || 0) - Number(a.total_spent || 0))
      .slice(0, 6)
      .map((item) => ({
        label: item.project_name || item.project_code || `Project ${item.id}`,
        value: Number(item.total_spent || 0),
      }));

    return {
      totalBudget,
      totalSpent,
      averageCompletion,
      budgetUtilization: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      projectStatus: groupCounts(statusItems, (item) => item.project_status),
      taskStatus: groupCounts(tasks, (item) => item.status),
      priorityMix: groupCounts(data.projects, (item) => item.project_priority),
      spendLeaderboard: highSpendProjects,
      atRiskProjects,
      recentTimesheets: timesheets.slice(0, 6),
      recentExpenses: expenses.slice(0, 6),
    };
  }, [data]);

  return (
    <DashboardPageShell
      title="Project Management Dashboard"
      subtitle="Portfolio health, budget control, task execution, and live activity across current projects, timesheets, and expenses."
      backTo="/project-management"
    >
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Projects"
          value={formatNumber(data.detail?.projects?.total)}
          helper={`${formatNumber(data.detail?.projects?.active)} currently active.`}
          icon="📁"
          tone="brand"
        />
        <MetricCard
          title="Open Tasks"
          value={formatNumber(data.detail?.tasks?.open)}
          helper={`${formatNumber(data.detail?.tasks?.blocked)} tasks are blocked.`}
          icon="✅"
          tone="primary"
        />
        <MetricCard
          title="Portfolio Budget"
          value={formatCurrency(insights.totalBudget)}
          helper={`${insights.budgetUtilization.toFixed(1)}% consumed so far.`}
          icon="💰"
          tone="secondary"
        />
        <MetricCard
          title="Total Logged Hours"
          value={`${formatNumber(data.detail?.totalLoggedHours, { maximumFractionDigits: 1 })}h`}
          helper={`${formatCurrency(data.detail?.totalExpenses)} direct expenses recorded.`}
          icon="⏱️"
          tone="rose"
        />
        <MetricCard
          title="Average Completion"
          value={`${insights.averageCompletion.toFixed(1)}%`}
          helper="Calculated from current project status reporting."
          icon="🎯"
          tone="brand"
        />
        <MetricCard
          title="Projects Completed"
          value={formatNumber(data.detail?.projects?.completed)}
          helper={`${formatNumber(data.projects.length)} projects loaded into the portfolio list.`}
          icon="🏁"
          tone="slate"
        />
        <MetricCard
          title="Total Spent"
          value={formatCurrency(insights.totalSpent)}
          helper="Combined expense and labor spend from project financial tracking."
          icon="📉"
          tone="primary"
        />
        <MetricCard
          title="Planning Projects"
          value={formatNumber(data.detail?.projects?.planning)}
          helper="Projects still in planning before full execution."
          icon="🗂️"
          tone="brand"
        />
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading project management dashboard...
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Portfolio Health"
              subtitle="Project status and priority distribution across the portfolio."
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <HorizontalBarList
                  items={insights.projectStatus}
                  tone="brand"
                  emptyText="No project status data available."
                />
                <HorizontalBarList
                  items={insights.priorityMix}
                  tone="primary"
                  emptyText="No priority data available."
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Task Execution"
              subtitle="Open, completed, and blocked work from the live task register."
            >
              <HorizontalBarList
                items={insights.taskStatus}
                tone="secondary"
                emptyText="No tasks available."
              />
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard
              title="Projects Requiring Attention"
              subtitle="Highest spend or lowest progress items that need intervention."
            >
              <RecordsTable
                rows={insights.atRiskProjects}
                columns={[
                  {
                    key: "project_name",
                    label: "Project",
                    render: (row) => row.project_name || row.project_code || "—",
                  },
                  {
                    key: "project_status",
                    label: "Status",
                    render: (row) => badge(row.project_status),
                  },
                  {
                    key: "completion_percent",
                    label: "Completion",
                    render: (row) => `${Number(row.completion_percent || 0).toFixed(1)}%`,
                    align: "right",
                  },
                  {
                    key: "spend_pct",
                    label: "Spend %",
                    render: (row) => `${Number(row.spend_pct || 0).toFixed(1)}%`,
                    align: "right",
                  },
                  {
                    key: "remaining",
                    label: "Remaining",
                    render: (row) => formatCurrency(row.remaining || 0),
                    align: "right",
                  },
                ]}
                emptyText="No at-risk projects detected from the current dataset."
              />
            </SectionCard>

            <SectionCard
              title="Highest Spend Projects"
              subtitle="Projects consuming the most budget and labor right now."
            >
              <HorizontalBarList
                items={insights.spendLeaderboard}
                tone="primary"
                valueFormatter={(value) => formatCurrency(value)}
                emptyText="No spending data available."
              />
            </SectionCard>
          </div>

          <div className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white px-6">Task Execution & Analytics</h2>
            <div className="-mx-6">
              <TaskExecutionReportPage isEmbedded={true} />
            </div>
          </div>
        </>
      )}
    </DashboardPageShell>
  );
}
