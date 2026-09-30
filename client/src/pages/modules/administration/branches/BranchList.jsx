/**
 * @fileoverview BranchList component.
 * Provides functionality for BranchList.
 */

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "api/client";
import "../../../../styles/BranchSetup.css";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useAuth } from "@/auth/AuthContext.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

// Sub-component for User Assignment
function UserAssignmentTab({ branches, companies, onUpdate }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignForm, setAssignForm] = useState({
    companyId: "",
    branchIds: [],
  });
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/users");
      setUsers(res.data.items || []);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = async (user) => {
    setSelectedUser(user);
    const base = {
      companyId: user.company_id || "",
      branchIds: user.branch_id ? [String(user.branch_id)] : [],
    };
    try {
      const res = await api.get(`/admin/users/${user.id}/branches`);
      const ids = Array.isArray(res.data?.items)
        ? res.data.items.map((b) => String(b.id))
        : [];
      setAssignForm({ ...base, branchIds: ids });
    } catch {
      setAssignForm(base);
    }
    setAssignModalOpen(true);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    setAssignLoading(true);
    try {
      await api.put(`/admin/users/${selectedUser.id}/branches`, {
        company_id: assignForm.companyId,
        branch_ids: assignForm.branchIds.map((x) => Number(x)),
      });
      await fetchUsers(); // Refresh local list
      if (onUpdate) onUpdate(); // Refresh parent stats if needed
      setAssignModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      alert("Failed to update user branch: " + err.message);
    } finally {
      setAssignLoading(false);
    }
  };

  // Filter branches for assignment modal
  const filteredBranches = assignForm.companyId
    ? branches.filter(
        (b) => String(b.company_id) === String(assignForm.companyId)
      )
    : [];

  const filteredUsers = (() => {
    if (!searchTerm.trim()) return users.slice();
    return filterAndSort(users, {
      query: searchTerm,
      getKeys: (u) => [u.username, u.email, u.full_name],
    });
  })();

  return (
    <div>
      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={fetchUsers}>
          🔄 Refresh Users
        </button>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-8 text-center">Loading users...</div>
        ) : (
          <>
          <div className="flex justify-end mb-4">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
          <table className={"branch-table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <th>User</th>
                <th>Current Company</th>
                <th>Current Branch</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-4">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="font-medium">{u.username}</div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </td>
                    <td>{u.company_name || "Unassigned"}</td>
                    <td>{u.branch_name || "Unassigned"}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => openAssignModal(u)}
                      >
                        Assign Branch
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </>
        )}
      </div>

      {assignModalOpen && (
        <div className="branch-modal-overlay">
          <div className="branch-modal" style={{ maxWidth: "500px" }}>
            <div className="branch-modal-header">
              <h2>Assign Branch to {selectedUser?.username}</h2>
              <button
                className="branch-close-btn"
                onClick={() => setAssignModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="branch-modal-body">
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Company
                  </label>
                  <select
                    className="search-input w-full"
                    value={assignForm.companyId}
                    onChange={(e) =>
                      setAssignForm({
                        ...assignForm,
                        companyId: e.target.value,
                        branchId: "",
                      })
                    }
                    required
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Branches
                  </label>
                  <div className="space-y-2 max-h-64 overflow-auto border rounded-md p-2">
                    {filteredBranches.map((b) => {
                      const checked = assignForm.branchIds.includes(
                        String(b.id)
                      );
                      return (
                        <label key={b.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={checked}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setAssignForm((prev) => {
                                const set = new Set(prev.branchIds);
                                if (isChecked) set.add(String(b.id));
                                else set.delete(String(b.id));
                                return {
                                  ...prev,
                                  branchIds: Array.from(set),
                                };
                              });
                            }}
                            disabled={!assignForm.companyId}
                          />
                          <span className="text-sm">{b.name}</span>
                        </label>
                      );
                    })}
                    {!assignForm.companyId ? (
                      <div className="text-xs text-gray-500">
                        Select a company to view branches
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="branch-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAssignModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={assignLoading}
                >
                  {assignLoading ? "Saving..." : "Save Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function BranchList() {
  const [viewMode, setViewMode] = useViewMode();
  const { user } = useAuth();
  const location = useLocation();
  const isSystemConfig = location.pathname.startsWith("/system-configuration");
  const moduleHome = isSystemConfig ? "/system-configuration" : "/administration";
  const [activeTab, setActiveTab] = useState("branches"); // Default to branches as requested by sync task
  const [branches, setBranches] = useState([]);
  const [companies, setCompanies] = useState([]); // Store companies for dropdown
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentBranch, setCurrentBranch] = useState(null); // null for new, object for edit
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    companyId: "",
    name: "",
    code: "",
    isActive: true,
    is_superbranch: false,
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    location: "",
    telephone: "",
    email: "",
    remarks: "",
  });

  // Stats (derived or mock)
  const stats = {
    totalBranches: branches.length,
    activeBranches: branches.filter((b) => b.is_active).length,
    activeUsers: 0, // Placeholder
    assignments: 0, // Placeholder
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [branchesRes, companiesRes] = await Promise.all([
        api.get("/admin/branches"),
        api.get("/admin/companies"),
      ]);
      setBranches(branchesRes.data.items || []);
      setCompanies(companiesRes.data.items || []);
    } catch (err) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      // Refresh only branches after update
      const res = await api.get("/admin/branches");
      setBranches(res.data.items || []);
    } catch (err) {
      console.error("Failed to refresh branches", err);
    }
  };

  const openModal = (branch = null) => {
    setCurrentBranch(branch);
    if (branch) {
      setFormData({
        companyId: branch.company_id,
        name: branch.name,
        code: branch.code,
        isActive: branch.is_active,
        is_superbranch: Boolean(Number(branch.is_superbranch)),
        address: branch.address || "",
        city: branch.city || "",
        state: branch.state || "",
        postal_code: branch.postal_code || "",
        country: branch.country || "",
        location: branch.location || "",
        telephone: branch.telephone || "",
        email: branch.email || "",
        remarks: branch.remarks || "",
      });
    } else {
      setFormData({
        companyId: "",
        name: "",
        code: "",
        isActive: true,
        is_superbranch: false,
        address: "",
        city: "",
        state: "",
        postal_code: "",
        country: "",
        location: "",
        telephone: "",
        email: "",
        remarks: "",
      });
    }
    setModalError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentBranch(null);
    setModalError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError("");

    try {
      if (currentBranch) {
        // Update
        await api.put(`/admin/branches/${currentBranch.id}`, {
          company_id: formData.companyId,
          name: formData.name,
          code: formData.code,
          is_active: formData.isActive ? 1 : 0,
          is_superbranch: formData.is_superbranch ? 1 : 0,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          postal_code: formData.postal_code || null,
          country: formData.country || null,
          location: formData.location || null,
          telephone: formData.telephone || null,
          email: formData.email || null,
          remarks: formData.remarks || null,
        });
      } else {
        // Create
        await api.post("/admin/branches", {
          company_id: formData.companyId,
          name: formData.name,
          code: formData.code,
          is_active: formData.isActive ? 1 : 0,
          is_superbranch: formData.is_superbranch ? 1 : 0,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          postal_code: formData.postal_code || null,
          country: formData.country || null,
          location: formData.location || null,
          telephone: formData.telephone || null,
          email: formData.email || null,
          remarks: formData.remarks || null,
        });
      }
      await fetchBranches();
      closeModal();
    } catch (err) {
      setModalError(
        err?.response?.data?.message || err.message || "Failed to save branch"
      );
    } finally {
      setModalLoading(false);
    }
  };

  if (Number(user?.id) !== 1) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">
          You do not have permission to view the Branch Setup page.
        </p>
      </div>
    );
  }

  return (
    <div className="branch-setup-container">
      <div className="branch-header">
        <div>
          <h1>🏢 Branch Management System</h1>
        </div>
        <div className="header-actions">
          <Link to={moduleHome} className="btn btn-secondary">
            Return to Menu
          </Link>
          <button
            className="btn btn-primary"
            onClick={() => fetchBranches()}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="branch-content">
        {/* Branch Management Tab */}
        <div className="tab-content active">
          <div className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Search branches..."
            />
            <button className="btn btn-success" onClick={() => openModal(null)}>
              ➕ Add New Branch
            </button>
          </div>

          <div className="table-container">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : error ? (
              <div className="p-8 text-center text-red-500">{error}</div>
            ) : (
              <table className={"branch-table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Actions</th>
                    <th>Created By</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center">
                        No branches found.
                      </td>
                    </tr>
                  ) : (
                    branches.map((b) => (
                      <tr key={b.id}>
                        <td>{b.code}</td>
                        <td>{b.name}</td>
                        <td>{b.company_name}</td>
                        <td>
                          <span
                            className={`badge ${
                              b.is_active ? "badge-success" : "badge-danger"
                            }`}
                          >
                            {b.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => openModal(b)}
                          >
                            Edit
                          </button>
                        </td>
                        <td>{b.created_by_name || "-"}</td>
                        <td>{b.created_at ? new Date(b.created_at).toLocaleDateString() : "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="branch-modal-overlay">
          <div className="branch-modal">
            <div className="branch-modal-header">
              <h2>{currentBranch ? "Edit Branch" : "New Branch"}</h2>
              <button className="branch-close-btn" onClick={closeModal}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="branch-modal-body">
                {modalError && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {modalError}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Company *
                  </label>
                  <select
                    className="search-input w-full"
                    value={formData.companyId}
                    onChange={(e) =>
                      setFormData({ ...formData, companyId: e.target.value })
                    }
                    required
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Code *
                  </label>
                  <input
                    type="text"
                    className="search-input w-full"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    className="search-input w-full"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Status
                  </label>
                  <select
                    className="search-input w-full"
                    value={formData.isActive ? "1" : "0"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isActive: e.target.value === "1",
                      })
                    }
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>

                <div className="mb-4 flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.is_superbranch}
                    onClick={(e) => { e.preventDefault(); setFormData({ ...formData, is_superbranch: !formData.is_superbranch }); }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                      formData.is_superbranch ? "bg-brand" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        formData.is_superbranch ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <div>
                    <label className="text-sm font-semibold text-slate-800 cursor-pointer" onClick={(e) => { e.preventDefault(); setFormData({ ...formData, is_superbranch: !formData.is_superbranch }); }}>
                      Superbranch
                    </label>
                    <p className="text-xs text-slate-500">
                      Users assigned here can also be given access to child branches.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.postal_code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          postal_code: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Telephone
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.telephone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          telephone: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      className="search-input w-full"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Remarks
                    </label>
                    <textarea
                      className="search-input w-full"
                      rows="3"
                      value={formData.remarks}
                      onChange={(e) =>
                        setFormData({ ...formData, remarks: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="branch-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={modalLoading}
                >
                  {modalLoading ? "Saving..." : "Save Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
