import React, { useState, useEffect } from 'react';
import { api } from '../../../../api/client.js';
import { toast } from 'react-toastify';
import { BarChart2, Filter, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ResourceStatusReport() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.get('/projects/resources');
        setResources(res.data?.items || res.data || []);
      } catch (e) {
        toast.error("Failed to load resource data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = resources.filter(r => {
    if (filterType && r.resource_type !== filterType) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-4 space-y-6">
      <div className="mb-2">
        <Link to="/project-management?section=Reports%20%26%20Analytics" className="text-brand-600 hover:text-brand-700 flex items-center gap-2 font-medium w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Module Home
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BarChart2 className="text-brand-600" /> Resource Allocation Report
          </h2>
          <p className="text-sm text-slate-500">Overview of all project resources and their current utilization</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <Filter size={16} className="text-slate-400 ml-2" />
            <select className="bg-transparent text-sm font-medium focus:outline-none pr-4" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              <option value="EQUIPMENT">Equipment</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="MATERIAL">Material</option>
            </select>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-2" />
            <select className="bg-transparent text-sm font-medium focus:outline-none pr-4" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="ALLOCATED">Allocated</option>
              <option value="IN_USE">In Use</option>
              <option value="RELEASED">Released</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>
          <button className="btn-secondary flex items-center gap-2">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Resource</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Assigned To</th>
                <th className="px-6 py-4">Project / Task</th>
                <th className="px-6 py-4">Period</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading data...</td></tr>
              ) : filtered.length > 0 ? filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{r.resource_name}</div>
                    <div className="text-xs text-slate-500">Qty: {r.allocated_qty}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-400">{r.resource_type}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {r.accountable_user_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{r.project_code}</div>
                    <div className="text-xs text-slate-500">{r.task_title || 'General Project Resource'}</div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    <div>{r.start_date ? new Date(r.start_date).toLocaleDateString() : '—'}</div>
                    <div>{r.end_date ? new Date(r.end_date).toLocaleDateString() : '—'}</div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <span className={`px-2.5 py-1 rounded-full font-bold uppercase
                      ${r.status === 'IN_USE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                        r.status === 'ALLOCATED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' :
                        r.status === 'DAMAGED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}
                    `}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No resources found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
