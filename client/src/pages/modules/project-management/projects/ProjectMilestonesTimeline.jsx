import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../../../api/client.js';
import { toast } from 'react-toastify';
import { Loader2, Calendar, Layout, ListTree, User, Clock, CheckCircle, MapPin } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';

export default function ProjectMilestonesTimeline() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingTasks, setFetchingTasks] = useState(false);
  const [viewMode, setViewMode] = useState('STEP'); // 'STEP' or 'GANTT'

  useEffect(() => {
    async function loadProjects() {
      try {
        setLoading(true);
        const res = await api.get('/projects/projects');
        setProjects(res.data?.items || res.data?.projects || []);
        if (res.data?.items?.length > 0 || res.data?.projects?.length > 0) {
          const projs = res.data?.items || res.data?.projects;
          setSelectedProjectId(projs[0].id);
        }
      } catch (e) {
        toast.error('Failed to load projects');
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  useEffect(() => {
    async function loadTasks() {
      if (!selectedProjectId) return;
      try {
        setFetchingTasks(true);
        const res = await api.get('/projects/tasks', { params: { project_id: selectedProjectId } });
        setTasks(res.data?.items || []);
      } catch (e) {
        toast.error('Failed to load tasks');
      } finally {
        setFetchingTasks(false);
      }
    }
    loadTasks();
  }, [selectedProjectId]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => new Date(a.start_date || a.created_at) - new Date(b.start_date || b.created_at));
  }, [tasks]);

  const [selectedTask, setSelectedTask] = useState(null);

  // Gantt Chart Calculations
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (!sortedTasks.length) return { minDate: null, maxDate: null, totalDays: 0 };
    
    let min = new Date(sortedTasks[0].start_date || sortedTasks[0].created_at);
    let max = new Date(sortedTasks[0].end_date || sortedTasks[0].created_at);
    
    sortedTasks.forEach(t => {
      const start = new Date(t.start_date || t.created_at);
      const end = new Date(t.end_date || t.created_at);
      if (start < min) min = start;
      if (end > max) max = end;
    });

    // Add some padding
    min = new Date(min.setDate(min.getDate() - 2));
    max = new Date(max.setDate(max.getDate() + 2));
    
    const days = differenceInDays(max, min);
    return { minDate: min, maxDate: max, totalDays: days > 0 ? days : 1 };
  }, [sortedTasks]);

  return (
    <div className="p-4 space-y-6">
      <div className="mb-2">
        <Link to="/project-management?section=Reports%20%26%20Analytics" className="text-brand-600 hover:text-brand-700 flex items-center gap-2 font-medium w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Module Home
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <MapPin className="text-brand-600" /> Project Milestones
          </h2>
          <p className="text-sm text-slate-500">Graphical visualization of project progress and task stages</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${viewMode === 'STEP' ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setViewMode('STEP')}
          >
            <ListTree size={16} /> Chronological
          </button>
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${viewMode === 'GANTT' ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setViewMode('GANTT')}
          >
            <Layout size={16} /> Gantt Chart
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
        <div className="flex-1 max-w-sm">
          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Select Project</label>
          {loading ? (
            <div className="h-10 bg-slate-100 dark:bg-slate-700 animate-pulse rounded-lg"></div>
          ) : (
            <select className="select w-full" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {fetchingTasks ? (
        <div className="py-20 flex justify-center"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : sortedTasks.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-12 text-center rounded-xl border border-slate-100 dark:border-slate-700">
          <MapPin size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Tasks Found</h3>
          <p className="text-slate-500">This project does not have any tasks or milestones yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 overflow-x-auto">
              
              {viewMode === 'STEP' && (
                <div className="relative py-8">
                  {/* Vertical line connecting steps */}
                  <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-700 z-0"></div>
                  
                  <div className="space-y-8 relative z-10">
                    {sortedTasks.map((t, idx) => {
                      const isComplete = t.status === 'COMPLETED' || t.progress_percentage === 100;
                      const isInProgress = t.status === 'IN_PROGRESS';
                      
                      return (
                        <div 
                          key={t.id} 
                          className={`flex gap-4 cursor-pointer group ${selectedTask?.id === t.id ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                          onClick={() => setSelectedTask(t)}
                        >
                          <div className={`w-12 h-12 rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center shrink-0 transition-colors
                            ${isComplete ? 'bg-emerald-500 text-white' : 
                              isInProgress ? 'bg-brand-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}
                          >
                            {isComplete ? <CheckCircle size={20} /> : <span className="text-sm font-bold">{idx + 1}</span>}
                          </div>
                          
                          <div className={`flex-1 p-4 rounded-xl border transition-all ${selectedTask?.id === t.id ? 'border-brand-500 shadow-md bg-brand-50/30 dark:bg-brand-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:border-slate-300'}`}>
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-slate-800 dark:text-slate-100">{t.task_title}</h4>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase
                                ${t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                                  t.status === 'IN_PROGRESS' ? 'bg-brand-100 text-brand-700' : 
                                  t.status === 'OVERDUE' ? 'bg-rose-100 text-rose-700' : 
                                  'bg-slate-100 text-slate-600'}`}
                              >
                                {t.status}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-2 mb-3">{t.description || 'No description provided.'}</p>
                            
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mb-1">
                              <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${t.progress_percentage || 0}%` }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 font-medium">
                              <span>Progress</span>
                              <span>{t.progress_percentage || 0}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {viewMode === 'GANTT' && (
                <div className="min-w-[600px]">
                  {/* Gantt Header */}
                  <div className="flex mb-4">
                    <div className="w-48 shrink-0 font-bold text-sm text-slate-500 uppercase tracking-wider p-2 border-r border-slate-200 dark:border-slate-700">Task Name</div>
                    <div className="flex-1 relative h-8">
                      {/* Optional: Add date markers here */}
                    </div>
                  </div>
                  
                  {/* Gantt Rows */}
                  <div className="space-y-2">
                    {sortedTasks.map(t => {
                      const start = new Date(t.start_date || t.created_at);
                      const end = new Date(t.end_date || t.created_at);
                      
                      let leftPercent = ((start - minDate) / (maxDate - minDate)) * 100;
                      let widthPercent = ((end - start) / (maxDate - minDate)) * 100;
                      
                      // Fallback for missing or invalid dates causing negative widths
                      if (widthPercent < 2) widthPercent = 2;
                      if (leftPercent < 0) leftPercent = 0;
                      if (leftPercent + widthPercent > 100) widthPercent = 100 - leftPercent;

                      const isComplete = t.status === 'COMPLETED' || t.progress_percentage === 100;
                      
                      return (
                        <div 
                          key={t.id} 
                          className={`flex items-center group cursor-pointer ${selectedTask?.id === t.id ? 'bg-slate-50 dark:bg-slate-700/50 rounded-lg' : ''}`}
                          onClick={() => setSelectedTask(t)}
                        >
                          <div className="w-48 shrink-0 p-2 text-sm font-medium text-slate-700 dark:text-slate-200 truncate pr-4 border-r border-slate-200 dark:border-slate-700">
                            {t.task_title}
                          </div>
                          <div className="flex-1 relative h-10 flex items-center bg-slate-50/50 dark:bg-slate-900/20">
                            <div 
                              className={`absolute h-6 rounded-md shadow-sm transition-all ${isComplete ? 'bg-emerald-500' : 'bg-brand-500'}`}
                              style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                            >
                              {/* Progress Overlay */}
                              <div className="h-full bg-white/20 rounded-l-md" style={{ width: `${t.progress_percentage || 0}%` }}></div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            {selectedTask ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 sticky top-4">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 leading-tight">{selectedTask.task_title}</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Status</p>
                    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full uppercase
                      ${selectedTask.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                        selectedTask.status === 'IN_PROGRESS' ? 'bg-brand-100 text-brand-700' : 
                        selectedTask.status === 'OVERDUE' ? 'bg-rose-100 text-rose-700' : 
                        'bg-slate-100 text-slate-600'}`}
                    >
                      {selectedTask.status}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Progress</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
                        <div className="bg-brand-500 h-2.5 rounded-full" style={{ width: `${selectedTask.progress_percentage || 0}%` }}></div>
                      </div>
                      <span className="font-bold text-sm text-slate-700">{selectedTask.progress_percentage || 0}%</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500"><User size={14} /></div>
                      <div>
                        <p className="text-xs text-slate-500">Assigned To</p>
                        <p className="font-medium text-sm text-slate-800 dark:text-slate-200">{selectedTask.assigned_to_name || 'Unassigned'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500"><Calendar size={14} /></div>
                      <div>
                        <p className="text-xs text-slate-500">Timeline</p>
                        <p className="font-medium text-sm text-slate-800 dark:text-slate-200">
                          {selectedTask.start_date ? format(new Date(selectedTask.start_date), 'MMM d, yyyy') : 'N/A'} 
                          {' → '}
                          {selectedTask.end_date ? format(new Date(selectedTask.end_date), 'MMM d, yyyy') : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500"><Clock size={14} /></div>
                      <div>
                        <p className="text-xs text-slate-500">Est. Hours</p>
                        <p className="font-medium text-sm text-slate-800 dark:text-slate-200">{selectedTask.estimated_hours || 0} hrs</p>
                      </div>
                    </div>
                  </div>

                  {selectedTask.description && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Details</p>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedTask.description}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                <MapPin size={32} className="text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-500">Select a milestone or task from the timeline to view its details.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
