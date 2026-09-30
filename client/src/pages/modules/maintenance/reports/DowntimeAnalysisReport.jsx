/**
 * @fileoverview DowntimeAnalysisReport component.
 * Provides functionality for DowntimeAnalysisReport.
 */

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Download, 
  Filter, 
  Loader2, 
  Calendar, 
  TrendingUp, 
  ZapOff,
  AlertTriangle,
  Clock,
  ChevronRight,
  BarChart2
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DowntimeAnalysisReport() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/maintenance/reports/downtime?start_date=${filters.start_date}&end_date=${filters.end_date}`);
      setData(res.data?.data || []);
    } catch (error) {
      toast.error("Failed to load downtime analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const totalIncidents = data.reduce((acc, curr) => acc + Number(curr.total_incidents), 0);
  const totalMins = data.reduce((acc, curr) => acc + Number(curr.total_downtime_mins), 0);

  const formatMins = (mins) => {
    const hrs = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${hrs}h ${m}m`;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link to="/maintenance/reports" className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 transition-all text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Downtime Analysis</h1>
            <p className="text-slate-500 font-medium italic">Root cause tracking and reliability metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 px-4 py-2 border-r border-slate-100 dark:border-slate-700">
            <Calendar size={16} className="text-indigo-500" />
            <input 
              type="date" 
              className="bg-transparent border-none outline-none text-xs font-bold text-slate-600 dark:text-slate-300"
              value={filters.start_date}
              onChange={e => setFilters({...filters, start_date: e.target.value})}
            />
            <span className="text-slate-300 font-bold">to</span>
            <input 
              type="date" 
              className="bg-transparent border-none outline-none text-xs font-bold text-slate-600 dark:text-slate-300"
              value={filters.end_date}
              onChange={e => setFilters({...filters, end_date: e.target.value})}
            />
          </div>
          <button 
            onClick={fetchReport}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600">
            <ZapOff size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Incidents</p>
            <p className="text-4xl font-black text-slate-900 dark:text-white">{totalIncidents}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accumulated Downtime</p>
            <p className="text-4xl font-black text-slate-900 dark:text-white">{formatMins(totalMins)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MTTR Avg.</p>
            <p className="text-4xl font-black text-slate-900 dark:text-white">
              {totalIncidents > 0 ? formatMins(totalMins / totalIncidents) : '0h 0m'}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Uptime Percentage</p>
            <p className="text-4xl font-black text-emerald-600">96.8%</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <BarChart2 className="text-indigo-500" size={24} />
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Asset Impact Ranking</h2>
          </div>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl text-xs font-bold hover:scale-105 transition-transform active:scale-95">
            <Download size={16} />
            Export CSV
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Registry</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Incidents</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Lost Time</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Severity Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="4" className="px-8 py-32 text-center animate-pulse font-black text-slate-300 text-2xl uppercase italic tracking-widest">Processing Big Data...</td></tr>
              ) : data.length > 0 ? data.map((item, idx) => (
                <tr key={idx} className="group hover:bg-slate-50/80 transition-all duration-300">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center font-black text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-black text-slate-900 dark:text-white text-lg leading-tight">{item.asset_name}</div>
                        <div className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">{item.asset_no}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="inline-block min-w-[3rem] px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl font-black text-slate-900 dark:text-white">
                      {item.total_incidents}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="font-black text-slate-900 dark:text-white">{formatMins(item.total_downtime_mins)}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Total Period Lost</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span>Risk Score</span>
                        <span className={item.total_incidents > 3 ? 'text-rose-600' : 'text-emerald-600'}>
                          {item.total_incidents > 3 ? 'High' : 'Optimal'}
                        </span>
                      </div>
                      <div className="w-48 h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${item.total_incidents > 3 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min((item.total_incidents / 10) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="px-8 py-32 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-50">
                    No downtime incidents found in this period range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
