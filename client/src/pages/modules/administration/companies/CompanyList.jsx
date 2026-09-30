/**
 * @fileoverview CompanyList component.
 * Provides functionality for CompanyList.
 */

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "api/client";
import { useAuth } from "@/auth/AuthContext.jsx";
import DataTable from "@/components/common/DataTable.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CompanyList() {
  const [viewMode, setViewMode] = useViewMode();
  const { user } = useAuth();
  const location = useLocation();
  const isSystemConfig = location.pathname.startsWith("/system-configuration");
  const moduleHome = isSystemConfig ? "/system-configuration" : "/administration";
  const basePath = isSystemConfig ? "/system-configuration/companies" : "/administration/companies";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/companies");
      setItems(res.data.items || []);
    } catch (err) {
      setError(err.message || "Failed to fetch companies");
    } finally {
      setLoading(false);
    }
  };

  if (Number(user?.id) !== 1) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">
          You do not have permission to view the Company Setup page.
        </p>
      </div>
    );
  }

  const columns = [
    { header: "Code", accessor: "code" },
    { header: "Name", accessor: "name" },
    { 
      header: "Status", 
      accessor: "is_active",
      render: (c) => c.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-error">Inactive</span>
    },
    { 
      header: "Created By", 
      accessor: (c) => c.created_by_name || "-" 
    },
    { 
      header: "Created Date", 
      accessor: "created_at",
      render: (c) => c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"
    },
    {
      header: "Actions",
      filterable: false,
      sortable: false,
      render: (c) => (
        <Link
          to={`${basePath}/${c.id}`}
          className="text-brand hover:text-brand-600 text-sm font-medium"
        >
          Edit
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Company Setup
          </h1>
          <p className="text-sm mt-1">Manage companies</p>
        </div>
        <div className="flex gap-2">
          <Link to={moduleHome} className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link to={`${basePath}/new`} className="btn-success">
            + New Company
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : error ? (
            <div className="text-red-500 py-4">{error}</div>
          ) : (
            <DataTable data={items} columns={columns} defaultSortColumn="Created Date" />
          )}
        </div>
      </div>
    </div>
  );
}
