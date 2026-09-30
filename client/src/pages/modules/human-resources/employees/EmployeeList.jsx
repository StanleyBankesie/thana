/**
 * @fileoverview EmployeeList component.
 * Provides functionality for EmployeeList.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

function normalizeBool(val) {
  if (!val) return false;
  if (typeof val === "boolean") return val;
  const s = String(val).trim().toLowerCase();
  return ["1", "true", "yes", "y", "x"].includes(s);
}

export default function EmployeeList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const { canPerformAction } = usePermission();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [employeeCategories, setEmployeeCategories] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    fetchEmployees();
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const safeGet = (url) => api.get(url).catch(() => ({ data: {} }));
      const [deptRes, posRes, etRes, catRes, taxRes, allowRes, locRes] =
        await Promise.all([
          safeGet("/hr/setup/departments"),
          safeGet("/hr/setup/positions"),
          safeGet("/hr/setup/employment-types"),
          safeGet("/hr/setup/employee-categories"),
          safeGet("/hr/taxes"),
          safeGet("/hr/setup/allowance-types"),
          safeGet("/hr/setup/locations"),
        ]);

      setDepartments(deptRes.data?.items || []);
      setPositions(posRes.data?.items || []);
      setEmploymentTypes(etRes.data?.items || []);
      setEmployeeCategories(catRes.data?.items || []);
      setTaxes(taxRes.data?.items || []);
      setAllowances(allowRes.data?.items || []);
      setLocations(locRes.data?.items || []);
    } catch (e) {
      console.error("Error loading options:", e);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/hr/employees");
      setEmployees(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching employees");
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  function downloadTemplate() {
    try {
      const baseCols = [
        "emp_code",
        "first_name",
        "last_name",
        "middle_name",
        "gender",
        "dob",
        "joining_date",
        "email",
        "phone",
        "department",
        "position",
        "manager_emp_code",
        "employment_type",
        "employment_type_id",
        "category",
        "category_id",
        "location",
        "location_id",
        "status",
        "base_salary",
        "address",
        "picture_url",
        "national_id",
      ];
      const taxCols = (taxes || []).map((t) => t.tax_name).filter(Boolean);
      const allowanceCols = (allowances || [])
        .map((a) => a.allowance_name)
        .filter(Boolean);
      const cols = [...baseCols, ...taxCols, ...allowanceCols];

      const ws = XLSX.utils.aoa_to_sheet([cols]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Employees");
      XLSX.writeFile(wb, "employee_upload_template.xlsx");
      toast.success("Template downloaded");
    } catch (err) {
      toast.error("Failed to generate template");
    }
  }

  async function handleBulkUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rows.length) {
        toast.error("Template is empty");
        return;
      }
      const deptByName = new Map(departments.map((d) => [d.dept_name, d.id]));
      const posByName = new Map(positions.map((p) => [p.pos_name, p.id]));
      const locByName = new Map(locations.map((l) => [l.location_name, l.id]));
      const etByName = new Map(employmentTypes.map((t) => [t.name, t.id]));
      const catByName = new Map(employeeCategories.map((c) => [c.name, c.id]));
      const taxByName = new Map(taxes.map((t) => [t.tax_name, t.id]));
      const allowanceByName = new Map(
        allowances.map((a) => [a.allowance_name, a.id]),
      );

      const payload = rows.map((r) => {
        const tax_mappings = [];
        const allowance_mappings = [];
        for (const [name, id] of taxByName.entries()) {
          if (normalizeBool(r[name])) tax_mappings.push(id);
        }
        for (const [name, id] of allowanceByName.entries()) {
          if (normalizeBool(r[name])) allowance_mappings.push(id);
        }
        const dept_id = r.department
          ? deptByName.get(String(r.department).trim()) || null
          : r.dept_id || null;
        const pos_id = r.position
          ? posByName.get(String(r.position).trim()) || null
          : r.pos_id || null;
        const location_id = r.location
          ? locByName.get(String(r.location).trim()) || null
          : r.location_id || null;
        const employment_type_id = r.employment_type
          ? etByName.get(String(r.employment_type).trim()) || null
          : r.employment_type_id || null;
        const category_id = r.category
          ? catByName.get(String(r.category).trim()) || null
          : r.category_id || null;
        return {
          emp_code: r.emp_code,
          first_name: r.first_name,
          last_name: r.last_name,
          middle_name: r.middle_name || null,
          gender: r.gender || null,
          dob: r.dob || null,
          joining_date: r.joining_date,
          email: r.email || null,
          phone: r.phone || null,
          dept_id,
          pos_id,
          manager_emp_code: r.manager_emp_code || null,
          location_id,
          employment_type: r.employment_type || null,
          employment_type_id,
          category_id,
          status: "ACTIVE",
          base_salary: r.base_salary || 0,
          address: r.address || null,
          picture_url: r.picture_url || null,
          national_id: r.national_id || null,
          tax_mappings,
          allowance_mappings,
        };
      });

      await api.post("/hr/employees/bulk", { items: payload });
      toast.success("Bulk upload processed");
      fetchEmployees();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Bulk upload failed");
    } finally {
      e.target.value = "";
    }
  }

  const getStatusBadge = (isActive) => {
    return isActive ? (
      <span className="badge badge-success">ACTIVE</span>
    ) : (
      <span className="badge badge-error">INACTIVE</span>
    );
  };

  const getEmploymentTypeBadge = (type) => {
    const typeClasses = {
      PERMANENT: "badge badge-success",
      CONTRACT: "badge badge-info",
      TEMPORARY: "badge badge-warning",
      INTERN:
        "badge bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
    };
    return <span className={typeClasses[type] || "badge"}>{type}</span>;
  };

  const filteredEmployees = (() => {
    const base = employees.filter((emp) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? emp.is_active : !emp.is_active);
      const matchesDepartment =
        departmentFilter === "ALL" || emp.department === departmentFilter;
      return matchesStatus && matchesDepartment;
    });
    if (!searchTerm.trim()) return base;
    return filterAndSort(base, {
      query: searchTerm,
      getKeys: (emp) => [emp.emp_code, emp.full_name, emp.email],
    });
  })();

  const departmentList = [
    "ALL",
    ...new Set(employees.map((emp) => emp.dept_name).filter(Boolean)),
  ];

  if (loading) {
    return <div className="text-center py-8">Loading employees...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Employee Setup
              </h1>
              <p className="text-sm mt-1">
                Manage employee records and information
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white rounded-md shadow-sm hover:bg-slate-50 transition-colors"
                onClick={downloadTemplate}
              >
                Download Template
              </button>
              <label className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white rounded-md shadow-sm hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center">
                Upload
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBulkUpload}
                  className="hidden"
                />
              </label>
              <Link to="/human-resources?section=Employee%20Management" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/human-resources/employees/new" className="btn-success">
                + New Employee
              </Link>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by employee code, name, or email..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <select
                className="input"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                {departmentList.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === "ALL" ? "All Departments" : dept}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-48">
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading employees...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">
                No employees found.
              </p>
            </div>
          ) : (
            
                <>
<div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
              <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Photo</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Code</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Position</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Department</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created By</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created Date</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Attachments</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                          {emp.picture_url ? (
                            <img src={emp.picture_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">👤</div>
                          )}
                        </div>
                      </td>
                      <td className="font-medium">{emp.emp_code}</td>
                      <td>
                        <div>
                          <div className="font-medium">{emp.full_name}</div>
                          <div className="text-[10px] text-slate-500">{emp.email}</div>
                        </div>
                      </td>
                      <td>{emp.pos_name}</td>
                      <td>{emp.dept_name}</td>
                      <td>{getEmploymentTypeBadge(emp.employment_type_name || emp.employment_type)}</td>
                      <td>{getStatusBadge(emp.is_active)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Slot 1: View */}
                          <div className="min-w-[80px]">
                            <button
                              type="button"
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                              onClick={() => navigate(`/human-resources/employees/${emp.id}`)}
                            >
                              View
                            </button>
                          </div>

                          {/* Slot 2: Edit */}
                          <div className="min-w-[80px]">
                            {canPerformAction("human-resources:employees", "edit") ? (
                              <button
                                type="button"
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                                onClick={() => navigate(`/human-resources/employees/${emp.id}`)}
                              >
                                Edit
                              </button>
                            ) : (
                              <div className="w-full h-9" />
                            )}
                          </div>

                          {/* Slot 3 & 4 & 5 & 6 & 7: Blank */}
                          <div className="min-w-[80px]">
                            <div className="w-full h-9" />
                          </div>
                          <div className="min-w-[80px]">
                            <div className="w-full h-9" />
                          </div>
                          <div className="min-w-[80px]">
                            <div className="w-full h-9" />
                          </div>
                          <div className="min-w-[160px]">
                            <div className="w-full h-9" />
                          </div>
                          <div className="min-w-[80px]">
                            <div className="w-full h-9" />
                          </div>
                        </div>
                      </td>
                      <td>{emp.created_by_username || emp.created_by_name || "-"}</td>
                      <td>{emp.created_at ? new Date(emp.created_at).toLocaleDateString() : "-"}</td>
                      <td>
                        <button
                          type="button"
                          className="text-brand hover:underline font-medium text-sm"
                          onClick={() => {
                            toast.info("Attachments functionality coming soon");
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          
</>
)}
        </div>
      </div>
    </div>
  );
}
