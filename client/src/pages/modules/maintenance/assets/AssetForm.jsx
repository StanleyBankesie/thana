/**
 * @fileoverview AssetForm component.
 * Provides functionality for AssetForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function AssetForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { search } = useLocation();
  const mode = new URLSearchParams(search).get("mode");
  const readOnly = mode === "view";

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    asset_no: "",
    asset_name: "",
    location: "",
    status: "ACTIVE",
    notes: "",
  });

  useEffect(() => {
    if (!isEdit) return;
    let mounted = true;
    setLoading(true);
    api
      .get(`/maintenance/assets/${id}`)
      .then((res) => {
        if (!mounted) return;
        const item = res.data?.item || {};
        setForm({
          asset_no: item.asset_no || "",
          asset_name: item.asset_name || "",
          location: item.location || "",
          status: item.status || "ACTIVE",
          notes: item.notes || "",
        });
      })
      .catch((e) => {
        toast.error(e?.response?.data?.message || "Failed to load asset");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id, isEdit]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/maintenance/assets/${id}`, form);
        toast.success("Asset updated");
      } else {
        await api.post("/maintenance/assets", form);
        toast.success("Asset created");
      }
      navigate("/maintenance/assets");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save asset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
        >
          ← Back to Assets
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          {readOnly ? "View Asset" : isEdit ? "Edit Asset" : "New Asset"}
        </h1>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            <fieldset disabled={readOnly}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Asset No</label>
                  <input
                    className="input"
                    value={form.asset_no}
                    onChange={(e) => update("asset_no", e.target.value)}
                    placeholder="Auto"
                  />
                </div>
                <div>
                  <label className="label">Name *</label>
                  <input
                    className="input"
                    value={form.asset_name}
                    onChange={(e) => update("asset_name", e.target.value)}
                    required
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
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={form.status}
                    onChange={(e) => update("status", e.target.value)}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Notes</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
            <div className="flex justify-end gap-3">
              <button onClick={() => window.history.back()} className="btn-success">
                Cancel
              </button>
              <button className="btn-success" disabled={loading || readOnly}>
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
