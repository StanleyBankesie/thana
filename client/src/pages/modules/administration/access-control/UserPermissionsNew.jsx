/**
 * @fileoverview UserPermissionsNew component.
 * Provides functionality for UserPermissionsNew.
 */

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { MODULES_REGISTRY } from "../../../../data/modulesRegistry.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function UserPermissionsNew() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const {
    refreshPermissions,
    setGlobalOverrides,
    setActionSessionOverride,
    clearSessionOverrides,
  } = usePermission();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleId, setRoleId] = useState(null);
  const [roleName, setRoleName] = useState("");
  const [roleModules, setRoleModules] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [userFeatureOverrides, setUserFeatureOverrides] = useState({});
  const [featureContextByKey, setFeatureContextByKey] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [moduleFilter, setModuleFilter] = useState(new Set());
  const [availableModules, setAvailableModules] = useState([]);
  const [features, setFeatures] = useState([]);


  async function loadUsers() {
    setError("");
    try {
      const res = await api.get("/admin/users");
      const d = res?.data;
      let items = [];
      if (Array.isArray(d)) items = d;
      else if (Array.isArray(d?.items)) items = d.items;
      else if (Array.isArray(d?.data?.items)) items = d.data.items;
      else if (Array.isArray(d?.data)) items = d.data;
      setUsers(items);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load users");
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const msg = location?.state?.success;
    const onListRoute = !params?.id;
    if (!onListRoute) return;
    if (typeof msg !== "string" || !msg.trim()) return;
    setSuccess(msg);
    const t = setTimeout(() => setSuccess(""), 2000);
    try {
      navigate("/administration/access/user-permissions", {
        replace: true,
        state: null,
      });
    } catch {}
    return () => clearTimeout(t);
  }, [location?.state, navigate, params?.id]);

  useEffect(() => {
    const s = location?.state?.afterSave;
    const onListRoute = !params?.id;
    if (!onListRoute) return;
    if (!s || s.entity !== "user-permissions") return;
    loadUsers();
    setTimeout(() => loadUsers(), 500);
    try {
      navigate("/administration/access/user-permissions", {
        replace: true,
        state: null,
      });
    } catch {}
  }, [location?.state, params?.id, navigate]);

  useEffect(() => {
    const idRaw = params?.id;
    const id = Number(idRaw || 0);
    if (!id) return;
    loadUserContext(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id]);

  async function loadUserContext(userId) {
    setSelectedUser(userId);
    setLoading(true);
    setError("");
    try {
      // Load user info
      const userRes = await api.get(`/admin/users/${userId}`);
      const user = userRes?.data?.data?.item || null;
      const rId = Number(user?.role_id || user?.role?.id || 0);
      setRoleId(rId || null);

      if (rId) {
        // Role name comes from getUserById now (r.name AS role_name)
        setRoleName(user?.role_name || "");
        // Load role features and existing user permissions
        const [featsRes, roleFeatsRes, userPermsRes, userOverridesRes] =
          await Promise.all([
            api.get(`/access/features`),
            api
              .get(`/access/roles/${rId}/features`)
              .catch(() => ({ data: { features: [] } })),
            api
              .get(`/admin/users/${userId}/feature-permissions-context`)
              .catch(() => ({ data: { items: [] } })),
            api
              .get(`/admin/users/${userId}/feature-permissions`)
              .catch(() => ({ data: { items: [] } })),
          ]);

        const allFeatures = featsRes?.data?.features || [];
        const roleFeats = roleFeatsRes?.data?.features || [];
        const contextItems = Array.isArray(userPermsRes?.data?.items)
          ? userPermsRes.data.items
          : Array.isArray(userPermsRes?.data?.data?.items)
            ? userPermsRes.data.data.items
            : [];
        const overrideItems = Array.isArray(userOverridesRes?.data?.items)
          ? userOverridesRes.data.items
          : Array.isArray(userOverridesRes?.data?.data?.items)
            ? userOverridesRes.data.data.items
            : [];

        // Build from adm_role_features: match registry entries to role feature keys
        const roleFeatSet = new Set(roleFeats.map(String));
        const filteredFeatures = allFeatures.filter((f) =>
          roleFeatSet.has(String(f.feature_key)),
        );

        // Build registry label map so labels always reflect modulesRegistry.js
        const registryLabelMap = new Map();
        Object.entries(MODULES_REGISTRY).forEach(([mKey, mod]) => {
          (mod.features || []).forEach((f) => {
            registryLabelMap.set(`${mKey}:${f.key}`, f.label);
          });
        });

        // Features only (dashboards excluded from user permissions page)
        const featuresOnly = filteredFeatures
          .filter((feature) => {
            const [moduleKey, itemKey] = feature.feature_key.split(":");
            const moduleInfo = MODULES_REGISTRY[moduleKey];
            if (!moduleInfo) return true;
            return !moduleInfo.dashboards?.some((d) => d.key === itemKey);
          })
          .map((feature) => {
            const updatedLabel = registryLabelMap.get(feature.feature_key) || feature.label;
            return { ...feature, label: updatedLabel };
          });

        // Store role defaults + pages from context for later save (keyed by feature_key)
        const ctxMap = new Map();
        for (const item of contextItems) {
          const fk = String(item.feature_key || "").trim();
          if (!fk) continue;
          ctxMap.set(fk, {
            module_key: item.module_key,
            feature_key: fk,
            default_can_view: !!item.default_can_view,
            default_can_create: !!item.default_can_create,
            default_can_edit: !!item.default_can_edit,
            default_can_delete: !!item.default_can_delete,
            pages: Array.isArray(item.pages) ? item.pages : [],
            label: item.label || fk,
            type: item.type || "feature",
          });
        }
        setFeatureContextByKey(ctxMap);

        const initialOverrides = {};
        for (const row of overrideItems) {
          const fk = String(row?.feature_key || "").trim();
          if (!fk) continue;
          initialOverrides[fk] = {
            can_view: !!row?.can_view,
            can_create: !!row?.can_create,
            can_edit: !!row?.can_edit,
            can_delete: !!row?.can_delete,
          };
        }
        setUserFeatureOverrides(initialOverrides);

        // Derive role modules from role features (no DB fetch)
        setRoleModules(
          Array.from(new Set(filteredFeatures.map((f) => f.module_key))),
        );

        // Set available modules (derived from role features)
        setAvailableModules(
          Array.from(new Set(filteredFeatures.map((f) => f.module_key))),
        );
        setFeatures(featuresOnly);
        setModuleFilter(new Set());
      } else {
        setRoleModules([]);
        setRolePermissions({});
        setUserFeatureOverrides({});
        setFeatureContextByKey(new Map());
        setFeatures([]);
        setAvailableModules([]);
        setModuleFilter(new Set());
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load user context");
    } finally {
      setLoading(false);
    }
  }

  function resetSelection() {
    setSelectedUser(null);
    setRoleId(null);
    setRoleName("");
    setRoleModules([]);
    setRolePermissions({});
    setUserFeatureOverrides({});
    setFeatureContextByKey(new Map());
    setFeatures([]);
    setAvailableModules([]);
    setModuleFilter(new Set());
  }

  function setFeatureOverride(fk, action, value) {
    setUserFeatureOverrides((prev) => {
      const next = { ...prev };
      if (!next[fk]) {
        next[fk] = {
          can_view: null,
          can_create: null,
          can_edit: null,
          can_delete: null,
        };
      }
      next[fk] = {
        ...next[fk],
        [action]: value,
      };

      if (action !== "can_view" && value === true) {
        next[fk].can_view = true;
      }
      if (action === "can_view" && value === false) {
        next[fk].can_create = false;
        next[fk].can_edit = false;
        next[fk].can_delete = false;
      }
      return next;
    });
    try {
      setActionSessionOverride(fk, action, value);
      if (action === "can_view" && value === false) {
        setActionSessionOverride(fk, "can_create", false);
        setActionSessionOverride(fk, "can_edit", false);
        setActionSessionOverride(fk, "can_delete", false);
      }
      if (action !== "can_view" && value === true) {
        setActionSessionOverride(fk, "can_view", true);
      }
    } catch {}
  }

  async function save() {
    try {
      if (!selectedUser) throw new Error("Select a user first");

      setSaving(true);
      setError("");

      // Build per-page payload for ALL features with explicit overrides.
      // We also pass feature_key so the backend can resolve page IDs
      // for features whose pages weren't loaded in context.
      const payload = [];
      for (const [featureKeyRaw, actionsRaw] of Object.entries(
        userFeatureOverrides || {},
      )) {
        const featureKey = String(featureKeyRaw || "").trim();
        if (!featureKey) continue;

        const actions = actionsRaw || {};
        const hasAnyExplicit =
          typeof actions.can_view === "boolean" ||
          typeof actions.can_create === "boolean" ||
          typeof actions.can_edit === "boolean" ||
          typeof actions.can_delete === "boolean";
        if (!hasAnyExplicit) continue;

        const can_view = getEffective(featureKey, "can_view");
        const can_create = getEffective(featureKey, "can_create");
        const can_edit = getEffective(featureKey, "can_edit");
        const can_delete = getEffective(featureKey, "can_delete");

        const ctx = featureContextByKey.get(featureKey) || {};
        const pages = Array.isArray(ctx?.pages) ? ctx.pages : [];

        if (pages.length > 0) {
          // Send one entry per page so backend can do page-level upserts
          for (const pg of pages) {
            const pgId = Number(pg.page_id || pg.id || 0);
            if (!pgId) continue;
            payload.push({
              feature_key: featureKey,
              page_id: pgId,
              can_view,
              can_create,
              can_edit,
              can_delete,
            });
          }
        } else {
          // No pages resolved on the client; send feature_key only so the
          // server can resolve the correct pages from adm_pages.
          payload.push({
            feature_key: featureKey,
            page_id: null,
            can_view,
            can_create,
            can_edit,
            can_delete,
          });
        }
      }

      await api.post(`/admin/users/${selectedUser}/feature-permissions`, {
        permissions: payload,
      });
      try {
        // Await refresh so page-level permission cache is cleared before we reload context
        await refreshPermissions?.();
        window.dispatchEvent?.(new Event("rbac:changed"));
      } catch {}

      const msg = "User permissions saved successfully";
      try {
        toast.success(msg);
      } catch {}
      try {
        clearSessionOverrides();
      } catch {}
      // Don't reset selection - keep the user on the same page to see their changes
      // resetSelection();
      setSuccess(msg);
      // Reload the user context to reflect saved changes
      await loadUserContext(selectedUser);
      // Don't navigate away - stay on the same page
      // navigate("/administration/access/user-permissions", {
      //   state: {
      //     success: msg,
      //     afterSave: {
      //       entity: "user-permissions",
      //       id: Number(selectedUser) || null,
      //       ts: Date.now(),
      //     },
      //   },
      //   replace: true,
      // });
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  }

  function toggleModuleFilter(moduleKey, checked) {
    setModuleFilter((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(moduleKey);
      } else {
        next.delete(moduleKey);
      }
      return next;
    });
  }

  const visibleFeatures = features.filter((f) =>
    moduleFilter.size === 0 ? true : moduleFilter.has(f.module_key),
  );

  const visibleFeatureKeys = visibleFeatures.map((f) => String(f.feature_key));
  const visibleAllKeys = visibleFeatureKeys;

  function getEffective(fk, action) {
    const row = userFeatureOverrides[String(fk)] || {};
    if (typeof row[action] === "boolean") return row[action];
    const ctx = featureContextByKey.get(String(fk)) || {};
    const defaultKey = `default_${action}`;
    if (typeof ctx[defaultKey] === "boolean") return ctx[defaultKey];
    return false;
  }

  const allViewChecked =
    visibleAllKeys.length > 0 &&
    visibleAllKeys.every((fk) => getEffective(fk, "can_view"));
  const allCreateChecked =
    visibleFeatureKeys.length > 0 &&
    visibleFeatureKeys.every((fk) => getEffective(fk, "can_create"));
  const allEditChecked =
    visibleFeatureKeys.length > 0 &&
    visibleFeatureKeys.every((fk) => getEffective(fk, "can_edit"));
  const allDeleteChecked =
    visibleFeatureKeys.length > 0 &&
    visibleFeatureKeys.every((fk) => getEffective(fk, "can_delete"));

  function toggleAll(keys, action, checked) {
    setUserFeatureOverrides((prev) => {
      const next = { ...prev };
      for (const fkRaw of keys) {
        const fk = String(fkRaw || "").trim();
        if (!fk) continue;
        const existing = next[fk] || {};
        next[fk] = {
          can_view: existing.can_view ?? null,
          can_create: existing.can_create ?? null,
          can_edit: existing.can_edit ?? null,
          can_delete: existing.can_delete ?? null,
          [action]: checked,
        };

        if (action !== "can_view" && checked === true) {
          next[fk].can_view = true;
        }
        if (action === "can_view" && checked === false) {
          next[fk].can_create = false;
          next[fk].can_edit = false;
          next[fk].can_delete = false;
        }
      }
      return next;
    });
    try {
      for (const fkRaw of keys) {
        const fk = String(fkRaw || "").trim();
        if (!fk) continue;
        setActionSessionOverride(fk, action, checked);
        if (action !== "can_view" && checked === true) {
          setActionSessionOverride(fk, "can_view", true);
        }
        if (action === "can_view" && checked === false) {
          setActionSessionOverride(fk, "can_create", false);
          setActionSessionOverride(fk, "can_edit", false);
          setActionSessionOverride(fk, "can_delete", false);
        }
      }
    } catch {}
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Permissions</h1>
          <p className="text-sm text-slate-600">
            Set module actions for selected user’s role; features follow module
            access
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedUser ? (
            <>
              <div className="flex flex-wrap items-center gap-4 px-3 py-2 border rounded">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allViewChecked}
                    disabled={saving}
                    onChange={(e) => {
                      toggleAll(visibleAllKeys, "can_view", e.target.checked);
                      try {
                        setGlobalOverrides((prev) => ({
                          ...prev,
                          view: e.target.checked,
                        }));
                      } catch {}
                    }}
                  />
                  <span>All View</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allCreateChecked}
                    disabled={saving}
                    onChange={(e) => {
                      toggleAll(
                        visibleFeatureKeys,
                        "can_create",
                        e.target.checked,
                      );
                      try {
                        setGlobalOverrides((prev) => ({
                          ...prev,
                          create: e.target.checked,
                        }));
                      } catch {}
                    }}
                  />
                  <span>All Create</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allEditChecked}
                    disabled={saving}
                    onChange={(e) => {
                      toggleAll(
                        visibleFeatureKeys,
                        "can_edit",
                        e.target.checked,
                      );
                      try {
                        setGlobalOverrides((prev) => ({
                          ...prev,
                          edit: e.target.checked,
                        }));
                      } catch {}
                    }}
                  />
                  <span>All Edit</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allDeleteChecked}
                    disabled={saving}
                    onChange={(e) => {
                      toggleAll(
                        visibleFeatureKeys,
                        "can_delete",
                        e.target.checked,
                      );
                      try {
                        setGlobalOverrides((prev) => ({
                          ...prev,
                          delete: e.target.checked,
                        }));
                      } catch {}
                    }}
                  />
                  <span>All Delete</span>
                </label>
              </div>
              <button
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => {
                  setUserFeatureOverrides((prev) => {
                    const next = { ...prev };
                    for (const f of visibleFeatures) {
                      next[f.feature_key] = {
                        can_view: true,
                        can_create: true,
                        can_edit: true,
                        can_delete: true,
                      };
                    }
                    return next;
                  });
                }}
              >
                Grant All Visible
              </button>
              <button
                className="btn btn-success"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Permissions"}
              </button>
              <button
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => {
                  resetSelection();
                  navigate("/administration/access/user-permissions");
                }}
              >
                Back to List
              </button>
            </>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/administration?section=Audit%20%26%20Logs")}
            >
              Back to Menu
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && (
        <div className="alert alert-success flex justify-between items-center">
          <span>{success}</span>
          <button className="btn-outline" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-body space-y-6">
          {!selectedUser ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Users</h2>
                <p className="text-sm text-slate-600">
                  Select a user to manage permissions
                </p>
              </div>

              {loading ? (
                <div className="text-center py-8">Loading users...</div>
              ) : users.length === 0 ? (
                <div className="alert alert-warning">
                  No users found. Create a user in Administration → User
                  Management.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th className="w-32">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="font-medium">{u.username}</td>
                          <td>{u.email}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() =>
                                navigate(
                                  `/administration/access/user-permissions/${u.id}`,
                                )
                              }
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Select User</label>
                  <select
                    className="input"
                    value={selectedUser || ""}
                    disabled={saving}
                    onChange={(e) => {
                      const nextId = Number(e.target.value || 0);
                      if (!nextId) {
                        resetSelection();
                        navigate("/administration/access/user-permissions");
                        return;
                      }
                      navigate(
                        `/administration/access/user-permissions/${nextId}`,
                      );
                    }}
                  >
                    <option value="">Choose user</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Assigned Role</label>
                  <div className="p-3 border rounded bg-slate-50 dark:bg-slate-800">
                    {roleId ? (roleName || `Role #${roleId}`) : "No role assigned"}
                  </div>
                </div>
                <div>
                  <label className="label">Role Modules</label>
                  <div className="p-3 border rounded bg-slate-50 dark:bg-slate-800">
                    {roleModules.length > 0 ? roleModules.join(", ") : "None"}
                  </div>
                </div>
              </div>

              {availableModules.length > 0 && (
                <div>
                  {/* Module Filter */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <span>🔍</span>
                      Filter by Module
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {availableModules.map((moduleKey) => {
                        const moduleInfo = MODULES_REGISTRY[moduleKey];
                        return (
                          <label
                            key={moduleKey}
                            className="flex items-center gap-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={moduleFilter.has(moduleKey)}
                              disabled={saving}
                              onChange={(e) =>
                                toggleModuleFilter(moduleKey, e.target.checked)
                              }
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-xl">
                                {moduleInfo?.icon}
                              </span>
                              <span className="font-medium">
                                {moduleInfo?.name}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Features Section */}
                  {visibleFeatures.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <span>⚡</span>
                        Features ({visibleFeatures.length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="table w-full table-fixed">
                          <thead>
                            <tr>
                              <th className="text-center w-[14.28%]">Feature</th>
                              <th className="text-center w-[14.28%]">Module</th>
                              <th className="text-center w-[14.28%]">Type</th>
                              <th className="text-center w-[14.28%]">View</th>
                              <th className="text-center w-[14.28%]">Create</th>
                              <th className="text-center w-[14.28%]">Edit</th>
                              <th className="text-center w-[14.28%]">Delete</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleFeatures.map((feature) => {
                              const moduleInfo =
                                MODULES_REGISTRY[feature.module_key];
                              const ctx =
                                featureContextByKey.get(
                                  String(feature.feature_key),
                                ) || {};
                              const overrideRow =
                                userFeatureOverrides[feature.feature_key] || {};

                              return (
                                <tr key={feature.feature_key}>
                                  <td className="p-3 font-medium text-center truncate">
                                    {feature.label}
                                  </td>
                                  <td className="p-3 text-center truncate">{feature.module_key}</td>
                                  <td className="p-3 text-center truncate">
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-medium ${
                                        feature.type === "dashboard"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-green-100 text-green-800"
                                      }`}
                                    >
                                      {feature.type}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-sm"
                                      checked={getEffective(
                                        feature.feature_key,
                                        "can_view",
                                      )}
                                      disabled={saving}
                                      onChange={(e) =>
                                        setFeatureOverride(
                                          feature.feature_key,
                                          "can_view",
                                          e.target.checked,
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-sm"
                                      checked={getEffective(
                                        feature.feature_key,
                                        "can_create",
                                      )}
                                      disabled={saving}
                                      onChange={(e) =>
                                        setFeatureOverride(
                                          feature.feature_key,
                                          "can_create",
                                          e.target.checked,
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-sm"
                                      checked={getEffective(
                                        feature.feature_key,
                                        "can_edit",
                                      )}
                                      disabled={saving}
                                      onChange={(e) =>
                                        setFeatureOverride(
                                          feature.feature_key,
                                          "can_edit",
                                          e.target.checked,
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-sm"
                                      checked={getEffective(
                                        feature.feature_key,
                                        "can_delete",
                                      )}
                                      disabled={saving}
                                      onChange={(e) =>
                                        setFeatureOverride(
                                          feature.feature_key,
                                          "can_delete",
                                          e.target.checked,
                                        )
                                      }
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}


                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
