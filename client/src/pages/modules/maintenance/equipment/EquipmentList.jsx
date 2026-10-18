/**
 * @fileoverview EquipmentList component.
 * Unified Equipment & Maintenance Assets Register with Telemetry Meter Readings.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { 
  Eye, 
  ArrowLeft, 
  Activity, 
  Plus, 
  Search, 
  Tag, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Wrench, 
  ShieldCheck 
} from "lucide-react";
import { ListPrintIconButton, ListPdfIconButton, ListAttachmentIconButton } from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import AssetMeterModal from "../assets/AssetMeterModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const statusColors = {
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  UNDER_REPAIR: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  INACTIVE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  DECOMMISSIONED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800",
};

export default function EquipmentList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showMeterModal, setShowMeterModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get("/maintenance/equipment")
      .then((r) => {
        if (mounted) setItems(Array.isArray(r.data?.items) ? r.data.items : []);
      })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to load equipment"))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [location.state?.refresh]);

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    const total = items.length;
    const active = items.filter((r) => r.status === "ACTIVE").length;
    const underRepair = items.filter((r) => r.status === "UNDER_REPAIR").length;
    const warrantyExpired = items.filter((r) => r.warranty_expiry && r.warranty_expiry < today).length;
    return { total, active, underRepair, warrantyExpired };
  }, [items, today]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((r) => {
      const matchSearch =
        !q ||
        String(r.equipment_code || "").toLowerCase().includes(q) ||
        String(r.equipment_name || "").toLowerCase().includes(q) ||
        String(r.category || "").toLowerCase().includes(q) ||
        String(r.location || "").toLowerCase().includes(q) ||
        String(r.brand || "").toLowerCase().includes(q) ||
        String(r.serial_number || "").toLowerCase().includes(q);

      const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [items, search, statusFilter]);

  const handleOpenMeters = (equipment) => {
    setSelectedAsset({
      id: equipment.id,
      asset_name: equipment.equipment_name,
      equipment_code: equipment.equipment_code,
      uom: "Hours",
    });
    setShowMeterModal(true);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/maintenance?section=Equipment %26 Assets"
            className="btn btn-secondary flex items-center gap-1.5"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Equipment & Assets Register
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Manage enterprise equipment, assets, telemetry meters, and specifications
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/maintenance/equipment/new"
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            <span>New Equipment / Asset</span>
          </Link>
        </div>
      </div>

      {/* Apple HIG KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Equipment</span>
            <Tag size={16} />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{kpis.total}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Tracked in registry</span>
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Status</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{kpis.active}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Operational assets</span>
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Under Repair</span>
            <Wrench size={16} />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">{kpis.underRepair}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Work order in progress</span>
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Expired Warranty</span>
            <ShieldCheck size={16} />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-rose-700 dark:text-rose-300">{kpis.warrantyExpired}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Maintenance policy review</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="input pl-9 w-full"
                placeholder="Search code, name, category, brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {["ALL", "ACTIVE", "UNDER_REPAIR", "INACTIVE"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === st
                      ? "bg-white dark:bg-slate-900 text-brand-900 dark:text-brand-300 shadow-apple-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {st === "ALL" ? "All" : st.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>

        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className={"table " + (viewMode === "grid" ? "table-grid-mode" : "")}>
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Asset Code</th>
                  <th className="whitespace-nowrap">Equipment Name</th>
                  <th className="whitespace-nowrap">Category / Brand</th>
                  <th className="whitespace-nowrap">Location</th>
                  <th className="whitespace-nowrap">Serial Number</th>
                  <th className="whitespace-nowrap">Warranty</th>
                  <th className="whitespace-nowrap">Status</th>
                  <th className="whitespace-nowrap">Created Date</th>
                  <th className="text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="9" className="text-center py-10 text-slate-500 whitespace-nowrap">
                      Loading equipment registry...
                    </td>
                  </tr>
                )}
                {!loading && !filtered.length && (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-500 whitespace-nowrap">
                      No equipment or assets found
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((r) => {
                    const isWarrantyExpired = r.warranty_expiry && r.warranty_expiry < today;
                    const isNearExpiry = r.warranty_expiry && !isWarrantyExpired && r.warranty_expiry <= thirtyDaysAhead;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="font-mono text-xs font-bold text-brand-900 dark:text-brand-300 whitespace-nowrap">
                          {r.equipment_code || "-"}
                        </td>
                        <td className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {r.equipment_name}
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="text-slate-800 dark:text-slate-200 block text-xs font-medium">
                            {r.category || "-"}
                          </span>
                          {r.brand && (
                            <span className="text-slate-400 dark:text-slate-500 text-[11px] block">
                              {r.brand}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 text-xs">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span>{r.location || "-"}</span>
                          </div>
                        </td>
                        <td className="font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {r.serial_number || "-"}
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {r.warranty_expiry ? (
                            <span
                              className={`font-medium ${
                                isWarrantyExpired
                                  ? "text-rose-600 dark:text-rose-400"
                                  : isNearExpiry
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {r.warranty_expiry}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium border ${
                              statusColors[r.status] || "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {r.status || "ACTIVE"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}
                        </td>
                        <td className="whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              className="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                              title="View Details"
                              onClick={() => navigate(`/maintenance/equipment/${r.id}?mode=view`)}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                              title="Meter Readings (Hours/Odometer/Telemetry)"
                              onClick={() => handleOpenMeters(r)}
                            >
                              <Activity size={15} />
                            </button>
                            <ListPrintIconButton onClick={() => toast.info("Print preview coming soon")} />
                            <ListPdfIconButton onClick={() => toast.info("PDF download coming soon")} />
                            <ListAttachmentIconButton
                              onClick={() => {
                                setActiveDocId(r.id);
                                setShowAttach(true);
                              }}
                            />
                            <Link
                              to={`/maintenance/equipment/${r.id}`}
                              className="btn btn-secondary btn-sm ml-1"
                            >
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Meter Readings Modal */}
      {showMeterModal && selectedAsset && (
        <AssetMeterModal
          asset={selectedAsset}
          onClose={() => {
            setShowMeterModal(false);
            setSelectedAsset(null);
          }}
        />
      )}

      {/* Document Attachments Modal */}
      {showAttach && activeDocId && (
        <DocumentAttachmentsModal
          open={showAttach}
          onClose={() => {
            setShowAttach(false);
            setActiveDocId(null);
          }}
          docType="maintenance"
          docId={activeDocId}
        />
      )}
    </div>
  );
}
