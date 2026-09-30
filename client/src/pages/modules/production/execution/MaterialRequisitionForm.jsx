import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Loader2,
  Calendar,
  Layers,
  ChevronDown,
  Info,
  Package
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import { usePermission } from "@/auth/PermissionContext.jsx";
import { useAuth } from "@/auth/AuthContext.jsx";
import { useUoms } from "@/hooks/useUoms";
import { filterByPrefix } from "@/utils/searchUtils.js";

export default function MaterialRequisitionForm() {
  const { id } = useParams();
  const { hasExceptional } = usePermission();
  const { user } = useAuth();
  const { uoms } = useUoms();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [items, setItems] = useState([]);
  const [plans, setPlans] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [itemQueries, setItemQueries] = useState({});
  
  const [formData, setFormData] = useState({
    plan_id: "",
    warehouse_id: "",
    department_id: "",
    priority: "MEDIUM",
    requisition_type: "PRODUCTION",
    requested_by: user?.id || user?.sub || user?.username || "",
    requisition_date: new Date().toISOString().split('T')[0],
    remarks: "",
    items: [
      {
        id: 1,
        item_id: "",
        itemCode: "",
        itemName: "",
        qtyRequested: 0,
        qtyReceived: 0,
        uom: "PCS",
        batchNo: ""
      }
    ]
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, plansRes, whRes, deptRes, usersRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/production/planning/daily"),
          api.get("/inventory/warehouses").catch(() => ({ data: { items: [] } })),
          api.get("/admin/departments").catch(() => ({ data: { items: [] } })),
          api.get("/admin/users", { params: { active: 1 } }).catch(() => ({ data: { items: [] } }))
        ]);
        
        const fetchedItems = itemsRes.data?.items || [];
        const fetchedPlans = plansRes.data?.items || [];
        const fetchedWh = whRes.data?.items || [];
        const fetchedDepts = deptRes.data?.items || deptRes.data || [];
        const fetchedUsers = (usersRes?.data && usersRes.data.data && Array.isArray(usersRes.data.data.items) && usersRes.data.data.items) ||
          (Array.isArray(usersRes?.data?.items) && usersRes.data.items) || [];

        setItems(fetchedItems);
        setPlans(fetchedPlans);
        setWarehouses(fetchedWh);
        setDepartments(fetchedDepts);
        setUsers(fetchedUsers);

        // Find production department ID
        const prodDept = fetchedDepts.find(d => 
          String(d.name || d.department_name || "").toLowerCase().includes("production")
        ) || fetchedDepts[0];

        // Auto-select latest production plan if available
        const defaultPlanId = fetchedPlans.length > 0 ? String(fetchedPlans[0].id) : "";

        setFormData(prev => ({
          ...prev,
          department_id: prodDept ? String(prodDept.id) : prev.department_id,
          requested_by: user?.id || user?.sub || user?.username || prev.requested_by,
          plan_id: prev.plan_id || defaultPlanId
        }));

        setLoading(false);
      } catch (error) {
        toast.error("Failed to load dependency data");
      }
    };
    fetchData();
  }, [user]);

  const addItem = () => {
    const newId = Date.now();
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: newId,
          item_id: "",
          itemCode: "",
          itemName: "",
          qtyRequested: 0,
          qtyReceived: 0,
          uom: "PCS",
          batchNo: ""
        }
      ]
    }));
    setItemQueries(prev => ({ ...prev, [newId]: "" }));
  };

  const removeItem = (rowId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== rowId)
    }));
  };

  const handleSelectItem = (rowId, itemObj) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === rowId ? {
        ...i,
        item_id: String(itemObj.id),
        itemCode: itemObj.item_code || "",
        itemName: itemObj.item_name || "",
        uom: itemObj.uom || itemObj.unit_name || "PCS"
      } : i)
    }));
    setItemQueries(prev => ({ ...prev, [rowId]: itemObj.item_name || "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = formData.items
      .filter(i => i.item_id)
      .map(i => ({
        item_id: Number(i.item_id),
        qty_requested: Math.max(0, Number(i.qtyRequested) || 0),
        uom: i.uom || "PCS",
        batch_no: i.batchNo || null
      }));

    if (validItems.length === 0) return toast.error("Please add at least one material item");
    
    setSaving(true);
    try {
      const payload = {
        plan_id: formData.plan_id ? Number(formData.plan_id) : null,
        warehouse_id: formData.warehouse_id ? Number(formData.warehouse_id) : null,
        department_id: formData.department_id ? Number(formData.department_id) : null,
        priority: formData.priority,
        requisition_type: "PRODUCTION",
        requested_by: formData.requested_by,
        requisition_date: formData.requisition_date,
        remarks: formData.remarks || "",
        status: "PENDING",
        items: validItems
      };

      await api.post("/production/execution/material-requisition", payload);
      toast.success("Material requisition submitted successfully");
      navigate("/production/execution/material-requisition");
    } catch (error) {
      console.error("Material requisition submit error:", error);
      const errMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to submit requisition";
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading Environment...</div>;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">New Production Material Requisition</h1>
            <p className="text-sm mt-1">Issue formal material requests from central inventory to production</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.history.back()} type="button" className="btn-secondary">Back</button>
            <button 
              form="requisition-form"
              type="submit"
              disabled={saving}
              className="btn-success flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Submit Requisition
            </button>
          </div>
        </div>

        <div className="card-body space-y-6">
          <form id="requisition-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Target Production Plan (Auto-Populated) */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Target Production Plan *</label>
            <div className="relative">
              <select 
                required
                className="w-full pl-4 pr-10 py-3 bg-indigo-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-bold text-indigo-900 dark:text-indigo-200 shadow-inner"
                value={formData.plan_id}
                onChange={e => setFormData({...formData, plan_id: e.target.value})}
              >
                <option value="">Select Production Plan...</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.plan_no} — {p.product_name || "Production Item"} ({p.quantity || 0} Pcs)
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-600 pointer-events-none" size={18} />
            </div>
          </div>

          {/* Source Warehouse */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Source Warehouse</label>
            <div className="relative">
              <select 
                className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-bold"
                value={formData.warehouse_id}
                onChange={e => setFormData({...formData, warehouse_id: e.target.value})}
              >
                <option value="">Select Warehouse...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            </div>
          </div>

          {/* Requisition Priority */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Requisition Priority</label>
            <div className="relative">
              <select 
                className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-bold"
                value={formData.priority}
                onChange={e => setFormData({...formData, priority: e.target.value})}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            </div>
          </div>

          {/* Request Date */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Calendar size={16} className="text-brand-600" /> Request Date
            </label>
            <input 
              type="date" 
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-bold"
              value={formData.requisition_date}
              onChange={e => setFormData({...formData, requisition_date: e.target.value})}
              disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
            />
          </div>

          {/* Remarks */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Justification / Remarks</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              value={formData.remarks}
              onChange={e => setFormData({...formData, remarks: e.target.value})}
              placeholder="e.g. Urgent raw material top-up for Assembly Line #2..."
            />
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package size={20} className="text-brand-900" />
              Requested Materials
            </h3>
            <button 
              type="button" 
              onClick={addItem} 
              className="btn-success text-sm flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold"
            >
              <Plus size={16} /> + Add Item
            </button>
          </div>

          <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
            <table className="table w-full">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700">
                  <th className="w-1/2 min-w-[300px] py-3">Item Name</th>
                  <th className="w-32 min-w-[110px] py-3">Qty Requested</th>
                  <th className="w-24 min-w-[80px] py-3">UOM</th>
                  <th className="w-40 min-w-[160px] py-3">Batch No</th>
                  <th className="w-20 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {formData.items.map((item) => {
                  const itemQuery = itemQueries[item.id] || "";
                  const showQuery = item.item_id ? item.itemName : itemQuery;
                  const searchResults = itemQuery.trim() && !item.item_id
                    ? filterByPrefix(items, { query: itemQuery, searchFields: ["item_code", "item_name", "barcode"] })
                    : [];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5">
                        <div className="relative">
                          <input 
                            id={`prod-mr-item-search-${item.id}`} 
                            autoComplete="off"
                            className="input w-full py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm font-bold" 
                            placeholder="Type to search items"
                            value={showQuery}
                            onChange={e => {
                              const val = e.target.value;
                              setItemQueries(prev => ({ ...prev, [item.id]: val }));
                              if (item.item_id) {
                                setFormData(prev => ({
                                  ...prev,
                                  items: prev.items.map(i => i.id === item.id ? { ...i, item_id: "", itemCode: "", itemName: "" } : i)
                                }));
                              }
                            }}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                const query = (itemQueries[item.id] || "").trim();
                                if (!query || !searchResults.length) return;
                                handleSelectItem(item.id, searchResults[0]);
                              }
                            }}
                          />
                          {searchResults.length ? (() => {
                            const el = document.getElementById(`prod-mr-item-search-${item.id}`);
                            const r = el ? el.getBoundingClientRect() : { bottom: 0, left: 0, width: 0 };
                            return (
                              <div 
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-auto"
                                style={{ position: 'fixed', top: `${r.bottom + 4}px`, left: `${r.left}px`, width: `${r.width}px`, zIndex: 9999 }}
                              >
                                {searchResults.map(o => (
                                  <button 
                                    type="button" 
                                    key={o.id}
                                    className="block w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                                    onClick={() => handleSelectItem(item.id, o)}
                                  >
                                    {o.item_code} - {o.item_name}
                                  </button>
                                ))}
                              </div>
                            );
                          })() : null}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <input 
                          type="number" 
                          className="input py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm font-bold text-center" 
                          value={item.qtyRequested}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setFormData(prev => ({
                              ...prev,
                              items: prev.items.map(i => i.id === item.id ? { ...i, qtyRequested: val } : i)
                            }));
                          }} 
                          min="0" 
                          step="1" 
                          inputMode="numeric" 
                          pattern="[0-9]*" 
                        />
                      </td>
                      <td className="py-2.5">
                        <select 
                          className="input py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs font-bold" 
                          value={item.uom || ""}
                          onChange={e => {
                            const val = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              items: prev.items.map(i => i.id === item.id ? { ...i, uom: val } : i)
                            }));
                          }}
                        >
                          <option value="">UOM</option>
                          {(Array.isArray(uoms) && uoms.length ? uoms.map(u => ({ code: u.uom_code || u.code || "", name: u.uom_name || u.name || "" }))
                            : [{ code: "EA", name: "EA" }, { code: "PCS", name: "PCS" }, { code: "KG", name: "KG" }, { code: "LTR", name: "LTR" }, { code: "MTR", name: "MTR" }]
                          ).map(u => (
                            <option key={u.code} value={u.code}>{u.name ? `${u.name} (${u.code})` : u.code}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5">
                        <input 
                          type="text" 
                          className="input py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs font-bold" 
                          placeholder="Batch No" 
                          value={item.batchNo || ""}
                          onChange={e => {
                            const val = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              items: prev.items.map(i => i.id === item.id ? { ...i, batchNo: val } : i)
                            }));
                          }} 
                        />
                      </td>
                      <td className="py-2.5 text-right">
                        <button 
                          type="button" 
                          onClick={() => removeItem(item.id)} 
                          className="text-red-600 hover:text-red-800 text-sm font-bold"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {formData.items.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm italic">
                Click "+ Add Item" to add materials to requisition.
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  </div>
</div>
  );
}
