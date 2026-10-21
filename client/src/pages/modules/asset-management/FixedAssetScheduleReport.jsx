import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileSpreadsheet, Printer, Download, Calendar, 
  RefreshCw, Building2, CheckCircle2, ArrowLeft 
} from "lucide-react";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";

function formatCurrency(val) {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FixedAssetScheduleReport() {
  const navigate = useNavigate();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState([]);

  useEffect(() => {
    fetchReport();
  }, [asOfDate]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get("/assets/reports/schedule", {
        params: { as_of_date: asOfDate },
      });
      setReportData(res.data?.data || []);
    } catch {
      toast.error("Failed to generate Fixed Asset Schedule report");
    } finally {
      setLoading(false);
    }
  };

  const totals = reportData.reduce(
    (acc, row) => ({
      beg_gross_cost: acc.beg_gross_cost + Number(row.beg_gross_cost || 0),
      additions_cost: acc.additions_cost + Number(row.additions_cost || 0),
      disposals_cost: acc.disposals_cost + Number(row.disposals_cost || 0),
      end_gross_cost: acc.end_gross_cost + Number(row.end_gross_cost || 0),
      beg_accum_dep: acc.beg_accum_dep + Number(row.beg_accum_dep || 0),
      period_dep: acc.period_dep + Number(row.period_dep || 0),
      disposals_dep: acc.disposals_dep + Number(row.disposals_dep || 0),
      end_accum_dep: acc.end_accum_dep + Number(row.end_accum_dep || 0),
      end_nbv: acc.end_nbv + Number(row.end_nbv || 0),
    }),
    {
      beg_gross_cost: 0,
      additions_cost: 0,
      disposals_cost: 0,
      end_gross_cost: 0,
      beg_accum_dep: 0,
      period_dep: 0,
      disposals_dep: 0,
      end_accum_dep: 0,
      end_nbv: 0,
    }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm"
            title="Go Back"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              Statutory Fixed Asset Schedule (IFRS / GAAP)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Audit-ready summary of fixed asset historical cost additions, disposals, depreciation movements, and Net Book Value.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              As Of Date:
            </label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="btn btn-outline inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold"
          >
            <Printer size={14} /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* Main Schedule Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden p-6 print:border-none print:shadow-none print:p-0">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Statement of Fixed Assets & Depreciation Movement
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Period Ending: <strong>{new Date(asOfDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</strong> | Reporting Currency: <strong>USD / Local Currency</strong>
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Compiling fixed asset schedule...</p>
          </div>
        ) : reportData.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No fixed assets data found for the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-y border-slate-300 dark:border-slate-700">
                  <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700">
                    Asset Class / Category
                  </th>
                  <th colSpan={4} className="py-2 px-3 text-center border-r border-slate-200 dark:border-slate-700 bg-slate-200/50 dark:bg-slate-700/40">
                    Gross Cost / Valuation
                  </th>
                  <th colSpan={4} className="py-2 px-3 text-center border-r border-slate-200 dark:border-slate-700 bg-slate-200/30 dark:bg-slate-700/20">
                    Accumulated Depreciation
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                    Net Book Value (NBV)
                  </th>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-300 dark:border-slate-700">
                  <th className="py-2 px-2 text-right">Beginning</th>
                  <th className="py-2 px-2 text-right text-emerald-600">Additions</th>
                  <th className="py-2 px-2 text-right text-rose-600">Disposals</th>
                  <th className="py-2 px-2 text-right font-bold border-r border-slate-200 dark:border-slate-700">Ending Cost</th>
                  <th className="py-2 px-2 text-right">Beginning</th>
                  <th className="py-2 px-2 text-right text-rose-600">Charge</th>
                  <th className="py-2 px-2 text-right text-emerald-600">Disposals</th>
                  <th className="py-2 px-2 text-right font-bold border-r border-slate-200 dark:border-slate-700">Ending Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700">
                      {row.category_name}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(row.beg_gross_cost)}
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(row.additions_cost)}
                    </td>
                    <td className="py-2 px-2 text-right text-rose-600 dark:text-rose-400">
                      {formatCurrency(row.disposals_cost)}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700">
                      {formatCurrency(row.end_gross_cost)}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(row.beg_accum_dep)}
                    </td>
                    <td className="py-2 px-2 text-right text-rose-600 dark:text-rose-400">
                      {formatCurrency(row.period_dep)}
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(row.disposals_dep)}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700">
                      {formatCurrency(row.end_accum_dep)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(row.end_nbv)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                  <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-700">
                    TOTAL FIXED ASSETS
                  </td>
                  <td className="py-3 px-2 text-right">{formatCurrency(totals.beg_gross_cost)}</td>
                  <td className="py-3 px-2 text-right text-emerald-600">{formatCurrency(totals.additions_cost)}</td>
                  <td className="py-3 px-2 text-right text-rose-600">{formatCurrency(totals.disposals_cost)}</td>
                  <td className="py-3 px-2 text-right border-r border-slate-200 dark:border-slate-700">{formatCurrency(totals.end_gross_cost)}</td>
                  <td className="py-3 px-2 text-right">{formatCurrency(totals.beg_accum_dep)}</td>
                  <td className="py-3 px-2 text-right text-rose-600">{formatCurrency(totals.period_dep)}</td>
                  <td className="py-3 px-2 text-right text-emerald-600">{formatCurrency(totals.disposals_dep)}</td>
                  <td className="py-3 px-2 text-right border-r border-slate-200 dark:border-slate-700">{formatCurrency(totals.end_accum_dep)}</td>
                  <td className="py-3 px-3 text-right text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    {formatCurrency(totals.end_nbv)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
