import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Search, 
  Trash2, 
  ArrowLeft,
  Eye,
  Edit2,
  Layers,
  CheckCircle2,
  Package
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function BomList() {
  const [viewMode, setViewMode] = useViewMode();
  const [boms, setBoms] = useState([]);
  const [items, setItems] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    try {
      const [bomsRes, itemsRes, procRes, currRes] = await Promise.all([
        api.get("/production/boms"),
        api.get("/inventory/items"),
        api.get("/production/setup/processes"),
        api.get("/currencies").catch(() => ({ data: { items: [] } })),
      ]);

      const curList = Array.isArray(currRes.data?.items) ? currRes.data.items : [];
      const base = curList.find((c) => Number(c.is_base) === 1 || c.is_base === true || Number(c.is_base_currency) === 1);
      if (base) setCurrencySymbol(base.symbol || base.code || "$");

      setItems(itemsRes.data?.items || []);
      setProcesses(procRes.data?.items || []);
      setBoms(bomsRes.data?.items || []);
    } catch {
      toast.error("Failed to fetch BOM specifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this BOM specification?")) return;
    try {
      await api.delete(`/production/boms/${id}`);
      toast.success("BOM specification deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete BOM");
    }
  };

  // Helper to compute Total Cost per Batch for a BOM item
  const calculateBatchCost = (bom) => {
    const operations = Array.isArray(bom.operations) ? bom.operations : [];
    if (operations.length === 0) return 0;

    let totalCost = 0;
    operations.forEach((row) => {
      const targetProc = processes.find((p) => String(p.id) === String(row.process_id));
      if (!targetProc) return;

      const inputsList = targetProc.inputs || [];
      const overheadsList = targetProc.overheads || [];
      const byProductsList = targetProc.by_products || [];

      const inputsVal = inputsList.reduce((iAcc, curr) => {
        const q = parseFloat(curr.qty) || 0;
        const s = parseFloat(curr.scrap_percent) || 0;
        const matchedItem = items.find(it => String(it.id) === String(curr.item_id));
        const c = parseFloat(curr.cost_value || (matchedItem ? matchedItem.purchase_price || matchedItem.unit_cost || matchedItem.valuation_rate || matchedItem.cost_price : 0) || 0);
        const grossQty = q * (1 + s / 100);
        return iAcc + grossQty * c;
      }, 0);

      const overheadsVal = overheadsList.reduce((oAcc, curr) => {
        const q = parseFloat(curr.qty) || 1;
        const r = parseFloat(curr.cost_rate) || 0;
        return oAcc + q * r;
      }, 0);

      const byProductsVal = byProductsList.reduce((bAcc, curr) => {
        const q = parseFloat(curr.expected_qty) || 0;
        const matchedItem = items.find(it => String(it.id) === String(curr.item_id));
        const r = parseFloat(curr.recovery_value || (matchedItem ? matchedItem.purchase_price || matchedItem.unit_cost || matchedItem.valuation_rate || matchedItem.cost_price : 0) || 0);
        return bAcc + q * r;
      }, 0);

      totalCost += Math.max(0, inputsVal + overheadsVal - byProductsVal);
    });

    return totalCost;
  };

  const searchFilteredBoms = boms.filter(b => 
    String(b.bom_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(b.item_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(b.item_code || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const enrichedBoms = searchFilteredBoms.map(b => ({
    ...b,
    calculated_batch_cost: calculateBatchCost(b),
  }));

  const { sorted: sortedBoms, sortKey, sortDir, toggle } = useSort(enrichedBoms, "created_at", "desc");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/production" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">BOM / Manufacturing Specifications</h1>
            <p className="text-slate-500 text-sm">Product recipes, required materials, scrap allowances, and operation sequences</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search specifications..."
              className="input pl-10 pr-4 py-2 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link 
            to="/production/boms/new" 
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            New Specification
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden shadow-sm">
        <div className="flex justify-end p-4">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
        <div className="overflow-x-auto">
          <table className={"table w-full table-fixed " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                <SortableHeader label="BOM / Specification" sortKey="bom_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="w-1/6" />
                <SortableHeader label="Finished Product" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="w-1/6" />
                <SortableHeader label="Output Qty" sortKey="output_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="w-1/6" />
                <SortableHeader label="Total Cost per Batch" sortKey="calculated_batch_cost" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="w-1/6 text-right" />
                <SortableHeader label="Status" sortKey="is_active" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="w-1/6 text-center" />
                <th className="w-1/6 text-right px-6 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">
                    Loading BOM specifications...
                  </td>
                </tr>
              ) : sortedBoms.length > 0 ? sortedBoms.map((bom) => (
                <tr key={bom.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="w-1/6 px-6 py-4 truncate">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600 shrink-0">
                        <Layers size={18} />
                      </div>
                      <div className="min-w-0 truncate">
                        <span className="font-bold text-brand-900 dark:text-brand-300 block truncate" title={bom.bom_name}>{bom.bom_name}</span>
                        <span className="text-xs text-slate-400">Ver 1.0</span>
                      </div>
                    </div>
                  </td>
                  <td className="w-1/6 px-6 py-4 font-medium text-slate-700 dark:text-slate-200 truncate" title={bom.item_name ? `${bom.item_name} (${bom.item_code || ''})` : "General Recipe"}>
                    {bom.item_name ? `${bom.item_name} (${bom.item_code || ''})` : "General Recipe"}
                  </td>
                  <td className="w-1/6 px-6 py-4 font-bold text-slate-900 dark:text-white">
                    {Math.round(parseFloat(bom.output_qty) || 0)} {bom.uom || "Pcs"}
                  </td>
                  <td className="w-1/6 px-6 py-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {currencySymbol}{bom.calculated_batch_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="w-1/6 px-6 py-4 text-center">
                    {bom.is_active ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <CheckCircle2 size={12} className="inline mr-1" /> Active
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="w-1/6 px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        to={`/production/boms/edit/${bom.id}`}
                        className="btn btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 font-semibold"
                        title="View Specification"
                      >
                        <Eye size={14} /> View
                      </Link>
                      <Link
                        to={`/production/boms/edit/${bom.id}`}
                        className="btn btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1 font-semibold"
                        title="Edit Specification"
                      >
                        <Edit2 size={14} /> Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(bom.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                        title="Delete BOM"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-slate-400">
                    <Package className="mx-auto mb-2 opacity-50" size={32} />
                    No BOM specifications found. Click "New Specification" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
