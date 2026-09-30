import React, { useState, useEffect, useCallback } from "react";
import {
  Package, AlertTriangle, Layers, ExternalLink, ArrowRight, TrendingUp,
  DollarSign, Building2
} from "lucide-react";
import { api } from "../../../api/client.js";
import {
  PageHeader, KpiCard, SectionCard, DataTable, ErrorAlert, fmtCurrency, fmtNum
} from "./bi.shared.jsx";
import BIFilterBar from "./components/BIFilterBar.jsx";
import BIAnalysisToolbar from "./components/BIAnalysisToolbar.jsx";
import BIDrillDownModal from "./components/BIDrillDownModal.jsx";
import BIExportModal from "./components/BIExportModal.jsx";
import BIShareModal from "./components/BIShareModal.jsx";
import BISavedAnalysesModal from "./components/BISavedAnalysesModal.jsx";

export default function InventoryAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Workflow Filters & Dimensions
  const [filters, setFilters] = useState({
    datePreset: "LAST_30",
    compareWith: "NONE",
    branchId: "",
  });
  const [activeDimension, setActiveDimension] = useState("categories");

  // Workflow Modals State
  const [drillModal, setDrillModal] = useState({ isOpen: false, module: "inventory", dimension: "summary", title: "Inventory Valuation Breakdown" });
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filters.branchId) q.append("branchId", filters.branchId);

      const res = await api.get(`/bi/inventory?${q.toString()}`);
      setData(res.data?.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load inventory analytics.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary || {};
  const totalItems = Number(summary.totalItems || 0);
  const totalStockQty = Number(summary.totalQty || 0);
  const totalValuation = Number(summary.totalValue || 0);
  const lowStockCount = Number(summary.lowStockItems || data?.lowStock?.length || 0);

  const kpisForExport = [
    { label: "Total Catalog Items", value: fmtNum(totalItems), sub: "Tracked SKUs" },
    { label: "Total Stock Volume", value: `${fmtNum(totalStockQty)} units`, sub: "Across all categories" },
    { label: "Total Inventory Valuation", value: fmtCurrency(totalValuation), sub: "Asset value in stock" },
    { label: "Low Stock Items", value: fmtNum(lowStockCount), sub: "Requiring reorder" },
  ];

  const exportTableColumns = [
    { key: "category_name", label: "Category" },
    { key: "itemCount", label: "Items" },
    { key: "totalQty", label: "Total Qty" },
    { key: "totalValue", label: "Estimated Value (GHS)" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Intelligence & Analytics"
        description="Live stock balances by category, asset valuation, low-stock deficit alerts, warehouse distribution, and movement velocity"
        onRefresh={load}
        loading={loading}
      />

      {/* 1. Multi-Dimensional Filter Bar */}
      <BIFilterBar
        moduleKey="inventory"
        filters={filters}
        onFilterChange={setFilters}
        onApply={load}
        onReset={() => setFilters({ datePreset: "LAST_30", compareWith: "NONE", branchId: "" })}
        loading={loading}
      />

      {/* 2. Analysis & Workflow Toolbar */}
      <BIAnalysisToolbar
        moduleKey="inventory"
        dimensions={[
          { label: "By Category", value: "categories" },
          { label: "Warehouse Stock", value: "warehouses" },
          { label: "Low Stock Alerts", value: "low_stock" },
          { label: "Top Moving Items", value: "movement" },
        ]}
        activeDimension={activeDimension}
        onDimensionChange={setActiveDimension}
        onOpenDrillDown={() => setDrillModal({ isOpen: true, module: "inventory", dimension: "category", title: "Inventory Value by Category" })}
        onOpenExport={() => setExportOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        onOpenSaved={() => setSavedOpen(true)}
      />

      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* 3. Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setDrillModal({ isOpen: true, module: "inventory", dimension: "category", title: "Stock Items Catalog" })}
          className="cursor-pointer"
        >
          <KpiCard
            label="Total Tracked Items"
            value={loading ? "..." : fmtNum(totalItems)}
            sub={`${fmtNum(totalStockQty)} total units in stock`}
            icon={Package}
            color="brand"
          />
        </div>
        <div
          onClick={() => setDrillModal({ isOpen: true, module: "inventory", dimension: "category", title: "Stock Items Valuation" })}
          className="cursor-pointer"
        >
          <KpiCard
            label="Inventory Valuation"
            value={loading ? "..." : fmtCurrency(totalValuation)}
            sub="Estimated asset valuation"
            icon={DollarSign}
            color="success"
          />
        </div>
        <div
          onClick={() => setDrillModal({ isOpen: true, module: "inventory", dimension: "items", title: "Low Stock Items Requiring Reorder" })}
          className="cursor-pointer"
        >
          <KpiCard
            label="Low Stock Items"
            value={loading ? "..." : fmtNum(lowStockCount)}
            sub="Below minimum reorder threshold"
            icon={AlertTriangle}
            color={lowStockCount > 0 ? "danger" : "success"}
          />
        </div>
        <KpiCard
          label="Top Moving Velocity"
          value={loading ? "..." : `${data?.topMovingItems?.length || 0} active SKUs`}
          sub="Highest velocity moving items"
          icon={TrendingUp}
          color="primary"
        />
      </div>

      {/* 4. Categorized Breakdown & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Live Stock by Category (Click to Drill In)">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data?.byCategory || []).map((c, i) => {
                const max = Math.max(...(data?.byCategory || []).map((d) => Number(d.totalQty || 0)), 1);
                const w = (Number(c.totalQty || 0) / max * 100).toFixed(0);
                return (
                  <div
                    key={i}
                    onClick={() => setDrillModal({ isOpen: true, module: "inventory", dimension: "items", title: `Items in Category: ${c.category_name}` })}
                    className="px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex justify-between mb-1.5 text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors flex items-center gap-1.5">
                        <span>{c.category_name}</span>
                        <Layers size={11} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                      <span className="text-slate-500 font-medium">
                        {fmtNum(c.totalQty)} units · {fmtNum(c.itemCount)} items · {fmtCurrency(c.totalValue)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-brand-600 group-hover:bg-brand-700 transition-all" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                );
              })}
              {!data?.byCategory?.length && (
                <div className="p-8 text-center text-slate-400 text-sm">No category records found in database.</div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Low Stock Alerts */}
        <SectionCard title="Low Stock Deficit Alerts">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-primary" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {loading ? "—" : (data?.lowStock?.length || 0)} items below reorder level
              </span>
            </div>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
              {(data?.lowStock || []).map((item, i) => (
                <div
                  key={i}
                  onClick={() => setDrillModal({ isOpen: true, module: "inventory", dimension: "items", title: `Item Detail: ${item.item_name}` })}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                      {item.item_name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{item.item_code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-red-600">{fmtNum(item.qty)} units</div>
                    <div className="text-[10px] text-slate-400">Reorder Min: {fmtNum(item.reorderLevel)}</div>
                  </div>
                </div>
              ))}
              {!data?.lowStock?.length && (
                <div className="p-8 text-center text-green-600 text-xs font-semibold">
                  ✓ All stock levels are currently within safe operational limits.
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Warehouse Distribution */}
        <SectionCard title="Stock Distribution by Warehouse">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data?.byWarehouse || []).map((w, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-400" />
                      <span>{w.warehouse_name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{w.warehouse_code} · {w.itemCount} SKUs</div>
                  </div>
                  <div className="text-sm font-bold text-brand-700 dark:text-brand-300">
                    {fmtNum(w.totalQty)} units
                  </div>
                </div>
              ))}
              {!data?.byWarehouse?.length && (
                <div className="p-6 text-center text-slate-400 text-xs">No warehouse stock data recorded.</div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Top Moving Items */}
        <SectionCard title="Top Moving Items (Sales & Invoices Velocity)">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={[
                { key: "idx", label: "#", className: "text-slate-400 font-bold w-8" },
                {
                  key: "item_name",
                  label: "Item Name",
                  className: "font-semibold text-slate-800 dark:text-slate-200",
                  render: (v) => (
                    <button
                      onClick={() => setDrillModal({ isOpen: true, module: "inventory", dimension: "items", title: `Item Detail: ${v}` })}
                      className="font-semibold text-left text-brand-700 dark:text-brand-300 hover:underline flex items-center gap-1.5"
                    >
                      <span>{v}</span>
                      <Layers size={11} className="text-slate-400" />
                    </button>
                  )
                },
                { key: "item_code", label: "Item Code", className: "text-slate-400 font-mono text-xs" },
                { key: "moved", label: "Units Moved", className: "text-brand-700 dark:text-brand-300 font-bold text-right", render: v => fmtNum(v) },
              ]}
              rows={(data?.topMovingItems || []).map((r, i) => ({ ...r, idx: i + 1 }))}
              emptyMessage="No stock movements recorded for the selected period."
            />
          )}
        </SectionCard>
      </div>

      {/* Workflow Modals */}
      <BIDrillDownModal
        isOpen={drillModal.isOpen}
        onClose={() => setDrillModal({ ...drillModal, isOpen: false })}
        initialModule={drillModal.module}
        initialDimension={drillModal.dimension}
        initialTitle={drillModal.title}
        filters={drillModal.filters || filters}
      />

      <BIExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Inventory Intelligence & Stock Analytics"
        moduleName="Inventory"
        filters={filters}
        kpis={kpisForExport}
        columns={exportTableColumns}
        rows={data?.byCategory || []}
      />

      <BIShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Inventory Intelligence & Stock Analytics"
        moduleKey="inventory"
        filters={filters}
      />

      <BISavedAnalysesModal
        isOpen={savedOpen}
        onClose={() => setSavedOpen(false)}
        moduleKey="inventory"
        onLoadAnalysis={(a) => {
          setFilters(a.filters || {});
        }}
      />
    </div>
  );
}
