import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../api/client.js';
import { toast } from 'react-toastify';
import {
  Loader2,
  Plus,
  X,
  Pencil,
  Trash2,
  Box,
  Wrench,
  Users,
  BarChart2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function ResourceManagement() {
  const location = useLocation();
  const [resources, setResources] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [equipments, setEquipments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
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

  const getEmployeeFullName = (emp) => {
    if (!emp) return '';
    if (emp.full_name && typeof emp.full_name === 'string' && emp.full_name.trim()) {
      return emp.full_name.replace(/\s+/g, ' ').trim();
    }
    const parts = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return emp.employee_name || emp.name || `Employee #${emp.id}`;
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [resRes, projRes, eqRes, empRes, itemsRes] = await Promise.all([
        api.get('/projects/resources').catch((err) => {
          console.error('Failed to load resources:', err);
          return { data: [] };
        }),
        api.get('/projects/projects').catch((err) => {
          console.error('Failed to load projects:', err);
          return { data: { items: [] } };
        }),
        api.get('/projects/equipments').catch((err) => {
          console.error('Failed to load equipments:', err);
          return { data: [] };
        }),
        api.get('/hr/employees').catch(() => ({ data: { items: [] } })),
        api.get('/inventory/items').catch(() => ({ data: { items: [] } }))
      ]);

      const loadedResources = Array.isArray(resRes.data)
        ? resRes.data
        : resRes.data?.items || [];
      const loadedProjects = Array.isArray(projRes.data)
        ? projRes.data
        : projRes.data?.items || projRes.data?.projects || [];
      const loadedEquipments = Array.isArray(eqRes.data)
        ? eqRes.data
        : eqRes.data?.items || [];
      const loadedEmployees = Array.isArray(empRes.data)
        ? empRes.data
        : empRes.data?.items || empRes.data?.data || [];
      const loadedItems = Array.isArray(itemsRes.data)
        ? itemsRes.data
        : itemsRes.data?.items || itemsRes.data?.data?.items || [];

      setResources(loadedResources);
      setProjects(loadedProjects);
      setEquipments(loadedEquipments);
      setEmployees(loadedEmployees);
      setInventoryItems(loadedItems);
    } catch (e) {
      console.error('Failed to load resource data', e);
      toast.error('Failed to load resource data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    if (location.pathname.endsWith('/new')) {
      openAdd();
    }
  }, [loadData, location.pathname]);

  // Fetch associated tasks whenever selected project changes
  useEffect(() => {
    if (!form.project_id) {
      setProjectTasks([]);
      return;
    }
    let isMounted = true;
    setLoadingTasks(true);
    api.get(`/projects/tasks?projectId=${form.project_id}`)
      .then((res) => {
        if (!isMounted) return;
        const taskItems = res.data?.items || (Array.isArray(res.data) ? res.data : []);
        setProjectTasks(taskItems);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to fetch tasks for project', err);
        setProjectTasks([]);
      })
      .finally(() => {
        if (isMounted) setLoadingTasks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [form.project_id]);

  // Filter projects to only active ones from pm_projects table
  const activeProjects = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    return list.filter((p) => {
      if (editingResource && String(editingResource.project_id) === String(p.id)) return true;
      const st = String(p.project_status || p.status || '').toUpperCase();
      if (st === 'COMPLETED' || st === 'CANCELLED' || st === 'ARCHIVED' || st === 'INACTIVE') return false;
      const isActive =
        p.is_active === 'Y' ||
        p.is_active === 1 ||
        p.is_active === '1' ||
        p.is_active === true ||
        p.is_active === null ||
        p.is_active === undefined ||
        st === 'ACTIVE' ||
        st === 'IN_PROGRESS' ||
        st === 'PLANNING';
      return isActive;
    });
  }, [projects, editingResource]);

  // Filter equipments: active equipments from pm_equipments which have not been linked
  const availableEquipments = useMemo(() => {
    const list = Array.isArray(equipments) ? equipments : [];
    return list.filter((eq) => {
      if (editingResource && String(editingResource.pm_equipment_id) === String(eq.id)) {
        return true;
      }

      const eqStatus = String(eq.status || '').toUpperCase();
      if (eqStatus && eqStatus !== 'ACTIVE') {
        return false;
      }

      const eqAllocations = (resources || []).filter(
        (r) => String(r.pm_equipment_id) === String(eq.id)
      );

      // Not linked/allocated yet -> available
      if (eqAllocations.length === 0) {
        return true;
      }

      // If linked/allocated, it is unavailable if currently allocated or in use (not released)
      const isCurrentlyLinked = eqAllocations.some((r) => {
        const st = String(r.status || '').toUpperCase();
        return st !== 'RELEASED';
      });

      return !isCurrentlyLinked;
    });
  }, [equipments, resources, editingResource]);

  const openAdd = () => {
    setEditingResource(null);
    setProjectTasks([]);
    setForm({
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
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditingResource(r);
    if (r.task_id && r.task_title) {
      setProjectTasks([{ id: r.task_id, task_title: r.task_title }]);
    } else {
      setProjectTasks([]);
    }
    if (r.project_id) {
      api.get(`/projects/tasks?projectId=${r.project_id}`)
        .then((res) => {
          const taskItems = res.data?.items || (Array.isArray(res.data) ? res.data : []);
          setProjectTasks(taskItems);
        })
        .catch(() => {});
    }
    setForm({
      project_id: r.project_id ? String(r.project_id) : '',
      task_id: r.task_id ? String(r.task_id) : '',
      resource_type: r.resource_type || 'EQUIPMENT',
      pm_equipment_id: r.pm_equipment_id ? String(r.pm_equipment_id) : '',
      hr_employee_id: r.hr_employee_id ? String(r.hr_employee_id) : '',
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

  const saveResource = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!form.project_id) {
      toast.error('Project is required');
      return;
    }
    if (!form.resource_name || !form.resource_name.trim()) {
      toast.error('Resource name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        project_id: Number(form.project_id),
        task_id: form.task_id ? Number(form.task_id) : null,
        pm_equipment_id: form.resource_type === 'EQUIPMENT' && form.pm_equipment_id ? Number(form.pm_equipment_id) : null,
        hr_employee_id: form.resource_type === 'EMPLOYEE' && form.hr_employee_id ? Number(form.hr_employee_id) : null,
        allocated_qty: Number(form.allocated_qty) || 1,
        // In create mode, status is always ALLOCATED
        status: editingResource ? form.status : 'ALLOCATED'
      };

      if (editingResource) {
        await api.put(`/projects/resources/${editingResource.id}`, payload);
        toast.success('Resource allocation updated successfully');
      } else {
        await api.post('/projects/resources', payload);
        toast.success('Resource allocated successfully');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save resource');
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async (id) => {
    if (!confirm('Are you sure you want to delete this resource allocation?')) return;
    try {
      await api.delete(`/projects/resources/${id}`);
      toast.success('Resource allocation removed');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete resource');
    }
  };

  // Sync Resource Name when selecting Equipment or Employee
  useEffect(() => {
    if (form.resource_type === 'EQUIPMENT' && form.pm_equipment_id) {
      const eq = equipments.find((e) => String(e.id) === String(form.pm_equipment_id));
      if (eq && !editingResource) setForm((p) => ({ ...p, resource_name: eq.name }));
    } else if (form.resource_type === 'EMPLOYEE' && form.hr_employee_id) {
      const emp = employees.find((e) => String(e.id) === String(form.hr_employee_id));
      if (emp && !editingResource) {
        const empName = getEmployeeFullName(emp);
        if (empName) setForm((p) => ({ ...p, resource_name: empName }));
      }
    }
  }, [form.pm_equipment_id, form.hr_employee_id, form.resource_type, equipments, employees, editingResource]);

  const stats = useMemo(() => {
    const total = resources.length;
    const inUse = resources.filter((r) => r.status === 'IN_USE').length;
    const allocated = resources.filter((r) => r.status === 'ALLOCATED').length;
    const released = resources.filter((r) => r.status === 'RELEASED').length;
    return { total, inUse, allocated, released };
  }, [resources]);

  return (
    <div className="p-4 space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="mb-2">
        <Link
          to="/project-management"
          className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Box size={26} className="text-brand-900 dark:text-brand-400" /> Resource Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Allocate and track equipment, employees, and materials across active projects and tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/project-management/reports/project-status"
            className="btn btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            <BarChart2 size={16} /> Status Report
          </Link>
          <button
            onClick={openAdd}
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> Allocate Resource
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400">
            <Box size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Allocated</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Wrench size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">In Use</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{stats.inUse}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Allocated / Ready</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{stats.allocated}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Released</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{stats.released}</p>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr className="text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3">Resource Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Project / Task</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin inline-block mr-2" />
                    Loading resources...
                  </td>
                </tr>
              ) : resources.length > 0 ? (
                resources.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{r.resource_name}</p>
                      <p className="text-xs text-slate-500">Qty: {r.allocated_qty}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold uppercase text-[11px]">
                        {r.resource_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                        {r.project_code ? `${r.project_code} - ` : ''}
                        {r.project_name || 'Unassigned Project'}
                      </p>
                      <p className="text-xs text-slate-500">{r.task_title || 'No Task Linked'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <p>Start: {r.start_date ? new Date(r.start_date).toLocaleDateString() : 'N/A'}</p>
                      <p>End: {r.end_date ? new Date(r.end_date).toLocaleDateString() : 'N/A'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold uppercase text-[11px] ${
                          r.status === 'IN_USE'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : r.status === 'ALLOCATED'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : r.status === 'RELEASED'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg mx-1 transition-colors"
                        title="Edit Resource"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => deleteResource(r.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg mx-1 transition-colors"
                        title="Delete Resource"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    No resources allocated yet. Click "Allocate Resource" above to assign equipment or personnel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FACILITIES-STYLE MODAL: ALLOCATE / EDIT RESOURCE */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl lg:max-w-3xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                  <Box size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingResource ? 'Edit Resource Allocation' : 'Allocate Resource'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingResource
                      ? 'Update allocation details, quantities, or lifecycle status'
                      : 'Assign available equipment, personnel, or supplies to active project tasks'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={saveResource} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project Field: Fetches all active projects */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Project <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="input text-xs w-full"
                    value={form.project_id}
                    onChange={(e) => {
                      const newProjectId = e.target.value;
                      setForm((p) => ({ ...p, project_id: newProjectId, task_id: '' }));
                    }}
                    required
                  >
                    <option value="">-- Select Active Project --</option>
                    {activeProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_code ? `${p.project_code} - ` : ''}
                        {p.project_name} {p.project_status ? `(${p.project_status})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-0.5">Displays projects currently in active or planning status.</p>
                </div>

                {/* Task Field: Fetches associated tasks for the selected project */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Associated Task (Optional)
                  </label>
                  <select
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                    value={form.task_id}
                    onChange={(e) => setForm((p) => ({ ...p, task_id: e.target.value }))}
                    disabled={!form.project_id || loadingTasks}
                  >
                    <option value="">
                      {loadingTasks
                        ? 'Loading tasks...'
                        : !form.project_id
                        ? '-- Select Project First --'
                        : projectTasks.length === 0
                        ? '-- No tasks found for this project --'
                        : '-- Select Associated Task --'}
                    </option>
                    {projectTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.task_title || t.title || `Task #${t.id}`}
                        {t.status ? ` (${t.status})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-0.5">Populates all tasks linked to the selected project.</p>
                </div>

                {/* Resource Type */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Resource Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="input text-xs w-full"
                    value={form.resource_type}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        resource_type: e.target.value,
                        pm_equipment_id: '',
                        hr_employee_id: ''
                      }))
                    }
                  >
                    <option value="EQUIPMENT">Equipment</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MATERIAL">Material</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {/* Equipment Field: Available equipments not linked yet OR status = allocate, release */}
                {form.resource_type === 'EQUIPMENT' && (
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Equipment <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="input text-xs w-full"
                      value={form.pm_equipment_id}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const eq = equipments.find((item) => String(item.id) === String(selectedId));
                        setForm((p) => ({
                          ...p,
                          pm_equipment_id: selectedId,
                          resource_name: eq ? eq.name : p.resource_name
                        }));
                      }}
                      required
                    >
                      <option value="">-- Select Available Equipment --</option>
                      {availableEquipments.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.name}
                          {eq.description ? ` (${eq.description})` : ''}
                        </option>
                      ))}
                    </select>
                    {availableEquipments.length === 0 ? (
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        No available equipment found (all equipment is in use, damaged, or not created yet).
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Populates unlinked equipment and equipment ready for allocation or released.
                      </p>
                    )}
                  </div>
                )}

                {/* Employee Field: Populates from hr_employees table */}
                {form.resource_type === 'EMPLOYEE' && (
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Employee <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="input text-xs w-full"
                      value={form.hr_employee_id}
                      onChange={(e) => {
                        const empId = e.target.value;
                        const emp = employees.find((item) => String(item.id) === String(empId));
                        setForm((p) => ({
                          ...p,
                          hr_employee_id: empId,
                          resource_name: emp ? getEmployeeFullName(emp) : p.resource_name
                        }));
                      }}
                      required
                    >
                      <option value="">-- Select Employee --</option>
                      {employees.map((emp) => {
                        const name = getEmployeeFullName(emp);
                        const designation = emp.pos_name || emp.dept_name || emp.designation;
                        return (
                          <option key={emp.id} value={emp.id}>
                            {emp.emp_code ? `${emp.emp_code} - ` : ''}{name}{designation ? ` (${designation})` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {employees.length === 0 ? (
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        No employees found in HR.
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Populates employees registered in Human Resources.
                      </p>
                    )}
                  </div>
                )}

                {/* Material Selection from Inventory (Optional) */}
                {form.resource_type === 'MATERIAL' && (
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Select Item from Inventory (Optional)
                    </label>
                    <select
                      className="input text-xs w-full"
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        if (!selectedId) return;
                        const itm = inventoryItems.find((item) => String(item.id) === String(selectedId));
                        if (itm) {
                          const itemName = itm.item_name || itm.name || '';
                          setForm((p) => ({
                            ...p,
                            resource_name: itemName,
                            remarks: p.remarks || (itm.uom ? `UOM: ${itm.uom}${itm.item_code ? ` | Code: ${itm.item_code}` : ''}` : '')
                          }));
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="">-- Choose from Inventory or type custom below --</option>
                      {inventoryItems.map((itm) => (
                        <option key={itm.id} value={itm.id}>
                          {itm.item_code ? `[${itm.item_code}] ` : ''}{itm.item_name || itm.name} {itm.uom ? `(${itm.uom})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Select an inventory item to pre-fill, or freely type any custom material below.
                    </p>
                  </div>
                )}

                {/* Resource Name / Reference */}
                <div className={form.resource_type === 'OTHER' ? 'md:col-span-2' : ''}>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    {form.resource_type === 'MATERIAL'
                      ? 'Material Name / Description'
                      : form.resource_type === 'EMPLOYEE'
                      ? 'Employee Name / Allocation Reference'
                      : 'Resource Name / Reference'}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input text-xs w-full"
                    placeholder={
                      form.resource_type === 'MATERIAL'
                        ? 'e.g. Portland Cement 50kg, Granite Aggregates, Sand, or any custom material'
                        : form.resource_type === 'EMPLOYEE'
                        ? 'e.g. John Doe - Site Engineer'
                        : 'e.g. Caterpillar Excavator #3 or John Doe'
                    }
                    value={form.resource_name}
                    onChange={(e) => setForm((p) => ({ ...p, resource_name: e.target.value }))}
                    required
                  />
                  {form.resource_type === 'MATERIAL' && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      You can freely modify or type any custom material name, description, or specification here.
                    </p>
                  )}
                </div>

                {/* Allocated Quantity */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Allocated Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    className="input text-xs w-full"
                    value={form.allocated_qty}
                    onChange={(e) => setForm((p) => ({ ...p, allocated_qty: e.target.value }))}
                  />
                </div>

                {/* Status Field:
                    - In Create mode: show "Allocate" option only.
                    - In Edit mode: change "Allocate" selected to "Allocated" and display all options.
                */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="input text-xs w-full"
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    disabled={!editingResource}
                  >
                    {!editingResource ? (
                      <option value="ALLOCATED">Allocate</option>
                    ) : (
                      <>
                        <option value="ALLOCATED">Allocated</option>
                        <option value="IN_USE">In Use</option>
                        <option value="RELEASED">Released</option>
                        <option value="DAMAGED">Damaged</option>
                      </>
                    )}
                  </select>
                  {!editingResource ? (
                    <p className="text-[11px] text-slate-400 mt-0.5">New allocations default to "Allocate".</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-0.5">Current allocation status: {form.status === 'ALLOCATED' ? 'Allocated' : form.status}.</p>
                  )}
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="input text-xs w-full"
                    value={form.start_date}
                    onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    className="input text-xs w-full"
                    value={form.end_date}
                    onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                  />
                </div>

                {/* Remarks */}
                <div className="md:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Remarks / Allocation Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter any notes, operational constraints, or dispatch remarks..."
                    className="input text-xs w-full"
                    value={form.remarks}
                    onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 -mx-6 -mb-6 p-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {saving ? 'Saving...' : editingResource ? 'Update Resource' : 'Allocate Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
