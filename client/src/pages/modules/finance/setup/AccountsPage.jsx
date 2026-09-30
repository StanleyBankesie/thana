/**
 * @fileoverview AccountsPage component.
 * Standard Modern UI Chart of Accounts Setup for managing financial ledger accounts.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { 
  BookOpen, 
  ArrowLeft, 
  Plus, 
  Search, 
  RefreshCw, 
  Edit3, 
  Save, 
  X,
  CreditCard,
  Building2,
  DollarSign,
  Trash2
} from "lucide-react";

export default function AccountsPage() {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const { getExchangeRate } = useExchangeRate();
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [natureFilter, setNatureFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [groupId, setGroupId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [baseCurrencyId, setBaseCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [isPostable, setIsPostable] = useState(true);
  const [editId, setEditId] = useState("");
  const [editGroupId, setEditGroupId] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editCurrencyId, setEditCurrencyId] = useState("");
  const [editExchangeRate, setEditExchangeRate] = useState("1");
  const [editIsPostable, setEditIsPostable] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const [accRes, grpRes, curRes] = await Promise.all([
        api.get("/finance/accounts", {
          params: {
            search: searchTerm || null,
            groupId: filterGroupId || null,
            nature: natureFilter || null,
            active: activeFilter || null,
          },
        }),
        api.get("/finance/account-groups"),
        api.get("/finance/currencies"),
      ]);
      setItems(accRes.data?.items || []);
      setGroups(grpRes.data?.items || []);
      const c = curRes.data?.items || [];
      setCurrencies(c);
      const base = c.find(cur => Number(cur.is_base) === 1 || cur.is_base === true);
      if (base) {
        setBaseCurrencyId(base.id);
        if (!currencyId) setCurrencyId(base.id);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load accounts");
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
  }, [searchTerm, filterGroupId, natureFilter, activeFilter]);

  const handleGroupSelect = (selGrpId) => {
    setGroupId(selGrpId);
    if (!selGrpId) {
      setCode("");
      return;
    }
    const grp = groups.find((g) => String(g.id) === String(selGrpId));
    if (grp) {
      const natureMap = { ASSET: 1, LIABILITY: 2, EQUITY: 3, INCOME: 4, EXPENSE: 5 };
      const naturePrefix = (natureMap[grp.nature] || 9).toString();
      const existingInGroup = items.filter((a) => String(a.group_id) === String(selGrpId));
      let nextSeq = existingInGroup.length + 1;
      let gen = `${naturePrefix}${String(nextSeq).padStart(3, "0")}`;
      while (items.some((a) => a.code === gen)) {
        nextSeq++;
        gen = `${naturePrefix}${String(nextSeq).padStart(3, "0")}`;
      }
      setCode(gen);
    }
  };

  async function create(e) {
    e.preventDefault();
    try {
      if (!groupId) {
        toast.error("Account Group is required");
        return;
      }
      if (!name.trim()) {
        toast.error("Account Name is required");
        return;
      }

      await api.post("/finance/accounts", {
        groupId: Number(groupId),
        code: code ? code.trim() : null,
        name: name.trim(),
        currencyId: currencyId ? Number(currencyId) : null,
        isPostable: 1,
        isActive: 1,
      });

      toast.success("Account created successfully");
      setGroupId("");
      setCode("");
      setName("");
      setCurrencyId(baseCurrencyId);
      setShowCreateModal(false);
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to create account");
    }
  }

  async function handleDeleteAccount(id, accountName) {
    if (!window.confirm(`Are you sure you want to permanently delete account "${accountName}"?`)) {
      return;
    }
    try {
      setLoading(true);
      await api.delete(`/finance/accounts/${id}`);
      toast.success("Account deleted successfully");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete account");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(id, isActive) {
    try {
      setLoading(true);
      await api.put(`/finance/accounts/${id}/active`, {
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

  function startEdit(a) {
    setEditId(String(a.id));
    setEditGroupId(String(a.group_id));
    setEditCode(a.code || "");
    setEditName(a.name || "");
    setEditCurrencyId(a.currency_id ? String(a.currency_id) : "");
    setEditExchangeRate(a.exchange_rate ? String(a.exchange_rate) : "1");
    setEditIsPostable(Boolean(a.is_postable));
  }

  function cancelEdit() {
    setEditId("");
    setEditGroupId("");
    setEditCode("");
    setEditName("");
    setEditCurrencyId("");
    setEditExchangeRate("1");
    setEditIsPostable(true);
  }

  async function saveEdit() {
    try {
      setLoading(true);
      await api.put(`/finance/accounts/${editId}`, {
        groupId: editGroupId ? Number(editGroupId) : null,
        code: editCode,
        name: editName,
        currencyId: editCurrencyId ? Number(editCurrencyId) : null,
        isPostable: 1,
      });
      setItems((prev) =>
        prev.map((a) =>
          String(a.id) === String(editId)
            ? {
                ...a,
                code: editCode,
                name: editName,
                group_id: editGroupId ? Number(editGroupId) : a.group_id,
                group_name:
                  groups.find((g) => String(g.id) === String(editGroupId))
                    ?.name || a.group_name,
                group_code:
                  groups.find((g) => String(g.id) === String(editGroupId))
                    ?.code || a.group_code,
                nature:
                  groups.find((g) => String(g.id) === String(editGroupId))
                    ?.nature || a.nature,
                currency_id: editCurrencyId ? Number(editCurrencyId) : null,
                currency_code:
                  currencies.find(
                    (c) => String(c.id) === String(editCurrencyId),
                  )?.code || a.currency_code,
              }
            : a,
        ),
      );
      toast.success("Account updated successfully");
      cancelEdit();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update account");
    } finally {
      setLoading(false);
    }
  }

  const rankedItems = useMemo(() => {
    const q = String(searchTerm || "").trim();
    if (!q) return items.slice();
    return filterAndSort(items, {
      query: q,
      getKeys: (a) => [a.code, a.name],
    });
  }, [items, searchTerm]);

  const {
    sorted: sortedItems,
    sortKey,
    sortDir,
    toggle,
  } = useSort(rankedItems, "code", "asc");

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
                <BookOpen className="w-6 h-6" /> Chart of Accounts
              </h1>
              <p className="text-sm mt-0.5 opacity-90">
                Create and manage ledger accounts, currency mappings & balances
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-rbac-exempt="true"
                className="btn-success text-xs px-3.5 py-2 flex items-center gap-1.5 font-bold cursor-pointer"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={15} /> Create Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input w-full pl-9 text-sm"
              placeholder="Search account code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select
              className="input text-sm"
              value={filterGroupId}
              onChange={(e) => setFilterGroupId(e.target.value)}
            >
              <option value="">All Account Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.code})
                </option>
              ))}
            </select>

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

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand" /> Create New Ledger Account
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
                <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Account Group *</label>
                <select
                  className="input w-full text-sm"
                  value={groupId}
                  onChange={(e) => handleGroupSelect(e.target.value)}
                  required
                >
                  <option value="">Select Account Group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code} - {g.nature})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Account Code</label>
                  <input
                    className="input w-full text-sm font-mono"
                    placeholder="Auto-generated if empty"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Currency</label>
                  <select
                    className="input w-full text-sm"
                    value={currencyId}
                    onChange={(e) => setCurrencyId(e.target.value)}
                  >
                    <option value="">Default (Base Currency)</option>
                    {currencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Account Name *</label>
                <input
                  className="input w-full text-sm"
                  placeholder="e.g. Stanbic Bank Account"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
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
                  <Plus size={14} /> Save Account
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
              <col style={{ width: "14.285%" }} />
              <col style={{ width: "14.285%" }} />
              <col style={{ width: "14.285%" }} />
              <col style={{ width: "14.285%" }} />
              <col style={{ width: "14.285%" }} />
              <col style={{ width: "14.285%" }} />
              <col style={{ width: "14.285%" }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                <SortableHeader label="Account Code" sortKey="code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Account Name" sortKey="name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Group" sortKey="group_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Nature" sortKey="nature" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Currency" sortKey="currency_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Current Balance" sortKey="current_balance" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">
                    <RefreshCw className="animate-spin w-6 h-6 mx-auto mb-2" />
                    Loading accounts...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? (
                sortedItems.map((a) => {
                  const isEditing = String(editId) === String(a.id);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {isEditing ? (
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
                              value={editGroupId}
                              onChange={(e) => setEditGroupId(e.target.value)}
                            >
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-xs font-semibold truncate">
                            {a.nature}
                          </td>
                          <td className="py-2 px-3">
                            <select
                              className="input w-full text-xs"
                              value={editCurrencyId}
                              onChange={(e) => setEditCurrencyId(e.target.value)}
                            >
                              <option value="">Base</option>
                              {currencies.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.code}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right font-mono truncate">
                            {Number(a.current_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                          <td className="py-3 px-4 font-mono font-bold text-brand dark:text-brand-300 truncate" title={a.code}>
                            {a.code}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 truncate" title={a.name}>
                            {a.name}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs truncate" title={a.group_name || "—"}>
                            {a.group_name || "—"}
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold truncate">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                              {a.nature || "—"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono font-semibold truncate">
                            {a.currency_code || "Base"}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                            {Number(a.current_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {a.current_balance_type || ""}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end items-center gap-1.5">
                              <button
                                type="button"
                                data-rbac-exempt="true"
                                className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                                onClick={() => startEdit(a)}
                                disabled={loading}
                              >
                                <Edit3 size={12} /> Edit
                              </button>
                              {a.is_active ? (
                                <button
                                  type="button"
                                  data-rbac-exempt="true"
                                  className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
                                  disabled={loading}
                                  onClick={() => {
                                    if (window.confirm("Deactivate this account?")) {
                                      handleToggleActive(a.id, 0);
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
                                  onClick={() => handleToggleActive(a.id, 1)}
                                >
                                  Activate
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <span>No accounts found matching filters.</span>
                      <button
                        type="button"
                        data-rbac-exempt="true"
                        className="btn-success text-xs px-3 py-1.5 flex items-center gap-1 cursor-pointer font-semibold"
                        onClick={() => setShowCreateModal(true)}
                      >
                        <Plus size={14} /> Create First Account
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
