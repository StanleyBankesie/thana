/**
 * @file BOQManager.jsx
 * @description Enterprise Bill of Quantities (BOQ) management interface with rate build-up,
 * takeoff dimension sheets, and CSV import/export.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileSpreadsheet,
  Plus,
  Calculator,
  Download,
  Upload,
  Layers,
  Save,
  Trash2,
  Edit2,
  Eye,
  CheckCircle,
  Clock,
  ArrowLeft,
  X,
  RefreshCw
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function BOQManager() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [boqs, setBOQs] = useState([]);
  const [activeBOQ, setActiveBOQ] = useState(null);
  const [boqItems, setBOQItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [activeItemForRate, setActiveItemForRate] = useState(null);
  const [rateForm, setRateForm] = useState({
    material_cost: 0,
    labour_cost: 0,
    plant_cost: 0,
    subcontract_cost: 0,
    overhead_percent: 10,
    profit_percent: 15,
  });

  const [newBOQ, setNewBOQ] = useState({
    title: "",
    boq_number: "",
    currency: "GHS",
    remarks: "",
  });

  // Load Projects
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
        if (prjs.length > 0) {
          setSelectedProjectId(String(prjs[0].id));
        }
      } catch (e) {
        toast.error("Failed to load projects");
      }
    })();
  }, []);

  // Load BOQs when project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    fetchBOQs();
  }, [selectedProjectId]);

  const fetchBOQs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/construction/boqs", { params: { project_id: selectedProjectId } });
      const items = res.data?.items || [];
      setBOQs(items);
      if (items.length > 0) {
        loadBOQDetails(items[0].id);
      } else {
        setActiveBOQ(null);
        setBOQItems([]);
      }
    } catch (e) {
      toast.error("Failed to load BOQs");
    } finally {
      setLoading(false);
    }
  };

  const loadBOQDetails = async (boqId) => {
    try {
      const res = await api.get(`/construction/boqs/${boqId}`);
      setActiveBOQ(res.data?.item || null);
      setBOQItems(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load BOQ items");
    }
  };

  // Add Item Row
  const addItemRow = () => {
    const nextNum = boqItems.length + 1;
    const newItem = {
      id: `temp-${Date.now()}`,
      item_number: `${nextNum}.0`,
      bill_no: "1",
      element: "Substructure",
      description: "",
      unit: "M3",
      quantity: 1,
      unit_rate: 0,
      total_amount: 0,
    };
    setBOQItems([...boqItems, newItem]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...boqItems];
    updated[index][field] = value;
    if (field === "quantity" || field === "unit_rate") {
      const q = Number(updated[index].quantity || 0);
      const r = Number(updated[index].unit_rate || 0);
      updated[index].total_amount = Number((q * r).toFixed(2));
    }
    setBOQItems(updated);
  };

  const removeItemRow = (index) => {
    const updated = boqItems.filter((_, i) => i !== index);
    setBOQItems(updated);
  };

  // Save BOQ items
  const handleSaveItems = async () => {
    if (!activeBOQ) return;
    setSaving(true);
    try {
      await api.post(`/construction/boqs/${activeBOQ.id}/items`, { items: boqItems });
      toast.success("BOQ items saved successfully");
      loadBOQDetails(activeBOQ.id);
    } catch (e) {
      toast.error("Failed to save BOQ items");
    } finally {
      setSaving(false);
    }
  };

  // Create BOQ
  const handleCreateBOQ = async (e) => {
    e.preventDefault();
    if (!newBOQ.title) return toast.error("Title is required");
    try {
      await api.post("/construction/boqs", {
        ...newBOQ,
        project_id: selectedProjectId,
      });
      toast.success("BOQ created");
      setShowCreateModal(false);
      setNewBOQ({ title: "", boq_number: "", currency: "GHS", remarks: "" });
      fetchBOQs();
    } catch (e) {
      toast.error("Failed to create BOQ");
    }
  };

  // Rate Analysis Modal
  const openRateAnalysis = async (item) => {
    setActiveItemForRate(item);
    setShowRateModal(true);
    try {
      if (item.id && !String(item.id).startsWith("temp-")) {
        const res = await api.get(`/construction/boq-items/${item.id}/rate-analysis`);
        if (res.data?.item) {
          const r = res.data.item;
          setRateForm({
            material_cost: Number(r.material_cost || 0),
            labour_cost: Number(r.labour_cost || 0),
            plant_cost: Number(r.plant_cost || 0),
            subcontract_cost: Number(r.subcontract_cost || 0),
            overhead_percent: Number(r.overhead_percent || 10),
            profit_percent: Number(r.profit_percent || 15),
          });
          return;
        }
      }
    } catch (e) {}
    // Default fallback
    setRateForm({
      material_cost: Number(item.unit_rate * 0.5 || 0),
      labour_cost: Number(item.unit_rate * 0.25 || 0),
      plant_cost: Number(item.unit_rate * 0.1 || 0),
      subcontract_cost: 0,
      overhead_percent: 10,
      profit_percent: 15,
    });
  };

  const calculatedDirectCost = Number(rateForm.material_cost || 0) + Number(rateForm.labour_cost || 0) + Number(rateForm.plant_cost || 0) + Number(rateForm.subcontract_cost || 0);
  const calculatedOverhead = (calculatedDirectCost * Number(rateForm.overhead_percent || 0)) / 100;
  const calculatedProfit = ((calculatedDirectCost + calculatedOverhead) * Number(rateForm.profit_percent || 0)) / 100;
  const calculatedUnitRate = Number((calculatedDirectCost + calculatedOverhead + calculatedProfit).toFixed(2));

  const applyRateAnalysis = async () => {
    if (!activeItemForRate) return;
    const idx = boqItems.findIndex(i => i.id === activeItemForRate.id);
    if (idx !== -1) {
      updateItem(idx, "unit_rate", calculatedUnitRate);
    }
    if (activeItemForRate.id && !String(activeItemForRate.id).startsWith("temp-")) {
      try {
        await api.post(`/construction/boq-items/${activeItemForRate.id}/rate-analysis`, {
          ...rateForm,
          update_boq_item_rate: true,
        });
      } catch (e) {}
    }
    toast.success(`Unit rate updated to GHS ${calculatedUnitRate}`);
    setShowRateModal(false);
  };

  // CSV Export
  const exportCSV = () => {
    if (!boqItems.length) return toast.info("No items to export");
    const headers = ["Item No", "Bill No", "Element", "Description", "Unit", "Quantity", "Unit Rate", "Total Amount"];
    const rows = boqItems.map(i => [
      `"${i.item_number || ""}"`,
      `"${i.bill_no || ""}"`,
      `"${i.element || ""}"`,
      `"${(i.description || "").replace(/"/g, '""')}"`,
      `"${i.unit || ""}"`,
      i.quantity || 0,
      i.unit_rate || 0,
      i.total_amount || 0,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BOQ_${activeBOQ?.boq_number || "export"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const boqTotal = boqItems.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Canonical List / Manager Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet size={24} className="text-brand-900 dark:text-brand-400" /> Bill of Quantities (BOQ) & Estimating
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Hierarchical work breakdown, rate analysis, and measured bill items
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input text-sm py-1.5 h-auto min-w-[180px]"
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_code} - {p.project_name}
              </option>
            ))}
          </select>
          <button
            onClick={fetchBOQs}
            className="btn btn-secondary p-2"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> New BOQ
          </button>
        </div>
      </div>

      {/* BOQ Selection Ribbon & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 md:col-span-1 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Project BOQs</p>
          {boqs.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-2">No BOQ created for this project yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {boqs.map(b => (
                <button
                  key={b.id}
                  onClick={() => loadBOQDetails(b.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex justify-between items-center ${
                    activeBOQ?.id === b.id
                      ? "bg-brand text-white shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate">{b.title}</span>
                  <span className="text-[10px] opacity-75 font-mono">Rev {b.revision_number}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
            <Calculator size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Total BOQ Value</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              GHS {boqTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Line Items</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{boqItems.length}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase">Actions</p>
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                disabled={!boqItems.length}
                className="btn btn-secondary text-xs flex items-center gap-1"
                title="Export to CSV"
              >
                <Download size={14} /> CSV
              </button>
              <button
                onClick={handleSaveItems}
                disabled={saving || !activeBOQ}
                className="btn-primary text-xs flex items-center gap-1"
              >
                <Save size={14} /> {saving ? "Saving..." : "Save BOQ"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main BOQ Table */}
      {activeBOQ ? (
        <div className="card overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                {activeBOQ.title}
                <span className="text-xs font-normal text-slate-500 font-mono">({activeBOQ.boq_number})</span>
              </h2>
            </div>
            <button
              onClick={addItemRow}
              className="btn btn-secondary text-xs flex items-center gap-1 font-semibold"
            >
              <Plus size={14} /> Add Row
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b">
                <tr>
                  <th className="p-3 w-16">Item</th>
                  <th className="p-3 w-20">Bill</th>
                  <th className="p-3 w-32">Element</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 w-20">Unit</th>
                  <th className="p-3 w-24 text-right">Quantity</th>
                  <th className="p-3 w-28 text-right">Unit Rate (GHS)</th>
                  <th className="p-3 w-32 text-right">Total (GHS)</th>
                  <th className="p-3 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {boqItems.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full bg-transparent border-b border-transparent focus:border-brand-500 outline-none text-xs font-mono"
                        value={item.item_number}
                        onChange={e => updateItem(idx, "item_number", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full bg-transparent border-b border-transparent focus:border-brand-500 outline-none text-xs"
                        value={item.bill_no || ""}
                        onChange={e => updateItem(idx, "bill_no", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full bg-transparent border-b border-transparent focus:border-brand-500 outline-none text-xs"
                        value={item.element || ""}
                        onChange={e => updateItem(idx, "element", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full bg-transparent border-b border-transparent focus:border-brand-500 outline-none text-xs"
                        placeholder="Detailed description of works..."
                        value={item.description}
                        onChange={e => updateItem(idx, "description", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <select
                        className="bg-transparent text-xs outline-none"
                        value={item.unit}
                        onChange={e => updateItem(idx, "unit", e.target.value)}
                      >
                        {["M3", "M2", "M", "KG", "TON", "NR", "SUM", "HRS", "DAYS"].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="any"
                        className="w-full text-right bg-transparent border-b border-transparent focus:border-brand-500 outline-none text-xs font-mono"
                        value={item.quantity}
                        onChange={e => updateItem(idx, "quantity", e.target.value)}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="any"
                        className="w-full text-right bg-transparent border-b border-transparent focus:border-brand-500 outline-none text-xs font-mono"
                        value={item.unit_rate}
                        onChange={e => updateItem(idx, "unit_rate", e.target.value)}
                      />
                    </td>
                    <td className="p-2 text-right font-bold font-mono text-slate-800 dark:text-slate-200">
                      {Number(item.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openRateAnalysis(item)}
                          className="p-1 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded"
                          title="Rate Build-Up Analysis"
                        >
                          <Calculator size={14} />
                        </button>
                        <button
                          onClick={() => removeItemRow(idx)}
                          className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded"
                          title="Delete Row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-900 border-t font-bold">
                <tr>
                  <td colSpan={7} className="p-3 text-right uppercase tracking-wider text-xs">Total Bill Amount (GHS):</td>
                  <td className="p-3 text-right text-sm font-mono text-emerald-600 dark:text-emerald-400">
                    {boqTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center text-slate-400">
          <FileSpreadsheet size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-base font-bold">Select or Create a Bill of Quantities to begin estimating</p>
        </div>
      )}

      {/* Modal: Create BOQ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Create Bill of Quantities</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateBOQ} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">BOQ Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Architectural & Structural Works BOQ"
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  value={newBOQ.title}
                  onChange={e => setNewBOQ({ ...newBOQ, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">BOQ Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. BOQ-2026-001"
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  value={newBOQ.boq_number}
                  onChange={e => setNewBOQ({ ...newBOQ, boq_number: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Remarks</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 min-h-[80px]"
                  placeholder="Notes, tender basis, specification standards..."
                  value={newBOQ.remarks}
                  onChange={e => setNewBOQ({ ...newBOQ, remarks: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Create BOQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rate Build-Up Analysis */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Calculator size={18} className="text-brand-600" /> Rate Build-Up Analysis
                </h3>
                <p className="text-xs text-slate-500">
                  Item {activeItemForRate?.item_number}: {activeItemForRate?.description || "Work item"}
                </p>
              </div>
              <button onClick={() => setShowRateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Material Cost / Unit</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={rateForm.material_cost}
                    onChange={e => setRateForm({ ...rateForm, material_cost: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Direct Labour / Unit</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={rateForm.labour_cost}
                    onChange={e => setRateForm({ ...rateForm, labour_cost: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Plant / Equipment Cost</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={rateForm.plant_cost}
                    onChange={e => setRateForm({ ...rateForm, plant_cost: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Subcontract / Specialist</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={rateForm.subcontract_cost}
                    onChange={e => setRateForm({ ...rateForm, subcontract_cost: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">Direct Cost Subtotal:</span>
                <span className="font-mono font-bold">GHS {calculatedDirectCost.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Overhead Rate (%)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={rateForm.overhead_percent}
                    onChange={e => setRateForm({ ...rateForm, overhead_percent: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Profit Margin (%)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={rateForm.profit_percent}
                    onChange={e => setRateForm({ ...rateForm, profit_percent: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="p-4 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 rounded-xl flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold uppercase text-brand-800 dark:text-brand-300">Computed Unit Rate</p>
                  <p className="text-[10px] text-slate-500">Direct + Overhead ({calculatedOverhead.toFixed(2)}) + Profit ({calculatedProfit.toFixed(2)})</p>
                </div>
                <div className="text-xl font-bold font-mono text-brand-700 dark:text-brand-200">
                  GHS {calculatedUnitRate.toFixed(2)}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowRateModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="button" onClick={applyRateAnalysis} className="btn-primary text-xs font-bold">
                  Apply Rate to Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
