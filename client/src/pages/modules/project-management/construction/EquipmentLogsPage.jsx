/**
 * @file EquipmentLogsPage.jsx
 * @description Construction plant & heavy equipment operating logs, fuel consumption, and hourly costing.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Truck,
  Plus,
  ArrowLeft,
  Clock,
  Fuel,
  DollarSign,
  AlertCircle,
  X,
  Search,
  RefreshCw
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function EquipmentLogsPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [equipments, setEquipments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    equipment_id: "",
    log_date: new Date().toISOString().split("T")[0],
    hours_worked: 8,
    hours_idle: 0,
    hours_breakdown: 0,
    fuel_consumed_litres: 45,
    operator_name: "",
    hourly_rate: 150,
    remarks: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const [pRes, eqRes] = await Promise.all([
          api.get("/projects/projects", { params: { active: "all" } }),
          api.get("/projects/equipments").catch(() => ({ data: { items: [] } })),
        ]);
        const prjs = pRes.data?.items || [];
        setProjects(prjs);
        if (prjs.length > 0) setSelectedProjectId(String(prjs[0].id));

        const eqs = eqRes.data?.items || [];
        setEquipments(eqs);
        if (eqs.length > 0) setForm(f => ({ ...f, equipment_id: String(eqs[0].id) }));
      } catch (e) {
        toast.error("Failed to load initial data");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchLogs();
  }, [selectedProjectId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/construction/equipment-logs", { params: { project_id: selectedProjectId } });
      setLogs(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load equipment logs");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLog = async (e) => {
    e.preventDefault();
    if (!form.equipment_id) return toast.error("Please select equipment");
    try {
      await api.post("/construction/equipment-logs", {
        ...form,
        project_id: selectedProjectId,
      });
      toast.success("Equipment operating log recorded");
      setShowModal(false);
      fetchLogs();
    } catch (e) {
      toast.error("Failed to record equipment log");
    }
  };

  const totalHoursWorked = logs.reduce((a, c) => a + Number(c.hours_worked || 0), 0);
  const totalFuel = logs.reduce((a, c) => a + Number(c.fuel_consumed_litres || 0), 0);
  const totalCost = logs.reduce((a, c) => a + Number(c.total_cost || 0), 0);

  const filteredLogs = logs.filter(l => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      l.equipment_name?.toLowerCase().includes(q) ||
      l.operator_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Canonical List Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Truck size={24} className="text-brand-900 dark:text-brand-400" /> Plant & Heavy Equipment Operating Logs
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Track daily machine operating hours, idle/breakdown downtime, fuel consumption, and costing
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search equipment..."
              className="input pl-9 pr-3 py-1.5 text-sm h-auto w-48"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchLogs}
            className="btn btn-secondary p-2"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> Log Operating Hours
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Operating Hours</span>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{totalHoursWorked} Hours</p>
          <p className="text-[10px] text-slate-400">Recorded machine runtime</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Total Fuel Consumed</span>
          <p className="text-2xl font-bold font-mono text-amber-600">{totalFuel} Litres</p>
          <p className="text-[10px] text-slate-400">Diesel / Petrol dispensed</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Operating Plant Cost</span>
          <p className="text-2xl font-bold font-mono text-emerald-600">
            GHS {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-400">Hours * hourly charge rate</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Log Entries</span>
          <p className="text-2xl font-bold font-mono text-blue-600">{logs.length} Entries</p>
          <p className="text-[10px] text-slate-400">Daily machine sheets</p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
            Daily Equipment Deployment Sheets ({filteredLogs.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Equipment</th>
                <th>Operator</th>
                <th className="text-right">Worked (Hrs)</th>
                <th className="text-right">Idle (Hrs)</th>
                <th className="text-right">Breakdown (Hrs)</th>
                <th className="text-right">Fuel (Ltrs)</th>
                <th className="text-right">Rate (GHS/hr)</th>
                <th className="text-right">Calculated Cost (GHS)</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                    {logs.length === 0
                      ? 'No machine logs recorded for this project yet. Click "Log Operating Hours" to record daily runtime.'
                      : 'No equipment logs match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map(l => (
                  <tr key={l.id}>
                    <td className="font-mono">{l.log_date ? l.log_date.split("T")[0] : "-"}</td>
                    <td className="font-bold text-slate-900 dark:text-white">{l.equipment_name || "Heavy Plant"}</td>
                    <td>{l.operator_name || "-"}</td>
                    <td className="text-right font-mono font-bold text-brand-600 dark:text-brand-400">{l.hours_worked}</td>
                    <td className="text-right font-mono text-slate-400">{l.hours_idle}</td>
                    <td className="text-right font-mono text-rose-500">{l.hours_breakdown}</td>
                    <td className="text-right font-mono text-amber-600">{l.fuel_consumed_litres}</td>
                    <td className="text-right font-mono">{Number(l.hourly_rate || 0).toFixed(2)}</td>
                    <td className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      GHS {Number(l.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Equipment Log */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Truck size={18} className="text-brand-600" /> Log Machine Operating Hours
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateLog} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Equipment / Machine</label>
                  <select
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={form.equipment_id}
                    onChange={e => setForm({ ...form, equipment_id: e.target.value })}
                  >
                    <option value="">Select Equipment...</option>
                    {equipments.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name}</option>
                    ))}
                    {equipments.length === 0 && (
                      <>
                        <option value="1">CAT 320D Excavator</option>
                        <option value="2">JCB 3DX Backhoe Loader</option>
                        <option value="3">Bomag Single Drum Roller</option>
                        <option value="4">Iveco Trakker 20m3 Tipper</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Log Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={form.log_date}
                    onChange={e => setForm({ ...form, log_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Worked (Hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono font-bold"
                    value={form.hours_worked}
                    onChange={e => setForm({ ...form, hours_worked: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Idle (Hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={form.hours_idle}
                    onChange={e => setForm({ ...form, hours_idle: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Breakdown (Hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={form.hours_breakdown}
                    onChange={e => setForm({ ...form, hours_breakdown: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Fuel Used (Ltrs)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={form.fuel_consumed_litres}
                    onChange={e => setForm({ ...form, fuel_consumed_litres: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Rate (GHS/hr)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={form.hourly_rate}
                    onChange={e => setForm({ ...form, hourly_rate: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Operator Name</label>
                  <input
                    type="text"
                    placeholder="Operator"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={form.operator_name}
                    onChange={e => setForm({ ...form, operator_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Notes / Maintenance Remarks</label>
                <textarea
                  placeholder="Service interval, tire pressure, grease..."
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 min-h-[60px]"
                  value={form.remarks}
                  onChange={e => setForm({ ...form, remarks: e.target.value })}
                />
              </div>

              <div className="p-3 bg-brand-50 dark:bg-brand-900/30 rounded-xl flex justify-between items-center text-xs">
                <span className="font-bold text-brand-800 dark:text-brand-300">Total Calculated Cost:</span>
                <span className="font-mono font-bold text-base text-emerald-600">
                  GHS {(form.hours_worked * form.hourly_rate).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Save Machine Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
