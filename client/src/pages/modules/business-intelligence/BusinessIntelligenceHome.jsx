/**
 * @fileoverview BusinessIntelligenceHome - Full Enterprise BI & ETL Platform Router
 * Comprehensive 7-Pillar Architecture:
 * 1. Executive Dashboard
 * 2. Data (Sources, Datasets, Data Preparation, Star Schema Data Models, Data Quality)
 * 3. ETL (ETL Pipelines, Execution Stepper, Run Logs)
 * 4. Analytics (Multidimensional OLAP Slicing, Domain Analytics, KPI Center, Data Explorer)
 * 5. Insights (Automated Business Exceptions, AI Insights, Ask Banks, Alerts)
 * 6. Visualization (Custom Dashboard Builder, Dashboards)
 * 7. Reports & Settings (Report Center, BI Configurations)
 */
import React, { lazy, Suspense, useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, TrendingUp, Package, ShoppingCart, Users, Wrench,
  Factory, FolderKanban, Truck, HeadphonesIcon, Zap, Shield,
  Layers, Target, PieChart, FileText, Database, Brain, Bell,
  Settings, ChevronDown, ArrowLeft, Sparkles, GitPullRequest,
  ShieldCheck, Wand2, Boxes, BarChart3, SlidersHorizontal, Table2
} from "lucide-react";

import { usePermission } from "../../../auth/PermissionContext.jsx";

// Eager
import ExecutiveDashboard from "./ExecutiveDashboard.jsx";

// New ETL & Analytical Layer Pages
const DataSourcesManagement      = lazy(() => import("./DataSourcesManagement.jsx"));
const DatasetsPage               = lazy(() => import("./DatasetsPage.jsx"));
const DataPreparationPage        = lazy(() => import("./DataPreparationPage.jsx"));
const DataModelsPage             = lazy(() => import("./DataModelsPage.jsx"));
const ETLPipelinesPage           = lazy(() => import("./ETLPipelinesPage.jsx"));
const DataQualityPage            = lazy(() => import("./DataQualityPage.jsx"));
const MultidimensionalAnalysisPage = lazy(() => import("./MultidimensionalAnalysisPage.jsx"));
const DashboardBuilderPage       = lazy(() => import("./DashboardBuilderPage.jsx"));
const BusinessInsightsPage       = lazy(() => import("./BusinessInsightsPage.jsx"));

// Domain Analytics Pages
const FinancialAnalytics    = lazy(() => import("./FinancialAnalytics.jsx"));
const InventoryAnalytics    = lazy(() => import("./InventoryAnalytics.jsx"));
const PurchaseAnalytics     = lazy(() => import("./PurchaseAnalytics.jsx"));
const HRAnalytics           = lazy(() => import("./HRAnalytics.jsx"));
const MaintenanceAnalytics  = lazy(() => import("./MaintenanceAnalytics.jsx"));
const ProductionAnalytics   = lazy(() => import("./ProductionAnalytics.jsx"));
const ProjectAnalytics      = lazy(() => import("./ProjectAnalytics.jsx"));
const TransportAnalytics    = lazy(() => import("./TransportAnalytics.jsx"));
const ServiceAnalytics      = lazy(() => import("./ServiceAnalytics.jsx"));
const POSAnalytics          = lazy(() => import("./POSAnalytics.jsx"));
const AdminAnalytics        = lazy(() => import("./AdminAnalytics.jsx"));
const CrossModuleAnalytics  = lazy(() => import("./CrossModuleAnalytics.jsx"));
const KPICenter             = lazy(() => import("./KPICenter.jsx"));
const DashboardList         = lazy(() => import("./dashboards/DashboardList.jsx"));
const DashboardForm         = lazy(() => import("./dashboards/DashboardForm.jsx"));
const ReportCenter          = lazy(() => import("./ReportCenter.jsx"));
const DataExplorer          = lazy(() => import("./DataExplorer.jsx"));
const AIInsights            = lazy(() => import("./AIInsights.jsx"));
const BanksAiPage           = lazy(() => import("./BanksAiPage.jsx"));
const AlertsCenter          = lazy(() => import("./AlertsCenter.jsx"));
const BISettings            = lazy(() => import("./BISettings.jsx"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-600 border-t-transparent" />
    </div>
  );
}

// ─── Navigation config ─────────────────────────────────
const NAV_GROUPS = [
  {
    label: "Executive Dashboard",
    single: true,
    path: "/business-intelligence/executive-dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Domain Analytics",
    items: [
      { label: "Financial Analytics",     path: "/business-intelligence/financial",        icon: TrendingUp, moduleKey: "finance" },
      { label: "Inventory Analytics",     path: "/business-intelligence/inventory",        icon: Package, moduleKey: "inventory" },
      { label: "Purchase Analytics",      path: "/business-intelligence/purchase",         icon: ShoppingCart, moduleKey: "purchase" },
      { label: "HR Analytics",            path: "/business-intelligence/hr",               icon: Users, moduleKey: "hr" },
      { label: "Maintenance Analytics",   path: "/business-intelligence/maintenance",      icon: Wrench, moduleKey: "maintenance" },
      { label: "Production Analytics",    path: "/business-intelligence/production",       icon: Factory, moduleKey: "production" },
      { label: "Project Analytics",       path: "/business-intelligence/projects",         icon: FolderKanban, moduleKey: "pm" },
      { label: "Transport Analytics",     path: "/business-intelligence/transport",        icon: Truck, moduleKey: "transport" },
      { label: "Service Analytics",       path: "/business-intelligence/service",          icon: HeadphonesIcon, moduleKey: "service" },
      { label: "POS Analytics",           path: "/business-intelligence/pos",              icon: Zap, moduleKey: "pos" },
      { label: "Administration Analytics",path: "/business-intelligence/administration",   icon: Shield, moduleKey: "admin" },
      { label: "Cross Module Analytics",  path: "/business-intelligence/cross-module",     icon: Layers },
    ],
  },
  {
    label: "BI Tools",
    items: [
      { label: "KPI Center",              path: "/business-intelligence/kpi-center",       icon: Target },
      { label: "Dashboards",              path: "/business-intelligence/dashboards",       icon: PieChart },
      { label: "Report Center",           path: "/business-intelligence/report-center",    icon: FileText },
      { label: "Data Explorer",           path: "/business-intelligence/data-explorer",    icon: Database },
      { label: "AI Insights",             path: "/business-intelligence/ai-insights",      icon: Brain },
      { label: "Ask Banks AI",            path: "/business-intelligence/banks-ai",         icon: Sparkles },
      { label: "Alerts Center",           path: "/business-intelligence/alerts",           icon: Bell },
      { label: "BI Settings",             path: "/business-intelligence/settings",         icon: Settings },
    ],
  },
  {
    label: "Data & ETL Integration",
    items: [
      { label: "Data Sources & Ingestion", path: "/business-intelligence/data-sources",    icon: Database },
      { label: "Analytical Datasets",     path: "/business-intelligence/datasets",        icon: Layers },
      { label: "Data Preparation Studio",  path: "/business-intelligence/data-prep",       icon: Wand2 },
      { label: "Data Models & Star Schema",path: "/business-intelligence/data-models",     icon: Boxes },
      { label: "ETL Pipelines Manager",   path: "/business-intelligence/etl-pipelines",   icon: GitPullRequest },
      { label: "Data Quality & Quarantine",path: "/business-intelligence/data-quality",    icon: ShieldCheck },
      { label: "Multidimensional Slicing", path: "/business-intelligence/multidimensional",icon: BarChart3 },
      { label: "Automated Exceptions",    path: "/business-intelligence/insights",        icon: Brain },
      { label: "Dashboard Builder",       path: "/business-intelligence/dashboard-builder",icon: SlidersHorizontal },
    ],
  },
];

import { createPortal } from "react-dom";

// ─── Floating Dropdown component (Portal-based floating positioning) ───
function NavDropdown({ group, location, navigate }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const isGroupActive = group.items?.some(i => location.pathname === i.path);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const panelWidth = 260;
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - panelWidth - 16));
      setCoords({
        top: rect.bottom + 6,
        left: left,
      });
    }
  };

  const handleToggle = () => {
    updatePosition();
    setOpen(v => !v);
  };

  // Reposition on scroll or resize
  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleScrollResize = () => {
      updatePosition();
    };

    const handleClickOutside = (e) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap shadow-sm ${
          isGroupActive
            ? "bg-brand-900 text-white shadow-erp"
            : open
            ? "bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20"
            : "bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-brand-300"
        }`}
      >
        <span>{group.label}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 text-slate-400 group-hover:text-slate-600 ${open ? "rotate-180 text-brand-600" : ""}`} />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: 270,
            zIndex: 99999,
          }}
          className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/90 rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 p-2 transform origin-top animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {group.label}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {group.items?.length || 0} items
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1 max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium text-left transition-all group ${
                    isActive
                      ? "bg-brand-900 text-white shadow-sm font-semibold"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-brand-900 dark:hover:text-white"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-brand-600 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/40"
                  }`}>
                    <Icon size={14} />
                  </div>
                  <span className="truncate flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Filtered Nav Groups Hook (Enforces Module & Feature Registry Permissions) ───
function useFilteredNavGroups() {
  const { canViewModule, canAccessPath } = usePermission();
  return NAV_GROUPS.map(g => {
    if (g.single) {
      return canAccessPath(g.path) ? g : null;
    }
    if (!g.items) return g;
    return {
      ...g,
      items: g.items.filter(i => {
        if (i.moduleKey && !canViewModule(i.moduleKey)) return false;
        return canAccessPath(i.path);
      })
    };
  }).filter(g => g && (g.single || (g.items && g.items.length > 0)));
}

// ─── Top Navigation Bar ──────────────────────────────────
function BINavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const filteredGroups = useFilteredNavGroups();

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
      <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
        {/* Back to Modules */}
        <NavLink
          to="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={14} />
          Modules
        </NavLink>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1.5 flex-shrink-0" />

        {/* 7 Pillars Navigation */}
        {filteredGroups.map(group => {
          if (group.single) {
            const Icon = group.icon;
            return (
              <NavLink
                key={group.path}
                to={group.path}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    isActive
                      ? "bg-brand-900 text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-700 dark:hover:text-brand-300"
                  }`
                }
              >
                {Icon && <Icon size={14} />}
                {group.label}
              </NavLink>
            );
          }

          return (
            <NavDropdown
              key={group.label}
              group={group}
              location={location}
              navigate={navigate}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Hub landing page ─────────────────────────────────
function BIHub() {
  const navigate = useNavigate();
  const filteredGroups = useFilteredNavGroups();
  const allGroups = filteredGroups.filter(g => !g.single);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 p-6 text-white shadow-erp-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Brain size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">OmniSuite BI & Data Analytics Platform</h1>
            <p className="text-brand-200 text-sm">Enterprise ETL, Analytical Star Schema, OLAP Slicing, Anomaly Detection & Insights</p>
          </div>
        </div>
        <p className="text-brand-200 text-sm mt-3 max-w-3xl">
          Unified end-to-end data platform connecting all ERP modules, file sources, automated ETL pipelines, 
          quarantine data quality checks, multidimensional analysis, and AI-driven business exceptions.
        </p>
      </div>

      {/* Quick Access Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate("/business-intelligence/executive-dashboard")}
          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-400 hover:shadow-erp transition-all group text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-300">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Executive Dashboard</div>
            <div className="text-xs text-slate-400">Cross-module KPI overview & trends</div>
          </div>
        </button>

        <button
          onClick={() => navigate("/business-intelligence/etl-pipelines")}
          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-400 hover:shadow-erp transition-all group text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
            <GitPullRequest size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">ETL Pipeline Manager</div>
            <div className="text-xs text-slate-400">Extract, transform & load workflows</div>
          </div>
        </button>

        <button
          onClick={() => navigate("/business-intelligence/multidimensional")}
          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-400 hover:shadow-erp transition-all group text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300">
            <BarChart3 size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Multidimensional OLAP</div>
            <div className="text-xs text-slate-400">Dynamic slice, dice & variance drill-downs</div>
          </div>
        </button>
      </div>

      {/* Section cards */}
      {allGroups.map((group) => (
        <div key={group.label} className="space-y-3">
          <h2 className="text-xs font-bold text-brand-900 dark:text-brand-300 uppercase tracking-widest">{group.label}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex flex-col items-start gap-2 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-400 hover:shadow-erp transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center group-hover:bg-brand-100 dark:group-hover:bg-brand-900/60 transition-colors">
                    <Icon size={18} className="text-brand-600 dark:text-brand-400" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────
export default function BusinessIntelligenceHome() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <BINavBar />
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 min-w-0">
        <Suspense fallback={<div className="p-6"><PageLoader /></div>}>
          <Routes>
            <Route path="/"                     element={<BIHub />} />
            <Route path="/executive-dashboard"  element={<div className="p-6"><ExecutiveDashboard /></div>} />

            {/* Data Layer */}
            <Route path="/data-sources"         element={<div className="p-6"><DataSourcesManagement /></div>} />
            <Route path="/datasets"             element={<div className="p-6"><DatasetsPage /></div>} />
            <Route path="/data-prep"            element={<div className="p-6"><DataPreparationPage /></div>} />
            <Route path="/data-models"          element={<div className="p-6"><DataModelsPage /></div>} />
            <Route path="/data-quality"         element={<div className="p-6"><DataQualityPage /></div>} />

            {/* ETL Pipelines */}
            <Route path="/etl-pipelines"        element={<div className="p-6"><ETLPipelinesPage /></div>} />

            {/* Analytics & OLAP */}
            <Route path="/multidimensional"     element={<div className="p-6"><MultidimensionalAnalysisPage /></div>} />
            <Route path="/financial"            element={<div className="p-6"><FinancialAnalytics /></div>} />
            <Route path="/inventory"            element={<div className="p-6"><InventoryAnalytics /></div>} />
            <Route path="/purchase"             element={<div className="p-6"><PurchaseAnalytics /></div>} />
            <Route path="/hr"                   element={<div className="p-6"><HRAnalytics /></div>} />
            <Route path="/maintenance"          element={<div className="p-6"><MaintenanceAnalytics /></div>} />
            <Route path="/production"           element={<div className="p-6"><ProductionAnalytics /></div>} />
            <Route path="/projects"             element={<div className="p-6"><ProjectAnalytics /></div>} />
            <Route path="/transport"            element={<div className="p-6"><TransportAnalytics /></div>} />
            <Route path="/service"              element={<div className="p-6"><ServiceAnalytics /></div>} />
            <Route path="/pos"                  element={<div className="p-6"><POSAnalytics /></div>} />
            <Route path="/administration"       element={<div className="p-6"><AdminAnalytics /></div>} />
            <Route path="/cross-module"         element={<div className="p-6"><CrossModuleAnalytics /></div>} />
            <Route path="/kpi-center"           element={<div className="p-6"><KPICenter /></div>} />
            <Route path="/data-explorer"        element={<div className="p-6"><DataExplorer /></div>} />

            {/* Insights & AI */}
            <Route path="/insights"             element={<div className="p-6"><BusinessInsightsPage /></div>} />
            <Route path="/ai-insights"          element={<div className="p-6"><AIInsights /></div>} />
            <Route path="/banks-ai"             element={<div className="p-6"><BanksAiPage /></div>} />
            <Route path="/alerts"               element={<div className="p-6"><AlertsCenter /></div>} />

            {/* Visualization */}
            <Route path="/dashboard-builder"    element={<div className="p-6"><DashboardBuilderPage /></div>} />
            <Route path="/dashboards"           element={<div className="p-6"><DashboardList /></div>} />
            <Route path="/dashboards/new"       element={<div className="p-6"><DashboardForm /></div>} />
            <Route path="/dashboards/:id/edit"  element={<div className="p-6"><DashboardForm /></div>} />

            {/* Reports & Settings */}
            <Route path="/report-center"        element={<div className="p-6"><ReportCenter /></div>} />
            <Route path="/settings"             element={<div className="p-6"><BISettings /></div>} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
