import * as XLSX from "xlsx";

/**
 * Exports data to Excel (.xlsx) workbook with formatted summary and details sheets.
 */
export function exportToExcel({
  fileName = "BI_Analysis_Export",
  title = "Business Intelligence Report",
  moduleName = "Analytics",
  filters = {},
  kpis = [],
  columns = [],
  rows = [],
}) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary & Metadata
  const summaryData = [
    ["OMNISUITE ERP — BUSINESS INTELLIGENCE"],
    [title],
    ["Module:", moduleName],
    ["Generated At:", new Date().toLocaleString()],
    [""],
    ["APPLIED FILTERS"],
    ...Object.entries(filters).filter(([_, v]) => v !== undefined && v !== "" && v !== null).map(([k, v]) => [k, String(v)]),
    [""],
    ["EXECUTIVE KPIS"],
    ...kpis.map(k => [k.label, k.value, k.sub || ""]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // Sheet 2: Detailed Data Table
  if (rows && rows.length > 0) {
    const headers = columns.map(c => c.label || c.key);
    const tableData = [
      headers,
      ...rows.map(r => columns.map(c => {
        const val = r[c.key];
        return val !== undefined && val !== null ? val : "";
      }))
    ];
    const wsDetails = XLSX.utils.aoa_to_sheet(tableData);
    XLSX.utils.book_append_sheet(wb, wsDetails, "Data Details");
  }

  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports data to standard CSV format.
 */
export function exportToCsv({
  fileName = "BI_Analysis_Export",
  columns = [],
  rows = [],
}) {
  if (!rows || rows.length === 0) return;
  const headers = columns.map(c => `"${c.label || c.key}"`).join(",");
  const csvRows = rows.map(r =>
    columns.map(c => {
      const val = r[c.key];
      const str = val !== undefined && val !== null ? String(val) : "";
      return `"${str.replace(/"/g, '""')}"`;
    }).join(",")
  );
  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...csvRows].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Triggers clean browser print with print styles.
 */
export function printReport() {
  window.print();
}
