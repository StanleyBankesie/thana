import React, { useState } from "react";
import {
  X, Download, FileSpreadsheet, FileText, Printer, Check
} from "lucide-react";
import { toast } from "react-toastify";
import { exportToExcel, exportToCsv, printReport } from "../utils/biExport.js";

export default function BIExportModal({
  isOpen,
  onClose,
  title = "Business Intelligence Report",
  moduleName = "Analytics",
  filters = {},
  kpis = [],
  columns = [],
  rows = [],
}) {
  const [selectedFormat, setSelectedFormat] = useState("excel");
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      if (selectedFormat === "excel") {
        exportToExcel({
          fileName: `BI_${moduleName}_Report`,
          title,
          moduleName,
          filters,
          kpis,
          columns,
          rows,
        });
        toast.success("Excel (.xlsx) file exported successfully!");
      } else if (selectedFormat === "csv") {
        exportToCsv({
          fileName: `BI_${moduleName}_Report`,
          columns,
          rows,
        });
        toast.success("CSV file exported successfully!");
      } else if (selectedFormat === "print") {
        printReport();
      }
      onClose();
    } catch {
      toast.error("Failed to export report.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-erp-xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <Download size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Export Analysis</h3>
              <p className="text-xs text-slate-400">Download formatted reports preserving applied filters</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">Select Export Format</label>
            
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSelectedFormat("excel")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
                  selectedFormat === "excel"
                    ? "border-brand-600 bg-brand-50/50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-200 font-bold"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <FileSpreadsheet size={24} className={selectedFormat === "excel" ? "text-green-600" : "text-slate-400"} />
                <span className="text-xs">Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat("csv")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
                  selectedFormat === "csv"
                    ? "border-brand-600 bg-brand-50/50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-200 font-bold"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <FileText size={24} className={selectedFormat === "csv" ? "text-blue-600" : "text-slate-400"} />
                <span className="text-xs">CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat("print")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
                  selectedFormat === "print"
                    ? "border-brand-600 bg-brand-50/50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-200 font-bold"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Printer size={24} className={selectedFormat === "print" ? "text-purple-600" : "text-slate-400"} />
                <span className="text-xs">PDF / Print</span>
              </button>
            </div>
          </div>

          {/* Export Details info */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs space-y-1 text-slate-500">
            <div className="flex justify-between">
              <span>Report Title:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{title}</span>
            </div>
            <div className="flex justify-between">
              <span>Included Records:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{rows.length} rows</span>
            </div>
            <div className="flex justify-between">
              <span>Included KPIs:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{kpis.length} metrics</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-xs px-3.5 py-1.5">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary text-xs px-5 py-1.5 gap-1.5"
          >
            <Download size={13} />
            <span>{exporting ? "Generating..." : "Download Export"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
