/**
 * @fileoverview TimesheetList component.
 * Provides functionality for TimesheetList.
 */

import React, { useState, useEffect } from "react";
import { Plus, Clock, Paperclip } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function TimesheetList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  const [form, setForm] = useState({
    project_id: "", task_id: "", log_date: new Date().toISOString().split('T')[0], hours: "", description: ""
  });

  const fetchTimesheets = async () => {
    try {
      const res = await api.get("/projects/timesheets");
      setItems(res.data?.items || []);
    } catch { toast.error("Failed to load project timeline history"); }
    finally { setLoading(false); }
  };

  const fetchAuxiliary = async () => {
    try {
      const res = await api.get("/projects/projects");
      setProjects(res.data?.items || []);
    } catch {}
  };

  useEffect(() => { fetchTimesheets(); fetchAuxiliary(); }, []);

  useEffect(() => {
    if (form.project_id) {
      api.get(`/projects/tasks?projectId=${form.project_id}`).then(res => setTasks(res.data?.items || [])).catch(() => {});
    } else setTasks([]);
  }, [form.project_id]);

  const openCreate = () => {
    setEditing(null);
    setForm({ project_id: "", task_id: "", log_date: new Date().toISOString().split('T')[0], hours: "", description: "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ project_id: item.project_id, task_id: item.task_id, log_date: item.log_date?.split('T')[0] || "", hours: item.hours, description: item.description || "" });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/projects/timesheets/${editing.id}`, form);
        toast.success("Entry updated");
      } else {
        await api.post("/projects/timesheets", form);
        toast.success("Hours logged successfully");
      }
      setShowModal(false);
      fetchTimesheets();
    } catch { toast.error("Failed to save entry"); }
  };

  const filtered = items.filter(i =>
    (i.task_title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.project_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, "log_date", "desc");
  const totalHours = items.reduce((a, c) => a + Number(c.hours), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Project Timeline</h1>
              <p className="text-sm mt-1 opacity-80">Work hours logged against projects and tasks</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn btn-secondary">Back</button>
              <button onClick={openCreate} className="btn-success flex items-center gap-2"><Plus size={16} />Log Hours</button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <input type="text" placeholder="Filter by task or project..." className="input max-w-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border self-start">
              <Clock size={15} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total: {totalHours.toFixed(1)}h</span>
            </div>
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <SortableHeader label="Work Reference" sortKey="task_title" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Description"   sortKey="description" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Hours"         sortKey="hours"       currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                  <SortableHeader label="Log Date"      sortKey="log_date"    currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">Docs</th>
                  <th className="w-px whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="text-center py-8 text-slate-400">Loading...</td></tr>
                ) : sorted.length > 0 ? sorted.map((item) => (
                  <tr key={item.id}>
                    {/* Work Reference */}
                    <td className="py-3">
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{item.task_title}</div>
                      <div className="text-[10px] text-slate-400">{item.project_name}</div>
                    </td>

                    {/* Description */}
                    <td className="text-sm text-slate-600 max-w-[220px] truncate py-3">
                      {item.description || '—'}
                    </td>

                    {/* Hours */}
                    <td className="text-center py-3">
                      <span className="font-bold text-sm">{Number(item.hours).toFixed(1)}h</span>
                    </td>

                    {/* Log Date */}
                    <td className="text-sm whitespace-nowrap py-3">
                      {item.log_date ? new Date(item.log_date).toLocaleDateString() : '—'}
                    </td>

                    {/* Docs */}
                    <td className="text-center py-3">
                      <button
                        type="button"
                        onClick={() => { setActiveDocId(item.id); setShowAttach(true); }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 transition-colors"
                      >
                        <Paperclip size={11} /> Attach
                      </button>
                    </td>

                    {/* Actions — no Delete, tight column */}
                    <td className="w-px whitespace-nowrap pl-4 py-3">
                      <button
                        onClick={() => openEdit(item)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" className="text-center py-8 text-slate-400">No work hours recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Log Hours Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-600 rounded-lg text-white"><Clock size={18} /></div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? "Edit Entry" : "Log Work Hours"}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Project</label>
                <select required className="input w-full" value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})}>
                  <option value="">Select Project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Task</label>
                <select required className="input w-full" value={form.task_id} onChange={e => setForm({...form, task_id: e.target.value})}>
                  <option value="">Select Task...</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.task_title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Date</label>
                  <input type="date" required className="input w-full" value={form.log_date} onChange={e => setForm({...form, log_date: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Hours</label>
                  <input type="number" step="0.1" required className="input w-full" placeholder="0.0" value={form.hours} onChange={e => setForm({...form, hours: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
                <textarea className="input w-full" rows="2" placeholder="Work details..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-all font-bold text-sm uppercase tracking-wider shadow-sm">
                {editing ? "Update Entry" : "Confirm Entry"}
              </button>
            </form>
          </div>
        </div>
      )}

      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => { setShowAttach(false); setActiveDocId(null); }}
        docType="timesheet"
        docId={activeDocId}
      />
    </div>
  );
}
