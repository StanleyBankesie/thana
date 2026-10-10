import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { api } from "../api/client.js";
import { MODULES_REGISTRY } from "../data/modulesRegistry.js";
import { DASHBOARD_CARDS, getCardModule, getAllCardAliases } from "../data/dashboardCards.js";

/**
 * PermissionContext - Centralized permission management
 *
 * Provides:
 * - Current user permissions
 * - Permission checking functions
 * - Dynamic permission updates
 * - Module/feature visibility control
 */

const PermissionContext = createContext();
const RBAC_CACHE_KEY = "rbac.permission.snapshot.v1";
const PAGE_PERM_RETRY_MS = 30_000;
const DASHBOARD_PERM_POLL_MS = 15_000; // 15 seconds fast sync
const BACKGROUND_GET_CONFIG = { __background: true };

function isTransientBackendError(err) {
  const status = Number(err?.response?.status || 0);
  if (status === 503 || status === 502 || status === 504 || status === 429) {
    return true;
  }
  return !err?.response;
}

function readPermissionSnapshot() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(RBAC_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      modules: Array.isArray(data?.modules) ? data.modules : [],
      permissions: Array.isArray(data?.permissions) ? data.permissions : [],
      roleFeatures: Array.isArray(data?.roleFeatures) ? data.roleFeatures : [],
      exceptionalPerms: Array.isArray(data?.exceptionalPerms)
        ? data.exceptionalPerms
        : [],
      licensedModules: Array.isArray(data?.licensedModules)
        ? data.licensedModules
        : [],
    };
  } catch {
    return null;
  }
}

function writePermissionSnapshot(snapshot) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RBAC_CACHE_KEY, JSON.stringify(snapshot));
  } catch {}
}

export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermission must be used within a PermissionProvider");
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const { user, token, initialized } = useAuth();
  const [modules, setModules] = useState(new Set());
  const [permissions, setPermissions] = useState([]);
  const [roleFeatures, setRoleFeatures] = useState(new Set());
  const [exceptionalPerms, setExceptionalPerms] = useState(new Set());
  const [licensedModules, setLicensedModules] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionOverrides, setSessionOverrides] = useState(() => new Map());
  const [pagePermsByPath, setPagePermsByPath] = useState(() => new Map());
  const [pagePermsPending, setPagePermsPending] = useState(() => new Set());
  const [pagePermRetryAfter, setPagePermRetryAfter] = useState(() => new Map());
  const [globalOverrides, setGlobalOverrides] = useState(() => {
    if (typeof localStorage === "undefined") {
      return {
        view: undefined,
        create: undefined,
        edit: undefined,
        delete: undefined,
      };
    }
    try {
      const getVal = (k) => {
        const raw = localStorage.getItem(k);
        if (raw === "1") return true;
        if (raw === "0") return undefined;
        return undefined;
      };
      return {
        view: getVal("rbac_allow_all_view"),
        create: getVal("rbac_allow_all_create"),
        edit: getVal("rbac_allow_all_edit"),
        delete: getVal("rbac_allow_all_delete"),
      };
    } catch {
      return {
        view: undefined,
        create: undefined,
        edit: undefined,
        delete: undefined,
      };
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const setOrRemove = (key, val) => {
          if (val === true) localStorage.setItem(key, "1");
          else if (val === false) localStorage.setItem(key, "0");
          else localStorage.removeItem(key);
        };
        setOrRemove("rbac_allow_all_view", globalOverrides.view);
        setOrRemove("rbac_allow_all_create", globalOverrides.create);
        setOrRemove("rbac_allow_all_edit", globalOverrides.edit);
        setOrRemove("rbac_allow_all_delete", globalOverrides.delete);
      }
    } catch {}
  }, [globalOverrides]);

  const [appMode, setAppMode] = useState(() => {
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem("omnisuite.app_mode") || "STANDARD";
      }
    } catch {}
    return "STANDARD";
  });

  const [appBackground, setAppBackground] = useState(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const cached = localStorage.getItem("omnisuite.app_background");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === "object") return parsed;
        }
      }
    } catch {}
    return {
      url: "/backgrounds/abstract-silk-waves.jpg",
      preset: "silk-waves",
      opacity: 40,
      blur: 0,
    };
  });

  const [moduleSectionViewEnabled, setModuleSectionViewEnabled] = useState(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const val = localStorage.getItem("omnisuite.module_section_view");
        if (val !== null) return val === "true";
      }
    } catch {}
    return false;
  });

  useEffect(() => {
    const handleAppModeChange = (e) => {
      const nextMode = e.detail?.mode;
      if (nextMode) {
        setAppMode(nextMode);
      }
    };
    const handleSectionViewChange = (e) => {
      const nextVal = e.detail?.enabled;
      if (typeof nextVal === "boolean") {
        setModuleSectionViewEnabled(nextVal);
      }
    };
    window.addEventListener("app-mode-changed", handleAppModeChange);
    window.addEventListener("module-section-view-changed", handleSectionViewChange);
    return () => {
      window.removeEventListener("app-mode-changed", handleAppModeChange);
      window.removeEventListener("module-section-view-changed", handleSectionViewChange);
    };
  }, []);

  useEffect(() => {
    const handleAppBgChange = (e) => {
      const nextBg = e.detail?.background;
      if (nextBg) {
        setAppBackground((prev) => ({ ...prev, ...nextBg }));
      }
    };
    window.addEventListener("app-background-changed", handleAppBgChange);
    return () => window.removeEventListener("app-background-changed", handleAppBgChange);
  }, []);

  /**
   * Load user permissions from backend
   */
  const loadPermissions = async (background = false) => {
    try {
      if (!background) setLoading(true);
      setError(null);

      if (!initialized || !token) {
        setModules(new Set());
        setPermissions([]);
        setRoleFeatures(new Set());
        setExceptionalPerms(new Set());
        setLicensedModules(new Set());
        setLoading(false);
        return;
      }

      // Background sync application mode & module section view
      api.get("/admin/settings/app-mode", BACKGROUND_GET_CONFIG)
        .then((res) => {
          const mode = res.data?.mode || "STANDARD";
          setAppMode(mode);
          const secView = res.data?.module_section_view === true;
          setModuleSectionViewEnabled(secView);
          try {
            if (typeof localStorage !== "undefined") {
              localStorage.setItem("omnisuite.app_mode", mode);
              localStorage.setItem("omnisuite.module_section_view", String(secView));
            }
          } catch {}
        })
        .catch(() => {});

      // Background sync application background
      api.get("/admin/settings/app-background", BACKGROUND_GET_CONFIG)
        .then((res) => {
          if (res.data?.success) {
            const bgData = {
              url: res.data.background_url || "",
              preset: res.data.background_preset || "silk-waves",
              opacity: Number.isFinite(res.data.background_opacity) ? res.data.background_opacity : 40,
              blur: res.data.background_blur ?? 0,
              hasCustom: res.data.has_custom || false,
              customUrl: res.data.custom_url || null,
            };
            setAppBackground(bgData);
            try {
              if (typeof localStorage !== "undefined") {
                localStorage.setItem("omnisuite.app_background", JSON.stringify(bgData));
              }
            } catch {}
          }
        })
        .catch(() => {});

      const userId = Number(user?.id || user?.sub || 0);
      if (!Number.isFinite(userId) || !userId) {
        setModules(new Set());
        setPermissions([]);
        setRoleFeatures(new Set());
        return;
      }

      const snapshot = readPermissionSnapshot();
      if (snapshot) {
        setModules(
          new Set(
            snapshot.modules.map((m) => String(m || "").trim()).filter(Boolean),
          ),
        );
        setPermissions(
          Array.isArray(snapshot.permissions) ? snapshot.permissions : [],
        );
        setRoleFeatures(
          new Set(
            snapshot.roleFeatures
              .map((f) => String(f || "").trim())
              .filter(Boolean),
          ),
        );
        setExceptionalPerms(
          new Set(
            snapshot.exceptionalPerms
              .map((c) =>
                String(c || "")
                  .toUpperCase()
                  .trim(),
              )
              .filter(Boolean),
          ),
        );
        setLicensedModules(
          new Set(
            (snapshot.licensedModules || [])
              .map((m) => String(m || "").trim())
              .filter(Boolean),
          ),
        );
      }

      const res = await api.get("/admin/user-permissions", BACKGROUND_GET_CONFIG);
      const mods = Array.isArray(res.data?.modules) ? res.data.modules : [];
      const rolePerms = Array.isArray(res.data?.permissions)
        ? res.data.permissions
        : [];
      const feats = Array.isArray(res.data?.role_features)
        ? res.data.role_features
        : [];
      const licensedMods = Array.isArray(res.data?.licensed_modules)
        ? res.data.licensed_modules
        : [];

      // Load user-specific overrides and merge (overrides win)
      const userOverridesRes = await api
        .get(
          `/admin/users/${userId}/feature-permissions`,
          BACKGROUND_GET_CONFIG,
        )
        .catch(() => ({ data: { items: [] } }));
      const overrideItems = Array.isArray(userOverridesRes?.data?.data?.items)
        ? userOverridesRes.data.data.items
        : Array.isArray(userOverridesRes?.data?.items)
          ? userOverridesRes.data.items
          : [];
      const overrideByFk = new Map(
        overrideItems.map((it) => [
          String(it.feature_key || "").trim(),
          {
            feature_key: String(it.feature_key || "").trim(),
            can_view: !!it.can_view,
            can_create: !!it.can_create,
            can_edit: !!it.can_edit,
            can_delete: !!it.can_delete,
          },
        ]),
      );

      const merged = rolePerms.map((p) => {
        const rawFk = String(p?.feature_key || "").trim();
        const mk = String(p?.module_key || "").trim();
        const canonicalFk = rawFk.includes(":")
          ? rawFk
          : mk
            ? `${mk}:${rawFk}`
            : rawFk;
        const ov = overrideByFk.get(canonicalFk);
        if (ov) {
          return {
            module_key: mk,
            feature_key: canonicalFk,
            can_view: ov.can_view,
            can_create: ov.can_create,
            can_edit: ov.can_edit,
            can_delete: ov.can_delete,
          };
        }
        return p;
      });

      const modSet = new Set(mods.map((m) => String(m || "").trim()).filter(Boolean));
      setModules(modSet);
      // Use merged permissions; include overrides for features not in role perms
      for (const [fk, ov] of overrideByFk.entries()) {
        if (!merged.find((p) => String(p.feature_key || "") === fk)) {
          const [mk] = fk.split(":");
          merged.push({
            module_key: mk,
            feature_key: fk,
            can_view: ov.can_view,
            can_create: ov.can_create,
            can_edit: ov.can_edit,
            can_delete: ov.can_delete,
          });
        }
      }

      setPermissions(merged);
      const featureSet = new Set(feats.map((f) => String(f || "").trim()).filter(Boolean));
      setRoleFeatures(featureSet);
      try {
        const exRes = await api
          .get(
            `/admin/users/${userId}/exceptional-permissions`,
            BACKGROUND_GET_CONFIG,
          )
          .catch(() => ({ data: { data: { items: [] } } }));
        const rows = Array.isArray(exRes?.data?.data?.items)
          ? exRes.data.data.items
          : Array.isArray(exRes?.data?.items)
            ? exRes.data.items
            : [];
        const byCode = new Map();
        for (const it of rows) {
          const code = String(it?.permission_code || "")
            .toUpperCase()
            .trim();
          if (!code) continue;
          const active = Number(it?.is_active) === 1;
          const isAllow =
            String(it?.effect || "ALLOW").toUpperCase() === "ALLOW";
          const isDeny = String(it?.effect || "ALLOW").toUpperCase() === "DENY";
          const cur = byCode.get(code) || { allow: false, deny: false };
          if (active && isAllow) cur.allow = true;
          if (active && isDeny) cur.deny = true;
          byCode.set(code, cur);
        }
        const exceptionalSet = new Set(
          Array.from(byCode.entries())
            .filter(([_, v]) => v.allow && !v.deny)
            .map(([k]) => k),
        );
        setExceptionalPerms(exceptionalSet);

        const licensedSet = new Set(
          licensedMods.map((m) => String(m || "").trim()).filter(Boolean),
        );
        setLicensedModules(licensedSet);

        writePermissionSnapshot({
          modules: Array.from(modSet),
          permissions: merged,
          roleFeatures: Array.from(featureSet),
          exceptionalPerms: Array.from(exceptionalSet),
          licensedModules: Array.from(licensedSet),
        });
      } catch {
        setExceptionalPerms(new Set());
      }
      try {
        window.dispatchEvent(new Event("rbac:updated"));
      } catch {}
    } catch (err) {
      console.error("Failed to load permissions:", err);
      setError(err.message);
      if (isTransientBackendError(err)) {
        const snapshot = readPermissionSnapshot();
        if (snapshot) {
          setModules(
            new Set(
              snapshot.modules
                .map((m) => String(m || "").trim())
                .filter(Boolean),
            ),
          );
          setPermissions(
            Array.isArray(snapshot.permissions) ? snapshot.permissions : [],
          );
          setRoleFeatures(
            new Set(
              snapshot.roleFeatures
                .map((f) => String(f || "").trim())
                .filter(Boolean),
            ),
          );
          setExceptionalPerms(
            new Set(
              snapshot.exceptionalPerms
                .map((c) =>
                  String(c || "")
                    .toUpperCase()
                    .trim(),
                )
                .filter(Boolean),
            ),
          );
        }
      } else {
        setModules(new Set());
        setPermissions([]);
        setRoleFeatures(new Set());
      }
    } finally {
      setLoading(false);
    }
  };

  // Dashboard element view permissions (cards/tickers/dashboards)
  const [dashboardViewMap, setDashboardViewMap] = useState(() => new Map());
  const [dashboardViewLoaded, setDashboardViewLoaded] = useState(false);
  const dashboardPermVersionRef = useRef(null);
  const dashboardPermCheckInFlightRef = useRef(false);

  const extractDashboardPermVersion = (items) => {
    const rows = Array.isArray(items) ? items : [];
    let best = null;
    for (const it of rows) {
      const v = it?.updated_at || it?.created_at || null;
      if (!v) continue;
      if (best == null || String(v) > String(best)) best = v;
    }
    return best;
  };

  const loadDashboardPermissions = async () => {
    try {
      if (!initialized || !token) {
        setDashboardViewMap(new Map());
        setDashboardViewLoaded(true);
        dashboardPermVersionRef.current = null;
        return;
      }
      const userId = Number(user?.id || user?.sub || 0);
      if (!Number.isFinite(userId) || !userId) {
        setDashboardViewMap(new Map());
        setDashboardViewLoaded(true);
        dashboardPermVersionRef.current = null;
        return;
      }
      const res = await api.get(
        "/access/dashboard-permissions",
        BACKGROUND_GET_CONFIG,
      );
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const m = new Map();
      const byModule = new Map();
      for (const it of items) {
        const mk = String(it.module_key || "");
        const type = it.card_key
          ? "card"
          : it.ticker_key
            ? "ticker"
            : "dashboard";
        const rawKey = String(
          it.card_key || it.ticker_key || it.dashboard_key || "",
        );
        const normKey = rawKey
          .toLowerCase()
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        const canView = Number(it.can_view) === 1;

        m.set(`${mk}|${type}|${rawKey}`, canView);
        m.set(`${mk}|${type}|${normKey}`, canView);
        if (normKey.startsWith(`${mk}-`)) {
          m.set(`${mk}|${type}|${normKey.slice(mk.length + 1)}`, canView);
        } else {
          m.set(`${mk}|${type}|${mk}-${normKey}`, canView);
        }

        // Also index known aliases
        const aliases = getAllCardAliases(rawKey);
        for (const alias of aliases) {
          m.set(`${mk}|${type}|${alias}`, canView);
          if (alias.startsWith(`${mk}-`)) {
            m.set(`${mk}|${type}|${alias.slice(mk.length + 1)}`, canView);
          } else {
            m.set(`${mk}|${type}|${mk}-${alias}`, canView);
          }
        }

        const set = byModule.get(mk) || new Set();
        set.add(type);
        byModule.set(mk, set);
      }
      setDashboardViewMap(m);
      setDashboardViewLoaded(true);
      dashboardPermVersionRef.current = extractDashboardPermVersion(items);
    } catch {
      setDashboardViewMap(new Map());
      setDashboardViewLoaded(true);
      dashboardPermVersionRef.current = null;
    }
  };

  const checkDashboardPermissionsVersion = async () => {
    if (!initialized || !token) return;
    const userId = Number(user?.id || user?.sub || 0);
    if (!Number.isFinite(userId) || !userId) return;
    if (dashboardPermCheckInFlightRef.current) return;
    try {
      if (typeof document !== "undefined" && document.hidden) return;
    } catch {}

    dashboardPermCheckInFlightRef.current = true;
    try {
      const res = await api.get(
        "/access/dashboard-permissions/version",
        BACKGROUND_GET_CONFIG,
      );
      const latest = res?.data?.updated_at || null;
      const current = dashboardPermVersionRef.current || null;
      if (latest !== current && (latest || current)) {
        await loadDashboardPermissions();
      }
    } catch {
      return;
    } finally {
      dashboardPermCheckInFlightRef.current = false;
    }
  };

  const basePathFrom = (p) => {
    const raw = String(p || "").trim() || "/";
    let parts = raw.split("/").filter(Boolean);
    if (parts.length === 0) return "/";

    const last = parts[parts.length - 1];
    if (last === "new" || last === "create") {
      parts = parts.slice(0, parts.length - 1);
    } else if (/^[0-9]+$/.test(last) || /^[0-9a-fA-F-]{8,}$/.test(last)) {
      parts = parts.slice(0, parts.length - 1);
    }

    if(
      parts[0] === "administration" &&
      parts[1] === "access" &&
      parts.length >= 3
    ) {
      return `/${parts.slice(0, 3).join("/")}`;
    }
    if (parts.length >= 2) {
      return `/${parts.slice(0, 2).join("/")}`;
    }
    return `/${parts[0]}`;
  };

  const ensurePagePerms = async (path) => {
    const base = basePathFrom(path);
    if (!base) return null;
    if (pagePermsByPath.has(base)) return pagePermsByPath.get(base);
    if (pagePermsPending.has(base)) return null;
    const now = Date.now();
    const retryAt = Number(pagePermRetryAfter.get(base) || 0);
    if (retryAt > now) return null;
    setPagePermsPending((prev) => new Set(prev).add(base));
    try {
      const res = await api.get(
        `/admin/page-permissions?path=${encodeURIComponent(base)}`,
        BACKGROUND_GET_CONFIG,
      );
      const row = res?.data || {};
      const perms = {
        can_view: !!row.can_view,
        can_create: !!row.can_create,
        can_edit: !!row.can_edit,
        can_delete: !!row.can_delete,
      };
      setPagePermsByPath((prev) => {
        const next = new Map(prev);
        next.set(base, perms);
        return next;
      });
      setPagePermRetryAfter((prev) => {
        const next = new Map(prev);
        next.delete(base);
        return next;
      });
      return perms;
    } catch (err) {
      setPagePermRetryAfter((prev) => {
        const next = new Map(prev);
        next.set(base, Date.now() + (PAGE_PERM_RETRY_MS || 10000));
        return next;
      });
      return null;
    } finally {
      setPagePermsPending((prev) => {
        const next = new Set(prev);
        next.delete(base);
        return next;
      });
    }
  };

  const getPagePerms = (path) => {
    const base = basePathFrom(path);
    if (!base) return null;
    return pagePermsByPath.get(base) || null;
  };

  const canPerformPageAction = (path, action = "view") => {
    if (isSuper) return true;
    const perms = getPagePerms(path);
    if (!perms) return null;
    const key =
      action === "view"
        ? "can_view"
        : action === "create"
          ? "can_create"
          : action === "edit"
            ? "can_edit"
            : action === "delete"
              ? "can_delete"
              : `can_${action}`;
    return perms[key] === true;
  };

  /**
   * Check if module is enabled
   */
  const permByFeatureKey = useMemo(() => {
    const m = new Map();
    for (const p of permissions || []) {
      const rawFk = String(p?.feature_key || "").trim();
      const mk = String(p?.module_key || "").trim();
      if (!rawFk) continue;

      // Normalize to the canonical key format used everywhere else: `${module_key}:${feature_key}`
      // Some DB rows may store `feature_key` as just `users` instead of `administration:users`.
      const canonicalFk = rawFk.includes(":")
        ? rawFk
        : mk
          ? `${mk}:${rawFk}`
          : rawFk;

      const entry = {
        module_key: mk,
        feature_key: canonicalFk,
        can_view: !!p.can_view,
        can_create: !!p.can_create,
        can_edit: !!p.can_edit,
        can_delete: !!p.can_delete,

        // Keep the original raw key for reference/debugging.
        raw_feature_key: rawFk,
      };

      m.set(canonicalFk, entry);
      // Alias: if a caller mistakenly uses the raw feature key, allow lookup too.
      if (!rawFk.includes(":")) m.set(rawFk, entry);
    }
    return m;
  }, [permissions]);

  const isSuper = useMemo(() => {
    const uid = Number(user?.id || user?.sub || 0);
    const roleName = String(
      user?.role || user?.role_name || user?.role_code || "",
    )
      .toLowerCase()
      .trim();
    return (
      uid === 1 ||
      roleName === "admin" ||
      roleName === "superadmin" ||
      roleName === "super admin" ||
      roleName === "super_admin" ||
      modules.has("*") ||
      permByFeatureKey.has("*") ||
      (user?.permissions || []).includes("*")
    );
  }, [modules, permByFeatureKey, user]);

  const isModuleEnabled = (moduleKey) => {
    const mk = String(moduleKey || "");
    if (!mk) return false;
    if (isSuper) return true;
    return modules.has(mk);
  };

  /**
   * Check if a module should appear in sidebar navigation.
   * Unlike isModuleEnabled, this respects the role's explicit module assignments
   * even for superadmins. If modules have been configured (non-empty set),
   * only those modules are shown. Falls back to isSuper when no configuration exists
   * to prevent accidental lockout.
   */
  const canViewModule = (moduleKey) => {
    const mk = String(moduleKey || "");
    if (!mk) return false;
    if (isSuper) return true;
    if (mk === "system-configuration" || mk === "system") {
      return Number(user?.id) === 1 || Number(user?.id) === 2;
    }
    if (modules.size > 0) {
      if (!modules.has(mk)) return false;
      // If administration module, also verify user has at least one viewable administration feature
      if (mk === "administration" || mk === "admin") {
        const hasAdminFeature =
          Array.from(roleFeatures).some(
            (f) => f.startsWith("administration:") || f.startsWith("admin:"),
          ) ||
          Array.from(permByFeatureKey.keys()).some(
            (f) =>
              (f.startsWith("administration:") || f.startsWith("admin:")) &&
              permByFeatureKey.get(f)?.can_view,
          );
        return hasAdminFeature;
      }
      return true;
    }
    return isSuper;
  };

  /**
   * Check if feature is enabled
   */
  const hasExplicitRoleConfig = roleFeatures.size > 0 || permissions.length > 0;

  const isFeatureEnabled = (moduleKey, featureKey) => {
    if (isSuper) return true;
    if (!isModuleEnabled(moduleKey)) return false;
    const fk = `${moduleKey}:${featureKey}`;
    if (hasExplicitRoleConfig) return permByFeatureKey.has(fk);
    if (isSuper) return true;
    return permByFeatureKey.has(fk);
  };

  /**
   * Check if dashboard is enabled
   */
  const isDashboardEnabled = (moduleKey, dashboardKey) => {
    if (isSuper) return true;
    if (!isModuleEnabled(moduleKey)) return false;
    const fk = `${moduleKey}:${dashboardKey}`;
    if (hasExplicitRoleConfig) return permByFeatureKey.has(fk);
    if (isSuper) return true;
    return permByFeatureKey.has(fk);
  };

  /**
   * Check if user can access a specific feature path
   */
  const canAccessFeatureKey = (moduleKey, featureKey) => {
    const mk = String(moduleKey || "");
    const seg = String(featureKey || "");
    if (!mk || !seg) return false;
    if (isSuper) return true;
    if (!isModuleEnabled(mk)) return false;

    let isExclusive = false;
    const moduleInfo = MODULES_REGISTRY[mk];
    if (moduleInfo && moduleInfo.features) {
      const feature = moduleInfo.features.find((f) => String(f.key) === seg);
      if (feature && feature.isExclusive) {
        isExclusive = true;
      }
    }

    const allowKey = seg.includes(":") ? seg : `${mk}:${seg}`;
    if (roleFeatures.has(allowKey)) return true;
    if (permByFeatureKey.has(allowKey)) return true;

    // Check case-insensitive and normalized variations
    const normAllowKey = allowKey.toLowerCase().replace(/[^a-z0-9:]/g, "");
    for (const rf of roleFeatures) {
      if (rf.toLowerCase().replace(/[^a-z0-9:]/g, "") === normAllowKey) return true;
    }
    for (const pk of permByFeatureKey.keys()) {
      if (pk.toLowerCase().replace(/[^a-z0-9:]/g, "") === normAllowKey) return true;
    }

    if (mk === "purchase") {
      if (
        (seg === "purchase-upload" || seg === "upload") &&
        (roleFeatures.has("purchase:purchase-upload") ||
          permByFeatureKey.has("purchase:purchase-upload"))
      ) {
        return true;
      }
      if (
        seg === "direct-purchase" &&
        (roleFeatures.has("purchase:direct-purchases") ||
          permByFeatureKey.has("purchase:direct-purchases"))
      )
        return true;
      if (
        seg === "direct-purchases" &&
        (roleFeatures.has("purchase:direct-purchase") ||
          permByFeatureKey.has("purchase:direct-purchase"))
      )
        return true;
    }
    if (mk === "sales") {
      if (
        (seg === "sales-upload" || seg === "upload") &&
        (roleFeatures.has("sales:sales-upload") ||
          permByFeatureKey.has("sales:sales-upload"))
      ) {
        return true;
      }
    }
    if (mk === "finance") {
      if (
        (seg === "import-vouchers" || seg === "import") &&
        (roleFeatures.has("finance:import-vouchers") ||
          permByFeatureKey.has("finance:import-vouchers") ||
          roleFeatures.has("finance:import") ||
          permByFeatureKey.has("finance:import"))
      ) {
        return true;
      }
      if (
        seg === "opening-balances" &&
        (roleFeatures.has("finance:opening-balances") ||
          permByFeatureKey.has("finance:opening-balances"))
      ) {
        return true;
      }
    }
    if (mk === "inventory") {
      if (
        seg === "stock-upload" &&
        (roleFeatures.has("inventory:stock-upload") ||
          permByFeatureKey.has("inventory:stock-upload"))
      ) {
        return true;
      }
      if (
        (seg === "items" || seg === "item-master" || seg === "item-groups") &&
        (roleFeatures.has("inventory:item-master") ||
          permByFeatureKey.has("inventory:item-master") ||
          roleFeatures.has("inventory:items") ||
          permByFeatureKey.has("inventory:items"))
      )
        return true;
    }
    if (hasExplicitRoleConfig) return false;
    return isExclusive ? false : isSuper;
  };

  const hasRoleFeature = (allowKey) => {
    const k = String(allowKey || "").trim();
    if (!k) return false;
    if (isSuper) return true;
    if (hasExplicitRoleConfig)
      return roleFeatures.has(k) || permByFeatureKey.has(k);
    return roleFeatures.has(k) || permByFeatureKey.has(k);
  };

  const canViewDashboardElement = (moduleKey, type, key) => {
    if (isSuper) return true;
    const mk = String(moduleKey || "");
    const t = String(type || "");
    const rawKey = String(key || "");
    const normKey = rawKey
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (!dashboardViewLoaded) return isSuper;

    // Build all candidate variations for lookup
    const candidates = new Set([normKey, rawKey]);
    if (normKey.startsWith(`${mk}-`)) {
      candidates.add(normKey.slice(mk.length + 1));
    } else {
      candidates.add(`${mk}-${normKey}`);
    }
    const aliases = getAllCardAliases(rawKey);
    aliases.forEach((a) => {
      candidates.add(a);
      if (a.startsWith(`${mk}-`)) candidates.add(a.slice(mk.length + 1));
      else candidates.add(`${mk}-${a}`);
    });

    // Special handling for Home cards
    if (mk === "home" && t === "card") {
      // 1. If explicitly disabled in Home: strictly false
      for (const c of candidates) {
        if (dashboardViewMap.get(`home|card|${c}`) === false) {
          return false;
        }
      }

      // 2. If explicitly disabled in its parent module: strictly false
      const parentMod = getCardModule(normKey);
      if (parentMod) {
        for (const c of candidates) {
          if (dashboardViewMap.get(`${parentMod}|card|${c}`) === false) {
            return false;
          }
        }
      }

      // 3. If explicitly enabled in Home: strictly true
      for (const c of candidates) {
        if (dashboardViewMap.get(`home|card|${c}`) === true) {
          return true;
        }
      }

      // 4. Fallback for unconfigured Home
      let hasHomeCardConfig = false;
      for (const [k, v] of dashboardViewMap.entries()) {
        if (k.startsWith("home|card|") && v === true) {
          hasHomeCardConfig = true;
          break;
        }
      }
      if (hasHomeCardConfig) {
        return false;
      } else {
        const defaultCards = [
          "sales-total-revenue",
          "sales-avg-sales-this-month",
          "sales-pending-orders",
          "purchase-total-value",
        ];
        const isDefault = defaultCards.some((dc) => candidates.has(dc));
        if (!isDefault) return false;
        if (parentMod) {
          for (const c of candidates) {
            if (dashboardViewMap.get(`${parentMod}|card|${c}`) === false) {
              return false;
            }
          }
        }
        return true;
      }
    }

    // For module cards/dashboards (mk !== "home"):
    // 1. If any candidate entry exists in dashboardViewMap: respect it immediately
    for (const c of candidates) {
      if (dashboardViewMap.has(`${mk}|${t}|${c}`)) {
        return dashboardViewMap.get(`${mk}|${t}|${c}`) === true;
      }
    }

    // 2. No explicit config for this element:
    // By default, dashboard permissions are disabled/unchecked unless explicitly granted
    if (t === "dashboard") {
      return false;
    }

    // Fall back to module-level RBAC for other elements
    if (mk) {
      return canAccessPath(`/${mk}`);
    }
    return isSuper;
  };

  const canAccessPath = (path, action = "view") => {
    const p = String(path || "");
    if (!p) return false;
    if (isSuper) return true;
    if (p === "/" || p === "/dashboard") return true;
    const parts = p.split("/").filter(Boolean);
    const mk = String(parts[0] || "");
    const seg = String(parts[1] || "");

    // If accessing a module dashboard route (e.g. /sales/dashboard or /purchase/dashboard)
    if (mk && (seg === "dashboard" || seg === "dashboards")) {
      return canViewDashboardElement(mk, "dashboard", "dashboard") !== false &&
             canViewDashboardElement(mk, "dashboard", "dashboards") !== false;
    }

    const moduleInfo = MODULES_REGISTRY[mk] || {};

    let isExclusive = false;
    let exclusiveFeatureKey = null;
    if (mk && moduleInfo && moduleInfo.features) {
      const feature = moduleInfo.features.find((f) => {
        const k = String(f.key);
        return (
          parts.slice(1).includes(k) ||
          (k === "import-vouchers" && (parts.includes("import") || parts.includes("import-vouchers"))) ||
          (k === "opening-balances" && parts.includes("opening-balances")) ||
          (k === "stock-upload" && parts.includes("stock-upload")) ||
          (k === "purchase-upload" && (parts.includes("purchase-upload") || parts.includes("upload"))) ||
          (k === "sales-upload" && (parts.includes("sales-upload") || parts.includes("upload")))
        );
      });
      if (feature && feature.isExclusive) {
        isExclusive = true;
        exclusiveFeatureKey = feature.key;
      }
    }

    if (isExclusive && exclusiveFeatureKey) {
      return canAccessFeatureKey(mk, exclusiveFeatureKey);
    }

    if (!isExclusive) {
      if (hasExplicitRoleConfig && globalOverrides.view) return true;
      if (!hasExplicitRoleConfig && (isSuper || globalOverrides.view))
        return true;
    }

    if (parts[0] === "home") {
      const k = String(parts[1] || "");
      if (!k) return true;
      return hasRoleFeature(`home:${k}`);
    }
    if (parts[0] === "social-feed") return true;
    if (!mk) return false;
    if (!isModuleEnabled(mk)) return false;

    // Module root path (e.g. /sales) should always be reachable if module is enabled.
    // Feature-level restrictions are applied on deeper paths and via UI filtering.
    if (parts.length === 1) return true;

    if (!seg) {
      return true;
    }

    // Direct check: feature key by seg (e.g. /inventory/items)
    if (canAccessFeatureKey(mk, seg)) return true;

    // Check composite or sub-paths, e.g. /inventory/reports/stock-balances
    for (let i = 1; i < parts.length; i++) {
      const sub = parts[i];
      if (canAccessFeatureKey(mk, sub)) return true;
      const normSub = sub.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (canAccessFeatureKey(mk, normSub)) return true;
      if (canAccessFeatureKey(mk, `${normSub}report`)) return true;
    }

    // Match against registered features in the module registry
    const registeredFeatures = moduleInfo.features || [];
    const matchedFeature = registeredFeatures.find((f) => {
      const fk = String(f.key || "").toLowerCase();
      const normFk = fk.replace(/[^a-z0-9]/g, "");
      for (let i = 1; i < parts.length; i++) {
        const pNorm = String(parts[i]).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normFk === pNorm || normFk.includes(pNorm) || pNorm.includes(normFk)) return true;
      }
      return false;
    });

    if (matchedFeature) {
      return canAccessFeatureKey(mk, matchedFeature.key);
    }

    // Match registered dashboards
    const registeredDashboards = moduleInfo.dashboards || [];
    const matchedDashboard = registeredDashboards.find((d) => {
      const dk = String(d.key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      for (let i = 1; i < parts.length; i++) {
        const pNorm = String(parts[i]).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (dk === pNorm || dk.includes(pNorm) || pNorm.includes(dk)) return true;
      }
      return false;
    });

    if (matchedDashboard) {
      return canViewDashboardElement(mk, "dashboard", matchedDashboard.key);
    }

    // If role has explicit configuration and the page was NOT granted access, DENY it!
    if (hasExplicitRoleConfig) {
      return false;
    }

    return isSuper;
  };

  const canPerformAction = (featureKey, action = "view") => {
    const fk = String(featureKey || "").trim();
    if (!fk) return false;
    if (isSuper) return true;

    const sess = sessionOverrides.get(fk);
    if (sess) {
      const k =
        action === "view"
          ? "can_view"
          : action === "create"
            ? "can_create"
            : action === "edit"
              ? "can_edit"
              : action === "delete"
                ? "can_delete"
                : `can_${action}`;
      if (typeof sess[k] === "boolean") return !!sess[k];
    }
    const act =
      action === "delete"
        ? "delete"
        : action === "create"
          ? "create"
          : action === "edit"
            ? "edit"
            : "view";
    if (
      globalOverrides &&
      Object.prototype.hasOwnProperty.call(globalOverrides, act) &&
      typeof globalOverrides[act] === "boolean"
    ) {
      return globalOverrides[act] === true;
    }

    let perm = permByFeatureKey.get(fk);
    if (!perm) {
      if (fk === "purchase:direct-purchase") {
        perm = permByFeatureKey.get("purchase:direct-purchases");
      } else if (fk === "purchase:direct-purchases") {
        perm = permByFeatureKey.get("purchase:direct-purchase");
      } else if (fk === "inventory:items") {
        perm = permByFeatureKey.get("inventory:item-master");
      } else if (fk === "inventory:item-master") {
        perm = permByFeatureKey.get("inventory:items");
      }
    }
    if (!perm) return false;

    const key =
      action === "view"
        ? "can_view"
        : action === "create"
          ? "can_create"
          : action === "edit"
            ? "can_edit"
            : action === "delete"
              ? "can_delete"
              : `can_${action}`;
    return perm[key] === true;
  };

  /**
   * Derive feature key from a URL path (e.g. /sales/invoices/new -> sales:invoices)
   */
  const featureKeyFromPath = (path) => {
    const base = basePathFrom(path || window?.location?.pathname || "/");
    const parts = String(base || "/")
      .split("/")
      .filter(Boolean);
    if (parts.length < 2) return null;
    if (parts[0] === "administration" && parts[1] === "access" && parts[2]) {
      return `administration:${parts[2]}`;
    }
    return `${parts[0]}:${parts[1]}`;
  };

  /**
   * Check if current user can create on the current page's feature
   */
  const canCreateOnPage = (path) => {
    const fk = featureKeyFromPath(path);
    if (!fk) return true;
    return canPerformAction(fk, "create");
  };

  /**
   * Check if current user can delete on the current page's feature
   */
  const canDeleteOnPage = (path) => {
    const fk = featureKeyFromPath(path);
    if (!fk) return true;
    return canPerformAction(fk, "delete");
  };

  /**
   * Get enabled modules for sidebar
   */
  const getEnabledModules = () =>
    Object.keys(MODULES_REGISTRY).filter((k) => isModuleEnabled(k));

  /**
   * Get enabled features for a module
   */
  const getEnabledFeatures = (moduleKey) => {
    if (!isModuleEnabled(moduleKey)) return [];
    const module = MODULES_REGISTRY[moduleKey];
    if (!module) return [];
    // If role features or permissions have been explicitly configured, respect them
    // even for superadmins (same as canViewModule sidebar logic).
    if (roleFeatures.size > 0 || permissions.length > 0) {
      return (module.features || []).filter(
        (f) =>
          roleFeatures.has(`${moduleKey}:${f.key}`) ||
          permByFeatureKey.has(`${moduleKey}:${f.key}`),
      );
    }
    if (isSuper) return module.features || [];
    return (module.features || []).filter(
      (f) =>
        roleFeatures.has(`${moduleKey}:${f.key}`) ||
        permByFeatureKey.has(`${moduleKey}:${f.key}`),
    );
  };

  /**
   * Get enabled dashboards for a module
   */
  const getEnabledDashboards = (moduleKey) => {
    if (!isModuleEnabled(moduleKey)) return [];
    const module = MODULES_REGISTRY[moduleKey];
    if (!module) return [];
    if (roleFeatures.size > 0 || permissions.length > 0) {
      return (module.dashboards || []).filter(
        (d) =>
          roleFeatures.has(`${moduleKey}:${d.key}`) ||
          permByFeatureKey.has(`${moduleKey}:${d.key}`),
      );
    }
    if (isSuper) return module.dashboards || [];
    return (module.dashboards || []).filter(
      (d) =>
        roleFeatures.has(`${moduleKey}:${d.key}`) ||
        permByFeatureKey.has(`${moduleKey}:${d.key}`),
    );
  };

  /**
   * Get disabled features for ModuleDashboard component
   */
  const getDisabledFeatures = (moduleKey) => {
    const module = MODULES_REGISTRY[moduleKey];
    if (!module) return [];

    const disabledFeatures = [];

    // If module is disabled, all features are disabled
    if (!isModuleEnabled(moduleKey)) {
      (module.features || []).forEach((feature) => {
        disabledFeatures.push(`${moduleKey}:${feature.key}`);
      });
      return disabledFeatures;
    }

    // Otherwise, check individual features
    (module.features || []).forEach((feature) => {
      if (!isFeatureEnabled(moduleKey, feature.key)) {
        disabledFeatures.push(`${moduleKey}:${feature.key}`);
      }
    });

    return disabledFeatures;
  };

  /**
   * Refresh permissions (useful after role changes)
   */
  const refreshPermissions = async () => {
    if (!initialized || !token) {
      setModules(new Set());
      setPermissions([]);
      setRoleFeatures(new Set());
      setExceptionalPerms(new Set());
      setLicensedModules(new Set());
      setDashboardViewMap(new Map());
      setDashboardViewLoaded(true);
      setLoading(false);
      return;
    }
    // Clear page-level permission cache so changes take effect immediately
    setPagePermsByPath(new Map());
    await loadPermissions(true);
    await loadDashboardPermissions();
  };

  useEffect(() => {
    if (!initialized) return;
    loadPermissions();
  }, [initialized, token, user?.id]);
  useEffect(() => {
    if (!initialized) return;
    loadDashboardPermissions();
  }, [initialized, token, user?.id]);

  useEffect(() => {
    if (!initialized || !token) return;
    const userId = Number(user?.id || user?.sub || 0);
    if (!Number.isFinite(userId) || !userId) return;

    const id = setInterval(() => {
      checkDashboardPermissionsVersion();
    }, DASHBOARD_PERM_POLL_MS);

    const onFocus = () => checkDashboardPermissionsVersion();
    const onVis = () => checkDashboardPermissionsVersion();
    try {
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVis);
    } catch {}

    return () => {
      clearInterval(id);
      try {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVis);
      } catch {}
    };
  }, [initialized, token, user?.id]);
  useEffect(() => {
    try {
      if (typeof document !== "undefined" && document.body) {
        if (exceptionalPerms.has("SALES.DISCOUNT.ALLOW")) {
          document.body.classList.remove("discount-guard-disabled");
        } else {
          document.body.classList.add("discount-guard-disabled");
        }
        const guards = [
          'input[name="discount_percent"]',
          'input[name="discount"]',
          'input[placeholder="Disc %"]',
          'input[placeholder*="Discount"]',
          ".discount-guard input",
          ".discount-guard select",
          ".discount-guard textarea",
        ];

        const guardEnabled = !exceptionalPerms.has("SALES.DISCOUNT.ALLOW");

        // Apply guard immediately to existing elements
        if (guardEnabled) {
          const all = document.querySelectorAll(guards.join(","));
          all.forEach((el) => {
            try {
              if (!el.hasAttribute("data-discount-guard")) {
                el.setAttribute("data-discount-guard", "1");
              }
              el.setAttribute("disabled", "true");
            } catch {}
          });
        }

        // Only observe when guard is active; debounce to avoid layout thrashing
        if (guardEnabled && typeof MutationObserver !== "undefined") {
          let timer = null;
          const applyGuard = () => {
            if (timer) return;
            timer = requestAnimationFrame(() => {
              timer = null;
              const nodes = document.querySelectorAll(guards.join(","));
              nodes.forEach((el) => {
                try {
                  if (!el.hasAttribute("data-discount-guard")) {
                    el.setAttribute("data-discount-guard", "1");
                  }
                  el.setAttribute("disabled", "true");
                } catch {}
              });
            });
          };
          const obs = new MutationObserver(() => applyGuard());
          obs.observe(document.body, { childList: true, subtree: true });
          return () => {
            if (timer) cancelAnimationFrame(timer);
            obs.disconnect();
          };
        }
      }
    } catch {}
  }, [exceptionalPerms]);

  // Centralized create/delete button guard across all list pages
  const guardCleanupRef = useRef(null);
  useEffect(() => {
    if (typeof document === "undefined") return;

    function runGuard() {
      if (guardCleanupRef.current) guardCleanupRef.current();

      const path = window?.location?.pathname || "/";
      if (
        path.startsWith("/pos/") ||
        path === "/pos" ||
        path.endsWith("/new") ||
        path.endsWith("/create") ||
        path.includes("/new/") ||
        path.includes("/create/") ||
        path.includes("/edit") ||
        /\/\d+$/.test(path) ||
        /\/[0-9a-fA-F-]{8,}$/.test(path)
      ) {
        document.body.classList.remove("create-guard-disabled", "delete-guard-disabled");
        document.querySelectorAll("[data-create-guard]").forEach((el) => {
          if (el.getAttribute("data-create-guard") === "visible") el.style.display = "";
          el.removeAttribute("data-create-guard");
        });
        document.querySelectorAll("[data-delete-guard]").forEach((el) => {
          if (el.getAttribute("data-delete-guard") === "visible") el.style.display = "";
          el.removeAttribute("data-delete-guard");
        });
        guardCleanupRef.current = null;
        return;
      }

      const canCreate = canCreateOnPage(path);
      const canDelete = canDeleteOnPage(path);
      document.body.classList.toggle("create-guard-disabled", !canCreate);
      document.body.classList.toggle("delete-guard-disabled", !canDelete);
      if (canCreate && canDelete) {
        guardCleanupRef.current = null;
        return;
      }

      let timer = null;
      const createSelectors =
        'a[href*="/new"], a[href*="/create"], .list-header .btn-primary, .list-header .btn-success';
      const applyGuards = () => {
        if (timer) return;
        timer = requestAnimationFrame(() => {
          timer = null;
          if (!canCreate) {
            document.querySelectorAll(createSelectors).forEach((el) => {
              // Never hide elements inside forms, detail views, or marked exempt
              if (
                el.closest("form") ||
                el.closest("[data-form]") ||
                el.closest(".form-section") ||
                el.closest(".pos-sales-entry") ||
                el.getAttribute?.("data-rbac-exempt") === "true" ||
                el.closest("[data-rbac-exempt='true']") ||
                el.closest("[data-rbac-exempt]")
              ) {
                return;
              }
              const text = (el.textContent || "").trim();
              const href = (el.getAttribute("href") || "").toLowerCase();
              if (
                href.includes("/new") ||
                href.includes("/create") ||
                /^(New|Create)\s+[A-Z]/i.test(text) ||
                text === "New" ||
                text === "Create"
              ) {
                if (!el.hasAttribute("data-create-guard")) {
                  el.setAttribute(
                    "data-create-guard",
                    el.style.display === "none" ? "hidden" : "visible",
                  );
                  el.style.display = "none";
                }
              }
            });
          }
          if (!canDelete) {
            document
              .querySelectorAll('.btn-danger, a[href*="/delete"]')
              .forEach((el) => {
                // Never hide elements inside forms or marked exempt
                if (
                  el.closest("form") ||
                  el.closest("[data-form]") ||
                  el.closest(".form-section") ||
                  el.closest(".pos-sales-entry") ||
                  el.getAttribute?.("data-rbac-exempt") === "true" ||
                  el.closest("[data-rbac-exempt='true']") ||
                  el.closest("[data-rbac-exempt]")
                ) {
                  return;
                }
                const text = (el.textContent || "").trim().toLowerCase();
                const href = (el.getAttribute("href") || "").toLowerCase();
                if (
                  href.includes("delete") ||
                  text === "delete" ||
                  (text.includes("delete") && text.length < 15)
                ) {
                  if (!el.hasAttribute("data-delete-guard")) {
                    el.setAttribute(
                      "data-delete-guard",
                      el.style.display === "none" ? "hidden" : "visible",
                    );
                    el.style.display = "none";
                  }
                }
              });
          }
        });
      };

      applyGuards();
      const obs = new MutationObserver(() => applyGuards());
      obs.observe(document.body, { childList: true, subtree: true });
      guardCleanupRef.current = () => {
        if (timer) cancelAnimationFrame(timer);
        obs.disconnect();
        document.querySelectorAll("[data-create-guard]").forEach((el) => {
          if (el.getAttribute("data-create-guard") === "visible")
            el.style.display = "";
          el.removeAttribute("data-create-guard");
        });
        document.querySelectorAll("[data-delete-guard]").forEach((el) => {
          if (el.getAttribute("data-delete-guard") === "visible")
            el.style.display = "";
          el.removeAttribute("data-delete-guard");
        });
      };
    }

    runGuard();
    const onNav = () => runGuard();
    window.addEventListener("popstate", onNav);
    window.addEventListener("rbac:updated", onNav);
    return () => {
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("rbac:updated", onNav);
      if (guardCleanupRef.current) guardCleanupRef.current();
    };
  }, [permissions, roleFeatures, exceptionalPerms, pagePermsByPath]);

  useEffect(() => {
    function onChanged() {
      refreshPermissions();
    }
    function onStorage(e) {
      if (e?.key === "rbac:bump") {
        refreshPermissions();
      }
    }
    window.addEventListener("rbac:changed", onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("rbac:changed", onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const value = {
    appMode,
    isBasicMode: appMode === "BASIC",
    setAppMode,
    moduleSectionViewEnabled,
    setModuleSectionViewEnabled,
    appBackground,
    setAppBackground,
    modules,
    licensedModules,
    permissions,
    roleFeatures,
    exceptionalPerms,
    loading,
    error,
    isModuleEnabled,
    canViewModule,
    isFeatureEnabled,
    isDashboardEnabled,
    canAccessPath,
    canAccessFeatureKey,
    hasRoleFeature,
    canPerformAction,
    canCreateOnPage,
    canDeleteOnPage,
    featureKeyFromPath,
    getEnabledModules,
    getEnabledFeatures,
    getEnabledDashboards,
    getDisabledFeatures,
    refreshPermissions,
    MODULES_REGISTRY,
    globalOverrides,
    setGlobalOverrides,
    sessionOverrides,
    setSessionOverrides,
    pagePermsByPath,
    ensurePagePerms,
    getPagePerms,
    canPerformPageAction,
    basePathFrom,
    canViewDashboardElement,
    setActionSessionOverride: (fk, action, value) => {
      const key =
        action === "can_view"
          ? "can_view"
          : action === "can_create"
            ? "can_create"
            : action === "can_edit"
              ? "can_edit"
              : action === "can_delete"
                ? "can_delete"
                : action;
      const featureKey = String(fk || "").trim();
      if (!featureKey || !key) return;
      setSessionOverrides((prev) => {
        const next = new Map(prev);
        const existing = next.get(featureKey) || {};
        next.set(featureKey, { ...existing, [key]: !!value });
        return next;
      });
      try {
        window.dispatchEvent(new Event("rbac:updated"));
      } catch {}
    },
    clearSessionOverrides: () => {
      setSessionOverrides(new Map());
      try {
        window.dispatchEvent(new Event("rbac:updated"));
      } catch {}
    },
    hasExceptional: (code) => {
      const c = String(code || "")
        .toUpperCase()
        .trim();
      if (!c) return false;
      if (
        exceptionalPerms.has(c) ||
        exceptionalPerms.has("*") ||
        exceptionalPerms.has("ALL")
      ) {
        return true;
      }
      const uid = Number(user?.id || user?.sub || 0);
      if (uid === 1) return true;
      if (
        modules.has("*") &&
        permissions.some(
          (p) => p.module_key === "*" && p.feature_key === "*",
        )
      ) {
        return true;
      }
      return false;
    },
    canReverseApproval: () =>
      exceptionalPerms.has("WORKFLOW.APPROVAL.REVERSE") ||
      exceptionalPerms.has("WORKFLOW.PENDING_APPROVAL.REVERSE"),
    canReversePendingApproval: () =>
      exceptionalPerms.has("WORKFLOW.PENDING_APPROVAL.REVERSE") ||
      exceptionalPerms.has("WORKFLOW.APPROVAL.REVERSE"),
    canEditDiscount: () => exceptionalPerms.has("SALES.DISCOUNT.ALLOW"),
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

export default PermissionContext;
