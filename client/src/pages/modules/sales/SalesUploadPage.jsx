/**
 * @fileoverview SalesUploadPage component.
 * Allows downloading Excel templates, filling in sales invoices, and bulk uploading into sal_invoices and optionally fin_vouchers.
 */

import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  Layers,
  HelpCircle
} from "lucide-react";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { usePermission } from "@/auth/PermissionContext";

const TEMPLATE_HEADERS = [
  "BRANCH_NAME",
  "WAREHOUSE_NAME",
  "CUSTOMER_NAME",
  "INVOICE_DATE",
  "DUE_DATE",
  "PRICE_TYPE",
  "PAYMENT_TYPE",
  "CURRENCY",
  "EXCHANGE_RATE",
  "ITEM_NAME",
  "QTY",
  "UNIT_PRICE",
  "DISCOUNT_PERCENT",
  "TAX_AMOUNT",
  "REMARKS"
];

export default function SalesUploadPage() {
  const { scope, user } = useAuth();
  const { canAccessFeatureKey, isSuper } = usePermission();
  const fileRef = useRef(null);

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [updateFinanceVouchers, setUpdateFinanceVouchers] = useState(true);
  const [parsedInvoices, setParsedInvoices] = useState([]);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const hasAccess = isSuper || canAccessFeatureKey("sales", "sales-upload");

  useEffect(() => {
    if (!hasAccess) return;
    Promise.all([
      api.get("/admin/branches").catch(() => ({ data: [] })),
      api.get("/inventory/warehouses").catch(() => ({ data: [] })),
      api.get("/finance/currencies").catch(() => ({ data: [] })),
      api.get("/inventory/items").catch(() => ({ data: [] })),
      api.get("/sales/customers").catch(() => ({ data: [] })),
    ]).then(([brRes, whRes, curRes, itemRes, custRes]) => {
      const bItems = brRes.data?.items || brRes.data || [];
      const wItems = whRes.data?.items || whRes.data || [];
      const cItems = curRes.data?.items || curRes.data || [];
      const itItems = itemRes.data?.items || itemRes.data || [];
      const custItems = custRes.data?.items || custRes.data || [];
      setBranches(bItems);
      setWarehouses(wItems);
      setCurrencies(cItems);
      setItems(itItems);
      setCustomers(custItems);
      if (scope?.branchId) {
        setSelectedBranch(String(scope.branchId));
      } else if (bItems.length === 1) {
        setSelectedBranch(String(bItems[0].id));
      }
    });
  }, [hasAccess, scope?.branchId]);

  if (!hasAccess) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl mt-12 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          You do not have permission to access the Sales Upload page. This exclusive permission can only be granted by a System Administrator under Admin Permissions in System Configuration.
        </p>
        <Link to="/sales" className="btn btn-secondary text-xs px-4 py-2 inline-flex items-center gap-1.5">
          <ArrowLeft size={14} /> Return to Sales
        </Link>
      </div>
    );
  }

  const downloadTemplate = async () => {
    try {
      const selectedBranchObj = branches.find((b) => String(b.id) === String(selectedBranch));
      const defaultBranchName = selectedBranchObj?.branch_name || selectedBranchObj?.name || branches[0]?.branch_name || branches[0]?.name || "Main Branch";

      const branchWhs = warehouses
        .filter((w) => !selectedBranch || String(w.branch_id) === String(selectedBranch))
        .map((w) => w.warehouse_name || w.name)
        .filter(Boolean);

      const defaultWh = branchWhs[0] || "Main Warehouse";
      const today = new Date().toISOString().slice(0, 10);

      const priceTypesList = ["RETAIL", "WHOLESALE", "SPECIAL", "DISTRIBUTOR"];
      const paymentTypesList = ["CASH", "CREDIT", "BANK", "MOMO", "CHEQUE"];
      const currencyList = currencies.length > 0
        ? Array.from(new Set(currencies.map((c) => c.code || c.currency_code).filter(Boolean)))
        : ["GHS", "USD", "EUR", "GBP", "NGN", "KES", "RMB", "CAD"];

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("SalesInvoices");

      // Populate lookup sheet for autocomplete & dropdown validation
      const lookupSheet = workbook.addWorksheet("LookupData");
      lookupSheet.getCell("A1").value = "ITEM_NAME";
      lookupSheet.getCell("B1").value = "BRANCH_NAME";
      lookupSheet.getCell("C1").value = "CUSTOMER_NAME";
      lookupSheet.getCell("D1").value = "WAREHOUSE_NAME";

      const itemNames = items.length > 0
        ? items.map((it) => it.item_name || it.name).filter(Boolean)
        : ["Office Paper A4", "Ballpoint Pens Box", "Wireless Router"];

      itemNames.forEach((name, idx) => {
        lookupSheet.getCell(`A${idx + 2}`).value = name;
      });

      const branchNames = branches.length > 0
        ? branches.map((b) => b.branch_name || b.name).filter(Boolean)
        : [defaultBranchName];

      branchNames.forEach((bName, idx) => {
        lookupSheet.getCell(`B${idx + 2}`).value = bName;
      });

      const customerNames = customers.length > 0
        ? Array.from(new Set(customers.map((c) => c.customer_name || c.name).filter(Boolean)))
        : ["Walk-in Customer", "Apex Enterprises"];

      customerNames.forEach((cName, idx) => {
        lookupSheet.getCell(`C${idx + 2}`).value = cName;
      });

      const whList = branchWhs.length > 0 ? branchWhs : [defaultWh];
      whList.forEach((wName, idx) => {
        lookupSheet.getCell(`D${idx + 2}`).value = wName;
      });

      lookupSheet.state = "hidden";

      // Column definitions
      worksheet.columns = [
        { header: "BRANCH_NAME", key: "BRANCH_NAME", width: 22 },
        { header: "WAREHOUSE_NAME", key: "WAREHOUSE_NAME", width: 22 },
        { header: "CUSTOMER_NAME", key: "CUSTOMER_NAME", width: 26 },
        { header: "INVOICE_DATE", key: "INVOICE_DATE", width: 14 },
        { header: "DUE_DATE", key: "DUE_DATE", width: 14 },
        { header: "PRICE_TYPE", key: "PRICE_TYPE", width: 16 },
        { header: "PAYMENT_TYPE", key: "PAYMENT_TYPE", width: 16 },
        { header: "CURRENCY", key: "CURRENCY", width: 15 },
        { header: "EXCHANGE_RATE", key: "EXCHANGE_RATE", width: 15 },
        { header: "ITEM_NAME", key: "ITEM_NAME", width: 28 },
        { header: "QTY", key: "QTY", width: 12 },
        { header: "UNIT_PRICE", key: "UNIT_PRICE", width: 14 },
        { header: "DISCOUNT_PERCENT", key: "DISCOUNT_PERCENT", width: 18 },
        { header: "TAX_AMOUNT", key: "TAX_AMOUNT", width: 14 },
        { header: "REMARKS", key: "REMARKS", width: 26 }
      ];

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FF1E293B" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };

      // Add sample rows
      worksheet.addRow({
        BRANCH_NAME: defaultBranchName,
        WAREHOUSE_NAME: defaultWh,
        CUSTOMER_NAME: customerNames[0] || "Walk-in Customer",
        INVOICE_DATE: today,
        DUE_DATE: today,
        PRICE_TYPE: "RETAIL",
        PAYMENT_TYPE: "CREDIT",
        CURRENCY: "GHS",
        EXCHANGE_RATE: 1,
        ITEM_NAME: "Office Paper A4",
        QTY: 5,
        UNIT_PRICE: 60.0,
        DISCOUNT_PERCENT: 0,
        TAX_AMOUNT: 6.0,
        REMARKS: "January Retail Sales"
      });

      worksheet.addRow({
        BRANCH_NAME: defaultBranchName,
        WAREHOUSE_NAME: defaultWh,
        CUSTOMER_NAME: customerNames[0] || "Walk-in Customer",
        INVOICE_DATE: today,
        DUE_DATE: today,
        PRICE_TYPE: "RETAIL",
        PAYMENT_TYPE: "CREDIT",
        CURRENCY: "GHS",
        EXCHANGE_RATE: 1,
        ITEM_NAME: "Ballpoint Pens Box",
        QTY: 2,
        UNIT_PRICE: 28.0,
        DISCOUNT_PERCENT: 0,
        TAX_AMOUNT: 2.8,
        REMARKS: "January Retail Sales"
      });

      worksheet.addRow({
        BRANCH_NAME: defaultBranchName,
        WAREHOUSE_NAME: defaultWh,
        CUSTOMER_NAME: customerNames[1] || customerNames[0] || "Apex Enterprises",
        INVOICE_DATE: today,
        DUE_DATE: today,
        PRICE_TYPE: "WHOLESALE",
        PAYMENT_TYPE: "CREDIT",
        CURRENCY: "USD",
        EXCHANGE_RATE: 15.5,
        ITEM_NAME: "Wireless Router",
        QTY: 10,
        UNIT_PRICE: 150.0,
        DISCOUNT_PERCENT: 5,
        TAX_AMOUNT: 0,
        REMARKS: "Bulk wholesale order"
      });

      // Data validations
      const branchFormula = `LookupData!$B$2:$B$${branchNames.length + 1}`;
      const whFormula = `LookupData!$D$2:$D$${whList.length + 1}`;
      const custFormula = `LookupData!$C$2:$C$${customerNames.length + 1}`;
      const priceFormula = `"${priceTypesList.join(",")}"`;
      const paymentFormula = `"${paymentTypesList.join(",")}"`;
      const curFormula = `"${currencyList.join(",")}"`;
      const itemFormula = `LookupData!$A$2:$A$${itemNames.length + 1}`;

      for (let r = 2; r <= 1000; r++) {
        // Col A: BRANCH_NAME
        worksheet.getCell(`A${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [branchFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Branch",
          error: "Please select a branch from the dropdown list.",
        };
        // Col B: WAREHOUSE_NAME
        worksheet.getCell(`B${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [whFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Warehouse",
          error: "Please select a warehouse from the dropdown list.",
        };
        // Col C: CUSTOMER_NAME
        worksheet.getCell(`C${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [custFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Customer",
          error: "Please select a customer from the dropdown list.",
        };
        // Col F: PRICE_TYPE
        worksheet.getCell(`F${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [priceFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Price Type",
          error: "Please select a price type from the dropdown list.",
        };
        // Col G: PAYMENT_TYPE
        worksheet.getCell(`G${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [paymentFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Payment Type",
          error: "Please select a payment type from the dropdown list.",
        };
        // Col H: CURRENCY
        worksheet.getCell(`H${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [curFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Currency",
          error: "Please select a currency from the dropdown list.",
        };
        // Col J: ITEM_NAME (Type-ahead autocomplete dropdown)
        worksheet.getCell(`J${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [itemFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Item Name",
          error: "Please select a valid item name from the autocomplete list.",
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Sales_Invoices_Upload_Template.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Template downloaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate template");
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!rows.length) {
          toast.error("No rows found in the uploaded file");
          return;
        }

        const grouped = groupInvoices(rows);
        if (!grouped.length) {
          toast.error("No valid sales invoices parsed from file");
          return;
        }

        setParsedInvoices(grouped);
        setPreview(true);
        toast.info(`Parsed ${grouped.length} sales invoice(s) with ${rows.length} total line items`);
      } catch (err) {
        toast.error("Failed to parse file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const groupInvoices = (rawRows) => {
    const formatDate = (d) => {
      if (!d) return "";
      if (d instanceof Date) {
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
      }
      return String(d).trim();
    };

    const invMap = new Map();

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const cust = String(row.CUSTOMER_NAME || row.customer_name || "").trim();
      const invDate = formatDate(row.INVOICE_DATE || row.invoice_date) || new Date().toISOString().slice(0, 10);
      const remarks = String(row.REMARKS || row.remarks || "").trim();
      const wh = String(row.WAREHOUSE_NAME || row.warehouse_name || "").trim();

      if (!cust) continue;

      const brIdent = String(row.BRANCH_NAME || row.branch_name || row.BRANCH || row.branch || row.BRANCH_ID || row.branch_id || "").trim();
      const matchedBranch = branches.find(
        (b) =>
          (b.branch_name && b.branch_name.toLowerCase() === brIdent.toLowerCase()) ||
          (b.branch_code && b.branch_code.toLowerCase() === brIdent.toLowerCase()) ||
          String(b.id) === brIdent
      );
      const branchName = matchedBranch?.branch_name || brIdent || (branches.find((b) => String(b.id) === String(selectedBranch))?.branch_name || "");
      const branchId = matchedBranch?.id || (selectedBranch ? Number(selectedBranch) : (branches[0]?.id || 1));

      const groupKey = remarks
        ? `CUST_${cust}_DATE_${invDate}_REM_${remarks}`
        : `CUST_${cust}_DATE_${invDate}_WH_${wh}_${i}`;

      if (!invMap.has(groupKey)) {
        invMap.set(groupKey, {
          branch_id: branchId,
          branch_name: branchName,
          warehouse_name: wh,
          customer_name: cust,
          invoice_no: "",
          invoice_date: invDate,
          due_date: formatDate(row.DUE_DATE || row.due_date),
          price_type: String(row.PRICE_TYPE || row.price_type || "RETAIL").trim(),
          payment_type: String(row.PAYMENT_TYPE || row.payment_type || "CREDIT").trim(),
          currency_code: String(row.CURRENCY || row.currency || row.CURRENCY_CODE || row.currency_code || "GHS").trim(),
          exchange_rate: Number(row.EXCHANGE_RATE || row.exchange_rate || 1) || 1,
          remarks,
          lines: [],
        });
      }

      const currentInv = invMap.get(groupKey);
      const qty = Number(row.QTY ?? row.qty ?? 1);
      const unitPrice = Number(row.UNIT_PRICE ?? row.unit_price ?? 0);
      const discPct = Number(row.DISCOUNT_PERCENT ?? row.discount_percent ?? 0);
      const taxAmt = Number(row.TAX_AMOUNT ?? row.tax_amount ?? 0);
      const gross = qty * unitPrice;
      const net = gross - (gross * discPct) / 100;
      const total = net + taxAmt;

      currentInv.lines.push({
        item_name: String(row.ITEM_NAME || row.item_name || row.ITEM_CODE || row.item_code || "").trim(),
        qty,
        unit_price: unitPrice,
        discount_percent: discPct,
        tax_amount: taxAmt,
        line_total: total,
        remarks: String(row.REMARKS || row.remarks || "").trim(),
      });
    }

    return Array.from(invMap.values());
  };

  const handleUpload = async () => {
    if (!parsedInvoices.length) {
      toast.error("No sales invoices to upload");
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const resp = await api.post("/sales/bulk-upload", {
        invoices: parsedInvoices,
        updateFinanceVouchers,
        branchId: selectedBranch ? Number(selectedBranch) : null,
      });

      setUploadResult(resp.data);
      toast.success(
        `Successfully uploaded ${resp.data.createdCount || parsedInvoices.length} sales invoice(s)!`
      );
      setPreview(false);
      setParsedInvoices([]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to upload sales invoices");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <Link
            to="/sales"
            className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Sales
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Sales Invoices Upload</h1>
          <p className="text-sm text-white/80 mt-1">
            Download template, fill in customer invoices, and bulk upload into Sales & Finance modules
          </p>
        </div>

        <div className="card-body p-6 space-y-6">
          {/* Settings & Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300">
                Target Branch
              </label>
              <select
                className="input text-sm mt-1"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="">Select Branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branch_name || b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-center">
              <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-2">
                Finance Integration
              </label>
              <label className="flex items-center gap-3 cursor-pointer bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand transition-colors">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand focus:ring-brand w-4 h-4"
                  checked={updateFinanceVouchers}
                  onChange={(e) => setUpdateFinanceVouchers(e.target.checked)}
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Update Finance Vouchers (fin_vouchers)
                  </span>
                  <p className="text-slate-500 text-[11px]">
                    Auto-posts Sales Voucher entries into General Ledger
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Quick Action Steps Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="inline-block bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1">
                  Step 1
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Download Sales Invoices Template
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Get pre-formatted spreadsheet with required invoice and line item columns
                </p>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="btn btn-success text-xs px-4 py-2 font-semibold inline-flex items-center gap-2 whitespace-nowrap shadow-sm"
              >
                <Download size={15} /> Download Template
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="inline-block bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1">
                  Step 2
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Upload Completed Excel Sheet
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Select your filled Excel file (.xlsx, .xls, or .csv) to preview & import
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn btn-primary text-xs px-4 py-2 font-semibold inline-flex items-center gap-2 whitespace-nowrap shadow-sm"
              >
                <Upload size={15} /> Select File
              </button>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={handleFile}
          />

          {/* Upload Result Modal/Banner */}
          {uploadResult && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-semibold text-base">
                <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                Upload Successful! {uploadResult.createdCount} Sales Invoice(s) Created.
              </div>
              {uploadResult.createdInvoices && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900">
                  <table className="table table-compact w-full text-xs">
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Customer</th>
                        <th>Grand Total</th>
                        <th>Finance Voucher ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadResult.createdInvoices.map((ci, idx) => (
                        <tr key={idx}>
                          <td className="font-semibold text-brand">{ci.invoiceNo}</td>
                          <td>{ci.customerName}</td>
                          <td>{Number(ci.grandTotal).toFixed(2)}</td>
                          <td>
                            {ci.voucherId ? (
                              <span className="badge badge-success text-[10px]">Voucher #{ci.voucherId}</span>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Preview Section */}
          {preview && parsedInvoices.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileSpreadsheet size={18} className="text-brand" />
                    Preview Data ({parsedInvoices.length} Invoice{parsedInvoices.length !== 1 ? "s" : ""})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review parsed details below before confirming upload.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setPreview(false);
                      setParsedInvoices([]);
                    }}
                    className="btn btn-secondary text-xs px-3 py-1.5"
                    disabled={uploading}
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="btn btn-success text-xs px-5 py-1.5 inline-flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Uploading...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} /> Confirm & Upload Invoices
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {parsedInvoices.map((inv, idx) => {
                  const totalNet = inv.lines.reduce((s, l) => s + (l.line_total || 0), 0);

                  return (
                    <div
                      key={idx}
                      className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3"
                    >
                      <div className="flex flex-wrap justify-between items-center text-xs gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-brand text-[11px] font-bold">
                            Invoice #{idx + 1}: {inv.invoice_no || "Auto-Generate"}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Customer: {inv.customer_name}
                          </span>
                          {inv.branch_name && (
                            <span className="badge badge-outline text-[10px] text-brand-700 bg-brand-50 border-brand-200">
                              Branch: {inv.branch_name}
                            </span>
                          )}
                          {inv.warehouse_name && (
                            <span className="badge badge-outline text-[10px] text-slate-500">
                              Wh: {inv.warehouse_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                          <span>Date: {inv.invoice_date}</span>
                          <span>Price Type: {inv.price_type}</span>
                          <span>Payment: {inv.payment_type}</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            Total: {totalNet.toFixed(2)} {inv.currency_code}
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-xs table-fixed divide-y divide-slate-200 dark:divide-slate-700">
                          <colgroup>
                            <col style={{ width: "16.666%" }} />
                            <col style={{ width: "16.666%" }} />
                            <col style={{ width: "16.666%" }} />
                            <col style={{ width: "16.666%" }} />
                            <col style={{ width: "16.666%" }} />
                            <col style={{ width: "16.666%" }} />
                          </colgroup>
                          <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr>
                              <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider" style={{ width: "16.666%", textAlign: "left" }}>
                                Item Name
                              </th>
                              <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider" style={{ width: "16.666%", textAlign: "right" }}>
                                Qty
                              </th>
                              <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider" style={{ width: "16.666%", textAlign: "right" }}>
                                Unit Price
                              </th>
                              <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider" style={{ width: "16.666%", textAlign: "right" }}>
                                Disc %
                              </th>
                              <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider" style={{ width: "16.666%", textAlign: "right" }}>
                                Tax
                              </th>
                              <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider" style={{ width: "16.666%", textAlign: "right" }}>
                                Line Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                            {inv.lines.map((l, lIdx) => (
                              <tr key={lIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="px-3 py-2.5 truncate" style={{ width: "16.666%", textAlign: "left", minWidth: 0 }}>
                                  <span className="font-medium truncate block text-slate-800 dark:text-slate-200">{l.item_name || "Custom Item"}</span>
                                  {l.remarks && (
                                    <span className="text-[10px] text-slate-400 block truncate">{l.remarks}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300" style={{ width: "16.666%", textAlign: "right" }}>
                                  {l.qty}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300" style={{ width: "16.666%", textAlign: "right" }}>
                                  {Number(l.unit_price).toFixed(2)}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300" style={{ width: "16.666%", textAlign: "right" }}>
                                  {l.discount_percent}%
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300" style={{ width: "16.666%", textAlign: "right" }}>
                                  {Number(l.tax_amount).toFixed(2)}
                                </td>
                                <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-slate-100" style={{ width: "16.666%", textAlign: "right", minWidth: 0 }}>
                                  {Number(l.line_total).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
