/**
 * @fileoverview ProcessList component.
 * Comprehensive Manufacturing Process page allowing user to configure:
 * - Production Department (set in Manufacturing Setup)
 * - BOM Output Type (set in Manufacturing Setup)
 * - Input Items Section
 * - Output Items Section
 * - By-Products Section
 * - Overhead Items Section
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Loader2,
  Settings2,
  ArrowLeft,
  Building2,
  Layers,
  Package,
  PlusCircle,
  TrendingDown,
  DollarSign,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Info
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function ProcessList() {
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [bomOutputTypes, setBomOutputTypes] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [setupOverheads, setSetupOverheads] = useState([]);
  const [allMachines, setAllMachines] = useState([]);
  const [allShifts, setAllShifts] = useState([]);
  const [defaultScrapPct, setDefaultScrapPct] = useState(2.5);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("basic"); // basic | inputs | outputs | byproducts | overheads | resources
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);

  const initialForm = {
    process_name: "",
    description: "",
    department_id: "",
    department_name: "",
    bom_output_type_id: "",
    bom_output_type: "",
    is_active: true,
    inputs: [],
    output_items: [],
    by_products: [],
    overheads: [],
    machines: []
  };

  const [currentProcess, setCurrentProcess] = useState(initialForm);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [procRes, deptRes, botRes, invRes, cfgRes, ovhRes, machRes] = await Promise.allSettled([
        api.get("/production/setup/processes"),
        api.get("/production/setup/departments"),
        api.get("/production/setup/bom-output-types"),
        api.get("/inventory/items?all=1"),
        api.get("/production/setup/config"),
        api.get("/production/setup/overheads"),
        api.get("/production/setup/machines")
      ]);

      if (procRes.status === "fulfilled") {
        setItems(procRes.value.data?.items || []);
      }
      if (deptRes.status === "fulfilled") {
        setDepartments(deptRes.value.data?.items || []);
      }
      if (botRes.status === "fulfilled") {
        setBomOutputTypes(botRes.value.data?.items || []);
      }
      if (invRes.status === "fulfilled") {
        setInventoryItems(invRes.value.data?.items || []);
      }
      if (ovhRes.status === "fulfilled") {
        setSetupOverheads(ovhRes.value.data?.items || []);
      }
      if (machRes.status === "fulfilled") {
        setAllMachines(machRes.value.data?.items || []);
      }
      if (cfgRes.status === "fulfilled" && cfgRes.value.data?.settings) {
        const scrap = parseFloat(cfgRes.value.data.settings.default_scrap_allowance_pct);
        if (!isNaN(scrap)) setDefaultScrapPct(scrap);
      }
    } catch {
      toast.error("Failed to load manufacturing process data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filtered item lists per user rules:
  // 1. Inputs: item_type matches "raw", "rwa", or "semi"
  const rawInputItems = inventoryItems.filter(i => {
    const typeStr = String(i.item_type || i.type || i.category_name || "").toLowerCase();
    return typeStr.includes("raw") || typeStr.includes("rwa") || typeStr.includes("semi");
  });

  // Fallback to all items if raw filter is empty so dropdown is not blank
  const inputDropdownItems = rawInputItems.length > 0 ? rawInputItems : inventoryItems;

  // 2. Output Items: item_type DOES NOT include "raw"
  const nonRawOutputItems = inventoryItems.filter(i => {
    const typeStr = String(i.item_type || i.type || i.category_name || "").toLowerCase();
    return !typeStr.includes("raw") && !typeStr.includes("rwa");
  });
  const outputDropdownItems = nonRawOutputItems.length > 0 ? nonRawOutputItems : inventoryItems;

  // 3. By-Product Items: populated from inv_items
  const byproductDropdownItems = inventoryItems;

  const handleDepartmentChange = (deptId) => {
    const selected = departments.find(d => String(d.id) === String(deptId));
    setCurrentProcess(prev => ({
      ...prev,
      department_id: deptId,
      department_name: selected ? selected.department_name : ""
    }));
  };

  const handleBomOutputTypeChange = (typeId) => {
    const selected = bomOutputTypes.find(t => String(t.id) === String(typeId));
    setCurrentProcess(prev => ({
      ...prev,
      bom_output_type_id: typeId,
      bom_output_type: selected ? selected.type_name : ""
    }));
  };

  // Section Row Handlers
  const addInputRow = () => {
    setCurrentProcess(prev => ({
      ...prev,
      inputs: [...(prev.inputs || []), { item_name: "", qty: 1, uom: "Pcs", scrap_percent: defaultScrapPct, notes: `${defaultScrapPct}% Default Scrap` }]
    }));
  };

  const updateInputRow = (index, field, value) => {
    setCurrentProcess(prev => {
      const next = [...(prev.inputs || [])];
      const updatedRow = { ...next[index], [field]: value };

      if (field === "item_name") {
        const matched = inventoryItems.find(
          it => (it.item_name || it.name || "").toLowerCase().trim() === (value || "").toLowerCase().trim()
        );
        if (matched) {
          updatedRow.item_id = matched.id;
          updatedRow.item_code = matched.item_code || "";
          if (matched.purchase_price || matched.unit_cost || matched.valuation_rate || matched.cost_price) {
            updatedRow.cost_value = parseFloat(matched.purchase_price || matched.unit_cost || matched.valuation_rate || matched.cost_price) || 0;
            updatedRow.unit_cost = updatedRow.cost_value;
          }
          if (matched.uom) updatedRow.uom = matched.uom;
        }
      }

      next[index] = updatedRow;
      return { ...prev, inputs: next };
    });
  };

  const removeInputRow = (index) => {
    setCurrentProcess(prev => ({
      ...prev,
      inputs: (prev.inputs || []).filter((_, i) => i !== index)
    }));
  };

  const addOutputRow = () => {
    setCurrentProcess(prev => ({
      ...prev,
      output_items: [...(prev.output_items || []), { item_name: "", output_qty: 1, uom: "Pcs", output_tag: "Primary Output", yield_percent: 100 }]
    }));
  };

  const updateOutputRow = (index, field, value) => {
    setCurrentProcess(prev => {
      const next = [...(prev.output_items || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, output_items: next };
    });
  };

  const removeOutputRow = (index) => {
    setCurrentProcess(prev => ({
      ...prev,
      output_items: (prev.output_items || []).filter((_, i) => i !== index)
    }));
  };

  const addByProductRow = () => {
    setCurrentProcess(prev => ({
      ...prev,
      by_products: [...(prev.by_products || []), { item_name: "", expected_qty: 1, uom: "Kg", recovery_value: 0, notes: "" }]
    }));
  };

  const updateByProductRow = (index, field, value) => {
    setCurrentProcess(prev => {
      const next = [...(prev.by_products || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, by_products: next };
    });
  };

  const removeByProductRow = (index) => {
    setCurrentProcess(prev => ({
      ...prev,
      by_products: (prev.by_products || []).filter((_, i) => i !== index)
    }));
  };

  const addOverheadRow = () => {
    setCurrentProcess(prev => ({
      ...prev,
      overheads: [...(prev.overheads || []), { overhead_name: "Direct Labor", cost_rate: 0, allocation_basis: "per Hour", est_cost: 0 }]
    }));
  };

  const updateOverheadRow = (index, field, value) => {
    setCurrentProcess(prev => {
      const next = [...(prev.overheads || [])];
      const updatedRow = { ...next[index], [field]: value };

      if (field === "overhead_name") {
        const matched = setupOverheads.find(
          ov => (ov.overhead_name || "").toLowerCase().trim() === (value || "").toLowerCase().trim()
        );
        if (matched) {
          if (matched.allocation_basis) updatedRow.allocation_basis = matched.allocation_basis;
          if (matched.default_cost_rate !== undefined && matched.default_cost_rate !== null) {
            updatedRow.cost_rate = parseFloat(matched.default_cost_rate) || 0;
          }
        }
      }

      next[index] = updatedRow;
      return { ...prev, overheads: next };
    });
  };

  const removeOverheadRow = (index) => {
    setCurrentProcess(prev => ({
      ...prev,
      overheads: (prev.overheads || []).filter((_, i) => i !== index)
    }));
  };

  const addMachineRow = () => {
    setCurrentProcess(prev => ({
      ...prev,
      machines: [...(prev.machines || []), { machine_name: "", machine_id: "", status: "Active" }]
    }));
  };

  const updateMachineRow = (index, field, value) => {
    setCurrentProcess(prev => {
      const next = [...(prev.machines || [])];
      const updatedRow = { ...next[index], [field]: value };

      if (field === "machine_name") {
        const matched = allMachines.find(
          m => (m.machine_name || m.name || "").toLowerCase().trim() === (value || "").toLowerCase().trim()
        );
        if (matched) {
          updatedRow.id = matched.id;
          updatedRow.machine_id = matched.id;
          updatedRow.code = matched.code || matched.machine_code || "";
          updatedRow.status = matched.status || "Active";
        }
      }

      next[index] = updatedRow;
      return { ...prev, machines: next };
    });
  };

  const removeMachineRow = (index) => {
    setCurrentProcess(prev => ({
      ...prev,
      machines: (prev.machines || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentProcess.process_name.trim()) return toast.error("Process name is required");

    setSaving(true);
    try {
      if (currentProcess.id) {
        await api.put(`/production/setup/processes/${currentProcess.id}`, currentProcess);
        toast.success("Manufacturing Process updated successfully");
      } else {
        await api.post("/production/setup/processes", currentProcess);
        toast.success("Manufacturing Process created successfully");
      }
      setShowModal(false);
      fetchAllData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save manufacturing process");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this process step?")) return;
    try {
      await api.delete(`/production/setup/processes/${id}`);
      toast.success("Process deleted successfully");
      fetchAllData();
    } catch {
      toast.error("Failed to delete process");
    }
  };

  const filteredItems = items.filter(p => 
    p.process_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.department_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.bom_output_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/production/setup" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Manufacturing Processes</h1>
            <p className="text-slate-500 text-sm">
              Configure production operations with Department scope, BOM Output Types, Inputs, Outputs, By-Products & Overheads
            </p>
          </div>
        </div>

        <button 
          onClick={() => {
            setCurrentProcess(initialForm);
            setActiveTab("basic");
            setShowModal(true);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          New Manufacturing Process
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search processes, department, or output types..."
          className="input pl-10 w-full"
        />
      </div>

      {/* Processes List Table */}
      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 uppercase tracking-wider text-xs border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Process Name</th>
                <th className="px-6 py-4">Production Department</th>
                <th className="px-6 py-4">BOM Output Type</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-slate-400 font-medium">Loading processes...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-slate-400 font-medium">
                    <Settings2 className="mx-auto mb-2 opacity-40" size={36} />
                    No manufacturing processes found. Click "New Manufacturing Process" to create one.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isExpanded = expandedId === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <div>
                              <p className="font-bold text-brand-900 dark:text-brand-300">{item.process_name}</p>
                              {item.description && (
                                <p className="text-xs text-slate-400 truncate max-w-xs">{item.description}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">
                          {item.department_name ? item.department_name : <span className="text-xs text-slate-400 italic">Not set</span>}
                        </td>

                        <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">
                          {item.bom_output_type ? item.bom_output_type : <span className="text-xs text-slate-400 italic">Not set</span>}
                        </td>

                        <td className="px-6 py-4 text-center">
                          {item.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">
                              <CheckCircle2 size={12} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              <XCircle size={12} /> Inactive
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setCurrentProcess({
                                ...initialForm,
                                ...item,
                                inputs: item.inputs || [],
                                output_items: item.output_items || [],
                                by_products: item.by_products || [],
                                overheads: item.overheads || [],
                                machines: item.machines || []
                              });
                              setActiveTab("basic");
                              setShowModal(true);
                            }}
                            className="btn btn-secondary p-1.5 text-blue-600 hover:text-blue-700"
                            title="Edit Process"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="btn btn-secondary p-1.5 text-rose-600 hover:text-rose-700"
                            title="Delete Process"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Drawer Details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 dark:bg-slate-850/50">
                          <td colSpan="5" className="p-6 border-y border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                              {/* Inputs */}
                              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                                  📥 Input Items ({item.inputs?.length || 0})
                                </h4>
                                {item.inputs?.length ? (
                                  <ul className="text-xs space-y-1.5 divide-y divide-slate-100 dark:divide-slate-700">
                                    {item.inputs.map((inp, idx) => (
                                      <li key={idx} className="pt-1.5 flex justify-between">
                                        <span className="font-medium">{inp.item_name || "Item"}</span>
                                        <span className="font-bold text-slate-500">{inp.qty} {inp.uom}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">No input items configured</p>
                                )}
                              </div>

                              {/* Outputs */}
                              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                <h4 className="font-bold text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                  📤 Output Items ({item.output_items?.length || 0})
                                </h4>
                                {item.output_items?.length ? (
                                  <ul className="text-xs space-y-1.5 divide-y divide-slate-100 dark:divide-slate-700">
                                    {item.output_items.map((out, idx) => (
                                      <li key={idx} className="pt-1.5 flex justify-between">
                                        <span className="font-medium">{out.item_name || "Output"}</span>
                                        <span className="font-bold text-emerald-600">{out.output_qty} {out.uom}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">No output items configured</p>
                                )}
                              </div>

                              {/* By-Products */}
                              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                <h4 className="font-bold text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                  ♻️ By-Products ({item.by_products?.length || 0})
                                </h4>
                                {item.by_products?.length ? (
                                  <ul className="text-xs space-y-1.5 divide-y divide-slate-100 dark:divide-slate-700">
                                    {item.by_products.map((by, idx) => (
                                      <li key={idx} className="pt-1.5 flex justify-between">
                                        <span className="font-medium">{by.item_name || "By-Product"}</span>
                                        <span className="font-bold text-amber-600">{by.expected_qty} {by.uom}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">No by-products configured</p>
                                )}
                              </div>

                              {/* Overheads */}
                              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                <h4 className="font-bold text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                  ⚙️ Overhead Items ({item.overheads?.length || 0})
                                </h4>
                                {item.overheads?.length ? (
                                  <ul className="text-xs space-y-1.5 divide-y divide-slate-100 dark:divide-slate-700">
                                    {item.overheads.map((ov, idx) => (
                                      <li key={idx} className="pt-1.5 flex justify-between">
                                        <span className="font-medium">{ov.overhead_name}</span>
                                        <span className="font-bold text-indigo-600">${ov.cost_rate} ({ov.allocation_basis})</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">No overhead items configured</p>
                                )}
                              </div>

                              {/* Machines */}
                              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <h4 className="font-bold text-xs text-teal-700 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1">
                                  💻 Linked Machines & Workstations
                                </h4>
                                <div>
                                  {item.machines?.length ? (
                                    <div className="flex flex-wrap gap-1">
                                      {item.machines.map((m, idx) => {
                                        const mName = typeof m === 'object' ? (m.machine_name || m.name) : m;
                                        return (
                                          <span key={idx} className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-[11px] font-semibold border border-teal-200 dark:border-teal-800">
                                            {mName}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic">All Machines / Workstations</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Process Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-brand-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">
                  {currentProcess.id ? "Edit Manufacturing Process" : "New Manufacturing Process"}
                </h2>
                <p className="text-xs text-brand-200">Define operation setup, department, output classification, and material flows</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white hover:opacity-80 text-2xl">&times;</button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-6 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("basic")}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
                  activeTab === "basic"
                    ? "bg-white dark:bg-slate-800 text-brand-600 border-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-slate-500 border-transparent hover:text-slate-700"
                }`}
              >
                ⚙️ Basic & Setup
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("inputs")}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
                  activeTab === "inputs"
                    ? "bg-white dark:bg-slate-800 text-brand-600 border-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-slate-500 border-transparent hover:text-slate-700"
                }`}
              >
                📥 Input Items ({currentProcess.inputs?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("outputs")}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
                  activeTab === "outputs"
                    ? "bg-white dark:bg-slate-800 text-brand-600 border-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-slate-500 border-transparent hover:text-slate-700"
                }`}
              >
                📤 Output Items ({currentProcess.output_items?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("byproducts")}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
                  activeTab === "byproducts"
                    ? "bg-white dark:bg-slate-800 text-brand-600 border-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-slate-500 border-transparent hover:text-slate-700"
                }`}
              >
                ♻️ By-Products ({currentProcess.by_products?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("overheads")}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
                  activeTab === "overheads"
                    ? "bg-white dark:bg-slate-800 text-brand-600 border-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-slate-500 border-transparent hover:text-slate-700"
                }`}
              >
                ⚙️ Overheads ({currentProcess.overheads?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("resources")}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
                  activeTab === "resources"
                    ? "bg-white dark:bg-slate-800 text-brand-600 border-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-slate-500 border-transparent hover:text-slate-700"
                }`}
              >
                💻 Linked Machines ({ currentProcess.machines?.length || 0 })
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: BASIC INFO & SETUP */}
              {activeTab === "basic" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Process Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={currentProcess.process_name}
                        onChange={(e) => setCurrentProcess({ ...currentProcess, process_name: e.target.value })}
                        placeholder="e.g. CNC Lathe Machining, Sheet Metal Cutting"
                        className="input w-full"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="modalProcActive"
                        checked={!!currentProcess.is_active}
                        onChange={(e) => setCurrentProcess({ ...currentProcess, is_active: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <label htmlFor="modalProcActive" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Active for Production Line
                      </label>
                    </div>
                  </div>

                  {/* Department & Output Type Setup Dropdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Building2 size={14} className="text-brand-600" /> Production Department
                      </label>
                      <select
                        value={currentProcess.department_id || ""}
                        onChange={(e) => handleDepartmentChange(e.target.value)}
                        className="input w-full"
                      >
                        <option value="">Select Department (set in Manufacturing Setup)...</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.department_name} {dept.code ? `(${dept.code})` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400 mt-1">Configured in Manufacturing Setup → Production Departments</p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Layers size={14} className="text-purple-600" /> BOM Output Type
                      </label>
                      <select
                        value={currentProcess.bom_output_type_id || ""}
                        onChange={(e) => handleBomOutputTypeChange(e.target.value)}
                        className="input w-full"
                      >
                        <option value="">Select BOM Output Type (set in Manufacturing Setup)...</option>
                        {bomOutputTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.type_name} {type.code ? `(${type.code})` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400 mt-1">Configured in Manufacturing Setup → BOM Output Types</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Description & Standard Operating Procedures (SOP)
                    </label>
                    <textarea
                      rows="4"
                      value={currentProcess.description || ""}
                      onChange={(e) => setCurrentProcess({ ...currentProcess, description: e.target.value })}
                      placeholder="Detail operation specifications, machine parameters, and safety instructions..."
                      className="input w-full"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: INPUT ITEMS */}
              {activeTab === "inputs" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">📥 Input Materials & Components</h3>
                      <p className="text-xs text-slate-500">Key in required raw materials and staging components consumed by this process step</p>
                    </div>
                    <button type="button" onClick={addInputRow} className="btn btn-secondary text-xs flex items-center gap-1.5">
                      <PlusCircle size={14} /> Add Input Item
                    </button>
                  </div>

                  {currentProcess.inputs?.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <Package className="mx-auto mb-2 text-slate-400" size={32} />
                      <p className="text-sm text-slate-500 font-medium">No input items added yet.</p>
                      <button type="button" onClick={addInputRow} className="btn btn-primary text-xs mt-3">
                        + Add First Input Material
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentProcess.inputs.map((row, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          <div className="md:col-span-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Item Name / Code</label>
                            <input
                              type="text"
                              value={row.item_name || ""}
                              onChange={(e) => updateInputRow(idx, "item_name", e.target.value)}
                              placeholder="Select or type raw/semi item..."
                              className="input w-full py-1.5 text-xs"
                              list={`inv-raw-items-list-${idx}`}
                            />
                            <datalist id={`inv-raw-items-list-${idx}`}>
                              {inputDropdownItems.map((it) => (
                                <option key={it.id} value={it.item_name || it.name}>
                                  {it.item_code ? `${it.item_code} - ` : ""}{it.item_type ? `[${it.item_type}]` : ""}
                                </option>
                              ))}
                            </datalist>
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Required Qty</label>
                            <input
                              type="number"
                              step="any"
                              value={row.qty || ""}
                              onChange={(e) => updateInputRow(idx, "qty", parseFloat(e.target.value) || 0)}
                              className="input w-full py-1.5 text-xs"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Unit Cost</label>
                            <input
                              type="number"
                              step="any"
                              value={row.cost_value === 0 || row.cost_value === "0" ? "" : (row.cost_value ?? "")}
                              onChange={(e) => updateInputRow(idx, "cost_value", parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="input w-full py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">UOM</label>
                            <input
                              type="text"
                              value={row.uom || ""}
                              onChange={(e) => updateInputRow(idx, "uom", e.target.value)}
                              placeholder="Pcs/Kg/Mtr"
                              className="input w-full py-1.5 text-xs"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Scrap % / Notes</label>
                            <input
                              type="text"
                              value={row.notes ?? `${defaultScrapPct}% Default Scrap`}
                              onChange={(e) => updateInputRow(idx, "notes", e.target.value)}
                              placeholder="Allowable scrap / specs"
                              className="input w-full py-1.5 text-xs"
                            />
                          </div>

                          <div className="md:col-span-1 flex justify-end pt-4">
                            <button
                              type="button"
                              onClick={() => removeInputRow(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="Remove Input"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: OUTPUT ITEMS */}
              {activeTab === "outputs" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">📤 Output Items</h3>
                      <p className="text-xs text-slate-500">Key in expected manufactured items or sub-assemblies produced by this process</p>
                    </div>
                    <button type="button" onClick={addOutputRow} className="btn btn-secondary text-xs flex items-center gap-1.5">
                      <PlusCircle size={14} /> Add Output Item
                    </button>
                  </div>

                  {currentProcess.output_items?.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <Layers className="mx-auto mb-2 text-emerald-500 opacity-60" size={32} />
                      <p className="text-sm text-slate-500 font-medium">No output items added yet.</p>
                      <button type="button" onClick={addOutputRow} className="btn btn-primary text-xs mt-3">
                        + Add First Output Item
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentProcess.output_items.map((row, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          <div className="md:col-span-4">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Output Item Name</label>
                            <input
                              type="text"
                              value={row.item_name || ""}
                              onChange={(e) => updateOutputRow(idx, "item_name", e.target.value)}
                              placeholder="Select or type output item..."
                              className="input w-full py-1.5 text-xs"
                              list={`inv-output-items-list-${idx}`}
                            />
                            <datalist id={`inv-output-items-list-${idx}`}>
                              {outputDropdownItems.map((it) => (
                                <option key={it.id} value={it.item_name || it.name}>
                                  {it.item_code ? `${it.item_code} - ` : ""}{it.item_type ? `[${it.item_type}]` : ""}
                                </option>
                              ))}
                            </datalist>
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Output Qty</label>
                            <input
                              type="number"
                              step="any"
                              value={row.output_qty || ""}
                              onChange={(e) => updateOutputRow(idx, "output_qty", parseFloat(e.target.value) || 0)}
                              className="input w-full py-1.5 text-xs"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">UOM</label>
                            <input
                              type="text"
                              value={row.uom || ""}
                              onChange={(e) => updateOutputRow(idx, "uom", e.target.value)}
                              placeholder="Pcs/Set"
                              className="input w-full py-1.5 text-xs"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Output Classification</label>
                            <select
                              value={row.output_tag || "Main Output"}
                              onChange={(e) => updateOutputRow(idx, "output_tag", e.target.value)}
                              className="input w-full py-1.5 text-xs"
                            >
                              <option value="Main Output">Main Output</option>
                              <option value="Sub-Assembly">Sub-Assembly</option>
                              <option value="Co-Product">Co-Product</option>
                              <option value="Intermediate WIP">Intermediate WIP</option>
                            </select>
                          </div>

                          <div className="md:col-span-1 flex justify-end pt-4">
                            <button
                              type="button"
                              onClick={() => removeOutputRow(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="Remove Output"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: BY-PRODUCTS */}
              {activeTab === "byproducts" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">♻️ By-Products & Secondary Scrap</h3>
                      <p className="text-xs text-slate-500">Key in residual items, secondary scraps, or recyclable by-products resulting from this process</p>
                    </div>
                    <button type="button" onClick={addByProductRow} className="btn btn-secondary text-xs flex items-center gap-1.5">
                      <PlusCircle size={14} /> Add By-Product
                    </button>
                  </div>

                  {currentProcess.by_products?.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <TrendingDown className="mx-auto mb-2 text-amber-500 opacity-60" size={32} />
                      <p className="text-sm text-slate-500 font-medium">No by-products or secondary scraps added.</p>
                      <button type="button" onClick={addByProductRow} className="btn btn-primary text-xs mt-3">
                        + Add By-Product / Scrap Item
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentProcess.by_products.map((row, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          <div className="md:col-span-4">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">By-Product / Waste Name</label>
                            <input
                              type="text"
                              value={row.item_name || ""}
                              onChange={(e) => updateByProductRow(idx, "item_name", e.target.value)}
                              placeholder="Select or type by-product item..."
                              className="input w-full py-1.5 text-xs"
                              list={`inv-byproduct-items-list-${idx}`}
                            />
                            <datalist id={`inv-byproduct-items-list-${idx}`}>
                              {byproductDropdownItems.map((it) => (
                                <option key={it.id} value={it.item_name || it.name}>
                                  {it.item_code ? `${it.item_code} - ` : ""}{it.item_type ? `[${it.item_type}]` : ""}
                                </option>
                              ))}
                            </datalist>
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Expected Qty</label>
                            <input
                              type="number"
                              step="any"
                              value={row.expected_qty || ""}
                              onChange={(e) => updateByProductRow(idx, "expected_qty", parseFloat(e.target.value) || 0)}
                              className="input w-full py-1.5 text-xs"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">UOM</label>
                            <input
                              type="text"
                              value={row.uom || ""}
                              onChange={(e) => updateByProductRow(idx, "uom", e.target.value)}
                              placeholder="Kg/Ltr"
                              className="input w-full py-1.5 text-xs"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Expected Cost ($)</label>
                            <input
                              type="number"
                              step="any"
                              value={row.expected_cost || ""}
                              onChange={(e) => updateByProductRow(idx, "expected_cost", parseFloat(e.target.value) || 0)}
                              placeholder="Expected cost ($)"
                              className="input w-full py-1.5 text-xs"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Scrap Value / Notes ($)</label>
                            <input
                              type="number"
                              step="any"
                              value={row.recovery_value || ""}
                              onChange={(e) => updateByProductRow(idx, "recovery_value", parseFloat(e.target.value) || 0)}
                              placeholder="Recovery rate ($)"
                              className="input w-full py-1.5 text-xs"
                            />
                          </div>

                          <div className="md:col-span-1 flex justify-end pt-4">
                            <button
                              type="button"
                              onClick={() => removeByProductRow(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="Remove By-Product"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: OVERHEAD ITEMS */}
              {activeTab === "overheads" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">⚙️ Operational Overheads</h3>
                      <p className="text-xs text-slate-500">Key in direct labor, power/utilities, machine depreciation, tooling & operational overheads</p>
                    </div>
                    <button type="button" onClick={addOverheadRow} className="btn btn-secondary text-xs flex items-center gap-1.5">
                      <PlusCircle size={14} /> Add Overhead Item
                    </button>
                  </div>

                  {currentProcess.overheads?.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <DollarSign className="mx-auto mb-2 text-indigo-500 opacity-60" size={32} />
                      <p className="text-sm text-slate-500 font-medium">No overhead items added yet.</p>
                      <button type="button" onClick={addOverheadRow} className="btn btn-primary text-xs mt-3">
                        + Add First Overhead Resource
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentProcess.overheads.map((row, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          <div className="md:col-span-4">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Overhead Category / Description</label>
                            <input
                              type="text"
                              value={row.overhead_name || ""}
                              onChange={(e) => updateOverheadRow(idx, "overhead_name", e.target.value)}
                              placeholder="Select or type overhead..."
                              className="input w-full py-1.5 text-xs font-semibold"
                              list={`setup-overheads-list-${idx}`}
                            />
                            <datalist id={`setup-overheads-list-${idx}`}>
                              {setupOverheads.map((ov) => (
                                <option key={ov.id} value={ov.overhead_name}>
                                  {ov.code ? `${ov.code} - ` : ""}[{ov.allocation_basis}] {ov.default_cost_rate ? `($${ov.default_cost_rate})` : ""}
                                </option>
                              ))}
                            </datalist>
                          </div>

                          <div className="md:col-span-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Allocation Basis</label>
                            <select
                              value={row.allocation_basis || "per Hour"}
                              onChange={(e) => updateOverheadRow(idx, "allocation_basis", e.target.value)}
                              className="input w-full py-1.5 text-xs"
                            >
                              <option value="per Hour">per Hour</option>
                              <option value="per Unit">per Unit Produced</option>
                              <option value="per Batch">Fixed per Batch</option>
                              <option value="per Shift">per Shift</option>
                            </select>
                          </div>

                          <div className="md:col-span-4">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Cost Rate ($)</label>
                            <input
                              type="number"
                              step="any"
                              value={row.cost_rate || ""}
                              onChange={(e) => updateOverheadRow(idx, "cost_rate", parseFloat(e.target.value) || 0)}
                              placeholder="Cost rate per unit/hour"
                              className="input w-full py-1.5 text-xs"
                            />
                          </div>

                          <div className="md:col-span-1 flex justify-end pt-4">
                            <button
                              type="button"
                              onClick={() => removeOverheadRow(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="Remove Overhead"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: LINKED MACHINES */}
              {activeTab === "resources" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                        💻 Linked Machines & Workstations
                      </h3>
                      <p className="text-xs text-slate-500">
                        Link specific equipment and workstations that can execute this manufacturing process
                      </p>
                    </div>
                    <button type="button" onClick={addMachineRow} className="btn btn-secondary text-xs flex items-center gap-1.5">
                      <PlusCircle size={14} /> Add Machine
                    </button>
                  </div>

                  {currentProcess.machines?.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <Settings2 className="mx-auto mb-2 text-teal-500 opacity-60" size={32} />
                      <p className="text-sm text-slate-500 font-medium">No machines linked to this process step yet.</p>
                      <button type="button" onClick={addMachineRow} className="btn btn-primary text-xs mt-3">
                        + Add First Machine
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentProcess.machines.map((row, idx) => {
                        const rowName = typeof row === 'object' ? (row.machine_name || row.name || '') : String(row);
                        return (
                          <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                            <div className="md:col-span-7">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Machine / Workstation Name</label>
                              <input
                                type="text"
                                value={rowName}
                                onChange={(e) => updateMachineRow(idx, "machine_name", e.target.value)}
                                placeholder="Select or type machine name..."
                                className="input w-full py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                                list={`setup-machines-list-${idx}`}
                              />
                              <datalist id={`setup-machines-list-${idx}`}>
                                {allMachines.map((m) => (
                                  <option key={m.id} value={m.machine_name || m.name}>
                                    {m.code ? `${m.code} - ` : ""}[{m.status || "Active"}]
                                  </option>
                                ))}
                              </datalist>
                            </div>

                            <div className="md:col-span-4">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                              <input
                                type="text"
                                value={typeof row === 'object' ? (row.status || "Active") : "Active"}
                                onChange={(e) => updateMachineRow(idx, "status", e.target.value)}
                                placeholder="Active / Standby"
                                className="input w-full py-1.5 text-xs"
                              />
                            </div>

                            <div className="md:col-span-1 flex justify-end pt-4">
                              <button
                                type="button"
                                onClick={() => removeMachineRow(idx)}
                                className="text-rose-500 hover:text-rose-700 p-1"
                                title="Remove Machine"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Footer Controls */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Save Manufacturing Process
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
