import React, { useState, useRef, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { api } from "api/client";
import { Button, SegmentedControl, Badge } from "@/components/ui";
import {
  ArrowLeft,
  BookOpen,
  FolderTree,
  Plus,
  Layers,
  ChevronDown,
  Upload,
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderPlus,
} from "lucide-react";
import AccountsPage from "./AccountsPage";
import AccountGroupsPage from "./AccountGroupsPage";

/**
 * Enhanced Finance Setup Page: Chart of Accounts & Account Groups
 * Features Apple-inspired UI, Bulk Operations dropdown, client-side template download
 * with Excel dropdown validations, interactive preview modal, and manual creation buttons.
 */
export default function FinanceSetupPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "accounts";
  const actionParam = searchParams.get("action");

  const [showBulkOps, setShowBulkOps] = useState(false);
  const [accountsCount, setAccountsCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(0);

  const [triggerCreateAccount, setTriggerCreateAccount] = useState(0);
  const [triggerCreateGroup, setTriggerCreateGroup] = useState(0);

  // File upload & preview modal state
  const fileInputRef = useRef(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Handle URL action trigger (e.g. ?action=create)
  useEffect(() => {
    if (actionParam === "create") {
      if (activeTab === "groups") {
        setTriggerCreateGroup((prev) => prev + 1);
      } else {
        setTriggerCreateAccount((prev) => prev + 1);
      }
      // Remove action param to avoid re-triggering
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("action");
      setSearchParams(newParams, { replace: true });
    }
  }, [actionParam, activeTab, searchParams, setSearchParams]);

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  const handleManualCreateAccount = () => {
    if (activeTab !== "accounts") {
      setSearchParams({ tab: "accounts" });
    }
    setTriggerCreateAccount((prev) => prev + 1);
  };

  const handleManualCreateGroup = () => {
    if (activeTab !== "groups") {
      setSearchParams({ tab: "groups" });
    }
    setTriggerCreateGroup((prev) => prev + 1);
  };

  /**
   * Generates dynamic Excel template with ExcelJS.
   * Includes LookupData sheet and Dropdown validation for GroupLevel1 (Asset, Liability, Equity, Income, Expense).
   */
  const handleTemplateDownload = async () => {
    try {
      toast.info("Generating Excel template with lookups...");
      let groups = [];
      let currencies = [];

      try {
        const [grpRes, curRes] = await Promise.all([
          api.get("/finance/account-groups").catch(() => ({ data: { items: [] } })),
          api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
        ]);
        groups = (Array.isArray(grpRes?.data?.items) ? grpRes.data.items : [])
          .map((g) => String(g.name || "").trim())
          .filter(Boolean);
        currencies = (Array.isArray(curRes?.data?.items) ? curRes.data.items : [])
          .map((c) => String(c.code || "").trim())
          .filter(Boolean);
      } catch {
        // Fallbacks
      }

      if (!currencies.length) {
        currencies = ["GHS", "USD", "EUR", "GBP", "NGN", "KES", "CAD", "CNY"];
      }
      if (!groups.length) {
        groups = [
          "Current Assets",
          "Cash and Cash Equivalents",
          "Bank Accounts",
          "Accounts Receivable",
          "Fixed Assets",
          "Current Liabilities",
          "Accounts Payable",
          "Owner's Equity",
          "Operating Revenue",
          "Operating Expenses",
          "Administrative Expenses",
        ];
      }

      const classes = ["Asset", "Liability", "Equity", "Income", "Expense"];
      const postableOpts = ["Yes", "No"];
      const balanceTypes = ["DEBIT", "CREDIT"];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "ERP Finance System";
      workbook.lastModifiedBy = "ERP Finance System";
      workbook.created = new Date();

      // 1. Lookup sheet for data validations
      const lookupSheet = workbook.addWorksheet("LookupData");
      lookupSheet.getCell("A1").value = "ACCOUNT_CLASS";
      lookupSheet.getCell("B1").value = "CURRENCY";
      lookupSheet.getCell("C1").value = "ACCOUNT_GROUPS";
      lookupSheet.getCell("D1").value = "IS_POSTABLE";
      lookupSheet.getCell("E1").value = "BALANCE_TYPE";

      classes.forEach((c, idx) => {
        lookupSheet.getCell(`A${idx + 2}`).value = c;
      });
      currencies.forEach((cur, idx) => {
        lookupSheet.getCell(`B${idx + 2}`).value = cur;
      });
      groups.forEach((g, idx) => {
        lookupSheet.getCell(`C${idx + 2}`).value = g;
      });
      postableOpts.forEach((p, idx) => {
        lookupSheet.getCell(`D${idx + 2}`).value = p;
      });
      balanceTypes.forEach((b, idx) => {
        lookupSheet.getCell(`E${idx + 2}`).value = b;
      });

      lookupSheet.state = "hidden";

      // 2. Accounts Sheet (Primary)
      const acctSheet = workbook.addWorksheet("Accounts");
      acctSheet.columns = [
        { header: "GroupLevel1*", key: "GroupLevel1", width: 22 },
        { header: "AccountGroupName*", key: "AccountGroupName", width: 28 },
        { header: "AccountNumber", key: "AccountNumber", width: 18 },
        { header: "AccountName*", key: "AccountName", width: 32 },
        { header: "Currency*", key: "Currency", width: 16 },
        { header: "IsPostable*", key: "IsPostable", width: 15 },
        { header: "BalanceType", key: "BalanceType", width: 16 },
        { header: "Description", key: "Description", width: 35 },
      ];

      // Style header
      const acctHeader = acctSheet.getRow(1);
      acctHeader.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      acctHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F766E" }, // Teal / brand
      };
      acctHeader.alignment = { vertical: "middle", horizontal: "center" };
      acctHeader.height = 26;

      // Sample rows
      const sampleAccounts = [
        {
          GroupLevel1: "Asset",
          AccountGroupName: groups[1] || "Cash and Cash Equivalents",
          AccountNumber: "1001",
          AccountName: "Main Petty Cash",
          Currency: currencies[0] || "GHS",
          IsPostable: "Yes",
          BalanceType: "DEBIT",
          Description: "Petty cash float on hand",
        },
        {
          GroupLevel1: "Asset",
          AccountGroupName: groups[2] || "Bank Accounts",
          AccountNumber: "1002",
          AccountName: "Operating Bank Account",
          Currency: currencies[0] || "GHS",
          IsPostable: "Yes",
          BalanceType: "DEBIT",
          Description: "Commercial operational checking account",
        },
        {
          GroupLevel1: "Asset",
          AccountGroupName: groups[3] || "Accounts Receivable",
          AccountNumber: "1003",
          AccountName: "Trade Debtors Control",
          Currency: currencies[0] || "GHS",
          IsPostable: "Yes",
          BalanceType: "DEBIT",
          Description: "Customer receivables control account",
        },
        {
          GroupLevel1: "Liability",
          AccountGroupName: groups[6] || "Accounts Payable",
          AccountNumber: "2001",
          AccountName: "Trade Creditors Control",
          Currency: currencies[0] || "GHS",
          IsPostable: "Yes",
          BalanceType: "CREDIT",
          Description: "Supplier payables control account",
        },
        {
          GroupLevel1: "Equity",
          AccountGroupName: groups[7] || "Owner's Equity",
          AccountNumber: "3001",
          AccountName: "Retained Earnings",
          Currency: currencies[0] || "GHS",
          IsPostable: "Yes",
          BalanceType: "CREDIT",
          Description: "Accumulated profit and loss reserve",
        },
        {
          GroupLevel1: "Income",
          AccountGroupName: groups[8] || "Operating Revenue",
          AccountNumber: "4001",
          AccountName: "Sales Revenue",
          Currency: currencies[0] || "GHS",
          IsPostable: "Yes",
          BalanceType: "CREDIT",
          Description: "Main operational sales revenue",
        },
        {
          GroupLevel1: "Expense",
          AccountGroupName: groups[9] || "Operating Expenses",
          AccountNumber: "5001",
          AccountName: "Office Rent Expense",
          Currency: currencies[0] || "GHS",
          IsPostable: "Yes",
          BalanceType: "DEBIT",
          Description: "Monthly office building lease",
        },
      ];

      sampleAccounts.forEach((s) => {
        const r = acctSheet.addRow(s);
        r.height = 20;
      });

      // 3. AccountGroups Sheet
      const grpSheet = workbook.addWorksheet("AccountGroups");
      grpSheet.columns = [
        { header: "GroupLevel1*", key: "GroupLevel1", width: 22 },
        { header: "GroupName*", key: "GroupName", width: 28 },
        { header: "GroupCode", key: "GroupCode", width: 18 },
        { header: "ParentGroup", key: "ParentGroup", width: 26 },
        { header: "Description", key: "Description", width: 35 },
      ];

      const grpHeader = grpSheet.getRow(1);
      grpHeader.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      grpHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F766E" },
      };
      grpHeader.alignment = { vertical: "middle", horizontal: "center" };
      grpHeader.height = 26;

      const sampleGroups = [
        { GroupLevel1: "Asset", GroupName: "Current Assets", GroupCode: "AST_CURR", ParentGroup: "", Description: "Short-term operating assets" },
        { GroupLevel1: "Asset", GroupName: "Cash and Bank", GroupCode: "AST_CASH", ParentGroup: "Current Assets", Description: "Cash and bank accounts" },
        { GroupLevel1: "Liability", GroupName: "Current Liabilities", GroupCode: "LIA_CURR", ParentGroup: "", Description: "Short-term debts & payables" },
        { GroupLevel1: "Equity", GroupName: "Capital & Reserves", GroupCode: "EQU_CAP", ParentGroup: "", Description: "Owner capital and reserves" },
        { GroupLevel1: "Income", GroupName: "Operating Revenue", GroupCode: "INC_OPS", ParentGroup: "", Description: "Commercial sales & fees" },
        { GroupLevel1: "Expense", GroupName: "Operating Expenses", GroupCode: "EXP_OPS", ParentGroup: "", Description: "Day-to-day operating overhead" },
      ];
      sampleGroups.forEach((sg) => {
        const r = grpSheet.addRow(sg);
        r.height = 20;
      });

      // Data validation for Accounts sheet (GroupLevel1 Dropdown)
      const maxCurRow = Math.max(currencies.length + 1, 2);
      const maxGrpRow = Math.max(groups.length + 1, 2);

      for (let r = 2; r <= 1000; r++) {
        // GroupLevel1 dropdown: Asset, Liability, Equity, Income, Expense
        acctSheet.getCell(`A${r}`).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [`LookupData!$A$2:$A$6`],
          showErrorMessage: true,
          errorTitle: "Invalid Account Class",
          error: "Please select an Account Class (Asset, Liability, Equity, Income, Expense) from the dropdown list.",
        };

        // GroupName dropdown
        acctSheet.getCell(`B${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`LookupData!$C$2:$C$${maxGrpRow}`],
          showErrorMessage: false,
        };

        // Currency dropdown
        acctSheet.getCell(`E${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`LookupData!$B$2:$B$${maxCurRow}`],
          showErrorMessage: true,
          errorTitle: "Invalid Currency",
          error: "Please select a currency code from the dropdown list.",
        };

        // IsPostable dropdown
        acctSheet.getCell(`F${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`LookupData!$D$2:$D$3`],
          showErrorMessage: true,
          errorTitle: "Invalid Option",
          error: "Please select Yes or No.",
        };

        // BalanceType dropdown
        acctSheet.getCell(`G${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`LookupData!$E$2:$E$3`],
          showErrorMessage: true,
          errorTitle: "Invalid Balance Type",
          error: "Please select DEBIT or CREDIT.",
        };

        // AccountGroups sheet: GroupLevel1 dropdown
        if (r <= 500) {
          grpSheet.getCell(`A${r}`).dataValidation = {
            type: "list",
            allowBlank: false,
            formulae: [`LookupData!$A$2:$A$6`],
            showErrorMessage: true,
            errorTitle: "Invalid Account Class",
            error: "Please select an Account Class (Asset, Liability, Equity, Income, Expense) from the dropdown list.",
          };
        }
      }

      // Generate file buffer and trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "chart_of_accounts_template.xlsx";
      anchor.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel template downloaded with account class dropdowns!");
    } catch (err) {
      console.error("Template generation error:", err);
      toast.error("Failed to generate Excel template: " + (err.message || "Unknown error"));
    }
  };

  /**
   * Export all existing accounts & groups to Excel
   */
  const handleExportExcel = async () => {
    try {
      toast.info("Exporting Chart of Accounts to Excel...");
      const [accRes, grpRes] = await Promise.all([
        api.get("/finance/accounts"),
        api.get("/finance/account-groups"),
      ]);

      const accs = accRes.data?.items || [];
      const grps = grpRes.data?.items || [];

      const workbook = new ExcelJS.Workbook();
      const acctSheet = workbook.addWorksheet("Chart of Accounts");
      acctSheet.columns = [
        { header: "Account Code", key: "code", width: 16 },
        { header: "Account Name", key: "name", width: 32 },
        { header: "Group Name", key: "group_name", width: 26 },
        { header: "Nature / Class", key: "nature", width: 18 },
        { header: "Currency", key: "currency_code", width: 14 },
        { header: "Postable", key: "is_postable", width: 14 },
        { header: "Balance Type", key: "balance_type", width: 16 },
        { header: "Active", key: "is_active", width: 14 },
      ];

      const header = acctSheet.getRow(1);
      header.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F766E" },
      };
      header.height = 24;

      accs.forEach((a) => {
        acctSheet.addRow({
          code: a.code,
          name: a.name,
          group_name: a.group_name || a.group_code || "",
          nature: a.nature || "",
          currency_code: a.currency_code || "GHS",
          is_postable: Number(a.is_postable) === 1 ? "Yes" : "No",
          balance_type: a.balance_type || "",
          is_active: Number(a.is_active) === 1 ? "Active" : "Inactive",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `chart_of_accounts_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${accs.length} accounts to Excel!`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export Chart of Accounts");
    }
  };

  /**
   * Handle file selection for bulk upload, parse with XLSX, and open preview modal
   */
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });

        const targetSheetName = wb.SheetNames.includes("Accounts") ? "Accounts" : wb.SheetNames[0];
        const ws = wb.Sheets[targetSheetName];
        const rawJson = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!rawJson.length) {
          toast.error("The selected file is empty");
          return;
        }

        // Fetch existing groups for validation
        let existingGroups = [];
        try {
          const gRes = await api.get("/finance/account-groups");
          existingGroups = gRes.data?.items || [];
        } catch {}

        const parsed = rawJson.map((row, idx) => {
          const getVal = (aliases) => {
            for (const a of aliases) {
              const cleanA = a.replace(/[*_\s]/g, "").toUpperCase();
              for (const [k, v] of Object.entries(row)) {
                const cleanK = k.replace(/[*_\s]/g, "").toUpperCase();
                if (cleanK === cleanA && v !== undefined && String(v).trim() !== "") {
                  return String(v).trim();
                }
              }
            }
            return "";
          };

          const rawClass = getVal([
            "GroupLevel1",
            "AccountGroupLevel1",
            "AccountClass",
            "Class",
            "Nature",
          ]);
          const groupName = getVal([
            "AccountGroupName",
            "GroupName",
            "Group",
            "AccountGroup",
          ]);
          const code = getVal([
            "AccountNumber",
            "AccountCode",
            "Code",
            "Number",
          ]);
          const name = getVal([
            "AccountName",
            "Name",
            "Account",
          ]);
          const currency = getVal(["Currency", "CurrencyCode"]) || "Base";
          const isPostable = getVal(["IsPostable", "Postable", "Status"]) || "Yes";
          const balanceType = getVal(["BalanceType", "Balance"]);
          const description = getVal(["Description", "Notes", "Remarks"]);

          // Validation
          const errors = [];
          const validClasses = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE", "REVENUE"];
          const normalizedClass = rawClass.toUpperCase();

          if (!name) {
            errors.push("Account Name is required");
          }
          if (!rawClass) {
            errors.push("Account Class (GroupLevel1) is required");
          } else if (!validClasses.some((vc) => normalizedClass.includes(vc))) {
            errors.push(`Invalid class "${rawClass}". Must be Asset, Liability, Equity, Income, or Expense.`);
          }

          const existingGrp = existingGroups.find(
            (g) =>
              String(g.name || "").trim().toUpperCase() === groupName.toUpperCase() ||
              String(g.code || "").trim().toUpperCase() === groupName.toUpperCase()
          );

          return {
            rowNum: idx + 2,
            rawClass: rawClass || "Asset",
            normalizedClass: normalizedClass.includes("REV") ? "INCOME" : normalizedClass,
            groupName: groupName || "General",
            groupExists: !!existingGrp,
            code,
            name,
            currency,
            isPostable,
            balanceType,
            description,
            isValid: errors.length === 0,
            errors,
          };
        });

        setPreviewRows(parsed);
        setPreviewOpen(true);
      } catch (err) {
        console.error("File parse error:", err);
        toast.error("Failed to parse Excel file: " + (err.message || "Invalid format"));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsArrayBuffer(file);
  };

  /**
   * Confirm import: creates missing groups and accounts via API
   */
  const handleConfirmImport = async () => {
    const validRows = previewRows.filter((r) => r.isValid);
    if (!validRows.length) {
      toast.error("No valid rows to import");
      return;
    }

    setUploading(true);
    try {
      // 1. Fetch current groups
      const grpRes = await api.get("/finance/account-groups");
      const currentGroups = grpRes.data?.items || [];
      const groupMap = new Map();
      currentGroups.forEach((g) => {
        groupMap.set(String(g.name).trim().toUpperCase(), g);
        if (g.code) groupMap.set(String(g.code).trim().toUpperCase(), g);
      });

      // 2. Create missing groups
      let groupsCreated = 0;
      for (const r of validRows) {
        const gKey = r.groupName.toUpperCase();
        if (!groupMap.has(gKey)) {
          try {
            const natureMap = { ASSET: "AST", LIABILITY: "LIA", EQUITY: "EQU", INCOME: "INC", EXPENSE: "EXP" };
            const nat = r.normalizedClass in natureMap ? r.normalizedClass : "ASSET";
            const token = r.groupName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
            const gCode = `${natureMap[nat]}_${token || "GRP"}`;

            const res = await api.post("/finance/account-groups", {
              name: r.groupName,
              nature: nat,
              code: gCode,
              isActive: 1,
            });
            const newGroup = res.data?.item || { id: res.data?.id, name: r.groupName, nature: nat };
            groupMap.set(gKey, newGroup);
            groupsCreated++;
          } catch (gErr) {
            console.warn(`Could not create group "${r.groupName}":`, gErr);
          }
        }
      }

      // 3. Create accounts
      let accountsCreated = 0;
      let accountErrors = 0;

      for (const r of validRows) {
        const gKey = r.groupName.toUpperCase();
        const grp = groupMap.get(gKey) || currentGroups[0];
        if (!grp || !grp.id) continue;

        try {
          await api.post("/finance/accounts", {
            groupId: Number(grp.id),
            code: r.code ? r.code.trim() : null,
            name: r.name.trim(),
            isPostable: r.isPostable.toLowerCase().startsWith("n") ? 0 : 1,
            isActive: 1,
          });
          accountsCreated++;
        } catch (aErr) {
          accountErrors++;
          console.warn(`Failed to create account "${r.name}":`, aErr);
        }
      }

      toast.success(
        `Import complete! ${accountsCreated} account(s) created, ${groupsCreated} group(s) created.${
          accountErrors > 0 ? ` (${accountErrors} skipped due to duplicates)` : ""
        }`
      );
      setPreviewOpen(false);
      // Trigger refresh
      setSearchParams({ tab: activeTab });
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Import failed: " + (err?.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  const validCount = previewRows.filter((r) => r.isValid).length;
  const errorCount = previewRows.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Hidden file input for bulk upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept=".xlsx,.xls,.csv"
      />

      {/* Unified Hero Header Banner (overflow-visible to prevent clipping dropdowns) */}
      <div className="card shadow-lg border border-teal-700/30 overflow-visible relative z-20">
        <div className="card-header bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-6 sm:p-7 relative rounded-t-xl overflow-visible">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-2">
              <Link
                to="/finance?section=Accounting%20Setup"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-200/90 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-md"
              >
                <ArrowLeft size={13} /> Back to Accounting Setup
              </Link>
              <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3 tracking-tight">
                <BookOpen className="w-7 h-7 text-teal-300 shrink-0" />
                Chart of Accounts & Groups
              </h1>
              <p className="text-sm text-teal-100/90 max-w-2xl font-normal leading-relaxed">
                Maintain financial ledger accounts, classification hierarchy, parent structures,
                and bulk import or export chart of accounts data.
              </p>
            </div>

            {/* Action Buttons: Direct Template Download/Upload, Bulk Operations, Create Group, Create Account */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
              {/* Direct Download Template Button */}
              <button
                type="button"
                onClick={handleTemplateDownload}
                className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 border border-white/20 cursor-pointer"
                title="Download Excel Template with dropdown lookups"
              >
                <FileSpreadsheet size={16} className="text-teal-300" />
                <span>Download Template</span>
              </button>

              {/* Direct Upload Template Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 border border-white/20 cursor-pointer"
                title="Upload filled Excel template"
              >
                <Upload size={16} className="text-teal-300" />
                <span>Upload Template</span>
              </button>

              {/* Bulk Operations Popover */}
              <div className="relative">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowBulkOps((prev) => !prev)}
                  icon={<Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />}
                  className="bg-white hover:bg-slate-100 text-slate-800 font-semibold shadow-sm cursor-pointer"
                >
                  <span>Bulk Operations</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      showBulkOps ? "rotate-180" : ""
                    }`}
                  />
                </Button>

                {showBulkOps && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowBulkOps(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 p-5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-lg shadow-apple-xs">
                            <Layers className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                              Bulk Operations
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Import, export, or download template
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowBulkOps(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          aria-label="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-4 space-y-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowBulkOps(false);
                            fileInputRef.current?.click();
                          }}
                          className="w-full flex items-center gap-3 p-3 text-left rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-teal-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group active:scale-[0.99] cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Upload className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                              Upload Filled Template
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              Import Excel template with preview & validation
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowBulkOps(false);
                            handleTemplateDownload();
                          }}
                          className="w-full flex items-center gap-3 p-3 text-left rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-teal-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group active:scale-[0.99] cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                              Download Excel Template
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              Pre-formatted template with class & group dropdowns
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowBulkOps(false);
                            handleExportExcel();
                          }}
                          className="w-full flex items-center gap-3 p-3 text-left rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-teal-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group active:scale-[0.99] cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Download className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                              Export Chart of Accounts
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              Export current accounts and groups to Excel
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Create Group Button */}
              <button
                type="button"
                onClick={handleManualCreateGroup}
                className="bg-teal-600/90 hover:bg-teal-500 text-white font-semibold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <FolderPlus size={16} /> Create Group
              </button>

              {/* Create Account Button (Prominent Manual Account Creation) */}
              <button
                type="button"
                onClick={handleManualCreateAccount}
                className="btn-success font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <Plus size={18} /> Create Account
              </button>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Accounts vs Groups */}
        <div className="bg-slate-50 dark:bg-slate-900/80 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
          <SegmentedControl
            options={[
              {
                value: "accounts",
                label: `Chart of Accounts ${accountsCount > 0 ? `(${accountsCount})` : ""}`,
                icon: BookOpen,
              },
              {
                value: "groups",
                label: `Account Groups ${groupsCount > 0 ? `(${groupsCount})` : ""}`,
                icon: FolderTree,
              },
            ]}
            value={activeTab}
            onChange={handleTabChange}
            size="md"
          />

          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
            <span>
              Showing: <strong className="text-slate-800 dark:text-slate-200">{activeTab === "accounts" ? "Ledger Accounts" : "Account Groups Hierarchy"}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area based on Active Tab */}
      <div className="transition-opacity duration-200">
        {activeTab === "accounts" ? (
          <AccountsPage
            hideBanner={true}
            triggerCreate={triggerCreateAccount}
            onResetTriggerCreate={() => setTriggerCreateAccount(0)}
            onCountChange={(count) => setAccountsCount(count)}
          />
        ) : (
          <AccountGroupsPage
            hideBanner={true}
            triggerCreate={triggerCreateGroup}
            onResetTriggerCreate={() => setTriggerCreateGroup(0)}
            onCountChange={(count) => setGroupsCount(count)}
          />
        )}
      </div>

      {/* Bulk Upload Preview & Validation Modal (Apple-style matching ItemsList) */}
      {previewOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-lg shadow-apple-xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Preview Accounts Template Upload
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Review and validate account records before importing into your Chart of Accounts
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics Badges */}
            <div className="px-6 py-3.5 bg-slate-100/70 dark:bg-slate-800/50 flex flex-wrap items-center gap-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Badge variant="neutral" size="md">
                  Total Rows: {previewRows.length}
                </Badge>
                <Badge variant="success" size="md">
                  Valid: {validCount}
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="error" size="md">
                    Attention Needed: {errorCount}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                Any non-existent account groups will be automatically created under their designated Class.
              </div>
            </div>

            {/* Preview Table */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Row</th>
                      <th className="p-3">Account Class (Level 1)</th>
                      <th className="p-3">Group Name</th>
                      <th className="p-3">Account Code</th>
                      <th className="p-3">Account Name</th>
                      <th className="p-3">Currency</th>
                      <th className="p-3">Postable</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          !row.isValid ? "bg-red-50/40 dark:bg-red-950/20" : ""
                        }`}
                      >
                        <td className="p-3 font-mono text-slate-500">{row.rowNum}</td>
                        <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                          <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-semibold text-[11px]">
                            {row.rawClass}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          {row.groupName}
                          {!row.groupExists && (
                            <span className="ml-1.5 text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                              New Group
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          {row.code || <em className="text-slate-400">Auto-gen</em>}
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                          {row.name}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{row.currency}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{row.isPostable}</td>
                        <td className="p-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 size={13} /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium" title={row.errors.join("; ")}>
                              <AlertTriangle size={13} /> {row.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setPreviewOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="prominent"
                size="md"
                onClick={handleConfirmImport}
                disabled={uploading || validCount === 0}
                icon={uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                {uploading ? "Importing Records..." : `Confirm Import (${validCount} Accounts)`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
