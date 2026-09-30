/**
 * @fileoverview UserPermissions component.
 * Provides functionality for UserPermissions.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function UserPermissions() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleId, setRoleId] = useState(null);
  const [roleName, setRoleName] = useState("");
  const [roleModules, setRoleModules] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [features, setFeatures] = useState([]);
  const [featureOverrides, setFeatureOverrides] = useState({});
  const [availableModules, setAvailableModules] = useState([]);
  const [moduleFilter, setModuleFilter] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get("/admin/users");
        const d = res?.data;
        let items = [];
        if (Array.isArray(d)) items = d;
        else if (Array.isArray(d?.items)) items = d.items;
        else if (Array.isArray(d?.data?.items)) items = d.data.items;
        else if (Array.isArray(d?.data)) items = d.data;
        setUsers(items);
      } catch {}
    }
    loadUsers();
  }, []);

  async function loadContext(userId) {
    setSelectedUser(userId);
    setLoading(true);
    setError("");
    try {
      const userRes = await api.get(`/admin/users/${userId}`);
      const user = userRes?.data?.data?.item || userRes?.data?.item || null;
      const rId = Number(user?.role_id || user?.role?.id || 0);
      setRoleId(rId || null);
      setRoleName(user?.role_name || "");
      if (rId) {
        const [modsRes, permsRes, featsRes, roleFeatsRes] = await Promise.all([
          api.get(`/access/roles/${rId}/modules`),
          api.get(`/access/roles/${rId}/permissions`),
          api.get(`/access/features`),
          api.get(`/access/roles/${rId}/features`).catch(() => ({
            data: { features: [] },
          })),
        ]);
        const mods = modsRes?.data?.modules || [];
        setRoleModules(mods);
        const permList = permsRes?.data?.permissions || [];
        const byModule = {};
        for (const p of permList) {
          byModule[p.module_key] = {
            can_view: !!p.can_view,
            can_create: !!p.can_create,
            can_edit: !!p.can_edit,
            can_delete: !!p.can_delete,
          };
        }
        setRolePermissions(byModule);
        const allFeatures = featsRes?.data?.features || [];
        const roleFeats = roleFeatsRes?.data?.features || [];
        const registryLabelMap = new Map();
        Object.entries(MODULES_REGISTRY).forEach(([mKey, mod]) => {
          (mod.features || []).forEach((f) => {
            registryLabelMap.set(`${mKey}:${f.key}`, f.label);
          });
        });

        const filtered = allFeatures
          .filter(
            (f) =>
              mods.includes(f.module_key) &&
              roleFeatSet.has(String(f.feature_key)),
          )
          .map((feature) => {
            const updatedLabel = registryLabelMap.get(feature.feature_key) || feature.label;
            return { ...feature, label: updatedLabel };
          });
        setFeatures(filtered);
        setAvailableModules(
          Array.from(new Set(filtered.map((f) => f.module_key))),
        );
        setModuleFilter(new Set());
      } else {
        setRoleModules([]);
        setRolePermissions({});
        setFeatures([]);
        setAvailableModules([]);
        setModuleFilter(new Set());
      }
      // Overrides removed; default to empty
      setFeatureOverrides({});
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function setFeatureOverride(fk, key, val) {
    setFeatureOverrides((prev) => {
      const next = { ...prev };
      const row = next[fk] || {
        can_view: null,
        can_create: null,
        can_edit: null,
        can_delete: null,
      };
      row[key] = val;
      next[fk] = row;
      return next;
    });
  }

  async function save() {
    try {
      const allowed = new Set(roleModules);
      const payload = features
        .filter((f) => allowed.has(f.module_key))
        .map((f) => ({
          feature_key: f.feature_key,
          module_key: f.module_key,
          can_view: !!featureOverrides[f.feature_key]?.can_view,
          can_create: !!featureOverrides[f.feature_key]?.can_create,
          can_edit: !!featureOverrides[f.feature_key]?.can_edit,
          can_delete: !!featureOverrides[f.feature_key]?.can_delete,
        }));
      await api.put(`/access/users/${selectedUser}/feature-overrides`, {
        overrides: payload,
      });
      setSuccess("Permissions saved successfully");
      await loadContext(selectedUser);
      setTimeout(() => {
        setSuccess("");
      }, 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save");
    }
  }

  function display(val) {
    if (val == null) return "—";
    return val ? "Yes" : "No";
  }

  function toggleModuleFilter(mk, checked) {
    setModuleFilter((prev) => {
      const next = new Set(prev);
      if (checked) next.add(mk);
      else next.delete(mk);
      return next;
    });
  }

  const visibleFeatures = features.filter((f) =>
    moduleFilter.size === 0 ? true : moduleFilter.has(f.module_key),
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Permissions</h1>
          <p className="text-sm text-slate-600">
            Set per-user CRUD permissions for module features and dashboards
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => navigate("/administration?section=Audit%20%26%20Logs")}
          >
            Back to Menu
          </button>
          {selectedUser ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setFeatureOverrides((prev) => {
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
                save();
              }}
            >
              Grant All
            </button>
          ) : null}
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
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Select User</label>
              <select
                className="input"
                value={selectedUser || ""}
                onChange={(e) => loadContext(Number(e.target.value))}
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
              <label className="label">Role Default</label>
              <div className="p-2 border rounded bg-slate-50 dark:bg-slate-800">
                {roleId ? (roleName || `Role #${roleId}`) : "No role assigned"}
              </div>
            </div>
          </div>

          {availableModules.length > 0 && (
            <div className="border rounded p-3">
              <div className="font-medium mb-2">Filter by Module</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {availableModules.map((mk) => (
                  <label key={mk} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={moduleFilter.has(mk)}
                      onChange={(e) => toggleModuleFilter(mk, e.target.checked)}
                    />
                    <span className="text-sm">{mk}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div>Loading...</div>
          ) : selectedUser ? (
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
                  {visibleFeatures.map((f) => {
                    const mk = f.module_key;
                    const roleRow = rolePermissions[mk] || {};
                    const overrideRow = featureOverrides[f.feature_key] || {};
                    return (
                      <tr key={f.feature_key}>
                        <td className="p-3 font-medium text-center truncate">{f.label}</td>
                        <td className="p-3 text-center truncate">{mk}</td>
                        <td className="p-3 text-center truncate">{f.type}</td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            disabled={!roleModules.includes(mk)}
                            checked={
                              typeof overrideRow.can_view === "boolean"
                                ? overrideRow.can_view
                                : !!roleRow.can_view
                            }
                            onChange={(e) =>
                              setFeatureOverride(
                                f.feature_key,
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
                            disabled={!roleModules.includes(mk)}
                            checked={
                              typeof overrideRow.can_create === "boolean"
                                ? overrideRow.can_create
                                : !!roleRow.can_create
                            }
                            onChange={(e) =>
                              setFeatureOverride(
                                f.feature_key,
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
                            disabled={!roleModules.includes(mk)}
                            checked={
                              typeof overrideRow.can_edit === "boolean"
                                ? overrideRow.can_edit
                                : !!roleRow.can_edit
                            }
                            onChange={(e) =>
                              setFeatureOverride(
                                f.feature_key,
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
                            disabled={!roleModules.includes(mk)}
                            checked={
                              typeof overrideRow.can_delete === "boolean"
                                ? overrideRow.can_delete
                                : !!roleRow.can_delete
                            }
                            onChange={(e) =>
                              setFeatureOverride(
                                f.feature_key,
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
              <div className="flex justify-end mt-4">
                <button className="btn btn-success" onClick={save}>
                  Save
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
