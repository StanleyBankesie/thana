/**
 * @fileoverview RoleManagementNew component.
 * Provides functionality for RoleManagementNew.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import {
  MODULES_REGISTRY,
  getAllModuleKeys,
  getModuleFeatures,
} from "../../../../data/modulesRegistry.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function RoleManagementNew() {
  const [roles, setRoles] = useState([]);
  const [exclusiveFeatures, setExclusiveFeatures] = useState(new Set());
  const {
    sorted: rolesSorted,
    sortKey,
    sortDir,
    toggle,
  } = useSort(roles, "name", "asc");
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshPermissions, licensedModules: allowedModules } = usePermission();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState({
    name: "",
    code: "",
    is_active: true,
  });
  const [assignRole, setAssignRole] = useState(null);
  const [editRole, setEditRole] = useState({
    name: "",
    code: "",
    is_active: true,
  });

  const isModuleAllowed = (moduleKey) => {
    if (!allowedModules || allowedModules.size === 0) return true;
    if (allowedModules.has("*")) return true;
    if (moduleKey === "administration") return true; // Always allow administration
    return allowedModules.has(moduleKey);
  };

  // Permission states
  const [selectedModules, setSelectedModules] = useState(new Set());
  const [selectedFeatures, setSelectedFeatures] = useState(new Set());

  function handleModuleSelectAll(moduleKey, checked) {
    // Ensure module is enabled when selecting all
    if (checked && !selectedModules.has(moduleKey)) {
      handleModuleToggle(moduleKey, true);
    }

    const moduleFeatures = getModuleFeatures(moduleKey);

    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      for (const f of moduleFeatures) {
        if (checked) next.add(f.feature_key);
        else next.delete(f.feature_key);
      }
      return next;
    });
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rolesRes] = await Promise.all([
        api.get("/access/roles")
      ]);
      setRoles(rolesRes?.data?.items || []);
      
      const exclSet = new Set();
      for (const mk of Object.keys(MODULES_REGISTRY)) {
        const mod = MODULES_REGISTRY[mk];
        if (mod.features) {
          for (const f of mod.features) {
            if (f.isExclusive) {
              exclSet.add(`${mk}:${f.key}`);
            }
          }
        }
      }
      setExclusiveFeatures(exclSet);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const s = location.state && location.state.afterSave;
    if (!s || s.entity !== "roles") return;
    load();
    setTimeout(() => load(), 500);
    try {
      navigate("/administration/access/roles", { replace: true, state: null });
    } catch {}
  }, [location.state, navigate]);

  async function createRole() {
    try {
      const payload = {
        name: String(newRole.name || "").trim(),
        code: String(newRole.code || "").trim(),
        is_active: !!newRole.is_active,
      };
      if (!payload.name || !payload.code) {
        setError("Name and code are required");
        return;
      }
      await api.post("/access/roles", payload);
      setShowCreate(false);
      setNewRole({ name: "", code: "", is_active: true });
      setSuccess("Role created successfully");
      await load();
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create role");
    }
  }

  async function deleteRole(id) {
    if (!window.confirm("Delete role? This cannot be undone.")) return;
    try {
      await api.delete(`/access/roles/${id}`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete role");
    }
  }

  async function openRoleSettings(role) {
    try {
      const [modsRes, featsRes] = await Promise.all([
        api.get(`/access/roles/${role.id}/modules`),
        api
          .get(`/access/roles/${role.id}/features`)
          .catch(() => ({ data: { features: [] } })),
      ]);

      const assignedModules = new Set(modsRes?.data?.modules || []);
      const assignedFeatures = new Set(
        (featsRes?.data?.features || []).map(String),
      );

      setAssignRole(role);
      setEditRole({
        name: role.name || "",
        code: role.code || "",
        is_active: !!role.is_active,
      });
      setSelectedModules(assignedModules);
      setSelectedFeatures(assignedFeatures);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load role settings");
    }
  }

  async function saveRoleSettings() {
    try {
      setLoading(true);
      setError("");
      if (assignRole) {
        const payload = {
          name: String(editRole.name || "").trim(),
          code: String(editRole.code || "").trim(),
          is_active: !!editRole.is_active,
        };
        if (!payload.name || !payload.code) {
          setError("Name and code are required");
          setLoading(false);
          return;
        }
        await api.put(`/access/roles/${assignRole.id}`, payload);
        setAssignRole((prev) => (prev ? { ...prev, ...payload } : prev));
      }

      // Save modules
      await api.put(`/access/roles/${assignRole.id}/modules`, {
        modules: Array.from(selectedModules),
      });

      const allPermissions = Array.from(selectedFeatures).filter(fk => {
        const parts = String(fk || "").split(":");
        return parts.length >= 1 && selectedModules.has(parts[0]);
      });

      // Sync adm_role_permissions for permByFeatureKey to work
      const permPayload = [];
      for (const fk of allPermissions) {
        const parts = String(fk || "").split(":");
        if (parts.length >= 2) {
          permPayload.push({
            module_key: parts[0],
            feature_key: parts.slice(1).join(":"),
            can_view: 1,
            can_create: 1,
            can_edit: 1,
            can_delete: 1,
          });
        }
      }
      
      await Promise.all([
        api.put(`/access/roles/${assignRole.id}/features`, {
          features: allPermissions,
        }),
        api.put(`/access/roles/${assignRole.id}/permissions`, {
          permissions: permPayload,
        })
      ]);

      setSuccess("Role permissions updated successfully");
      toast.success("Role permissions updated successfully");
      try {
        window.dispatchEvent(new Event("rbac:changed"));
      } catch {}
      try {
        await refreshPermissions();
      } catch {}

      // Update role in list without full refetch
      if (assignRole) {
          setRoles((prev) =>
            prev.map((r) =>
              r.id === assignRole.id
                ? { ...r, name: editRole.name, code: editRole.code, is_active: editRole.is_active }
                : r
            )
          );
      }

      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save role settings");
    } finally {
      setLoading(false);
    }
  }

  // Handle module selection with hierarchy enforcement
  function handleModuleToggle(moduleKey, checked) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(moduleKey);
      } else {
        next.delete(moduleKey);
        // Remove all features when module is deselected
        const moduleFeatures = getModuleFeatures(moduleKey);

        setSelectedFeatures((featurePrev) => {
          const nextFeatures = new Set(featurePrev);
          moduleFeatures.forEach((f) => nextFeatures.delete(f.feature_key));
          return nextFeatures;
        });
      }
      return next;
    });
  }

  // Handle feature selection with module dependency
  function handleFeatureToggle(featureKey, checked) {
    const [moduleKey] = featureKey.split(":");
    if (!selectedModules.has(moduleKey)) {
      // Auto-select module if feature is selected
      handleModuleToggle(moduleKey, true);
    }

    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(featureKey);
      } else {
        next.delete(featureKey);
      }
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role Setup</h1>
          <p className="text-sm text-slate-600">
            Create roles and assign module and feature permissions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate("/administration")}
          >
            Back to Menu
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setShowCreate(true)}
            data-rbac-exempt="true"
          >
            Create Role
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && (
        <div className="alert alert-success flex justify-between items-center">
          <span>{success}</span>
          <button
            className="btn-outline"
            type="button"
            onClick={() => setSuccess("")}
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="card">
          <div className="card-body">
            <table className="table w-full">
              <thead>
                <tr>
                  <SortableHeader
                    label="Name"
                    sortKey="name"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="is_active"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rolesSorted.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.is_active ? "Active" : "Inactive"}</td>
                    <td className="text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => openRoleSettings(r)}
                        >
                          Configure Permissions
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg shadow max-w-lg w-full">
            <div className="px-5 py-4 border-b dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold dark:text-white">Create Role</h2>
              <button
                className="btn-outline"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={newRole.name}
                  onChange={(e) =>
                    setNewRole({ ...newRole, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Code</label>
                <input
                  className="input"
                  value={newRole.code}
                  onChange={(e) =>
                    setNewRole({ ...newRole, code: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={newRole.is_active}
                  onChange={(e) =>
                    setNewRole({ ...newRole, is_active: e.target.checked })
                  }
                />
                <span className="text-sm font-medium">Active</span>
              </div>
            </div>
            <div className="px-5 py-4 border-t dark:border-slate-700 flex justify-end gap-2">
              <button
                className="btn-outline"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                className="btn-success"
                type="button"
                onClick={createRole}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Settings Modal */}
      {assignRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow max-w-6xl w-full max-h-[90vh] flex flex-col border dark:border-slate-700">
            <div className="px-5 py-4 border-b dark:border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold dark:text-white">Configure Permissions</h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">{editRole.name}</span>
              </div>
              <button
                className="btn-outline"
                type="button"
                onClick={() => setAssignRole(null)}
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-6 overflow-y-auto flex-1">
              {/* Role Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="label">Role Name</label>
                  <input
                    className="input"
                    value={editRole.name}
                    onChange={(e) =>
                      setEditRole((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Role Code</label>
                  <input
                    className="input"
                    value={editRole.code}
                    onChange={(e) =>
                      setEditRole((prev) => ({ ...prev, code: e.target.value }))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={editRole.is_active}
                      onChange={(e) =>
                        setEditRole((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                </div>
              </div>

              {/* Modules Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>📦</span>
                  Modules
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {getAllModuleKeys()
                    .filter(isModuleAllowed)
                    .map((moduleKey) => {
                    const moduleInfo = MODULES_REGISTRY[moduleKey];
                    return (
                      <label
                        key={moduleKey}
                        className="flex items-center gap-3 p-3 border dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedModules.has(moduleKey)}
                          onChange={(e) =>
                            handleModuleToggle(moduleKey, e.target.checked)
                          }
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{moduleInfo?.icon}</span>
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
              <div className="space-y-6">
                {getAllModuleKeys()
                  .filter(isModuleAllowed)
                  .map((moduleKey) => {
                  const moduleInfo = MODULES_REGISTRY[moduleKey];
                  const isModuleSelected = selectedModules.has(moduleKey);
                  const moduleFeatures = getModuleFeatures(moduleKey).filter(f => !exclusiveFeatures.has(f.feature_key));
                  const allKeys = moduleFeatures.map((f) => f.feature_key);
                  const selectedCount = allKeys.filter((k) =>
                    selectedFeatures.has(k),
                  ).length;
                  const isAllSelected =
                    allKeys.length > 0 && selectedCount === allKeys.length;

                  if (!isModuleSelected && moduleFeatures.length === 0) {
                    return null;
                  }

                  return (
                    <div key={moduleKey} className="border dark:border-slate-700 rounded-lg">
                      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={isModuleSelected}
                            onChange={(e) =>
                              handleModuleToggle(moduleKey, e.target.checked)
                            }
                          />
                          <span className="font-semibold text-lg">
                            {moduleInfo?.icon} {moduleInfo?.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>{moduleFeatures.length} features</span>
                          {isModuleSelected && allKeys.length > 0 && (
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={isAllSelected}
                                onChange={(e) =>
                                  handleModuleSelectAll(
                                    moduleKey,
                                    e.target.checked,
                                  )
                                }
                              />
                              Select All
                            </label>
                          )}
                        </div>
                      </div>

                      {isModuleSelected && moduleFeatures.length > 0 && (
                        <div className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {moduleFeatures.map((feature) => (
                              <label
                                key={feature.feature_key}
                                className="flex items-center gap-2 p-2 border dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={selectedFeatures.has(
                                    feature.feature_key,
                                  )}
                                  onChange={(e) =>
                                    handleFeatureToggle(
                                      feature.feature_key,
                                      e.target.checked,
                                    )
                                  }
                                />
                                <span className="text-sm">{feature.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-4 border-t dark:border-slate-700 flex justify-end gap-2">
              <button
                className="btn-outline"
                type="button"
                onClick={() => setAssignRole(null)}
              >
                Cancel
              </button>
              <button
                className="btn-success"
                type="button"
                onClick={saveRoleSettings}
              >
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
