/**
 * @fileoverview PotentialCustomerList component.
 * Provides functionality for PotentialCustomerList.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { useDispatch, useSelector } from "react-redux";
import { useAfterSaveRefresh } from "../../../../hooks/useAfterSaveRefresh.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PotentialCustomerList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteRaw, setBulkDeleteRaw] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [branchOnly, setBranchOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const { hasAccess, scope } = useAuth();
  const { canPerformAction } = usePermission();

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/sales/prospect-customers", {
        params: { active: !showInactive },
      });
      setCustomers(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (err) {
      setError(
        err?.response?.data?.message || "Error fetching prospective customers",
      );
      console.error("Error fetching prospective customers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [showInactive]);

  useAfterSaveRefresh("prospect_customers", fetchCustomers);

  const refresh = () => {
    fetchCustomers();
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await api.delete(`/sales/prospect-customers/${id}`);
      alert("Prospective customer deleted successfully!");
      fetchCustomers();
    } catch (err) {
      alert(
        err?.response?.data?.message || "Error deleting prospective customer",
      );
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.customer_code &&
        c.customer_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const branchFiltered = branchOnly
    ? filteredCustomers.filter(
        (x) => String(x.branch_id || "") === String(scope?.branchId || ""),
      )
    : filteredCustomers;

  const { sorted: sortedBranchFiltered, sortKey, sortDir, toggle } = useSort(branchFiltered, "created_at", "desc");

  if (loading && customers.length === 0) {
    return (
      <div className="text-center py-8">Loading prospective customers...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Prospective Customer Setup
            </h1>
            <p className="text-sm mt-1">
              Manage prospective customers and quotation information
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/sales" className="btn btn-secondary">
              Return to Menu
            </Link>
            <Link to="/sales/prospect-customers/new" className="btn-success">
              + New Prospective Customer
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="mb-4 flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by name, code, or email..."
              className="input flex-1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={branchOnly}
                onChange={(e) => setBranchOnly(e.target.checked)}
              />
              Branch Only
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show Inactive
            </label>
            <button className="btn btn-outline" onClick={refresh}>
              Refresh
            </button>
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <SortableHeader label="Code" sortKey="customer_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Name" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Type" sortKey="customer_type" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Price Type" sortKey="price_type_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Contact" sortKey="contact_person" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Email/Phone" sortKey="email" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Credit Limit" sortKey="credit_limit" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Status" sortKey="is_active" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th>Actions</th>
                  <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sortedBranchFiltered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.customer_code}</td>
                    <td>
                      <div className="font-bold">{r.customer_name}</div>
                      {r.address && (
                        <div className="text-xs text-slate-500 truncate max-w-[200px]">
                          {r.address}
                        </div>
                      )}
                    </td>
                    <td>{r.customer_type || "-"}</td>
                    <td>{r.price_type_name || "-"}</td>
                    <td>{r.contact_person || "-"}</td>
                    <td>
                      <div className="text-sm">{r.email}</div>
                      <div className="text-xs text-slate-500">{r.phone}</div>
                    </td>
                    <td>
                      {r.credit_limit
                        ? `${Number(r.credit_limit).toFixed(2)}`
                        : "-"}
                    </td>
                    <td>
                      {r.is_active ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-error">Inactive</span>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <div className="min-w-[80px]">
                          <button
                            type="button"
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                            onClick={() =>
                              navigate(
                                `/sales/prospect-customers/${r.id}?mode=view`,
                              )
                            }
                          >
                            View
                          </button>
                        </div>
                        <div className="min-w-[80px]">
                          <button
                            type="button"
                            className={`w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9 ${
                              !canPerformAction(
                                "sales:potential-customers",
                                "edit",
                              )
                                ? "invisible pointer-events-none"
                                : ""
                            }`}
                            onClick={() =>
                              navigate(`/sales/prospect-customers/${r.id}`)
                            }
                          >
                            Edit
                          </button>
                        </div>
                        <div className="min-w-[80px]">
                          <button
                            type="button"
                            className={`w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors h-9 ${
                              !canPerformAction(
                                "sales:potential-customers",
                                "delete",
                              )
                                ? "invisible pointer-events-none"
                                : ""
                            }`}
                            onClick={() => handleDelete(r.id, r.customer_name)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>{r.created_by_name || "-"}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {branchFiltered.length === 0 && (
              <div className="text-center py-8 text-slate-600">
                {customers.length === 0
                  ? "No potential customers found. Create one to get started."
                  : "No matching potential customers found"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
