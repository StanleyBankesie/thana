/**
 * @fileoverview RoleSetup component.
 * Interface for creating and managing roles, and assigning module, feature, and dashboard access.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import { usePermission } from "../../auth/PermissionContext.jsx";
import { MODULES_REGISTRY } from "../../data/modulesRegistry.js";
import { toast } from "react-toastify";

/**
 * RoleSetup component
 * Allows administrators to define roles and configure their hierarchical permissions.
 * 
 * @returns {JSX.Element} The role setup page.
 */
export default function RoleSetup() {
  const navigate = useNavigate();
  const { refreshPermissions, licensedModules: allowedModules } = usePermission();
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleModules, setRoleModules] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState({
    name: "",
    code: "",
    is_active: true,
  });
  const [editRole, setEditRole] = useState({
    name: "",
    code: "",
    is_active: true,
  });

  // Module hierarchy state
  const [selectedModules, setSelectedModules] = useState(new Set());
  const [selectedFeatures, setSelectedFeatures] = useState(new Set());
  const [selectedDashboards, setSelectedDashboards] = useState(new Set());
  const [selectedHomeDashboards, setSelectedHomeDashboards] = useState(
    new Set(),
  );

  const HOME_DASHBOARDS = [
    {
      key: "total-customers",
      label: "Total Customers",
    },
  ];

  const moduleHierarchy = Object.entries(MODULES_REGISTRY).reduce(
    (acc, [moduleKey, module]) => {
      acc[moduleKey] = {
        name: module.name,
        icon: module.icon,
        features: (module.features || [])
          .filter((feature) => !feature.isExclusive)
          .map((feature) => ({
            key: feature.key,
            label: feature.label,
          })),
        dashboards: (module.dashboards || [])
          .filter((dashboard) => !dashboard.isExclusive)
          .map((dashboard) => ({
            key: dashboard.key,
            label: dashboard.label,
          })),
      };
      return acc;
    },
    {},
  );

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

  async function createRole() {
    try {
      if (!newRole.name || !newRole.code) {
        const msg = "Name and code are required";
        setError(msg);
        toast.error(msg);
        return;
      }
      await api.post("/admin/roles", newRole);
      setShowCreate(false);
      setNewRole({ name: "", code: "", is_active: true });
      setSuccess("Role created successfully");
      toast.success("Role created successfully");
      loadRoles();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to create role";
      setError(msg);
      toast.error(msg);
    }
  }

  async function updateRole() {
    try {
      if (!editRole.name || !editRole.code) {
        const msg = "Name and code are required";
        setError(msg);
        toast.error(msg);
        return;
      }
      await api.put(`/admin/roles/${selectedRole.id}`, editRole);
      setSuccess("Role updated successfully");
      toast.success("Role updated successfully");
      loadRoles();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to update role";
      setError(msg);
      toast.error(msg);
    }
  }

  async function loadRoleDetails(roleId) {
    setLoading(true);
    try {
      // Load hierarchical permissions instead of separate endpoints
      const permissionsRes = await api.get(
        `/access/roles/${roleId}/permissions`,
      );
      const permissions = permissionsRes.data?.permissions || {};

      const roleFeaturesRes = await api.get(`/admin/role-features/${roleId}`);
      const roleFeats = Array.isArray(roleFeaturesRes.data)
        ? roleFeaturesRes.data
        : [];

      // Set selected state based on hierarchical permissions
      const selectedMods = new Set();
      const selectedFeats = new Set();
      const selectedDashboards = new Set();
      const selectedHome = new Set();

      // Process hierarchical permissions
      Object.entries(permissions).forEach(([moduleKey, moduleData]) => {
        if (moduleData.enabled) {
          selectedMods.add(moduleKey);

          // Process features
          if (moduleData.features) {
            Object.entries(moduleData.features).forEach(
              ([featureKey, isEnabled]) => {
                if (isEnabled) {
                  selectedFeats.add(`${moduleKey}:${featureKey}`);
                }
              },
            );
          }

          // Process dashboards
          if (moduleData.dashboards) {
            Object.entries(moduleData.dashboards).forEach(
              ([dashboardKey, isEnabled]) => {
                if (isEnabled) {
                  selectedDashboards.add(`${moduleKey}:${dashboardKey}`);
                }
              },
            );
          }
        }
      });

      setSelectedModules(selectedMods);
      setSelectedFeatures(selectedFeats);
      setSelectedDashboards(selectedDashboards);
      for (const rf of roleFeats) {
        const k = String(rf || "").trim();
        if (k.startsWith("home:")) selectedHome.add(k);
      }
      setSelectedHomeDashboards(selectedHome);
    } catch (err) {
      setError("Failed to load role details");
    } finally {
      setLoading(false);
    }
  }

  function handleModuleSelectAll(moduleKey, checked) {
    const newSelectedModules = new Set(selectedModules);
    const newSelectedFeatures = new Set(selectedFeatures);
    const newSelectedDashboards = new Set(selectedDashboards);
    const module = moduleHierarchy[moduleKey];
    if (!module) return;

    newSelectedModules.add(moduleKey);
    for (const f of module.features || []) {
      const k = `${moduleKey}:${f.key}`;
      if (checked) newSelectedFeatures.add(k);
      else newSelectedFeatures.delete(k);
    }
    for (const d of module.dashboards || []) {
      const k = `${moduleKey}:${d.key}`;
      if (checked) newSelectedDashboards.add(k);
      else newSelectedDashboards.delete(k);
    }

    setSelectedModules(newSelectedModules);
    setSelectedFeatures(newSelectedFeatures);
    setSelectedDashboards(newSelectedDashboards);
  }

  function handleHomeDashboardToggle(homeKey, checked) {
    const k = `home:${homeKey}`;
    const next = new Set(selectedHomeDashboards);
    if (checked) next.add(k);
    else next.delete(k);
    setSelectedHomeDashboards(next);
  }

  function handleRoleSelect(role) {
    setSelectedRole(role);
    setEditRole({
      name: role.name,
      code: role.code,
      is_active: role.is_active,
    });
    loadRoleDetails(role.id);
  }

  function handleModuleToggle(moduleKey, checked) {
    const newSelectedModules = new Set(selectedModules);
    const newSelectedFeatures = new Set(selectedFeatures);
    const newSelectedDashboards = new Set(selectedDashboards);

    if (checked) {
      newSelectedModules.add(moduleKey);
    } else {
      newSelectedModules.delete(moduleKey);
      // Auto-uncheck all features and dashboards when module is unchecked
      const module = moduleHierarchy[moduleKey];
      module.features.forEach((f) =>
        newSelectedFeatures.delete(`${moduleKey}:${f.key}`),
      );
      module.dashboards.forEach((d) =>
        newSelectedDashboards.delete(`${moduleKey}:${d.key}`),
      );
    }

    setSelectedModules(newSelectedModules);
    setSelectedFeatures(newSelectedFeatures);
    setSelectedDashboards(newSelectedDashboards);
  }

  function handleFeatureToggle(featureKey, checked) {
    const [moduleKey] = featureKey.split(":");
    const newSelectedModules = new Set(selectedModules);
    const newSelectedFeatures = new Set(selectedFeatures);

    if (checked) {
      // Auto-select module if feature is selected
      newSelectedModules.add(moduleKey);
      newSelectedFeatures.add(featureKey);
    } else {
      newSelectedFeatures.delete(featureKey);
    }

    setSelectedModules(newSelectedModules);
    setSelectedFeatures(newSelectedFeatures);
  }

  function handleDashboardToggle(dashboardKey, checked) {
    const [moduleKey] = dashboardKey.split(":");
    const newSelectedModules = new Set(selectedModules);
    const newSelectedDashboards = new Set(selectedDashboards);

    if (checked) {
      // Auto-select module if dashboard is selected
      newSelectedModules.add(moduleKey);
      newSelectedDashboards.add(dashboardKey);
    } else {
      newSelectedDashboards.delete(dashboardKey);
    }

    setSelectedModules(newSelectedModules);
    setSelectedDashboards(newSelectedDashboards);
  }

  async function saveRoleAssignments() {
    if (!selectedRole) return;

    setLoading(true);
    try {
      const roleId = Number(selectedRole.id);

      await api.post("/admin/role-modules", {
        role_id: roleId,
        modules: Array.from(selectedModules),
      });

      const featureKeys = Array.from(
        new Set([
        ...Array.from(selectedFeatures),
        ...Array.from(selectedDashboards),
        ...Array.from(selectedHomeDashboards),
        ]),
      );

      // Save features AFTER modules (sequential, not parallel) to guarantee
      // that the role-features endpoint overrides the auto-inserted features from role-modules.
      await api.post("/admin/role-features", {
        role_id: roleId,
        features: featureKeys,
      });
      await api.post("/admin/role-permissions", {
        role_id: roleId,
        feature_keys: featureKeys,
      });

      setSuccess("Role saved successfully");
      toast.success("Role permissions saved successfully");
      setTimeout(() => setSuccess(""), 2000);
      try {
        window.dispatchEvent(new Event("rbac:changed"));
      } catch {}
      try {
        // Refresh permissions BEFORE navigating so new perms are active immediately
        await refreshPermissions();
      } catch {}
      navigate("/administration/access/roles");
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to save assignments";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role Setup</h1>
          <p className="text-sm text-slate-600">
            Create roles and assign module permissions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => navigate("/admin")}
          >
            Back to Admin
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
      {success && <div className="alert alert-success">{success}</div>}

      {/* Roles List */}
      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-4">Roles</h2>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr
                    key={role.id}
                    className={selectedRole?.id === role.id ? "bg-blue-50" : ""}
                  >
                    <td className="font-medium">{role.name}</td>
                    <td>{role.code}</td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          role.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {role.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleRoleSelect(role)}
                        >
                          Configure
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setEditRole({
                              name: role.name,
                              code: role.code,
                              is_active: role.is_active,
                            });
                            setSelectedRole(role);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Role Configuration */}
      {selectedRole && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">
                  Configure: {selectedRole.name}
                </h2>
                <div className="flex gap-4 mt-2">
                  <input
                    type="text"
                    className="input"
                    placeholder="Role Name"
                    value={editRole.name}
                    onChange={(e) =>
                      setEditRole({ ...editRole, name: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Role Code"
                    value={editRole.code}
                    onChange={(e) =>
                      setEditRole({ ...editRole, code: e.target.value })
                    }
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={editRole.is_active}
                      onChange={(e) =>
                        setEditRole({
                          ...editRole,
                          is_active: e.target.checked,
                        })
                      }
                    />
                    Active
                  </label>
                  <button className="btn btn-secondary" onClick={updateRole}>
                    Update Role
                  </button>
                </div>
              </div>
              <button
                className="btn btn-success"
                onClick={saveRoleAssignments}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Role"}
              </button>
            </div>

            {/* Module Hierarchy */}
            <div className="space-y-6">
              {Object.entries(moduleHierarchy)
                .filter(
                  ([moduleKey]) =>
                    allowedModules.has(moduleKey) ||
                    moduleKey === "administration" ||
                    moduleKey === "dashboard"
                )
                .map(([moduleKey, module]) => {
                  const isModuleSelected = selectedModules.has(moduleKey);
                  const totalCount =
                    (module.features?.length || 0) + (module.dashboards?.length || 0);
                  let selectedCount = 0;

                  (module.features || []).forEach((f) => {
                    if (selectedFeatures.has(`${moduleKey}:${f.key}`))
                      selectedCount++;
                  });
                  (module.dashboards || []).forEach((d) => {
                    if (selectedDashboards.has(`${moduleKey}:${d.key}`))
                      selectedCount++;
                  });

                  const isAllSelected =
                    totalCount > 0 && selectedCount === totalCount;

                return (
                  <div key={moduleKey} className="border rounded-lg">
                    <div className="px-4 py-3 bg-slate-50 border-b">
                      <div className="flex items-center justify-between gap-4">
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={isModuleSelected}
                            onChange={(e) =>
                              handleModuleToggle(moduleKey, e.target.checked)
                            }
                          />
                          <span className="font-semibold text-lg">
                            {module.icon} {module.name}
                          </span>
                        </label>
                        {isModuleSelected && (
                          <label className="flex items-center gap-2 text-sm">
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

                    {isModuleSelected && (
                      <div className="p-4 space-y-4">
                        {/* Features */}
                        <div>
                          <h4 className="font-medium mb-3">Features:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {module.features.map((feature) => {
                              const featureKey = `${moduleKey}:${feature.key}`;
                              const isSelected =
                                selectedFeatures.has(featureKey);

                              return (
                                <label
                                  key={feature.key}
                                  className="flex items-center gap-2"
                                >
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={isSelected}
                                    onChange={(e) =>
                                      handleFeatureToggle(
                                        featureKey,
                                        e.target.checked,
                                      )
                                    }
                                  />
                                  <span className="text-sm">
                                    {feature.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Dashboards */}
                        <div>
                          <h4 className="font-medium mb-3">Dashboards:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {module.dashboards.map((dashboard) => {
                              const dashboardKey = `${moduleKey}:${dashboard.key}`;
                              const isSelected =
                                selectedDashboards.has(dashboardKey);

                              return (
                                <label
                                  key={dashboard.key}
                                  className="flex items-center gap-2"
                                >
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={isSelected}
                                    onChange={(e) =>
                                      handleDashboardToggle(
                                        dashboardKey,
                                        e.target.checked,
                                      )
                                    }
                                  />
                                  <span className="text-sm">
                                    {dashboard.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border rounded-lg">
              <div className="px-4 py-3 bg-slate-50 border-b">
                <div className="font-semibold text-lg">Homepage Dashboards</div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {HOME_DASHBOARDS.map((d) => {
                    const allowKey = `home:${d.key}`;
                    const checked = selectedHomeDashboards.has(allowKey);
                    return (
                      <label key={d.key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={checked}
                          onChange={(e) =>
                            handleHomeDashboardToggle(d.key, e.target.checked)
                          }
                        />
                        <span className="text-sm">{d.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow max-w-md w-full">
            <div className="px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Create New Role</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Role Name</label>
                <input
                  type="text"
                  className="input"
                  value={newRole.name}
                  onChange={(e) =>
                    setNewRole({ ...newRole, name: e.target.value })
                  }
                  placeholder="e.g., Sales Manager"
                />
              </div>
              <div>
                <label className="label">Role Code</label>
                <input
                  type="text"
                  className="input"
                  value={newRole.code}
                  onChange={(e) =>
                    setNewRole({ ...newRole, code: e.target.value })
                  }
                  placeholder="e.g., SALES_MANAGER"
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
                <span className="text-sm">Active</span>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={createRole}>
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
