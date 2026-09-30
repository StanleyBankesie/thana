/**
 * @fileoverview BranchForm component.
 * Provides functionality for BranchForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "api/client";
import { useAuth } from "@/auth/AuthContext.jsx";

function generateBranchCode(name) {
  if (!name) return "";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.map(w => w[0]).join("").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  }
  return name.trim().slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function BranchForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const isSystemConfig = location.pathname.startsWith("/system-configuration");
  const backPath = isSystemConfig ? "/system-configuration/branches" : "/administration/branches";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    company_id: 1,
    code: "",
    name: "",
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
    stock_upload_user_id: "",
  });
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers();
    if (!isEdit) return;
    fetchBranch();
  }, [id]);

  async function fetchUsers() {
    try {
      const res = await api.get("/admin/users");
      setUsers(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {}
  }

  async function fetchBranch() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/admin/branches/${id}`);
      if (response.data?.item) {
        const item = response.data.item;
        setForm({
          company_id: item.company_id,
          code: item.code,
          name: item.name,
          isActive: Boolean(item.is_active),
          is_superbranch: Boolean(Number(item.is_superbranch)),
          address: item.address || "",
          city: item.city || "",
          state: item.state || "",
          postal_code: item.postal_code || "",
          country: item.country || "",
          location: item.location || "",
          telephone: item.telephone || "",
          email: item.email || "",
          remarks: item.remarks || "",
          stock_upload_user_id: item.stock_upload_user_id ? String(item.stock_upload_user_id) : "",
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching branch");
    } finally {
      setLoading(false);
    }
  }

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        company_id: form.company_id,
        name: form.name,
        code: form.code,
        is_active: form.isActive ? 1 : 0,
        is_superbranch: form.is_superbranch ? 1 : 0,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        postal_code: form.postal_code || null,
        country: form.country || null,
        location: form.location || null,
        telephone: form.telephone || null,
        email: form.email || null,
        remarks: form.remarks || null,
        stock_upload_user_id: form.stock_upload_user_id ? Number(form.stock_upload_user_id) : null,
      };
      if (isEdit) {
        await api.put(`/admin/branches/${id}`, payload);
      } else {
        await api.post("/admin/branches", payload);
      }
      navigate(backPath);
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving branch");
    } finally {
      setLoading(false);
    }
  }

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
    <div className="space-y-6 [&::-webkit-scrollbar]:hidden">
      <div>
        <Link
          to={backPath}
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
        >
          ← Back to Branches
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isEdit ? "Edit Branch" : "New Branch"}
        </h1>
        <p className="text-sm mt-1">Branch profile</p>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Company ID</label>
                <input
                  className="input"
                  type="number"
                  value={form.company_id}
                  onChange={(e) =>
                    update("company_id", parseInt(e.target.value) || 1)
                  }
                  disabled
                />
              </div>
              <div>
                <label className="label">Code *</label>
                <input
                  className="input"
                  value={form.code}
                  onChange={(e) => update("code", e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => {
                    const nameVal = e.target.value;
                    update("name", nameVal);
                    if (!isEdit) {
                      update("code", generateBranchCode(nameVal));
                    }
                  }}
                  required
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={form.isActive ? "1" : "0"}
                  onChange={(e) => update("isActive", e.target.value === "1")}
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>

              {/* Superbranch toggle */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_superbranch}
                  onClick={() => update("is_superbranch", !form.is_superbranch)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                    form.is_superbranch ? "bg-brand" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.is_superbranch ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <div>
                  <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer" onClick={() => update("is_superbranch", !form.is_superbranch)}>
                    Superbranch
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {form.is_superbranch
                      ? "Users assigned here can also be given access to child branches."
                      : "This is a regular standalone branch."}
                  </p>
                </div>
              </div>

              <div>
                <label className="label">Address</label>
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Location</label>
                <input
                  className="input"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                />
              </div>
              <div>
                <label className="label">City</label>
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </div>
              <div>
                <label className="label">State / Region</label>
                <input
                  className="input"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Postal Code</label>
                <input
                  className="input"
                  value={form.postal_code}
                  onChange={(e) => update("postal_code", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Country</label>
                <input
                  className="input"
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Telephone</label>
                <input
                  className="input"
                  value={form.telephone}
                  onChange={(e) => update("telephone", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Remarks</label>
                <textarea
                  className="input"
                  rows={3}
                  value={form.remarks}
                  onChange={(e) => update("remarks", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Stock Upload &amp; Opening Balances — Allowed User</label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Only the selected user (plus system admin) will be allowed to access Stock Upload and Opening Balances pages.
                </p>
                <select
                  className="input"
                  value={form.stock_upload_user_id}
                  onChange={(e) => update("stock_upload_user_id", e.target.value)}
                >
                  <option value="">-- Any authorised user --</option>
                  {users.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.username || u.name || `User #${u.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Saving..." : isEdit ? "Update Branch" : "Create Branch"}
              </button>
              <Link to={backPath} className="btn btn-secondary">
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
