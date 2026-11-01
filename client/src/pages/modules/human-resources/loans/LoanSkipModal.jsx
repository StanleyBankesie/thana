import React, { useState, useEffect, useCallback } from "react";
import Modal from "@/components/Modal";
import { SkipForward, Calendar, Trash2, Plus, CheckCircle2 } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function LoanSkipModal({ open, onClose, loan, onSuccess }) {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [reason, setReason] = useState("");
  const [skips, setSkips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load periods
  useEffect(() => {
    if (open) {
      api
        .get("/hr/payroll/periods")
        .then((res) => {
          const list = res.data?.items || [];
          setPeriods(list);
          // Auto select first open period
          const openPeriod = list.find((p) => p.status === "OPEN") || list[0];
          if (openPeriod) setSelectedPeriod(String(openPeriod.id));
        })
        .catch(() => {});
    }
  }, [open]);

  // Load skips for this loan
  const loadSkips = useCallback(async () => {
    if (!loan?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/hr/loans/${loan.id}/skips`);
      setSkips(res.data?.items || []);
    } catch {
      toast.error("Failed to load configured skips");
    } finally {
      setLoading(false);
    }
  }, [loan?.id]);

  useEffect(() => {
    if (open && loan) {
      loadSkips();
      setReason("");
    }
  }, [open, loan, loadSkips]);

  if (!loan) return null;

  const handleAddSkip = async (e) => {
    e.preventDefault();
    if (!selectedPeriod) {
      toast.error("Please select a payroll period");
      return;
    }
    const periodId = Number(selectedPeriod);
    let monthToSkip = "";
    const matched = periods.find((p) => String(p.id) === String(selectedPeriod));
    if (matched?.start_date) {
      const d = new Date(matched.start_date);
      monthToSkip = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    } else {
      const now = new Date();
      monthToSkip = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    setSaving(true);
    try {
      const res = await api.post(`/hr/loans/${loan.id}/skips`, {
        period_id: periodId,
        skip_month: monthToSkip,
        reason: reason.trim() || "Loan deduction skipped by HR for this month",
      });
      toast.success(
        res.data?.message || `Loan deduction will be skipped for ${monthToSkip}`
      );
      setReason("");
      await loadSkips();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to skip deduction");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSkip = async (skipId, monthName) => {
    if (!window.confirm(`Resume loan deduction for ${monthName}?`)) return;
    try {
      await api.delete(`/hr/loans/${loan.id}/skips/${skipId}`);
      toast.success(`Deduction resumed for ${monthName}`);
      await loadSkips();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove skip");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Skip Loan Deduction for Month"
      subtitle={`Configure monthly loan deduction pause for ${loan.first_name} ${loan.last_name}`}
      icon={<SkipForward size={20} />}
      maxWidth="max-w-2xl"
      showFooter={false}
    >
      <div className="space-y-4">
        {/* Loan Details Banner - code removed from Loan Type */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {loan.first_name} {loan.last_name}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
              {loan.loan_type}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Monthly Installment
            </span>
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
              GHS{" "}
              {Number(loan.monthly_installment || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* Add Skip Form */}
        <form
          onSubmit={handleAddSkip}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-brand" /> Add Month to Skip
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">
                Payroll Period <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                required
              >
                <option value="">-- Select Period --</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_name} {p.status === "CLOSED" ? "(Closed)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Reason / Remarks</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Employee requested emergency deferral"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Skip Deduction for this Month
                </>
              )}
            </button>
          </div>
        </form>

        {/* Existing Skips Table */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
            Configured Skips for this Loan ({skips.length})
          </h3>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-slate-500">
                    Skipped Month / Period
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-slate-500">
                    Reason
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-slate-500">
                    Configured By
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {skips.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-3 py-2.5 font-medium font-mono">
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold mr-1.5">
                        {s.skip_month}
                      </span>
                      {s.period_name && (
                        <span className="text-slate-500">
                          ({s.period_name})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {s.reason || "Skipped by HR"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {s.created_by_name || "Admin"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveSkip(s.id, s.skip_month)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 font-medium flex items-center gap-1 ml-auto"
                        title="Resume deduction"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Resume Deduction
                      </button>
                    </td>
                  </tr>
                ))}
                {skips.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-6 text-center text-slate-400"
                    >
                      No months are currently skipped. Deductions will proceed
                      automatically every payroll cycle.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
