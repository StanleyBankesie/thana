/**
 * @fileoverview MaintenanceJobOrderForm component.
 * Provides functionality for MaintenanceJobOrderForm.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { FileText, MapPin, Calendar, Users, ClipboardList, Save, X } from "lucide-react";
import { usePermission } from "@/auth/PermissionContext.jsx";

const ORDER_TYPES = [
  "Corrective",
  "Preventive",
  "Predictive",
  "Emergency",
  "Routine",
];
const STATUSES = [
  "DRAFT",
  "OPEN",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceJobOrderForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isEdit = !!id;

  const [form, setForm] = useState({
    order_no: "",
    order_date: new Date().toISOString().slice(0, 10),
    request_id: params.get("request_id") || "",
    asset_name: decodeURIComponent(params.get("asset_name") || ""),
    order_type: "",
    job_order_type: "Planned",
    assigned_team: "",
    assigned_technician: "",
    location: "",
    supervisor: "",
    service_provider: "",
    scheduled_date: "",
    instructions: "",
    status: "DRAFT",
    notes: "",
  });
  const [requests, setRequests] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [orderCategory, setOrderCategory] = useState("INTERNAL");
  const [setupCatalogs, setSetupCatalogs] = useState({ supervisors: [], technicians: [], teams: [], serviceProviders: [], maintenanceTypes: [] });
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let mounted = true;
      api
        .get("/maintenance/maintenance-requests")
        .then((r) => {
          if (mounted)
            setRequests((Array.isArray(r.data?.items) ? r.data.items : []).filter(req => String(req.status).toUpperCase() === "APPROVED"));
        })
        .catch(() => {});
    api
      .get("/maintenance/equipment")
      .then((r) => {
        if (mounted)
          setEquipment(Array.isArray(r.data?.items) ? r.data.items : []);
      })
      .catch(() => {});
    api
      .get("/maintenance/setup/catalog")
      .then((r) => {
        if (mounted) {
          const c = r.data?.catalogs || {};
          setSetupCatalogs({
            supervisors: Array.isArray(c.supervisors) ? c.supervisors : [],
            technicians: Array.isArray(c.technicians) ? c.technicians : [],
            teams: Array.isArray(c.teams) ? c.teams : [],
            serviceProviders: Array.isArray(c.serviceProviders) ? c.serviceProviders : [],
            maintenanceTypes: Array.isArray(c.maintenanceTypes) ? c.maintenanceTypes : [],
          });
        }
      })
      .catch(() => {});
    if (isEdit) {
      api
        .get(`/maintenance/job-orders/${id}`)
        .then((r) => {
          const item = r.data?.item || {};
          if (mounted)
            setForm((p) => ({
              ...p,
              ...item,
              order_date: (item.order_date || "").slice(0, 10),
              scheduled_date: (item.scheduled_date || "").slice(0, 10),
            }));
        })
        .catch(() => toast.error("Failed to load job order"));
    }
    return () => {
      mounted = false;
    };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.order_date || !form.order_type) {
      toast.error("Fill required fields");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/maintenance/job-orders/${id}`, form);
        toast.success("Job order updated");
      } else {
        const r = await api.post("/maintenance/job-orders", form);
        toast.success(`Job order ${r.data?.order_no} created`);
      }
      navigate("/maintenance/job-orders", { state: { refresh: true } });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 -mx-6 -mt-6 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/maintenance/job-orders" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isEdit ? "Edit Job Order" : "New Job Order"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Create and assign a maintenance job order
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="btn-secondary">
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleSubmit} 
            className="btn-primary flex items-center gap-2" 
            disabled={saving}
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Job Order"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
        {/* Segmented Control */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full max-w-md mx-auto">
          <button 
            type="button"
            className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all shadow-sm ${orderCategory === 'INTERNAL' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            onClick={() => setOrderCategory('INTERNAL')}
          >
            Internal
          </button>
          <button 
            type="button"
            className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all shadow-sm ${orderCategory === 'EXTERNAL' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            onClick={() => setOrderCategory('EXTERNAL')}
          >
            External
          </button>
        </div>

        {/* Card 1: General Details */}
        <div className="card overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <FileText size={18} className="text-brand-500" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">General Details</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Order Date <span className="text-red-500">*</span></label>
              <input
                className="input w-full"
                type="date"
                value={form.order_date}
                onChange={(e) => update("order_date", e.target.value)}
                required
              
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="label">Maintenance Type <span className="text-red-500">*</span></label>
              <select
                className="input w-full"
                value={form.job_order_type}
                onChange={(e) => update("job_order_type", e.target.value)}
              >
                <option value="">-- Select Type --</option>
                {(setupCatalogs.maintenanceTypes || []).filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.item_name}>{t.item_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Equipment / Asset</label>
              <select
                className="input w-full"
                value={form.asset_name}
                onChange={(e) => update("asset_name", e.target.value)}
              >
                <option value="">-- Select Asset --</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.equipment_name}>
                    {eq.equipment_code} – {eq.equipment_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Linked Request</label>
              <select
                className="input w-full"
                value={form.request_id}
                onChange={(e) => update("request_id", e.target.value)}
              >
                <option value="">-- None --</option>
                {requests.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.request_no}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Card 2: Scheduling & Location */}
        <div className="card overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <Calendar size={18} className="text-brand-500" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">Scheduling & Location</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Scheduled Date</label>
              <input
                className="input w-full"
                type="date"
                value={form.scheduled_date}
                onChange={(e) => update("scheduled_date", e.target.value)}
              
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="label">Location</label>
              <div className="relative">
                <input
                  className="input w-full pl-9"
                  value={form.location || ""}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder="E.g. Building A, Floor 2"
                />
                <MapPin size={16} className="absolute left-3 top-2.5 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Assignment */}
        <div className="card overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <Users size={18} className="text-brand-500" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">Assignment & Resource</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {orderCategory === 'EXTERNAL' ? (
              <>
                <div>
                  <label className="label">Service Provider</label>
                  <select
                    className="input w-full"
                    value={form.service_provider || ""}
                    onChange={(e) => update("service_provider", e.target.value)}
                  >
                    <option value="">-- Select Provider --</option>
                    {setupCatalogs.serviceProviders.filter(s => s.is_active).map(s => (
                      <option key={s.id} value={s.item_name}>{s.item_name}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Assigned Team</label>
                  <select
                    className="input w-full"
                    value={form.assigned_team}
                    onChange={(e) => update("assigned_team", e.target.value)}
                  >
                    <option value="">-- Select Team --</option>
                    {setupCatalogs.teams.filter(t => t.is_active).map(t => (
                      <option key={t.id} value={t.item_name}>{t.item_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Assigned Technician</label>
                  <select
                    className="input w-full"
                    value={form.assigned_technician}
                    onChange={(e) => update("assigned_technician", e.target.value)}
                  >
                    <option value="">-- Select Technician --</option>
                    {setupCatalogs.technicians.filter(t => t.is_active).map(t => (
                      <option key={t.id} value={t.item_name}>{t.item_name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card 4: Scope & Notes */}
        <div className="card overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <ClipboardList size={18} className="text-brand-500" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">Scope & Notes</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex-1">
              <label className="label">Work Instructions</label>
              <textarea
                className="input w-full"
                rows={5}
                value={form.instructions}
                onChange={(e) => update("instructions", e.target.value)}
                placeholder="Describe the work to be done..."
              />
            </div>
            <div className="flex-1">
              <label className="label">Additional Notes</label>
              <textarea
                className="input w-full"
                rows={5}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Internal notes or special precautions..."
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
