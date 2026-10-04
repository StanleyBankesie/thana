import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { toast } from "react-toastify";
import { Building2, Users, Truck, Package } from "lucide-react";

export default function BranchDataSharingSection() {
  const [sharing, setSharing] = useState({
    share_customers: false,
    share_suppliers: false,
    share_items: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await api.get("/admin/settings/branch-sharing");
        if (mounted && res?.data?.data) {
          setSharing({
            share_customers: Boolean(res.data.data.share_customers),
            share_suppliers: Boolean(res.data.data.share_suppliers),
            share_items: Boolean(res.data.data.share_items),
          });
        }
      } catch (err) {
        console.error("Failed to load branch sharing settings", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      await api.post("/admin/settings/branch-sharing", sharing);
      toast.success("Branch data sharing settings saved successfully");
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to save branch settings",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-body space-y-4">
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-600" />
              Branch Data Access & Isolation
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              Configure whether branches share master data or keep their own isolated records.
            </div>
          </div>
          <span className="badge badge-info">Multi-Branch Setup</span>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500 py-3">
            Loading branch sharing settings...
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Customers */}
            <div className="flex items-start justify-between p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors bg-white">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-lg mt-0.5">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <label
                    htmlFor="share-customers-cb"
                    className="font-medium text-slate-800 cursor-pointer text-sm"
                  >
                    Share Customer Directory across all branches
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sharing.share_customers
                      ? "Enabled: All branches can view, search, and transact with the same customer directory."
                      : "Isolated: Each individual branch has its own customers. Users only see customers created in their assigned branch."}
                  </p>
                </div>
              </div>
              <input
                id="share-customers-cb"
                type="checkbox"
                className="checkbox checkbox-primary mt-1"
                checked={sharing.share_customers}
                onChange={(e) =>
                  setSharing((prev) => ({
                    ...prev,
                    share_customers: e.target.checked,
                  }))
                }
                disabled={saving}
              />
            </div>

            {/* Suppliers */}
            <div className="flex items-start justify-between p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors bg-white">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg mt-0.5">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <label
                    htmlFor="share-suppliers-cb"
                    className="font-medium text-slate-800 cursor-pointer text-sm"
                  >
                    Share Supplier Directory across all branches
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sharing.share_suppliers
                      ? "Enabled: All branches can view and issue purchase orders to the same supplier directory."
                      : "Isolated: Each individual branch maintains its own suppliers. Vendors are private to each branch."}
                  </p>
                </div>
              </div>
              <input
                id="share-suppliers-cb"
                type="checkbox"
                className="checkbox checkbox-primary mt-1"
                checked={sharing.share_suppliers}
                onChange={(e) =>
                  setSharing((prev) => ({
                    ...prev,
                    share_suppliers: e.target.checked,
                  }))
                }
                disabled={saving}
              />
            </div>

            {/* Inventory Items */}
            <div className="flex items-start justify-between p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors bg-white">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-50 text-purple-700 rounded-lg mt-0.5">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <label
                    htmlFor="share-items-cb"
                    className="font-medium text-slate-800 cursor-pointer text-sm"
                  >
                    Share Inventory Items across all branches
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sharing.share_items
                      ? "Enabled: Master items, categories, and codes are globally shared across all branches."
                      : "Isolated: Each individual branch defines and manages its own unique inventory items."}
                  </p>
                </div>
              </div>
              <input
                id="share-items-cb"
                type="checkbox"
                className="checkbox checkbox-primary mt-1"
                checked={sharing.share_items}
                onChange={(e) =>
                  setSharing((prev) => ({
                    ...prev,
                    share_items: e.target.checked,
                  }))
                }
                disabled={saving}
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? "Saving..." : "Save Branch Sharing Settings"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
