/**
 * @fileoverview FinishedGoodsTransferForm component.
 * Transfers inspected finished goods from Finished Goods Production Warehouse to Inventory Warehouse
 * for receipt & acceptance on the Transfer Acceptance page.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Truck, 
  Building, 
  Warehouse, 
  Plus, 
  Trash2, 
  Calendar, 
  User, 
  FileText,
  PackageCheck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function FinishedGoodsTransferForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [eligibleExecutions, setEligibleExecutions] = useState([]);
  const [fgWarehouses, setFgWarehouses] = useState([]);
  const [inventoryWarehouses, setInventoryWarehouses] = useState([]);
  const [autoAccept, setAutoAccept] = useState(false);

  const [formData, setFormData] = useState({
    job_card_id: "",
    job_card_no: "",
    qc_id: "",
    qc_number: "",
    transfer_date: new Date().toISOString().split("T")[0],
    from_warehouse_id: "",
    to_warehouse_id: "",
    driver_name: "",
    vehicle_no: "",
    remarks: "",
    status: "DISPATCHED"
  });

  const [selectedExecutionMeta, setSelectedExecutionMeta] = useState(null);

  const [transferItems, setTransferItems] = useState([
    { item_id: "", item_code: "", item_name: "", batch_no: "", qty: 1, uom: "Pcs", mfg_date: "", expiry_date: "" }
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [eligibleRes, fgWhRes, invWhRes] = await Promise.all([
          api.get("/production/execution/fg-transfer/eligible-executions").catch(() => ({ data: { items: [] } })),
          api.get("/production/setup/warehouses").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/warehouses").catch(() => ({ data: { items: [] } }))
        ]);

        const eligible = eligibleRes.data?.items || [];
        setEligibleExecutions(eligible);

        const prodWh = (fgWhRes.data?.items || []).filter(w => w.is_active !== 0 && w.is_active !== false);
        setFgWarehouses(prodWh);

        const invWh = invWhRes.data?.items || [];
        setInventoryWarehouses(invWh);

        // Pre-select first eligible completed & passed execution if available
        if (eligible.length > 0) {
          const first = eligible[0];
          handleExecutionSelect(first.job_card_id, eligible, prodWh, invWh);
        } else {
          // Default to Finished Goods production warehouse
          const defaultFgWh = prodWh.find(w => 
            (w.warehouse_name || '').toLowerCase().includes('finished') || 
            (w.code || '').toLowerCase().includes('fg')
          ) || prodWh[0];

          setFormData(prev => ({
            ...prev,
            from_warehouse_id: defaultFgWh ? String(defaultFgWh.id) : "",
            to_warehouse_id: invWh.length > 0 ? String(invWh[0].id) : ""
          }));
        }
      } catch {
        toast.error("Failed to load completed executions or warehouse data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleExecutionSelect = (jobCardId, eligibleList = eligibleExecutions, prodWhList = fgWarehouses, invWhList = inventoryWarehouses) => {
    const selected = eligibleList.find(e => String(e.job_card_id) === String(jobCardId));
    if (!selected) {
      setFormData(prev => ({
        ...prev,
        job_card_id: "",
        job_card_no: "",
        qc_id: "",
        qc_number: ""
      }));
      setSelectedExecutionMeta(null);
      return;
    }

    setSelectedExecutionMeta(selected);

    const mfgDateFormatted = selected.mfg_date 
      ? new Date(selected.mfg_date).toISOString().split("T")[0] 
      : new Date().toISOString().split("T")[0];
      
    const expDateFormatted = selected.expiry_date 
      ? new Date(selected.expiry_date).toISOString().split("T")[0] 
      : "";

    // Find default or linked production warehouse
    const matchedFgWh = prodWhList.find(w => String(w.id) === String(selected.fg_warehouse_id)) ||
      prodWhList.find(w => (w.warehouse_name || '').toLowerCase().includes('finished') || (w.code || '').toLowerCase().includes('fg')) ||
      prodWhList[0];

    setFormData(prev => ({
      ...prev,
      job_card_id: selected.job_card_id,
      job_card_no: selected.job_card_no || `JC-${selected.job_card_id}`,
      qc_id: selected.qc_id,
      qc_number: selected.qc_number || `QC-${String(selected.qc_id).padStart(5, '0')}`,
      from_warehouse_id: matchedFgWh ? String(matchedFgWh.id) : prev.from_warehouse_id,
      to_warehouse_id: prev.to_warehouse_id || (invWhList[0]?.id ? String(invWhList[0].id) : "")
    }));

    setTransferItems([
      {
        item_id: selected.item_id || 1,
        item_code: selected.item_code || "",
        item_name: selected.item_name || "Produced Finished Good",
        batch_no: selected.batch_no || "",
        qty: Number(selected.good_qty || 1),
        uom: selected.uom || "PCS",
        mfg_date: mfgDateFormatted,
        expiry_date: expDateFormatted
      }
    ]);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...transferItems];
    updated[index] = { ...updated[index], [field]: value };
    setTransferItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.job_card_id) {
      return toast.error("Please select an eligible completed Production Execution with passed QC");
    }
    if (!formData.from_warehouse_id) {
      return toast.error("Please select a Source Finished Goods Warehouse");
    }
    if (!formData.to_warehouse_id) {
      return toast.error("Please select a Target Inventory Warehouse");
    }

    const validLines = transferItems.filter(i => i.item_id && Number(i.qty) > 0);
    if (validLines.length === 0) {
      return toast.error("Please add at least one valid item line with quantity > 0");
    }

    setSaving(true);
    try {
      const payload = {
        job_card_id: formData.job_card_id,
        job_card_no: formData.job_card_no,
        qc_id: formData.qc_id,
        qc_number: formData.qc_number,
        transfer_date: formData.transfer_date,
        from_warehouse_id: formData.from_warehouse_id,
        to_warehouse_id: formData.to_warehouse_id,
        driver_name: formData.driver_name,
        vehicle_no: formData.vehicle_no,
        remarks: formData.remarks,
        auto_accept: autoAccept,
        status: autoAccept ? "RECEIVED" : "IN_TRANSIT",
        items: validLines
      };

      const res = await api.post("/production/execution/fg-transfer", payload);
      const generatedNo = res.data?.transfer_no || "Transfer";

      const targetWh = inventoryWarehouses.find(w => String(w.id) === String(formData.to_warehouse_id));
      const destinationWhName = targetWh?.warehouse_name || targetWh?.name || "destination warehouse";

      if (autoAccept) {
        toast.success(`Finished Goods Transfer ${generatedNo} posted directly to ${destinationWhName} stock balances.`);
      } else {
        toast.success(`Finished Goods Transfer ${generatedNo} dispatched. Stock will be updated in ${destinationWhName} when acceptance is done.`);
      }

      navigate("/production/execution/fg-transfer");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to create Finished Goods Transfer");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-20 text-center animate-pulse font-bold text-slate-400">
        <Loader2 className="animate-spin inline mr-2" /> Loading Finished Goods Transfer Form...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="card">
        <div className="card-header bg-brand-900 text-white dark:bg-brand-950 rounded-t-lg flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link to="/production/execution/fg-transfer" className="btn btn-secondary p-2">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300 flex items-center gap-2">
                <Truck className="h-7 w-7 text-amber-400" />
                New Finished Goods Stock Transfer
              </h1>
              <p className="text-sm mt-1 text-slate-100">
                Transfer inspected finished goods from completed executions to inventory warehouses for Transfer Acceptance.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/production/execution/fg-transfer" className="font-sans btn btn-secondary text-xs">
              Return to FG Transfers List
            </Link>
          </div>
        </div>
      </div>

      {eligibleExecutions.length === 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 rounded-xl flex items-start gap-3 text-amber-800 dark:text-amber-200 text-xs font-medium">
          <AlertCircle size={20} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold">No Passed Quality Control Executions Available</p>
            <p className="mt-1">
              Only job executions that are marked <strong>COMPLETED</strong> and have a linked Quality Control inspection with status <strong>PASSED</strong> can be transferred to inventory warehouses.
            </p>
            <Link to="/production/execution/output" className="inline-block mt-2 font-bold underline text-amber-700 dark:text-amber-300">
              Go to Quality Control & Inspection →
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Execution & QC Traceability */}
        <div className="card p-6 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <ShieldCheck size={18} className="text-brand-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Production Execution & QC Linkage
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Production Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Production Number (Completed Execution) <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.job_card_id}
                onChange={(e) => handleExecutionSelect(e.target.value)}
                className="input w-full text-xs font-semibold"
                required
              >
                <option value="">-- Select Completed Job Execution --</option>
                {eligibleExecutions.map((exec) => (
                  <option key={exec.job_card_id} value={exec.job_card_id}>
                    {exec.job_card_no || `JC-${exec.job_card_id}`} — {exec.item_name} ({Number(exec.good_qty).toFixed(2)} {exec.uom})
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Filtered strictly to executions with status COMPLETED and QC status PASSED
              </span>
            </div>

            {/* QC Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                QC Number (Quality Audit #)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.qc_number || (formData.qc_id ? `QC-${String(formData.qc_id).padStart(5, '0')}` : "")}
                  readOnly
                  placeholder="Auto-populated from passed QC inspection"
                  className="input w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900/60 text-emerald-600 pl-8"
                />
                <CheckCircle2 size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />
              </div>
              {selectedExecutionMeta && (
                <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                  ✓ QC Score: {selectedExecutionMeta.quality_score}% ({selectedExecutionMeta.quality_status})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Warehouse Routing */}
        <div className="card p-6 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <Warehouse size={18} className="text-brand-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Warehouse Routing
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Transfer Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Transfer Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.transfer_date}
                onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
                className="input w-full text-xs font-medium"
                required
              />
            </div>

            {/* Source FG Warehouse */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Source Finished Goods Warehouse <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.from_warehouse_id}
                onChange={(e) => setFormData({ ...formData, from_warehouse_id: e.target.value })}
                className="input w-full text-xs font-semibold"
                required
              >
                <option value="">-- Select Source Production Warehouse --</option>
                {fgWarehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.warehouse_name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Inventory Warehouse */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Inventory Warehouse <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.to_warehouse_id}
                onChange={(e) => setFormData({ ...formData, to_warehouse_id: e.target.value })}
                className="input w-full text-xs font-semibold"
                required
              >
                <option value="">-- Select Target Inventory Warehouse --</option>
                {inventoryWarehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name || wh.warehouse_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Finished Products to Transfer */}
        <div className="card p-6 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <PackageCheck size={18} className="text-brand-600" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Finished Products to Transfer
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-900 text-white dark:bg-brand-950 font-bold uppercase tracking-wider border-b border-brand-800">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Batch / Lot #</th>
                  <th className="px-4 py-3 text-right">Transfer Qty</th>
                  <th className="px-4 py-3">UOM</th>
                  <th className="px-4 py-3">MFG Date</th>
                  <th className="px-4 py-3">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {transferItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {item.item_name} {item.item_code ? `(${item.item_code})` : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                      {item.batch_no || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                        className="input text-xs font-mono font-bold text-right w-28 inline-block"
                        required
                      />
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400">
                      {item.uom || "PCS"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {item.mfg_date ? new Date(item.mfg_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Logistics & Dispatch Handling */}
        <div className="card p-6 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <Truck size={18} className="text-brand-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Logistics & Dispatch Handling
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Driver Name (Optional)
              </label>
              <input
                type="text"
                value={formData.driver_name}
                onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                placeholder="Logistics driver name"
                className="input w-full text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Vehicle No / Reg No (Optional)
              </label>
              <input
                type="text"
                value={formData.vehicle_no}
                onChange={(e) => setFormData({ ...formData, vehicle_no: e.target.value })}
                placeholder="e.g. GR-234-26"
                className="input w-full text-xs font-mono font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Dispatch Remarks & Handling Instructions
            </label>
            <textarea
              rows={3}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Enter transfer notes, dispatch verification details, or special handling notes..."
              className="input w-full text-xs font-medium"
            />
          </div>

          {/* Direct Stock Receipt Option */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
            <label className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={autoAccept}
                onChange={(e) => setAutoAccept(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PackageCheck size={16} className={autoAccept ? "text-emerald-600" : "text-slate-400"} />
                  Direct Stock Receipt (One-Step Inventory Posting)
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Post finished products directly into destination warehouse inventory stock balances upon dispatch.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link to="/production/execution/fg-transfer" className="btn btn-secondary text-xs">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || eligibleExecutions.length === 0}
            className="btn-success text-xs font-bold px-6 py-2 flex items-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {autoAccept ? "Accept & Transfer to Stock" : "Dispatch Finished Goods Transfer"}
          </button>
        </div>

      </form>
    </div>
  );
}
