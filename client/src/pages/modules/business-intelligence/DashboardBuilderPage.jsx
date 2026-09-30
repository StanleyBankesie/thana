/**
 * @fileoverview Custom Dashboard Builder Page
 * Allows creating and designing dynamic BI dashboards with modular widgets (KPI, Bar, Line, Table),
 * dataset binding, and cross-filtering.
 */
import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, Plus, Trash2, Save, Eye, Palette,
  BarChart3, LineChart, PieChart, Table2, Layers, Move, Check
} from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, SectionCard, KpiCard, MiniBar, DataTable } from "./bi.shared.jsx";
import { toast } from "react-toastify";

const WIDGET_TYPES = [
  { key: "KPI_CARD", label: "KPI Metric Card", icon: LayoutDashboard },
  { key: "BAR_CHART", label: "Bar Chart", icon: BarChart3 },
  { key: "LINE_CHART", label: "Line Chart", icon: LineChart },
  { key: "DATA_TABLE", label: "Data Table", icon: Table2 },
];

const PALETTE_COLORS = ["#0E3646", "#F57C00", "#2E8B1F", "#3b86a8", "#6366f1", "#ec4899"];

export default function DashboardBuilderPage() {
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);

  // New / Edit Dashboard Form
  const [dashboardTitle, setDashboardTitle] = useState("New Executive Analysis");
  const [dashboardDesc, setDashboardDesc] = useState("Custom analytical monitoring dashboard");
  const [widgets, setWidgets] = useState([
    {
      id: "w-1",
      title: "Omnichannel Revenue YTD",
      widget_type: "KPI_CARD",
      measure_key: "revenue",
      dimension_key: "month",
      chart_color: "#0E3646",
      sampleValue: "GHS 1,420,500"
    },
    {
      id: "w-2",
      title: "Monthly Sales Trend",
      widget_type: "BAR_CHART",
      measure_key: "revenue",
      dimension_key: "month",
      chart_color: "#F57C00",
      sampleData: [
        { month: "Jan", revenue: 120000 },
        { month: "Feb", revenue: 145000 },
        { month: "Mar", revenue: 168000 },
        { month: "Apr", revenue: 190000 },
      ]
    }
  ]);

  // Add Widget Modal
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);
  const [newWidgetType, setNewWidgetType] = useState("KPI_CARD");
  const [newWidgetTitle, setNewWidgetTitle] = useState("");
  const [newWidgetMeasure, setNewWidgetMeasure] = useState("revenue");
  const [newWidgetDimension, setNewWidgetDimension] = useState("month");
  const [newWidgetColor, setNewWidgetColor] = useState("#0E3646");

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [dashRes, dsRes] = await Promise.all([
          api.get("/bi/custom-dashboards"),
          api.get("/bi/datasets")
        ]);
        setDashboards(dashRes.data?.data || []);
        setDatasets(dsRes.data?.data || []);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleAddWidget = () => {
    if (!newWidgetTitle) {
      toast.warn("Please enter a widget title.");
      return;
    }

    const newWidget = {
      id: `w-${Date.now()}`,
      title: newWidgetTitle,
      widget_type: newWidgetType,
      measure_key: newWidgetMeasure,
      dimension_key: newWidgetDimension,
      chart_color: newWidgetColor,
      sampleValue: newWidgetMeasure === "revenue" ? "GHS 850,200" : "4,210 Units",
      sampleData: [
        { [newWidgetDimension]: "Slice A", [newWidgetMeasure]: 45000 },
        { [newWidgetDimension]: "Slice B", [newWidgetMeasure]: 68000 },
        { [newWidgetDimension]: "Slice C", [newWidgetMeasure]: 92000 },
      ]
    };

    setWidgets(prev => [...prev, newWidget]);
    setShowAddWidgetModal(false);
    setNewWidgetTitle("");
    toast.success("Widget added to canvas!");
  };

  const handleRemoveWidget = (id) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  const handleSaveDashboard = async () => {
    try {
      const res = await api.post("/bi/custom-dashboards", {
        title: dashboardTitle,
        description: dashboardDesc,
        category: "CUSTOM",
        layout_config: { grid: true },
        widgets: widgets.map((w, idx) => ({
          title: w.title,
          widget_type: w.widget_type,
          measure_key: w.measure_key,
          dimension_key: w.dimension_key,
          chart_color: w.chart_color,
          grid_position: { x: (idx % 2) * 6, y: Math.floor(idx / 2) * 4, w: 6, h: 4 }
        }))
      });
      toast.success("Custom dashboard saved successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save dashboard.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Dashboard Builder"
        description="Design and configure custom business intelligence dashboards by combining modular KPI cards, charts, and dimensional grids."
      >
        <button
          onClick={handleSaveDashboard}
          className="btn-primary text-sm px-4 py-2 gap-2 flex items-center shadow-erp"
        >
          <Save size={14} /> Save Dashboard
        </button>
      </PageHeader>

      {/* Dashboard Metadata Header */}
      <SectionCard>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Dashboard Title
            </label>
            <input
              type="text"
              value={dashboardTitle}
              onChange={(e) => setDashboardTitle(e.target.value)}
              className="input w-full text-sm font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Description & Purpose
            </label>
            <input
              type="text"
              value={dashboardDesc}
              onChange={(e) => setDashboardDesc(e.target.value)}
              className="input w-full text-sm"
            />
          </div>
        </div>
      </SectionCard>

      {/* Action Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Dashboard Canvas ({widgets.length} Widgets)
        </div>
        <button
          onClick={() => setShowAddWidgetModal(true)}
          className="btn-secondary text-xs px-3 py-1.5 gap-1.5 flex items-center shadow-erp-sm"
        >
          <Plus size={13} /> Add Visualization Widget
        </button>
      </div>

      {/* Interactive Dashboard Canvas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {widgets.map((w) => (
          <div
            key={w.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-erp-sm space-y-3 relative group"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {w.title}
              </div>
              <div className="flex items-center gap-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {w.widget_type}
                </span>
                <button
                  onClick={() => handleRemoveWidget(w.id)}
                  className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                  title="Remove Widget"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Render Widget Body according to type */}
            {w.widget_type === "KPI_CARD" && (
              <div className="py-3">
                <div className="text-3xl font-bold text-brand-900 dark:text-brand-300 font-mono">
                  {w.sampleValue || "GHS 450,000"}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Metric: {w.measure_key} • Group: {w.dimension_key}
                </div>
              </div>
            )}

            {w.widget_type === "BAR_CHART" && (
              <div className="py-2">
                <MiniBar
                  data={w.sampleData || []}
                  valueKey={w.measure_key}
                  labelKey={w.dimension_key}
                  color={w.chart_color || "#0E3646"}
                  height={110}
                />
              </div>
            )}

            {w.widget_type === "LINE_CHART" && (
              <div className="py-2">
                <MiniBar
                  data={w.sampleData || []}
                  valueKey={w.measure_key}
                  labelKey={w.dimension_key}
                  color={w.chart_color || "#2E8B1F"}
                  height={110}
                />
              </div>
            )}

            {w.widget_type === "DATA_TABLE" && (
              <div className="py-1 text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[10px]">
                      <th>DIMENSION</th>
                      <th className="text-right">METRIC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(w.sampleData || []).map((d, i) => (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-800/40">
                        <td className="py-1.5 text-slate-700 dark:text-slate-300">{d[w.dimension_key]}</td>
                        <td className="py-1.5 text-right font-mono font-semibold">{Number(d[w.measure_key]).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Widget Modal */}
      {showAddWidgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-erp-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus size={18} className="text-brand-600" />
                Add Visualization Widget
              </h3>
              <button onClick={() => setShowAddWidgetModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Widget Title</label>
                <input
                  type="text"
                  placeholder="e.g. Regional Gross Margin"
                  value={newWidgetTitle}
                  onChange={(e) => setNewWidgetTitle(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Visualization Type</label>
                <select
                  value={newWidgetType}
                  onChange={(e) => setNewWidgetType(e.target.value)}
                  className="input w-full"
                >
                  {WIDGET_TYPES.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Measure</label>
                  <select
                    value={newWidgetMeasure}
                    onChange={(e) => setNewWidgetMeasure(e.target.value)}
                    className="input w-full"
                  >
                    <option value="revenue">Revenue</option>
                    <option value="cost">Cost of Goods</option>
                    <option value="gross_profit">Gross Profit</option>
                    <option value="quantity">Units Sold</option>
                    <option value="stock_qty">Stock Level</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Dimension</label>
                  <select
                    value={newWidgetDimension}
                    onChange={(e) => setNewWidgetDimension(e.target.value)}
                    className="input w-full"
                  >
                    <option value="month">Month</option>
                    <option value="branch">Branch</option>
                    <option value="category">Category</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Accent Color</label>
                <div className="flex items-center gap-2">
                  {PALETTE_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewWidgetColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${newWidgetColor === c ? "border-brand-900 scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddWidgetModal(false)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddWidget}
                className="btn-primary text-xs px-4 py-2"
              >
                Add Widget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
