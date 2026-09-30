/**
 * @fileoverview DiscountSchemeList component.
 * Provides functionality for DiscountSchemeList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import "./DiscountSchemeList.css";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DiscountSchemeList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchSchemes();
  }, [location.pathname]);

  async function fetchSchemes() {
    try {
      setLoading(true);
      const schemesRes = await api.get("/sales/discount-schemes");
      setSchemes(
        Array.isArray(schemesRes.data?.items) ? schemesRes.data.items : [],
      );
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const filteredSchemes = useMemo(() => {
    return schemes.filter((s) => {
      const matchesStatus = filterStatus
        ? filterStatus === "ACTIVE"
          ? s.is_active
          : !s.is_active
        : true;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        s.scheme_code?.toLowerCase().includes(q) ||
        s.scheme_name?.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [schemes, filterStatus, searchTerm]);

  const {
    sorted: sortedSchemes,
    sortKey,
    sortDir,
    toggle,
  } = useSort(filteredSchemes, "created_at", "desc");

  if (loading && !schemes.length)
    return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="promo-campaign-container">
      <header className="ds-header">
        <div className="ds-header-top">
          <div>
            <h1>🏷️ Discount Campaigns</h1>
            <p>Percentage and fixed-amount discount campaigns</p>
          </div>
          <div className="ds-header-actions">
            <button onClick={() => window.history.back()} className="ds-btn ds-btn-secondary"
            >
              Back to Campaign Types
            </button>
            <button
              className="ds-btn ds-btn-primary"
              onClick={() => navigate("/sales/discount-schemes/discount/new")}
            >
              ➕ New Discount Campaign
            </button>
          </div>
        </div>
      </header>

      <div className="ds-card">
        <div className="ds-action-bar">
          <div className="ds-search-box">
            <input
              type="text"
              placeholder="Search by code, name, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="ds-filter-section">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div className="flex justify-end mb-4">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
          <table className={"ds-table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <SortableHeader
                  label="Code"
                  sortKey="scheme_code"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                />
                <SortableHeader
                  label="Campaign Name"
                  sortKey="scheme_name"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                />
                <SortableHeader
                  label="Type"
                  sortKey="discount_type"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                />
                <SortableHeader
                  label="Value"
                  sortKey="discount_value"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                />
                <SortableHeader
                  label="Valid From"
                  sortKey="effective_from"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                />
                <SortableHeader
                  label="Valid To"
                  sortKey="effective_to"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                />
                <SortableHeader
                  label="Status"
                  sortKey="is_active"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                />
                <th>Edit</th>
                <SortableHeader
                  label="Created By"
                  sortKey="created_by_name"
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
              {sortedSchemes.length === 0 ? (
                <tr>
                  <td colSpan="10" className="ds-empty-state">
                    No discount campaigns found
                  </td>
                </tr>
              ) : (
                sortedSchemes.map((scheme) => (
                  <tr
                    key={scheme.id}
                    onClick={() =>
                      navigate(`/sales/discount-schemes/discount/${scheme.id}`)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <strong>{scheme.scheme_code}</strong>
                    </td>
                    <td>{scheme.scheme_name}</td>
                    <td>
                      <span
                        className={`ds-badge ds-badge-${scheme.discount_type === "PERCENTAGE" ? "percentage" : "fixed"}`}
                      >
                        {scheme.discount_type}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {scheme.discount_type === "PERCENTAGE"
                          ? Number(scheme.discount_value) + "%"
                          : "$" + Number(scheme.discount_value).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      {new Date(scheme.effective_from).toLocaleDateString()}
                    </td>
                    <td>
                      {scheme.effective_to
                        ? new Date(scheme.effective_to).toLocaleDateString()
                        : "No expiry"}
                    </td>
                    <td>
                      <span
                        className={`ds-badge ds-badge-${scheme.is_active ? "active" : "inactive"}`}
                      >
                        {scheme.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/sales/discount-schemes/discount/${scheme.id}`}
                        className="ds-btn ds-btn-sm ds-btn-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Edit
                      </Link>
                    </td>
                    <td>{scheme.created_by_name || "-"}</td>
                    <td>
                      {scheme.created_at
                        ? new Date(scheme.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
