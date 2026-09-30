/**
 * @fileoverview PayslipList component.
 * Provides functionality for PayslipList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { renderHtmlToPdf } from "../../../../utils/pdfUtils.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PayslipList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    logoUrl: "",
  });

  // Filters
  const [periods, setPeriods] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filterPeriod, setFilterPeriod] = useState("");
  const [filterEmp, setFilterEmp] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterBranch, setFilterBranch] = useState("");

  const [expandedLoans, setExpandedLoans] = useState({});
  const [sendingEmailId, setSendingEmailId] = useState(null); // tracks which row is sending
  const [emailProgress, setEmailProgress] = useState(0); // countdown seconds elapsed

  // Template Modal State
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [actionType, setActionType] = useState(null); // 'PRINT' or 'PDF'

  const fmt = (n) =>
    Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const loadData = async () => {
    try {
      api.get("/hr/payroll/periods").then(r => setPeriods(r.data?.items || [])).catch(() => {});
      api.get("/admin/departments").then(r => setDepartments(r.data?.items || [])).catch(() => {});
      api.get("/admin/branches").then(r => setBranches(r.data?.items || [])).catch(() => {});
    } catch {}
  };

  const loadPayslips = async () => {
    setLoading(true);
    try {
      const params = {
        period_id: filterPeriod,
        employee_query: filterEmp,
        dept_id: filterDept,
        branch_id: filterBranch,
      };
      const res = await api.get("/hr/payslips", { params });
      setItems(res?.data?.items || []);
    } catch {
      toast.error("Failed to load payslips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadPayslips();
  }, [filterPeriod, filterDept, filterBranch]);

  const sendBulkEmails = async () => {
    if (!items.length) return;
    if (!window.confirm(`Send emails to ${items.length} employees?`)) return;

    setSendingBulk(true);
    try {
      const ids = items.map((it) => it.id);
      await api.post("/hr/payslips/send-email-bulk", { payslipIds: ids });
      toast.success("Bulk emails initiated");
    } catch (err) {
      toast.error("Failed to send bulk emails");
    } finally {
      setSendingBulk(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadCompany() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        const logoUrl =
          item.has_logo === 1 || item.has_logo === true
            ? `/api/admin/companies/${companyId}/logo`
            : "";
        if (!mounted) return;
        setCompanyInfo({
          name: String(item.name || "Company"),
          address: String(item.address || ""),
          logoUrl: String(logoUrl || ""),
        });
      } catch (err) {
        console.error("Error loading company:", err);
      }
    }
    loadCompany();
    return () => {
      mounted = false;
    };
  }, []);

  const sendEmail = async (r) => {
    if (sendingEmailId) return; // prevent double-clicks
    setSendingEmailId(r.id);
    setEmailProgress(0);

    const ESTIMATED_SECONDS = 25;
    const toastId = toast.loading(
      `📧 Sending payslip to ${r.email}... Estimated time: ~${ESTIMATED_SECONDS}s`,
      { autoClose: false },
    );

    // Start a countdown timer
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 1;
      setEmailProgress(elapsed);
      const remaining = Math.max(ESTIMATED_SECONDS - elapsed, 0);
      toast.update(toastId, {
        render: `📧 Generating PDF & sending email to ${r.email}...\n⏱ ${elapsed}s elapsed ${remaining > 0 ? `(~${remaining}s remaining)` : "(almost done...)"}`,
        isLoading: true,
      });
    }, 1000);

    try {
      await api.post("/hr/payslips/send-email", { payslipId: r.id });
      clearInterval(timer);
      toast.update(toastId, {
        render: `✅ Payslip successfully sent to ${r.email} (${elapsed}s)`,
        type: "success",
        isLoading: false,
        autoClose: 4000,
      });
    } catch (err) {
      clearInterval(timer);
      toast.update(toastId, {
        render: `❌ ${err.response?.data?.message || "Failed to send email"}`,
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    } finally {
      setSendingEmailId(null);
      setEmailProgress(0);
    }
  };

  const handleActionClick = (r, type) => {
    setSelectedRecord(r);
    setActionType(type);
    executeAction(r, type);
  };

  const executeAction = async (r, type) => {
    try {
      setLoading(true);
      let templateId = null;
      try {
        const tRes = await api.get("/templates/salary-slip", {
          params: { name: "Salary Slip" },
        });
        const tItems = Array.isArray(tRes.data?.items) ? tRes.data.items : [];
        templateId = Number(tItems?.[0]?.id || 0) || null;
      } catch {}
      const res = await api.post(
        `/documents/salary-slip/${r.id}/render`,
        { format: "html", feature_name: "salary-slip", payload_data: r, ...(templateId ? { template_id: templateId } : {}) },
        { headers: { "Content-Type": "application/json" } },
      );
      const html =
        typeof res.data === "string" ? res.data : String(res.data || "");

      if (type === "PRINT") {
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);
        const doc =
          iframe.contentWindow?.document || iframe.contentDocument || null;
        if (!doc) {
          document.body.removeChild(iframe);
          return;
        }
        const printStyle = `<style>@media print { img, svg { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }</style>`;
        doc.open();
        doc.write(printStyle + html);
        doc.close();
        const win = iframe.contentWindow || window;
        const handlePrint = () => {
          win.focus();
          try {
            win.print();
          } catch {}
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 100);
        };
        setTimeout(handlePrint, 200);
      } else {
        const fname =
          "payslip-" +
          (String(r.period_name || "").replace(/\s+/g, "_") ||
            new Date().toISOString().slice(0, 10)) +
          "-" +
          (r.emp_code || r.id) +
          ".pdf";
        await renderHtmlToPdf(html, fname);
      }
    } catch (e) {
      toast.error(
        e?.response?.data?.message || `Failed to ${type.toLowerCase()} payslip`,
      );
    } finally {
      setSelectedRecord(null);
      setActionType(null);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Payslips
              </h1>
              <p className="text-sm mt-1">
                View and manage employee salary slips
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn btn-secondary">
                Back to Menu
              </button>
              <button
                onClick={sendBulkEmails}
                disabled={sendingBulk || !items.length}
                className="btn btn-success"
              >
                {sendingBulk ? "Sending..." : "📧 Bulk Email"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Period
              </label>
              <select
                className="input h-9 text-sm"
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
              >
                <option value="">All Periods</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Search Employee
              </label>
              <input
                className="input h-9 text-sm"
                placeholder="Name or Code..."
                value={filterEmp}
                onChange={(e) => setFilterEmp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadPayslips()}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Department
              </label>
              <select
                className="input h-9 text-sm"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
              >
                <option value="">All</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dept_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Location
              </label>
              <select
                className="input h-9 text-sm"
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
              >
                <option value="">All</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branch_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadPayslips}
                className="btn btn-secondary h-9 w-full"
              >
                Search
              </button>
            </div>
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Employee</th>
                  <th className="text-right">Basic Salary</th>
                  <th className="text-right">Allowances</th>
                  <th className="text-right bg-amber-50/50 dark:bg-amber-900/10">
                    SSF (Emp)
                  </th>
                  <th className="text-right bg-amber-50/50 dark:bg-amber-900/10">
                    Tier 3
                  </th>
                  <th className="text-right bg-red-50/50 dark:bg-red-900/10">
                    PAYE Tax
                  </th>
                  <th className="text-right bg-red-50/50 dark:bg-red-900/10">
                    Loans
                  </th>
                  <th className="text-right bg-red-50/50 dark:bg-red-900/10">
                    Total Deductions
                  </th>
                  <th className="text-right bg-green-50/50 dark:bg-green-900/10">
                    Net Pay
                  </th>
                  <th className="text-center">Actions</th>
                                <th>Created By</th>
                <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="text-sm">{r.period_name}</td>
                      <td>
                        <div className="font-medium text-sm">
                          {r.first_name} {r.last_name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {r.emp_code}
                        </div>
                      </td>
                      <td className="text-right font-mono text-slate-700 dark:text-slate-300">
                        {fmt(r.basic_salary)}
                      </td>
                      <td className="text-right font-mono text-slate-700 dark:text-slate-300">
                        {fmt(r.allowances)}
                      </td>
                      <td className="text-right font-mono text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/10">
                        {fmt(r.ssf_employee)}
                      </td>
                      <td className="text-right font-mono text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/10">
                        {fmt(r.tier3_employee)}
                      </td>
                      <td className="text-right font-mono text-red-600 dark:text-red-400 bg-red-50/30 dark:bg-red-900/10">
                        {fmt(r.income_tax)}
                      </td>
                      <td className="text-right font-mono text-red-700 dark:text-red-300 bg-red-50/30 dark:bg-red-900/10">
                        <div className="flex items-center gap-2 justify-end">
                          <span>{fmt(r.loan_deductions_total || 0)}</span>
                          {r.loan_items &&
                            Object.keys(r.loan_items).length > 0 && (
                              <button
                                className="text-[9px] px-1.5 py-0.5 border rounded hover:bg-slate-100 dark:hover:bg-slate-700 opacity-70 hover:opacity-100"
                                onClick={() =>
                                  setExpandedLoans((prev) => ({
                                    ...prev,
                                    [r.id]: !prev[r.id],
                                  }))
                                }
                              >
                                {expandedLoans[r.id] ? "Hide" : "Details"}
                              </button>
                            )}
                        </div>
                      </td>
                      <td className="text-right font-mono text-red-700 dark:text-red-300 bg-red-50/30 dark:bg-red-900/10 font-semibold">
                        {fmt(r.deductions)}
                      </td>
                      <td className="text-right font-mono font-bold text-green-700 dark:text-green-400 bg-green-50/30 dark:bg-green-900/10">
                        {fmt(r.net_salary)}
                      </td>
                      <td className="text-center">
                        <div className="flex justify-center gap-2 whitespace-nowrap">
                          <button
                            onClick={() => handleActionClick(r, "PRINT")}
                            className="inline-flex items-center px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
                          >
                            Print
                          </button>
                          <button
                            onClick={() => handleActionClick(r, "PDF")}
                            className="inline-flex items-center px-4 py-1.5 rounded bg-red-900 hover:bg-red-900 text-white text-xs font-semibold shadow-sm transition-all"
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => sendEmail(r)}
                            disabled={sendingEmailId === r.id}
                            className={`inline-flex items-center px-4 py-1.5 rounded text-white text-xs font-semibold shadow-sm transition-all ${
                              sendingEmailId === r.id
                                ? "bg-amber-500 cursor-wait animate-pulse"
                                : "bg-brand hover:bg-brand-700"
                            }`}
                          >
                            {sendingEmailId === r.id
                              ? `⏳ Sending... ${emailProgress}s`
                              : "Email"}
                          </button>
                        </div>
                      </td>
                      <td>{p.created_by_name || "-"}</td>
                      <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : "-"}</td>
                    </tr>
                    {expandedLoans[r.id] && r.loan_items && (
                      <tr className="bg-slate-50/70 dark:bg-slate-700/40 animate-in fade-in slide-in-from-top-1">
                        <td
                          colSpan={11}
                          className="px-4 py-2 border-b border-slate-100 dark:border-slate-700"
                        >
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                              Loan Breakdown:
                            </span>
                            {Object.entries(r.loan_items).map(([lid, item]) => (
                              <div
                                key={lid}
                                className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2"
                              >
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                  {item.loan_type
                                    ? `${item.loan_type}`
                                    : `Loan ${lid}`}
                                </span>
                                <span className="text-[11px] font-bold font-mono text-slate-700 dark:text-slate-300 italic">
                                  {fmt(item.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {!items.length && !loading && (
                  <tr>
                    <td
                      colSpan={11}
                      className="text-center py-12 text-slate-500 italic"
                    >
                      No payslips found for the current selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
