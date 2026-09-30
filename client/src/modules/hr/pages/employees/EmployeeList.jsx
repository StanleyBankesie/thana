/**
 * @fileoverview Employee listing page component.
 * Displays a data table of employees with search and creation capabilities.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import PageHeader from "../../../hr/components/PageHeader.jsx";
import DataTable from "../../../hr/components/DataTable.jsx";
import FormModal from "../../../hr/components/FormModal.jsx";
import StatusBadge from "../../../hr/components/StatusBadge.jsx";
import { hrService } from "../../../hr/services/hrService.js";

/**
 * EmployeeList component
 * Manages fetching, rendering, and adding new employees within the HR module.
 * 
 * @returns {JSX.Element} The employee list page.
 */
export default function EmployeeList() {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    emp_code: "",
    first_name: "",
    last_name: "",
    joining_date: "",
  });

  const load = async (q) => {
    setLoading(true);
    try {
      const res = await hrService.listEmployees(q ? { q } : undefined);
      setRows(res?.data?.items || []);
    } catch {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const save = async () => {
    try {
      await hrService.saveEmployee(form);
      toast.success("Employee saved");
      setOpen(false);
      load();
    } catch {
      toast.error("Failed to save employee");
    }
  };

  const columns = [
    { key: "emp_code", label: "Code" },
    { key: "full_name", label: "Name" },
    { key: "dept_name", label: "Department" },
    { key: "pos_name", label: "Position" },
    {
      key: "status",
      label: "Status",
      render: (v) => <StatusBadge value={v} />,
    },
    {
      key: "id",
      label: "Actions",
      render: (v, r) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-outline text-xs"
            onClick={() => navigate(`/hr/employees/${r.id}`)}
          >
            View
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4">
      <PageHeader
        title="Employees"
        onBack={() => navigate("/hr")}
        backLabel="Back to Menu"
      >
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          Add Employee
        </button>
      </PageHeader>
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onSearch={(q) => load(q)}
      />
      <FormModal
        open={open}
        title="New Employee"
        onClose={() => setOpen(false)}
        onSubmit={save}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Employee Code"
            value={form.emp_code}
            onChange={(e) => setForm((s) => ({ ...s, emp_code: e.target.value }))}
          />
          <input
            className="input"
            placeholder="First Name"
            value={form.first_name}
            onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Last Name"
            value={form.last_name}
            onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))}
          />
          <input
            className="input"
            type="date"
            placeholder="Joining Date"
            value={form.joining_date}
            onChange={(e) => setForm((s) => ({ ...s, joining_date: e.target.value }))}
          />
        </div>
      </FormModal>
    </div>
  );
}
