/**
 * @fileoverview TransferAcceptanceList component.
 * Provides functionality for TransferAcceptanceList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import { filterAndSort } from "@/utils/searchUtils.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function TransferAcceptanceList() {
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);

  const handleConfirmDirect = async (id, transferNo) => {
    setConfirmingId(id);
    setError("");
    try {
      await api.put(`/inventory/transfer-acceptance/${id}`, {});
      toast.success(`Transfer ${transferNo} confirmed successfully!`);
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to confirm transfer");
    } finally {
      setConfirmingId(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/inventory/transfer-acceptance")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load transfers");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, {
      query: searchTerm,
      getKeys: (t) => [
        t.transfer_no,
        t.from_warehouse_name || t.from_warehouse_id,
        t.to_warehouse_name || t.to_warehouse_id,
        t.status,
      ],
    });
  }, [items, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Transfer Acceptance
              </h1>
              <p className="text-sm mt-1">Receive transferred stock</p>
            </div>
            <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>

        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by transfer no, from warehouse, status..."
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
                  <th>Transfer No</th>
                  <th>Date</th>
                  <th>From Warehouse</th>
                  <th>To Warehouse</th>
                  <th>Status</th>
                  <th>Actions</th>
                                <th>Created By</th>
                <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && !filtered.length ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No transfers available for acceptance
                    </td>
                  </tr>
                ) : null}

                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {t.transfer_no}
                    </td>
                    <td>
                      {t.transfer_date
                        ? String(t.transfer_date).slice(0, 10)
                        : "-"}
                    </td>
                    <td>
                      {t.from_warehouse_name || t.from_warehouse_id || "-"}
                    </td>
                    <td>{t.to_warehouse_name || t.to_warehouse_id || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          t.status === "TRANSFERRED" || t.status === "RECEIVED"
                            ? "badge-success"
                            : ["IN_TRANSIT", "IN TRANSIT", "PARTIALLY_RECEIVED"].includes(t.status)
                            ? "badge-warning"
                            : t.status === "CANCELLED"
                            ? "badge-error"
                            : "badge-info"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Link
                          to={`/inventory/transfer-acceptance/${t.id}`}
                          className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          Open
                        </Link>
                        {!["TRANSFERRED", "RECEIVED", "CANCELLED"].includes(t.status) && (
                          <button
                            type="button"
                            onClick={() => handleConfirmDirect(t.id, t.transfer_no)}
                            disabled={confirmingId === t.id}
                            className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-white bg-green-600 border border-transparent rounded-full hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {confirmingId === t.id ? "Confirming..." : "Confirm"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>{t.created_by_name || "-"}</td>
                    <td>{t.created_at ? new Date(t.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
