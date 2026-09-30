/**
 * @fileoverview CustomerList component.
 * Provides functionality for CustomerList.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { api } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { useDispatch, useSelector } from "react-redux";
import { fetchCustomers } from "../../../../modules/customers/customerSlice.js";
import {
  selectAllCustomers,
  selectCustomersLoading,
  selectCustomersError,
  makeSelectCustomersBySearch,
} from "../../../../modules/customers/customerSelectors.js";
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
export default function CustomerList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = React.useRef(null);
  const dispatch = useDispatch();
  const loading = useSelector(selectCustomersLoading) === "pending";
  const error = useSelector(selectCustomersError) || "";
  const allCustomers = useSelector(selectAllCustomers);
  const [searchTerm, setSearchTerm] = useState("");
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteRaw, setBulkDeleteRaw] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkForce, setBulkForce] = useState(false);
  const [bulkCascade, setBulkCascade] = useState(false);
  const [bulkCleanupFinance, setBulkCleanupFinance] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { hasAccess, scope } = useAuth();
  const { canPerformAction } = usePermission();
  const [branchOnly, setBranchOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const selectBySearch = React.useMemo(makeSelectCustomersBySearch, []);
  const filteredCustomers = useSelector((s) => selectBySearch(s, searchTerm));

  useEffect(() => {
    dispatch(
      fetchCustomers({ force: true, params: { active: !showInactive } }),
    );
  }, [dispatch, showInactive]);

  // Show success message from navigation state
  useEffect(() => {
    const message = location.state?.afterSave?.message;
    if (message) {
      setSuccessMessage(message);
      // Clear success message after 3 seconds
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      // Clear location state
      window.history.replaceState({}, document.title);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const refreshThunk = React.useCallback(() => {
    dispatch(fetchCustomers({ force: true, params: { active: !showInactive } }));
  }, [dispatch, showInactive]);

  useAfterSaveRefresh("customers", refreshThunk);

  const refresh = () =>
    dispatch(
      fetchCustomers({ force: true, params: { active: !showInactive } }),
    );

  const downloadTemplate = async () => {
    try {
      const response = await api.get("/sales/customers/template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "CustomerTemplate.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error downloading template", err);
      alert("Error downloading template");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setImportLoading(true);
      await api.post("/sales/customers/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Customers imported successfully!");
      refresh();
    } catch (err) {
      console.error("Error importing customers", err);
      alert(err?.response?.data?.message || "Error importing customers");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const branchFiltered = branchOnly
    ? filteredCustomers.filter(
        (x) => String(x.branch_id || "") === String(scope?.branchId || ""),
      )
    : filteredCustomers;

  const { sorted: sortedBranchFiltered, sortKey, sortDir, toggle } = useSort(branchFiltered, "created_at", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Customer Setup
            </h1>
            <p className="text-sm mt-1">
              Manage customers and their information
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="btn btn-secondary">
              Template
            </button>
            <button
              className={`btn btn-primary ${importLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || importLoading}
            >
              {importLoading ? "Importing..." : "Import"}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".xlsx, .xls"
              onChange={handleImport}
            />
            <Link to="/sales?section=Customer%20Management" className="btn btn-secondary">
              Return to Menu
            </Link>
            <Link to="/sales/customers/new" className="btn-success">
              + New Customer
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}
      {loading && (
        <div className="alert">
          <span>Loading customers...</span>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <span>{successMessage}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="mb-4 flex items-center gap-3">
            <input
              type="text"
              placeholder="Search customers..."
              className="input"
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
                              navigate(`/sales/customers/${r.id}?mode=view`)
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
                                "sales:customers",
                                "edit",
                              )
                                ? "invisible pointer-events-none"
                                : ""
                            }`}
                            onClick={() => navigate(`/sales/customers/${r.id}`)}
                          >
                            Edit
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
            {filteredCustomers.length === 0 && (
              <div className="text-center py-8 text-slate-600">
                No customers found
              </div>
            )}
          </div>
        </div>
      </div>

      {showBulkDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-lg overflow-hidden">
            <div className="p-4 bg-red-600 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Bulk Delete Customers</h2>
              <button
                onClick={() => {
                  setShowBulkDelete(false);
                  setBulkDeleteRaw("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Paste names and/or codes. Raw blobs accepted; codes like C00003
                will be detected.
              </div>
              <textarea
                className="input w-full h-40"
                placeholder="Enter customer names/codes/raw data..."
                value={bulkDeleteRaw}
                onChange={(e) => setBulkDeleteRaw(e.target.value)}
              />
              <div className="text-xs text-slate-600">
                This action deletes matching customers for the current company.
              </div>
              <label className="flex items-center gap-2 text-sm mt-2">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={bulkForce}
                  onChange={(e) => setBulkForce(e.target.checked)}
                />
                <span>Force delete (temporarily disable constraints)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={bulkCascade}
                  onChange={(e) => setBulkCascade(e.target.checked)}
                />
                <span>Cascade delete (remove dependent sales rows)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={bulkCleanupFinance}
                  onChange={(e) => setBulkCleanupFinance(e.target.checked)}
                />
                <span>Also cleanup finance accounts</span>
              </label>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowBulkDelete(false);
                  setBulkDeleteRaw("");
                }}
                disabled={bulkDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  if (!bulkDeleteRaw.trim()) {
                    alert("Enter names or codes to delete.");
                    return;
                  }
                  if (
                    !window.confirm(
                      "Are you sure you want to delete the provided customers?",
                    )
                  ) {
                    return;
                  }
                  try {
                    setBulkDeleting(true);
                    const res = await api.post("/sales/customers/bulk-delete", {
                      raw: bulkDeleteRaw,
                      force: bulkForce,
                      cascade: bulkCascade,
                      cleanup_finance: bulkCleanupFinance,
                    });
                    const a = Number(res?.data?.deletedByName || 0);
                    const b = Number(res?.data?.deletedByCode || 0);
                    const matched = Number(res?.data?.matched || 0);
                    const deleted = Number(res?.data?.deleted || a + b);
                    const msg =
                      a || b
                        ? `Deleted by name: ${a}\nDeleted by code: ${b}\nTotal: ${
                            a + b
                          }`
                        : `Matched: ${matched}\nDeleted: ${deleted}`;
                    alert(msg);
                    setShowBulkDelete(false);
                    setBulkDeleteRaw("");
                    dispatch(fetchCustomers({ force: true, params: { active: !showInactive } }));
                  } catch (err) {
                    alert(
                      err?.response?.data?.message ||
                        "Bulk delete failed. Ensure you have delete rights.",
                    );
                  } finally {
                    setBulkDeleting(false);
                  }
                }}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
