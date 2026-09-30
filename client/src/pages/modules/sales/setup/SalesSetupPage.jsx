/**
 * @fileoverview Setup and configuration page for the Sales module.
 * Provides tabbed management for sales zones, return reasons, and price types.
 */

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

/**
 * SalesSetupPage component
 * Loads list data based on the active tab and provides basic CRUD capabilities via a unified form.
 * 
 * @returns {JSX.Element} The sales setup interface.
 */
export default function SalesSetupPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get("tab") || "zones";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      let endpoint = "";
      if (activeTab === "salespersons") endpoint = "/sales/sales-persons";
      else if (activeTab === "zones") endpoint = "/sales/zones";
      else if (activeTab === "reasons") endpoint = "/sales/return-reasons";
      else if (activeTab === "price-types") endpoint = "/sales/price-types";

      if (endpoint) {
        const res = await api.get(endpoint);
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
      let endpoint = "";
      if (activeTab === "salespersons") endpoint = "/sales/sales-persons";
      else if (activeTab === "zones") endpoint = "/sales/zones";
      else if (activeTab === "reasons") endpoint = "/sales/return-reasons";
      else if (activeTab === "price-types") endpoint = "/sales/price-types";

      // The original SalesSetupPage sent a batch of items via POST { [tab]: items }
      // To adapt this to the HrSetupPage model (single item add/edit) without writing new endpoints,
      // wait, the original SalesSetupPage actually replaces ALL items for a category using POST.
      // So if we just append the form to the existing items and POST, it works!
      // But let's check the endpoints. `/sales/zones` accepts `{ zones: [...] }`.
      
      let payload = {};
      if (activeTab === "salespersons") {
        let updatedItems = [...items];
        if (isEditing) {
          updatedItems = updatedItems.map((it) => (it.id === form.id ? form : it));
        } else {
          updatedItems.push(form);
        }
        payload = { salespersons: updatedItems };
      } else if (activeTab === "zones") {
        let updatedItems = [...items];
        if (isEditing) {
          updatedItems = updatedItems.map((it) => (it.id === form.id ? form : it));
        } else {
          updatedItems.push(form);
        }
        payload = { zones: updatedItems };
      } else if (activeTab === "reasons") {
        let updatedItems = [...items];
        if (isEditing) {
          updatedItems = updatedItems.map((it) => (it.id === form.id ? form : it));
        } else {
          updatedItems.push(form);
        }
        payload = { reasons: updatedItems };
      } else if (activeTab === "price-types") {
        let updatedItems = [...items];
        if (isEditing) {
          updatedItems = updatedItems.map((it) => (it.id === form.id ? form : it));
        } else {
          updatedItems.push(form);
        }
        payload = { priceTypes: updatedItems };
      }

      await api.post(endpoint, payload);
      toast.success("Saved successfully");
      setForm({});
      setIsEditing(false);
      loadData();
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
      let endpoint = "";
      if (activeTab === "zones") endpoint = `/sales/zones/${id}`;
      else if (activeTab === "reasons") endpoint = `/sales/return-reasons/${id}`;
      else if (activeTab === "price-types") endpoint = `/sales/price-types/${id}`;

      await api.delete(endpoint);
      toast.success("Deleted successfully");
      loadData();
    } catch (err) {
      toast.error("Failed to delete item");
    }
  };

  return (
    <Guard moduleKey="sales">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            Back to Menu
          </button>
          <h2 className="text-lg font-semibold">Sales Setup & Parameters</h2>
        </div>

        <div className="flex border-b mb-6 overflow-x-auto">
          {["zones", "reasons", "price-types", "salespersons"].map((tab) => (
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
                {(isEditing ? "Edit" : "Add New") + " " + activeTab.replace("-", " ")}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                {activeTab === "salespersons" && (
                  <>
                    <div>
                      <label className="label">Name</label>
                      <input type="text" className="input" required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input type="email" className="input" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                  </>
                )}

                        {activeTab === "zones" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Zone Name *</label>
                      <input
                        className="input"
                        placeholder="e.g. NORTH"
                        value={form.zone_name || ""}
                        onChange={(e) =>
                          setForm({ ...form, zone_name: e.target.value.toUpperCase().replace(/\s+/g, "_") })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Description</label>
                      <input
                        className="input"
                        placeholder="e.g. Northern Region"
                        value={form.description || ""}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </div>
                  </>
                )}
                {activeTab === "reasons" && (
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
                      <label className="block text-sm mb-1">Reason Name / Description *</label>
                      <input
                        className="input"
                        placeholder="e.g. Item Damaged in Transit"
                        value={form.reason_name || ""}
                        onChange={(e) => setForm({ ...form, reason_name: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}
                {activeTab === "price-types" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Price Type Name *</label>
                      <input
                        className="input"
                        placeholder="e.g. Wholesale"
                        value={form.name || ""}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Description</label>
                      <input
                        className="input"
                        placeholder="e.g. Wholesale Customer Pricing"
                        value={form.description || ""}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm mb-1">Status</label>
                  <select
                    className="input"
                    value={form.is_active !== undefined ? (form.is_active ? "1" : "0") : "1"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        is_active: e.target.value === "1",
                      })
                    }
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>

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

          {/* List Section */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr className="text-left font-bold text-xs text-slate-500 uppercase">
                    {activeTab === "zones" && (
                      <>
                        <th className="px-4 py-3">Zone Name</th>
                        <th className="px-4 py-3">Description</th>
                      </>
                    )}
                    {activeTab === "reasons" && (
                      <>
                        <th className="px-4 py-3">Reason Code</th>
                        <th className="px-4 py-3">Description</th>
                      </>
                    )}
                    {activeTab === "salespersons" && (
                      <>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Email</th>
                      </>
                    )}
                    {activeTab === "price-types" && (
                      <>
                        <th className="px-4 py-3">Price Type Name</th>
                        <th className="px-4 py-3">Description</th>
                      </>
                    )}
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
                        No items found.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        {activeTab === "zones" && (
                          <>
                            <td className="px-4 py-3 font-medium">{item.zone_name}</td>
                            <td className="px-4 py-3 text-slate-500">{item.description}</td>
                          </>
                        )}
                        {activeTab === "reasons" && (
                          <>
                            <td className="px-4 py-3 font-medium">{item.reason_code}</td>
                            <td className="px-4 py-3 text-slate-500">{item.reason_name}</td>
                          </>
                        )}
                        {activeTab === "salespersons" && (
                          <>
                            <td className="px-4 py-3 font-medium">{item.name}</td>
                            <td className="px-4 py-3 text-slate-500">{item.email}</td>
                          </>
                        )}
                        {activeTab === "price-types" && (
                          <>
                            <td className="px-4 py-3 font-medium">{item.name}</td>
                            <td className="px-4 py-3 text-slate-500">{item.description}</td>
                          </>
                        )}
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
    </Guard>
  );
}
