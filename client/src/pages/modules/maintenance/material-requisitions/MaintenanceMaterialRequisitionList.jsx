/**
 * @fileoverview MaintenanceMaterialRequisitionList component.
 * Provides functionality for MaintenanceMaterialRequisitionList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceMaterialRequisitionList() {
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get("/maintenance/material-requisitions")
      .then((res) => {
        if (mounted)
          setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => setError(e?.response?.data?.message || "Failed to load"))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const getStatusBadge = (status) => {
    const b = {
      DRAFT: "badge-info",
      PENDING_APPROVAL: "badge-warning",
      APPROVED: "badge-success",
      REJECTED: "badge-error",
      CANCELLED: "badge-error",
    };
    return b[status] || "badge-info";
  };

  const handleSubmit = async (id) => {
    setForwarding(true);
    try {
      await api.post(`/maintenance/material-requisitions/${id}/submit`);
      toast.success("Submitted for approval");
      const res = await api.get("/maintenance/material-requisitions");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Submit failed");
    } finally {
      setForwarding(false);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, {
      query: searchTerm,
      getKeys: (r) => [r.requisition_no, r.requested_by],
    });
  }, [items, searchTerm]);

  const { sorted, sortKey, sortDir, toggle } = useSort(
    filtered,
    "created_at",
    "desc",
  );

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Material Requisitions
              </h1>
              <p className="text-sm mt-1">
                Request materials for maintenance operations
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => (window.location.href = "/maintenance?section=Procurement %26 Materials")} className="btn btn-secondary">Back</button>
              <button onClick={() => (window.location.href = "/maintenance/material-requisitions/new")} className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700">+ New Requisition</button>
            </div>
          </div>
        </div>
        <div className="card-body">
          {loading ? <div className="text-sm mb-4">Loading...</div> : null}
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by requisition number or requested by..."
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
                  <SortableHeader
                    label="Requisition No"
                    sortKey="requisition_no"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Date"
                    sortKey="requisition_date"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Requested By"
                    sortKey="requested_by"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <th className="text-left w-full whitespace-nowrap">Warehouse</th>
                  <th className="text-left whitespace-nowrap">Department</th>
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <th className="text-left w-24 whitespace-nowrap">Actions</th>
                  <SortableHeader
                    label="Created By"
                    sortKey="created_by_username"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Created Date"
                    sortKey="created_at"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300 whitespace-nowrap">
                      {r.requisition_no}
                    </td>
                    <td className="whitespace-nowrap">
                      {r.requisition_date
                        ? new Date(r.requisition_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap">{r.requested_by || "-"}</td>
                    <td className="whitespace-nowrap">{r.warehouse_name || "-"}</td>
                    <td className="whitespace-nowrap">{r.department_name || "-"}</td>
                    <td className="whitespace-nowrap">
                      <span className={`badge ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-left whitespace-nowrap">
                      <div className="flex items-center justify-start gap-2">
                        {r.status === "DRAFT" ? (
                          <>
                            <Link
                              to={`/maintenance/material-requisitions/${r.id}`}
                              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200"
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleSubmit(r.id)}
                              disabled={forwarding}
                              className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                            >
                              Confirm
                            </button>
                          </>
                        ) : (
                          <Link
                            to={`/maintenance/material-requisitions/${r.id}?view=1`}
                            className="px-3 py-1.5 text-xs font-medium text-brand bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100"
                          >
                            View
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDocId(r.id);
                            setShowAttach(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors"
                          title="Attachments"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{r.created_by_username || r.created_by_name || "-"}</td>
                    <td className="whitespace-nowrap">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
                {!sorted.length && !loading && (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-slate-500 whitespace-nowrap">
                      No requisitions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
        }}
        docType="maint-material-requisition"
        docId={activeDocId}
      />
    </div>
  );
}
