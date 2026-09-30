/**
 * @fileoverview UserForm component.
 * Provides functionality for UserForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { Eye, EyeOff, Building2, X } from "lucide-react";
import { usePermission } from "@/auth/PermissionContext.jsx";
import PhoneInput from "@/components/PhoneInput.jsx";

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function UserForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    companyId: "",
    branchIds: [],
    username: "",
    email: "",
    telephone: "",
    fullName: "",
    password: "",
    isActive: true,
    profilePicture: "",
    isEmployee: false,
    userType: "Internal",
    validFrom: "",
    validTo: "",
    roleId: "",
  });

  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  useEffect(() => {
    fetchDependencies();
    if (isEdit) {
      fetchUser();
    }
  }, [id]);

  async function fetchDependencies() {
    try {
      const [compRes, branchRes, roleRes] = await Promise.all([
        api.get("/admin/companies"),
        api.get("/admin/branches"),
        api
          .get("/access/roles")
          .catch(() => api.get("/admin/roles"))
          .catch(() => ({ data: { items: [] } })),
      ]);
      setCompanies(
        (compRes.data && compRes.data.data && compRes.data.data.items) ||
          compRes.data?.items ||
          [],
      );
      setBranches(
        (branchRes.data && branchRes.data.data && branchRes.data.data.items) ||
          branchRes.data?.items ||
          [],
      );
      setRoles(
        (
          (roleRes.data && roleRes.data.data && roleRes.data.data.items) ||
          roleRes.data?.items ||
          []
        ).map((role) => ({
          id: String(role.id ?? ""),
          company_id:
            role.company_id === null || role.company_id === undefined
              ? ""
              : String(role.company_id),
          name: role.name || role.role_name || role.code || `Role #${role.id}`,
          code: role.code || "",
          is_active: role.is_active,
        })),
      );
    } catch (err) {
      console.error("Error fetching dependencies:", err);
    }
  }

  async function fetchUser() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/admin/users/${id}`);
      if (response.data?.data?.item) {
        const u = response.data.data.item;
        setForm({
          companyId: u.company_id ? String(u.company_id) : "",
          branchIds: u.branch_id ? [String(u.branch_id)] : [],
          username: u.username || "",
          email: u.email || "",
          telephone: u.telephone || "",
          fullName: u.full_name || "",
          isActive: Boolean(u.is_active),
          password: "", // Don't populate password
          profilePicture: u.profile_picture_url || "",
          isEmployee: Boolean(u.is_employee),
          userType: u.user_type || "Internal",
          validFrom: u.valid_from ? u.valid_from.split("T")[0] : "",
          validTo: u.valid_to ? u.valid_to.split("T")[0] : "",
          roleId: u.role_id ? String(u.role_id) : "",
        });
        try {
          const br = await api.get(`/admin/users/${id}/branches`);
          const assigned = Array.isArray(br.data?.data?.items)
            ? br.data.data.items
            : [];
          setForm((prev) => ({
            ...prev,
            branchIds: assigned.map((b) => String(b.id)),
          }));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching user");
    } finally {
      setLoading(false);
    }
  }

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result;
        update("profilePicture", base64);
        setUploading(false);
      };
      reader.onerror = () => {
        setUploading(false);
        setError("Failed to read image");
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload failed", err);
      setError("Failed to read profile picture");
    } finally {
      // handled in reader callbacks
    }
  }

  function validatePassword(pwd) {
    if (!pwd) return true; // Optional on edit
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);

    if (pwd.length < minLength)
      return "Password must be at least 8 characters long.";
    if (!hasUpper)
      return "Password must contain at least one uppercase letter.";
    if (!hasNumber) return "Password must contain at least one number.";
    if (!hasSpecial)
      return "Password must contain at least one special character.";

    return true;
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Password validation
    if (!isEdit || form.password) {
      const pwdValid = validatePassword(form.password);
      if (pwdValid !== true) {
        setError(pwdValid);
        setLoading(false);
        return;
      }
    }

    try {
      const payload = {
        company_id: form.companyId ? Number(form.companyId) : null,
        branch_id: form.branchIds?.[0] ? Number(form.branchIds[0]) : undefined,
        branch_ids: form.branchIds.map((x) => Number(x)),
        username: form.username,
        email: form.email,
        telephone: form.telephone,
        full_name: form.fullName,
        is_active: form.isActive,
        profile_picture: form.profilePicture || null,
        is_employee: form.isEmployee,
        user_type: form.userType,
        valid_from: form.validFrom || null,
        valid_to: form.validTo || null,
        role_id: form.roleId ? Number(form.roleId) : null,
      };

      if (!payload.branch_id) {
        setError("Select at least one branch");
        setLoading(false);
        return;
      }

      if (form.password) {
        payload.password_hash = form.password;
      }

      if (isEdit) {
        await api.put(`/admin/users/${id}`, payload);
      } else {
        await api.post("/admin/users", payload);
      }
      navigate("/administration/users");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving user");
    } finally {
      setLoading(false);
    }
  }

  // Filter branches based on selected company
  const filteredBranches = form.companyId
    ? branches.filter((b) => String(b.company_id) === String(form.companyId))
    : [];

  const superbranches = filteredBranches.filter(
    (b) => Number(b.is_superbranch) === 1,
  );
  const regularBranches = filteredBranches.filter(
    (b) => Number(b.is_superbranch) !== 1,
  );

  // Filter roles based on selected company (assuming roles are company-specific)
  const filteredRoles = roles.filter((r) => {
    if (Number(r.is_active) === 0) return false;
    if (!form.companyId) return true;
    return String(r.company_id || "") === String(form.companyId);
  });

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
        >
          ← Back to Users
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isEdit ? "Edit User" : "New User"}
        </h1>
        <p className="text-sm mt-1">Create and manage system users</p>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            {error && <div className="alert alert-error mb-4">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Company */}
              <div>
                <label className="label">Company *</label>
                <select
                  className="input w-60"
                  value={form.companyId}
                  onChange={(e) => {
                    update("companyId", e.target.value);
                    update("branchIds", []); // Reset branches
                    update("roleId", ""); // Reset role
                  }}
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

              {/* Username */}
              <div>
                <label className="label">Username *</label>
                <input
                  className="input"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="label">Email *</label>
                <input
                  className="input w-60"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                />
              </div>

              {/* Telephone */}
              <div>
                <label className="label ">Telephone</label>
                <PhoneInput
                  className="w-60"
                  value={form.telephone}
                  onChange={(v) => update("telephone", v)}
                  placeholder="234567890"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="label">Full Name *</label>
                <input
                  className="input"
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  required
                />
              </div>

              {/* Role */}
              <div>
                <label className="label">Role</label>
                <select
                  className="input w-60"
                  value={form.roleId}
                  onChange={(e) => update("roleId", e.target.value)}
                  disabled={!form.companyId}
                >
                  <option value="">-- Select Role --</option>
                  {filteredRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* User Type */}
              <div>
                <label className="label">User Type</label>
                <select
                  className="input w-60"
                  value={form.userType}
                  onChange={(e) => update("userType", e.target.value)}
                >
                  <option value="Internal">Internal</option>
                  <option value="External">External</option>
                  <option value="Vendor">Vendor</option>
                  <option value="Customer">Customer</option>
                  <option value="Contractor">Contractor</option>
                </select>
              </div>

              {/* Profile Picture */}
              <div>
                <label className="label">Profile Picture</label>
                <div className="flex items-center gap-3">
                  {form.profilePicture && (
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 flex-shrink-0">
                      <img
                        src={form.profilePicture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <input
                      type="file"
                      className="file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 text-xs text-slate-500 w-full"
                      onChange={handleFileChange}
                      accept="image/*"
                      disabled={uploading}
                    />
                    {uploading && (
                      <span className="text-xs text-brand">Uploading...</span>
                    )}
                  </div>
                </div>
                <input type="hidden" value={form.profilePicture} />
              </div>

              {/* Is Employee & Active Status */}
              <div>
                <label className="label">Status</label>
                <div className="flex flex-col gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isEmployee}
                      onChange={(e) => update("isEmployee", e.target.checked)}
                      className="w-4 h-4 text-brand rounded focus:ring-brand"
                    />
                    <span className="text-sm font-medium">Is Employee</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => update("isActive", e.target.checked)}
                      className="w-4 h-4 text-brand rounded focus:ring-brand"
                    />
                    <span className="text-sm font-medium">Active Status</span>
                  </label>
                </div>
              </div>

              {/* Valid From */}
              <div>
                <label className="label">Valid From</label>
                <input
                  type="date"
                  className="input w-60"
                  value={form.validFrom}
                  onChange={(e) => update("validFrom", e.target.value)}
                  disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>

              {/* Valid To */}
              <div>
                <label className="label">Valid To</label>
                <input
                  type="date"
                  className="input w-60"
                  value={form.validTo}
                  onChange={(e) => update("validTo", e.target.value)}
                  disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>

              {/* Password */}
              <div>
                <label className="label">
                  {isEdit
                    ? "New Password (leave blank to keep current)"
                    : "Password *"}
                </label>
                <div className="relative">
                  <input
                    className="input pr-8 w-60"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    required={!isEdit}
                    placeholder={
                      !isEdit ? "Enter password..." : "Enter new password..."
                    }
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 flex items-center text-slate-500"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Min 8 chars, 1 uppercase, 1 number, 1 special character.
                </p>
              </div>

              {/* Branches - Modal Trigger */}
              <div>
                <label className="label">Branches *</label>
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(true)}
                  className="w-60 text-left px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex justify-between items-center hover:border-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!form.companyId}
                >
                  <span className="text-sm">
                    {form.branchIds.length > 0
                      ? `${form.branchIds.length} branch(es) selected`
                      : form.companyId
                        ? "Click to select branches..."
                        : "Select a company first"}
                  </span>
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </button>
              </div>
            </div>

            {/* Branch Selection Modal */}
            {isBranchModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Assign Branches
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsBranchModalOpen(false)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    {filteredBranches.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No branches available for this company.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Superbranches */}
                        {superbranches.length > 0 && (
                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <div className="bg-brand/5 dark:bg-brand/10 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
                              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                                Superbranches
                              </span>
                            </div>
                            <div className="p-4 space-y-4">
                              {superbranches.map((b) => {
                                const checked = form.branchIds.includes(
                                  String(b.id),
                                );
                                return (
                                  <div key={b.id} className="space-y-2">
                                    <label className="flex items-center gap-3 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4 text-brand rounded focus:ring-brand"
                                        checked={checked}
                                        onChange={(e) => {
                                          const isChecked = e.target.checked;
                                          setForm((prev) => {
                                            const arr = new Set(prev.branchIds);
                                            if (isChecked) {
                                              arr.add(String(b.id));
                                            } else {
                                              arr.delete(String(b.id));
                                              regularBranches.forEach((c) =>
                                                arr.delete(String(c.id)),
                                              );
                                            }
                                            return {
                                              ...prev,
                                              branchIds: Array.from(arr),
                                            };
                                          });
                                        }}
                                      />
                                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                        {b.name}
                                        <span className="ml-2 text-xs font-normal text-slate-500">
                                          ({b.code})
                                        </span>
                                      </span>
                                    </label>
                                    {checked && regularBranches.length > 0 && (
                                      <div className="ml-7 border-l-2 border-brand/20 pl-4 py-1 space-y-2">
                                        <p className="text-xs text-slate-500 font-medium mb-2">
                                          Sub-branches accessible via {b.name}:
                                        </p>
                                        {regularBranches.map((child) => {
                                          const childChecked =
                                            form.branchIds.includes(
                                              String(child.id),
                                            );
                                          return (
                                            <label
                                              key={child.id}
                                              className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                              <input
                                                type="checkbox"
                                                className="w-3.5 h-3.5 text-brand rounded focus:ring-brand"
                                                checked={childChecked}
                                                onChange={(e) => {
                                                  const isChecked =
                                                    e.target.checked;
                                                  setForm((prev) => {
                                                    const arr = new Set(
                                                      prev.branchIds,
                                                    );
                                                    if (isChecked)
                                                      arr.add(String(child.id));
                                                    else
                                                      arr.delete(
                                                        String(child.id),
                                                      );
                                                    return {
                                                      ...prev,
                                                      branchIds:
                                                        Array.from(arr),
                                                    };
                                                  });
                                                }}
                                              />
                                              <span className="text-sm text-slate-700 dark:text-slate-300">
                                                {child.name}{" "}
                                                <span className="text-xs text-slate-400">
                                                  ({child.code})
                                                </span>
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Regular Branches */}
                        {regularBranches.length > 0 && (
                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                Regular Branches
                              </span>
                              <p className="text-xs text-slate-500 mt-0.5">
                                User can switch between these directly from
                                their profile
                              </p>
                            </div>
                            <div className="p-4 space-y-2 max-h-60 overflow-auto">
                              {regularBranches.map((b) => {
                                const checked = form.branchIds.includes(
                                  String(b.id),
                                );
                                return (
                                  <label
                                    key={b.id}
                                    className="flex items-center gap-3 cursor-pointer p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 text-brand rounded focus:ring-brand"
                                      checked={checked}
                                      onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setForm((prev) => {
                                          const arr = new Set(prev.branchIds);
                                          if (isChecked) arr.add(String(b.id));
                                          else arr.delete(String(b.id));
                                          return {
                                            ...prev,
                                            branchIds: Array.from(arr),
                                          };
                                        });
                                      }}
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                      {b.name}{" "}
                                      <span className="text-xs text-slate-400">
                                        ({b.code})
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl flex justify-between items-center flex-shrink-0">
                    <span className="text-sm text-slate-500">
                      {form.branchIds.length} branch(es) selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsBranchModalOpen(false)}
                      className="btn btn-primary px-8"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => window.history.back()} className="btn-success">
                Cancel
              </button>
              <button className="btn-success" type="submit" disabled={loading}>
                {loading ? "Saving..." : isEdit ? "Update User" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
