/**
 * @fileoverview AccountGroupsPage component.
 * Standard Modern UI Chart of Accounts Groups Setup for managing account classification hierarchy.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { filterAndSort } from "@/utils/searchUtils.js";
import { 
  FolderTree, 
  ArrowLeft, 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Save, 
  X,
  Layers,
  Trash2
} from "lucide-react";

export default function AccountGroupsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [natureFilter, setNatureFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [showTotals, setShowTotals] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nature, setNature] = useState("");
  const [parentId, setParentId] = useState("");
  const [editId, setEditId] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editNature, setEditNature] = useState("");
  const [editParentId, setEditParentId] = useState("");

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/finance/account-groups", {
        params: {
          search: searchTerm || null,
          nature: natureFilter || null,
          active: activeFilter || null,
          includeTotals: showTotals ? "1" : "0",
        },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load account groups",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, natureFilter, activeFilter, showTotals]);

  const handleNameOrNatureChange = (newName, newNature, newParentId) => {
    const n = newName !== undefined ? newName : name;
    const nat = newNature !== undefined ? newNature : nature;
    const pId = newParentId !== undefined ? newParentId : parentId;

    if (newName !== undefined) setName(newName);
    if (newNature !== undefined) setNature(newNature);
    if (newParentId !== undefined) setParentId(newParentId);

    if (nat) {
      const parent = pId ? items.find((g) => String(g.id) === String(pId)) : null;
      const makeToken = (s) => String(s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
      const part = makeToken(n) || "GRP";
      if (parent && parent.code) {
        setCode(`${parent.code}.${part}`);
      } else {
        const base =
          nat === "ASSET"
            ? "AST"
            : nat === "LIABILITY"
              ? "LIA"
              : nat === "EQUITY"
                ? "EQU"
                : nat === "INCOME"
                  ? "INC"
                  : "EXP";
        setCode(`${base}_${part}`);
      }
    }
  };

  async function create(e) {
    e.preventDefault();
    try {
      if (!name.trim()) {
        toast.error("Group Name is required");
        return;
      }
      if (!nature) {
        toast.error("Nature is required");
        return;
      }

      await api.post("/finance/account-groups", {
        code: code ? code.trim().toUpperCase() : null,
        name: name.trim(),
        nature,
        parentId: parentId ? Number(parentId) : null,
        isActive: 1,
      });

      toast.success("Account group created successfully");
      setCode("");
      setName("");
      setNature("");
      setParentId("");
      setShowCreateModal(false);
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to create group");
    }
  }

  async function handleDeleteGroup(id, groupName) {
    if (!window.confirm(`Are you sure you want to permanently delete account group "${groupName}"?`)) {
      return;
    }
    try {
      setLoading(true);
      await api.delete(`/finance/account-groups/${id}`);
      toast.success("Account group deleted successfully");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete account group");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(id, isActive) {
    try {
      setLoading(true);
      await api.put(`/finance/account-groups/${id}/active`, {
        isActive: Number(Boolean(isActive)),
      });
      toast.success("Status updated");
      await load();
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to update active status",
      );
    } finally {
      setLoading(false);
    }
  }

  function startEdit(g) {
    setEditId(String(g.id));
    setEditCode(g.code || "");
    setEditName(g.name || "");
    setEditNature(g.nature || "");
    setEditParentId(g.parent_id ? String(g.parent_id) : "");
  }

  function cancelEdit() {
    setEditId("");
    setEditCode("");
    setEditName("");
    setEditNature("");
    setEditParentId("");
  }

  async function saveEdit() {
    try {
      setLoading(true);
      const payload = {
        code: editCode,
        name: editName,
        nature: editNature,
        parentId: editParentId ? Number(editParentId) : null,
      };
      await api.put(`/finance/account-groups/${editId}`, payload);
      toast.success("Group updated successfully");
      cancelEdit();
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update group");
    } finally {
      setLoading(false);
    }
  }

  const rankedItems = useMemo(() => {
    const q = String(searchTerm || "").trim();
    if (!q) return items.slice();
    return filterAndSort(items, {
      query: q,
      getKeys: (g) => [g.code, g.name],
    });
  }, [items, searchTerm]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <Link
                to="/finance?section=Accounting%20Setup"
                className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors mb-2"
              >
                <ArrowLeft size={14} /> Back to Accounting Setup
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FolderTree className="w-6 h-6" /> Account Groups Setup
              </h1>
              <p className="text-sm mt-0.5 opacity-90">
                Maintain financial account group hierarchy, parent structures & natures
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-rbac-exempt="true"
                className="btn-success text-xs px-3.5 py-2 flex items-center gap-1.5 font-bold cursor-pointer"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={15} /> Create Group
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input w-full pl-9 text-sm"
              placeholder="Search code or group name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select
              className="input text-sm"
              value={natureFilter}
              onChange={(e) => setNatureFilter(e.target.value)}
            >
              <option value="">All Natures</option>
              <option value="ASSET">ASSET</option>
              <option value="LIABILITY">LIABILITY</option>
              <option value="EQUITY">EQUITY</option>
              <option value="INCOME">INCOME</option>
              <option value="EXPENSE">EXPENSE</option>
            </select>

            <select
              className="input text-sm"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="1">Active Only</option>
              <option value="0">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand" /> Create New Account Group
              </h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold cursor-pointer"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Group Name *</label>
                <input
                  className="input w-full text-sm"
                  placeholder="e.g. Current Assets"
                  value={name}
                  onChange={(e) => handleNameOrNatureChange(e.target.value, undefined, undefined)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Account Nature *</label>
                  <select
                    className="input w-full text-sm"
                    value={nature}
                    onChange={(e) => handleNameOrNatureChange(undefined, e.target.value, undefined)}
                    required
                  >
                    <option value="">Select Nature</option>
                    <option value="ASSET">ASSET</option>
                    <option value="LIABILITY">LIABILITY</option>
                    <option value="EQUITY">EQUITY</option>
                    <option value="INCOME">INCOME</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>

                <div>
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Group Code</label>
                  <input
                    className="input w-full text-sm font-mono uppercase"
                    placeholder="Auto-generated if empty"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div>
                <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Parent Group</label>
                <select
                  className="input w-full text-sm"
                  value={parentId}
                  onChange={(e) => handleNameOrNatureChange(undefined, undefined, e.target.value)}
                >
                  <option value="">None (Root Group)</option>
                  {rankedItems.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  data-rbac-exempt="true"
                  className="btn btn-secondary text-xs px-4 py-2 cursor-pointer"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-rbac-exempt="true"
                  className="btn-success text-xs px-4 py-2 flex items-center gap-1 font-bold cursor-pointer"
                >
                  <Plus size={14} /> Save Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="card shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full table-fixed">
            <colgroup>
              <col style={{ width: "16.666%" }} />
              <col style={{ width: "16.666%" }} />
              <col style={{ width: "16.666%" }} />
              <col style={{ width: "16.666%" }} />
              <col style={{ width: "16.666%" }} />
              <col style={{ width: "16.666%" }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                <th className="py-3 px-4 text-left">Code</th>
                <th className="py-3 px-4 text-left">Group Name</th>
                <th className="py-3 px-4 text-left">Nature</th>
                <th className="py-3 px-4 text-left">Parent Group</th>
                <th className="py-3 px-4 text-right">Accounts</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    <RefreshCw className="animate-spin w-6 h-6 mx-auto mb-2" />
                    Loading account groups...
                  </td>
                </tr>
              ) : rankedItems.length > 0 ? (
                rankedItems.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    {String(editId) === String(g.id) ? (
                      <>
                        <td className="py-2 px-3">
                          <input
                            className="input w-full text-xs font-mono"
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            className="input w-full text-xs"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            className="input w-full text-xs"
                            value={editNature}
                            onChange={(e) => setEditNature(e.target.value)}
                          >
                            <option value="ASSET">ASSET</option>
                            <option value="LIABILITY">LIABILITY</option>
                            <option value="EQUITY">EQUITY</option>
                            <option value="INCOME">INCOME</option>
                            <option value="EXPENSE">EXPENSE</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <select
                            className="input w-full text-xs"
                            value={editParentId}
                            onChange={(e) => setEditParentId(e.target.value)}
                          >
                            <option value="">None</option>
                            {rankedItems.map((pg) => (
                              <option key={`p-${pg.id}`} value={pg.id}>
                                {pg.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {typeof g.account_count === "number" ? g.account_count : "-"}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              data-rbac-exempt="true"
                              className="btn-success text-xs px-2.5 py-1 flex items-center gap-1 cursor-pointer"
                              disabled={loading}
                              onClick={saveEdit}
                            >
                              <Save size={12} /> Save
                            </button>
                            <button
                              data-rbac-exempt="true"
                              className="btn btn-secondary text-xs px-2.5 py-1 cursor-pointer"
                              disabled={loading}
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4 font-mono font-bold text-brand dark:text-brand-300 truncate" title={g.code}>
                          {g.code}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 truncate" title={g.name}>
                          {g.name}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold truncate">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                            {g.nature}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs truncate" title={g.parent_name || "—"}>
                          {g.parent_name || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                          {typeof g.account_count === "number" ? g.account_count : "-"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            <button
                              type="button"
                              data-rbac-exempt="true"
                              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                              onClick={() => startEdit(g)}
                              disabled={loading}
                            >
                              <Edit3 size={12} /> Edit
                            </button>
                            {g.is_active ? (
                              <button
                                type="button"
                                data-rbac-exempt="true"
                                className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-40 cursor-pointer"
                                disabled={
                                  loading ||
                                  (typeof g.active_account_count === "number" && g.active_account_count > 0)
                                }
                                onClick={() => {
                                  if (window.confirm("Deactivate this account group?")) {
                                    handleToggleActive(g.id, 0);
                                  }
                                }}
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                data-rbac-exempt="true"
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                                disabled={loading}
                                onClick={() => handleToggleActive(g.id, 1)}
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <span>No account groups found.</span>
                      <button
                        type="button"
                        data-rbac-exempt="true"
                        className="btn-success text-xs px-3 py-1.5 flex items-center gap-1 cursor-pointer font-semibold"
                        onClick={() => setShowCreateModal(true)}
                      >
                        <Plus size={14} /> Create First Group
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
