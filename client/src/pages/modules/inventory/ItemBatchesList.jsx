/**
 * @fileoverview ItemBatchesList component.
 * Provides functionality for ItemBatchesList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { api } from "api/client";
import { Link } from "react-router-dom";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ItemBatchesList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    item_id: "",
    batch_no: "",
    expiry_from: "",
    expiry_to: "",
  });
  const [inventoryItems, setInventoryItems] = useState([]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/inventory/batches", { params: filters });
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load batches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api
      .get("/inventory/items")
      .then((r) =>
        setInventoryItems(Array.isArray(r.data?.items) ? r.data.items : []),
      )
      .catch(() => setInventoryItems([]));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const soonToExpire = useMemo(() => {
    const today = new Date();
    const in90 = new Date();
    in90.setMonth(in90.getMonth() + 3);
    return items.filter((b) => {
      if (!b.expiry_date) return false;
      const d = new Date(b.expiry_date);
      return d >= today && d <= in90 && Number(b.qty) > 0;
    }).length;
  }, [items]);

  const [editingBatch, setEditingBatch] = useState(null);
  const [savingBatch, setSavingBatch] = useState(false);

  const handleEditClick = (batch) => {
    setEditingBatch({
      id: batch.id,
      batch_no: batch.batch_no || "",
      serial_no: batch.serial_no || "",
      qty: batch.qty || 0,
      expiry_date: batch.expiry_date ? String(batch.expiry_date).slice(0, 10) : "",
      item_name: batch.item_name,
      item_code: batch.item_code,
    });
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    if (!editingBatch) return;
    setSavingBatch(true);
    try {
      await api.put(`/inventory/batches/${editingBatch.id}`, editingBatch);
      toast.success("Batch updated successfully");
      setEditingBatch(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update batch");
    } finally {
      setSavingBatch(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => window.history.back()} className="text-sm font-bold text-brand hover:text-brand-600 flex items-center gap-1">
            ← Back to Inventory Setup
          </button>
          <h1 className="text-2xl font-bold mt-2">Item Batches</h1>
          <p className="text-sm text-slate-600">
            Track item batches, costs, quantities and expiry dates. Soon-to-expire: {soonToExpire}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
      </div>

      <div className="card">
        <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Item</label>
            <select
              className="input h-9 text-sm w-full"
              value={filters.item_id}
              onChange={(e) => setFilters((p) => ({ ...p, item_id: e.target.value }))}
            >
              <option value="">All Items</option>
              {inventoryItems.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.item_code} - {it.item_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Batch No</label>
            <input
              className="input h-9 text-sm w-full"
              value={filters.batch_no}
              onChange={(e) => setFilters((p) => ({ ...p, batch_no: e.target.value }))}
              placeholder="Search batch..."
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Expiry From</label>
            <input
              type="date"
              className="input h-9 text-sm w-full"
              value={filters.expiry_from}
              onChange={(e) => setFilters((p) => ({ ...p, expiry_from: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Expiry To</label>
            <input
              type="date"
              className="input h-9 text-sm w-full"
              value={filters.expiry_to}
              onChange={(e) => setFilters((p) => ({ ...p, expiry_to: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body overflow-x-auto">
          {loading ? (
            <div className="py-10 text-center text-slate-500">Loading batches…</div>
          ) : error ? (
            <div className="py-10 text-center text-red-600">{error}</div>
          ) : (
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <th>Date Entered</th>
                  <th>Warehouse</th>
                  <th>Item</th>
                  <th>Batch No</th>
                  <th>Serial No</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Reserved</th>
                  <th>Expiry Date</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id}>
                    <td>{b.entry_date ? String(b.entry_date).slice(0, 10) : "-"}</td>
                    <td>{b.warehouse_name || "-"}</td>
                    <td>{b.item_code} - {b.item_name}</td>
                    <td className="font-mono font-bold">{b.batch_no || "-"}</td>
                    <td className="font-mono">{b.serial_no || "-"}</td>
                    <td className="text-right font-bold text-brand-600">{Number(b.qty || 0).toLocaleString()}</td>
                    <td className="text-right text-orange-600">{Number(b.reserved_qty || 0).toLocaleString()}</td>
                    <td>{b.expiry_date ? String(b.expiry_date).slice(0,10) : "-"}</td>
                    <td className="font-medium">{b.created_by_name || "System"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleEditClick(b)}
                        className="px-2 py-1 text-xs font-bold bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg"
                      >
                        Edit Batch
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No batches found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Batch Modal */}
      {editingBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Item Batch</h3>
              <button type="button" onClick={() => setEditingBatch(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>

            <form onSubmit={handleSaveBatch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Item</label>
                <div className="text-sm font-bold text-brand-900 dark:text-brand-300">
                  {editingBatch.item_code} - {editingBatch.item_name}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Batch Number *</label>
                <input
                  type="text"
                  required
                  value={editingBatch.batch_no}
                  onChange={(e) => setEditingBatch({ ...editingBatch, batch_no: e.target.value })}
                  className="input w-full font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Serial Number</label>
                <input
                  type="text"
                  value={editingBatch.serial_no}
                  onChange={(e) => setEditingBatch({ ...editingBatch, serial_no: e.target.value })}
                  className="input w-full font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Stock Quantity *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editingBatch.qty}
                  onChange={(e) => setEditingBatch({ ...editingBatch, qty: e.target.value })}
                  className="input w-full font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={editingBatch.expiry_date}
                  onChange={(e) => setEditingBatch({ ...editingBatch, expiry_date: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setEditingBatch(null)} className="btn btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={savingBatch} className="btn btn-primary text-xs">
                  {savingBatch ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
