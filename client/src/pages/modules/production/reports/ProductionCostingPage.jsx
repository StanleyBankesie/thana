/**
 * @fileoverview ProductionCostingPage component.
 * Dedicated Production Costing Summary Page.
 * Connects to live database costing data, uses base currency from fin_currencies,
 * and uses bg-brand-900 for the Select Production Order card.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calculator, RefreshCw, DollarSign, Layers, CheckCircle2 } from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function ProductionCostingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [costing, setCosting] = useState(null);
  const [currencySymbol, setCurrencySymbol] = useState("$");

  const fetchData = async (orderId = selectedOrderId) => {
    setLoading(true);
    try {
      const res = await api.get("/production/reports/costing-data", {
        params: { order_id: orderId || undefined }
      });
      const orders = res.data?.work_orders || [];
      setWorkOrders(orders);
      if (res.data?.currency?.symbol) {
        setCurrencySymbol(res.data.currency.symbol);
      }
      if (res.data?.selected_order_id && !selectedOrderId) {
        setSelectedOrderId(String(res.data.selected_order_id));
      }
      setCosting(res.data?.costing || null);
    } catch {
      toast.error("Failed to load production order costing data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOrderChange = (e) => {
    const newId = e.target.value;
    setSelectedOrderId(newId);
    fetchData(newId);
  };

  const produceQty = costing?.produce_qty || 1;
  const matCost = costing?.material_cost || 0;
  const labCost = costing?.labor_cost || 0;
  const macCost = costing?.machine_cost || 0;
  const ovhCost = costing?.overhead_cost || 0;
  const totCost = costing?.total_cost || (matCost + labCost + macCost + ovhCost);
  const unitCost = costing?.unit_cost || (totCost / produceQty);

  function exportExcel() {
    if (!costing) return;
    const rows = [
      { Element: "Material Cost", Valuation: matCost },
      { Element: "Direct Labor Cost", Valuation: labCost },
      { Element: "Machine & Equipment Cost", Valuation: macCost },
      { Element: "Factory Overhead Cost", Valuation: ovhCost },
      { Element: "Total Production Valuation", Valuation: totCost },
      { Element: "Unit Production Cost", Valuation: unitCost }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CostingValuation");
    XLSX.writeFile(wb, `production-costing-${costing.order_no || 'order'}.xlsx`);
  }

  function exportPDF() {
    if (!costing) return;
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(14);
    doc.text(`Production Costing & Valuation - Order #${costing.order_no}`, 10, 15);
    doc.setFontSize(10);
    doc.text(`Finished Product: ${costing.item_name} (${costing.item_code})`, 10, 25);
    doc.text(`Planned Quantity: ${produceQty}`, 10, 32);
    doc.text(`Material Cost: ${currencySymbol}${matCost.toFixed(2)}`, 10, 42);
    doc.text(`Labor Cost: ${currencySymbol}${labCost.toFixed(2)}`, 10, 49);
    doc.text(`Machine Cost: ${currencySymbol}${macCost.toFixed(2)}`, 10, 56);
    doc.text(`Overhead Cost: ${currencySymbol}${ovhCost.toFixed(2)}`, 10, 63);
    doc.text(`Total Valuation: ${currencySymbol}${totCost.toFixed(2)}`, 10, 72);
    doc.text(`Unit Cost: ${currencySymbol}${unitCost.toFixed(2)} / Unit`, 10, 79);
    doc.save(`production-costing-${costing.order_no || 'order'}.pdf`);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => navigate("/production?section=Reports%20%26%20Costing")} 
            className="font-sans text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Reports & Costing
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Production Costing & Valuation
          </h1>
          <p className="text-sm mt-1 text-slate-500">Material Cost + Direct Labor + Machine Cost + Overhead = Production Cost Breakdown</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Select Order Card - bg-brand-900 */}
        <div className="card p-6 bg-brand-900 dark:bg-brand-950 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl rounded-2xl border border-brand-800">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-300">Select Production Order</p>
            <h2 className="text-lg font-bold text-white">Calculate Live Production Cost & Valuation Breakdown</h2>
          </div>

          <div className="w-full md:w-96">
            <select
              value={selectedOrderId}
              onChange={handleOrderChange}
              className="input bg-brand-950 border-brand-700 text-white w-full py-2.5 font-bold focus:ring-brand-500"
            >
              {workOrders.map((wo) => (
                <option key={wo.id} value={wo.id}>
                  Order #{wo.work_order_no} — {wo.item_name || "Output"} ({wo.qty_to_produce} Units)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary px-4 whitespace-nowrap"
            onClick={exportExcel}
            disabled={!costing}
          >
            Export Excel
          </button>
          <button
            type="button"
            className="btn-primary px-4 whitespace-nowrap"
            onClick={exportPDF}
            disabled={!costing}
          >
            Export PDF
          </button>
          <button
            type="button"
            className="btn-primary px-4 whitespace-nowrap"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>

        {/* Cost Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card p-6 border-l-4 border-l-brand-600 space-y-2 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase">Material Cost</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {currencySymbol}{matCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-400">Raw materials & component consumption</p>
          </div>

          <div className="card p-6 border-l-4 border-l-blue-600 space-y-2 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase">Direct Labor Cost</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {currencySymbol}{labCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-400">Operator wages & shift labor hours</p>
          </div>

          <div className="card p-6 border-l-4 border-l-purple-600 space-y-2 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase">Machine & Equipment Cost</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {currencySymbol}{macCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-400">Power, fuel & machine depreciation</p>
          </div>

          <div className="card p-6 border-l-4 border-l-emerald-600 space-y-2 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Production Cost</p>
            <p className="text-2xl font-bold text-emerald-600">
              {currencySymbol}{totCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              Unit Cost: {currencySymbol}{unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} / Unit
            </p>
          </div>
        </div>

        {/* Costing Summary Table */}
        <div className="card">
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th>Cost Element / Component</th>
                    <th className="text-right">Valuation Rate / Unit</th>
                    <th className="text-right">Total Allocated Cost ({currencySymbol})</th>
                    <th className="text-center">Share %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-slate-400 font-bold animate-pulse">
                        Calculating live production costing...
                      </td>
                    </tr>
                  ) : costing ? (
                    <>
                      <tr>
                        <td className="font-semibold text-sm text-slate-900 dark:text-slate-100">Raw Material & Component Consumption</td>
                        <td className="text-right font-mono text-sm text-slate-700 dark:text-slate-300">{currencySymbol}{(matCost / produceQty).toFixed(2)} / Unit</td>
                        <td className="text-right font-mono font-bold text-sm text-slate-900 dark:text-slate-100">{currencySymbol}{matCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="text-center font-mono font-bold text-xs">{totCost > 0 ? Math.round((matCost / totCost) * 100) : 0}%</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-sm text-slate-900 dark:text-slate-100">Direct Operator & Labor Allocation</td>
                        <td className="text-right font-mono text-sm text-slate-700 dark:text-slate-300">{currencySymbol}{(labCost / produceQty).toFixed(2)} / Unit</td>
                        <td className="text-right font-mono font-bold text-sm text-slate-900 dark:text-slate-100">{currencySymbol}{labCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="text-center font-mono font-bold text-xs">{totCost > 0 ? Math.round((labCost / totCost) * 100) : 0}%</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-sm text-slate-900 dark:text-slate-100">Machine Power, Fuel & Operating Hours</td>
                        <td className="text-right font-mono text-sm text-slate-700 dark:text-slate-300">{currencySymbol}{(macCost / produceQty).toFixed(2)} / Unit</td>
                        <td className="text-right font-mono font-bold text-sm text-slate-900 dark:text-slate-100">{currencySymbol}{macCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="text-center font-mono font-bold text-xs">{totCost > 0 ? Math.round((macCost / totCost) * 100) : 0}%</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-sm text-slate-900 dark:text-slate-100">Factory Overheads & Facility Utility Allocation</td>
                        <td className="text-right font-mono text-sm text-slate-700 dark:text-slate-300">{currencySymbol}{(ovhCost / produceQty).toFixed(2)} / Unit</td>
                        <td className="text-right font-mono font-bold text-sm text-slate-900 dark:text-slate-100">{currencySymbol}{ovhCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="text-center font-mono font-bold text-xs">{totCost > 0 ? Math.round((ovhCost / totCost) * 100) : 0}%</td>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 font-bold">
                        <td className="text-base text-slate-900 dark:text-white">Total Production Valuation</td>
                        <td className="text-right font-mono text-base text-brand-600 dark:text-brand-400">{currencySymbol}{unitCost.toFixed(2)} / Unit</td>
                        <td className="text-right font-mono text-lg text-emerald-600">{currencySymbol}{totCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="text-center font-mono text-sm text-emerald-600">100%</td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-slate-400 font-medium">
                        No production costing records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
