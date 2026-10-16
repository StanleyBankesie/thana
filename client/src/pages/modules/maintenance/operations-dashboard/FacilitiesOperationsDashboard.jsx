import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Building2, ShieldCheck, Wrench, AlertTriangle, 
  CheckCircle, Clock, Sparkles, TrendingUp, ArrowUpRight, 
  Layers, Users, ShieldAlert, ArrowLeft
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function FacilitiesOperationsDashboard() {
  const [kpiData, setKpiData] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [kpiRes, ticketRes] = await Promise.all([
        api.get("/facilities/dashboard/kpis"),
        api.get("/facilities/tickets")
      ]);
      setKpiData(kpiRes.data?.data || null);
      setTickets(ticketRes.data?.data || []);
    } catch {
      toast.error("Failed to load facilities operations data");
    } finally {
      setLoading(false);
    }
  };

  const urgentTickets = tickets.filter(
    (t) => t.status !== "COMPLETED" && t.status !== "CLOSED" && (t.computed_sla_status === "BREACHED" || t.computed_sla_status === "AT_RISK" || t.priority === "CRITICAL" || t.priority === "EMERGENCY")
  );

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to="/maintenance?section=Facilities Management"
            className="btn btn-secondary p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title="Back to Facilities Management"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Facilities Operations & SLA Command Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Real-time multi-client property portfolios, active FM service agreements, SLA compliance tracking, and field technician dispatch.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/maintenance/field-service" className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5 font-medium">
            <Wrench size={14} /> Technician Workspace
          </Link>
          <Link to="/maintenance/properties" className="btn-outline text-xs px-3 py-2 flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <Layers size={14} /> Properties
          </Link>
          <Link to="/maintenance/fm-contracts" className="btn-outline text-xs px-3 py-2 flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <ShieldCheck size={14} /> FM Contracts
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Managed Properties */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Properties</span>
                <Building2 size={18} className="text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {kpiData?.portfolio?.properties || 0}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span>{kpiData?.portfolio?.buildings || 0} Buildings</span>
                <span>•</span>
                <span>{kpiData?.portfolio?.spaces || 0} Spaces</span>
              </div>
            </div>

            {/* Active Contracts & Recurring Fee */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Active FM Contracts</span>
                <ShieldCheck size={18} className="text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {kpiData?.contracts?.active || 0}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                ₵{Number(kpiData?.contracts?.monthly_billing || 0).toLocaleString()} /mo recurring billing
              </div>
            </div>

            {/* SLA Compliance Rate */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">SLA Compliance Rate</span>
                <Clock size={18} className="text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {kpiData?.helpdesk_tickets?.sla_compliance_rate || 100}%
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  (kpiData?.helpdesk_tickets?.sla_compliance_rate || 100) >= 90
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  {(kpiData?.helpdesk_tickets?.sla_compliance_rate || 100) >= 90 ? "Target Met" : "Warning"}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {kpiData?.helpdesk_tickets?.breached_count || 0} SLA Breaches Recorded
              </div>
            </div>

            {/* Field Jobs In Progress */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Field Jobs</span>
                <Wrench size={18} className="text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {kpiData?.work_orders?.active_in_field || 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {kpiData?.work_orders?.completed || 0} Completed this period
              </div>
            </div>
          </div>

          {/* SLA Alerts & At-Risk Helpdesk Tickets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  SLA Priority & At-Risk Ticket Monitor
                </h3>
                <span className="text-xs font-medium text-slate-400 font-mono">
                  {urgentTickets.length} Priority Tickets
                </span>
              </div>

              {urgentTickets.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-70" />
                  All active facilities helpdesk tickets are well within SLA response & resolution deadlines.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Ticket No</th>
                        <th className="py-2.5 px-3">Property / Area</th>
                        <th className="py-2.5 px-3">Issue</th>
                        <th className="py-2.5 px-3">SLA Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {urgentTickets.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-white">
                            {t.request_no}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              {t.property_name || "Facility"}
                            </span>
                            <span className="text-[11px] text-slate-400">{t.space_name}</span>
                          </td>
                          <td className="py-2.5 px-3 max-w-xs truncate text-slate-700 dark:text-slate-300">
                            {t.description}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              t.computed_sla_status === "BREACHED"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                                : t.computed_sla_status === "AT_RISK"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                            }`}>
                              {t.computed_sla_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Link
                              to={`/maintenance/maintenance-requests/${t.id}`}
                              className="btn-outline text-[11px] px-2 py-1 inline-flex items-center gap-1 text-slate-700 dark:text-slate-300"
                            >
                              Dispatch <ArrowUpRight size={11} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Soft Services Daily Performance */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-500" />
                  Soft Services Activity Today
                </h3>
                <Link to="/maintenance/soft-services" className="text-xs text-emerald-600 hover:underline">
                  Manage
                </Link>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">Restroom & Janitorial Audits</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {kpiData?.soft_services_today?.cleaning || 0} Logged
                    </span>
                  </div>
                  <Sparkles size={20} className="text-emerald-500 opacity-60" />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">Security Guard Patrol Rounds</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {kpiData?.soft_services_today?.security_patrols || 0} Completed
                    </span>
                  </div>
                  <ShieldAlert size={20} className="text-blue-500 opacity-60" />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">Pest Control Inspections</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {kpiData?.soft_services_today?.pest_treatments || 0} Conducted
                    </span>
                  </div>
                  <TrendingUp size={20} className="text-purple-500 opacity-60" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
