/**
 * @fileoverview RoleDefaultPermissions component.
 * Provides functionality for RoleDefaultPermissions.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function RoleDefaultPermissions() {
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [assignedModules, setAssignedModules] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInitial() {
      try {
        const [rolesRes] = await Promise.all([api.get("/access/roles")]);
        setRoles(rolesRes?.data?.items || []);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load");
      }
    }
    loadInitial();
  }, []);

  async function onPickRole(roleId) {
    setSelectedRole(roleId);
    setLoading(true);
    setError("");
    try {
      const [modsRes, permsRes] = await Promise.all([
        api.get(`/access/roles/${roleId}/modules`),
        api.get(`/access/roles/${roleId}/permissions`),
      ]);
      const mods = modsRes?.data?.modules || [];
      setAssignedModules(mods);
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
      setPermissions(byModule);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function savePermissions() {
    try {
      const payload = assignedModules.map((mk) => ({
        module_key: mk,
        can_view: !!permissions[mk]?.can_view,
        can_create: !!permissions[mk]?.can_create,
        can_edit: !!permissions[mk]?.can_edit,
        can_delete: !!permissions[mk]?.can_delete,
      }));
      await api.put(`/access/roles/${selectedRole}/permissions`, {
        permissions: payload,
      });
      alert("Saved");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save");
    }
  }

  function toggle(mk, key) {
    setPermissions((prev) => {
      const next = { ...prev };
      const row = next[mk] || {
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      };
      row[key] = !row[key];
      next[mk] = row;
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role Default Permissions</h1>
          <p className="text-sm text-slate-600">
            Define CRUD defaults per module
          </p>
        </div>
        <button onClick={() => window.history.back()} className="btn btn-secondary">
          Back to Menu
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-body space-y-4">
          <div>
            <label className="label">Select Role</label>
            <select
              className="input"
              value={selectedRole || ""}
              onChange={(e) => onPickRole(Number(e.target.value))}
            >
              <option value="">Choose role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <div>Loading...</div>
          ) : selectedRole ? (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th className="text-center w-24">View</th>
                    <th className="text-center w-24">Create</th>
                    <th className="text-center w-24">Edit</th>
                    <th className="text-center w-24">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedModules.map((mk) => {
                    const row = permissions[mk] || {};
                    return (
                      <tr key={mk}>
                        <td className="p-3 font-medium">{mk}</td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={!!row.can_view}
                            onChange={() => toggle(mk, "can_view")}
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={!!row.can_create}
                            onChange={() => toggle(mk, "can_create")}
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={!!row.can_edit}
                            onChange={() => toggle(mk, "can_edit")}
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={!!row.can_delete}
                            onChange={() => toggle(mk, "can_delete")}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex justify-end mt-4">
                <button className="btn btn-success" onClick={savePermissions}>
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
