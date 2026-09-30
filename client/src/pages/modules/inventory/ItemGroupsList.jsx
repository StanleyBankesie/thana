/**
 * @fileoverview ItemGroupsList component.
 * Provides functionality for ItemGroupsList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ItemGroupsList() {
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoriesError, setCategoriesError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    setCategoriesLoading(true);
    setCategoriesError("");

    api
      .get("/inventory/item-groups")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load item groups");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    api
      .get("/inventory/item-categories")
      .then((res) => {
        if (!mounted) return;
        setCategories(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setCategoriesError(
          e?.response?.data?.message || "Failed to load item categories",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setCategoriesLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, {
      query: searchTerm,
      getKeys: (g) => [g.group_code, g.group_name, g.parent_group_name],
    });
  }, [items, searchTerm]);

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories.slice();
    return filterAndSort(categories, {
      query: searchTerm,
      getKeys: (c) => [c.category_code, c.category_name, c.parent_category_name],
    });
  }, [categories, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Item Groups &amp; Sub Groups
              </h1>
              <p className="text-sm mt-1">Organize items by categories</p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/inventory/item-groups/new"
                className="btn-success"
                data-rbac-exempt="true"
              >
                + New Group
              </Link>
            </div>
          </div>
        </div>

        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by code, name, or parent..."
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
                  <th>Code</th>
                  <th>Name</th>
                  <th>Parent</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && !filtered.length ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No item groups found
                    </td>
                  </tr>
                ) : null}

                {filtered.map((g) => (
                  <tr key={g.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {g.group_code}
                    </td>
                    <td>{g.group_name}</td>
                    <td>{g.parent_group_name || "-"}</td>
                    <td>{g.is_active ? "Yes" : "No"}</td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                      <Link
                        to={`/inventory/item-groups/${g.id}?mode=view`}
                        className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        data-rbac-exempt="true"
                      >
                        View
                      </Link>
                      <Link
                        to={`/inventory/item-groups/${g.id}?mode=edit`}
                        className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        data-rbac-exempt="true"
                      >
                        Edit
                      </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h2 className="text-xl font-bold dark:text-brand-300">
                Item Categories
              </h2>
              <p className="text-sm mt-1">Organize items by category</p>
            </div>
          </div>
        </div>

        <div className="card-body">
          {categoriesError ? (
            <div className="text-sm text-red-600 mb-4">{categoriesError}</div>
          ) : null}

          <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Parent</th>
                  <th>Active</th>
                                <th>Created By</th>
                <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {categoriesLoading ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!categoriesLoading && !filteredCategories.length ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No item categories found
                    </td>
                  </tr>
                ) : null}

                {filteredCategories.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {c.category_code}
                    </td>
                    <td>{c.category_name}</td>
                    <td>{c.parent_category_name || "-"}</td>
                    <td>{c.is_active ? "Yes" : "No"}</td>
                    <td>{c.created_by_name || "-"}</td>
                    <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}</td>
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
