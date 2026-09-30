/**
 * @fileoverview ProductionSetup component.
 * Manufacturing Setup Page overhauled into tabbed navigation sections (matching Maintenance Setup Page):
 * - General (Global Parameters)
 * - Warehouses (Production Warehouse Locations & WIP Staging Areas)
 * - Processes (Manufacturing Processes)
 * - Departments (Production Departments)
 * - Output Types (BOM Output Types)
 * - Resources (Machines & Equipment)
 * - Shifts (Work Shifts & Schedules)
 * - Routings (Process Templates)
 */

import React, { useState, useEffect } from "react";
import { 
  Settings2, 
  Cpu, 
  Clock, 
  Building2,
  Layers,
  Save,
  ArrowLeft,
  Warehouse,
  Loader2,
  FileText,
  DollarSign,
  Package
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

import DepartmentList from "./DepartmentList";
import ProductionWarehouseList from "./ProductionWarehouseList";
import BomOutputTypeList from "./BomOutputTypeList";
import MachineList from "./MachineList";
import ShiftList from "./ShiftList";
import OverheadList from "./OverheadList";
import ProductionItemList from "./ProductionItemList";
import QcChecklistList from "./QcChecklistList";
import OperatorList from "./OperatorList";
import { UserCheck } from "lucide-react";

const TAB_LABELS = [
  { key: "general", label: "General", icon: <Warehouse size={16} /> },
  { key: "items", label: "Production Items", icon: <Package size={16} /> },
  { key: "warehouses", label: "Production Warehouses", icon: <Warehouse size={16} /> },
  { key: "departments", label: "Departments", icon: <Building2 size={16} /> },
  { key: "output-types", label: "BOM Output Types", icon: <Layers size={16} /> },
  { key: "overheads", label: "Operational Overheads", icon: <DollarSign size={16} /> },
  { key: "machines", label: "Machines & Resources", icon: <Cpu size={16} /> },
  { key: "shifts", label: "Shifts", icon: <Clock size={16} /> },
  { key: "operators", label: "Machine Operators", icon: <UserCheck size={16} /> },
  { key: "qc-checklists", label: "Quality Checklists", icon: <FileText size={16} /> },
];

export default function ProductionSetup() {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invWarehouses, setInvWarehouses] = useState([]);
  const [prodWarehouses, setProdWarehouses] = useState([]);

  // General settings state
  const [settings, setSettings] = useState({
    default_warehouse_id: "",
    default_source_warehouse_id: "",
    costing_method: "FIFO",
    default_scrap_allowance_pct: 2.5,
    default_lead_time_days: 1,
    auto_generate_job_cards: true,
    auto_generate_material_requisitions: false
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invWhRes, prodWhRes, cfgRes] = await Promise.allSettled([
          api.get("/inventory/warehouses"),
          api.get("/production/setup/warehouses"),
          api.get("/production/setup/config")
        ]);

        if (invWhRes.status === "fulfilled") {
          setInvWarehouses(invWhRes.value?.data?.items || []);
        }
        if (prodWhRes.status === "fulfilled") {
          setProdWarehouses(prodWhRes.value?.data?.items || []);
        }
        if (cfgRes.status === "fulfilled" && cfgRes.value?.data?.settings) {
          setSettings((prev) => ({ ...prev, ...cfgRes.value.data.settings }));
        }
      } catch {
        toast.error("Failed to load manufacturing setup parameters");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/production/setup/config", { settings });
      if (settings.default_warehouse_id) {
        await api.put(`/production/setup/warehouses/${settings.default_warehouse_id}/default`).catch(() => {});
      }
      toast.success("Manufacturing setup parameters saved successfully");
    } catch {
      toast.error("Failed to save manufacturing setup parameters");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading Manufacturing Setup...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/production" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Manufacturing Setup & Configuration</h1>
            <p className="text-slate-500 text-sm">Configure production parameters, warehouse locations, processes, departments, and work shifts</p>
          </div>
        </div>
      </div>

      {/* Main Tabbed Interface */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-700 overflow-x-auto bg-slate-50/50 dark:bg-slate-900/40 p-2 gap-1">
          {TAB_LABELS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? "bg-brand-900 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "general" && (
          <form onSubmit={handleSaveSettings} className="p-8 space-y-8 w-full">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Global Manufacturing Parameters</h3>
                <p className="text-xs text-slate-500">Configure default production warehouses, material requisition rules, costing valuation, and scrap tolerances</p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary bg-brand-900 hover:bg-brand-950 text-white flex items-center gap-2 text-xs font-bold shadow-md"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Configuration
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Default Production Warehouse */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  default production warehouse *
                </label>
                <select
                  value={settings.default_warehouse_id || ""}
                  onChange={(e) => setSettings({ ...settings, default_warehouse_id: e.target.value })}
                  className="input w-full font-bold"
                >
                  <option value="">Select Default Production Warehouse...</option>
                  {prodWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Fetched from Production Warehouses setup section</p>
              </div>

              {/* Default Source Warehouse (Fetched from inv_warehouses table) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  default source warehouse *
                </label>
                <select
                  value={settings.default_source_warehouse_id || ""}
                  onChange={(e) => setSettings({ ...settings, default_source_warehouse_id: e.target.value })}
                  className="input w-full font-bold"
                >
                  <option value="">Select Default Source Warehouse...</option>
                  {invWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name || w.name} ({w.warehouse_code || w.code || "WH"})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Central Inventory stores warehouse (inv_warehouses table)</p>
              </div>

              {/* Tolerances */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Default Scrap Allowance %
                </label>
                <input
                  type="number"
                  step="any"
                  value={settings.default_scrap_allowance_pct ?? 2.5}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettings({ ...settings, default_scrap_allowance_pct: val === "" ? "" : parseFloat(val) });
                  }}
                  className="input w-full font-bold"
                />
              </div>

              <div className="space-y-4 pt-4 col-span-1 md:col-span-2 lg:col-span-3 border-t border-slate-100 dark:border-slate-700">
                {/* Field 1: Auto-generate Job Cards upon Order Release */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Auto-generate Job Cards upon Order Release
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="autoJobCardMode"
                        checked={!!settings.auto_generate_job_cards}
                        onChange={() => setSettings({ ...settings, auto_generate_job_cards: true })}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      Yes (Enabled)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="autoJobCardMode"
                        checked={!settings.auto_generate_job_cards}
                        onChange={() => setSettings({ ...settings, auto_generate_job_cards: false })}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      No (Disabled)
                    </label>
                  </div>
                </div>

                {/* Field 2: Auto-generate Material Requisition */}
                <div className="space-y-1.5 pt-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Auto-generate Material Requisition
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="autoMatReqMode"
                        checked={!!settings.auto_generate_material_requisitions}
                        onChange={() => setSettings({ ...settings, auto_generate_material_requisitions: true })}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      Yes (Enabled)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="autoMatReqMode"
                        checked={!settings.auto_generate_material_requisitions}
                        onChange={() => setSettings({ ...settings, auto_generate_material_requisitions: false })}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      No (Disabled)
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}

        {activeTab === "items" && <ProductionItemList />}
        {activeTab === "warehouses" && <ProductionWarehouseList />}
        {activeTab === "departments" && <DepartmentList />}
        {activeTab === "output-types" && <BomOutputTypeList />}
        {activeTab === "overheads" && <OverheadList />}
        {activeTab === "machines" && <MachineList />}
        {activeTab === "shifts" && <ShiftList />}
        {activeTab === "operators" && <OperatorList />}
        {activeTab === "qc-checklists" && <QcChecklistList />}
      </div>
    </div>
  );
}
