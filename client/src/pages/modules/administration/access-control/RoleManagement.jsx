/**
 * @fileoverview RoleManagement component.
 * Provides functionality for RoleManagement.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { 
  MODULES_REGISTRY, 
  getAllModuleKeys, 
  getModuleFeatures, 
  getModuleDashboards 
} from "../../../../data/modulesRegistry.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function RoleManagement() {
  const navigate = useNavigate();
  const { refreshPermissions } = usePermission();
  const [roles, setRoles] = useState([]);
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

  // Permission states
  const [selectedModules, setSelectedModules] = useState(new Set());
  const [selectedFeatures, setSelectedFeatures] = useState(new Set());
  const [selectedDashboards, setSelectedDashboards] = useState(new Set());

  function displayFeatureLabel(f) {
    try {
      const mk = String(f?.module_key || "");
      const key = String(f?.feature_key || "");
      const path = String(f?.path || "");
      if (mk === "administration") {
        if (
          key === "administration:users" ||
          path.startsWith("/administration/users")
        ) {
          return "User Management";
        }
      }
      return String(f?.label || "");
    } catch {
      return String(f?.label || "");
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rolesRes, modRes] = await Promise.all([
        api.get("/access/roles"),
        api.get("/access/modules"),
      ]);
      setRoles(rolesRes?.data?.items || []);
      setModules(modRes?.data?.modules || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
      setTimeout(() => {
        setSuccess("");
      }, 2000);
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

  async function openAssignModules(role) {
    try {
      const [modsRes, roleFeatsRes] = await Promise.all([
        api.get(`/access/roles/${role.id}/modules`),
        api.get(`/access/roles/${role.id}/features`).catch(() => ({
          data: { features: [] },
        })),
      ]);
      const list = modsRes?.data?.modules || [];
      const registry = {
        administration: administrationFeatures,
        purchase: purchaseFeatures,
        sales: salesFeatures,
        inventory: inventoryFeatures,
        finance: financeFeatures,
        "human-resources": humanResourcesFeatures,
        maintenance: maintenanceFeatures,
        production: productionFeatures,
        "project-management": projectManagementFeatures,
        "business-intelligence": businessIntelligenceFeatures,
        pos: posFeatures,
        "service-management": serviceManagementFeatures,
      };
      const feats = Object.entries(registry).flatMap(([mk, arr]) =>
        (arr || []).map((f) => ({
          ...f,
          feature_key: `${mk}:${
            String(f.path || "")
              .replace(/^\/+/, "")
              .split("/")
              .slice(1)
              .join("-") || "root"
          }`,
          module_key: mk,
        })),
      );
      const roleFeats = Array.isArray(roleFeatsRes?.data?.features)
        ? roleFeatsRes.data.features
        : [];
      setAssignRole(role);
      setEditRole({
        name: role.name || "",
        code: role.code || "",
        is_active: !!role.is_active,
      });
      setAssignModules(new Set(list));
      setFeatures(feats);
      setAssignFeatures(new Set(roleFeats.map(String)));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load role modules");
    }
  }

  async function saveRoleSettings() {
    try {
      setError("");
      if (assignRole) {
        const payload = {
          name: String(editRole.name || "").trim(),
          code: String(editRole.code || "").trim(),
          is_active: !!editRole.is_active,
        };
        if (!payload.name || !payload.code) {
          setError("Name and code are required");
          return;
        }
        await api.put(`/access/roles/${assignRole.id}`, payload);
        setAssignRole((prev) => (prev ? { ...prev, ...payload } : prev));
      }
      await api.put(`/access/roles/${assignRole.id}/modules`, {
        modules: Array.from(assignModules),
      });
      await api.put(`/access/roles/${assignRole.id}/features`, {
        features: Array.from(assignFeatures),
      });
      setSuccess("Role modules and features updated");
      try {
        window.dispatchEvent(new Event("rbac:changed"));
      } catch {}
      try {
        await refreshPermissions();
      } catch {}
      await load();
      try {
        const currentRole = assignRole
          ? {
              ...assignRole,
              name: String(editRole.name || "").trim(),
              code: String(editRole.code || "").trim(),
              is_active: !!editRole.is_active,
            }
          : null;
        if (currentRole) await openRoleSettings(currentRole);
      } catch {}
      setTimeout(() => {
        setSuccess("");
      }, 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save role settings");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-sm text-slate-600">
            Create roles and assign modules
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => navigate("/administration")}
          >
            Back to Menu
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            Create Role
          </button>
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
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="card">
          <div className="card-body">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.is_active ? "Active" : "Inactive"}</td>
                    <td className="text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          className="btn btn-secondary"
                          onClick={() => openAssignModules(r)}
                        >
                          Assign Modules
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

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow max-w-lg w-full">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Create Role</h2>
              <button
                className="btn-outline"
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
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button
                className="btn-outline"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button className="btn-success" onClick={createRole}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {assignRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Assign Modules</h2>
              </div>
              <button
                className="btn-outline"
                onClick={() => setAssignRole(null)}
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-6 overflow-y-auto">
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
              <div>
                <div className="font-medium mb-2">Modules</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {modules.map((mk) => (
                    <label key={mk} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={assignModules.has(mk)}
                        onChange={(e) => {
                          setAssignModules((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(mk);
                            else next.delete(mk);
                            return next;
                          });
                        }}
                      />
                      <span className="text-sm">{mk}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-medium mb-2">
                  Module Features, Dashboards and Cards
                </div>
                <div className="space-y-4">
                  {modules.map((mk) => {
                    const group = features.filter((f) => f.module_key === mk);
                    if (group.length === 0) return null;
                    const assigned = assignModules.has(mk);
                    const allSelected = group.every((f) =>
                      assignFeatures.has(String(f.feature_key)),
                    );
                    return (
                      <div key={mk} className="border rounded">
                        <div className="px-3 py-2 font-semibold bg-slate-50 flex items-center justify-between">
                          <span>{mk}</span>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              disabled={!assigned}
                              checked={assigned && allSelected}
                              onChange={(e) => {
                                const check = e.target.checked;
                                setAssignFeatures((prev) => {
                                  const next = new Set(prev);
                                  for (const f of group) {
                                    const key = String(f.feature_key);
                                    if (check) next.add(key);
                                    else next.delete(key);
                                  }
                                  return next;
                                });
                              }}
                            />
                            <span className="text-xs">Select all</span>
                          </label>
                        </div>
                        <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {group.map((f) => (
                            <label
                              key={f.feature_key}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                disabled={!assigned}
                                checked={assignFeatures.has(
                                  String(f.feature_key),
                                )}
                                onChange={(e) => {
                                  setAssignFeatures((prev) => {
                                    const next = new Set(prev);
                                    const key = String(f.feature_key);
                                    if (e.target.checked) next.add(key);
                                    else next.delete(key);
                                    return next;
                                  });
                                }}
                              />
                              <span className="text-sm">
                                {displayFeatureLabel(f)}
                              </span>
                              <span className="text-xs text-slate-500">
                                ({f.type})
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button
                className="btn-outline"
                onClick={() => setAssignRole(null)}
              >
                Cancel
              </button>
              <button className="btn-success" onClick={saveRoleSettings}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
