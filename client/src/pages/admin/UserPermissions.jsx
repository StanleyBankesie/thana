/**
 * @fileoverview UserPermissions component.
 * Allows administrators to assign granular action-level permissions (view, create, edit, delete) to roles.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import { MODULES_REGISTRY } from "../../data/modulesRegistry.js";
import { usePermission } from "../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";

/**
 * UserPermissions component
 * Manages detailed action-based permissions for features assigned to roles.
 * 
 * @returns {JSX.Element} The user permissions page.
 */
export default function UserPermissions() {
  const navigate = useNavigate();
  const { refreshPermissions } = usePermission();
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleModules, setRoleModules] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const moduleHierarchy = MODULES_REGISTRY;

  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    try {
      const res = await api.get("/admin/roles");
      setRoles(res.data || []);
    } catch (err) {
      setError("Failed to load roles");
    }
  }

  async function loadRolePermissions(roleId) {
    setLoading(true);
    try {
      const [modulesRes, permissionsRes] = await Promise.all([
        api.get(`/admin/role-modules/${roleId}`),
        api.get(`/admin/role-permissions/${roleId}`),
      ]);

      setRoleModules(modulesRes.data || []);
      setRolePermissions(permissionsRes.data || []);
    } catch (err) {
      setError("Failed to load role permissions");
      setRoleModules([]);
      setRolePermissions([]);
    } finally {
      setLoading(false);
    }
  }

  function handleRoleSelect(roleId) {
    const role = roles.find((r) => Number(r.id) === Number(roleId));
    setSelectedRole(role);
    loadRolePermissions(roleId);
  }

  // Ensure all features have permissions when role is selected
  useEffect(() => {
    if (selectedRole) {
      const allFeatureKeys = [];

      // Collect all feature keys from module hierarchy (excluding exclusive ones)
      Object.entries(moduleHierarchy).forEach(([moduleKey, module]) => {
        (module.features || []).filter(f => !f.isExclusive).forEach((feature) => {
          allFeatureKeys.push(`${moduleKey}:${feature.key}`);
        });
        (module.dashboards || []).filter(d => !d.isExclusive).forEach((dashboard) => {
          allFeatureKeys.push(`${moduleKey}:${dashboard.key}`);
        });
      });

      // Create missing permissions
      setRolePermissions((prev) => {
        const existingKeys = new Set(prev.map((p) => p.feature_key));
        const missingPermissions = [];

        allFeatureKeys.forEach((featureKey) => {
          if (!existingKeys.has(featureKey)) {
            const [moduleKey] = featureKey.split(":");
            missingPermissions.push({
              role_id: selectedRole.id,
              module_key: moduleKey,
              feature_key: featureKey,
              can_view: false,
              can_create: false,
              can_edit: false,
              can_delete: false,
            });
          }
        });

        return [...prev, ...missingPermissions];
      });
    }
  }, [selectedRole]);

  function getPermissionValue(featureKey, action) {
    const permission = rolePermissions.find(
      (p) => p.feature_key === featureKey,
    );
    return permission ? permission[action] : false;
  }

  function handlePermissionChange(featureKey, action, value) {
    setRolePermissions((prev) => {
      const existing = prev.find((p) => p.feature_key === featureKey);
      if (existing) {
        return prev.map((p) =>
          p.feature_key === featureKey ? { ...p, [action]: value } : p,
        );
      } else {
        const [moduleKey] = featureKey.split(":");
        return [
          ...prev,
          {
            role_id: selectedRole.id,
            module_key: moduleKey,
            feature_key: featureKey,
            can_view: action === "can_view" ? value : false,
            can_create: action === "can_create" ? value : false,
            can_edit: action === "can_edit" ? value : false,
            can_delete: action === "can_delete" ? value : false,
          },
        ];
      }
    });
  }

  async function savePermissions() {
    if (!selectedRole) return;

    setLoading(true);
    try {
      await api.post("/admin/role-permissions", {
        permissions: rolePermissions,
      });
      try {
        window.dispatchEvent(new Event("rbac:changed"));
      } catch {}
      try {
        await refreshPermissions();
      } catch {}
      setSuccess("Permissions saved successfully");
      toast.success("Permissions saved successfully");
      setTimeout(() => setSuccess(""), 1500);
      navigate("/administration/access/user-permissions");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save permissions");
    } finally {
      setLoading(false);
    }
  }

  function getVisibleModules() {
    return Object.entries(moduleHierarchy);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Permissions</h1>
          <p className="text-sm text-slate-600">
            Assign action-level permissions for role features
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => navigate("/admin")}
        >
          Back to Admin
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Role Selection */}
      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-4">Select Role</h2>
          <div className="max-w-md">
            <label className="label">Role</label>
            <select
              className="input"
              value={selectedRole?.id || ""}
              onChange={(e) => handleRoleSelect(Number(e.target.value))}
            >
              <option value="">Choose a role...</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} ({role.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Permission Grid */}
      {selectedRole && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">
                Permissions for: {selectedRole.name}
              </h2>
              <button
                className="btn btn-success"
                onClick={savePermissions}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Permissions"}
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8">Loading permissions...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Feature</th>
                      <th className="text-center w-20">View</th>
                      <th className="text-center w-20">Create</th>
                      <th className="text-center w-20">Edit</th>
                      <th className="text-center w-20">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getVisibleModules().map(([moduleKey, module]) => {
                      const isModuleAssigned = roleModules.some(
                        (m) => String(m.module_key) === String(moduleKey),
                      );
                      const moduleFeatures = Array.isArray(module?.features)
                        ? module.features.filter(f => !f.isExclusive)
                        : [];
                      const moduleDashboards = Array.isArray(module?.dashboards)
                        ? module.dashboards.filter(d => !d.isExclusive)
                        : [];

                      return (
                        <React.Fragment key={moduleKey}>
                          {/* Features */}
                          {moduleFeatures.map((feature) => {
                            const featureKey = `${moduleKey}:${feature.key}`;
                            let permission = rolePermissions.find(
                              (p) => p.feature_key === featureKey,
                            );

                            // Create default permission if not exists
                            if (!permission) {
                              permission = {
                                role_id: selectedRole.id,
                                module_key: moduleKey,
                                feature_key: featureKey,
                                can_view: false,
                                can_create: false,
                                can_edit: false,
                                can_delete: false,
                              };
                            }

                            return (
                              <tr key={featureKey}>
                                <td className="font-medium">
                                  {module.icon} {module.name}
                                </td>
                                <td>{feature.label}</td>
                                <td className="text-center">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={permission.can_view}
                                    disabled={!isModuleAssigned}
                                    onChange={(e) =>
                                      handlePermissionChange(
                                        featureKey,
                                        "can_view",
                                        e.target.checked,
                                      )
                                    }
                                  />
                                </td>
                                <td className="text-center">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={permission.can_create}
                                    disabled={!isModuleAssigned}
                                    onChange={(e) =>
                                      handlePermissionChange(
                                        featureKey,
                                        "can_create",
                                        e.target.checked,
                                      )
                                    }
                                  />
                                </td>
                                <td className="text-center">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={permission.can_edit}
                                    disabled={!isModuleAssigned}
                                    onChange={(e) =>
                                      handlePermissionChange(
                                        featureKey,
                                        "can_edit",
                                        e.target.checked,
                                      )
                                    }
                                  />
                                </td>
                                <td className="text-center">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={permission.can_delete}
                                    disabled={!isModuleAssigned}
                                    onChange={(e) =>
                                      handlePermissionChange(
                                        featureKey,
                                        "can_delete",
                                        e.target.checked,
                                      )
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}

                          {/* Dashboards */}
                          {moduleDashboards.map((dashboard) => {
                            const dashboardKey = `${moduleKey}:${dashboard.key}`;
                            let permission = rolePermissions.find(
                              (p) => p.feature_key === dashboardKey,
                            );

                            // Create default permission if not exists
                            if (!permission) {
                              permission = {
                                role_id: selectedRole.id,
                                module_key: moduleKey,
                                feature_key: dashboardKey,
                                can_view: false,
                                can_create: false,
                                can_edit: false,
                                can_delete: false,
                              };
                            }

                            return (
                              <tr key={dashboardKey}>
                                <td className="font-medium">
                                  {module.icon} {module.name}
                                </td>
                                <td className="italic">{dashboard.label}</td>
                                <td className="text-center">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={permission.can_view}
                                    disabled={!isModuleAssigned}
                                    onChange={(e) =>
                                      handlePermissionChange(
                                        dashboardKey,
                                        "can_view",
                                        e.target.checked,
                                      )
                                    }
                                  />
                                </td>
                                <td className="text-center" colSpan="3">
                                  <span className="text-xs text-slate-500">
                                    Dashboard - View only
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>

                {rolePermissions.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No permissions configured for this role. Please configure
                    the role in Role Setup first.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
