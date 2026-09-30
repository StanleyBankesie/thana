/**
 * @fileoverview BaseSalariesPage component.
 * Provides functionality for BaseSalariesPage.
 */

import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import * as XLSX from "xlsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function BaseSalariesPage() {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [baseSalaries, setBaseSalaries] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState({
    employee_id: "",
    base_salary: 0,
  });

  const fileInputRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, salRes] = await Promise.all([
        api.get("/hr/employees").catch(() => ({ data: { items: [] } })),
        api.get("/hr/salary/base-salaries").catch(() => ({ data: { items: [] } })),
      ]);
      setEmployees((empRes.data.items || []).filter(e => e.status === 'ACTIVE'));
      setBaseSalaries(salRes.data.items || []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveBaseSalary = async (e) => {
    e.preventDefault();
    try {
      await api.post("/hr/salary/base-salaries", selectedEmp);
      toast.success("Base salary updated");
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error("Save Base Salary Error:", err);
      toast.error(err?.response?.data?.message || "Failed to save base salary");
    }
  };

  const handleDownloadTemplate = () => {
    try {
      // Map current active employees to the template format
      const data = employees.map(emp => {
        // Find existing base salary if any
        const existing = baseSalaries.find(b => b.employee_id === emp.id);
        return {
          "Employee Code": emp.emp_code,
          "Employee Name": `${emp.first_name} ${emp.last_name}`,
          "Base Salary": existing ? existing.base_salary : 0
        };
      });

      // If no employees, at least provide headers
      if (data.length === 0) {
        data.push({
          "Employee Code": "EMP001",
          "Employee Name": "John Doe",
          "Base Salary": 5000
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Base Salaries");

      // Auto-size columns slightly
      const wscols = [
        { wch: 15 }, // Employee Code
        { wch: 30 }, // Employee Name
        { wch: 15 }, // Base Salary
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, "Employee_Base_Salaries_Template.xlsx");
      toast.info("Excel template downloaded");
    } catch (err) {
      toast.error("Failed to generate Excel template");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
          toast.error("Excel file appears to be empty");
          return;
        }

        // Map Excel headers to system keys
        // We look for flexible header names
        const rows = data.map(item => {
          const empCode = item["Employee Code"] || item["emp_code"] || item["Code"];
          const baseSalary = item["Base Salary"] || item["base_salary"] || item["Salary"];
          return {
            emp_code: empCode,
            base_salary: baseSalary
          };
        }).filter(r => r.emp_code);

        if (rows.length === 0) {
          toast.error("No valid data found in Excel. Ensure 'Employee Code' and 'Base Salary' columns exist.");
          return;
        }

        setLoading(true);
        const res = await api.post("/hr/salary/base-salaries/bulk", { rows });
        toast.success(res.data.message || "Bulk base salaries uploaded successfully");
        loadData();
      } catch (err) {
        toast.error(err?.response?.data?.message || "Failed to process Excel upload");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Base Salaries</h1>
            <p className="text-sm text-slate-500">
              Manage employee base pay per period
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.history.back()} className="btn-secondary"
            >
              ← Back
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="btn-secondary"
              title="Download CSV Template"
            >
              📥 Template
            </button>
            <input
              type="file"
              accept=".xlsx,.xls"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
              title="Upload CSV Data"
            >
              📤 Upload
            </button>
            <button
              onClick={() => {
                setSelectedEmp({ employee_id: "", base_salary: 0 });
                setShowModal(true);
              }}
              className="btn-primary"
            >
              + Set Base Salary
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">
          <table className="min-w-full">
            <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
              <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Employee
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Code
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Base Salary
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {baseSalaries.map((r) => (
                <tr
                  key={r.employee_id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium">
                    {r.first_name} {r.last_name}
                  </td>
                  <td className="px-4 py-3 text-sm">{r.emp_code}</td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {Number(r.base_salary).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedEmp({
                          employee_id: r.employee_id,
                          base_salary: r.base_salary,
                        });
                        setShowModal(true);
                      }}
                      className="text-brand hover:underline text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {baseSalaries.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No base salaries configured.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold">Set Employee Base Salary</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleSaveBaseSalary} className="p-6 space-y-4">
                <div>
                  <label className="label">Select Employee</label>
                  <select
                    className="input"
                    value={selectedEmp.employee_id}
                    onChange={(e) =>
                      setSelectedEmp({
                        ...selectedEmp,
                        employee_id: e.target.value,
                      })
                    }
                    required
                    disabled={!!selectedEmp.id || !!selectedEmp.emp_code}
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.emp_code} - {e.first_name} {e.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Base Salary (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input font-mono"
                    value={selectedEmp.base_salary}
                    onChange={(e) =>
                      setSelectedEmp({
                        ...selectedEmp,
                        base_salary: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary flex-1">
                    Save Salary
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Guard>
  );
}
