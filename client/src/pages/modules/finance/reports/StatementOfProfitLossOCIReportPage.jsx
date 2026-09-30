/**
 * @fileoverview StatementOfProfitLossOCIReportPage component.
 * Production-ready financial statement page for Statement of Profit or Loss and Other Comprehensive Income.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import stannessLogo from "../../../../assets/logo_stanness.png";

const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function StatementOfProfitLossOCIReportPage() {
  // Filters & State
  const [from, setFrom] = useState(() => {
    const qp = new URLSearchParams(window.location.search).get("from");
    if (qp) return qp;
    const today = new Date();
    return new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const qp = new URLSearchParams(window.location.search).get("to");
    if (qp) return qp;
    return new Date().toISOString().slice(0, 10);
  });
  const [comparative, setComparative] = useState("none"); // 'none' | 'previous_period' | 'previous_year'
  const [userBranches, setUserBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [costCenters, setCostCenters] = useState([]);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState("");
  const [loading, setLoading] = useState(false);

  // Financial Data
  const [reportData, setReportData] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    revenue: true,
    cost_of_sales: true,
    other_income: true,
    operating_expenses: true,
    finance_income: true,
    finance_costs: true,
    tax_expense: true,
    oci: true,
  });

  // Drill-down Modal State
  const [drilldownAccount, setDrilldownAccount] = useState(null);
  const [drilldownTransactions, setDrilldownTransactions] = useState([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // Reconciliation Modal State
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);
  const [reconciliationData, setReconciliationData] = useState(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);

  // Company & Presentation Settings
  const [company, setCompany] = useState(null);
  const [reportTemplate, setReportTemplate] = useState(null);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState({ code: "GHS", symbol: "₵" });

  useEffect(() => {
    async function loadCompanyAndCurrencies() {
      try {
        const [cRes, curRes, tplRes, ccRes] = await Promise.allSettled([
          api.get("/admin/companies/current"),
          api.get("/finance/currencies"),
          api.get("/templates/general-template"),
          api.get("/finance/cost-centers"),
        ]);

        if (cRes.status === "fulfilled" && cRes.value.data?.item) {
          const co = cRes.value.data.item;
          setCompany(co);

          try {
            const logoRes = await api.get(`/admin/companies/${co.id}/logo`, {
              responseType: "blob",
            });
            const reader = new FileReader();
            reader.onloadend = () => {
              setLogoDataUrl(reader.result);
            };
            reader.readAsDataURL(logoRes.data);
          } catch {
            // No custom logo uploaded
          }
        }

        if (tplRes.status === "fulfilled") {
          const list = Array.isArray(tplRes.value.data?.items)
            ? tplRes.value.data.items
            : Array.isArray(tplRes.value.data)
            ? tplRes.value.data
            : [];
          const defaultTpl = list.find((t) => t.is_default) || list[0] || null;
          if (defaultTpl) setReportTemplate(defaultTpl);
        }

        if (curRes.status === "fulfilled") {
          const list = Array.isArray(curRes.value.data?.items)
            ? curRes.value.data.items
            : Array.isArray(curRes.value.data)
            ? curRes.value.data
            : [];
          setCurrencies(list);
          const base =
            list.find((c) => c.is_base || c.is_default || c.code === "GHS") ||
            list[0];
          if (base) {
            setSelectedCurrency({
              code: base.code || "GHS",
              symbol: base.symbol || "₵",
            });
          }
        }

        if (ccRes.status === "fulfilled") {
          const list = Array.isArray(ccRes.value.data?.items)
            ? ccRes.value.data.items
            : [];
          setCostCenters(list);
        }
      } catch {
        // Fallback defaults
      }
    }
    loadCompanyAndCurrencies();
  }, []);

  useEffect(() => {
    async function fetchBranches() {
      try {
        const uRes = await api.get("/auth/me");
        const uBranches = uRes.data?.user?.branches || [];
        const isSuper =
          uRes.data?.user?.is_super_admin ||
          uRes.data?.user?.role === "SUPER_ADMIN" ||
          Number(uRes.data?.user?.id) === 1;

        if (isSuper || !uBranches.length) {
          const res = await api.get("/admin/branches");
          const fList = Array.isArray(res.data?.items)
            ? res.data.items
            : Array.isArray(res.data)
            ? res.data
            : [];
          setUserBranches(fList);
        } else {
          setUserBranches(uBranches);
          if (uBranches.length === 1) {
            setSelectedBranchId(String(uBranches[0].id));
          }
        }
      } catch {
        try {
          const res = await api.get("/admin/branches");
          const fList = Array.isArray(res.data?.items)
            ? res.data.items
            : Array.isArray(res.data)
            ? res.data
            : [];
          setUserBranches(fList);
          if (fList.length === 1) {
            setSelectedBranchId(String(fList[0].id));
          }
        } catch {
          setUserBranches([]);
        }
      }
    }
    fetchBranches();
  }, []);

  function setDatePreset(preset) {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === "today") {
      setFrom(todayStr);
      setTo(todayStr);
    } else if (preset === "month") {
      const startOfMonth = new Date(y, m, 1).toISOString().slice(0, 10);
      setFrom(startOfMonth);
      setTo(todayStr);
    } else if (preset === "prev_month") {
      const startOfPrevMonth = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const endOfPrevMonth = new Date(y, m, 0).toISOString().slice(0, 10);
      setFrom(startOfPrevMonth);
      setTo(endOfPrevMonth);
    } else if (preset === "quarter") {
      const qStartMonth = Math.floor(m / 3) * 3;
      const startOfQ = new Date(y, qStartMonth, 1).toISOString().slice(0, 10);
      setFrom(startOfQ);
      setTo(todayStr);
    } else if (preset === "year") {
      const startOfYear = new Date(y, 0, 1).toISOString().slice(0, 10);
      setFrom(startOfYear);
      setTo(todayStr);
    } else if (preset === "prev_year") {
      const startOfPrevYear = new Date(y - 1, 0, 1).toISOString().slice(0, 10);
      const endOfPrevYear = new Date(y - 1, 11, 31).toISOString().slice(0, 10);
      setFrom(startOfPrevYear);
      setTo(endOfPrevYear);
    }
  }

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/profit-loss-oci", {
        params: {
          from: from || null,
          to: to || null,
          branchId: selectedBranchId || null,
          comparative: comparative || "none",
          costCenterId: selectedCostCenterId || null,
        },
      });
      setReportData(res.data || null);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load Statement of Profit or Loss and OCI"
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    if (from && to) {
      run();
    }
  }, [from, to, selectedBranchId, comparative, selectedCostCenterId]);

  // Account Drill-down Handler
  async function openDrilldown(account) {
    try {
      setDrilldownAccount(account);
      setDrilldownLoading(true);
      const res = await api.get("/finance/reports/general-ledger", {
        params: {
          accountId: account.account_id,
          from: from || null,
          to: to || null,
          branchId: selectedBranchId || null,
        },
      });
      setDrilldownTransactions(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load account ledger transactions");
    } finally {
      setDrilldownLoading(false);
    }
  }

  // Reconciliation Check Handler
  async function checkReconciliation() {
    try {
      setReconciliationLoading(true);
      setReconciliationModalOpen(true);
      const res = await api.get("/finance/reports/statement-reconciliation", {
        params: {
          from: from || null,
          to: to || null,
          branchId: selectedBranchId || null,
        },
      });
      setReconciliationData(res.data || null);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to perform reconciliation");
    } finally {
      setReconciliationLoading(false);
    }
  }

  function toggleSection(secKey) {
    setExpandedSections((prev) => ({
      ...prev,
      [secKey]: !prev[secKey],
    }));
  }

  async function getHeaderInfo() {
    let tpl = reportTemplate;
    if (!tpl) {
      try {
        const res = await api.get("/templates/general-template");
        const list = Array.isArray(res.data?.items)
          ? res.data.items
          : Array.isArray(res.data)
          ? res.data
          : [];
        tpl = list.find((t) => t.is_default) || list[0] || null;
      } catch {}
    }

    const companyName =
      tpl?.company_name || company?.name || "OmniSuite ERP";
    const companyAddress =
      tpl?.company_address ||
      [company?.address, company?.city, company?.country]
        .filter(Boolean)
        .join(", ");
    const companyPhone = tpl?.company_phone || company?.telephone || "";
    const companyEmail = tpl?.company_email || company?.email || "";
    const companyWebsite = tpl?.company_website || company?.website || "";
    const companyTaxId = tpl?.tax_id || company?.tax_id || "";
    const logoUrl = logoDataUrl || tpl?.logo_url || null;

    return {
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      companyTaxId,
      logoUrl,
    };
  }

  function getVoucherPath(tx) {
    const code = String(tx?.voucher_type_code || "").toUpperCase();
    const base =
      code === "JV"
        ? "journal-voucher"
        : code === "PAYV"
        ? "payment-voucher"
        : code === "RV"
        ? "receipt-voucher"
        : code === "CV"
        ? "contra-voucher"
        : code === "SV"
        ? "sales-voucher"
        : code === "PV" || code === "PUV"
        ? "purchase-voucher"
        : code === "DN"
        ? "debit-note"
        : code === "CN"
        ? "credit-note"
        : "journal-voucher";
    return `/finance/${base}/${tx?.voucher_id}?mode=view`;
  }

  // Excel Export
  async function exportExcel() {
    if (!reportData) return;
    const header = await getHeaderInfo();
    const currCode = selectedCurrency.code || "GHS";
    const isComp = comparative !== "none";

    const branchName = selectedBranchId
      ? userBranches.find((b) => String(b.id) === String(selectedBranchId))
          ?.name || "Selected Branch"
      : userBranches.length === 1
      ? userBranches[0].name
      : "All Assigned Branches";

    const rows = [
      { Section: header.companyName, Code: "", Name: "", Current: "", Previous: "", Variance: "", "Variance %": "" },
      { Section: header.companyAddress || "", Code: "", Name: "", Current: "", Previous: "", Variance: "", "Variance %": "" },
      { Section: "STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME", Code: "", Name: "", Current: "", Previous: "", Variance: "", "Variance %": "" },
      { Section: `Period: ${from || "Beginning"} to ${to || "Today"} | Currency: ${currCode} | Branch: ${branchName} | Generated: ${new Date().toLocaleString()}`, Code: "", Name: "", Current: "", Previous: "", Variance: "", "Variance %": "" },
      { Section: "", Code: "", Name: "", Current: "", Previous: "", Variance: "", "Variance %": "" },
    ];

    const pushAccounts = (sectionTitle, accounts, total, prevTotal) => {
      rows.push({ Section: `=== ${sectionTitle.toUpperCase()} ===`, Code: "", Name: "", Current: "", Previous: "", Variance: "", "Variance %": "" });
      accounts.forEach((a) => {
        rows.push({
          Section: "",
          Code: a.account_code,
          Name: a.account_name,
          Current: a.current_amount,
          Previous: isComp ? a.previous_amount : "",
          Variance: isComp ? a.variance : "",
          "Variance %": isComp ? `${a.variance_percentage}%` : "",
        });
      });
      const v = total - prevTotal;
      const vPct = Math.abs(prevTotal) > 0.0001 ? (v / Math.abs(prevTotal)) * 100 : (total !== 0 ? 100 : 0);
      rows.push({
        Section: "",
        Code: "",
        Name: `TOTAL ${sectionTitle.toUpperCase()}`,
        Current: total,
        Previous: isComp ? prevTotal : "",
        Variance: isComp ? v : "",
        "Variance %": isComp ? `${vPct.toFixed(2)}%` : "",
      });
      rows.push({ Section: "", Code: "", Name: "", Current: "", Previous: "", Variance: "", "Variance %": "" });
    };

    const s = reportData.sections;
    pushAccounts("Revenue", s.revenue.accounts, s.revenue.total, s.revenue.prev_total);
    pushAccounts("Cost of Sales", s.cost_of_sales.accounts, s.cost_of_sales.total, s.cost_of_sales.prev_total);

    // Gross Profit
    rows.push({
      Section: "=== GROSS PROFIT ===",
      Code: "",
      Name: `GROSS PROFIT (Margin: ${reportData.totals.gross_profit_margin}%)`,
      Current: reportData.totals.gross_profit,
      Previous: isComp ? (s.revenue.prev_total - s.cost_of_sales.prev_total) : "",
      Variance: isComp ? (reportData.totals.gross_profit - (s.revenue.prev_total - s.cost_of_sales.prev_total)) : "",
      "Variance %": "",
    });
    rows.push({ Section: "", Code: "", Name: "", Current: "", Previous: "", Variance: "", "Variance %": "" });

    pushAccounts("Other Operating Income", s.other_income.accounts, s.other_income.total, s.other_income.prev_total);

    // Operating Expenses
    const opex = s.operating_expenses;
    const allOpex = [
      ...opex.subcategories.admin.accounts,
      ...opex.subcategories.selling.accounts,
      ...opex.subcategories.other.accounts,
    ];
    pushAccounts("Operating Expenses", allOpex, opex.total, opex.prev_total);

    // Operating Profit
    rows.push({
      Section: "=== OPERATING PROFIT ===",
      Code: "",
      Name: `OPERATING PROFIT / EBIT (Margin: ${reportData.totals.operating_profit_margin}%)`,
      Current: reportData.totals.operating_profit,
      Previous: isComp ? (reportData.kpi_summary.operating_profit.previous) : "",
      Variance: isComp ? (reportData.kpi_summary.operating_profit.variance) : "",
      "Variance %": isComp ? `${reportData.kpi_summary.operating_profit.variance_percentage}%` : "",
    });
    rows.push({ Section: "", Code: "", Name: "", Current: "", Previous: "", Variance: "", "Variance %": "" });

    pushAccounts("Finance Income", s.finance_income.accounts, s.finance_income.total, s.finance_income.prev_total);
    pushAccounts("Finance Costs", s.finance_costs.accounts, s.finance_costs.total, s.finance_costs.prev_total);

    // Profit Before Tax
    rows.push({
      Section: "=== PROFIT BEFORE TAX ===",
      Code: "",
      Name: "PROFIT BEFORE TAX",
      Current: reportData.totals.profit_before_tax,
      Previous: isComp ? (reportData.kpi_summary.profit_before_tax.previous) : "",
      Variance: isComp ? (reportData.kpi_summary.profit_before_tax.variance) : "",
      "Variance %": isComp ? `${reportData.kpi_summary.profit_before_tax.variance_percentage}%` : "",
    });
    rows.push({ Section: "", Code: "", Name: "", Current: "", Previous: "", Variance: "", "Variance %": "" });

    pushAccounts("Income Tax Expense", s.tax_expense.accounts, s.tax_expense.total, s.tax_expense.prev_total);

    // Profit for the Period
    rows.push({
      Section: "=== PROFIT FOR THE PERIOD ===",
      Code: "",
      Name: `PROFIT FOR THE PERIOD / PAT (Net Margin: ${reportData.totals.net_profit_margin}%)`,
      Current: reportData.totals.profit_for_the_period,
      Previous: isComp ? (reportData.kpi_summary.profit_for_the_period.previous) : "",
      Variance: isComp ? (reportData.kpi_summary.profit_for_the_period.variance) : "",
      "Variance %": isComp ? `${reportData.kpi_summary.profit_for_the_period.variance_percentage}%` : "",
    });
    rows.push({ Section: "", Code: "", Name: "", Current: "", Previous: "", Variance: "", "Variance %": "" });

    pushAccounts("Other Comprehensive Income", s.oci.accounts, s.oci.total, s.oci.prev_total);

    // Total Comprehensive Income
    rows.push({
      Section: "=== TOTAL COMPREHENSIVE INCOME ===",
      Code: "",
      Name: "TOTAL COMPREHENSIVE INCOME FOR THE PERIOD",
      Current: reportData.totals.total_comprehensive_income,
      Previous: isComp ? (reportData.kpi_summary.total_comprehensive_income.previous) : "",
      Variance: isComp ? (reportData.kpi_summary.total_comprehensive_income.variance) : "",
      "Variance %": isComp ? `${reportData.kpi_summary.total_comprehensive_income.variance_percentage}%` : "",
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ProfitLossAndOCI");
    XLSX.writeFile(wb, `statement-of-profit-or-loss-and-oci-${from}-to-${to}.xlsx`);
  }

  // PDF Export
  async function exportPDF() {
    if (!reportData) return;
    const header = await getHeaderInfo();
    const doc = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const margin = 14;
    let y = 14;
    const currCode = selectedCurrency.code || "GHS";
    const currPrefix = currCode === "GHS" ? "GH " : `${currCode} `;
    const isComp = comparative !== "none";

    const branchName = selectedBranchId
      ? userBranches.find((b) => String(b.id) === String(selectedBranchId))?.name || "Selected Branch"
      : userBranches.length === 1
      ? userBranches[0].name
      : "All Assigned Branches";

    // Header Logo & Company Info
    if (header.logoUrl) {
      try {
        doc.addImage(header.logoUrl, "PNG", margin, y, 24, 24);
      } catch {
        doc.addImage(stannessLogo, "PNG", margin, y, 24, 24);
      }
    } else {
      doc.addImage(stannessLogo, "PNG", margin, y, 24, 24);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(header.companyName, pageW - margin, y + 4, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    let topR = y + 8;
    if (header.companyAddress) {
      doc.text(header.companyAddress, pageW - margin, topR, { align: "right" });
      topR += 3.5;
    }
    const cLine = [header.companyPhone, header.companyEmail].filter(Boolean).join(" | ");
    if (cLine) {
      doc.text(cLine, pageW - margin, topR, { align: "right" });
      topR += 3.5;
    }

    y = Math.max(y + 28, topR + 4);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // Statement Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Period: ${from || "Beginning"} to ${to || "Today"}  |  Currency: ${currCode}  |  Branch: ${branchName}  |  Generated: ${new Date().toLocaleDateString()}`,
      margin,
      y
    );
    y += 8;

    // Render Table Sections in PDF
    const checkPage = (need = 12) => {
      if (y + need > 280) {
        doc.addPage();
        y = 15;
      }
    };

    const renderPdfSection = (title, accounts, total, prevTotal) => {
      checkPage(15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(title.toUpperCase(), margin, y);
      y += 4;

      if (!accounts.length) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("No transactions recorded in this category for this period.", margin + 4, y);
        y += 5;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        accounts.forEach((a) => {
          checkPage(6);
          doc.setTextColor(71, 85, 105);
          doc.text(`${a.account_code}  ${a.account_name}`, margin + 4, y);
          doc.text(`${currPrefix}${fmt(a.current_amount)}`, pageW - margin, y, { align: "right" });
          y += 4.5;
        });
      }

      // Subtotal
      checkPage(7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Total ${title}`, margin + 2, y);
      doc.text(`${currPrefix}${fmt(total)}`, pageW - margin, y, { align: "right" });
      y += 6;
    };

    const renderMajorSubtotal = (title, amount, note = "") => {
      checkPage(10);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y - 3.5, pageW - 2 * margin, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${title} ${note ? `(${note})` : ""}`, margin + 2, y + 1);
      doc.text(`${currPrefix}${fmt(amount)}`, pageW - margin - 2, y + 1, { align: "right" });
      y += 8;
    };

    const s = reportData.sections;
    renderPdfSection("Revenue", s.revenue.accounts, s.revenue.total, s.revenue.prev_total);
    renderPdfSection("Cost of Sales", s.cost_of_sales.accounts, s.cost_of_sales.total, s.cost_of_sales.prev_total);
    renderMajorSubtotal("GROSS PROFIT", reportData.totals.gross_profit, `Margin: ${reportData.totals.gross_profit_margin}%`);

    renderPdfSection("Other Operating Income", s.other_income.accounts, s.other_income.total, s.other_income.prev_total);

    const allOpex = [
      ...s.operating_expenses.subcategories.admin.accounts,
      ...s.operating_expenses.subcategories.selling.accounts,
      ...s.operating_expenses.subcategories.other.accounts,
    ];
    renderPdfSection("Operating Expenses", allOpex, s.operating_expenses.total, s.operating_expenses.prev_total);
    renderMajorSubtotal("OPERATING PROFIT (EBIT)", reportData.totals.operating_profit, `Margin: ${reportData.totals.operating_profit_margin}%`);

    renderPdfSection("Finance Income", s.finance_income.accounts, s.finance_income.total, s.finance_income.prev_total);
    renderPdfSection("Finance Costs", s.finance_costs.accounts, s.finance_costs.total, s.finance_costs.prev_total);
    renderMajorSubtotal("PROFIT BEFORE TAX (PBT)", reportData.totals.profit_before_tax);

    renderPdfSection("Income Tax Expense", s.tax_expense.accounts, s.tax_expense.total, s.tax_expense.prev_total);
    renderMajorSubtotal("PROFIT FOR THE PERIOD (PAT)", reportData.totals.profit_for_the_period, `Net Margin: ${reportData.totals.net_profit_margin}%`);

    renderPdfSection("Other Comprehensive Income", s.oci.accounts, s.oci.total, s.oci.prev_total);

    // Final Total Comprehensive Income
    checkPage(14);
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y - 4, pageW - 2 * margin, 8.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL COMPREHENSIVE INCOME FOR THE PERIOD", margin + 3, y + 1.5);
    doc.text(`${currPrefix}${fmt(reportData.totals.total_comprehensive_income)}`, pageW - margin - 3, y + 1.5, { align: "right" });
    y += 16;

    // Sign-off block
    checkPage(20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Prepared By: ___________________________", margin, y);
    doc.text("Approved By: ___________________________", margin + 70, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageW - margin, y, { align: "right" });

    doc.save(`statement-of-profit-or-loss-and-oci-${from}-to-${to}.pdf`);
  }

  const kpis = reportData?.kpi_summary || {};
  const isComparative = comparative !== "none";

  function renderStatementSection(key, title, accounts, total, prevTotal, badgeColor, headerBg) {
    const isExp = expandedSections[key];
    const v = total - prevTotal;
    const vPct = Math.abs(prevTotal) > 0.0001 ? (v / Math.abs(prevTotal)) * 100 : (total !== 0 ? 100 : 0);

    return (
      <React.Fragment key={key}>
        {/* Section Header */}
        <tr className={`${headerBg} cursor-pointer select-none hover:brightness-95 transition-all`} onClick={() => toggleSection(key)}>
          <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="text-slate-400 text-xs">{isExp ? "▼" : "▶"}</span>
            <span className="tracking-wide uppercase text-xs">{title}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border ${badgeColor}`}>
              {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
            </span>
          </td>
          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
            {selectedCurrency.symbol}{fmt(total)}
          </td>
          {isComparative && (
            <>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                {selectedCurrency.symbol}{fmt(prevTotal)}
              </td>
              <td className={`py-2.5 px-4 text-right font-mono text-xs font-semibold ${v >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {v >= 0 ? "+" : ""}{selectedCurrency.symbol}{fmt(v)}
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-500">
                {vPct.toFixed(2)}%
              </td>
            </>
          )}
        </tr>

        {/* Section Accounts */}
        {isExp && accounts.length === 0 && (
          <tr className="bg-white dark:bg-slate-800">
            <td colSpan={isComparative ? 5 : 2} className="py-2 px-8 text-xs text-slate-400 italic">
              No account transactions recorded for this period.
            </td>
          </tr>
        )}

        {isExp && accounts.map((acc) => (
          <tr
            key={acc.account_id}
            className="hover:bg-blue-50/40 dark:hover:bg-slate-700/40 transition-colors bg-white dark:bg-slate-800"
          >
            <td className="py-2 px-8">
              <button
                type="button"
                onClick={() => openDrilldown(acc)}
                className="flex items-center gap-2 text-left group"
                title="Click to view underlying ledger journal entries"
              >
                <span className="font-mono text-xs font-bold text-brand group-hover:underline">
                  {acc.account_code}
                </span>
                <span className="text-slate-700 dark:text-slate-300 group-hover:text-brand font-medium">
                  {acc.account_name}
                </span>
                <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  🔍 Drilldown
                </span>
              </button>
            </td>
            <td className="py-2 px-4 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
              {selectedCurrency.symbol}{fmt(acc.current_amount)}
            </td>
            {isComparative && (
              <>
                <td className="py-2 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                  {selectedCurrency.symbol}{fmt(acc.previous_amount)}
                </td>
                <td className={`py-2 px-4 text-right font-mono text-xs ${acc.variance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {acc.variance >= 0 ? "+" : ""}{selectedCurrency.symbol}{fmt(acc.variance)}
                </td>
                <td className="py-2 px-4 text-right font-mono text-xs text-slate-500">
                  {acc.variance_percentage}%
                </td>
              </>
            )}
          </tr>
        ))}
      </React.Fragment>
    );
  }

  function renderComparativeCells(curr, prev) {
    const v = curr - prev;
    const pct = Math.abs(prev) > 0.0001 ? (v / Math.abs(prev)) * 100 : (curr !== 0 ? 100 : 0);
    return (
      <>
        <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
          {selectedCurrency.symbol}{fmt(prev)}
        </td>
        <td className={`py-3 px-4 text-right font-mono text-xs font-bold ${v >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {v >= 0 ? "+" : ""}{selectedCurrency.symbol}{fmt(v)}
        </td>
        <td className="py-3 px-4 text-right font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
          {pct.toFixed(2)}%
        </td>
      </>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <button
            onClick={() => window.history.back()}
            className="font-sans text-xs font-bold text-brand uppercase tracking-wider hover:text-brand-600 transition-colors"
          >
            ← Back to Finance
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">
            Statement of Profit or Loss & OCI
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Authoritative IAS 1 / IFRS financial statement of comprehensive income dynamically derived from the general ledger
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1 text-slate-700 dark:text-slate-200"
            onClick={checkReconciliation}
          >
            ⚖️ Reconcile Report
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => window.print()}
          >
            🖨️ Print
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={exportExcel}
            disabled={!reportData}
          >
            📊 Excel ({selectedCurrency.code})
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm shadow-sm"
            onClick={exportPDF}
            disabled={!reportData}
          >
            📄 PDF ({selectedCurrency.code})
          </button>
        </div>
      </div>

      {/* KPI Performance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-emerald-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Revenue</p>
          <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {selectedCurrency.symbol}{fmt(kpis.revenue?.current)}
          </h3>
          {isComparative && (
            <p className="text-[10px] font-semibold text-slate-400 mt-1">
              Var: {kpis.revenue?.variance_percentage >= 0 ? "+" : ""}{kpis.revenue?.variance_percentage}%
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-blue-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gross Profit</p>
          <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {selectedCurrency.symbol}{fmt(kpis.gross_profit?.current)}
          </h3>
          <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-1">
            Margin: {kpis.gross_profit?.margin}%
          </p>
        </div>

        <div className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-y border-r border-slate-200 dark:border-slate-700 ${(kpis.operating_profit?.current || 0) >= 0 ? "border-indigo-500" : "border-rose-500"}`}>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operating Profit</p>
          <h3 className={`text-lg md:text-xl font-black mt-1 ${(kpis.operating_profit?.current || 0) >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600"}`}>
            {selectedCurrency.symbol}{fmt(kpis.operating_profit?.current)}
          </h3>
          <p className="text-[10px] font-semibold text-slate-400 mt-1">
            Margin: {kpis.operating_profit?.margin}%
          </p>
        </div>

        <div className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-y border-r border-slate-200 dark:border-slate-700 ${(kpis.profit_before_tax?.current || 0) >= 0 ? "border-cyan-500" : "border-rose-500"}`}>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Profit Before Tax</p>
          <h3 className={`text-lg md:text-xl font-black mt-1 ${(kpis.profit_before_tax?.current || 0) >= 0 ? "text-slate-900 dark:text-slate-100" : "text-rose-600"}`}>
            {selectedCurrency.symbol}{fmt(kpis.profit_before_tax?.current)}
          </h3>
          {isComparative && (
            <p className="text-[10px] font-semibold text-slate-400 mt-1">
              Var: {kpis.profit_before_tax?.variance_percentage >= 0 ? "+" : ""}{kpis.profit_before_tax?.variance_percentage}%
            </p>
          )}
        </div>

        <div className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-y border-r border-slate-200 dark:border-slate-700 ${(kpis.profit_for_the_period?.current || 0) >= 0 ? "border-emerald-600" : "border-rose-600"}`}>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Profit For Period</p>
          <h3 className={`text-lg md:text-xl font-black mt-1 ${(kpis.profit_for_the_period?.current || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {selectedCurrency.symbol}{fmt(kpis.profit_for_the_period?.current)}
          </h3>
          <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
            Net: {kpis.profit_for_the_period?.net_margin}%
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-violet-600 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total OCI / Comp.</p>
          <h3 className={`text-lg md:text-xl font-black mt-1 ${(kpis.total_comprehensive_income?.current || 0) >= 0 ? "text-violet-600" : "text-rose-600"}`}>
            {selectedCurrency.symbol}{fmt(kpis.total_comprehensive_income?.current)}
          </h3>
          <p className="text-[10px] font-semibold text-slate-400 mt-1">
            IAS 1 Statement Total
          </p>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs font-semibold text-slate-500 mr-1">Presets:</span>
          <button type="button" className="btn btn-xs btn-ghost" onClick={() => setDatePreset("today")}>Today</button>
          <button type="button" className="btn btn-xs btn-ghost" onClick={() => setDatePreset("month")}>This Month</button>
          <button type="button" className="btn btn-xs btn-ghost" onClick={() => setDatePreset("prev_month")}>Last Month</button>
          <button type="button" className="btn btn-xs btn-ghost" onClick={() => setDatePreset("quarter")}>This Qtr</button>
          <button type="button" className="btn btn-xs btn-ghost" onClick={() => setDatePreset("year")}>YTD</button>
          <button type="button" className="btn btn-xs btn-ghost" onClick={() => setDatePreset("prev_year")}>Prev Year</button>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 hidden md:block" />

        {/* Date Inputs */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">From:</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input input-bordered input-xs rounded"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">To:</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input input-bordered input-xs rounded"
          />
        </div>

        {/* Comparative Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Compare:</label>
          <select
            value={comparative}
            onChange={(e) => setComparative(e.target.value)}
            className="select select-bordered select-xs rounded"
          >
            <option value="none">No Comparison</option>
            <option value="previous_period">Previous Period</option>
            <option value="previous_year">Previous Year</option>
          </select>
        </div>

        {/* Branch Filter */}
        {userBranches.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Branch:</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="select select-bordered select-xs rounded"
            >
              <option value="">All Branches</option>
              {userBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name || b.code}</option>
              ))}
            </select>
          </div>
        )}

        {/* Cost Center Filter */}
        {costCenters.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Cost Center:</label>
            <select
              value={selectedCostCenterId}
              onChange={(e) => setSelectedCostCenterId(e.target.value)}
              className="select select-bordered select-xs rounded"
            >
              <option value="">All Cost Centers</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>
              ))}
            </select>
          </div>
        )}

        {/* Currency Filter */}
        {currencies.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Currency:</label>
            <select
              value={selectedCurrency.code}
              onChange={(e) => {
                const c = currencies.find((cur) => cur.code === e.target.value);
                if (c) setSelectedCurrency({ code: c.code, symbol: c.symbol || "" });
              }}
              className="select select-bordered select-xs rounded font-mono"
            >
              {currencies.map((c) => (
                <option key={c.id} value={c.code}>{c.code} ({c.symbol})</option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="btn btn-primary btn-xs ml-auto"
        >
          {loading ? "Generating..." : "Apply Filter"}
        </button>
      </div>

      {/* Main Financial Statement Document */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Printable Report Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs font-mono font-bold tracking-widest text-brand uppercase">
              Financial Statement of Comprehensive Income (IAS 1)
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 uppercase">
              {company?.name || "OmniSuite ERP"}
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Statement of Profit or Loss and Other Comprehensive Income for the period ended {to || "Current Date"}
            </p>
          </div>
          <div className="text-right">
            <div className="badge badge-outline text-xs font-mono font-bold">
              Base Currency: {selectedCurrency.code} ({selectedCurrency.symbol})
            </div>
            {isComparative && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Comparative: {comparative === "previous_year" ? "Prior Fiscal Year" : "Preceding Accounting Period"}
              </p>
            )}
          </div>
        </div>

        {/* Financial Statement Table */}
        {loading ? (
          <div className="p-16 text-center">
            <span className="loading loading-spinner loading-lg text-brand" />
            <p className="mt-3 text-sm font-semibold text-slate-500">Calculating authoritative ledger balances...</p>
          </div>
        ) : !reportData ? (
          <div className="p-16 text-center">
            <p className="text-sm font-semibold text-slate-500">No financial statement data available for the selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-2/5">Line Item / Account Classification</th>
                  <th className="py-3 px-4 text-right w-1/5">Current Period ({selectedCurrency.code})</th>
                  {isComparative && (
                    <>
                      <th className="py-3 px-4 text-right w-1/5">Previous Period ({selectedCurrency.code})</th>
                      <th className="py-3 px-4 text-right w-1/10">Variance</th>
                      <th className="py-3 px-4 text-right w-1/10">Var %</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* 1. REVENUE */}
                {renderStatementSection(
                  "revenue",
                  "1. Revenue",
                  reportData.sections.revenue.accounts,
                  reportData.sections.revenue.total,
                  reportData.sections.revenue.prev_total,
                  "text-emerald-700 dark:text-emerald-400",
                  "bg-emerald-50/40 dark:bg-emerald-950/20"
                )}

                {/* 2. COST OF SALES */}
                {renderStatementSection(
                  "cost_of_sales",
                  "2. Cost of Sales",
                  reportData.sections.cost_of_sales.accounts,
                  reportData.sections.cost_of_sales.total,
                  reportData.sections.cost_of_sales.prev_total,
                  "text-slate-700 dark:text-slate-300",
                  "bg-slate-50/40 dark:bg-slate-800/40"
                )}

                {/* GROSS PROFIT HIGHLIGHT */}
                <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-y-2 border-blue-200 dark:border-blue-800 font-black text-slate-900 dark:text-slate-100">
                  <td className="py-3 px-4 flex items-center justify-between">
                    <span className="text-sm font-black tracking-wide">GROSS PROFIT</span>
                    <span className="badge badge-sm badge-info font-bold">Margin: {reportData.totals.gross_profit_margin}%</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-base text-blue-900 dark:text-blue-300">
                    {selectedCurrency.symbol}{fmt(reportData.totals.gross_profit)}
                  </td>
                  {isComparative && renderComparativeCells(
                    reportData.totals.gross_profit,
                    reportData.sections.revenue.prev_total - reportData.sections.cost_of_sales.prev_total
                  )}
                </tr>

                {/* 3. OTHER OPERATING INCOME */}
                {renderStatementSection(
                  "other_income",
                  "3. Other Operating Income",
                  reportData.sections.other_income.accounts,
                  reportData.sections.other_income.total,
                  reportData.sections.other_income.prev_total,
                  "text-teal-700 dark:text-teal-400",
                  "bg-teal-50/30 dark:bg-teal-950/20"
                )}

                {/* 4. OPERATING EXPENSES */}
                {renderStatementSection(
                  "operating_expenses",
                  "4. Operating Expenses",
                  [
                    ...reportData.sections.operating_expenses.subcategories.admin.accounts,
                    ...reportData.sections.operating_expenses.subcategories.selling.accounts,
                    ...reportData.sections.operating_expenses.subcategories.other.accounts,
                  ],
                  reportData.sections.operating_expenses.total,
                  reportData.sections.operating_expenses.prev_total,
                  "text-rose-700 dark:text-rose-400",
                  "bg-rose-50/30 dark:bg-rose-950/20"
                )}

                {/* OPERATING PROFIT / EBIT */}
                <tr className="bg-indigo-50/80 dark:bg-indigo-950/40 border-y-2 border-indigo-200 dark:border-indigo-800 font-black text-slate-900 dark:text-slate-100">
                  <td className="py-3 px-4 flex items-center justify-between">
                    <span className="text-sm font-black tracking-wide">OPERATING PROFIT (EBIT)</span>
                    <span className="badge badge-sm badge-primary font-bold">Margin: {reportData.totals.operating_profit_margin}%</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-base text-indigo-900 dark:text-indigo-300">
                    {selectedCurrency.symbol}{fmt(reportData.totals.operating_profit)}
                  </td>
                  {isComparative && renderComparativeCells(
                    reportData.totals.operating_profit,
                    reportData.kpi_summary.operating_profit.previous
                  )}
                </tr>

                {/* 5. FINANCE INCOME */}
                {renderStatementSection(
                  "finance_income",
                  "5. Finance Income",
                  reportData.sections.finance_income.accounts,
                  reportData.sections.finance_income.total,
                  reportData.sections.finance_income.prev_total,
                  "text-emerald-700 dark:text-emerald-400",
                  "bg-emerald-50/30 dark:bg-emerald-950/20"
                )}

                {/* 6. FINANCE COSTS */}
                {renderStatementSection(
                  "finance_costs",
                  "6. Finance Costs",
                  reportData.sections.finance_costs.accounts,
                  reportData.sections.finance_costs.total,
                  reportData.sections.finance_costs.prev_total,
                  "text-amber-700 dark:text-amber-400",
                  "bg-amber-50/30 dark:bg-amber-950/20"
                )}

                {/* PROFIT BEFORE TAX (PBT) */}
                <tr className="bg-slate-100 dark:bg-slate-800/80 border-y-2 border-slate-300 dark:border-slate-600 font-black text-slate-900 dark:text-slate-100">
                  <td className="py-3 px-4">
                    <span className="text-sm font-black tracking-wide">PROFIT BEFORE TAX (PBT)</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-base text-slate-900 dark:text-slate-100">
                    {selectedCurrency.symbol}{fmt(reportData.totals.profit_before_tax)}
                  </td>
                  {isComparative && renderComparativeCells(
                    reportData.totals.profit_before_tax,
                    reportData.kpi_summary.profit_before_tax.previous
                  )}
                </tr>

                {/* 7. INCOME TAX EXPENSE */}
                {renderStatementSection(
                  "tax_expense",
                  "7. Income Tax Expense",
                  reportData.sections.tax_expense.accounts,
                  reportData.sections.tax_expense.total,
                  reportData.sections.tax_expense.prev_total,
                  "text-rose-700 dark:text-rose-400",
                  "bg-rose-50/20 dark:bg-rose-950/10"
                )}

                {/* PROFIT FOR THE PERIOD (PAT) */}
                <tr className="bg-emerald-100/70 dark:bg-emerald-950/50 border-y-2 border-emerald-300 dark:border-emerald-700 font-black text-slate-900 dark:text-slate-100">
                  <td className="py-3 px-4 flex items-center justify-between">
                    <span className="text-base font-black tracking-wide text-emerald-950 dark:text-emerald-200">
                      PROFIT FOR THE PERIOD (NET PROFIT)
                    </span>
                    <span className="badge badge-sm badge-success font-bold text-white">
                      Net Margin: {reportData.totals.net_profit_margin}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-lg text-emerald-900 dark:text-emerald-300">
                    {selectedCurrency.symbol}{fmt(reportData.totals.profit_for_the_period)}
                  </td>
                  {isComparative && renderComparativeCells(
                    reportData.totals.profit_for_the_period,
                    reportData.kpi_summary.profit_for_the_period.previous
                  )}
                </tr>

                {/* 8. OTHER COMPREHENSIVE INCOME (OCI) */}
                {renderStatementSection(
                  "oci",
                  "8. Other Comprehensive Income (OCI)",
                  reportData.sections.oci.accounts,
                  reportData.sections.oci.total,
                  reportData.sections.oci.prev_total,
                  "text-purple-700 dark:text-purple-400",
                  "bg-purple-50/30 dark:bg-purple-950/20"
                )}

                {/* TOTAL COMPREHENSIVE INCOME */}
                <tr className="bg-slate-900 dark:bg-slate-950 text-white font-black border-t-4 border-slate-900">
                  <td className="py-4 px-4">
                    <span className="text-base tracking-wider uppercase">
                      TOTAL COMPREHENSIVE INCOME FOR THE PERIOD
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-xl text-emerald-400">
                    {selectedCurrency.symbol}{fmt(reportData.totals.total_comprehensive_income)}
                  </td>
                  {isComparative && (
                    <>
                      <td className="py-4 px-4 text-right font-mono text-slate-300">
                        {selectedCurrency.symbol}{fmt(reportData.kpi_summary.total_comprehensive_income.previous)}
                      </td>
                      <td className={`py-4 px-4 text-right font-mono text-sm ${reportData.kpi_summary.total_comprehensive_income.variance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {reportData.kpi_summary.total_comprehensive_income.variance >= 0 ? "+" : ""}{selectedCurrency.symbol}{fmt(reportData.kpi_summary.total_comprehensive_income.variance)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-sm text-slate-300">
                        {reportData.kpi_summary.total_comprehensive_income.variance_percentage}%
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account Drilldown Modal */}
      {drilldownAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div>
                <span className="text-xs font-mono font-bold text-brand uppercase">Ledger Transaction Drill-Down</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {drilldownAccount.account_code} — {drilldownAccount.account_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing all posted journal vouchers affecting this account between {from} and {to}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-circle btn-ghost text-lg"
                onClick={() => setDrilldownAccount(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body Table */}
            <div className="p-4 overflow-y-auto flex-1">
              {drilldownLoading ? (
                <div className="p-12 text-center">
                  <span className="loading loading-spinner loading-md text-brand" />
                  <p className="mt-2 text-xs font-semibold text-slate-500">Loading vouchers...</p>
                </div>
              ) : drilldownTransactions.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-semibold text-sm">
                  No individual ledger transactions found for this account in the specified date range.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900/70 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Voucher No</th>
                      <th className="py-2.5 px-3">Narration / Description</th>
                      <th className="py-2.5 px-3 text-right">Debit</th>
                      <th className="py-2.5 px-3 text-right">Credit</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {drilldownTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {tx.voucher_date ? new Date(tx.voucher_date).toLocaleDateString() : "-"}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-brand whitespace-nowrap">
                          {tx.voucher_no || "-"}
                        </td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-200">
                          {tx.narration || tx.description || "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                          {Number(tx.debit || 0) > 0 ? `${selectedCurrency.symbol}${fmt(tx.debit)}` : "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                          {Number(tx.credit || 0) > 0 ? `${selectedCurrency.symbol}${fmt(tx.credit)}` : "-"}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <Link
                            to={getVoucherPath(tx)}
                            target="_blank"
                            className="btn btn-ghost btn-xs text-brand hover:underline font-bold"
                          >
                            View Voucher ↗
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500">
                Total Movements: {drilldownTransactions.length} lines
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setDrilldownAccount(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trial Balance Reconciliation Modal */}
      {reconciliationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚖️</span>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    Trial Balance Reconciliation Audit
                  </h3>
                  <p className="text-xs text-slate-500">
                    Period: {from} to {to}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-circle btn-ghost"
                onClick={() => setReconciliationModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {reconciliationLoading ? (
                <div className="p-8 text-center">
                  <span className="loading loading-spinner loading-md text-brand" />
                  <p className="mt-2 text-xs font-semibold text-slate-500">Validating Trial Balance ledger math...</p>
                </div>
              ) : reconciliationData ? (
                <>
                  <div className={`p-4 rounded-xl border flex items-center gap-3 ${reconciliationData.is_reconciled ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200" : "bg-rose-50 border-rose-300 text-rose-900"}`}>
                    <span className="text-2xl">{reconciliationData.is_reconciled ? "✓" : "⚠"}</span>
                    <div>
                      <h4 className="font-bold text-sm">
                        {reconciliationData.is_reconciled ? "Statement Mathematically Reconciles with Trial Balance" : "Reconciliation Differences Detected"}
                      </h4>
                      <p className="text-xs mt-0.5 opacity-90">{reconciliationData.message}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-slate-500">Trial Balance Total Income:</span>
                      <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {selectedCurrency.symbol}{fmt(reconciliationData.trial_balance_summary?.total_income)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Trial Balance Total Expenses:</span>
                      <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {selectedCurrency.symbol}{fmt(reconciliationData.trial_balance_summary?.total_expenses)}
                      </p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Net Profit Reconciled:</span>
                      <span className="font-mono font-black text-emerald-600 text-base">
                        {selectedCurrency.symbol}{fmt(reconciliationData.trial_balance_summary?.net_profit)}
                      </span>
                    </div>
                  </div>

                  {reconciliationData.unposted_transactions?.count > 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                      ℹ <strong>Note:</strong> There are {reconciliationData.unposted_transactions.count} draft/unposted voucher(s) totaling {selectedCurrency.symbol}{fmt(reconciliationData.unposted_transactions.total_amount)} excluded from the statement in accordance with authoritative posting rules.
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setReconciliationModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
