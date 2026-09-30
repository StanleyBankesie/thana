/**
 * @fileoverview ProductionItemList component.
 * Production Items tab section in Manufacturing Setup.
 * Reuses ItemForm logic while enforcing production item context.
 */

import React, { useState, useEffect } from "react";
import { api } from "api/client";
import { toast } from "react-toastify";
import { Plus, Edit, Trash2, Package, Check, X, Box } from "lucide-react";
import ItemForm from "../../inventory/ItemForm";

export default function ProductionItemList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);

  const fetchProductionItems = async () => {
    setLoading(true);
    try {
      const res = await api.get("/inventory/items?all=1");
      const allItems = res.data?.items || [];
      // Filter production items
      const prodItems = allItems.filter(
        (it) => String(it.is_production_item || "").toUpperCase() === "Y"
      );
      setItems(prodItems);
    } catch {
      toast.error("Failed to load production items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductionItems();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this production item?")) return;
    try {
      await api.delete(`/inventory/items/${id}`);
      toast.success("Production item deleted successfully");
      fetchProductionItems();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete production item");
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Box className="text-brand-600" size={22} />
            Production Items Setup
          </h2>
          <p className="text-xs text-slate-500">
            Manage finished goods, semi-finished assemblies, raw stocks, and manufactured parts marked as Production Items
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedItemId("new");
            setShowModal(true);
          }}
          className="btn btn-primary flex items-center gap-2 text-xs"
        >
          <Plus size={16} />
          Add Production Item
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 uppercase tracking-wider text-xs border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Item Code</th>
                <th className="px-6 py-4">Item Name</th>
                <th className="px-6 py-4">Item Type</th>
                <th className="px-6 py-4">Base UOM</th>
                <th className="px-6 py-4">Cost Price</th>
                <th className="px-6 py-4">Selling Price</th>
                <th className="px-6 py-4">Production Item</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-400 font-medium">
                    Loading production items...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-400 font-medium">
                    <Package className="mx-auto mb-2 opacity-50 text-brand-600" size={32} />
                    No production items registered yet. Click "Add Production Item" to configure one.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-xs text-brand-900 dark:text-brand-300">
                      {it.item_code}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">
                      {it.item_name}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {it.item_type || "Standard"}
                    </td>
                    <td className="px-6 py-4 font-bold text-xs">{it.uom || "PCS"}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                      ${parseFloat(it.cost_price || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-600">
                      ${parseFloat(it.selling_price || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800">
                        <Check size={12} /> Yes
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedItemId(it.id);
                          setShowModal(true);
                        }}
                        className="btn btn-secondary p-1.5 text-blue-600 hover:text-blue-700"
                        title="Edit Item"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="btn btn-secondary p-1.5 text-rose-600 hover:text-rose-700"
                        title="Delete Item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Item Form */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700 p-6 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Box size={20} className="text-brand-600" />
                {selectedItemId === "new" ? "New Production Item" : "Edit Production Item"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <ItemForm
              isModal={true}
              modalItemId={selectedItemId}
              isProductionMode={true}
              onClose={() => setShowModal(false)}
              onSaveSuccess={() => {
                setShowModal(false);
                toast.success("Production item saved successfully");
                fetchProductionItems();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
