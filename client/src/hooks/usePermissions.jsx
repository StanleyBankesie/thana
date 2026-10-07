import React from "react";
import { usePermission } from "../auth/PermissionContext.jsx";

export function usePermissions() {
  let ctx = null;
  try {
    ctx = usePermission();
  } catch {
    ctx = null;
  }

  const modules = React.useMemo(() => {
    if (!ctx?.modules) return [];
    return Array.from(ctx.modules);
  }, [ctx?.modules]);

  const permissions = ctx?.permissions || [];
  const loading = !!ctx?.loading;

  const canViewModule = React.useCallback(
    (moduleKey) => {
      if (!ctx) return true;
      if (!moduleKey) return false;
      if (typeof ctx.isModuleEnabled === "function") {
        return ctx.isModuleEnabled(moduleKey);
      }
      if (typeof ctx.canViewModule === "function") {
        return ctx.canViewModule(moduleKey);
      }
      return modules.includes(moduleKey);
    },
    [ctx, modules],
  );

  const canViewFeature = React.useCallback(
    (moduleKey, featureKey) => {
      if (!ctx) return true;
      if (!moduleKey) return false;
      if (!featureKey) return canViewModule(moduleKey);
      if (typeof ctx.canAccessFeatureKey === "function") {
        return ctx.canAccessFeatureKey(moduleKey, featureKey);
      }
      if (typeof ctx.isFeatureEnabled === "function") {
        return ctx.isFeatureEnabled(moduleKey, featureKey);
      }
      const perm = permissions.find(
        (p) =>
          p.module_key === moduleKey &&
          (p.feature_key === featureKey || p.feature_key === `${moduleKey}:${featureKey}`),
      );
      if (perm) return !!perm.can_view;
      return canViewModule(moduleKey);
    },
    [ctx, permissions, canViewModule],
  );

  return { modules, permissions, loading, canViewModule, canViewFeature };
}

export function Guard({ moduleKey, featureKey, children, fallback = null }) {
  const { loading, canViewModule, canViewFeature } = usePermissions();
  const ok =
    featureKey != null
      ? canViewFeature(moduleKey, featureKey)
      : canViewModule(moduleKey);
  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand mb-2" />
        <p>Loading permissions...</p>
      </div>
    );
  }
  if (!ok) {
    return (
      fallback || (
        <div className="p-6 text-center text-sm text-slate-500">
          You do not have permission to view this page.
        </div>
      )
    );
  }
  return children;
}

