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
import ProjectModal from "../components/ProjectModal.jsx";

export default function EquipmentLogsPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [equipments, setEquipments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    project_id: "",
    equipment_id: "",
    log_date: new Date().toISOString().split("T")[0],
    hours_worked: "",
    hours_idle: "",
    hours_breakdown: "",
    fuel_consumed_litres: "",
    operator_name: "",
    hourly_rate: "",
    remarks: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const [pRes, eqRes] = await Promise.all([
          api.get("/projects/projects", { params: { active: "all" } }),
          api.get("/projects/equipments").catch(() => ({ data: [] })),
        ]);
        const prjs = pRes.data?.items || [];
        setProjects(prjs);
        // Do not default select any project
        setSelectedProjectId("");

        const eqs = Array.isArray(eqRes.data)
          ? eqRes.data
          : (eqRes.data?.items || eqRes.data?.data?.items || eqRes.data?.data || []);
        setEquipments(eqs);
        // Do not auto-select equipment
      } catch (e) {
        toast.error("Failed to load initial data");
      }
    })();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [selectedProjectId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedProjectId) params.project_id = selectedProjectId;
      const res = await api.get("/construction/equipment-logs", { params });
      setLogs(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load equipment logs");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLog = async (e) => {
    e.preventDefault();
    const pId = form.project_id || selectedProjectId;
    if (!pId) return toast.error("Please select a project");
    if (!form.equipment_id) return toast.error("Please select equipment");
    try {
      await api.post("/construction/equipment-logs", {
        ...form,
        project_id: pId,
      });
      toast.success("Equipment operating log recorded");
      setShowModal(false);
      setForm({
        project_id: "",
        equipment_id: "",
        equipment_name: "",
        log_date: new Date().toISOString().split("T")[0],
        hours_worked: "",
        hours_idle: "",
        hours_breakdown: "",
        fuel_consumed_litres: "",
        operator_name: "",
        hourly_rate: "",
        remarks: "",
      });
      fetchLogs();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to record equipment log");
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
            className="input text-sm py-1.5 h-auto min-w-[200px]"
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_code ? `${p.project_code} - ` : ""}{p.project_name || p.name}
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
            onClick={() => {
              setForm(prev => ({
                ...prev,
                project_id: selectedProjectId || "",
                equipment_id: "",
                equipment_name: "",
                hours_worked: "",
                hours_idle: "",
                hours_breakdown: "",
                fuel_consumed_litres: "",
                operator_name: "",
                hourly_rate: "",
                remarks: "",
              }));
              setShowModal(true);
            }}
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
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
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
      <ProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Log Machine Operating Hours"
        subtitle="Record heavy machinery run hours, fuel usage, and plant costing"
        icon={Truck}
        onSubmit={handleCreateLog}
        submitLabel="Save Machine Log"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              required
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={form.project_id || selectedProjectId || ""}
              onChange={e => setForm({ ...form, project_id: e.target.value })}
            >
              <option value="">-- Select Project --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.project_code ? `${p.project_code} - ` : ""}{p.project_name || p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Equipment / Machine <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.equipment_id}
                onChange={e => {
                  const sId = e.target.value;
                  const item = equipments.find(x => String(x.id) === String(sId));
                  setForm({
                    ...form,
                    equipment_id: sId,
                    equipment_name: item ? (item.name || item.equipment_name) : "",
                  });
                }}
              >
                <option value="">Select Equipment...</option>
                {equipments.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name || eq.equipment_name}{eq.maint_equipment_name ? ` (${eq.maint_equipment_name})` : ""}
                  </option>
                ))}
                {equipments.length === 0 && <option value="" disabled>No equipment registered yet (Add in Operational Setup)</option>}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Log Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={form.log_date}
                onChange={e => setForm({ ...form, log_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Worked (Hrs) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                placeholder="0" value={form.hours_worked ?? ""}
                onChange={e => setForm({ ...form, hours_worked: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Idle (Hrs)
              </label>
              <input
                type="number"
                step="0.5"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                placeholder="0" value={form.hours_idle ?? ""}
                onChange={e => setForm({ ...form, hours_idle: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Breakdown (Hrs)
              </label>
              <input
                type="number"
                step="0.5"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                placeholder="0" value={form.hours_breakdown ?? ""}
                onChange={e => setForm({ ...form, hours_breakdown: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Fuel Used (Ltrs)
              </label>
              <input
                type="number"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                placeholder="0.00" value={form.fuel_consumed_litres ?? ""}
                onChange={e => setForm({ ...form, fuel_consumed_litres: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Rate (GHS/hr)
              </label>
              <input
                type="number"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                placeholder="0.00" value={form.hourly_rate ?? ""}
                onChange={e => setForm({ ...form, hourly_rate: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Operator Name
              </label>
              <input
                type="text"
                placeholder="e.g. Operator Name"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.operator_name}
                onChange={e => setForm({ ...form, operator_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Notes / Maintenance Remarks
            </label>
            <textarea
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[70px]"
              placeholder="Enter remarks or service notes..." value={form.remarks || ""}
              onChange={e => setForm({ ...form, remarks: e.target.value })}
            />
          </div>

          <div className="p-3.5 bg-brand-50 dark:bg-brand-900/30 rounded-xl flex justify-between items-center text-xs border border-brand-100 dark:border-brand-800/40">
            <span className="font-bold text-brand-900 dark:text-brand-300">Total Calculated Cost:</span>
            <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
              GHS {(form.hours_worked * form.hourly_rate).toFixed(2)}
            </span>
          </div>
        </div>
      </ProjectModal>
    </div>
  );
}
