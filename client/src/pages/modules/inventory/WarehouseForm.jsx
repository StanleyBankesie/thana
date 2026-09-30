/**
 * @fileoverview Form component for creating or editing a warehouse.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "api/client";
import { useAuth } from "../../../auth/AuthContext.jsx";

/**
 * WarehouseForm component
 * Manages the data entry and submission for warehouse records.
 * 
 * @returns {JSX.Element} The warehouse form view.
 */
export default function WarehouseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const { scope } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    warehouse_code: "",
    warehouse_name: "",
    location: "",
    is_active: true,
  });
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [originalBranchId, setOriginalBranchId] = useState("");

  useEffect(() => {
    let mounted = true;
    setError("");
    api
      .get("/admin/branches")
      .then((res) => {
        if (!mounted) return;
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setBranches(items);
        const initial =
          String(scope?.branchId || "") ||
          (items.length ? String(items[0].id) : "");
        setSelectedBranchId(initial);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, [scope?.branchId]);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/warehouses/${id}`)
      .then((res) => {
        if (!mounted) return;
        const w = res.data?.item;
        if (!w) return;
        setFormData({
          warehouse_code: w.warehouse_code || "",
          warehouse_name: w.warehouse_name || "",
          location: w.location || "",
          is_active: Boolean(w.is_active),
        });
        if (w.branch_id) {
          setSelectedBranchId(String(w.branch_id));
          setOriginalBranchId(String(w.branch_id));
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load warehouse");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!selectedBranchId) {
        throw new Error("Select a branch for this warehouse");
      }
      const chosenBranch = branches.find(
        (b) => String(b.id) === String(selectedBranchId)
      );
      const chosenCompanyId = chosenBranch
        ? Number(chosenBranch.company_id)
        : undefined;

      const payload = {
        warehouse_code: formData.warehouse_code,
        warehouse_name: formData.warehouse_name,
        location: formData.location || null,
        is_active: Boolean(formData.is_active),
      };

      if (isNew) {
        await api.post("/inventory/warehouses", payload, {
          headers: {
            "x-branch-id": String(selectedBranchId),
            ...(chosenCompanyId
              ? { "x-company-id": String(chosenCompanyId) }
              : {}),
          },
        });
      } else {
        if (
          originalBranchId &&
          String(originalBranchId) !== String(selectedBranchId)
        ) {
          await api.put(
            `/inventory/warehouses/${id}/link-branch`,
            { branch_id: Number(selectedBranchId) },
            {
              headers: {
                ...(chosenCompanyId
                  ? { "x-company-id": String(chosenCompanyId) }
                  : {}),
              },
            }
          );
        }
        await api.put(`/inventory/warehouses/${id}`, payload, {
          headers: {
            "x-branch-id": String(selectedBranchId),
            ...(chosenCompanyId
              ? { "x-company-id": String(chosenCompanyId) }
              : {}),
          },
        });
      }

      navigate("/inventory/warehouses");
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save warehouse");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew ? "New Warehouse" : "Edit Warehouse"}
              </h1>
              <p className="text-sm mt-1">Maintain warehouse master data</p>
            </div>
            <button onClick={() => window.history.back()} className="btn-success">
              Back to List
            </button>
          </div>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Branch *</label>
                <select
                  className="input"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  required
                >
                  <option value="">Select a branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.name} ({b.company_name || `Company #${b.company_id}`})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Warehouse Code *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.warehouse_code}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouse_code: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Warehouse Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.warehouse_name}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouse_name: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Location</label>
                <input
                  type="text"
                  className="input"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={formData.is_active ? "ACTIVE" : "INACTIVE"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_active: e.target.value === "ACTIVE",
                    })
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => window.history.back()} className="btn-success">
                Cancel
              </button>
              <button type="submit" className="btn-success" disabled={saving}>
                {saving ? "Saving..." : "Save Warehouse"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
