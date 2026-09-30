/**
 * @fileoverview LeaveCalendar component.
 * Provides functionality for LeaveCalendar.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const SOURCE_STYLES = {
  APPLICATION: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  SCHEDULE: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-800 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  ROSTER: {
    bg: "bg-slate-100 dark:bg-slate-700/50",
    text: "text-slate-700 dark:text-slate-300",
    dot: "bg-slate-400",
  },
};

function monthGrid(year, month) {
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LeaveCalendar() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/hr/leave/calendar?year=${year}&month=${month}`);
        setEvents(res.data?.events || []);
      } catch {
        toast.error("Failed to load calendar");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [year, month]);

  const grid = useMemo(() => monthGrid(year, month), [year, month]);

  function dayEvents(d) {
    const iso = d.toISOString().slice(0, 10);
    return events.filter((e) => e.start_date <= iso && e.end_date >= iso);
  }

  const prev = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">← Back</button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Leave Calendar</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Only ACTIVE leave records are displayed</p>
          </div>
        </div>

        {/* Month/Year Nav */}
        <div className="flex items-center gap-2">
          <button onClick={prev} className="btn-secondary px-3 py-1.5 text-sm">‹</button>
          <div className="flex items-center gap-2">
            <select
              className="input w-36 text-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <input
              className="input w-24 text-sm"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <button onClick={next} className="btn-secondary px-3 py-1.5 text-sm">›</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs font-semibold">
        {Object.entries(SOURCE_STYLES).map(([src, style]) => (
          <span key={src} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${style.dot} inline-block`} />
            {src}
          </span>
        ))}
        <span className="text-slate-400 font-normal">· Overridden records are excluded</span>
      </div>

      {/* Summary bar */}
      {!loading && events.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
          <span className="font-medium">{MONTH_NAMES[month - 1]} {year}:</span>
          <span>{events.length} active leave record{events.length !== 1 ? "s" : ""}</span>
          {Object.entries(SOURCE_STYLES).map(([src]) => {
            const cnt = events.filter((e) => e.source === src).length;
            return cnt > 0 ? (
              <span key={src}>
                <span className="font-semibold">{cnt}</span> {src.toLowerCase()}
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-400 animate-pulse">
            Loading calendar…
          </div>
        ) : (
          <div className="grid grid-cols-7 border-l border-slate-200 dark:border-slate-700">
            {grid.map((d, idx) => {
              const evs = dayEvents(d);
              const isCurrent = d.getMonth() + 1 === month;
              const isToday = d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={idx}
                  className={`border-r border-b border-slate-200 dark:border-slate-700 min-h-[100px] p-1.5 ${
                    isCurrent
                      ? "bg-white dark:bg-slate-800"
                      : "bg-slate-50/50 dark:bg-slate-900/30"
                  }`}
                >
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                    isToday
                      ? "bg-brand text-white"
                      : isCurrent
                      ? "text-slate-700 dark:text-slate-300"
                      : "text-slate-300 dark:text-slate-600"
                  }`}>
                    {d.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {evs.slice(0, 3).map((e) => {
                      const style = SOURCE_STYLES[e.source] || SOURCE_STYLES.ROSTER;
                      return (
                        <div
                          key={`${e.id}-${idx}`}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate leading-tight ${style.bg} ${style.text}`}
                          title={`${e.first_name} ${e.last_name} — ${e.type_name} (${e.source}) ${e.start_date}→${e.end_date}`}
                        >
                          {e.first_name} {e.last_name?.[0]}.
                        </div>
                      );
                    })}
                    {evs.length > 3 && (
                      <div className="text-[10px] text-slate-400 pl-1 font-medium">
                        +{evs.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
