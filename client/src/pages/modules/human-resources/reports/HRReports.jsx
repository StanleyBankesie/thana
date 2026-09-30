/**
 * @fileoverview HRReports component.
 * Provides functionality for HRReports.
 */

import React, { useState, useEffect } from 'react';
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { Link, useLocation } from 'react-router-dom';

import { Download, Printer } from "lucide-react";


/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function HRReports() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const typeParam = searchParams.get('type') || 'employees';

  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

  const [reportType, setReportType] = useState(typeParam);

  useEffect(() => {
    const param = new URLSearchParams(location.search).get('type');
    if (param) setReportType(param);
  }, [location.search]);

  const [fromDate, setFromDate] = useState(new Date(new Date().setDate(1)).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [filterDept, setFilterDept] = useState('');

  const reportTypes = [
    { id: 'employees', label: 'Employee Information', icon: '👥' },
    { id: 'ssf', label: 'SSF (SSNIT) Contributions', icon: '🛡️' },
    { id: 'paye', label: 'Income Tax (PAYE)', icon: '🧾' },
    { id: 'loans', label: 'Employee Loans', icon: '💳' },
    { id: 'allowances', label: 'Employee Allowances', icon: '🎁' },
  ];

  useEffect(() => {
    loadDepartments();
    loadReport();
  }, [reportType, pollingCounter]);

  const loadDepartments = async () => {
    try {
      const res = await api.get("/hr/departments");
      setDepartments(res.data?.items || []);
    } catch {}
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      const params = { from_date: fromDate, to_date: toDate, dept_id: filterDept };
      if (reportType === 'employees') endpoint = '/hr/reports/employees';
      else if (reportType === 'ssf') endpoint = '/hr/reports/ssf';
      else if (reportType === 'paye') endpoint = '/hr/reports/paye';
      else if (reportType === 'loans') endpoint = '/hr/reports/loans';
      else if (reportType === 'allowances') endpoint = '/hr/reports/allowances';
      else endpoint = '/hr/reports/employees';
      const res = await api.get(endpoint, { params });
      setItems(res.data?.items || []);
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    if (!items.length) return toast.info("No data to export");
    try {
      const ws = XLSX.utils.json_to_sheet(items);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `HR_Report_${reportType}.xlsx`);
    } catch {
      toast.error("Failed to export Excel file");
    }
  };

  const exportPdf = () => {
    if (!items.length) return toast.info("No data to export");
    try {
      const doc = new jsPDF();
      doc.text(`HR Report: ${reportType.toUpperCase()}`, 14, 15);
      const head = [Object.keys(items[0]).slice(0, 8)];
      const body = items.map(it => Object.values(it).slice(0, 8).map(v => (v === null || v === undefined ? "-" : String(v))));
      doc.autoTable({ head, body, startY: 20 });
      doc.save(`HR_Report_${reportType}.pdf`);
    } catch {
      toast.error("Failed to export PDF file");
    }
  };

  const exportCSV = () => {
    if (!items.length) return;
    const headers = Object.keys(items[0]).join(",");
    const rows = items.map(it => Object.values(it).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `HR_Report_${reportType}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const currentReportObj = reportTypes.find(t => t.id === reportType) || reportTypes[0];

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>{currentReportObj.icon}</span> {currentReportObj.label}
            </h1>
            <p className="text-sm text-slate-500">Comprehensive insights into workforce and operations</p>
          </div>
          <Link to="/human-resources?section=Organization%20%26%20Structures" className="btn-secondary text-sm">Return to Menu</Link>
        </div>

        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm flex flex-wrap items-end gap-4 border border-slate-200 dark:border-slate-700">
            <div className="flex-1 min-w-[150px]">
              <label className="label text-[10px]">Department</label>
              <select className="input text-sm h-9" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.dept_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-[10px]">From Date</label>
              <input type="date" className="input text-sm h-9" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="label text-[10px]">To Date</label>
              <input type="date" className="input text-sm h-9" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            <button onClick={loadReport} className="btn-primary h-9 px-4 text-sm">Generate</button>
            <div className="flex items-center gap-2">
              <button onClick={exportExcel} className="btn-success px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2">Excel</button>
              <button onClick={exportPdf} className="btn-error px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 flex items-center gap-2">PDF</button>
            </div>
          </div>

          {/* Results */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <h2 className="font-semibold text-sm uppercase">{reportType.replace("-", " ")} Report Results</h2>
              <span className="text-xs text-slate-500 font-medium">{items.length} records found</span>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                  <tr className="text-left text-[10px] font-bold uppercase text-slate-500 border-b">
                    {items.length > 0 && Object.keys(items[0]).slice(0, 8).map(key => (
                      <th key={key} className="px-4 py-3">{key.replace("_", " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {items.map((row, idx) => (
                    <tr key={idx} className="text-left bg-slate-50 dark:bg-slate-900/50">
                      {Object.values(row).slice(0, 8).map((val, i) => (
                        <td key={i} className="px-4 py-3 truncate max-w-[200px]">
                          {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val || '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {items.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500 italic">
                        No records found for this criteria. Try changing filters or report type.
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <div className="animate-spin inline-block w-6 h-6 border-2 border-brand border-t-transparent rounded-full"></div>
                        <p className="text-xs mt-2 text-slate-500">Generating report...</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Guard>
  );
}
