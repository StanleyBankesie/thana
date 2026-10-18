import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Calculator, Play, CheckCircle2, AlertTriangle, 
  Clock, DollarSign, FileText, ChevronRight, RefreshCw, Layers, ArrowLeft 
} from "lucide-react";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";

function formatCurrency(val) {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DepreciationRunPage() {
  const navigate = useNavigate();
  const currentDate = new Date();
  const [periodYear, setPeriodYear] = useState(currentDate.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(currentDate.getMonth() + 1);
  const [periodQuarter, setPeriodQuarter] = useState(Math.ceil((currentDate.getMonth() + 1) / 3));
  const [periodHalf, setPeriodHalf] = useState((currentDate.getMonth() + 1) <= 6 ? 1 : 2);
  const [runFrequency, setRunFrequency] = useState("YEARLY");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const [posting, setPosting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(true);

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    try {
      setRunsLoading(true);
      const res = await api.get("/assets/depreciation/runs");
      setRuns(res.data?.data || []);
    } catch {
      // Ignored
    } finally {
      setRunsLoading(false);
    }
  };

  const getEffectiveMonth = () => {
    if (runFrequency === "YEARLY") return 12;
    if (runFrequency === "HALF_YEARLY") return periodHalf === 1 ? 6 : 12;
    if (runFrequency === "QUARTERLY") return periodQuarter * 3;
    return periodMonth;
  };

  const getPeriodLabel = () => {
    if (runFrequency === "YEARLY") return `Fiscal Year ${periodYear}`;
    if (runFrequency === "HALF_YEARLY") return `${periodYear} H${periodHalf} (Through ${periodHalf === 1 ? "June" : "December"})`;
    if (runFrequency === "QUARTERLY") return `${periodYear} Q${periodQuarter} (Through Month ${periodQuarter * 3})`;
    return `${periodYear}-${String(periodMonth).padStart(2, "0")}`;
  };

  const handleCalculatePreview = async () => {
    try {
      setPreviewLoading(true);
      const effectiveMonth = getEffectiveMonth();
      const res = await api.get("/assets/depreciation/preview", {
        params: {
          period_year: periodYear,
          period_month: effectiveMonth,
          frequency: runFrequency,
        },
      });
      setPreviewData(res.data?.data || null);
      toast.info(`Calculated ${runFrequency.toLowerCase().replace(/_/g, " ")} depreciation preview for ${getPeriodLabel()}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to calculate depreciation preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePostRun = async () => {
    try {
      setPosting(true);
      const effectiveMonth = getEffectiveMonth();
      const res = await api.post("/assets/depreciation/post", {
        period_year: periodYear,
        period_month: effectiveMonth,
        frequency: runFrequency,
        items: previewData?.preview_lines || [],
      });
      setShowConfirmModal(false);
      toast.success(res.data?.message || "Depreciation run posted to General Ledger successfully!");
      setPreviewData(null);
      fetchRuns();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to post depreciation run");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
              <Calculator className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              Automated Asset Depreciation Engine
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Execute periodic (annual, half-yearly, quarterly, monthly) depreciation runs, preview amortization, and post balanced GL Journal Vouchers.
            </p>
          </div>
        </div>
      </div>

      {/* Control Card: Period Selector & Action */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Depreciation Period & Calculation Controls
        </h2>

        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Calculation Frequency Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Frequency:
              </label>
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
                {[
                  { key: "YEARLY", label: "Yearly" },
                  { key: "HALF_YEARLY", label: "Half-Yearly" },
                  { key: "QUARTERLY", label: "Quarterly" },
                  { key: "MONTHLY", label: "Monthly" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setRunFrequency(key);
                      setPreviewData(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      runFrequency === key
                        ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fiscal Year */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Year:
              </label>
              <select
                value={periodYear}
                onChange={(e) => {
                  setPeriodYear(Number(e.target.value));
                  setPreviewData(null);
                }}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {[2023, 2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Sub-period controls based on frequency */}
            {runFrequency === "HALF_YEARLY" && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Half:
                </label>
                <select
                  value={periodHalf}
                  onChange={(e) => {
                    setPeriodHalf(Number(e.target.value));
                    setPreviewData(null);
                  }}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value={1}>H1 (Jan - Jun)</option>
                  <option value={2}>H2 (Jul - Dec)</option>
                </select>
              </div>
            )}

            {runFrequency === "QUARTERLY" && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Quarter:
                </label>
                <select
                  value={periodQuarter}
                  onChange={(e) => {
                    setPeriodQuarter(Number(e.target.value));
                    setPreviewData(null);
                  }}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value={1}>Q1 (Jan - Mar)</option>
                  <option value={2}>Q2 (Apr - Jun)</option>
                  <option value={3}>Q3 (Jul - Sep)</option>
                  <option value={4}>Q4 (Oct - Dec)</option>
                </select>
              </div>
            )}

            {runFrequency === "MONTHLY" && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Month:
                </label>
                <select
                  value={periodMonth}
                  onChange={(e) => {
                    setPeriodMonth(Number(e.target.value));
                    setPreviewData(null);
                  }}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {[
                    { m: 1, name: "01 - Jan" },
                    { m: 2, name: "02 - Feb" },
                    { m: 3, name: "03 - Mar" },
                    { m: 4, name: "04 - Apr" },
                    { m: 5, name: "05 - May" },
                    { m: 6, name: "06 - Jun" },
                    { m: 7, name: "07 - Jul" },
                    { m: 8, name: "08 - Aug" },
                    { m: 9, name: "09 - Sep" },
                    { m: 10, name: "10 - Oct" },
                    { m: 11, name: "11 - Nov" },
                    { m: 12, name: "12 - Dec" },
                  ].map(({ m, name }) => (
                    <option key={m} value={m}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {runFrequency === "YEARLY" && (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                Full Annual Charge
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCalculatePreview}
              disabled={previewLoading}
              className="btn btn-outline inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw size={15} className={previewLoading ? "animate-spin" : ""} />
              {previewLoading ? "Calculating..." : "Preview Calculations"}
            </button>
            {previewData && (
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={previewData.preview_lines.length === 0}
                className="btn btn-primary inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all disabled:opacity-50"
              >
                <Play size={15} /> Post to General Ledger
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview Section */}
      {previewData && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Processed Assets</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {previewData.total_assets}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Period Depreciation</span>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {formatCurrency(previewData.total_depreciation_amount)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Portfolio NBV (Before)</span>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1">
                {formatCurrency(previewData.total_nbv_before)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Portfolio NBV (After)</span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(previewData.total_nbv_after)}
              </div>
            </div>
          </div>

          {/* Line by line table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="py-3 px-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Amortization Preview Lines ({previewData.preview_lines.length} assets)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                  <tr>
                    <th className="py-3 px-4">Asset Code</th>
                    <th className="py-3 px-4">Asset Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Gross Cost</th>
                    <th className="py-3 px-4 text-right">Prior Acc. Dep.</th>
                    <th className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">
                      {runFrequency === "YEARLY" ? "Annual Dep." : runFrequency === "HALF_YEARLY" ? "Half-Yr Dep." : runFrequency === "QUARTERLY" ? "Quarterly Dep." : "Monthly Dep."}
                    </th>
                    <th className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">Ending NBV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {previewData.preview_lines.map((line) => (
                    <tr key={line.asset_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono font-medium text-brand-700 dark:text-brand-400">
                        {line.asset_code}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {line.asset_name}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                        {line.category_name}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {line.depreciation_method}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(line.purchase_cost ?? line.cost_basis)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {formatCurrency(line.accumulated_depreciation_before ?? line.prior_accum_depreciation)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(line.depreciation_amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(line.nbv_after ?? line.new_nbv)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Historical Depreciation Runs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="py-3 px-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={14} /> Historical Depreciation Runs & Journal Vouchers
          </span>
          <button
            onClick={fetchRuns}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
            title="Refresh history"
          >
            <RefreshCw size={14} className={runsLoading ? "animate-spin" : ""} />
          </button>
        </div>

        {runsLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading history...</div>
        ) : runs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No historical depreciation runs posted yet. Use the controls above to execute a run.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                <tr>
                  <th className="py-3 px-4">Run Code</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Execution Date</th>
                  <th className="py-3 px-4 text-center">Assets Processed</th>
                  <th className="py-3 px-4 text-right">Depreciation Total</th>
                  <th className="py-3 px-4">GL Voucher Reference</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {r.run_code}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {r.period_year}-{String(r.period_month).padStart(2, "0")}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {new Date(r.run_date).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                      {r.total_assets_processed}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(r.total_depreciation_amount)}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-brand-700 dark:text-brand-400 font-medium">
                      {r.gl_voucher_number || `VOUCHER #${r.gl_voucher_id || "JV"}`}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl w-full max-w-md space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-800">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Confirm General Ledger Posting
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  You are about to post <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(previewData?.total_depreciation_amount)}</strong> of {runFrequency.toLowerCase().replace(/_/g, " ")} depreciation across <strong className="text-slate-800 dark:text-slate-200">{previewData?.total_assets} assets</strong> for <strong className="text-slate-800 dark:text-slate-200">{getPeriodLabel()}</strong>.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  This action will generate a balanced Journal Voucher (JV) in the General Ledger and update asset accumulated depreciation balances.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="btn btn-secondary px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={posting}
                onClick={handlePostRun}
                className="btn btn-primary inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                {posting ? "Posting to GL..." : "Confirm & Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
