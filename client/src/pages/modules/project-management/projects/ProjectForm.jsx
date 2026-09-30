/**
 * @fileoverview ProjectForm component.
 * Provides functionality for ProjectForm.
 */

import React, { useEffect, useState } from "react";
import { 
  Link, 
  useNavigate, 
  useParams 
} from "react-router-dom";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Calendar, 
  Briefcase, 
  User, 
  Activity, 
  DollarSign,
  AlertCircle,
  Clock,
  Flag,
  FileText,
  Tag,
  ChevronDown
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProjectForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [managers, setManagers] = useState([]);
  
  const [form, setForm] = useState({
    project_code: "",
    project_name: "",
    client_name: "",
    manager_id: "",
    manager_name: "",
    budget: 0,
    project_priority: "MEDIUM",
    project_status: "PLANNING",
    start_date: "",
    end_date: "",
    remarks: "",
    is_active: true,
  });

  useEffect(() => {
    fetchAuxiliaryData();
    if (isEdit) fetchProject();
  }, [id]);

  const [clients, setClients] = useState([]);

  const fetchAuxiliaryData = async () => {
    try {
      const res = await api.get("/projects/project-managers");
      setManagers(res.data?.items || []);
    } catch (e) {}
    try {
      const res = await api.get("/sales/customers?service_customer=Y");
      setClients(res.data?.items || res.data?.data?.items || []);
    } catch (e) {}
  };

  const fetchProject = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/projects/${id}`);
      if (res.data?.item) {
        const item = res.data.item;
        setForm({
          ...item,
          start_date: item.start_date ? item.start_date.split('T')[0] : "",
          end_date: item.end_date ? item.end_date.split('T')[0] : "",
          is_active: item.is_active !== 'N',
        });
      }
    } catch (e) {
      toast.error("Failed to load project details");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/projects/projects/${id}`, form);
        toast.success("Project updated successfully");
      } else {
        await api.post("/projects/projects", form);
        toast.success("New project initialized");
      }
      navigate("/project-management/projects");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-300 text-2xl uppercase tracking-widest italic">Loading Project Data...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management/projects" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">
              {isEdit ? "Edit Project" : "New Project"}
            </h1>
            <p className="text-slate-500 text-sm">Portfolio Management Entry</p>
          </div>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={saving}
          className="btn-success flex items-center gap-2"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {isEdit ? "Save Changes" : "Create Project"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-8 space-y-6">
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-brand-600 border-b border-slate-50 dark:border-slate-700 pb-3">
                <Briefcase size={18} />
                <h2 className="font-bold uppercase text-xs tracking-wider">Primary Information</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Project Code</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm"
                    placeholder="PRJ-001"
                    value={form.project_code}
                    onChange={e => setForm({...form, project_code: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Project Title</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm"
                    placeholder="Project Name"
                    value={form.project_name}
                    onChange={e => setForm({...form, project_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Client / Organization</label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm"
                  value={form.client_name}
                  onChange={e => setForm({...form, client_name: e.target.value})}
                >
                  <option value="">-- Select Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.customer_name}>{c.customer_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 text-brand-600 border-b border-slate-50 dark:border-slate-700 pb-3">
                <Clock size={18} />
                <h2 className="font-bold uppercase text-xs tracking-wider">Timeline & Assignment</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Start Date</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                    value={form.start_date}
                    onChange={e => setForm({...form, start_date: e.target.value})}
                  
                    disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Target End Date</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                    value={form.end_date}
                    onChange={e => setForm({...form, end_date: e.target.value})}
                  
                    disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Project Manager</label>
                <div className="relative">
                  <select 
                    className="w-full pl-4 pr-10 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm appearance-none"
                    value={form.manager_id}
                    onChange={e => {
                      const m = managers.find(x => String(x.user_id) === String(e.target.value));
                      setForm({...form, manager_id: e.target.value, manager_name: m?.username || ""});
                    }}
                  >
                    <option value="">Select Manager...</option>
                    {managers.map(m => <option key={m.user_id} value={m.user_id}>{m.username}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Project Scope & Remarks</label>
              <textarea 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm min-h-[120px]"
                placeholder="Objectives and constraints..."
                value={form.remarks}
                onChange={e => setForm({...form, remarks: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3 text-brand-600">
              <Flag size={18} />
              <h2 className="font-bold uppercase text-xs tracking-wider">Status</h2>
            </div>
            
            <div className="space-y-1">
               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Workflow Stage</label>
               <select 
                 className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-bold text-xs"
                 value={form.project_status}
                 onChange={e => setForm({...form, project_status: e.target.value})}
               >
                  {['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
               </select>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Priority</label>
               <select 
                 className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-bold text-xs"
                 value={form.project_priority}
                 onChange={e => setForm({...form, project_priority: e.target.value})}
               >
                  {['LOW', 'MEDIUM', 'HIGH'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
               </select>
             </div>

             <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-bold text-xs"
                  value={form.is_active ? 'Y' : 'N'}
                  onChange={e => setForm({...form, is_active: e.target.value === 'Y'})}
                >
                   <option value="Y">Active</option>
                   <option value="N">Inactive</option>
                </select>
            </div>
          </div>

          <div className="bg-brand-600 p-6 rounded-2xl text-white shadow-sm space-y-4">
            <div className="flex items-center gap-3">
               <DollarSign size={18} className="text-brand-200" />
               <h2 className="font-bold uppercase text-xs tracking-wider">Budget</h2>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Estimated (GHS)</label>
               <input 
                 type="number" 
                 className="w-full bg-white/10 border-none rounded-xl px-4 py-2 text-xl font-bold text-white placeholder-white/30 focus:ring-2 focus:ring-white outline-none"
                 placeholder="0.00"
                 value={form.budget}
                 onChange={e => setForm({...form, budget: e.target.value})}
               />
            </div>
          </div>

          {isEdit && (
            <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 flex items-start gap-3">
              <div className="p-1.5 bg-rose-100 dark:bg-rose-900/50 rounded-lg text-rose-600">
                <AlertCircle size={16} />
              </div>
              <p className="text-[10px] text-rose-700 dark:text-rose-400/80 font-medium">Updating project parameters will reflect across all linked tasks and financial reports.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
