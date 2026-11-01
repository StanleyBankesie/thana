/**
 * @fileoverview HRReports component.
 * Provides comprehensive reporting for SSF (SSNIT) Contributions,
 * Income Tax (PAYE), Salaries Report, and Full Monthly Payroll Summary (Detailed vs Consolidated).
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Receipt,
  DollarSign,
  Users,
  Building2,
  Calendar,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

const fmtGHS = (val) => {
  const num = Number(val || 0);
  return num.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function HRReports() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const searchParams = new URLSearchParams(location.search);

  // Determine active report independently
  const pathParts = location.pathname.split("/reports/");
  const pathType = pathParts.length > 1 ? pathParts[1].replace(/\/$/, "") : "";
  const paramType = params.reportId || pathType || searchParams.get("type") || "";

  const [pollingCounter, setPollingCounter] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPollingCounter((c) => c + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const [reportType, setReportType] = useState(paramType);

  useEffect(() => {
    const nextType = params.reportId || (location.pathname.split("/reports/")[1] || "").replace(/\/$/, "") || new URLSearchParams(location.search).get("type") || "";
    if (nextType !== reportType) {
      setReportType(nextType);
    }
  }, [location.pathname, location.search, params.reportId]);

  // Payroll periods & departments
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [filterDept, setFilterDept] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Date filters for non-payroll reports
  const [fromDate, setFromDate] = useState(
    new Date(new Date().setDate(1)).toISOString().slice(0, 10),
  );
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  // Full monthly payroll view mode: 'detailed' vs 'consolidated'
  const [payrollViewMode, setPayrollViewMode] = useState("detailed");

  // Report state
  const [items, setItems] = useState([]);
  const [consolidatedItems, setConsolidatedItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const printableRef = useRef(null);

  const reportTypes = [
    {
      id: "monthly-payroll",
      label: "Full Monthly Payroll",
      icon: "📑",
      badge: "Ghana GRA/SSNIT",
      description: "Full report of processed salaries with detailed and consolidated views",
    },
    {
      id: "salaries",
      label: "Salaries Report",
      icon: "💰",
      badge: "Payroll Items",
      description: "Processed base salary, allowances, statutory deductions, and net salary",
    },
    {
      id: "ssf",
      label: "SSF (SSNIT) Contributions",
      icon: "🛡️",
      badge: "Act 766 Compliance",
      description: "SSNIT Tier 1 & 2 (5.5% employee, 13% employer, 18.5% total) & Tier 3",
    },
    {
      id: "paye",
      label: "Income Tax (PAYE)",
      icon: "🧾",
      badge: "GRA Progressive Bands",
      description: "Pay-As-You-Earn tax deduction, deductible reliefs and taxable income",
    },
    {
      id: "employees",
      label: "Employee Information",
      icon: "👥",
      badge: "Directory",
      description: "Comprehensive workforce directory and demographics",
    },
    {
      id: "loans",
      label: "Employee Loans",
      icon: "💳",
      badge: "Advances",
      description: "Staff loans, active schedules, and monthly installments",
    },
    {
      id: "allowances",
      label: "Employee Allowances",
      icon: "🎁",
      badge: "Emoluments",
      description: "Recurring and configured employee allowances",
    },
  ];

  // Load periods & departments once
  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      const [periodsRes, deptsRes] = await Promise.all([
        api.get("/hr/payroll/periods").catch(() => ({ data: { items: [] } })),
        api.get("/hr/departments").catch(() => ({ data: { items: [] } })),
      ]);
      const pItems = periodsRes.data?.items || [];
      setPeriods(pItems);
      if (pItems.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(String(pItems[0].id));
      }
      setDepartments(deptsRes.data?.items || []);
    } catch {
      // Fallback
    }
  };

  // Reload report when type, period, or polling triggers
  useEffect(() => {
    loadReport();
  }, [reportType, selectedPeriodId, filterDept, pollingCounter]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = {
        period_id: selectedPeriodId || undefined,
        dept_id: filterDept || undefined,
        q: searchQuery || undefined,
        from_date: fromDate,
        to_date: toDate,
      };

      let endpoint = "";
      if (reportType === "monthly-payroll") endpoint = "/hr/reports/monthly-payroll";
      else if (reportType === "salaries") endpoint = "/hr/reports/salaries";
      else if (reportType === "ssf") endpoint = "/hr/reports/ssf";
      else if (reportType === "paye") endpoint = "/hr/reports/paye";
      else if (reportType === "loans") endpoint = "/hr/reports/loans";
      else if (reportType === "allowances") endpoint = "/hr/reports/allowances";
      else endpoint = "/hr/reports/employees";

      const res = await api.get(endpoint, { params });

      if (reportType === "monthly-payroll") {
        setItems(res.data?.detailed || []);
        setConsolidatedItems(res.data?.consolidated || []);
        setSummary(res.data?.summary || null);
      } else {
        setItems(res.data?.items || []);
        setConsolidatedItems([]);
        setSummary(res.data?.summary || null);
      }
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  // Filter items in memory by search query if user types in search box
  const filteredDetailedItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((it) => {
      const name = (it.full_name || `${it.first_name || ""} ${it.last_name || ""}`).toLowerCase();
      const code = (it.emp_code || "").toLowerCase();
      const dept = (it.dept_name || "").toLowerCase();
      const ssnit = (it.ssnit_number || "").toLowerCase();
      const taxId = (it.tax_id || "").toLowerCase();
      return (
        name.includes(q) ||
        code.includes(q) ||
        dept.includes(q) ||
        ssnit.includes(q) ||
        taxId.includes(q)
      );
    });
  }, [items, searchQuery]);

  const filteredConsolidatedItems = useMemo(() => {
    if (!searchQuery.trim()) return consolidatedItems;
    const q = searchQuery.toLowerCase();
    return consolidatedItems.filter((it) =>
      (it.dept_name || "").toLowerCase().includes(q),
    );
  }, [consolidatedItems, searchQuery]);

  const handleTypeSelect = (id) => {
    setReportType(id);
    navigate(`/human-resources/reports?type=${id}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const exportExcel = () => {
    const dataToExport =
      reportType === "monthly-payroll" && payrollViewMode === "consolidated"
        ? filteredConsolidatedItems
        : filteredDetailedItems;

    if (!dataToExport.length) return toast.info("No data to export");

    try {
      let exportRows = [];
      const currentPeriodName =
        periods.find((p) => String(p.id) === String(selectedPeriodId))
          ?.period_name || "All Periods";

      if (reportType === "monthly-payroll" && payrollViewMode === "consolidated") {
        exportRows = dataToExport.map((row, idx) => ({
          "#": idx + 1,
          Department: row.dept_name || "General",
          Headcount: Number(row.headcount || 0),
          "Total Basic Salary (GHS)": Number(row.total_basic_salary || 0),
          "Total Allowances (GHS)": Number(row.total_allowances || 0),
          "Total Gross Salary (GHS)": Number(row.total_gross_salary || 0),
          "SSNIT Employee 5.5% (GHS)": Number(row.total_ssf_employee || 0),
          "SSNIT Employer 13.0% (GHS)": Number(row.total_ssf_employer || 0),
          "Total SSNIT 18.5% (GHS)": Number(row.total_ssf_combined || 0),
          "Total Tier 3 (GHS)": Number(
            (Number(row.total_tier3_employee || 0) + Number(row.total_tier3_employer || 0)).toFixed(2),
          ),
          "Personal Tax Reliefs (GHS)": Number(row.total_tax_relief || 0),
          "Total Taxable Income (GHS)": Number(row.total_taxable_income || 0),
          "Total PAYE Tax (GHS)": Number(row.total_paye_tax || 0),
          "Total Loan Deductions (GHS)": Number(row.total_loan_deductions || 0),
          "Total Deductions (GHS)": Number(row.total_deductions || 0),
          "Total Net Salary Disbursed (GHS)": Number(row.total_net_salary || 0),
          "Total Employer Cost (GHS)": Number(row.total_employer_cost || 0),
        }));
      } else if (reportType === "monthly-payroll") {
        exportRows = dataToExport.map((row, idx) => ({
          "#": idx + 1,
          "Employee Code": row.emp_code || "-",
          "Employee Name": row.full_name || "-",
          Department: row.dept_name || "-",
          Position: row.pos_name || "-",
          "Month / Period": row.period_name || currentPeriodName,
          "Basic Salary (GHS)": Number(row.basic_salary || 0),
          "Allowances (GHS)": Number(row.allowances || 0),
          "Gross Salary (GHS)": Number(row.gross_salary || 0),
          "SSNIT Employee 5.5% (GHS)": Number(row.ssf_employee || 0),
          "Tier 3 Employee (GHS)": Number(row.tier3_employee || 0),
          "Tax Relief (GHS)": Number(row.personal_tax_relief || 0),
          "Taxable Income (GHS)": Number(row.taxable_income || 0),
          "PAYE Tax (GHS)": Number(row.paye_tax || 0),
          "Loan Deductions (GHS)": Number(row.loan_deductions || 0),
          "Total Deductions (GHS)": Number(row.total_deductions || 0),
          "Net Salary (GHS)": Number(row.net_salary || 0),
          "SSNIT Employer 13% (GHS)": Number(row.ssf_employer || 0),
          "Total Employer Cost (GHS)": Number(row.total_employer_cost || 0),
          "Bank Name": row.bank_name || "-",
          "Bank Account": row.bank_account_no || "-",
        }));
      } else if (reportType === "salaries") {
        exportRows = dataToExport.map((row, idx) => ({
          "#": idx + 1,
          "Employee Code": row.emp_code || "-",
          "Employee Name": row.full_name || "-",
          Department: row.dept_name || "-",
          Position: row.pos_name || "-",
          "Month / Period": row.period_name || currentPeriodName,
          "Base Salary (GHS)": Number(row.basic_salary || 0),
          "Processed Allowances (GHS)": Number(row.allowances || 0),
          "Gross Salary (GHS)": Number(row.gross_salary || 0),
          "SSNIT 5.5% (GHS)": Number(row.ssf_employee || 0),
          "PAYE Tax (GHS)": Number(row.paye_tax || 0),
          "Loan Deductions (GHS)": Number(row.loan_deductions || 0),
          "Other Deductions (GHS)": Number(row.other_deductions || 0),
          "Total Deductions (GHS)": Number(row.total_deductions || 0),
          "Net Salary (GHS)": Number(row.net_salary || 0),
          "Bank Name": row.bank_name || "-",
          "Bank Account": row.bank_account_no || "-",
          Status: row.status || "PROCESSED",
        }));
      } else if (reportType === "ssf") {
        exportRows = dataToExport.map((row, idx) => ({
          "#": idx + 1,
          "Employee Code": row.emp_code || "-",
          "Employee Name": row.full_name || "-",
          "SSNIT Number": row.ssnit_number || "-",
          Department: row.dept_name || "-",
          "Month / Period": row.period_name || currentPeriodName,
          "Basic Qualifying Salary (GHS)": Number(row.basic_salary || 0),
          "Employee SSNIT 5.5% (GHS)": Number(row.ssf_employee || 0),
          "Employer SSNIT 13.0% (GHS)": Number(row.ssf_employer || 0),
          "Total SSNIT 18.5% (GHS)": Number(row.total_ssnit || 0),
          "Tier 3 Employee (GHS)": Number(row.tier3_employee || 0),
          "Tier 3 Employer (GHS)": Number(row.tier3_employer || 0),
          "Total Tier 3 (GHS)": Number(row.total_tier3 || 0),
          "Total Statutory Remittance (GHS)": Number(row.total_statutory_remittance || 0),
        }));
      } else if (reportType === "paye") {
        exportRows = dataToExport.map((row, idx) => ({
          "#": idx + 1,
          "Employee Code": row.emp_code || "-",
          "Employee Name": row.full_name || "-",
          "Tax ID / TIN / Ghana Card": row.tax_id || "-",
          Department: row.dept_name || "-",
          "Month / Period": row.period_name || currentPeriodName,
          "Basic Salary (GHS)": Number(row.basic_salary || 0),
          "Cash Allowances (GHS)": Number(row.allowances || 0),
          "Gross Cash Emoluments (GHS)": Number(row.gross_salary || 0),
          "SSNIT Relief 5.5% (GHS)": Number(row.ssf_relief || 0),
          "Tier 3 Relief (GHS)": Number(row.tier3_relief || 0),
          "Personal Tax Relief (GHS)": Number(row.personal_tax_relief || 0),
          "Total Tax Reliefs (GHS)": Number(row.total_tax_reliefs || 0),
          "Chargeable Taxable Income (GHS)": Number(row.taxable_income || 0),
          "PAYE Tax Deducted (GHS)": Number(row.paye_tax || 0),
          "Net Salary (GHS)": Number(row.net_salary || 0),
        }));
      } else {
        exportRows = dataToExport;
      }

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Payroll_Report");
      XLSX.writeFile(
        wb,
        `HR_${reportType.toUpperCase()}_${currentPeriodName.replace(/\s+/g, "_")}.xlsx`,
      );
      toast.success("Excel report exported successfully");
    } catch {
      toast.error("Failed to export Excel file");
    }
  };

  const exportPdf = () => {
    const dataToExport =
      reportType === "monthly-payroll" && payrollViewMode === "consolidated"
        ? filteredConsolidatedItems
        : filteredDetailedItems;

    if (!dataToExport.length) return toast.info("No data to export");

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const currentPeriodName =
        periods.find((p) => String(p.id) === String(selectedPeriodId))
          ?.period_name || "All Periods";

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`OmniSuite HR Report: ${currentReportObj.label.toUpperCase()}`, 40, 35);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        isPayrollReport
          ? `Payroll Period: ${currentPeriodName}   |   Department: ${filterDept ? departments.find((d) => String(d.id) === String(filterDept))?.dept_name || filterDept : "All"}   |   Generated: ${new Date().toLocaleDateString()}`
          : `Date Range: ${fromDate} to ${toDate}   |   Department: ${filterDept ? departments.find((d) => String(d.id) === String(filterDept))?.dept_name || filterDept : "All"}   |   Generated: ${new Date().toLocaleDateString()}`,
        40,
        50,
      );

      let head = [];
      let body = [];

      if (reportType === "monthly-payroll" && payrollViewMode === "consolidated") {
        head = [
          [
            "#",
            "Department",
            "Staff",
            "Basic Salary",
            "Allowances",
            "Gross Pay",
            "SSNIT 5.5%",
            "SSNIT 13%",
            "SSNIT 18.5%",
            "Tier 3",
            "Tax Relief",
            "Taxable",
            "PAYE Tax",
            "Deductions",
            "Net Pay",
            "Employer Cost",
          ],
        ];
        body = dataToExport.map((r, i) => [
          i + 1,
          r.dept_name || "General",
          r.headcount || 0,
          fmtGHS(r.total_basic_salary),
          fmtGHS(r.total_allowances),
          fmtGHS(r.total_gross_salary),
          fmtGHS(r.total_ssf_employee),
          fmtGHS(r.total_ssf_employer),
          fmtGHS(r.total_ssf_combined),
          fmtGHS(Number(r.total_tier3_employee || 0) + Number(r.total_tier3_employer || 0)),
          fmtGHS(r.total_tax_relief),
          fmtGHS(r.total_taxable_income),
          fmtGHS(r.total_paye_tax),
          fmtGHS(r.total_deductions),
          fmtGHS(r.total_net_salary),
          fmtGHS(r.total_employer_cost),
        ]);
      } else if (reportType === "monthly-payroll") {
        head = [
          [
            "#",
            "Emp Code",
            "Name",
            "Department",
            "Basic",
            "Allowances",
            "Gross",
            "SSNIT 5.5%",
            "Tier 3",
            "Relief",
            "Taxable",
            "PAYE",
            "Loans",
            "Total Ded",
            "Net Pay",
            "Employer Cost",
          ],
        ];
        body = dataToExport.map((r, i) => [
          i + 1,
          r.emp_code || "-",
          r.full_name || "-",
          r.dept_name || "-",
          fmtGHS(r.basic_salary),
          fmtGHS(r.allowances),
          fmtGHS(r.gross_salary),
          fmtGHS(r.ssf_employee),
          fmtGHS(r.tier3_employee),
          fmtGHS(r.personal_tax_relief),
          fmtGHS(r.taxable_income),
          fmtGHS(r.paye_tax),
          fmtGHS(r.loan_deductions),
          fmtGHS(r.total_deductions),
          fmtGHS(r.net_salary),
          fmtGHS(r.total_employer_cost),
        ]);
      } else if (reportType === "salaries") {
        head = [
          [
            "#",
            "Code",
            "Name",
            "Department",
            "Base Salary",
            "Allowances",
            "Gross Salary",
            "SSNIT 5.5%",
            "PAYE Tax",
            "Loans",
            "Total Ded",
            "Net Salary",
            "Bank Account",
          ],
        ];
        body = dataToExport.map((r, i) => [
          i + 1,
          r.emp_code || "-",
          r.full_name || "-",
          r.dept_name || "-",
          fmtGHS(r.basic_salary),
          fmtGHS(r.allowances),
          fmtGHS(r.gross_salary),
          fmtGHS(r.ssf_employee),
          fmtGHS(r.paye_tax),
          fmtGHS(r.loan_deductions),
          fmtGHS(r.total_deductions),
          fmtGHS(r.net_salary),
          `${r.bank_name || ""} ${r.bank_account_no || ""}`.trim() || "-",
        ]);
      } else if (reportType === "ssf") {
        head = [
          [
            "#",
            "Code",
            "Name",
            "SSNIT No",
            "Department",
            "Basic Salary",
            "Employee 5.5%",
            "Employer 13%",
            "Total 18.5%",
            "Tier 3 Emp",
            "Total Remittance",
          ],
        ];
        body = dataToExport.map((r, i) => [
          i + 1,
          r.emp_code || "-",
          r.full_name || "-",
          r.ssnit_number || "-",
          r.dept_name || "-",
          fmtGHS(r.basic_salary),
          fmtGHS(r.ssf_employee),
          fmtGHS(r.ssf_employer),
          fmtGHS(r.total_ssnit),
          fmtGHS(r.tier3_employee),
          fmtGHS(r.total_statutory_remittance),
        ]);
      } else if (reportType === "paye") {
        head = [
          [
            "#",
            "Code",
            "Name",
            "TIN / Ghana Card",
            "Basic",
            "Allowances",
            "Gross",
            "SSNIT Relief",
            "Tier 3 Relief",
            "Personal Relief",
            "Taxable Income",
            "PAYE Tax",
            "Net Pay",
          ],
        ];
        body = dataToExport.map((r, i) => [
          i + 1,
          r.emp_code || "-",
          r.full_name || "-",
          r.tax_id || "-",
          fmtGHS(r.basic_salary),
          fmtGHS(r.allowances),
          fmtGHS(r.gross_salary),
          fmtGHS(r.ssf_relief),
          fmtGHS(r.tier3_relief),
          fmtGHS(r.personal_tax_relief),
          fmtGHS(r.taxable_income),
          fmtGHS(r.paye_tax),
          fmtGHS(r.net_salary),
        ]);
      } else {
        head = [Object.keys(dataToExport[0] || {}).slice(0, 8)];
        body = dataToExport.map((it) =>
          Object.values(it)
            .slice(0, 8)
            .map((v) => (v === null || v === undefined ? "-" : String(v))),
        );
      }

      doc.autoTable({
        head,
        body,
        startY: 65,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      });

      doc.save(`HR_${reportType.toUpperCase()}_Report.pdf`);
      toast.success("PDF report exported successfully");
    } catch {
      toast.error("Failed to export PDF file");
    }
  };

  const currentReportObj =
    reportTypes.find((t) => t.id === reportType) || reportTypes[0];

  const isPayrollReport = [
    "monthly-payroll",
    "salaries",
    "ssf",
    "paye",
  ].includes(reportType);

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-6">
        {!reportType ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📊</span> HR Reports & Compliance Center
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Access independent reports for payroll, statutory contributions, tax compliance, loans, and staff records.
                </p>
              </div>
              <Link to="/human-resources" className="btn-secondary text-xs h-9 flex items-center">
                Back to Menu
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reportTypes.map((rep) => (
                <div
                  key={rep.id}
                  className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-brand/40 transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl p-2 rounded-lg bg-slate-100 dark:bg-slate-700/50 inline-block">{rep.icon}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                        {rep.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{rep.label}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{rep.description}</p>
                  </div>
                  <Link
                    to={`/human-resources/reports/${rep.id}`}
                    className="btn-primary text-xs py-2 text-center font-semibold w-full block"
                  >
                    Open Report →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentReportObj.icon}</span>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {currentReportObj.label}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
                {currentReportObj.badge}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {currentReportObj.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
              title="Export formatted Excel report"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={exportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition"
              title="Export high-resolution PDF"
            >
              <Download className="w-4 h-4" />
              <span>PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition"
              title="Print report"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            {reportType && (
              <Link
                to="/human-resources/reports"
                className="btn-secondary text-xs h-9 flex items-center gap-1"
              >
                ← All Reports
              </Link>
            )}
            <Link
              to="/human-resources"
              className="btn-secondary text-xs h-9 flex items-center"
            >
              Back to Menu
            </Link>
          </div>
        </div>



        {/* Filter Toolbar */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex flex-wrap items-end gap-3.5">
            {isPayrollReport ? (
              <div className="min-w-[220px]">
                <label className="label text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-brand" />
                  Payroll Month / Period
                </label>
                <select
                  className="input text-xs h-9 font-medium"
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                >
                  <option value="">All Processed Periods</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.period_name} (
                      {new Date(p.start_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      -{" "}
                      {new Date(p.end_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      )
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="label text-[11px] font-semibold">From Date</label>
                  <input
                    type="date"
                    className="input text-xs h-9"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label text-[11px] font-semibold">To Date</label>
                  <input
                    type="date"
                    className="input text-xs h-9"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Department */}
            <div className="min-w-[170px]">
              <label className="label text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-brand" />
                Department
              </label>
              <select
                className="input text-xs h-9"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dept_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="flex-1 min-w-[200px]">
              <label className="label text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-brand" />
                Search Employee
              </label>
              <input
                type="text"
                className="input text-xs h-9"
                placeholder="Search by name, code, TIN, SSNIT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Mode Switcher for Full Monthly Payroll */}
            {reportType === "monthly-payroll" && (
              <div>
                <label className="label text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Report View Mode
                </label>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900 h-9">
                  <button
                    type="button"
                    onClick={() => setPayrollViewMode("detailed")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      payrollViewMode === "detailed"
                        ? "bg-white dark:bg-slate-800 text-brand shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    👥 Detailed Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayrollViewMode("consolidated")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      payrollViewMode === "consolidated"
                        ? "bg-white dark:bg-slate-800 text-brand shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    🏢 Consolidated Month
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={loadReport}
              className="btn-primary h-9 px-4 text-xs font-semibold"
            >
              Generate Report
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                Headcount
              </span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {summary.headcount || 0}
              </p>
              <span className="text-[10px] text-emerald-600 font-medium">Processed Staff</span>
            </div>

            {reportType === "ssf" && (
              <>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Basic Qualifying
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    GHS {fmtGHS(summary.total_basic_salary)}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">Wages Base</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    SSNIT Employee 5.5%
                  </span>
                  <p className="text-lg font-bold text-amber-600 mt-1">
                    GHS {fmtGHS(summary.total_ssf_employee)}
                  </p>
                  <span className="text-[10px] text-amber-600 font-medium">Deducted at source</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    SSNIT Employer 13.0%
                  </span>
                  <p className="text-lg font-bold text-indigo-600 mt-1">
                    GHS {fmtGHS(summary.total_ssf_employer)}
                  </p>
                  <span className="text-[10px] text-indigo-600 font-medium">Employer Cost</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Total SSNIT 18.5%
                  </span>
                  <p className="text-lg font-bold text-brand mt-1">
                    GHS {fmtGHS(summary.total_ssnit)}
                  </p>
                  <span className="text-[10px] text-brand font-medium">Tier 1 & 2 Combined</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Total Remittance
                  </span>
                  <p className="text-lg font-bold text-emerald-600 mt-1">
                    GHS {fmtGHS(summary.total_remittance)}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-medium">SSNIT + Tier 3</span>
                </div>
              </>
            )}

            {reportType === "paye" && (
              <>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Gross Emoluments
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    GHS {fmtGHS(summary.total_gross_salary)}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">Basic + Allowances</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Total Tax Reliefs
                  </span>
                  <p className="text-lg font-bold text-teal-600 mt-1">
                    GHS {fmtGHS(summary.total_tax_reliefs)}
                  </p>
                  <span className="text-[10px] text-teal-600 font-medium">SSNIT + Tier 3 + GRA</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Taxable Income
                  </span>
                  <p className="text-lg font-bold text-amber-600 mt-1">
                    GHS {fmtGHS(summary.total_taxable_income)}
                  </p>
                  <span className="text-[10px] text-amber-600 font-medium">Chargeable Income</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    PAYE Income Tax
                  </span>
                  <p className="text-lg font-bold text-rose-600 mt-1">
                    GHS {fmtGHS(summary.total_paye_tax)}
                  </p>
                  <span className="text-[10px] text-rose-600 font-medium">GRA Progressive Tax</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Net Salaries
                  </span>
                  <p className="text-lg font-bold text-emerald-600 mt-1">
                    GHS {fmtGHS(summary.total_net_salary)}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-medium">Disbursed Take-home</span>
                </div>
              </>
            )}

            {reportType === "salaries" && (
              <>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Base Salaries
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    GHS {fmtGHS(summary.total_basic_salary)}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">Core Basic Pay</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Total Allowances
                  </span>
                  <p className="text-lg font-bold text-indigo-600 mt-1">
                    GHS {fmtGHS(summary.total_allowances)}
                  </p>
                  <span className="text-[10px] text-indigo-600 font-medium">Cash Allowances</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Gross Salaries
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    GHS {fmtGHS(summary.total_gross_salary)}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">Total Earnings</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Total Deductions
                  </span>
                  <p className="text-lg font-bold text-rose-600 mt-1">
                    GHS {fmtGHS(summary.total_deductions)}
                  </p>
                  <span className="text-[10px] text-rose-600 font-medium">SSNIT + PAYE + Loans</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Total Net Pay
                  </span>
                  <p className="text-lg font-bold text-emerald-600 mt-1">
                    GHS {fmtGHS(summary.total_net_salary)}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-medium">Net Disbursed</span>
                </div>
              </>
            )}

            {reportType === "monthly-payroll" && (
              <>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Gross Emoluments
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    GHS {fmtGHS(summary.total_gross_salary)}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">Basic + Allowances</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    SSNIT 18.5% Total
                  </span>
                  <p className="text-lg font-bold text-brand mt-1">
                    GHS {fmtGHS(summary.total_ssf_combined)}
                  </p>
                  <span className="text-[10px] text-brand font-medium">Emp: {fmtGHS(summary.total_ssf_employee)} | Emplr: {fmtGHS(summary.total_ssf_employer)}</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    GRA PAYE Tax
                  </span>
                  <p className="text-lg font-bold text-rose-600 mt-1">
                    GHS {fmtGHS(summary.total_paye_tax)}
                  </p>
                  <span className="text-[10px] text-rose-600 font-medium">Statutory Tax</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Net Pay Disbursed
                  </span>
                  <p className="text-lg font-bold text-emerald-600 mt-1">
                    GHS {fmtGHS(summary.total_net_salary)}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-medium">Staff Take-Home</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Total Employer Cost
                  </span>
                  <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400 mt-1">
                    GHS {fmtGHS(summary.total_employer_cost)}
                  </p>
                  <span className="text-[10px] text-indigo-600 font-medium">Gross + SSNIT 13%</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Report Results Container */}
        <div
          ref={printableRef}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
          {/* Table Header Bar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                <span>{currentReportObj.icon}</span>
                <span>
                  {currentReportObj.label}
                  {reportType === "monthly-payroll"
                    ? payrollViewMode === "consolidated"
                      ? " (Consolidated Monthly Summary)"
                      : " (Detailed Employee Breakdown)"
                    : ""}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isPayrollReport
                  ? (selectedPeriodId
                      ? periods.find((p) => String(p.id) === String(selectedPeriodId))?.period_name || "Filtered Period"
                      : "All Processed Periods")
                  : `Date Range: ${fromDate} to ${toDate}`}
                {filterDept &&
                  ` • ${departments.find((d) => String(d.id) === String(filterDept))?.dept_name || filterDept}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {reportType === "monthly-payroll" && payrollViewMode === "consolidated"
                  ? `${filteredConsolidatedItems.length} departments`
                  : `${filteredDetailedItems.length} records found`}
              </span>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto max-h-[620px] scrollbar-thin">
            {/* 1. SSF (SSNIT) Table */}
            {reportType === "ssf" && (
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100/90 dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr className="text-left font-bold uppercase text-[10px] text-slate-600 dark:text-slate-400">
                    <th className="px-3 py-3 w-10">#</th>
                    <th className="px-3 py-3">Employee</th>
                    <th className="px-3 py-3">SSNIT No.</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3 text-right">Basic Salary</th>
                    <th className="px-3 py-3 text-right text-amber-700 dark:text-amber-400">Emp 5.5%</th>
                    <th className="px-3 py-3 text-right text-indigo-700 dark:text-indigo-400">Emplr 13%</th>
                    <th className="px-3 py-3 text-right font-extrabold text-brand">Total 18.5%</th>
                    <th className="px-3 py-3 text-right">Tier 3 Emp</th>
                    <th className="px-3 py-3 text-right font-extrabold text-emerald-700 dark:text-emerald-400">Total Remittance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredDetailedItems.map((row, idx) => (
                    <tr
                      key={row.payslip_id || idx}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition"
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {row.full_name || "-"}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {row.emp_code}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                        {row.ssnit_number || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {row.dept_name || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {row.period_name || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {fmtGHS(row.basic_salary)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-amber-700 dark:text-amber-400">
                        {fmtGHS(row.ssf_employee)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-indigo-700 dark:text-indigo-400">
                        {fmtGHS(row.ssf_employer)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-brand">
                        {fmtGHS(row.total_ssnit)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-700 dark:text-slate-300">
                        {fmtGHS(row.tier3_employee)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400">
                        {fmtGHS(row.total_statutory_remittance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {summary && filteredDetailedItems.length > 0 && (
                  <tfoot className="bg-slate-100 dark:bg-slate-900 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                    <tr className="text-slate-900 dark:text-white">
                      <td colSpan={5} className="px-3 py-3 uppercase text-[11px] text-right">
                        Totals ({summary.headcount} Staff):
                      </td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_basic_salary)}</td>
                      <td className="px-3 py-3 text-right text-amber-700 dark:text-amber-400">{fmtGHS(summary.total_ssf_employee)}</td>
                      <td className="px-3 py-3 text-right text-indigo-700 dark:text-indigo-400">{fmtGHS(summary.total_ssf_employer)}</td>
                      <td className="px-3 py-3 text-right text-brand">{fmtGHS(summary.total_ssnit)}</td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_tier3_employee)}</td>
                      <td className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400">{fmtGHS(summary.total_remittance)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {/* 2. Income Tax (PAYE) Table */}
            {reportType === "paye" && (
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100/90 dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr className="text-left font-bold uppercase text-[10px] text-slate-600 dark:text-slate-400">
                    <th className="px-3 py-3 w-10">#</th>
                    <th className="px-3 py-3">Employee</th>
                    <th className="px-3 py-3">TIN / Ghana Card</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3 text-right">Basic Pay</th>
                    <th className="px-3 py-3 text-right">Allowances</th>
                    <th className="px-3 py-3 text-right font-semibold">Gross Pay</th>
                    <th className="px-3 py-3 text-right">SSNIT Relief</th>
                    <th className="px-3 py-3 text-right">Tier 3</th>
                    <th className="px-3 py-3 text-right">Personal Relief</th>
                    <th className="px-3 py-3 text-right font-medium text-teal-700 dark:text-teal-400">Total Reliefs</th>
                    <th className="px-3 py-3 text-right font-semibold text-amber-700 dark:text-amber-400">Taxable Income</th>
                    <th className="px-3 py-3 text-right font-extrabold text-rose-700 dark:text-rose-400">PAYE Tax</th>
                    <th className="px-3 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400">Net Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredDetailedItems.map((row, idx) => (
                    <tr
                      key={row.payslip_id || idx}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition"
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {row.full_name || "-"}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {row.emp_code}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                        {row.tax_id || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {row.dept_name || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {row.period_name || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right">{fmtGHS(row.basic_salary)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtGHS(row.allowances)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{fmtGHS(row.gross_salary)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtGHS(row.ssf_relief)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtGHS(row.tier3_relief)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtGHS(row.personal_tax_relief)}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-teal-700 dark:text-teal-400">{fmtGHS(row.total_tax_reliefs)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-amber-700 dark:text-amber-400">{fmtGHS(row.taxable_income)}</td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-rose-700 dark:text-rose-400">{fmtGHS(row.paye_tax)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400">{fmtGHS(row.net_salary)}</td>
                    </tr>
                  ))}
                </tbody>
                {summary && filteredDetailedItems.length > 0 && (
                  <tfoot className="bg-slate-100 dark:bg-slate-900 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                    <tr className="text-slate-900 dark:text-white">
                      <td colSpan={5} className="px-3 py-3 uppercase text-[11px] text-right">
                        Totals ({summary.headcount} Staff):
                      </td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_basic_salary)}</td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_allowances)}</td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_gross_salary)}</td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_ssf_relief)}</td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_tier3_relief)}</td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_personal_relief)}</td>
                      <td className="px-3 py-3 text-right text-teal-700 dark:text-teal-400">{fmtGHS(summary.total_tax_reliefs)}</td>
                      <td className="px-3 py-3 text-right text-amber-700 dark:text-amber-400">{fmtGHS(summary.total_taxable_income)}</td>
                      <td className="px-3 py-3 text-right text-rose-700 dark:text-rose-400">{fmtGHS(summary.total_paye_tax)}</td>
                      <td className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400">{fmtGHS(summary.total_net_salary)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {/* 3. Salaries Report Table */}
            {reportType === "salaries" && (
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100/90 dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr className="text-left font-bold uppercase text-[10px] text-slate-600 dark:text-slate-400">
                    <th className="px-3 py-3 w-10">#</th>
                    <th className="px-3 py-3">Employee</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Position</th>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3 text-right">Processed Base</th>
                    <th className="px-3 py-3 text-right">Allowances</th>
                    <th className="px-3 py-3 text-right font-semibold">Gross Salary</th>
                    <th className="px-3 py-3 text-right">SSNIT (5.5%)</th>
                    <th className="px-3 py-3 text-right">PAYE Tax</th>
                    <th className="px-3 py-3 text-right">Loans</th>
                    <th className="px-3 py-3 text-right font-bold text-rose-700 dark:text-rose-400">Total Deductions</th>
                    <th className="px-3 py-3 text-right font-extrabold text-emerald-700 dark:text-emerald-400">Net Salary</th>
                    <th className="px-3 py-3">Bank Details</th>
                    <th className="px-3 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredDetailedItems.map((row, idx) => (
                    <tr
                      key={row.payslip_id || idx}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition"
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {row.full_name || "-"}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {row.emp_code}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {row.dept_name || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {row.pos_name || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {row.period_name || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {fmtGHS(row.basic_salary)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {fmtGHS(row.allowances)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        {fmtGHS(row.gross_salary)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">
                        {fmtGHS(row.ssf_employee)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">
                        {fmtGHS(row.paye_tax)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">
                        {fmtGHS(row.loan_deductions)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-rose-700 dark:text-rose-400">
                        {fmtGHS(row.total_deductions)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-emerald-700 dark:text-emerald-400">
                        {fmtGHS(row.net_salary)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 text-[11px]">
                        <div>{row.bank_name || "-"}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {row.bank_account_no}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          PROCESSED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {summary && filteredDetailedItems.length > 0 && (
                  <tfoot className="bg-slate-100 dark:bg-slate-900 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                    <tr className="text-slate-900 dark:text-white">
                      <td colSpan={5} className="px-3 py-3 uppercase text-[11px] text-right">
                        Totals ({summary.headcount} Staff):
                      </td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_basic_salary)}</td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_allowances)}</td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_gross_salary)}</td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_ssf_employee)}</td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_paye_tax)}</td>
                      <td className="px-3 py-3 text-right">{fmtGHS(summary.total_loan_deductions)}</td>
                      <td className="px-3 py-3 text-right text-rose-700 dark:text-rose-400">{fmtGHS(summary.total_deductions)}</td>
                      <td className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400">{fmtGHS(summary.total_net_salary)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {/* 4. Full Monthly Payroll Report */}
            {reportType === "monthly-payroll" && (
              <>
                {payrollViewMode === "consolidated" ? (
                  /* CONSOLIDATED MONTHLY VIEW */
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-100/90 dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr className="text-left font-bold uppercase text-[10px] text-slate-600 dark:text-slate-400">
                        <th className="px-3 py-3 w-10">#</th>
                        <th className="px-3 py-3">Department</th>
                        <th className="px-3 py-3 text-center">Staff Count</th>
                        <th className="px-3 py-3 text-right">Basic Salary</th>
                        <th className="px-3 py-3 text-right">Allowances</th>
                        <th className="px-3 py-3 text-right font-semibold">Gross Pay</th>
                        <th className="px-3 py-3 text-right">SSNIT Emp 5.5%</th>
                        <th className="px-3 py-3 text-right">SSNIT Emplr 13%</th>
                        <th className="px-3 py-3 text-right font-bold text-brand">SSNIT 18.5%</th>
                        <th className="px-3 py-3 text-right">Tier 3</th>
                        <th className="px-3 py-3 text-right">Tax Reliefs</th>
                        <th className="px-3 py-3 text-right font-semibold">Taxable</th>
                        <th className="px-3 py-3 text-right font-bold text-rose-700 dark:text-rose-400">PAYE Tax</th>
                        <th className="px-3 py-3 text-right">Loan Ded.</th>
                        <th className="px-3 py-3 text-right font-bold text-rose-700 dark:text-rose-400">Total Ded.</th>
                        <th className="px-3 py-3 text-right font-extrabold text-emerald-700 dark:text-emerald-400">Net Pay</th>
                        <th className="px-3 py-3 text-right font-bold text-indigo-700 dark:text-indigo-400">Employer Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredConsolidatedItems.map((deptRow, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition"
                        >
                          <td className="px-3 py-3 font-medium text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-brand" />
                            <span>{deptRow.dept_name || "General"}</span>
                          </td>
                          <td className="px-3 py-3 text-center font-semibold">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {deptRow.headcount}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right font-medium">
                            {fmtGHS(deptRow.total_basic_salary)}
                          </td>
                          <td className="px-3 py-3 text-right font-medium">
                            {fmtGHS(deptRow.total_allowances)}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold">
                            {fmtGHS(deptRow.total_gross_salary)}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">
                            {fmtGHS(deptRow.total_ssf_employee)}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">
                            {fmtGHS(deptRow.total_ssf_employer)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-brand">
                            {fmtGHS(deptRow.total_ssf_combined)}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">
                            {fmtGHS(
                              Number(deptRow.total_tier3_employee || 0) +
                                Number(deptRow.total_tier3_employer || 0),
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">
                            {fmtGHS(deptRow.total_tax_relief)}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold">
                            {fmtGHS(deptRow.total_taxable_income)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-rose-700 dark:text-rose-400">
                            {fmtGHS(deptRow.total_paye_tax)}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">
                            {fmtGHS(deptRow.total_loan_deductions)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-rose-700 dark:text-rose-400">
                            {fmtGHS(deptRow.total_deductions)}
                          </td>
                          <td className="px-3 py-3 text-right font-extrabold text-emerald-700 dark:text-emerald-400">
                            {fmtGHS(deptRow.total_net_salary)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-indigo-700 dark:text-indigo-400">
                            {fmtGHS(deptRow.total_employer_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {summary && filteredConsolidatedItems.length > 0 && (
                      <tfoot className="bg-slate-100 dark:bg-slate-900 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                        <tr className="text-slate-900 dark:text-white">
                          <td colSpan={2} className="px-3 py-3 uppercase text-[11px] text-right font-extrabold">
                            Company Grand Total:
                          </td>
                          <td className="px-3 py-3 text-center">{summary.headcount}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_basic_salary)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_allowances)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_gross_salary)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_ssf_employee)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_ssf_employer)}</td>
                          <td className="px-3 py-3 text-right text-brand">{fmtGHS(summary.total_ssf_combined)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(Number(summary.total_tier3_employee || 0) + Number(summary.total_tier3_employer || 0))}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_personal_tax_relief)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_taxable_income)}</td>
                          <td className="px-3 py-3 text-right text-rose-700 dark:text-rose-400">{fmtGHS(summary.total_paye_tax)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_loan_deductions)}</td>
                          <td className="px-3 py-3 text-right text-rose-700 dark:text-rose-400">{fmtGHS(summary.total_deductions)}</td>
                          <td className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400">{fmtGHS(summary.total_net_salary)}</td>
                          <td className="px-3 py-3 text-right text-indigo-700 dark:text-indigo-400">{fmtGHS(summary.total_employer_cost)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                ) : (
                  /* DETAILED PER EMPLOYEE VIEW */
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-100/90 dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr className="text-left font-bold uppercase text-[10px] text-slate-600 dark:text-slate-400">
                        <th className="px-3 py-3 w-10">#</th>
                        <th className="px-3 py-3">Employee</th>
                        <th className="px-3 py-3">Department</th>
                        <th className="px-3 py-3 text-right">Basic</th>
                        <th className="px-3 py-3 text-right">Allowances</th>
                        <th className="px-3 py-3 text-right font-semibold">Gross Pay</th>
                        <th className="px-3 py-3 text-right">SSNIT 5.5%</th>
                        <th className="px-3 py-3 text-right">Tier 3</th>
                        <th className="px-3 py-3 text-right">Tax Relief</th>
                        <th className="px-3 py-3 text-right font-semibold">Taxable</th>
                        <th className="px-3 py-3 text-right font-bold text-rose-700 dark:text-rose-400">PAYE</th>
                        <th className="px-3 py-3 text-right">Loans</th>
                        <th className="px-3 py-3 text-right font-bold text-rose-700 dark:text-rose-400">Total Ded.</th>
                        <th className="px-3 py-3 text-right font-extrabold text-emerald-700 dark:text-emerald-400">Net Pay</th>
                        <th className="px-3 py-3 text-right font-semibold text-indigo-700 dark:text-indigo-400">Emplr Cost</th>
                        <th className="px-3 py-3">Bank Account</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredDetailedItems.map((row, idx) => (
                        <tr
                          key={row.payslip_id || idx}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition"
                        >
                          <td className="px-3 py-2.5 font-medium text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {row.full_name || "-"}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {row.emp_code}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                            {row.dept_name || "-"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium">{fmtGHS(row.basic_salary)}</td>
                          <td className="px-3 py-2.5 text-right font-medium">{fmtGHS(row.allowances)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold">{fmtGHS(row.gross_salary)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtGHS(row.ssf_employee)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtGHS(row.tier3_employee)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtGHS(row.personal_tax_relief)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold">{fmtGHS(row.taxable_income)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-rose-700 dark:text-rose-400">{fmtGHS(row.paye_tax)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtGHS(row.loan_deductions)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-rose-700 dark:text-rose-400">{fmtGHS(row.total_deductions)}</td>
                          <td className="px-3 py-2.5 text-right font-extrabold text-emerald-700 dark:text-emerald-400">{fmtGHS(row.net_salary)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-indigo-700 dark:text-indigo-400">{fmtGHS(row.total_employer_cost)}</td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                            {row.bank_name ? `${row.bank_name} - ${row.bank_account_no}` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {summary && filteredDetailedItems.length > 0 && (
                      <tfoot className="bg-slate-100 dark:bg-slate-900 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                        <tr className="text-slate-900 dark:text-white">
                          <td colSpan={3} className="px-3 py-3 uppercase text-[11px] text-right font-bold">
                            Total ({summary.headcount} Staff):
                          </td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_basic_salary)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_allowances)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_gross_salary)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_ssf_employee)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_tier3_employee)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_personal_tax_relief)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_taxable_income)}</td>
                          <td className="px-3 py-3 text-right text-rose-700 dark:text-rose-400">{fmtGHS(summary.total_paye_tax)}</td>
                          <td className="px-3 py-3 text-right">{fmtGHS(summary.total_loan_deductions)}</td>
                          <td className="px-3 py-3 text-right text-rose-700 dark:text-rose-400">{fmtGHS(summary.total_deductions)}</td>
                          <td className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400">{fmtGHS(summary.total_net_salary)}</td>
                          <td className="px-3 py-3 text-right text-indigo-700 dark:text-indigo-400">{fmtGHS(summary.total_employer_cost)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </>
            )}

            {/* 5. Fallback for non-payroll reports (employees, loans, allowances) */}
            {!isPayrollReport && (
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100/90 dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr className="text-left font-bold uppercase text-[10px] text-slate-600 dark:text-slate-400">
                    {filteredDetailedItems.length > 0 &&
                      Object.keys(filteredDetailedItems[0])
                        .slice(0, 8)
                        .map((key) => (
                          <th key={key} className="px-3 py-3">
                            {key.replace(/_/g, " ")}
                          </th>
                        ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredDetailedItems.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition"
                    >
                      {Object.values(row)
                        .slice(0, 8)
                        .map((val, i) => (
                          <td
                            key={i}
                            className="px-3 py-2.5 truncate max-w-[200px] text-slate-700 dark:text-slate-300"
                          >
                            {typeof val === "boolean"
                              ? val
                                ? "Yes"
                                : "No"
                              : String(val ?? "-")}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Empty and Loading States */}
            {((reportType === "monthly-payroll" &&
              payrollViewMode === "consolidated" &&
              filteredConsolidatedItems.length === 0) ||
              (payrollViewMode !== "consolidated" &&
                filteredDetailedItems.length === 0)) &&
              !loading && (
                <div className="py-16 text-center text-slate-400 italic">
                  <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    No payroll or report records found for this period.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try selecting a different payroll period, clearing search filters, or
                    generating payroll in Process Salaries.
                  </p>
                </div>
              )}

            {loading && (
              <div className="py-16 text-center">
                <div className="animate-spin inline-block w-8 h-8 border-3 border-brand border-t-transparent rounded-full"></div>
                <p className="text-xs mt-3 text-slate-500 font-medium">
                  Loading processed report data...
                </p>
              </div>
            )}
          </div>
        </div>
          </div>
        )}
      </div>
    </Guard>
  );
}
