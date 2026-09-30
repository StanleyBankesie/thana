/**
 * @fileoverview BranchSelectionPage component.
 * Prompts users with multiple assigned branches to select one for the current session.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

/**
 * BranchSelectionPage component
 * Fetches available branches for the user and allows them to choose their active branch.
 * If only one branch is assigned, it auto-selects and redirects.
 * 
 * @returns {JSX.Element|null} The branch selection view or null if auto-redirected.
 */
export default function BranchSelectionPage() {
  const navigate = useNavigate();
  const { user, scope, setScope } = useAuth();
  const [branches, setBranches] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allowedBranchIds = useMemo(
    () => (Array.isArray(user?.branchIds) ? user.branchIds.map(Number) : []),
    [user?.branchIds]
  );

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        // Fetch all branches and filter them by the user's allowed branch IDs
        const res = await api.get("/admin/branches");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const allowed = items.filter((b) =>
          allowedBranchIds.includes(Number(b.id))
        );
        if (mounted) {
          setBranches(allowed);
          if (allowed.length === 1) {
            const only = allowed[0];
            setScope((prev) => ({
              ...prev,
              companyId: Number(only.company_id),
              branchId: Number(only.id),
            }));
            navigate("/", { replace: true });
            return;
          }
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Error loading branches");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Handles the continuation after a branch is selected.
   * Updates the global authentication scope and redirects to the dashboard.
   */
  async function onContinue() {
    const id = Number(selectedId);
    if (!id) return;
    const chosen = branches.find((b) => Number(b.id) === id);
    if (!chosen) return;
    setScope((prev) => ({
      ...prev,
      companyId: Number(chosen.company_id),
      branchId: Number(chosen.id),
      branchConfirmedId:
        branches.length === 1 ? Number(chosen.id) : prev?.branchConfirmedId,
    }));
    navigate("/", { replace: true });
  }

  if (branches.length === 1) {
    return null;
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-900 p-6">
      <div className="w-full max-w-md card p-6 shadow-erp-lg">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 text-center">
          Select Working Branch
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center mt-1">
          Choose one of your assigned branches to continue.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-status-error/30 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-status-error text-sm">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          <label className="label">Branch</label>
          <select
            className="input w-full"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={loading || branches.length === 0}
          >
            <option value="">Select a branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.company_name})
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn-primary w-full mt-6"
          onClick={onContinue}
          disabled={loading || !selectedId}
        >
          {loading ? "Loading…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
