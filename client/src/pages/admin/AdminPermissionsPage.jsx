import React, { useState, useEffect } from "react";
import { api } from "../../api/client.js";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import { MODULES_REGISTRY } from "../../data/modulesRegistry.js";

import { ArrowLeft } from "lucide-react";

export default function AdminPermissionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSystemConfig = location.pathname.startsWith("/system-configuration");
  const moduleHome = isSystemConfig ? "/system-configuration" : "/administration";
  
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [superAdminId, setSuperAdminId] = useState(1);

  // Form State
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedFeature, setSelectedFeature] = useState("");

  useEffect(() => {
    fetchConfig();
    fetchUsers();
    fetchPermissions();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await api.get("/licenses/super-admin").catch(() => null);
      if (res?.data?.superAdminId) {
        setSuperAdminId(parseInt(res.data.superAdminId, 10));
      }
    } catch (err) {}
  };

  const fetchUsers = async () => {
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
      toast.error(err?.response?.data?.message || err.message || "Failed to load users");
    }
  };

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/exclusive-permissions");
      setPermissions(res.data?.items || []);
    } catch (err) {
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  };

  // Ensure only super admin can view
  if (user?.id !== superAdminId) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
        <p className="mt-4">Only Super Admin can access this page.</p>
        <button className="btn mt-6" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedUser || !selectedModule || !selectedFeature) {
      toast.error("Please select a user, module, and feature");
      return;
    }
    setLoading(true);
    try {
      await api.post("/admin/exclusive-permissions", {
        user_id: selectedUser,
        module_key: selectedModule,
        feature_key: `${selectedModule}:${selectedFeature}`
      });
      toast.success("Permission granted successfully");
      window.dispatchEvent(new Event("rbac:changed"));
      setSelectedModule("");
      setSelectedFeature("");
      fetchPermissions();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to grant permission");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to revoke this permission?")) return;
    setLoading(true);
    try {
      await api.delete(`/admin/exclusive-permissions/${id}`);
      toast.success("Permission revoked");
      window.dispatchEvent(new Event("rbac:changed"));
      fetchPermissions();
    } catch (err) {
      toast.error("Failed to remove permission");
    } finally {
      setLoading(false);
    }
  };

  const exclusiveModules = Object.keys(MODULES_REGISTRY).filter(mKey => 
    (MODULES_REGISTRY[mKey]?.features || []).some(f => f.isExclusive)
  );

  const availableFeatures = selectedModule 
    ? (MODULES_REGISTRY[selectedModule]?.features || []).filter(f => f.isExclusive) 
    : [];

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Permissions</h1>
          <p className="text-gray-500 text-sm mt-1">
            Exclusively grant specific pages to specific users. These pages will be hidden from Role Setup.
          </p>
        </div>
        <button
          onClick={() => navigate(moduleHome)}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Menu
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="card p-4">
            <h2 className="text-lg font-semibold mb-4">Grant Permission</h2>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="label">User</label>
                <select
                  className="input"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  required
                >
                  <option value="">Select User...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Module</label>
                <select
                  className="input"
                  value={selectedModule}
                  onChange={(e) => {
                    setSelectedModule(e.target.value);
                    setSelectedFeature("");
                  }}
                  required
                >
                  <option value="">Select Module...</option>
                  {exclusiveModules.map(mKey => (
                    <option key={mKey} value={mKey}>
                      {MODULES_REGISTRY[mKey].name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedModule && (
                <div>
                  <label className="label">Page (Feature)</label>
                  <select
                    className="input"
                    value={selectedFeature}
                    onChange={(e) => setSelectedFeature(e.target.value)}
                    required
                  >
                    <option value="">Select Page...</option>
                    {availableFeatures.map(f => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-success w-full mt-4"
              >
                {loading ? "Saving..." : "Grant Permission"}
              </button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="card">
            <div className="overflow-x-auto">
              <table className="table table-fixed w-full">
                <thead>
                  <tr>
                    <th className="w-1/5">User</th>
                    <th className="w-1/5">Module</th>
                    <th className="w-1/5">Feature (Page)</th>
                    <th className="w-1/5">Granted On</th>
                    <th className="w-1/5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-4 text-gray-500">
                        No exclusive page permissions found.
                      </td>
                    </tr>
                  ) : (
                    permissions.map(p => (
                      <tr key={p.id}>
                        <td>
                          {p.full_name} <br/>
                          <span className="text-xs text-gray-500">@{p.username}</span>
                        </td>
                        <td>{MODULES_REGISTRY[p.module_key]?.name || p.module_key}</td>
                        <td>
                          {
                            MODULES_REGISTRY[p.module_key]?.features?.find(f => f.key === p.feature_key.split(':')[1])?.label 
                            || p.feature_key.split(':')[1]
                          }
                        </td>
                        <td>{new Date(p.created_at).toLocaleString()}</td>
                        <td className="text-right">
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-red-500 hover:text-red-700"
                            disabled={loading}
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
