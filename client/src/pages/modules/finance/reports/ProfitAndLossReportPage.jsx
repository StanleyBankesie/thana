/**
 * @fileoverview ProfitAndLossReportPage component.
 * Provides functionality for ProfitAndLossReportPage.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import stannessLogo from "../../../../assets/logo_stanness.png";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProfitAndLossReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userBranches, setUserBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [income, setIncome] = useState({ items: [], total: 0 });
  const [expenses, setExpenses] = useState({ items: [], total: 0 });
  const [net, setNet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState(5);
  const [company, setCompany] = useState(null);
  const [reportTemplate, setReportTemplate] = useState(null);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState({ code: "GHS", symbol: "₵" });

  useEffect(() => {
    async function loadCompanyAndCurrencies() {
      try {
        const [cRes, curRes, tplRes] = await Promise.allSettled([
          api.get("/admin/companies/current"),
          api.get("/finance/currencies"),
          api.get("/templates/general-template"),
        ]);

        if (cRes.status === "fulfilled" && cRes.value.data?.item) {
          const co = cRes.value.data.item;
          setCompany(co);

          try {
            const logoRes = await api.get(`/admin/companies/${co.id}/logo`, { responseType: "blob" });
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
          const base = list.find((c) => c.is_base || c.is_default || c.code === "GHS") || list[0];
          if (base) {
            setSelectedCurrency({
              code: base.code || "GHS",
              symbol: base.symbol || "₵",
            });
          }
        }
      } catch {
        // Fallback defaults
      }
    }
    loadCompanyAndCurrencies();
  }, []);

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

    let co = company;
    if (!co) {
      try {
        const res = await api.get("/admin/companies/current");
        co = res.data?.item || null;
      } catch {}
    }

    const companyName = tpl?.header_name?.trim() || co?.name || "Seriana Mart";
    const companyAddress = tpl?.header_address?.trim() || [co?.address, co?.city, co?.country].filter(Boolean).join(", ");
    const companyPhone = tpl?.header_phone?.trim() || co?.telephone || co?.phone || "";
    const companyEmail = tpl?.header_email?.trim() || co?.email || "";
    const logoUrl = tpl?.header_logo_url?.trim() || logoDataUrl || stannessLogo;

    return { companyName, companyAddress, companyPhone, companyEmail, logoUrl };
  }

  useEffect(() => {
    async function fetchBranches() {
      try {
        const res = await api.get("/auth/user-branches");
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        setUserBranches(list);
        if (list.length === 1) {
          setSelectedBranchId(String(list[0].id));
        }
      } catch {
        try {
          const fallbackRes = await api.get("/admin/branches");
          const fList = Array.isArray(fallbackRes.data?.items)
            ? fallbackRes.data.items
            : Array.isArray(fallbackRes.data)
            ? fallbackRes.data
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

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/profit-and-loss", {
        params: {
          from: from || null,
          to: to || null,
          branchId: selectedBranchId || null,
        },
      });
      setIncome(res.data?.income || { items: [], total: 0 });
      setExpenses(res.data?.expenses || { items: [], total: 0 });
      setNet(Number(res.data?.net_profit || 0));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load P&L");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date();
    const jan1 = new Date(today.getFullYear(), 0, 1);
    setFrom(jan1.toISOString().slice(0, 10));
    setTo(today.toISOString().slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, selectedBranchId, pollingCounter]);

  // Flatten tree for export purposes
  function flattenTree(nodes, maxLevel = 99, rows = [], section = "") {
    if (!nodes || !Array.isArray(nodes)) return rows;
    for (const node of nodes) {
      if (node.level > maxLevel) continue;
      if (node.type === "group") {
        rows.push({
          Section: section,
          Type: "Group",
          Level: node.level,
          Code: node.code || "",
          Name: node.name,
          Amount: Number(node.amount || 0),
        });
        flattenTree(node.children, maxLevel, rows, section);
        flattenTree(node.accounts, maxLevel, rows, section);
      } else {
        rows.push({
          Section: section,
          Type: "Account",
          Level: node.level,
          Code: node.account_code || "",
          Name: node.account_name || "",
          Amount: Number(node.amount || 0),
        });
      }
    }
    return rows;
  }

  async function exportExcel() {
    const header = await getHeaderInfo();
    const currCode = selectedCurrency.code || "GHS";
    const currSymbol = selectedCurrency.symbol || "₵";

    const branchName = selectedBranchId
      ? userBranches.find((b) => String(b.id) === String(selectedBranchId))?.name || "Selected Branch"
      : userBranches.length === 1
      ? userBranches[0].name
      : "All Assigned Branches";

    const contactParts = [];
    if (header.companyPhone) contactParts.push(`Contact No: ${header.companyPhone}`);
    if (header.companyEmail) contactParts.push(`Email: ${header.companyEmail}`);

    const headerRows = [
      { Section: header.companyName, Type: "", Level: "", Code: "", Name: "", Amount: "" },
    ];
    if (header.companyAddress) {
      headerRows.push({ Section: header.companyAddress, Type: "", Level: "", Code: "", Name: "", Amount: "" });
    }
    if (contactParts.length) {
      headerRows.push({ Section: contactParts.join("  |  "), Type: "", Level: "", Code: "", Name: "", Amount: "" });
    }
    headerRows.push(
      { Section: "STATEMENT OF PROFIT AND LOSS", Type: "", Level: "", Code: "", Name: "", Amount: "" },
      { Section: `Currency: ${currCode} (${currSymbol}) | Period: ${from || "Beginning"} to ${to || "Today"} | Branch: ${branchName} | Generated: ${new Date().toLocaleString()}`, Type: "", Level: "", Code: "", Name: "", Amount: "" },
      { Section: "", Type: "", Level: "", Code: "", Name: "", Amount: "" }
    );

    const incomeRows = flattenTree(income.items, 99, [], "Income");
    const expenseRows = flattenTree(expenses.items, 99, [], "Expenses");
    const all = [
      ...headerRows,
      { Section: "=== INCOME ===", Type: "", Level: "", Code: "", Name: "", Amount: "" },
      ...incomeRows,
      { Section: "", Type: "SUBTOTAL", Level: 0, Code: "", Name: "Total Income", Amount: income.total },
      { Section: "", Type: "", Level: 0, Code: "", Name: "", Amount: "" },
      { Section: "=== EXPENSES ===", Type: "", Level: "", Code: "", Name: "", Amount: "" },
      ...expenseRows,
      { Section: "", Type: "SUBTOTAL", Level: 0, Code: "", Name: "Total Expenses", Amount: expenses.total },
      { Section: "", Type: "", Level: 0, Code: "", Name: "", Amount: "" },
      { Section: "=== NET RESULT ===", Type: "NET", Level: 0, Code: "", Name: net >= 0 ? "NET PROFIT" : "NET LOSS", Amount: net },
    ];
    if (!all.length) return;
    const ws = XLSX.utils.json_to_sheet(all);
    ws["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 45 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ProfitAndLoss");
    XLSX.writeFile(wb, `profit-and-loss-${currCode}-${from || "all"}-to-${to || "today"}.xlsx`);
  }

  async function exportPDF() {
    const header = await getHeaderInfo();

    const doc = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const pageH = 297;
    const margin = 14;
    let y = 14;

    const currCode = selectedCurrency.code || "GHS";
    // Avoid jsPDF font encoding issues where unicode ₵ renders as µ
    const currPrefix = currCode === "GHS" ? "GH " : `${currCode} `;

    const branchName = selectedBranchId
      ? userBranches.find((b) => String(b.id) === String(selectedBranchId))?.name || "Selected Branch"
      : userBranches.length === 1
      ? userBranches[0].name
      : "All Assigned Branches";

    // 1. Report Header Template: Left = Stanness Logo Image, Right = Company Info
    if (header.logoUrl) {
      try {
        doc.addImage(header.logoUrl, "PNG", margin, y - 2, 44, 16, undefined, "FAST");
      } catch (err) {
        console.error("Error drawing logo", err);
      }
    }

    // Right-aligned Company Details
    let rightY = y + 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(header.companyName, pageW - margin, rightY, { align: "right" });
    rightY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    if (header.companyAddress) {
      doc.text(header.companyAddress, pageW - margin, rightY, { align: "right" });
      rightY += 4.5;
    }
    if (header.companyPhone) {
      doc.text(`Contact No: ${header.companyPhone}`, pageW - margin, rightY, { align: "right" });
      rightY += 4.5;
    }
    if (header.companyEmail) {
      doc.text(`Email: ${header.companyEmail}`, pageW - margin, rightY, { align: "right" });
      rightY += 4.5;
    }

    y = Math.max(y + 18, rightY + 1);

    // Solid Black Divider Line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    // 2. Document Title & Metadata Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, y, pageW - margin * 2, 14, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("STATEMENT OF PROFIT AND LOSS", margin + 4, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Period: ${from || "Beginning"} to ${to || "Today"}   |   Branch: ${branchName}`, margin + 4, y + 10.5);

    const genDate = new Date().toLocaleDateString();
    doc.text(`Currency: ${currCode}   |   Generated: ${genDate}`, pageW - margin - 4, y + 10.5, { align: "right" });
    y += 18;

    // 3. Summary KPI Cards
    const kpis = [
      { label: "TOTAL INCOME", value: `${currPrefix}${fmt(income.total)}`, color: [16, 185, 129] },
      { label: "TOTAL EXPENSES", value: `${currPrefix}${fmt(expenses.total)}`, color: [239, 68, 68] },
      { label: `NET ${net >= 0 ? "PROFIT" : "LOSS"}`, value: `${currPrefix}${fmt(net)}`, color: net >= 0 ? [16, 185, 129] : [239, 68, 68] },
    ];
    const kpiW = (pageW - margin * 2 - 8) / 3;
    kpis.forEach((k, idx) => {
      const kX = margin + idx * (kpiW + 4);
      doc.setFillColor(248, 250, 252);
      doc.rect(kX, y, kpiW, 12, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(kX, y, kpiW, 12, "S");

      // Left Accent bar
      doc.setFillColor(...k.color);
      doc.rect(kX, y, 1.5, 12, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(k.label, kX + 4, y + 4.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(k.value, kX + 4, y + 9.5);
    });
    y += 17;

    // Helper for table sections
    function renderSection(title, nodes, sectionTotal, color) {
      if (y > 255) {
        doc.addPage();
        y = margin;
      }

      // Section header banner
      doc.setFillColor(...color);
      doc.rect(margin, y, pageW - margin * 2, 6.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.text(title.toUpperCase(), margin + 3, y + 4.5);
      doc.text(`AMOUNT (${currCode})`, pageW - margin - 3, y + 4.5, { align: "right" });
      y += 8.5;
      doc.setTextColor(30, 41, 59);

      function renderNodes(nodes) {
        if (!nodes || !Array.isArray(nodes)) return;
        for (const node of nodes) {
          if (y > 270) {
            doc.addPage();
            y = margin;
          }
          const indent = margin + (node.level - 1) * 4;
          if (node.type === "group") {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.text(`${node.name}`, indent, y);
            doc.text(`${currPrefix}${fmt(node.amount)}`, pageW - margin - 2, y, { align: "right" });
            y += 5;
            renderNodes(node.children);
            renderNodes(node.accounts);
          } else {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            const label = node.account_code ? `${node.account_code}  ${node.account_name || ""}` : node.account_name || "";
            doc.text(label.slice(0, 70), indent + 2, y);
            doc.text(`${currPrefix}${fmt(node.amount)}`, pageW - margin - 2, y, { align: "right" });
            y += 4.5;
          }
        }
      }
      renderNodes(nodes);

      // Subtotal bar
      if (y > 268) {
        doc.addPage();
        y = margin;
      }
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageW - margin * 2, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...color);
      doc.text(`Total ${title}`, margin + 3, y + 4.5);
      doc.text(`${currPrefix}${fmt(sectionTotal)}`, pageW - margin - 2, y + 4.5, { align: "right" });
      y += 9.5;
    }

    renderSection("Income", income.items, income.total, [5, 150, 105]);
    y += 3;
    renderSection("Expenses", expenses.items, expenses.total, [225, 29, 72]);

    // Net profit/loss banner
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    y += 2;
    const netColor = net >= 0 ? [5, 150, 105] : [225, 29, 72];
    doc.setFillColor(...netColor);
    doc.rect(margin, y, pageW - margin * 2, 8.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(net >= 0 ? "NET PROFIT FOR PERIOD" : "NET LOSS FOR PERIOD", margin + 4, y + 6);
    doc.text(`${currPrefix}${fmt(net)}`, pageW - margin - 4, y + 6, { align: "right" });

    // Page Numbering Footer on all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Generated from Seriana Mart ERP  |  Page ${i} of ${totalPages}`,
        pageW / 2,
        pageH - 6,
        { align: "center" }
      );
    }

    doc.save(`profit-and-loss-${currCode}-${from || "all"}-to-${to || "today"}.pdf`);
  }

  // Recursive renderer
  // Recursive renderer
  const renderNodes = (nodes, maxLevel) => {
    if (!nodes || !Array.isArray(nodes)) return null;
    return nodes.map((node) => {
      if (node.level > maxLevel) return null;
      const isGroup = node.type === "group";
      const key = isGroup ? `g-${node.id}` : `a-${node.account_id || node.id}`;
      const pl = Math.max(0, (node.level - 1)) * 16;
      const amountVal = Number(node.amount || 0);

      return (
        <React.Fragment key={key}>
          <div
            className={`flex items-center justify-between py-2.5 px-3 border-b border-slate-100 dark:border-slate-700/50 transition-colors ${
              isGroup
                ? "bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t border-slate-200 dark:border-slate-700"
                : "hover:bg-blue-50/50 dark:hover:bg-blue-900/30 bg-white dark:bg-slate-800"
            }`}
          >
            {/* Left side: Group / Account Name */}
            <div
              className="flex items-center gap-2 min-w-0 flex-1 pr-3"
              style={{ paddingLeft: `${pl}px` }}
            >
              {isGroup ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-slate-400 text-xs flex-shrink-0">📁</span>
                  <span
                    className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider truncate"
                    title={node.name}
                  >
                    {node.name}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  {(node.account_code || node.code) && (
                    <span className="font-mono text-xs font-bold text-brand dark:text-brand-300 flex-shrink-0">
                      {node.account_code || node.code}
                    </span>
                  )}
                  <span
                    className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate"
                    title={node.account_name || node.name}
                  >
                    {node.account_name || node.name}
                  </span>
                </div>
              )}
            </div>

            {/* Right side: Amount (Always right-aligned, pinned, and clearly visible) */}
            <div
              className={`font-mono text-sm whitespace-nowrap tabular-nums flex-shrink-0 pl-2 text-right ${
                isGroup
                  ? "font-black text-slate-900 dark:text-slate-50"
                  : "font-bold text-slate-900 dark:text-slate-100"
              }`}
            >
              {selectedCurrency.symbol}{fmt(amountVal)}
            </div>
          </div>

          {isGroup && node.children && renderNodes(node.children, maxLevel)}
          {isGroup && node.accounts && renderNodes(node.accounts, maxLevel)}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <button onClick={() => window.history.back()} className="font-sans text-xs font-bold text-brand uppercase tracking-wider hover:text-brand-600 transition-colors">
            ← Back to Finance
          </button>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">
            Profit & Loss
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Statement of income and expenditure for a specific period
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            🖨️ Print
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportExcel}
            disabled={!income.items.length && !expenses.items.length}>
            📊 Excel ({selectedCurrency.code})
          </button>
          <button type="button" className="btn btn-primary btn-sm shadow-sm" onClick={exportPDF}
            disabled={!income.items.length && !expenses.items.length}>
            📄 PDF ({selectedCurrency.code})
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-emerald-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Income</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{selectedCurrency.symbol}{fmt(income.total)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-rose-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Expenses</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{selectedCurrency.symbol}{fmt(expenses.total)}</h3>
        </div>
        <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-y border-r border-slate-200 dark:border-slate-700 ${net >= 0 ? "border-emerald-500" : "border-rose-500"}`}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net {net >= 0 ? "Profit" : "Loss"}</p>
          <h3 className={`text-2xl font-black mt-1 ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{selectedCurrency.symbol}{fmt(net)}</h3>
        </div>
      </div>

      {/* Filter & Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          {userBranches.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">Branch:</span>
              <select
                className="select select-bordered select-sm text-xs font-semibold bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                <option value="">All Assigned Branches</option>
                {userBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {userBranches.length === 1 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand/10 border border-brand/20 rounded-md">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Branch:</span>
              <span className="text-xs font-bold text-brand dark:text-brand-300">
                {userBranches[0].name} {userBranches[0].code ? `(${userBranches[0].code})` : ""}
              </span>
            </div>
          )}

          {/* Currency Selector */}
          {currencies.length > 1 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">Currency:</span>
              <select
                className="select select-bordered select-sm text-xs font-semibold bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                value={selectedCurrency.code}
                onChange={(e) => {
                  const cur = currencies.find((c) => c.code === e.target.value);
                  if (cur) setSelectedCurrency({ code: cur.code, symbol: cur.symbol || cur.code });
                }}
              >
                {currencies.map((c) => (
                  <option key={c.id || c.code} value={c.code}>
                    {c.code} ({c.symbol || c.code})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-200/60 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Currency:</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {selectedCurrency.code} ({selectedCurrency.symbol})
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">From:</span>
            <input className="input input-bordered input-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">To:</span>
            <input className="input input-bordered input-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-center gap-4 border-l pl-4 border-slate-200 dark:border-slate-700">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">Level:</span>
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="5" step="1" value={level}
                onChange={(e) => setLevel(parseInt(e.target.value))}
                className="range range-xs range-primary w-32" />
              <span className="bg-brand text-white text-xs font-black px-2 py-1 rounded shadow-sm min-w-[1.75rem] text-center">{level}</span>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm text-brand font-bold"
            onClick={() => {
              const today = new Date();
              const jan1 = new Date(today.getFullYear(), 0, 1);
              setFrom(jan1.toISOString().slice(0, 10));
              setTo(today.toISOString().slice(0, 10));
              if (userBranches.length > 1) setSelectedBranchId("");
            }} disabled={loading}>
            Reset
          </button>
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Income Card */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden flex flex-col">
              {/* Income Header */}
              <div className="flex items-center justify-between bg-emerald-600 text-white py-3 px-4 font-bold text-xs uppercase tracking-wider">
                <span>Income Accounts</span>
                <span className="font-mono">Amount ({selectedCurrency.symbol})</span>
              </div>

              {/* Income Rows */}
              <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-700/50">
                {income.items.length === 0 && !loading && (
                  <div className="text-center py-8 text-slate-400 text-sm">No income records</div>
                )}
                {renderNodes(income.items, level)}
              </div>

              {/* Income Footer */}
              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/30 border-t-2 border-emerald-300 dark:border-emerald-700 py-3 px-4 font-black text-emerald-800 dark:text-emerald-300">
                <span className="text-sm">Total Income</span>
                <span className="text-base font-mono">{selectedCurrency.symbol}{fmt(income.total)}</span>
              </div>
            </div>

            {/* Expense Card */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden flex flex-col">
              {/* Expense Header */}
              <div className="flex items-center justify-between bg-rose-600 text-white py-3 px-4 font-bold text-xs uppercase tracking-wider">
                <span>Expense Accounts</span>
                <span className="font-mono">Amount ({selectedCurrency.symbol})</span>
              </div>

              {/* Expense Rows */}
              <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-700/50">
                {expenses.items.length === 0 && !loading && (
                  <div className="text-center py-8 text-slate-400 text-sm">No expense records</div>
                )}
                {renderNodes(expenses.items, level)}
              </div>

              {/* Expense Footer */}
              <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-900/30 border-t-2 border-rose-300 dark:border-rose-700 py-3 px-4 font-black text-rose-800 dark:text-rose-300">
                <span className="text-sm">Total Expenses</span>
                <span className="text-base font-mono">{selectedCurrency.symbol}{fmt(expenses.total)}</span>
              </div>
            </div>
          </div>

          {/* Net Profit Banner */}
          <div className={`mt-6 p-4 rounded-xl text-center ${net >= 0 ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700" : "bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700"}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{net >= 0 ? "Net Profit" : "Net Loss"} for Period</p>
            <p className={`text-3xl font-black mt-1 ${net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{selectedCurrency.symbol}{fmt(net)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
