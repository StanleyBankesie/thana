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
  const [componentDefinitions, setComponentDefinitions] = useState([]);
  const [salaryComponents, setSalaryComponents] = useState([]);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState({
    employee_id: "",
    base_salary: 0,
  });

  const fileInputRef = useRef(null);

  const newComponent = () => ({
    client_key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    definition_id: "",
    component_name: "",
    component_type: "ALLOWANCE",
    calculation_type: "AMOUNT",
    value: "",
    basis_component_ref: "BASIC",
    effective_from: `${new Date().getFullYear()}-01-01`,
    effective_to: "",
  });

  const loadEmployeeComponents = async (employeeId) => {
    if (!employeeId) {
      setSalaryComponents([]);
      return;
    }
    setComponentsLoading(true);
    try {
      const response = await api.get(
        `/hr/salary/base-salaries/${employeeId}/components`,
      );
      setSalaryComponents(
        (response.data?.items || []).map((item) => ({
          ...item,
          definition_id: item.definition_id ? String(item.definition_id) : "",
          client_key: String(item.id),
          value: String(item.value ?? ""),
          basis_component_ref: item.basis_component_id
            ? String(item.basis_component_id)
            : "BASIC",
          effective_from: item.effective_from
            ? String(item.effective_from).slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          effective_to: item.effective_to
            ? String(item.effective_to).slice(0, 10)
            : "",
        })),
      );
    } catch (err) {
      setSalaryComponents([]);
      toast.error(
        err?.response?.data?.message ||
          "Failed to load employee salary components",
      );
    } finally {
      setComponentsLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, salRes, definitionsRes] = await Promise.all([
        api.get("/hr/employees").catch(() => ({ data: { items: [] } })),
        api
          .get("/hr/salary/base-salaries")
          .catch(() => ({ data: { items: [] } })),
        api
          .get("/hr/salary-component-definitions")
          .catch(() => ({ data: { items: [] } })),
      ]);
      setEmployees(
        (empRes.data.items || []).filter((e) => e.status === "ACTIVE"),
      );
      setBaseSalaries(salRes.data.items || []);
      setComponentDefinitions(definitionsRes.data?.items || []);
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
      await api.put(
        `/hr/salary/base-salaries/${selectedEmp.employee_id}/components`,
        {
          items: salaryComponents.map((item) => ({
            id: item.id,
            definition_id: item.definition_id || null,
            client_key: item.client_key,
            component_name: item.component_name,
            component_type: item.component_type,
            calculation_type: item.calculation_type,
            value: item.value,
            basis_component_ref: item.basis_component_ref,
            effective_from: item.effective_from,
            effective_to: item.effective_to || null,
          })),
        },
      );
      toast.success("Base salary and employee components updated");
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error("Save Base Salary Error:", err);
      toast.error(
        err?.response?.data?.message ||
          "Base salary may have been saved, but employee components could not be saved",
      );
    }
  };

  const handleDownloadTemplate = () => {
    try {
      // Filter non-manual salary components registered in the system
      const nonManualDefinitions = componentDefinitions.filter(
        (d) => Number(d.manual_calculation) === 0 && Number(d.is_active) !== 0,
      );

      // Map current active employees to the template format
      const data = employees.map((emp) => {
        // Find existing base salary and components if any
        const existing = baseSalaries.find((b) => b.employee_id === emp.id);
        const row = {
          "Employee Code": emp.emp_code,
          "Employee Name": `${emp.first_name} ${emp.last_name}`,
          "Base Salary": existing ? Number(existing.base_salary || 0) : 0,
        };

        // Add all registered non-manual components as columns
        nonManualDefinitions.forEach((def) => {
          const comp = existing?.components?.find(
            (c) =>
              Number(c.definition_id) === Number(def.id) ||
              c.component_name?.trim().toLowerCase() === def.component_name?.trim().toLowerCase(),
          );
          row[def.component_name] = comp ? Number(comp.value || 0) : 0;
        });

        return row;
      });

      // If no employees, at least provide headers with sample data
      if (data.length === 0) {
        const sampleRow = {
          "Employee Code": "EMP001",
          "Employee Name": "John Doe",
          "Base Salary": 5000,
        };
        nonManualDefinitions.forEach((def) => {
          sampleRow[def.component_name] = 0;
        });
        data.push(sampleRow);
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Employee Salaries");

      // Auto-size columns slightly
      const wscols = [
        { wch: 15 }, // Employee Code
        { wch: 30 }, // Employee Name
        { wch: 15 }, // Base Salary
        ...nonManualDefinitions.map(() => ({ wch: 22 })),
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, "Employee_Salary_Components_Template.xlsx");
      toast.info("Excel template downloaded with all non-manual components");
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

        const nonManualDefinitions = componentDefinitions.filter(
          (d) => Number(d.manual_calculation) === 0 && Number(d.is_active) !== 0,
        );

        // Map Excel headers to system keys and non-manual components
        const rows = data
          .map((item) => {
            const empCode =
              item["Employee Code"] || item["emp_code"] || item["Code"];
            const baseSalary =
              item["Base Salary"] ?? item["base_salary"] ?? item["Salary"] ?? 0;

            const components = [];
            nonManualDefinitions.forEach((def) => {
              const matchedKey = Object.keys(item).find(
                (k) => k.trim().toLowerCase() === def.component_name.trim().toLowerCase(),
              );
              if (
                matchedKey !== undefined &&
                item[matchedKey] !== "" &&
                item[matchedKey] !== null &&
                item[matchedKey] !== undefined
              ) {
                const val = Number(item[matchedKey]);
                if (!isNaN(val)) {
                  components.push({
                    definition_id: def.id,
                    component_name: def.component_name,
                    component_type: def.component_type,
                    calculation_type: "AMOUNT",
                    value: val,
                  });
                }
              }
            });

            return {
              emp_code: empCode,
              base_salary: Number(baseSalary || 0),
              components,
            };
          })
          .filter((r) => r.emp_code);

        if (rows.length === 0) {
          toast.error(
            "No valid data found in Excel. Ensure 'Employee Code' and 'Base Salary' columns exist.",
          );
          return;
        }

        setLoading(true);
        const res = await api.post("/hr/salary/base-salaries/bulk", { rows });
        toast.success(
          res.data.message || "Bulk base salaries and components uploaded successfully",
        );
        loadData();
      } catch (err) {
        toast.error(
          err?.response?.data?.message || "Failed to process Excel upload",
        );
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
            <h1 className="text-2xl font-bold">Employee Salary Components</h1>
            <p className="text-sm text-slate-500">
              Set base pay and assign recurring or manually entered earnings and
              deductions for each employee.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.history.back()}
              className="btn-secondary"
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
                setSalaryComponents([]);
                setShowModal(true);
              }}
              className="btn-primary"
            >
              + Set Employee Salary
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
                  Base Pay
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
                        loadEmployeeComponents(r.employee_id);
                        setShowModal(true);
                      }}
                      className="text-brand hover:underline text-sm"
                    >
                      Edit Salary & Components
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
                    No employee salaries configured.
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
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold">Set Employee Salary & Components</h3>
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
                    onChange={(e) => {
                      const employeeId = e.target.value;
                      setSelectedEmp({
                        ...selectedEmp,
                        employee_id: employeeId,
                      });
                      loadEmployeeComponents(employeeId);
                    }}
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
                  <label className="label">Base Pay (GHS)</label>
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
                <section className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">
                        Employee Payroll Components
                      </h4>
                      <p className="text-xs text-slate-500">
                        Earnings and deductions support fixed amounts or
                        percentages of base salary/another component.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() =>
                        setSalaryComponents((current) => [
                          ...current,
                          newComponent(),
                        ])
                      }
                      disabled={!selectedEmp.employee_id}
                    >
                      + Add Component
                    </button>
                  </div>
                  {componentsLoading ? (
                    <p className="py-4 text-sm text-slate-500">
                      Loading employee components…
                    </p>
                  ) : salaryComponents.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm text-slate-500">
                      No employee-specific allowances or deductions configured.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {salaryComponents.map((component, index) => (
                        <div
                          key={component.client_key || component.id || index}
                          className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3"
                        >
                          <label className="md:col-span-4 text-xs font-medium">
                            Configured component
                            <select
                              className="input mt-1 w-full"
                              value={component.definition_id || ""}
                              onChange={(event) => {
                                const definition = componentDefinitions.find(
                                  (item) =>
                                    String(item.id) === event.target.value,
                                );
                                setSalaryComponents((current) =>
                                  current.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          definition_id: event.target.value,
                                          component_name:
                                            definition?.component_name || "",
                                          component_type:
                                            definition?.component_type ||
                                            "ALLOWANCE",
                                          manual_calculation: Boolean(
                                            Number(
                                              definition?.manual_calculation ||
                                                0,
                                            ),
                                          ),
                                          calculation_type:
                                            definition?.manual_calculation
                                              ? "AMOUNT"
                                              : item.calculation_type,
                                          value: definition?.manual_calculation
                                            ? "0"
                                            : item.value,
                                        }
                                      : item,
                                  ),
                                );
                              }}
                              required
                            >
                              <option value="">
                                Select configured component
                              </option>
                              {componentDefinitions
                                .filter(
                                  (definition) =>
                                    definition.is_active !== 0 &&
                                    definition.is_active !== false &&
                                    !Number(definition.manual_calculation),
                                )
                                .map((definition) => (
                                  <option
                                    key={definition.id}
                                    value={definition.id}
                                  >
                                    {definition.component_name} ·{" "}
                                    {definition.component_type === "ALLOWANCE"
                                      ? "Allowance"
                                      : "Deduction"}
                                  </option>
                                ))}
                            </select>
                            {component.component_name && (
                              <span className="mt-1 block text-slate-500">
                                Type:{" "}
                                {component.component_type === "ALLOWANCE"
                                  ? "Allowance / Earning"
                                  : "Deduction"}
                              </span>
                            )}
                          </label>
                          {component.manual_calculation ? (
                            <div className="md:col-span-6 self-center rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-200">
                              Amount is entered per employee and payroll period
                              on the Manual Payroll Components page.
                            </div>
                          ) : (
                            <>
                              <label className="md:col-span-2 text-xs font-medium">
                                Calculation
                                <select
                                  className="input mt-1 w-full"
                                  value={component.calculation_type}
                                  onChange={(event) =>
                                    setSalaryComponents((current) =>
                                      current.map((item, i) =>
                                        i === index
                                          ? {
                                              ...item,
                                              calculation_type:
                                                event.target.value,
                                              basis_component_ref: "BASIC",
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                >
                                  <option value="AMOUNT">Fixed amount</option>
                                  <option value="PERCENT">Percent</option>
                                </select>
                              </label>
                              <label className="md:col-span-2 text-xs font-medium">
                                {component.calculation_type === "PERCENT"
                                  ? "Rate (%)"
                                  : "Amount (GHS)"}
                                <input
                                  className="input mt-1 w-full"
                                  type="number"
                                  min="0"
                                  max={
                                    component.calculation_type === "PERCENT"
                                      ? "100"
                                      : undefined
                                  }
                                  step="0.01"
                                  value={component.value}
                                  onChange={(event) =>
                                    setSalaryComponents((current) =>
                                      current.map((item, i) =>
                                        i === index
                                          ? {
                                              ...item,
                                              value: event.target.value,
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  required
                                />
                              </label>
                              {component.calculation_type === "PERCENT" && (
                                <label className="md:col-span-3 text-xs font-medium">
                                  Percent of
                                  <select
                                    className="input mt-1 w-full"
                                    value={
                                      component.basis_component_ref || "BASIC"
                                    }
                                    onChange={(event) =>
                                      setSalaryComponents((current) =>
                                        current.map((item, i) =>
                                          i === index
                                            ? {
                                                ...item,
                                                basis_component_ref:
                                                  event.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                  >
                                    <option value="BASIC">Base Salary</option>
                                    {salaryComponents
                                      .filter(
                                        (basis, basisIndex) =>
                                          basisIndex !== index &&
                                          basis.component_name.trim() &&
                                          !basis.manual_calculation,
                                      )
                                      .map((basis) => (
                                        <option
                                          key={basis.client_key || basis.id}
                                          value={
                                            basis.id
                                              ? String(basis.id)
                                              : basis.client_key
                                          }
                                        >
                                          {basis.component_name}
                                        </option>
                                      ))}
                                  </select>
                                </label>
                              )}
                            </>
                          )}
                          <label className="md:col-span-3 text-xs font-medium">
                            Effective from
                            <input
                              className="input mt-1 w-full"
                              type="date"
                              value={component.effective_from}
                              onChange={(event) =>
                                setSalaryComponents((current) =>
                                  current.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          effective_from: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              required
                            />
                          </label>
                          <label className="md:col-span-3 text-xs font-medium">
                            Effective to (optional)
                            <input
                              className="input mt-1 w-full"
                              type="date"
                              value={component.effective_to || ""}
                              onChange={(event) =>
                                setSalaryComponents((current) =>
                                  current.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          effective_to: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </label>
                          <div className="md:col-span-2 flex items-end">
                            <button
                              type="button"
                              className="text-sm font-semibold text-rose-600 hover:text-rose-700"
                              onClick={() =>
                                setSalaryComponents((current) =>
                                  current.filter((_, i) => i !== index),
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                    disabled={componentsLoading}
                  >
                    Save Employee Salary & Components
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
