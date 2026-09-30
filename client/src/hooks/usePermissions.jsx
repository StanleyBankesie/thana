import React from "react";
import { api } from "../api/client.js";

export function usePermissions() {
  const [modules, setModules] = React.useState([]);
  const [permissions, setPermissions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/access/permissions");
      setModules(res?.data?.modules || []);
      setPermissions(res?.data?.permissions || []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const canViewModule = React.useCallback(
    (moduleKey) => modules.includes(moduleKey),
    [modules],
  );

  const canViewFeature = React.useCallback(
    (moduleKey, featureKey) => {
      const perm = permissions.find(
        (p) => p.module_key === moduleKey && p.feature_key === featureKey,
      );
      if (!perm) return false;
      return !!perm.can_view;
    },
    [permissions],
  );

  return { modules, permissions, loading, canViewModule, canViewFeature };
}

export function Guard({ moduleKey, featureKey, children, fallback = null }) {
  const { loading, canViewModule, canViewFeature } = usePermissions();
  const ok =
    featureKey != null
      ? canViewFeature(moduleKey, featureKey)
      : canViewModule(moduleKey);
  if (loading) return <div className="p-4">Loading permissions...</div>;
  if (!ok)
    return (
      fallback || (
        <div className="p-6 text-center text-sm">
          You do not have permission to view this page.
        </div>
      )
    );
  return children;
}
