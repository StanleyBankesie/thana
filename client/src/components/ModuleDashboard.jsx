const getSectionIcon = (section, sectionIndex) => {
  if (section.icon) return section.icon;
  const title = (section.title || section.category || "").toLowerCase();
  
  if (title.includes("master") || title.includes("catalog")) return "🗂️";
  if (title.includes("operation") || title.includes("schedule") || title.includes("execution")) return "🗓️";
  if (title.includes("procurement") || title.includes("purchase") || title.includes("requisition")) return "🛒";
  if (title.includes("report") || title.includes("analytic") || title.includes("intelligence") || title.includes("analytics")) return "📊";
  if (title.includes("sale") || title.includes("transaction")) return "💳";
  if (title.includes("customer")) return "👥";
  if (title.includes("price") || title.includes("discount") || title.includes("promot")) return "🏷️";
  if (title.includes("bill") || title.includes("invoice") || title.includes("payable") || title.includes("receivable")) return "🧾";
  if (title.includes("logistics") || title.includes("deliver") || title.includes("shipping") || title.includes("transport")) return "🚚";
  if (title.includes("stock") || title.includes("inventory") || title.includes("warehouse")) return "🏬";
  if (title.includes("account") || title.includes("bank") || title.includes("finance") || title.includes("ledger") || title.includes("journal") || title.includes("cheque") || title.includes("pdc")) return "🏦";
  if (title.includes("employee") || title.includes("hr") || title.includes("payroll") || title.includes("staff") || title.includes("people")) return "👔";
  if (title.includes("leave") || title.includes("attendance") || title.includes("time")) return "⏰";
  if (title.includes("user") || title.includes("access") || title.includes("role") || title.includes("security") || title.includes("permission")) return "🔒";
  if (title.includes("audit") || title.includes("log")) return "📜";
  if (title.includes("workflow") || title.includes("approval")) return "🔄";
  if (title.includes("setup") || title.includes("setting") || title.includes("config") || title.includes("parameter") || title.includes("structure")) return "⚙️";
  if (title.includes("manufactur") || title.includes("production") || title.includes("shop floor")) return "🏭";
  if (title.includes("project") || title.includes("portfolio") || title.includes("task") || title.includes("wbs") || title.includes("milestone")) return "📌";
  if (title.includes("service") || title.includes("technician")) return "🛠️";
  if (title.includes("visitor")) return "📇";
  if (title.includes("license") || title.includes("package")) return "📜";
  if (title.includes("company") || title.includes("branch") || title.includes("organization")) return "🏢";
  if (title.includes("vehicle") || title.includes("trip") || title.includes("fuel")) return "⛽";

  const fallbackIcons = ["🗂️", "📦", "🧩", "💼", "🔖", "🗃️", "⚡"];
  return fallbackIcons[sectionIndex % fallbackIcons.length];
};

import React, { useState, useMemo } from "react";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { usePermission } from "../auth/PermissionContext.jsx";
import { MODULES_REGISTRY } from "../data/modulesRegistry.js";
import { ModuleTopNavBar } from "./ModuleLayout.jsx";

// ─── Module Top Navigation Dropdown Component ───────────────────
function ModuleNavDropdown({ section, location, navigate }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  const visibleItems = useMemo(() => {
    const rawItems = section.items || section.features || [];
    return rawItems.filter((item) => item && !item.hidden && (item.path || item.title || item.name || item.label));
  }, [section]);

  React.useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (visibleItems.length === 0) return null;

  const sectionTitle = section.title || section.name || section.category || "Section";
  const isSectionActive = visibleItems.some((i) => location.pathname === i.path);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          isSectionActive
            ? "bg-brand-900 text-white"
            : "text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-700 dark:hover:text-brand-300"
        }`}
      >
        <span>{sectionTitle}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-erp-lg overflow-hidden"
          style={{ minWidth: 240, maxWidth: 360 }}
        >
          <div className="p-1.5 grid grid-cols-1 gap-1 max-h-80 overflow-y-auto">
            {visibleItems.map((item, idx) => {
              const itemTitle = item.title || item.name || item.label;
              const itemPath = item.path;
              const itemIcon = item.icon;
              const itemDesc = item.description || item.desc;
              const isActive = location.pathname === itemPath;

              return (
                <button
                  key={itemPath || itemTitle || idx}
                  onClick={() => {
                    if (itemPath) navigate(itemPath);
                    setOpen(false);
                  }}
                  className={`flex items-start gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                    isActive
                      ? "bg-brand-900 text-white"
                      : "text-slate-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-700 dark:hover:text-brand-300"
                  }`}
                >
                  {typeof itemIcon === "string" ? (
                    <span className="text-base flex-shrink-0 mt-0.5">{itemIcon}</span>
                  ) : itemIcon ? (
                    React.createElement(itemIcon, { className: "w-4 h-4 flex-shrink-0 mt-0.5" })
                  ) : (
                    <span className="text-base flex-shrink-0 mt-0.5">📄</span>
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate leading-snug">{itemTitle}</span>
                    {itemDesc && (
                      <span className={`text-[11px] font-normal truncate leading-tight ${isActive ? "text-white/80" : "text-slate-400 dark:text-slate-500"}`}>
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

const ModuleDashboard = ({
  title,
  description,
  stats = [],
  quickActions = [],
  sections = [],
  features = [],
  headerActions = [],
  showAll = false,
  moduleKey,
  useSectionNavigation = false,
  hideOtherPages = false,
}) => {
  const [activeSection, setActiveSection] = React.useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search || "");
    const secParam = searchParams.get("section");
    if (secParam !== null && sections.length > 0) {
      const secIdx = sections.findIndex(
        (s, idx) =>
          String(idx) === secParam ||
          String(s.title || s.category || "").toLowerCase() === secParam.toLowerCase()
      );
      if (secIdx !== -1) {
        setActiveSection(secIdx);
      }
    }
  }, [location.search, sections]);
  const { canAccessPath, canAccessFeatureKey, canViewDashboardElement, isSuper } =
    usePermission();

  const isDashboardPath = (path) => {
    const parts = String(path || "").split("/").filter(Boolean);
    const last = String(parts[parts.length - 1] || "");
    return last.toLowerCase() === "dashboard" || last.toLowerCase() === "dashboards";
  };

  // Auto-inject a Dashboard button if the module has registered dashboards
  const resolvedHeaderActions = useMemo(() => {
    const actions = Array.isArray(headerActions) ? [...headerActions] : [];
    const mk = moduleKey || (location.pathname.split("/").filter(Boolean)[0] || "");
    const moduleInfo = MODULES_REGISTRY[mk];
    const hasDashboards = moduleInfo && moduleInfo.dashboards && moduleInfo.dashboards.length > 0;
    
    const isDashboardAllowed =
      canViewDashboardElement(mk, "dashboard", "dashboard") !== false &&
      canViewDashboardElement(mk, "dashboard", "dashboards") !== false;

    const dbPath = `/${mk}/dashboard`;
    const dbsPath = `/${mk}/dashboards`;
    const canAccessDb = canAccessPath(dbPath) || canAccessPath(dbsPath);

    if (
      mk &&
      hasDashboards &&
      canAccessDb &&
      isDashboardAllowed &&
      !actions.some((a) => String(a.path || "") === dbPath || String(a.path || "") === dbsPath)
    ) {
      const targetPath = canAccessPath(dbPath) ? dbPath : dbsPath;
      actions.push({ label: "Dashboard", path: targetPath, icon: "📊" });
    }
    return actions.filter((a) => {
      const p = String(a?.path || "");
      if (mk && isDashboardPath(p)) {
        return isDashboardAllowed;
      }
      return true;
    });
  }, [headerActions, moduleKey, location.pathname, canAccessPath, canViewDashboardElement]);
  const [searchTerm, setSearchTerm] = useState("");

  const handleNavigate = (path, e) => {
    if (e) e.stopPropagation();
    if (path) navigate(path);
  };

  const statGradients = [
    "from-green-500 to-green-600",
    "from-blue-500 to-blue-600",
    "from-purple-500 to-purple-600",
    "from-orange-500 to-orange-600",
    "from-pink-500 to-pink-600",
    "from-teal-500 to-teal-600",
    "from-red-500 to-red-600",
    "from-amber-500 to-amber-600",
  ];

  const randomStatGradients = React.useMemo(() => {
    const shuffled = [...statGradients];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selections = [];
    for (let i = 0; i < stats.length; i++) {
      selections.push(shuffled[i % shuffled.length]);
    }
    return selections;
  }, [stats.length]);

  function isFeatureEnabled(path) {
    if (showAll || isSuper) return true;
    return canAccessPath(path);
  }

  const canShowItem = (item) => {
    if (!item) return false;
    if (item.hidden) return false;
    const path = String(item.path || "");
    if (!path) return false;

    if (showAll || isSuper) return true;

    const parts = path.split("/").filter(Boolean);
    const mk = String(item.module_key || parts[0] || "");
    const fk = String(item.feature_key || parts[1] || "");

    if (mk && isDashboardPath(path)) {
      return (
        canViewDashboardElement(mk, "dashboard", "dashboard") !== false &&
        canViewDashboardElement(mk, "dashboard", "dashboards") !== false
      );
    }

    if (mk && fk) {
      if (canAccessFeatureKey(mk, fk)) return true;
      if (item.feature_key && canAccessFeatureKey(mk, item.feature_key)) return true;
      if (parts.length > 2) {
        const fk2 = String(parts[2] || "");
        if (fk2 && canAccessFeatureKey(mk, fk2)) return true;
      }
    }
    return canAccessPath(path);
  };

  const allSections = React.useMemo(() => {
    const base = Array.isArray(sections) ? sections : [];
    if (hideOtherPages) return base;
    const feats = Array.isArray(features) ? features : [];
    if (!feats.length) return base;
    const existing = new Set();
    for (const section of base) {
      const sectionItems =
        (section && (section.items || section.features)) || [];
      for (const item of sectionItems) {
        if (item && item.path) existing.add(String(item.path));
      }
    }
    const extras = [];
    for (const f of feats) {
      const path = String(f.path || "");
      if (!path || existing.has(path)) continue;
      extras.push({
        title: f.label || f.name || "Page",
        name: f.label || f.name,
        path,
        icon: f.icon || "📄",
      });
    }
    if (!extras.length) return base;
    return [
      ...base,
      {
        title: "Other Pages",
        items: extras,
      },
    ];
  }, [sections, features, hideOtherPages]);

  // Filter sections based on search term
  const normalizeForSearch = React.useCallback(
    (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim(),
    [],
  );

  const filteredSections = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) return allSections;

    const term = normalizeForSearch(searchTerm);
    const queryParts = term.split(/\s+/).filter(Boolean);

    const scoreItem = (item, sectionTitle = "") => {
      const rawTitle = String(item.title || item.name || item.label || "");
      const rawDescription = String(item.description || "");
      const rawPath = String(item.path || "");
      const pathWords = rawPath.replace(/[\/_-]+/g, " ");
      const titleInitials = rawTitle
        .split(/\s+/)
        .map((w) => w[0] || "")
        .join("")
        .toLowerCase();
      const searchable = normalizeForSearch(
        `${rawTitle} ${rawDescription} ${rawPath} ${pathWords} ${sectionTitle}`,
      );

      if (!queryParts.length) return 1;
      if (searchable.includes(term)) return 100;

      let score = 0;
      for (const part of queryParts) {
        if (searchable.includes(part)) {
          score += 10;
          continue;
        }
        if (titleInitials && titleInitials.includes(part)) {
          score += 6;
          continue;
        }
        return 0;
      }

      if (normalizeForSearch(rawTitle).startsWith(queryParts[0] || "")) score += 8;
      if (normalizeForSearch(rawPath).includes(queryParts[0] || "")) score += 4;
      return score;
    };

    return allSections.map((section) => {
      const sectionTitle = section.title || section.category || "";
      const sectionItems = section.items || section.features || [];

      const scoredItems = sectionItems
        .map((item) => ({ item, score: scoreItem(item, sectionTitle) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item);

      return {
        ...section,
        items: scoredItems,
      };
    }).filter((section) => {
      const sectionTitle = section.title || section.category || "";
      return (
        section.items.length > 0 ||
        normalizeForSearch(sectionTitle).includes(term)
      );
    });
  }, [allSections, searchTerm, normalizeForSearch]);

  const isSearching = Boolean(String(searchTerm || "").trim());

  const slug = (s) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");

  React.useEffect(() => {
    const search = new URLSearchParams(location.search || "");
    const hash = String(location.hash || "").replace(/^#/, "");
    const focus = search.get("focus") || hash;
    if (!focus) return;
    const tryScroll = (el) => {
      if (!el || typeof el.scrollIntoView !== "function") return false;
      setTimeout(() => {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch {}
      }, 50);
      return true;
    };
    if (focus.toLowerCase() === "reports") {
      const all = Array.from(document.querySelectorAll("[data-section-title]"));
      const target =
        all.find((e) =>
          String(e.getAttribute("data-section-title") || "")
            .toLowerCase()
            .includes("report"),
        ) || null;
      if (tryScroll(target)) return;
    }
    const id = `section-${slug(focus)}`;
    const el = document.getElementById(id);
    tryScroll(el);
  }, [location.hash, location.search]);

  const overlayType = React.useMemo(() => {
    const search = new URLSearchParams(location.search || "");
    return String(search.get("overlay") || "").toLowerCase() || null;
  }, [location.search]);

  const overlayItems = React.useMemo(() => {
    if (overlayType !== "reports") return [];
    const items = [];
    const addItem = (it) => {
      if (!it || !canShowItem(it)) return;
      items.push({
        title: it.title || it.name || it.label,
        path: it.path,
        icon: it.icon || "📄",
      });
    };
    for (const s of allSections) {
      const title = String(s.title || s.category || "").toLowerCase();
      if (title.includes("report")) {
        const sItems = s.items || s.features || [];
        sItems.forEach((it) => addItem(it));
      }
      if (title.includes("dashboard")) {
        const sItems = s.items || s.features || [];
        sItems.forEach((it) => addItem(it));
      }
    }
    resolvedHeaderActions.forEach((a) =>
      addItem({
        title: a.label || "Dashboard",
        path: a.path,
        icon: a.icon || "📊",
      }),
    );
    const seen = new Set();
    return items.filter((it) => {
      const k = `${it.title}|${it.path}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [overlayType, allSections, resolvedHeaderActions]);

  const closeOverlay = React.useCallback(() => {
    const search = new URLSearchParams(location.search || "");
    search.delete("overlay");
    navigate(
      {
        pathname: location.pathname,
        search: search.toString(),
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.pathname, location.search, location.hash, navigate]);

  return (
    <div className="space-y-6 animate-fade-in px-3 sm:px-4 md:-mx-6 md:px-6">
      <div className="-mx-3 px-3 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6 sticky top-0 z-40 bg-slate-50 dark:bg-slate-950 pb-2 pt-2 -mt-2">
        <ModuleTopNavBar sections={allSections} headerActions={resolvedHeaderActions} moduleKey={moduleKey} />
      </div>

      <div className="space-y-8">
        {/* Header */}
        <div className="mb-8 hidden lg:flex items-start justify-between gap-4">
        <div>
          {(!useSectionNavigation || searchTerm || activeSection === null) && (
            <h1 className="text-3xl font-bold text-brand-900 dark:text-white tracking-tight mb-2">
              {title}
            </h1>
          )}
          {description && (!useSectionNavigation || searchTerm || activeSection === null) && (
            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-3xl">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!searchTerm && useSectionNavigation && activeSection !== null && (
            <button 
              type="button"
              onClick={() => {
              setActiveSection(null);
              const searchParams = new URLSearchParams(location.search || "");
              searchParams.delete("section");
              navigate({ pathname: location.pathname, search: searchParams.toString() }, { replace: true });
            }}
              className="btn btn-secondary flex items-center gap-2 shadow-xs hover:shadow transition-all font-semibold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </button>
          )}
          {(!useSectionNavigation || searchTerm || activeSection === null) && resolvedHeaderActions.map((a, i) => (
            <button
              key={i}
              onClick={(e) => handleNavigate(a.path, e)}
              className="btn btn-primary"
              title={a.title || a.label}
            >
              {a.icon ? <span className="mr-2">{typeof a.icon === "string" ? a.icon : React.createElement(a.icon, { className: "w-4 h-4 inline" })}</span> : null}
              {a.label || "Open"}
            </button>
          ))}
        </div>
      </div>

      {/* Search Field */}
      {(!useSectionNavigation || searchTerm || activeSection === null) && (
      <div className="mb-6">
        <div className="max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Search entry, transaction or report page"
              className="input w-full pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Key Statistics */}
      {!isSearching && (!useSectionNavigation || searchTerm || activeSection === null) && stats.filter((s) => {
        if (!canShowItem(s)) return false;
        const path = String(s.path || "");
        const parts = path.split("/").filter(Boolean);
        const mk = String(s.module_key || parts[0] || "");
        const key =
          String(s.rbac_key || "")
            .toLowerCase()
            .trim() ||
          String(s.label || s.name || s.title || "")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "");
        if (!mk || !key) return true;
        return canViewDashboardElement(mk, "card", key);
      }).length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-brand-800 dark:text-brand-200 mb-4 flex items-center gap-2">
            <span>📈</span> Business Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats
              .filter((stat) => {
                if (!canShowItem(stat)) return false;
                const path = String(stat.path || "");
                const parts = path.split("/").filter(Boolean);
                const mk = String(stat.module_key || parts[0] || "");
                const key =
                  String(stat.rbac_key || "")
                    .toLowerCase()
                    .trim() ||
                  String(stat.label || stat.name || stat.title || "")
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, "-")
                    .replace(/[^a-z0-9-]/g, "");
                if (!mk || !key) return true;
                return canViewDashboardElement(mk, "card", key);
              })
              .map((stat, index) => {
                const cardType = index % 4;
                if (cardType === 0) {
                  // Card 1: Amber Gold
                  return (
                    <div
                      key={index}
                      className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(178,110,23,0.3)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(178,110,23,0.5)] active:scale-[0.98] transition-all duration-300 ease-out group bg-[#b26e17] text-white"

                    >
                      <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-end min-h-[22px]">
                          {(stat.change || stat.trend) && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] leading-none flex items-center gap-1">
                              {stat.change || stat.trend}
                            </span>
                          )}
                        </div>
                        <div className="mt-6">
                          <div 
                            className="text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_8px_rgba(255,255,255,0.35)]"
                            style={{ textShadow: "0 0 12px rgba(255, 255, 255, 0.45)" }}
                          >
                            {stat.value}
                          </div>
                          <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none">
                            {stat.label}
                          </div>
                        </div>
                      </div>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                    </div>
                  );
                } else if (cardType === 1) {
                  // Card 2: Steel Blue
                  return (
                    <div
                      key={index}
                      className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(36,82,109,0.3)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(36,82,109,0.5)] active:scale-[0.98] transition-all duration-300 ease-out group bg-[#24526d] text-white"

                    >
                      <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-end min-h-[22px]">
                          {(stat.change || stat.trend) && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 backdrop-blur-md text-amber-200 border border-amber-400/20 shadow-sm leading-none flex items-center gap-1">
                              {stat.change || stat.trend}
                            </span>
                          )}
                        </div>
                        <div className="mt-6">
                          <div className="text-3xl font-extrabold text-white tracking-tight">
                            {stat.value}
                          </div>
                          <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none flex items-center">
                            <span>{stat.label}</span>
                            <svg className="w-8 h-4 text-white/20 ml-2 group-hover:text-white/40 transition-colors" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M0 15 L10 12 L20 18 L30 8 L40 10 L50 2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                    </div>
                  );
                } else if (cardType === 2) {
                  // Card 3: Teal Green
                  return (
                    <div
                      key={index}
                      className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(24,117,92,0.3)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(24,117,92,0.5)] active:scale-[0.98] transition-all duration-300 ease-out group bg-[#18755c] text-white"

                    >
                      <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-end min-h-[22px]">
                          {(stat.change || stat.trend) && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 border border-white/15 shadow-sm leading-none flex items-center gap-1">
                              {stat.change || stat.trend}
                            </span>
                          )}
                        </div>
                        <div className="mt-6">
                          <div className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
                            <span>{stat.value}</span>
                            <svg className="w-5 h-5 text-white/40 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                            </svg>
                          </div>
                          <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none">
                            {stat.label}
                          </div>
                        </div>
                      </div>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                    </div>
                  );
                } else {
                  // Card 4: Carbon Dark Gray
                  return (
                    <div
                      key={index}
                      className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.2)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.5)] border border-white/5 hover:border-white/15 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] active:scale-[0.98] transition-all duration-300 ease-out group bg-[#1d1f22] bg-[radial-gradient(#ffffff06_1px,transparent_1px)] [background-size:8px_8px] text-white"

                    >
                      <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-end min-h-[22px]">
                          {(stat.change || stat.trend) && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white border border-white/20 shadow-sm leading-none flex items-center gap-1">
                              {stat.change || stat.trend}
                            </span>
                          )}
                        </div>
                        <div className="mt-6">
                          <div className="text-3xl font-extrabold text-white tracking-tight">
                            {stat.value}
                          </div>
                          <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none">
                            {stat.label}
                          </div>
                        </div>
                      </div>
                      <svg className="w-4.5 h-4.5 text-white/20 absolute right-5 bottom-5 group-hover:scale-110 group-hover:text-white/40 transition-all duration-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                    </div>
                  );
                }
              })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {!isSearching && (!useSectionNavigation || searchTerm || activeSection === null) &&
        quickActions.filter((a) => !a?.path || canShowItem(a)).length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-brand-800 dark:text-brand-200 mb-4 flex items-center gap-2">
            <span>⚡</span> Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {quickActions
              .filter((action) => !action?.path || canShowItem(action))
              .map((action, index) => (
                <button
                  key={index}
                  className="flex flex-col items-center justify-center p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 border border-slate-100 dark:border-slate-700/50 hover:border-brand-300 dark:hover:border-brand-700/60 hover:bg-gradient-to-br hover:from-white hover:to-brand-50/20 dark:hover:from-slate-800 dark:hover:to-slate-900/50 transition-all duration-300 group text-center h-full relative overflow-hidden"
                  onClick={() => handleNavigate(action.path)}
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-50/50 dark:bg-slate-700/50 flex items-center justify-center text-2xl mb-3 shadow-inner group-hover:scale-110 group-hover:rotate-3 group-hover:from-brand-100 group-hover:to-brand-200/50 dark:group-hover:from-slate-600 dark:group-hover:to-slate-700 transition-all duration-300">
                    {action.icon}
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                    {action.label}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Category Sections */}
      <div className="space-y-10">
        {searchTerm && filteredSections.length === 0 && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <div className="text-4xl mb-2">🔍</div>
            <p>No menu items found matching "{searchTerm}"</p>
            <button
              onClick={() => setSearchTerm("")}
              className="mt-2 text-brand-600 hover:text-brand-700 underline"
            >
              Clear search
            </button>
          </div>
        )}
        
        {/* Section Navigation Mode: View all sections as cards */}
        {!searchTerm && useSectionNavigation && activeSection === null && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSections.map((section, sectionIndex) => {
              const sectionTitle = section.title || section.category;
              const sectionIcon = getSectionIcon(section, sectionIndex);
              const itemsList = section.items || section.features || [];
              const itemCount = itemsList.filter(item => canShowItem(item)).length;
              const sectionDescription = section.description || (itemCount ? `${itemCount} feature pages` : "");
              
              // Gradient accents based on section index
              const gradients = [
                "from-blue-500/10 via-indigo-500/5 to-transparent border-blue-500/20 hover:border-blue-500/50 dark:hover:border-blue-400/60 shadow-blue-500/5",
                "from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/20 hover:border-emerald-500/50 dark:hover:border-emerald-400/60 shadow-emerald-500/5",
                "from-amber-500/10 via-orange-500/5 to-transparent border-amber-500/20 hover:border-amber-500/50 dark:hover:border-amber-400/60 shadow-amber-500/5",
                "from-purple-500/10 via-pink-500/5 to-transparent border-purple-500/20 hover:border-purple-500/50 dark:hover:border-purple-400/60 shadow-purple-500/5",
                "from-cyan-500/10 via-blue-500/5 to-transparent border-cyan-500/20 hover:border-cyan-500/50 dark:hover:border-cyan-400/60 shadow-cyan-500/5",
              ];
              const cardGradient = gradients[sectionIndex % gradients.length];

              const iconGradients = [
                "from-blue-500 to-indigo-600 shadow-blue-500/25",
                "from-emerald-500 to-teal-600 shadow-emerald-500/25",
                "from-amber-500 to-orange-600 shadow-amber-500/25",
                "from-purple-500 to-pink-600 shadow-purple-500/25",
                "from-cyan-500 to-blue-600 shadow-cyan-500/25",
              ];
              const iconStyle = iconGradients[sectionIndex % iconGradients.length];

              return (
                <div
                  key={sectionIndex}
                  className={`relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 backdrop-blur-md p-6 border shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 ease-out group cursor-pointer flex flex-col justify-between ${cardGradient}`}
                  onClick={() => {
                    setActiveSection(sectionIndex);
                    const secTitle = section.title || section.category;
                    if (secTitle) {
                      const searchParams = new URLSearchParams(location.search || "");
                      searchParams.set("section", secTitle);
                      navigate({ pathname: location.pathname, search: searchParams.toString() }, { replace: true });
                    }
                  }}
                >
                  {/* Subtle top background tint */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${cardGradient} opacity-0 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none`} />

                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div 
                        className={`shrink-0 bg-gradient-to-br ${iconStyle} text-white flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 group-hover:rotate-2 transition-transform duration-300`}
                        style={{ width: '52px', height: '52px', minWidth: '52px', minHeight: '52px', maxWidth: '52px', maxHeight: '52px', borderRadius: '50%' }}
                      >
                        {sectionIcon}
                      </div>
                      <span className="flex-none w-max inline-block text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-600/60 shadow-2xs">
                        {itemCount} {itemCount === 1 ? 'Page' : 'Pages'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors mb-1.5">
                      {sectionTitle}
                    </h3>
                    
                    {sectionDescription && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {sectionDescription}
                      </p>
                    )}
                  </div>

                  <div className="relative z-10 pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs font-bold text-brand-600 dark:text-brand-400 group-hover:translate-x-0.5 transition-all">
                    <span>Explore Section</span>
                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Normal Mode OR Section Navigation Mode: View active section items */}
        {(!useSectionNavigation || searchTerm || activeSection !== null) && filteredSections.map((section, sectionIndex) => {
          if (!searchTerm && useSectionNavigation && activeSection !== sectionIndex) {
            return null; // Skip if in section navigation mode and not the active section
          }
          
          const sectionTitle = section.title || section.category;
          const sectionItems = section.items || section.features || [];

          return (
            <div
              key={sectionIndex}
              id={`section-${slug(sectionTitle)}`}
              data-section-title={String(sectionTitle || "")}
            >

              {(!useSectionNavigation || searchTerm || activeSection === null) && (
                <div className="flex items-center gap-3 mb-5 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                    {sectionTitle}
                  </h2>
                  {section.badge && (
                    <span className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {section.badge}
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {sectionItems
                  .filter((item) => canShowItem(item))
                  .map((item, itemIndex) => {
                    const itemTitle = item.title || item.name;
                    const itemActions = Array.isArray(item.actions)
                      ? item.actions.filter((action) => canShowItem(action))
                      : [];

                    return (
                      <div
                        key={itemIndex}
                        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 hover:border-brand-300/80 dark:hover:border-brand-600/80 hover:-translate-y-1.5 hover:shadow-[0_15px_35px_rgba(14,54,70,0.06)] dark:hover:shadow-[0_15px_35px_rgba(0,0,0,0.25)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group relative overflow-hidden"
                        onClick={() => handleNavigate(item.path)}
                      >
                        {/* Subtle hover background tint for item cards */}
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-50/60 to-transparent dark:from-slate-700/50 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                        <div className="flex flex-col lg:flex-row items-center lg:items-start text-center lg:text-left gap-4 relative z-10">
                          <div 
                            className="shrink-0 rounded-full bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 group-hover:rotate-1 group-hover:from-brand-100 group-hover:to-brand-200/50 dark:group-hover:from-slate-600 dark:group-hover:to-slate-700 transition-all duration-300"
                            style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px', maxWidth: '44px', maxHeight: '44px', borderRadius: '50%' }}
                          >
                            {typeof item.icon === "string" ? (
                              item.icon
                            ) : item.icon ? (
                              React.createElement(item.icon, { className: "w-5 h-5 text-slate-700 dark:text-slate-300" })
                            ) : (
                              "📄"
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors mb-1">
                              {itemTitle}
                            </h3>
                            {item.description && (
                              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                            {itemActions.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-2 justify-center lg:justify-start">
                                {itemActions.map((action, actionIndex) => {
                                  const actionType = String(
                                    action.type || "outline",
                                  ).toLowerCase();
                                  const actionClass =
                                    actionType === "primary"
                                      ? "bg-brand text-white hover:bg-brand-700 border-brand shadow-sm hover:shadow"
                                      : "bg-white dark:bg-slate-800 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-brand-300 dark:hover:border-brand-600 shadow-sm";

                                  return (
                                    <button
                                      key={`${action.path || action.label}-${actionIndex}`}
                                      type="button"
                                      className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${actionClass}`}
                                      onClick={(e) =>
                                        handleNavigate(action.path, e)
                                      }
                                      title={action.title || action.label}
                                    >
                                      {action.label || "Open"}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Custom bottom line slide-in highlight on hover */}
                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-brand-500/80 to-primary-500/80 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
      </div>
      {overlayType === "reports" && overlayItems.length > 0 ? (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute right-4 top-24 w-[min(260px,92vw)] max-h-[70vh] overflow-auto bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl shadow-erp-xl border border-slate-200 dark:border-slate-700 pointer-events-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Reports & Dashboards
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={closeOverlay}
              >
                Close
              </button>
            </div>
            <div className="p-2 divide-y divide-slate-200 dark:divide-slate-700">
              {overlayItems.map((it, i) => (
                <button
                  key={`${it.path}-${i}`}
                  onClick={() => handleNavigate(it.path)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-brand-50 dark:bg-slate-700 flex items-center justify-center text-lg">
                      {it.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">
                        {it.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {it.path}
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-400">→</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
export default ModuleDashboard;
