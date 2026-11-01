import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { filterByPrefix } from "@/utils/searchUtils.js";

const amountFormat = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function ManualPayrollComponents() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [periodItems, setPeriodItems] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [selectedDefinitionId, setSelectedDefinitionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  const handleLinkComponent = (defId, empId) => {
    if (!defId || !empId) return;
    setItems((current) =>
      current.map((item) =>
        String(item.employee_id) === String(empId) &&
        String(item.definition_id) === String(defId)
          ? { ...item, is_selected: 1 }
          : item,
      ),
    );
    setSelectedEmployeeId("");
    setEmployeeSearchQuery("");
    setShowEmployeeDropdown(false);
  };

  const handleSelectEmployee = (emp, currentDefId = selectedDefinitionId) => {
    const empId = String(emp.id || emp.employee_id);
    setSelectedEmployeeId(empId);
    setEmployeeSearchQuery(
      `${emp.emp_code ? `${emp.emp_code} - ` : ""}${emp.first_name} ${emp.last_name}`,
    );
    setShowEmployeeDropdown(false);
    if (currentDefId) {
      handleLinkComponent(currentDefId, empId);
    }
  };

  const handleSelectDefinition = (defId, currentEmpId = selectedEmployeeId) => {
    setSelectedDefinitionId(defId);
    if (defId && currentEmpId) {
      handleLinkComponent(defId, currentEmpId);
    }
  };

  // Close employee search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    api
      .get("/hr/payroll/periods")
      .then((response) => {
        const list = response.data?.items || [];
        setPeriods(list);
        if (list.length > 0) {
          const years = list
            .map((p) => {
              if (p.start_date) {
                const y = new Date(p.start_date).getFullYear();
                if (!isNaN(y)) return y;
              }
              const m = p.period_name?.match(/\b(20\d\d)\b/);
              return m ? Number(m[1]) : null;
            })
            .filter(Boolean);
          const currentYear = new Date().getFullYear();
          if (!years.includes(currentYear) && years.length > 0) {
            setSelectedYear(String(Math.max(...years)));
          }
        }
      })
      .catch(() => toast.error("Failed to load payroll periods"));
  }, []);

  const loadPeriodValues = useCallback(async (selectedPeriod) => {
    if (!selectedPeriod) {
      setItems([]);
      setPeriodItems([]);
      setSelectedEmployeeId("");
      setEmployeeSearchQuery("");
      setSelectedDefinitionId("");
      return;
    }
    setLoading(true);
    try {
      const response = await api.get(
        `/hr/payroll/manual-components?period_id=${selectedPeriod}`,
      );
      setPeriodItems(response.data?.period ? [response.data.period] : []);
      setItems(
        (response.data?.items || []).map((item) => ({
          ...item,
          amount: Number(item.amount || 0).toFixed(2),
        })),
      );
    } catch (error) {
      setItems([]);
      setPeriodItems([]);
      toast.error(
        error?.response?.data?.message ||
          "Failed to load monthly component entries",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const save = async (event) => {
    event.preventDefault();
    if (!periodId) return toast.error("Select a payroll period first");
    setSaving(true);
    try {
      await api.put("/hr/payroll/manual-components", {
        period_id: Number(periodId),
        selections: items.map((item) => ({
          employee_id: Number(item.employee_id),
          definition_id: Number(item.definition_id),
          is_selected: Boolean(Number(item.is_selected)),
        })),
        items: items
          .filter((item) => Number(item.is_selected))
          .map((item) => ({
            employee_id: Number(item.employee_id),
            definition_id: Number(item.definition_id),
            amount: Number(item.amount || 0),
          })),
      });
      toast.success("Monthly employee component amounts saved");
      await loadPeriodValues(periodId);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to save monthly amounts",
      );
    } finally {
      setSaving(false);
    }
  };

  const currentYearNum = new Date().getFullYear();
  const availableYears = Array.from(
    new Set([
      currentYearNum,
      ...periods
        .map((p) => {
          if (p.start_date) {
            const y = new Date(p.start_date).getFullYear();
            if (!isNaN(y)) return y;
          }
          const m = p.period_name?.match(/\b(20\d\d)\b/);
          return m ? Number(m[1]) : null;
        })
        .filter(Boolean),
    ])
  ).sort((a, b) => b - a);

  const filteredPeriods = periods.filter((item) => {
    if (!selectedYear) return true;
    if (item.start_date) {
      const y = new Date(item.start_date).getFullYear();
      if (!isNaN(y)) return String(y) === String(selectedYear);
    }
    const match = item.period_name?.match(/\b(20\d\d)\b/);
    if (match) return String(match[1]) === String(selectedYear);
    return true;
  });

  const period =
    periodItems[0] ||
    periods.find((item) => String(item.id) === String(periodId));
  const isClosed = period?.status === "CLOSED";
  const displayedLinkedItems = selectedDefinitionId
    ? items.filter(
        (item) =>
          Number(item.is_selected) &&
          String(item.definition_id) === String(selectedDefinitionId),
      )
    : [];
  const eligibleEmployees = Array.from(
    new Map(
      items
        .filter(
          (item) =>
            !selectedDefinitionId ||
            String(item.definition_id) === String(selectedDefinitionId),
        )
        .map((item) => [String(item.employee_id), item]),
    ).values(),
  );
  const definitions = Array.from(
    new Map(items.map((item) => [String(item.definition_id), item])).values(),
  );

  return (
    <Guard moduleKey="human-resources">
      <div className="space-y-5 p-4">
        <header>
          <Link
            to="/human-resources"
            className="btn-secondary mb-3 inline-flex items-center gap-2"
          >
            ← Back to HR
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Manual Payroll Components
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Enter this month’s employee-specific allowances and deductions.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Payroll Year
              </label>
              <select
                className="input mt-1 w-full"
                value={selectedYear}
                onChange={(event) => {
                  const newYear = event.target.value;
                  setSelectedYear(newYear);
                  if (periodId) {
                    const matched = periods.find((p) => String(p.id) === String(periodId));
                    let periodYear = null;
                    if (matched?.start_date) {
                      periodYear = new Date(matched.start_date).getFullYear();
                    } else {
                      const m = matched?.period_name?.match(/\b(20\d\d)\b/);
                      periodYear = m ? Number(m[1]) : null;
                    }
                    if (periodYear && String(periodYear) !== String(newYear)) {
                      setPeriodId("");
                      loadPeriodValues("");
                    }
                  }
                }}
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Payroll Period ({selectedYear})
              </label>
              <select
                className="input mt-1 w-full"
                value={periodId}
                onChange={(event) => {
                  setPeriodId(event.target.value);
                  loadPeriodValues(event.target.value);
                }}
              >
                <option value="">Select a payroll period for {selectedYear}</option>
                {filteredPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.period_name}
                    {item.status === "CLOSED" ? " · Closed" : ""}
                  </option>
                ))}
              </select>
              {filteredPeriods.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  No payroll periods found for year {selectedYear}.
                </p>
              )}
            </div>
          </div>
        </section>

        {periodId && (
          <form
            onSubmit={save}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  Employee amounts
                </h2>
                <p className="text-xs text-slate-500">
                  Only active employees assigned to manual components appear
                  here.
                </p>
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={
                  saving ||
                  loading ||
                  isClosed ||
                  !selectedDefinitionId ||
                  displayedLinkedItems.length === 0
                }
              >
                {saving ? "Saving…" : "Save Monthly Amounts"}
              </button>
            </div>
            <div className="grid grid-cols-1 items-end gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-700">
              <label className="text-sm font-medium">
                Component
                <select
                  className="input mt-1 w-full"
                  value={selectedDefinitionId}
                  disabled={loading || isClosed}
                  onChange={(event) =>
                    handleSelectDefinition(event.target.value)
                  }
                >
                  <option value="">Select manual component</option>
                  {definitions.map((item) => (
                    <option key={item.definition_id} value={item.definition_id}>
                      {item.component_name} ·{" "}
                      {item.component_type === "ALLOWANCE"
                        ? "Allowance"
                        : "Deduction"}
                    </option>
                  ))}
                </select>
              </label>

              <div ref={searchContainerRef} className="text-sm font-medium">
                <label
                  htmlFor="manual-payroll-employee-search"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Employee
                </label>
                <div className="relative mt-1">
                  <input
                    id="manual-payroll-employee-search"
                    autoComplete="off"
                    className="input w-full text-xs"
                    placeholder={
                      selectedDefinitionId
                        ? "Search by code or employee name"
                        : "Select a component first"
                    }
                    value={employeeSearchQuery}
                    disabled={loading || isClosed || !selectedDefinitionId}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    onClick={() => setShowEmployeeDropdown(true)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmployeeSearchQuery(val);
                      setShowEmployeeDropdown(true);
                      if (selectedEmployeeId) {
                        setSelectedEmployeeId("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const query = (employeeSearchQuery || "").trim();
                        const searchResults = query
                          ? filterByPrefix(eligibleEmployees, {
                              query,
                              searchFields: ["emp_code", "first_name", "last_name"],
                            })
                          : [];
                        if (!query || !searchResults.length) return;
                        handleSelectEmployee(searchResults[0]);
                      }
                    }}
                  />
                  {(() => {
                    const query = (employeeSearchQuery || "").trim();
                    const searchResults = query
                      ? filterByPrefix(eligibleEmployees, {
                          query,
                          searchFields: ["emp_code", "first_name", "last_name"],
                        })
                      : [];
                    return showEmployeeDropdown &&
                      searchResults.length &&
                      !selectedEmployeeId ? (
                      <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-48 overflow-auto dark:border-slate-700 dark:bg-slate-800">
                        {searchResults.map((emp) => (
                          <button
                            type="button"
                            key={emp.employee_id}
                            className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs dark:hover:bg-slate-700"
                            onClick={() => handleSelectEmployee(emp)}
                          >
                            <span className="font-mono text-slate-500 mr-2 dark:text-slate-400">
                              {emp.emp_code}
                            </span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {emp.first_name} {emp.last_name}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
            {isClosed && (
              <div className="p-4 text-sm text-amber-700 dark:text-amber-300">
                This payroll period is closed; amounts are read-only.
              </div>
            )}
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Loading component assignments…
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No manual components are assigned for this payroll period.
                Configure manual components in HR Setup, then assign them under
                Employee Salary Components.
              </div>
            ) : !selectedDefinitionId ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Please select a manual component above to view and enter employee amounts.
              </div>
            ) : displayedLinkedItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No employees are assigned or linked to this component for this payroll period yet. Search and select an employee above to add them.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Component</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {displayedLinkedItems.map((item) => {
                      const index = items.findIndex(
                        (row) =>
                          row.employee_id === item.employee_id &&
                          row.definition_id === item.definition_id,
                      );
                      return (
                        <tr key={`${item.employee_id}-${item.definition_id}`}>
                          <td className="px-4 py-3 font-medium">
                            {item.first_name} {item.last_name}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {item.emp_code}
                          </td>
                          <td className="px-4 py-3">{item.component_name}</td>
                          <td className="px-4 py-3">
                            {item.component_type === "ALLOWANCE"
                              ? "Allowance"
                              : "Deduction"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              className="mr-3 text-xs font-semibold text-rose-600 hover:underline"
                              disabled={saving || isClosed}
                              onClick={() =>
                                setItems((current) =>
                                  current.map((row) =>
                                    row.employee_id === item.employee_id &&
                                    row.definition_id === item.definition_id
                                      ? { ...row, is_selected: 0 }
                                      : row,
                                  ),
                                )
                              }
                            >
                              Unlink
                            </button>
                            <input
                              aria-label={`${item.component_name} amount for ${item.first_name} ${item.last_name}`}
                              className="input ml-auto max-w-48 text-right font-mono"
                              type="text"
                              inputMode="decimal"
                              value={item.amount}
                              disabled={saving || isClosed}
                              onFocus={(e) => {
                                const target = e.target;
                                setTimeout(() => {
                                  const val = target.value || "";
                                  const dotIndex = val.indexOf(".");
                                  if (dotIndex > 0) {
                                    target.setSelectionRange(0, dotIndex);
                                  } else {
                                    target.select();
                                  }
                                }, 50);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "." || e.key === ",") {
                                  const dotIndex = e.target.value.indexOf(".");
                                  if (dotIndex !== -1 && e.target.selectionStart <= dotIndex) {
                                    e.preventDefault();
                                    e.target.setSelectionRange(dotIndex + 1, dotIndex + 1);
                                  }
                                }
                              }}
                              onChange={(event) => {
                                let val = event.target.value;
                                if (/^0\d/.test(val)) {
                                  val = val.replace(/^0+(?=\d)/, "");
                                }
                                if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                  setItems((current) =>
                                    current.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? { ...row, amount: val }
                                        : row,
                                    ),
                                  );
                                }
                              }}
                              onBlur={(event) => {
                                const num = parseFloat(event.target.value);
                                const formatted = isNaN(num) ? "0.00" : num.toFixed(2);
                                setItems((current) =>
                                  current.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? { ...row, amount: formatted }
                                      : row,
                                  ),
                                );
                              }}
                            />
                            <span className="sr-only">
                              Current amount {amountFormat(item.amount)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </form>
        )}
      </div>
    </Guard>
  );
}
