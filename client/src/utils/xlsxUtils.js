/**
 * @file xlsxUtils.js
 * @description Utility functions for working with Excel files using xlsx.
 */

import * as XLSX from "xlsx";

/**
 * Auto-sizes the columns of an Excel worksheet based on the content length.
 * @param {Object} ws - The worksheet object from xlsx.
 * @param {Object} [opts={}] - Sizing options.
 * @param {number} [opts.min=12] - Minimum column width.
 * @param {number} [opts.max=40] - Maximum column width.
 * @param {number} [opts.pad=2] - Padding to add to the maximum string length.
 */
export function autosizeWorksheetColumns(ws, opts = {}) {
  const min = Number(opts.min || 12);
  const max = Number(opts.max || 40);
  const pad = Number(opts.pad || 2);
  const arr = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const colCount = arr.reduce((m, r) => Math.max(m, r.length), 0);
  const widths = new Array(colCount).fill(0);
  for (let r = 0; r < arr.length; r++) {
    for (let c = 0; c < colCount; c++) {
      const v = arr[r] && arr[r][c] != null ? String(arr[r][c]) : "";
      if (v.length > widths[c]) widths[c] = v.length;
    }
  }
  ws["!cols"] = widths.map((w) => ({ wch: Math.min(Math.max(w + pad, min), max) }));
}
