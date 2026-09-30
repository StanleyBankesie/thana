/**
 * @fileoverview VoucherImportPage component.
 * Provides functionality for VoucherImportPage.
 */

import React, { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { api } from "api/client";

const TEMPLATE_HEADERS = [
  "branch_id",
  "voucher_id",
  "voucher_type_code",
  "voucher_date",
  "currency_name",
  "exchange_rate",
  "account_name",
  "description",
  "debit",
  "credit",
  "cheque_number",
  "cheque_date",
];

import { usePermission } from "@/auth/PermissionContext.jsx";
import { AlertCircle, ArrowLeft } from "lucide-react";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function VoucherImportPage() {
  const { canAccessFeatureKey, isSuper } = usePermission();
  const fileRef = useRef(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");

  const hasAccess = isSuper || canAccessFeatureKey("finance", "import-vouchers");

  useEffect(() => {
    if (!hasAccess) return;
    api.get("/admin/branches").then((r) => {
      const items = r.data?.items || [];
      setBranches(items);
      if (items.length === 1) setSelectedBranch(String(items[0].id));
    }).catch(() => {});
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl mt-12 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          You do not have permission to access the Import Vouchers page. This exclusive permission can only be granted by a System Administrator under Admin Permissions in System Configuration.
        </p>
        <Link to="/finance" className="btn btn-secondary text-xs px-4 py-2 inline-flex items-center gap-1.5">
          <ArrowLeft size={14} /> Return to Finance
        </Link>
      </div>
    );
  }

  const downloadTemplate = () => {
    const bId = selectedBranch || "";
    const rows = [
      TEMPLATE_HEADERS,
      [bId, "VOUCH-001", "Journal Voucher", "2026-01-15", "US Dollar", "1", "Sales Revenue", "January sales", "5000", "", "", ""],
      ["", "", "", "", "", "", "Cash in Hand", "January sales", "", "5000", "", ""],
      [bId, "VOUCH-002", "Payment Voucher", "2026-01-16", "Ghana Cedis", "1", "Rent Expense", "Office rent Q1", "2000", "", "CHQ-00123", "2026-01-16"],
      ["", "", "", "", "", "", "Bank Account", "Office rent Q1", "", "2000", "", ""],
      [bId, "VOUCH-003", "Receipt Voucher", "2026-01-17", "", "1", "Bank Account", "Customer payment", "3500", "", "", ""],
      ["", "", "", "", "", "", "Accounts Receivable", "Customer payment", "", "3500", "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 10 },
      { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
      { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 12 },
      { wch: 18 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Voucher Import Template");
    XLSX.writeFile(wb, "Voucher_Import_Template.xlsx");
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) {
          toast.error("No data found in the file");
          return;
        }
        // Group rows by voucher header
        const grouped = groupRows(rows);
        setParsedRows(grouped);
        setPreview(true);
      } catch (err) {
        toast.error("Failed to parse file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const branchName = (id) => {
    const b = branches.find((x) => String(x.id) === String(id));
    return b ? b.name : id || "-";
  };

  const groupRows = (rawRows) => {
    const vouchers = [];
    let current = null;

    const formatDate = (d) => {
      if (!d) return "";
      if (d instanceof Date) {
        // Adjust for timezone offset to prevent off-by-one day errors
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
      }
      return String(d).trim();
    };

    for (const row of rawRows) {
      const vtc = String(row.voucher_type_code || "").trim();
      const vDate = formatDate(row.voucher_date);
      const acctName = String(row.account_name || "").trim();
      const voucherId = String(row.voucher_id || "").trim();

      // If voucher_type_code is present, start a new voucher header
      if (vtc) {
        let normalizedVtc = vtc;
        const lower = vtc.toLowerCase();
        if (lower === "journal entry" || lower === "journal voucher") {
          normalizedVtc = "Journal Voucher";
        } else if (lower === "payment voucher") {
          normalizedVtc = "Payment Voucher";
        } else if (lower === "receipt voucher") {
          normalizedVtc = "Receipt Voucher";
        } else if (lower === "sales voucher") {
          normalizedVtc = "Sales Voucher";
        } else if (lower === "purchase voucher") {
          normalizedVtc = "Purchase Voucher";
        }

        const rawBid = row.branch_id !== undefined ? row.branch_id : row.branchId;
        current = {
          branch_id: rawBid ? Number(rawBid) : null,
          voucher_id: voucherId || null,
          voucher_type_code: normalizedVtc,
          voucher_date: vDate || new Date().toISOString().slice(0, 10),
          currency_name: String(row.currency_name || "").trim() || null,
          exchange_rate: Number(row.exchange_rate || 1) || 1,
          lines: [],
        };
        vouchers.push(current);
      }

      // Add line if account_name is present
      if (acctName && current) {
        current.lines.push({
          account_name: acctName,
          description: String(row.description || "").trim() || null,
          debit: Number(row.debit || 0),
          credit: Number(row.credit || 0),
          cheque_number: String(row.cheque_number || "").trim() || null,
          cheque_date: formatDate(row.cheque_date) || null,
        });
      }
    }
    return vouchers;
  };

  const handleUpload = async () => {
    if (!parsedRows.length) return;
    setUploading(true);
    setResult(null);
    try {
      const res = await api.post("/finance/vouchers/bulk-import", {
        vouchers: parsedRows,
        defaultBranchId: selectedBranch ? Number(selectedBranch) : undefined,
      });
      setResult(res.data);
      const msg = `Created: ${res.data.created}, Failed: ${res.data.failed}`;
      if (res.data.failed > 0) {
        toast.warning(msg);
      } else {
        toast.success(msg);
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err.message || "Import failed";
      toast.error(errorMsg);
      setResult({
        created: 0,
        failed: parsedRows.length,
        errors: [{ row: "All", message: errorMsg }]
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold">Import Vouchers</h1>
              <p className="text-sm mt-1">
                Download a template, fill in your data, and upload to bulk import vouchers
              </p>
            </div>
            <Link to="/finance" className="font-sans btn btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>
        <div className="card-body space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">How to import</h3>
            <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-400 space-y-1">
              <li>Download the template file using the button below</li>
              <li>Fill in the template — each voucher starts with a row containing <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">voucher_type_code</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">voucher_date</code>, and optional <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">voucher_id</code></li>
              <li>Subsequent rows for the same voucher should have <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">account_name</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">debit</code>/<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">credit</code></li>
              <li>Leave <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">voucher_type_code</code> blank on continuation rows</li>
              <li>Upload the file and review the preview before importing</li>
            </ol>
          </div>

          {/* Branch selector */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Branch:
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="ml-2 rounded border px-3 py-2 text-sm"
              >
                <option value="">-- Select Branch --</option>
                {branches.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={downloadTemplate}
              className="btn-primary bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded shadow-sm font-medium"
            >
              Download Template
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-success bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded shadow-sm font-medium"
            >
              Select File to Upload
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {/* Results */}
          {result && (
            <div
              className={`p-4 rounded-lg border ${
                result.failed > 0
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-green-50 border-green-200"
              }`}
            >
              <h3 className="font-semibold mb-2">Import Results</h3>
              <p>
                Created: <strong>{result.created}</strong> | Failed:{" "}
                <strong>{result.failed}</strong>
              </p>
              {result.errors?.length > 0 && (
                <ul className="mt-2 text-sm text-red-700 space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Preview */}
          {preview && parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Preview — {parsedRows.length} voucher(s) found
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreview(false);
                      setParsedRows([]);
                      setResult(null);
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700 disabled:opacity-50"
                  >
                    {uploading ? "Importing..." : "Import All"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto border rounded">
                <table className="table text-sm">
                  <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr>
                      <th>#</th>
                      <th>Branch</th>
                      <th>Voucher ID</th>
                      <th>Voucher Type</th>
                      <th>Date</th>
                      <th>Currency</th>
                      <th>Account</th>
                      <th>Description</th>
                      <th className="text-right">Debit</th>
                      <th className="text-right">Credit</th>
                      <th>Cheque No</th>
                      <th>Cheque Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((v, vi) =>
                      v.lines.length ? (
                        v.lines.map((ln, li) => (
                          <tr
                            key={`${vi}-${li}`}
                            className={li === 0 ? "border-t-2 border-gray-300" : ""}
                          >
                            <td className="font-medium">{li === 0 ? vi + 1 : ""}</td>
                            <td>{li === 0 ? branchName(v.branch_id) : ""}</td>
                            <td>{li === 0 ? v.voucher_id || "-" : ""}</td>
                            <td className="font-medium">
                              {li === 0 ? (
                                <span className="badge badge-info">
                                  {v.voucher_type_code}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">
                                  {v.voucher_type_code}
                                </span>
                              )}
                            </td>
                            <td>{li === 0 ? v.voucher_date : ""}</td>
                            <td>{li === 0 ? v.currency_name || "-" : ""}</td>
                            <td className="font-medium">{ln.account_name}</td>
                            <td className="max-w-[200px] truncate">{ln.description || "-"}</td>
                            <td className="text-right font-mono">
                              {Number(ln.debit || 0) > 0
                                ? Number(ln.debit).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                  })
                                : "-"}
                            </td>
                            <td className="text-right font-mono">
                              {Number(ln.credit || 0) > 0
                                ? Number(ln.credit).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                  })
                                : "-"}
                            </td>
                            <td>{ln.cheque_number || "-"}</td>
                            <td>{ln.cheque_date || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr key={`${vi}-0`} className="border-t-2 border-gray-300">
                          <td>{vi + 1}</td>
                          <td>{branchName(v.branch_id)}</td>
                          <td>{v.voucher_id || "-"}</td>
                          <td className="font-medium">
                            <span className="badge badge-info">{v.voucher_type_code}</span>
                          </td>
                          <td>{v.voucher_date}</td>
                          <td>{v.currency_name || "-"}</td>
                          <td colSpan="6" className="text-red-500 italic">
                            No lines
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
