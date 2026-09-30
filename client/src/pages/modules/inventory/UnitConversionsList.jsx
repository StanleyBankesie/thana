/**
 * @fileoverview UnitConversionsList component.
 * Provides functionality for UnitConversionsList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import FloatingCreateButton from "@/components/FloatingCreateButton.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useUoms } from "@/hooks/useUoms";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function UnitConversionsList() {
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { uoms, loading: uomsLoading } = useUoms();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [formData, setFormData] = useState({
    item_id: "",
    from_uom: "",
    to_uom: "",
    conversion_factor: "1",
    is_active: true,
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [convRes, itemsRes] = await Promise.all([
        api.get("/inventory/unit-conversions"),
        api.get("/inventory/items"),
      ]);
      setConversions(Array.isArray(convRes.data?.items) ? convRes.data.items : []);
      setItems(Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return conversions.slice();
    return filterAndSort(conversions, {
      query: searchTerm,
      getKeys: (c) => [c.item_code, c.item_name, c.from_uom, c.to_uom],
    });
  }, [conversions, searchTerm]);

  const openModal = (mode, existing = null) => {
    setModalMode(mode);
    if (mode === "create") {
      setFormData({
        item_id: "",
        from_uom: "",
        to_uom: "",
        conversion_factor: "1",
        is_active: true,
      });
    } else if (existing) {
      setFormData({
        id: existing.id,
        item_id: existing.item_id ? String(existing.item_id) : "",
        from_uom: existing.from_uom || "",
        to_uom: existing.to_uom || "",
        conversion_factor: String(existing.conversion_factor || "1"),
        is_active: Boolean(existing.is_active),
      });
    }
    setShowModal(true);
  };

  const saveConversion = async () => {
    const payload = {
      item_id: formData.item_id ? Number(formData.item_id) : null,
      from_uom: String(formData.from_uom || "").trim(),
      to_uom: String(formData.to_uom || "").trim(),
      conversion_factor: Number(formData.conversion_factor),
      is_active: formData.is_active ? 1 : 0,
    };

    if (!payload.item_id) return alert("Item is required");
    if (!payload.from_uom) return alert("From UOM is required");
    if (!payload.to_uom) return alert("To UOM is required");
    if (!payload.conversion_factor || payload.conversion_factor <= 0)
      return alert("Factor must be positive");

    try {
      if (modalMode === "create") {
        await api.post("/inventory/unit-conversions", payload);
      } else {
        await api.put(`/inventory/unit-conversions/${formData.id}`, payload);
      }
      setShowModal(false);
      await loadData();
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to save");
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Unit Conversion
              </h1>
              <p className="text-sm mt-1">Define unit conversions per item</p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
                Return to Menu
              </Link>
              <button
                className="btn-success"
                onClick={() => openModal("create")}
              >
                + New Conversion
              </button>
            </div>
          </div>
        </div>

        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by item, from/to UOM..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Factor</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && !conversions.length ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && !filtered.length ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-slate-500">
                      No unit conversions found
                    </td>
                  </tr>
                ) : null}

                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium">
                        {c.item_code} - {c.item_name}
                      </div>
                    </td>
                    <td className="text-brand-700 font-medium">{c.from_uom}</td>
                    <td className="text-brand-700 font-medium">{c.to_uom}</td>
                    <td>{c.conversion_factor}</td>
                    <td>
                      <span
                        className={`badge ${
                          c.is_active ? "badge-success" : "badge-error"
                        }`}
                      >
                        {c.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>{c.created_by_name || "-"}</td>
                    <td>
                      {c.created_at
                        ? new Date(c.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      <button
                        className="text-blue-600 hover:underline text-sm font-medium"
                        onClick={() => openModal("edit", c)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-erp-lg max-w-xl w-full">
            <div className="px-5 py-4 border-b dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold">
                {modalMode === "create" ? "New Conversion" : "Edit Conversion"}
              </h2>
              <button
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="w-full">
                  <label className="label">Item *</label>
                  <select
                    className="input w-full"
                    value={formData.item_id}
                    onChange={(e) =>
                      setFormData({ ...formData, item_id: e.target.value })
                    }
                  >
                    <option value="">Select item...</option>
                    {items.map((i) => (
                      <option key={i.id} value={String(i.id)}>
                        {i.item_code} - {i.item_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                  />
                  <span className="text-sm font-medium">Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="w-full">
                  <label className="label">From UOM *</label>
                  <select
                    className="input w-full"
                    value={formData.from_uom}
                    onChange={(e) =>
                      setFormData({ ...formData, from_uom: e.target.value })
                    }
                  >
                    <option value="">Select...</option>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.uom_code}>
                        {u.uom_code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full">
                  <label className="label">To UOM *</label>
                  <select
                    className="input w-full"
                    value={formData.to_uom}
                    onChange={(e) =>
                      setFormData({ ...formData, to_uom: e.target.value })
                    }
                  >
                    <option value="">Select...</option>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.uom_code}>
                        {u.uom_code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full">
                  <label className="label">Factor *</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="input w-full"
                    value={formData.conversion_factor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        conversion_factor: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t dark:border-slate-800 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn-success" onClick={saveConversion}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <FloatingCreateButton
        onClick={() => openModal("create")}
        title="New Conversion"
      />
    </div>
  );
}
