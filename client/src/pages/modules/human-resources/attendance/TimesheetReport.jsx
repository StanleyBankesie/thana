/**
 * @fileoverview TimesheetReport component.
 * Dedicated page for viewing, filtering, and reporting timesheet logs.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Download, Printer } from "lucide-react";

export default function TimesheetReport() {
  const [viewMode, setViewMode] = useViewMode();
  const [fromDate, setFromDate] = useState(
    new Date(new Date().setDate(1)).toISOString().slice(0, 10)
  );
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
    loadTimesheets();
  }, []);

  const loadEmployees = async () => {
    try {
      const res = await api.get("/hr/employees");
      setEmployees(res.data?.items || []);
    } catch {}
  };

  const loadTimesheets = async () => {
    setLoading(true);
    try {
      const params = { from_date: fromDate, to_date: toDate };
      if (employeeId) params.employee_id = employeeId;
      const res = await api.get("/hr/timesheets", { params });
      setItems(res.data?.items || []);
    } catch {
      toast.error("Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  };

  const totalHours = items.reduce(
    (sum, it) => sum + Number(it.hours_worked || 0),
    0
  );
  const totalOT = items.reduce(
    (sum, it) => sum + Number(it.overtime_hours || 0),
    0
  );
  function exportExcel() {
    const rows = items || [];
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "Report.xlsx");
  }

  function exportPDF() {
    const rows = items || [];
    if (!rows.length) return;
    const doc = new jsPDF('landscape');
    if(rows.length > 0) {
      const keys = Object.keys(rows[0]).filter(k => typeof rows[0][k] !== 'object');
      const tableColumn = keys;
      const tableRows = rows.map(row => keys.map(k => row[k] ? String(row[k]) : ''));
      doc.autoTable({ head: [tableColumn], body: tableRows });
    }
    doc.save("Report.pdf");
  }


  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Timesheet Report & Logs</h1>
            <p className="text-sm text-slate-500">
              View and analyze recorded employee work hours and overtime
            </p>
          
        <div className="flex gap-2">

          <button onClick={exportExcel} className="btn-secondary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportPDF} className="btn-secondary text-sm flex items-center gap-2">
            <Printer className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>
          <button onClick={() => window.history.back()} className="btn-secondary"
          >
            Back
          </button>
        </div>

        {/* Filter Section */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
              Filter Employee
            </label>
            <select
              className="input text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
              From
            </label>
            <input
              type="date"
              className="input text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
              To
            </label>
            <input
              type="date"
              className="input text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <button
            className="btn-primary px-6 text-sm"
            onClick={loadTimesheets}
          >
            Search Report
          </button>
        </div>

        {/* Report Table */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap justify-between items-center gap-4">
            <h2 className="font-semibold text-lg">Timesheet Logs</h2>
            <div className="flex items-center gap-4">
              <div className="flex gap-4 text-sm bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <span>
                  Total Regular:{" "}
                  <strong className="text-brand">{totalHours.toFixed(1)}h</strong>
                </span>
                <span>
                  Total OT:{" "}
                  <strong className="text-amber-600">{totalOT.toFixed(1)}h</strong>
                </span>
              </div>
              <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className={ "min-w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
              <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Date
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    In/Out
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                    Regular
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                    OT
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                    Short
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    GPS
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((r) => (
                  <tr
                    key={r.id}
                    className="text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="px-4 py-3 font-medium">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(r.work_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.time_in || "-"} to {r.time_out || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.hours_worked}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-600">
                      {r.overtime_hours}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">
                      {r.short_hours || 0}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-400 font-mono">
                      {r.location_gps || "-"}
                    </td>
                    <td
                      className="px-4 py-3 text-slate-500 italic truncate max-w-[150px]"
                      title={r.remarks}
                    >
                      {r.remarks || "-"}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      No timesheet records found for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Guard>
  );
}
