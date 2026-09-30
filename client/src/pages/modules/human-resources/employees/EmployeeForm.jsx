/**
 * @fileoverview EmployeeForm component.
 * Provides functionality for EmployeeForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { usePermission } from "@/auth/PermissionContext.jsx";
import { useGhanaCities } from "@/hooks/useGhanaCities";

const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
];

const WORLD_COUNTRIES = [
  "Ghana",
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Ivory Coast",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function EmployeeForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { cities: ghanaCities } = useGhanaCities();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    emp_code: "",
    first_name: "",
    last_name: "",
    middle_name: "",
    gender: "MALE",
    dob: "",
    joining_date: new Date().toISOString().split("T")[0],
    email: "",
    phone: "",
    dept_id: "",
    pos_id: "",
    manager_id: "",
    location_id: "",
    employment_type_id: "",
    category_id: "",
    status: "ACTIVE",
    address: "",
    picture_url: "",
    national_id: "",
    city: "",
    state: "",
    country: "Ghana",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    bank_name: "",
    bank_account_number: "",
    ssnit_number: "",
    tax_mappings: [],
    allowance_mappings: [],
  });
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [employeeCategories, setEmployeeCategories] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [countries, setCountries] = useState(WORLD_COUNTRIES);

  useEffect(() => {
    async function loadOptions() {
      const safeGet = async (url) => {
        try {
          const res = await api.get(url);
          return res.data?.items || res.data?.data?.items || res.data || [];
        } catch (err) {
          console.warn(`Failed to load ${url}`, err);
          return [];
        }
      };

      const [depts, adminDepts, pos, et, ec, tx, al, locs, emps] =
        await Promise.all([
          safeGet("/hr/departments"),
          safeGet("/admin/departments"),
          safeGet("/hr/positions"),
          safeGet("/hr/setup/employment-types"),
          safeGet("/hr/setup/employee-categories"),
          safeGet("/hr/tax-configs"),
          safeGet("/hr/allowances"),
          safeGet("/hr/setup/locations"),
          safeGet("/hr/employees?status=ALL"),
        ]);

      const combinedDepts = [];
      const seenDeptKeys = new Set();
      for (const d of [...adminDepts, ...depts]) {
        const dept_name = d.dept_name || d.name;
        const key = `${d.id}-${(dept_name || "").toLowerCase().trim()}`;
        if (dept_name && !seenDeptKeys.has(key)) {
          seenDeptKeys.add(key);
          combinedDepts.push({ ...d, dept_name });
        }
      }

      setDepartments(combinedDepts);
      setPositions(pos);
      setEmploymentTypes(et);
      setEmployeeCategories(ec);
      setTaxes(tx);
      setAllowances(al);
      setLocations(locs);
      setEmployees(emps);

      try {
        const res = await fetch(
          "https://restcountries.com/v3.1/all?fields=name",
        );
        const js = await res.json();
        const list = (js || [])
          .map((c) => c?.name?.common)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        if (list.length > 0) {
          setCountries(list);
        }
      } catch {
        setCountries(WORLD_COUNTRIES);
      }
    }
    loadOptions();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    fetchEmployee();
  }, [id]);

  async function fetchEmployee() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/hr/employees/${id}`);
      if (response.data?.item) {
        const item = response.data.item;
        setForm({
          ...item,
          dob: item.dob ? String(item.dob).slice(0, 10) : "",
          joining_date: item.joining_date ? String(item.joining_date).slice(0, 10) : "",
          city: item.city || "",
          state: item.state || "",
          country: item.country || "Ghana",
          tax_mappings: Array.isArray(item.tax_mappings) ? item.tax_mappings : [],
          allowance_mappings: Array.isArray(item.allowance_mappings) ? item.allowance_mappings : [],
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching employee");
    } finally {
      setLoading(false);
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "hr_employees_pics");

    setUploading(true);
    try {
      const res = await api.post("/upload", formData);
      update("picture_url", res.data.url);
      toast.success("Picture uploaded");
    } catch (err) {
      toast.error("Failed to upload picture");
    } finally {
      setUploading(false);
    }
  };

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  const handlePositionChange = (e) => {
    const newPosId = e.target.value;
    update("pos_id", newPosId);

    if (newPosId) {
      const position = positions.find((p) => p.id === Number(newPosId));
      if (position && position.reports_to_pos_id) {
        const manager = employees.find(
          (emp) =>
            emp.pos_id === position.reports_to_pos_id &&
            emp.status === "ACTIVE",
        );
        if (manager) {
          update("manager_id", manager.id);
        } else {
          update("manager_id", "");
        }
      } else {
        update("manager_id", "");
      }
    } else {
      update("manager_id", "");
    }
  };

  function toggleMapping(type, ids) {
    // ids may be a single number or an array (for grouped income-tax brackets)
    const idArr = Array.isArray(ids) ? ids : [ids];
    setForm((p) => {
      const current = p[type] || [];
      const allChecked = idArr.every((id) => current.includes(id));
      const next = allChecked
        ? current.filter((x) => !idArr.includes(x)) // uncheck all in group
        : [...new Set([...current, ...idArr])]; // check all in group
      return { ...p, [type]: next };
    });
  }

  function downloadTemplate() {
    try {
      const cols = buildTemplateColumns({
        employmentTypes,
        employeeCategories,
        taxes,
        allowances,
        positions,
        departments,
        locations,
      });
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
          status: r.status || "PROBATION",
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
    } catch (err) {
      toast.error(err?.response?.data?.message || "Bulk upload failed");
    } finally {
      e.target.value = "";
    }
  }

  // Build a deduplicated tax list:
  // INCOME_TAX rows with the same tax_name are collapsed into one entry;
  // all other tax types render individually.
  const displayTaxes = useMemo(() => {
    const seen = new Map(); // tax_name -> entry
    const result = [];
    for (const t of taxes) {
      if (t.tax_type === "INCOME_TAX") {
        const key = t.tax_name || "INCOME_TAX";
        if (seen.has(key)) {
          seen.get(key).groupIds.push(t.id);
        } else {
          const entry = { ...t, isGroup: true, groupIds: [t.id] };
          seen.set(key, entry);
          result.push(entry);
        }
      } else {
        result.push({ ...t, isGroup: false, groupIds: [t.id] });
      }
    }
    return result;
  }, [taxes]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/hr/employees", form);
      toast.success("Saved successfully");
      navigate("/human-resources/employees");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving employee");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-lg overflow-hidden flex items-center justify-center border-2 border-white/30">
                {form.picture_url ? (
                  <img
                    src={form.picture_url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold dark:text-brand-300">
                  {isEdit ? "Edit Employee" : "New Employee"}
                </h1>
                <p className="text-sm mt-1">Comprehensive employee record</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={downloadTemplate}
                >
                  Download Template
                </button>
                <label className="btn-secondary text-xs cursor-pointer">
                  Upload
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleBulkUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <button onClick={() => window.history.back()} className="btn-secondary">
                Back to List
              </button>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body">
            {error && <div className="alert alert-error mb-4">{error}</div>}

            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-6">
                <section>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">First Name *</label>
                      <input
                        className="input"
                        value={form.first_name || ""}
                        onChange={(e) => update("first_name", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Last Name *</label>
                      <input
                        className="input"
                        value={form.last_name || ""}
                        onChange={(e) => update("last_name", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Middle Name</label>
                      <input
                        className="input"
                        value={form.middle_name || ""}
                        onChange={(e) => update("middle_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Gender</label>
                      <select
                        className="input"
                        value={form.gender || ""}
                        onChange={(e) => update("gender", e.target.value)}
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Date of Birth</label>
                      <input
                        className="input"
                        type="date"
                        value={form.dob ? form.dob.slice(0, 10) : ""}
                        onChange={(e) => update("dob", e.target.value)}
                        disabled={
                          isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")
                        }
                      />
                    </div>
                    <div>
                      <label className="label">National ID</label>
                      <input
                        className="input"
                        value={form.national_id || ""}
                        onChange={(e) => update("national_id", e.target.value)}
                        placeholder="Identity card number"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">
                    Contact Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Email</label>
                      <input
                        className="input"
                        type="email"
                        value={form.email || ""}
                        onChange={(e) => update("email", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Phone</label>
                      <input
                        className="input"
                        value={form.phone || ""}
                        onChange={(e) => update("phone", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Address</label>
                      <input
                        className="input"
                        value={form.address || ""}
                        onChange={(e) => update("address", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Country</label>
                      <select
                        className="input w-64"
                        value={form.country || "Ghana"}
                        onChange={(e) => update("country", e.target.value)}
                      >
                        <option value="">Select Country</option>
                        {countries.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">City</label>
                      <input
                        className="input"
                        list="city-suggestions"
                        value={form.city || ""}
                        onChange={(e) => update("city", e.target.value)}
                        placeholder="Select or enter City"
                      />
                      <datalist id="city-suggestions">
                        {ghanaCities.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="label">State / Region / Province</label>
                      <input
                        className="input"
                        list="state-suggestions"
                        value={form.state || ""}
                        onChange={(e) => update("state", e.target.value)}
                        placeholder="Select or enter State / Region / Province"
                      />
                      <datalist id="state-suggestions">
                        {GHANA_REGIONS.map((r) => (
                          <option key={r} value={r} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="label">Emergency Contact Name</label>
                      <input
                        className="input"
                        value={form.emergency_contact_name || ""}
                        onChange={(e) =>
                          update("emergency_contact_name", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Emergency Contact Phone</label>
                      <input
                        className="input"
                        value={form.emergency_contact_phone || ""}
                        onChange={(e) =>
                          update("emergency_contact_phone", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Bank Name</label>
                      <input
                        className="input"
                        value={form.bank_name || ""}
                        onChange={(e) => update("bank_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Bank Account Number</label>
                      <input
                        className="input"
                        value={form.bank_account_number || ""}
                        onChange={(e) =>
                          update("bank_account_number", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="label">SSNIT Number</label>
                      <input
                        className="input"
                        value={form.ssnit_number || ""}
                        onChange={(e) => update("ssnit_number", e.target.value)}
                      />
                    </div>
                  </div>
                </section>
              </div>

              <div className="w-full md:w-64 space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
                  <div className="w-32 h-32 mx-auto bg-white dark:bg-slate-900 rounded shadow-inner mb-3 flex items-center justify-center overflow-hidden">
                    {form.picture_url ? (
                      <img
                        src={form.picture_url}
                        alt="Passport"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl">📷</span>
                    )}
                  </div>
                  <label className="btn-secondary text-xs cursor-pointer block w-full">
                    {uploading ? "Uploading..." : "Upload Passport Pic"}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-4 border-b pb-2 mt-8">
              Employment Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="label">Employee Code *</label>
                <input
                  className="input"
                  value={form.emp_code || ""}
                  onChange={(e) => update("emp_code", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Department</label>
                <select
                  className="input"
                  value={form.dept_id || ""}
                  onChange={(e) => update("dept_id", e.target.value)}
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.dept_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Position</label>
                <select
                  className="input"
                  value={form.pos_id || ""}
                  onChange={handlePositionChange}
                >
                  <option value="">Select Position</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.pos_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Employee Category</label>
                <select
                  className="input"
                  value={form.category_id || ""}
                  onChange={(e) => update("category_id", e.target.value)}
                >
                  <option value="">Select Category</option>
                  {employeeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Employment Type</label>
                <select
                  className="input"
                  value={form.employment_type_id || ""}
                  onChange={(e) => update("employment_type_id", e.target.value)}
                >
                  <option value="">Select Type</option>
                  {employmentTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Joining Date *</label>
                <input
                  className="input"
                  type="date"
                  value={
                    form.joining_date ? form.joining_date.slice(0, 10) : ""
                  }
                  onChange={(e) => update("joining_date", e.target.value)}
                  required
                  disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="label">Location</label>
                <select
                  className="input"
                  value={form.location_id || ""}
                  onChange={(e) => update("location_id", e.target.value)}
                >
                  <option value="">Select Location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.location_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Manager</label>
                <select
                  className="input"
                  value={form.manager_id || ""}
                  onChange={(e) => update("manager_id", e.target.value)}
                >
                  <option value="">Select Manager</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              <section className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-4 border-b pb-2 flex items-center justify-between">
                  Statutory Deductions & Taxes
                  {/* <span className="text-[10px] uppercase font-bold text-brand">Affects Payslip</span> */}
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {displayTaxes.map((t) => {
                    const isChecked = t.groupIds.some((id) =>
                      (form.tax_mappings || []).includes(id),
                    );
                    return (
                      <label
                        key={t.isGroup ? `group-${t.tax_name}` : t.id}
                        className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            toggleMapping("tax_mappings", t.groupIds)
                          }
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {t.tax_name}
                          </div>
                          {/* <div className="text-xs text-slate-500">
                            {t.tax_type === "INCOME_TAX" ? "PAYE" : t.tax_type}
                            {t.isGroup && t.groupIds.length > 1
                              ? ` — ${t.groupIds.length} brackets`
                              : ` — ${t.tax_rate}%`
                            }
                          </div> */}
                        </div>
                        {t.isGroup && t.groupIds.length > 1 && (
                          <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                            {t.groupIds.length} brackets
                          </span>
                        )}
                      </label>
                    );
                  })}
                  {displayTaxes.length === 0 && (
                    <p className="text-xs text-slate-400">
                      No tax configurations set.
                    </p>
                  )}
                </div>
              </section>

              <section className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-4 border-b pb-2 flex items-center justify-between">
                  Employee Allowances
                  {/* <span className="text-[10px] uppercase font-bold text-brand">Affects Payslip</span> */}
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {allowances.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={form.allowance_mappings.includes(a.id)}
                        onChange={() =>
                          toggleMapping("allowance_mappings", a.id)
                        }
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {a.allowance_name}
                        </div>
                        {/* <div className="text-xs text-slate-500">{a.allowance_code} - {a.amount_type === 'FIXED' ? 'GHS' : ''} {a.amount}{a.amount_type === 'PERCENTAGE' ? '%' : ''}</div> */}
                      </div>
                    </label>
                  ))}
                  {allowances.length === 0 && (
                    <p className="text-xs text-slate-400">
                      No allowances defined.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t pt-4 mt-8">
              <button onClick={() => window.history.back()} className="btn-secondary">
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Employee record"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function normalizeBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "y", "x"].includes(s);
}

function buildTemplateColumns({
  employmentTypes,
  employeeCategories,
  taxes,
  allowances,
  positions,
  departments,
  locations,
}) {
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
  return [...baseCols, ...taxCols, ...allowanceCols];
}
