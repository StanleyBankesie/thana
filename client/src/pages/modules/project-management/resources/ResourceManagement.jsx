import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../api/client.js';
import { toast } from 'react-toastify';
import { Loader2, Plus, X, Pencil, Trash2, Box, Wrench, Users, Filter, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';

function ModalForm({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export default function ResourceManagement() {
  const [resources, setResources] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    project_id: '',
    task_id: '',
    resource_type: 'EQUIPMENT',
    pm_equipment_id: '',
    hr_employee_id: '',
    resource_name: '',
    allocated_qty: 1,
    status: 'ALLOCATED',
    accountable_user_id: '',
    start_date: '',
    end_date: '',
    remarks: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [resRes, projRes, taskRes, eqRes, empRes] = await Promise.all([
        api.get('/projects/resources'),
        api.get('/projects/projects'),
        api.get('/projects/tasks'),
        api.get('/projects/equipments'),
        api.get('/hr/employees').catch(() => ({ data: { items: [] } }))
      ]);
      setResources(resRes.data?.items || resRes.data || []);
      setProjects(projRes.data?.items || projRes.data?.projects || []);
      setTasks(taskRes.data?.items || []);
      setEquipments(eqRes.data || []);
      setEmployees(empRes.data?.items || empRes.data || []);
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    setEditingResource(null);
    setForm({
      project_id: '', task_id: '', resource_type: 'EQUIPMENT', pm_equipment_id: '', hr_employee_id: '',
      resource_name: '', allocated_qty: 1, status: 'ALLOCATED', accountable_user_id: '',
      start_date: '', end_date: '', remarks: ''
    });
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditingResource(r);
    setForm({
      project_id: r.project_id || '',
      task_id: r.task_id || '',
      resource_type: r.resource_type || 'EQUIPMENT',
      pm_equipment_id: r.pm_equipment_id || '',
      hr_employee_id: r.hr_employee_id || '',
      resource_name: r.resource_name || '',
      allocated_qty: r.allocated_qty || 1,
      status: r.status || 'ALLOCATED',
      accountable_user_id: r.accountable_user_id || '',
      start_date: r.start_date ? r.start_date.split('T')[0] : '',
      end_date: r.end_date ? r.end_date.split('T')[0] : '',
      remarks: r.remarks || ''
    });
    setModalOpen(true);
  };

  const saveResource = async () => {
    if (!form.project_id) { toast.error('Project is required'); return; }
    if (!form.resource_name) { toast.error('Resource name is required'); return; }
    
    setSaving(true);
    try {
      if (editingResource) {
        await api.put(`/projects/resources/${editingResource.id}`, form);
        toast.success('Resource updated');
      } else {
        await api.post('/projects/resources', form);
        toast.success('Resource allocated');
      }
      setModalOpen(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save resource');
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async (id) => {
    if (!confirm('Delete this resource allocation?')) return;
    try {
      await api.delete(`/projects/resources/${id}`);
      toast.success('Resource removed');
      loadData();
    } catch {
      toast.error('Failed to delete resource');
    }
  };

  // Sync Resource Name when selecting Equipment or Employee
  useEffect(() => {
    if (form.resource_type === 'EQUIPMENT' && form.pm_equipment_id) {
      const eq = equipments.find(e => String(e.id) === String(form.pm_equipment_id));
      if (eq && !editingResource) setForm(p => ({ ...p, resource_name: eq.name }));
    } else if (form.resource_type === 'EMPLOYEE' && form.hr_employee_id) {
      const emp = employees.find(e => String(e.id) === String(form.hr_employee_id));
      if (emp && !editingResource) setForm(p => ({ ...p, resource_name: emp.employee_name }));
    }
  }, [form.pm_equipment_id, form.hr_employee_id, form.resource_type, equipments, employees, editingResource]);

  const filteredTasks = useMemo(() => tasks.filter(t => String(t.project_id) === String(form.project_id)), [tasks, form.project_id]);

  const stats = useMemo(() => {
    const total = resources.length;
    const inUse = resources.filter(r => r.status === 'IN_USE').length;
    const allocated = resources.filter(r => r.status === 'ALLOCATED').length;
    const released = resources.filter(r => r.status === 'RELEASED').length;
    return { total, inUse, allocated, released };
  }, [resources]);

  return (
    <div className="p-4 space-y-6">
      <div className="mb-2">
        <Link to="/project-management?section=Reports%20%26%20Analytics" className="text-brand-600 hover:text-brand-700 flex items-center gap-2 font-medium w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Module Home
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Box className="text-brand-600" /> Resource Management
          </h2>
          <p className="text-sm text-slate-500">Allocate and track equipment, employees, and materials across projects</p>
        </div>
        <div className="flex gap-2">
          <Link to="/project-management/reports/project-status" className="btn-secondary flex items-center gap-2">
            <BarChart2 size={16} /> Status Report
          </Link>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Allocate Resource
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
            <Box size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Total Allocated</p>
            <p className="text-xl font-extrabold">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Wrench size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">In Use</p>
            <p className="text-xl font-extrabold">{stats.inUse}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Allocated / Ready</p>
            <p className="text-xl font-extrabold">{stats.allocated}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600">
            <Trash2 size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Released</p>
            <p className="text-xl font-extrabold">{stats.released}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Resource Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Project / Task</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : resources.length > 0 ? resources.map(r => (
                <tr key={r.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-sm">{r.resource_name}</p>
                    <p className="text-xs text-slate-500">Qty: {r.allocated_qty}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-semibold">{r.resource_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-sm">{r.project_code || ''} - {r.project_name}</p>
                    <p className="text-xs text-slate-500">{r.task_title || 'No Task Linked'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <p>Start: {r.start_date ? new Date(r.start_date).toLocaleDateString() : 'N/A'}</p>
                    <p>End: {r.end_date ? new Date(r.end_date).toLocaleDateString() : 'N/A'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${r.status === 'IN_USE' ? 'bg-emerald-100 text-emerald-700' : r.status === 'ALLOCATED' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(r)} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded mx-1"><Pencil size={14} /></button>
                    <button onClick={() => deleteResource(r.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded mx-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No resources allocated yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalForm open={modalOpen} onClose={() => setModalOpen(false)} title={editingResource ? "Edit Resource Allocation" : "Allocate Resource"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Project *</label>
            <select className="select w-full" value={form.project_id} onChange={e => setForm(p => ({ ...p, project_id: e.target.value, task_id: '' }))}>
              <option value="">-- Select Project --</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Task (Optional)</label>
            <select className="select w-full" value={form.task_id} onChange={e => setForm(p => ({ ...p, task_id: e.target.value }))} disabled={!form.project_id}>
              <option value="">-- Select Task --</option>
              {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.task_title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Resource Type</label>
            <select className="select w-full" value={form.resource_type} onChange={e => setForm(p => ({ ...p, resource_type: e.target.value, pm_equipment_id: '', hr_employee_id: '' }))}>
              <option value="EQUIPMENT">Equipment</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="MATERIAL">Material</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {form.resource_type === 'EQUIPMENT' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Select Equipment</label>
              <select className="select w-full" value={form.pm_equipment_id} onChange={e => setForm(p => ({ ...p, pm_equipment_id: e.target.value }))}>
                <option value="">-- Select Equipment --</option>
                {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
              </select>
            </div>
          )}
          {form.resource_type === 'EMPLOYEE' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Select Employee</label>
              <select className="select w-full" value={form.hr_employee_id} onChange={e => setForm(p => ({ ...p, hr_employee_id: e.target.value }))}>
                <option value="">-- Select Employee --</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.employee_name}</option>)}
              </select>
            </div>
          )}
          {(form.resource_type === 'MATERIAL' || form.resource_type === 'OTHER') && (
            <div />
          )}

          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Resource Name / Reference *</label>
            <input type="text" className="input w-full" placeholder="Resource Name" value={form.resource_name} onChange={e => setForm(p => ({ ...p, resource_name: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Quantity</label>
            <input type="number" min="1" step="0.01" className="input w-full" value={form.allocated_qty} onChange={e => setForm(p => ({ ...p, allocated_qty: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status</label>
            <select className="select w-full" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              <option value="ALLOCATED">ALLOCATED (Ready)</option>
              <option value="IN_USE">IN USE</option>
              <option value="RELEASED">RELEASED (Done)</option>
              <option value="DAMAGED">DAMAGED</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Start Date</label>
            <input type="date" className="input w-full" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">End Date</label>
            <input type="date" className="input w-full" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Remarks</label>
            <textarea className="input w-full" rows={2} value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="btn-primary flex items-center gap-2" disabled={saving} onClick={saveResource}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Resource
          </button>
        </div>
      </ModalForm>
    </div>
  );
}
