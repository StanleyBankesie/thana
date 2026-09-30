/**
 * @fileoverview ExecutiveOverviewHome component.
 * Enterprise Executive Overview Dashboard maintaining the signature vibrant 
 * 4-style glassmorphic KPI cards with full live data binding and module quick launch.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, NavLink } from "react-router-dom";
import { api } from "../../../api/client.js";
import { usePermission } from "../../../auth/PermissionContext.jsx";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  Calendar, 
  Clock, 
  Package, 
  Users, 
  Wrench, 
  ShoppingBag, 
  Boxes, 
  Layers, 
  ShieldCheck, 
  Building2, 
  ArrowUpRight, 
  ChevronRight,
  Activity,
  ArrowLeft,
  ChevronDown
} from "lucide-react";

function ExecNavDropdown({ label, items, navigate }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!items || items.length === 0) return null;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-700 dark:hover:text-brand-300 transition-colors whitespace-nowrap"
      >
        <span>{label}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-erp-lg overflow-hidden"
          style={{ minWidth: 240, maxWidth: 360 }}
        >
          <div className="p-1.5 grid grid-cols-1 gap-1 max-h-80 overflow-y-auto">
            {items.map((item, idx) => {
              const itemTitle = item.label || item.title || item.name;
              const itemPath = item.path;
              const itemIcon = item.icon;
              const itemDesc = item.desc || item.description;

              return (
                <button
                  key={itemPath || item.key || idx}
                  onClick={() => {
                    if (itemPath) navigate(itemPath);
                    setOpen(false);
                  }}
                  className="flex items-start gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors text-slate-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-700 dark:hover:text-brand-300"
                >
                  {typeof itemIcon === "string" ? (
                    <span className="text-base flex-shrink-0 mt-0.5">{itemIcon}</span>
                  ) : itemIcon && typeof itemIcon === "function" ? (
                    <itemIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <span className="text-base flex-shrink-0 mt-0.5">📄</span>
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate leading-snug">{itemTitle}</span>
                    {itemDesc && (
                      <span className="text-[11px] font-normal truncate leading-tight text-slate-400 dark:text-slate-500">
                        {itemDesc}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleLaunchCard({ m, navigate }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const ref = React.useRef(null);
  const IconComp = m.icon;

  React.useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    const handleScroll = () => setOpen(false);
    document.addEventListener("mousedown", handler);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  const toggleOpen = (e) => {
    if (!open) {
      const rect = e.currentTarget.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
    setOpen(!open);
  };

  return (
    <div ref={ref} className="relative w-full">
      <button
        onClick={toggleOpen}
        className="w-full text-left card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand dark:hover:border-brand-500 shadow-sm hover:shadow-md transition-all group flex items-start gap-3"
      >
        <div className={`p-2 rounded-lg border ${m.color} shrink-0 mt-0.5`}>
          <IconComp className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-brand transition-colors truncate">
            {m.label}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
            {m.desc}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-brand transition-all shrink-0 mt-1 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && m.actions && m.actions.length > 0 && (
        <div 
          className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-erp-lg border border-slate-200 dark:border-slate-700 py-1 z-[9999] overflow-hidden"
          style={{ top: coords.top, left: coords.left, width: Math.max(160, coords.width) }}
        >
          {m.actions.map((act, i) => (
            <button
              key={i}
              onClick={() => { navigate(act.path); setOpen(false); }}
              className="block w-full text-left px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              {act.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toDateStr = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const startOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const sumOutstanding = (items) =>
  (Array.isArray(items) ? items : []).reduce(
    (sum, row) => sum + Number(row?.outstanding || 0),
    0,
  );

const buildDeltaBadge = (current, previous, suffix) => {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return "";
  if (prev === 0) {
    return cur > 0 ? `↑ NEW ${suffix}` : `— ${suffix}`;
  }
  const delta = ((cur - prev) * 100) / prev;
  const rounded = Math.round(Math.abs(delta) * 10) / 10;
  if (rounded === 0) return `— ${suffix}`;
  return `${delta > 0 ? "↑" : "↓"} ${rounded}% ${suffix}`;
};

const MODULE_DEFINITIONS = [
  { key: "finance", label: "Finance & Accounting", path: "/finance/dashboard",
        actions: [
          { label: "View", path: "/finance/dashboard", type: "outline" }
        ], icon: DollarSign, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800", desc: "General ledger, vouchers, financial statements & AR/AP" },
  { key: "sales", label: "Sales & CRM", path: "/sales/dashboard",
        actions: [
          { label: "View", path: "/sales/dashboard", type: "outline" }
        ], icon: TrendingUp, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800", desc: "Quotations, sales orders, deliveries & customer billing" },
  { key: "inventory", label: "Inventory Management", path: "/inventory/dashboard",
        actions: [
          { label: "View", path: "/inventory/dashboard", type: "outline" }
        ], icon: Package, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800", desc: "Stock balances, warehouse transfers, GRN & valuation" },
  { key: "purchase", label: "Procurement & Purchase", path: "/purchase/dashboard",
        actions: [
          { label: "View", path: "/purchase/dashboard", type: "outline" }
        ], icon: ShoppingBag, color: "text-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800", desc: "Purchase requisitions, RFQs, POs & vendor management" },
  { key: "human-resources", label: "Human Resources & Payroll", path: "/human-resources/dashboard",
        actions: [
          { label: "View", path: "/human-resources/dashboard", type: "outline" }
        ], icon: Users, color: "text-violet-500 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800", desc: "Employee directory, attendance, leaves & monthly payroll" },
  { key: "maintenance", label: "Asset Maintenance", path: "/maintenance/dashboard",
        actions: [
          { label: "View", path: "/maintenance/dashboard", type: "outline" }
        ], icon: Wrench, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800", desc: "Work orders, preventive maintenance & downtime log" },
  { key: "production", label: "Production & Manufacturing", path: "/production/dashboard",
        actions: [
          { label: "View", path: "/production/dashboard", type: "outline" }
        ], icon: Boxes, color: "text-teal-500 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800", desc: "Bill of materials, work centers & production orders" },
  { key: "project-management", label: "Project Management", path: "/project-management/dashboard",
        actions: [
          { label: "View", path: "/project-management/dashboard", type: "outline" }
        ], icon: Layers, color: "text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800", desc: "Projects WBS, task assignments, execution & tracking" },
  { key: "service-management", label: "Service Management", path: "/service-management/dashboard",
        actions: [
          { label: "View", path: "/service-management/dashboard", type: "outline" }
        ], icon: ShieldCheck, color: "text-orange-500 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800", desc: "Service tickets, SLA tracking, executions & service billing" },
  { key: "business-intelligence", label: "Business Intelligence", path: "/business-intelligence",
        actions: [
          { label: "View", path: "/business-intelligence", type: "outline" },
          { label: "New", path: "/business-intelligence/new", type: "primary" }
        ], icon: Activity, color: "text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/40 border-fuchsia-200 dark:border-fuchsia-800", desc: "Executive analytics, KPI charts & custom dashboards" },
  { key: "administration", label: "System Administration", path: "/administration",
        actions: [
          { label: "View", path: "/administration", type: "outline" },
          { label: "New", path: "/administration/new", type: "primary" }
        ], icon: Building2, color: "text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700", desc: "User security roles, system configuration & logs" },
];

export default function ExecutiveOverviewHome() {
  const navigate = useNavigate();
  const { isModuleEnabled } = usePermission();

  const enabledModules = useMemo(
    () => MODULE_DEFINITIONS.filter((m) => isModuleEnabled(m.key)),
    [isModuleEnabled]
  );

  const [kpis, setKpis] = useState({
    outstandingReceivables: null,
    outstandingPayables: null,
    fastMovingCount: null,
    slowMovingCount: null,
    todaySales: null,
    weekSales: null,
    monthSales: null,
    supplierOutstanding: null,
    badges: {},
  });

  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadKpis() {
      try {
        setLoading(true);
        const today = new Date();
        const currentMonthStart = startOfMonth(today);
        const previousMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const previousMonthStart = startOfMonth(previousMonthDate);
        const previousMonthEnd = endOfMonth(previousMonthDate);
        const currentWeekStart = startOfWeek(today);
        const previousWeekEnd = new Date(currentWeekStart);
        previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);

        const [homeRes, weekRes, prevWeekRes, recRes, payRes, suppRes, fastRes, prevFastRes, slowRes, prevSlowRes] =
          await Promise.allSettled([
            api.get("/bi/home-overview"),
            api.get("/sales/dashboard/metrics", {
              params: { topProducts: 1, topCustomers: 1, from: toDateStr(currentWeekStart), to: toDateStr(today) },
            }),
            api.get("/sales/dashboard/metrics", {
              params: { topProducts: 1, topCustomers: 1, from: toDateStr(startOfWeek(previousWeekEnd)), to: toDateStr(previousWeekEnd) },
            }),
            api.get("/finance/reports/outstanding-receivable", {
              params: { from: null, to: null },
            }),
            api.get("/finance/reports/payment-due", {
              params: { from: null, to: null },
            }),
            api.get("/finance/reports/supplier-outstanding"),
            api.get("/inventory/reports/fast-moving", {
              params: { from: toDateStr(currentMonthStart), to: toDateStr(today) },
            }),
            api.get("/inventory/reports/fast-moving", {
              params: { from: toDateStr(previousMonthStart), to: toDateStr(previousMonthEnd) },
            }),
            api.get("/inventory/reports/slow-moving", {
              params: { from: toDateStr(currentMonthStart), to: toDateStr(today) },
            }),
            api.get("/inventory/reports/slow-moving", {
              params: { from: toDateStr(previousMonthStart), to: toDateStr(previousMonthEnd) },
            }),
          ]);

        if (!mounted) return;

        const homeData = homeRes.status === "fulfilled" ? homeRes.value.data?.cards || {} : {};
        const weekData = weekRes.status === "fulfilled" ? weekRes.value.data?.salesSummary || {} : {};
        const prevWeekData = prevWeekRes.status === "fulfilled" ? prevWeekRes.value.data?.salesSummary || {} : {};
        const recData = recRes.status === "fulfilled" ? recRes.value.data?.items || [] : [];
        const payData = payRes.status === "fulfilled" ? payRes.value.data?.items || [] : [];
        const suppData = suppRes.status === "fulfilled" ? suppRes.value.data?.items || [] : [];
        const fastData = fastRes.status === "fulfilled" ? fastRes.value.data?.items || [] : [];
        const prevFastData = prevFastRes.status === "fulfilled" ? prevFastRes.value.data?.items || [] : [];
        const slowData = slowRes.status === "fulfilled" ? slowRes.value.data?.items || [] : [];
        const prevSlowData = prevSlowRes.status === "fulfilled" ? prevSlowRes.value.data?.items || [] : [];

        try {
          const wfResponse = await api.get("/executive-overview/workflows");
          setWorkflows(wfResponse?.data?.data || []);
        } catch (e) {
          console.error("Failed to load workflows", e);
        }

        const outstandingReceivablesVal = sumOutstanding(recData);
        const outstandingPayablesVal = sumOutstanding(payData);
        const supplierOutstandingVal = sumOutstanding(suppData);
        const todaySalesVal = Number(homeData.todaySales || 0);
        const monthSalesVal = Number(homeData.monthSales || 0);
        const weekSalesVal = Number(weekData.netSales || 0);
        const prevWeekSalesVal = Number(prevWeekData.netSales || 0);
        const fastMovingCountVal = fastData.length;
        const prevFastMovingCountVal = prevFastData.length;
        const slowMovingCountVal = slowData.length;
        const prevSlowMovingCountVal = prevSlowData.length;

        setKpis({
          outstandingReceivables: outstandingReceivablesVal,
          outstandingPayables: outstandingPayablesVal,
          supplierOutstanding: supplierOutstandingVal,
          todaySales: todaySalesVal,
          weekSales: weekSalesVal,
          monthSales: monthSalesVal,
          fastMovingCount: fastMovingCountVal,
          slowMovingCount: slowMovingCountVal,
          badges: {
            todaySales: buildDeltaBadge(todaySalesVal, homeData.prevMonthSales ? homeData.prevMonthSales / 30 : 0, "vs avg"),
            weekSales: buildDeltaBadge(weekSalesVal, prevWeekSalesVal, "vs prev week"),
            monthSales: buildDeltaBadge(monthSalesVal, homeData.prevMonthSales || 0, "vs prev mo"),
            fastMovingCount: buildDeltaBadge(fastMovingCountVal, prevFastMovingCountVal, "vs prev mo"),
            slowMovingCount: buildDeltaBadge(slowMovingCountVal, prevSlowMovingCountVal, "vs prev mo"),
          },
        });
      } catch (err) {
        console.error("Failed to load Executive Overview KPIs", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadKpis();
    return () => {
      mounted = false;
    };
  }, []);

  const KPI_CARDS = [
    {
      label: "Outstanding Receivables",
      kpiKey: "outstandingReceivables",
      path: "/executive-overview/outstanding-receivables",
        actions: [
          { label: "View", path: "/executive-overview/outstanding-receivables", type: "outline" },
          { label: "New", path: "/executive-overview/outstanding-receivables/new", type: "primary" }
        ],
      desc: "Customer invoices due",
    },
    {
      label: "Outstanding Payables",
      kpiKey: "outstandingPayables",
      path: "/executive-overview/outstanding-payables",
        actions: [
          { label: "View", path: "/executive-overview/outstanding-payables", type: "outline" },
          { label: "New", path: "/executive-overview/outstanding-payables/new", type: "primary" }
        ],
      desc: "Supplier payments owed",
    },
    {
      label: "Today's Sales",
      kpiKey: "todaySales",
      badgeKey: "todaySales",
      path: "/executive-overview/sales-today",
        actions: [
          { label: "View", path: "/executive-overview/sales-today", type: "outline" },
          { label: "New", path: "/executive-overview/sales-today/new", type: "primary" }
        ],
      desc: "Revenue generated today",
    },
    {
      label: "Current Month Revenue",
      kpiKey: "monthSales",
      badgeKey: "monthSales",
      path: "/executive-overview/sales-this-month",
        actions: [
          { label: "View", path: "/executive-overview/sales-this-month", type: "outline" },
          { label: "New", path: "/executive-overview/sales-this-month/new", type: "primary" }
        ],
      desc: "Month-to-date revenue",
    },
    {
      label: "Current Week Revenue",
      kpiKey: "weekSales",
      badgeKey: "weekSales",
      path: "/executive-overview/sales-this-week",
        actions: [
          { label: "View", path: "/executive-overview/sales-this-week", type: "outline" },
          { label: "New", path: "/executive-overview/sales-this-week/new", type: "primary" }
        ],
      desc: "Week-to-date revenue",
    },
    {
      label: "Supplier Outstanding",
      kpiKey: "supplierOutstanding",
      path: "/executive-overview/supplier-outstanding",
        actions: [
          { label: "View", path: "/executive-overview/supplier-outstanding", type: "outline" },
          { label: "New", path: "/executive-overview/supplier-outstanding/new", type: "primary" }
        ],
      desc: "Total owed to suppliers",
    },
    {
      label: "Fast Moving Items",
      kpiKey: "fastMovingCount",
      badgeKey: "fastMovingCount",
      format: "count",
      path: "/executive-overview/fast-moving-items",
        actions: [
          { label: "View", path: "/executive-overview/fast-moving-items", type: "outline" },
          { label: "New", path: "/executive-overview/fast-moving-items/new", type: "primary" }
        ],
      desc: "High turnover stock items",
    },
    {
      label: "Slow Moving Items",
      kpiKey: "slowMovingCount",
      badgeKey: "slowMovingCount",
      format: "count",
      path: "/executive-overview/slow-moving-items",
        actions: [
          { label: "View", path: "/executive-overview/slow-moving-items", type: "outline" },
          { label: "New", path: "/executive-overview/slow-moving-items/new", type: "primary" }
        ],
      desc: "Low turnover stock items",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Upper Top Sticky Navigation Bar (Identical layout to BI Module) */}
      <div className="hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm px-4 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <NavLink
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors flex-shrink-0"
          >
            <ArrowLeft size={14} />
            Modules
          </NavLink>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1.5 flex-shrink-0" />
          <NavLink
            to="/executive-overview"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-900 text-white whitespace-nowrap flex-shrink-0"
          >
            <BarChart3 size={14} />
            Executive Overview
          </NavLink>
          <ExecNavDropdown label="Key Performance Indicators" items={KPI_CARDS} navigate={navigate} />
          <ExecNavDropdown label="Enterprise Modules" items={enabledModules} navigate={navigate} />
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 mb-6">
        {/* Header Banner */}
        <div className="card shadow-md">
          <div className="card-header bg-brand text-white rounded-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold flex items-center gap-2">
                    Executive Overview Dashboard
                  </h1>
                  <p className="text-sm mt-0.5 opacity-90">
                    Real-time enterprise metrics, KPI reporting, and strategic operational insights
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:items-end text-xs text-white/90">
                <span className="font-semibold">
                  {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </span>
                <span className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 font-bold text-[10px] uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> System Operational
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full px-4 sm:px-6 flex flex-col xl:flex-row gap-6 items-stretch">
        {/* Main Content (Left Column) */}
        <div className="flex-1 min-w-0 w-full">
          {/* Signature Key Performance Indicators Section (Original 4-Card Vibrant UI) */}
          <div className="space-y-4 h-full">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" /> Key Performance Indicators
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                Click to view detailed reports
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {KPI_CARDS.map((card, i) => {
                const val = card.kpiKey ? kpis[card.kpiKey] : null;
                const hasValue = val !== null && val !== undefined;
                const badgeText = card.badgeKey ? kpis.badges?.[card.badgeKey] : "";
                const cardType = i % 4;

                const formattedVal = hasValue
                  ? card.format === "count"
                    ? Number(val || 0).toLocaleString()
                    : `₵${fmt(val)}`
                  : loading
                  ? "Loading..."
                  : "—";

                if (cardType === 0) {
                  // Card 1: Amber Gold
                  return (
                    <button
                      key={i}
                      onClick={() => navigate(card.path)}
                      className="group relative overflow-hidden rounded-[24px] p-5 shadow-[0_15px_30px_-5px_rgba(178,110,23,0.25)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(178,110,23,0.4)] active:scale-[0.98] transition-all duration-300 ease-out text-left focus:outline-none focus:ring-2 focus:ring-amber-500 bg-[#b26e17] text-white flex flex-col justify-between min-h-[140px]"
                    >
                      <div className="flex justify-between items-start min-h-[22px]">
                        <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold leading-none">{card.desc}</p>
                        {badgeText ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] leading-none flex items-center">
                            {badgeText}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        <div 
                          className="text-2xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_8px_rgba(255,255,255,0.35)]"
                          style={{ textShadow: "0 0 12px rgba(255, 255, 255, 0.45)" }}
                        >
                          {formattedVal}
                        </div>
                        <div className="mt-2 text-xs font-bold text-white/80 uppercase tracking-wider leading-none">
                          {card.label}
                        </div>
                      </div>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                    </button>
                  );
                } else if (cardType === 1) {
                  // Card 2: Steel Blue
                  return (
                    <button
                      key={i}
                      onClick={() => navigate(card.path)}
                      className="group relative overflow-hidden rounded-[24px] p-5 shadow-[0_15px_30px_-5px_rgba(36,82,109,0.25)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(36,82,109,0.4)] active:scale-[0.98] transition-all duration-300 ease-out text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[#24526d] text-white flex flex-col justify-between min-h-[140px]"
                    >
                      <div className="flex justify-between items-start min-h-[22px]">
                        <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold leading-none">{card.desc}</p>
                        {badgeText ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 backdrop-blur-md text-amber-200 border border-amber-400/20 shadow-sm leading-none flex items-center">
                            {badgeText}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        <div className="text-2xl font-extrabold text-white tracking-tight">
                          {formattedVal}
                        </div>
                        <div className="mt-2 text-xs font-bold text-white/80 uppercase tracking-wider leading-none flex items-center justify-between">
                          <span>{card.label}</span>
                          <svg className="w-8 h-4 text-white/30 ml-2 group-hover:text-white/50 transition-colors" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M0 15 L10 12 L20 18 L30 8 L40 10 L50 2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                    </button>
                  );
                } else if (cardType === 2) {
                  // Card 3: Teal Green
                  return (
                    <button
                      key={i}
                      onClick={() => navigate(card.path)}
                      className="group relative overflow-hidden rounded-[24px] p-5 shadow-[0_15px_30px_-5px_rgba(24,117,92,0.25)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(24,117,92,0.4)] active:scale-[0.98] transition-all duration-300 ease-out text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-[#18755c] text-white flex flex-col justify-between min-h-[140px]"
                    >
                      <div className="flex justify-between items-start min-h-[22px]">
                        <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold leading-none">{card.desc}</p>
                        {badgeText ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 border border-white/15 shadow-sm leading-none flex items-center">
                            {badgeText}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        <div className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
                          <span>{formattedVal}</span>
                          <ArrowUpRight className="w-5 h-5 text-white/50 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                        <div className="mt-2 text-xs font-bold text-white/80 uppercase tracking-wider leading-none">
                          {card.label}
                        </div>
                      </div>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                    </button>
                  );
                } else {
                  // Card 4: Carbon Black
                  return (
                    <button
                      key={i}
                      onClick={() => navigate(card.path)}
                      className="group relative overflow-hidden rounded-[24px] p-5 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.25)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.5)] border border-white/5 hover:border-white/15 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] active:scale-[0.98] transition-all duration-300 ease-out text-left focus:outline-none focus:ring-2 focus:ring-slate-500 bg-[#1d1f22] bg-[radial-gradient(#ffffff06_1px,transparent_1px)] [background-size:8px_8px] text-white flex flex-col justify-between min-h-[140px]"
                    >
                      <div className="flex justify-between items-start min-h-[22px]">
                        <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold leading-none">{card.desc}</p>
                        {badgeText ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white border border-white/20 shadow-sm leading-none flex items-center">
                            {badgeText}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        <div className="text-2xl font-extrabold text-white tracking-tight">
                          {formattedVal}
                        </div>
                        <div className="mt-2 text-xs font-bold text-white/80 uppercase tracking-wider leading-none">
                          {card.label}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/30 absolute right-4 bottom-4 group-hover:translate-x-1 group-hover:text-white/70 transition-all" />
                    </button>
                  );
                }
              })}
            </div>
          </div>
        </div>

        {/* Floating Enterprise ERP Modules Quick Launch (Right Column) */}
        <div className="w-full xl:w-[340px] 2xl:w-[400px] shrink-0 xl:relative flex flex-col">
          <div className="xl:absolute xl:inset-0 flex flex-col flex-1 w-full">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-4 shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" /> Module Quick Launch
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {enabledModules.length} Modules
              </span>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pb-4 pr-1 erp-scrollbar flex flex-col gap-3">
              {enabledModules.map((m) => (
                <ModuleLaunchCard key={m.key} m={m} navigate={navigate} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Full-Width Section */}
      <div className="w-full px-4 sm:px-6 pb-8">
        {/* Workflow Overview Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-500" /> Workflow Overview
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {workflows.length} Pending Actions
            </span>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-120px)] erp-scrollbar">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Document No</th>
                    <th className="px-4 py-3 font-semibold">Module</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Forwarded To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {workflows.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                        No pending workflows or drafts.
                      </td>
                    </tr>
                  ) : (
                    workflows.map((wf, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-brand">{wf.doc_no || "-"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {wf.module}
                          </span>
                        </td>
                        <td className="px-4 py-3">{wf.type}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            wf.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                            wf.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {wf.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{wf.doc_date ? new Date(wf.doc_date).toLocaleDateString() : "-"}</td>
                        <td className="px-4 py-3">
                          {wf.assigned_to ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold">
                                {wf.assigned_to.substring(0, 1).toUpperCase()}
                              </div>
                              <span>{wf.assigned_to}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Unassigned</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
