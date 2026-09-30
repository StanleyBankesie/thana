/**
 * @fileoverview Setup and configuration page for the Purchase module.
 * Provides configuration for default GL accounts and purchase rejection reasons.
 */

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

/**
 * PurchaseSetupPage component
 * Loads default account bindings and allows managing rejection reasons through a tabbed interface.
 * 
 * @returns {JSX.Element} The purchase setup view.
 */
export default function PurchaseSetupPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get("tab") || "accounts";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [accounts, setAccounts] = useState([]);

  // Load chart of accounts for account mapping
  useEffect(() => {
    api
      .get("/finance/accounts", { params: { postable: 1, active: 1 } })
      .then((res) => setAccounts(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => {});
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "accounts") {
        const res = await api.get("/purchase/setup");
        const data = res?.data || {};
        setForm({
          freight_account_id: data.freight_account_id || "",
          other_charges_account_id: data.other_charges_account_id || "",
        });
        setItems([]);
      } else if (activeTab === "rejection-reasons") {
        const res = await api
          .get("/purchase/return-rejection-reasons")
          .catch(() => ({ data: { items: [] } }));
        setItems(res?.data?.items || []);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setForm({});
    setIsEditing(false);
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === "accounts") {
        await api.put("/purchase/setup", {
          freight_account_id: form.freight_account_id || null,
          other_charges_account_id: form.other_charges_account_id || null,
        });
        toast.success("Purchase setup updated successfully");
      } else if (activeTab === "rejection-reasons") {
        let updatedItems = [...items];
        if (isEditing) {
          updatedItems = updatedItems.map((it) => (it.id === form.id ? form : it));
        } else {
          updatedItems.push(form);
        }
        const payload = updatedItems.map((r) => ({
          id: r._new ? undefined : r.id,
          reason_code: r.reason_code,
          reason_name: r.reason_name,
          is_active: r.is_active !== undefined ? r.is_active : 1,
        }));
        await api.post("/purchase/return-rejection-reasons", { reasons: payload });
        toast.success("Saved successfully");
        setForm({});
        setIsEditing(false);
        loadData();
      }
    } catch (err) {
      toast.error("Failed to save");
    }
  };

  const handleEdit = (item) => {
    setForm(item);
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await api.delete(`/purchase/return-rejection-reasons/${id}`);
      toast.success("Deleted successfully");
      loadData();
    } catch (err) {
      toast.error("Failed to delete item");
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">
          Back to Menu
        </button>
        <h2 className="text-lg font-semibold">Purchase Setup & Parameters</h2>
      </div>

      <div className="flex border-b mb-6 overflow-x-auto">
        {["accounts", "rejection-reasons"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize whitespace-nowrap ${
              activeTab === tab
                ? "border-b-2 border-brand text-brand"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.replace("-", " ")}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
            <h3 className="font-medium mb-4">
              {activeTab === "accounts"
                ? "Financial Account Mapping"
                : (isEditing ? "Edit" : "Add New") + " Rejection Reason"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {activeTab === "accounts" && (
                <>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200">
                    Select default financial accounts for freight and other purchase charges.
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Freight Charges Account</label>
                    <select
                      className="input"
                      value={form.freight_account_id || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          freight_account_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Select Account --</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Ledger account to debit for freight/shipping costs.</p>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Other Charges Account</label>
                    <select
                      className="input"
                      value={form.other_charges_account_id || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          other_charges_account_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Select Account --</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Ledger account for miscellaneous purchase charges.</p>
                  </div>
                </>
              )}

              {activeTab === "rejection-reasons" && (
                <>
                  <div>
                    <label className="block text-sm mb-1">Reason Code *</label>
                    <input
                      className="input"
                      placeholder="e.g. DAMAGED"
                      value={form.reason_code || ""}
                      onChange={(e) =>
                        setForm({ ...form, reason_code: e.target.value.toUpperCase().replace(/\s+/g, "_") })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Reason Name *</label>
                    <input
                      className="input"
                      placeholder="e.g. Damaged Goods"
                      value={form.reason_name || ""}
                      onChange={(e) => setForm({ ...form, reason_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Status</label>
                    <select
                      className="input"
                      value={form.is_active !== undefined ? (form.is_active ? "1" : "0") : "1"}
                      onChange={(e) =>
                        setForm({ ...form, is_active: e.target.value === "1" ? 1 : 0 })
                      }
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">
                  Save
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm({});
                      setIsEditing(false);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* List / Info Section */}
        <div className="lg:col-span-2">
          {activeTab === "accounts" ? (
            <div className="bg-white dark:bg-slate-800 rounded shadow-sm p-6 space-y-4">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300">Account Configuration Help</h3>
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">Tax Accounts</div>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                  Individual tax component accounts are managed within the Finance module under{" "}
                  <strong>Finance &gt; Setup &gt; Tax Codes</strong>.
                </p>
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">Inventory Accounts</div>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                  Inventory clearing and stock accounts are resolved per-item based on the Inventory configuration.
                </p>
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">Account Mapping</div>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                  Configure specific ledger accounts to debit for freight/shipping costs and miscellaneous purchase charges.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr className="text-left font-bold text-xs text-slate-500 uppercase">
                    <th className="px-4 py-3">Reason Code</th>
                    <th className="px-4 py-3">Reason Name</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-500">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand" />
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-500">
                        No rejection reasons configured.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium font-mono">{item.reason_code}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.reason_name}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              item.is_active
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {item.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-brand hover:text-brand-600 mr-3 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
