/**
 * @fileoverview DashboardPage component.
 * Executive ERP Dashboard displaying cross-modular BI, task execution velocity, and transport logistics analytics.
 */

import React from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { api } from "../api/client.js";
import { MODULES_REGISTRY } from "../data/modulesRegistry.js";

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = React.useState({
    sales: { total: 0, documents: 0 },
    purchase: { total: 0, documents: 0 },
    inventory: { items: 0, quantity: 0 },
    hr: { employees: 0 },
  });
  const [taskAnalytics, setTaskAnalytics] = React.useState(null);
  const [transportAnalytics, setTransportAnalytics] = React.useState(null);
  const [moduleAnalytics, setModuleAnalytics] = React.useState({});
  const [moduleConfig, setModuleConfig] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError("");

        // Fetch BI summary, Task Execution, and Transport Analytics concurrently
        const [biRes, taskRes, transRes] = await Promise.allSettled([
          api.get("/bi/dashboards"),
          api.get("/projects/reports/task-execution"),
          api.get("/transport/reports/analytics"),
          api.get("/bi/module-analytics")
        ]);

        if (mounted) {
          if (biRes.status === "fulfilled") {
            const data = biRes.value?.data?.summary || {};
            setSummary({
              sales: {
                total: Number(data?.sales?.total || 0),
                documents: Number(data?.sales?.documents || 0),
              },
              purchase: {
                total: Number(data?.purchase?.total || 0),
                documents: Number(data?.purchase?.documents || 0),
              },
              inventory: {
                items: Number(data?.inventory?.items || 0),
                quantity: Number(data?.inventory?.quantity || 0),
              },
              hr: {
                employees: Number(data?.hr?.employees || 0),
              },
            });
          }

          if (taskRes.status === "fulfilled") {
            setTaskAnalytics(taskRes.value?.data || null);
          }

          if (transRes.status === "fulfilled") {
            setTransportAnalytics(transRes.value?.data || null);
          }
          if (modRes.status === "fulfilled") {
            setModuleAnalytics(modRes.value?.data?.data || {});
          }
        }
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load dashboard data");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const interval = setInterval(() => {
      if (mounted) load();
    }, 15000); // Live polling every 15 seconds
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  /**
   * Formats a number as Ghanaian Cedi (GHS) currency.
   * @param {number|string} n - The number to format.
   * @returns {string} The formatted currency string.
   */
  const currency = (n) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "GHS",
      maximumFractionDigits: 0,
    }).format(Number(n || 0));

  const analytics = taskAnalytics?.analytics || {};
  const tasks = taskAnalytics?.items || [];
  const urgentOrOverdueTasks = tasks
    .filter((t) => t.due_status === "OVERDUE" || t.priority === "URGENT")
    .slice(0, 5);

  const tAnalytics = transportAnalytics?.analytics || {};

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-brand dark:text-brand-300">
              Executive Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Cross-modular operational insights, project task execution, and transport fleet analytics.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
            OmniSuite BI 2.0
          </span>
        </div>
        <div className="card-body">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-600 dark:text-slate-400">
              Welcome back,{" "}
              <span className="font-semibold text-brand dark:text-brand-300">
                {user?.email}
              </span>
              .
            </p>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span>
            </div>
          </div>
          {error ? <p className="text-sm text-red-600 mt-1">{error}</p> : null}
        </div>
      </div>

      
      {/* Dynamic Module Analytics Cards */}
      {(user?.permissions?.dashboards?.length > 0 || user?.permissions?.cards?.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Granted Analytics</h2>
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1 ml-4" />
          </div>
          
          {(() => {
            // Group user's granted dashboards by module
            const grantedDashboards = user.permissions.dashboards || [];
            const grantedCards = user.permissions.cards || [];
            const granted = [...grantedDashboards, ...grantedCards];
            
            // Build a flat dictionary of all known dashboards across modules
            const allDashboardsByKey = {};
            Object.keys(MODULES_REGISTRY).forEach(modKey => {
              const mod = MODULES_REGISTRY[modKey];
              if (mod.dashboards) {
                mod.dashboards.forEach(d => {
                  allDashboardsByKey[d.key] = { ...d, moduleName: mod.name };
                });
              }
            });

            // Group granted keys
            const grouped = {};
            granted.forEach(featKey => {
               // featKey might be like "home:sales-total-revenue" or "sales:sales-total-revenue"
               const rawKey = featKey.includes(':') ? featKey.split(':')[1] : featKey;
               const conf = allDashboardsByKey[rawKey];
               if (conf) {
                 if (!grouped[conf.moduleName]) grouped[conf.moduleName] = [];
                 grouped[conf.moduleName].push({ ...conf, featKey });
               }
            });

            return Object.entries(grouped).map(([modName, cards]) => (
              <div key={modName} className="mb-6">
                <h3 className="text-sm font-semibold text-brand dark:text-brand-300 mb-3 uppercase tracking-wider">{modName}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {cards.map(c => {
                    const rawKey = c.key; // e.g., 'sales-total-revenue'
                    const val = moduleAnalytics[rawKey];
                    const isCurrency = rawKey.includes('revenue') || rawKey.includes('balance') || rawKey.includes('value') || rawKey.includes('income') || rawKey.includes('profit') || rawKey.includes('expenses') || rawKey.includes('ar') || rawKey.includes('ap');
                    
                    return (
                      <div key={rawKey} className="group relative overflow-hidden p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm hover:shadow-md border border-slate-100 dark:border-slate-700 transition-all duration-300 transform hover:-translate-y-1">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-brand-400 to-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start mb-4">
                           <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{c.label}</span>
                           <div className="p-1.5 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600 dark:text-brand-400">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                           </div>
                        </div>
                        <p className="text-2xl font-extrabold text-slate-900 dark:text-white truncate">
                           {loading ? (
                             <span className="animate-pulse bg-slate-200 dark:bg-slate-700 h-8 w-24 rounded block" />
                           ) : (
                             isCurrency ? currency(val) : (val !== undefined ? val : '0')
                           )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
{/* Visual Execution Progress Breakdown Bar */}
        <div>
          <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            <span>Task Execution Status Breakdown</span>
            <span>
              {analytics.completedTasks || 0} Done / {(analytics.inProgressTasks || 0) + (analytics.pendingTasks || 0) + (analytics.blockedTasks || 0)} Active
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-3.5 rounded-full overflow-hidden flex">
            <div
              title="Completed"
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{
                width: `${analytics.totalTasks ? (analytics.completedTasks / analytics.totalTasks) * 100 : 0}%`
              }}
            />
            <div
              title="In Progress"
              className="bg-blue-500 h-full transition-all duration-500"
              style={{
                width: `${analytics.totalTasks ? (analytics.inProgressTasks / analytics.totalTasks) * 100 : 0}%`
              }}
            />
            <div
              title="Under Review"
              className="bg-purple-500 h-full transition-all duration-500"
              style={{
                width: `${analytics.totalTasks ? (analytics.reviewTasks / analytics.totalTasks) * 100 : 0}%`
              }}
            />
            <div
              title="Pending"
              className="bg-slate-400 h-full transition-all duration-500"
              style={{
                width: `${analytics.totalTasks ? (analytics.pendingTasks / analytics.totalTasks) * 100 : 0}%`
              }}
            />
            <div
              title="Blocked"
              className="bg-rose-500 h-full transition-all duration-500"
              style={{
                width: `${analytics.totalTasks ? (analytics.blockedTasks / analytics.totalTasks) * 100 : 0}%`
              }}
            />
          </div>

          <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Completed ({analytics.completedTasks || 0})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              In Progress ({analytics.inProgressTasks || 0})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
              Under Review ({analytics.reviewTasks || 0})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
              Pending ({analytics.pendingTasks || 0})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              Blocked ({analytics.blockedTasks || 0})
            </span>
          </div>
        </div>

        {/* High Risk / Urgent Task Ticker */}
        {urgentOrOverdueTasks.length > 0 ? (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              ⚠️ Urgent & Overdue Action Items
            </h4>
            <div className="space-y-2">
              {urgentOrOverdueTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                      {t.priority}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {t.task_name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 ml-2">
                        ({t.project_name})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Assigned: {t.assigned_to_name}
                    </span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {t.due_label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
