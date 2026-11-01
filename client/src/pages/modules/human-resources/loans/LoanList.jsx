/**
 * @fileoverview LoanList component (Loan Disbursements).
 * Tracks approved staff loans awaiting disbursement, active running loans,
 * automated Payment Voucher (PV) generation, monthly payroll skips, and direct receipt repayments.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import {
  DollarSign,
  SkipForward,
  History,
  Edit,
  AlertCircle,
  CheckCircle2,
  FileText,
  Plus,
  Send,
  Building,
  Calendar,
  Receipt,
  Search,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import ManualRepaymentModal from "./ManualRepaymentModal.jsx";
import LoanSkipModal from "./LoanSkipModal.jsx";
import LoanRepaymentsModal from "./LoanRepaymentsModal.jsx";

export default function LoanList() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useViewMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const tabParam = searchParams.get("tab") || "awaiting_disbursement";
  const [activeTab, setActiveTab] = useState(tabParam);

  // Modal states
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showManualPay, setShowManualPay] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/loans");
      // Only approved, active, or completed loans can appear in Loan Disbursements
      const disbursementLoans = (res.data.items || []).filter((r) =>
        ["APPROVED", "ACTIVE", "COMPLETED"].includes(r.status)
      );
      setItems(disbursementLoans);
    } catch {
      toast.error("Failed to load loans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Grouping & Statistics
  const stats = useMemo(() => {
    const awaitingDisbursement = items.filter((r) => r.status === "APPROVED");
    const active = items.filter((r) => r.status === "ACTIVE");
    const completed = items.filter(
      (r) =>
        r.status === "COMPLETED" ||
        (r.status === "ACTIVE" && Number(r.amount_due ?? r.amount ?? 0) <= 0)
    );
    const skippedThisMonth = items.filter(
      (r) => r.is_current_month_skipped
    ).length;

    const totalDisbursed = active
      .concat(completed)
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const totalOutstanding = active.reduce(
      (sum, r) => sum + Number(r.amount_due ?? r.amount ?? 0),
      0
    );
    const totalAwaitingAmount = awaitingDisbursement.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    return {
      awaitingCount: awaitingDisbursement.length,
      awaitingAmount: totalAwaitingAmount,
      activeCount: active.length,
      completedCount: completed.length,
      totalCount: items.length,
      skippedThisMonth,
      totalDisbursed,
      totalOutstanding,
    };
  }, [items]);

  // Filter items by tab and search
  const filteredItems = useMemo(() => {
    return items.filter((r) => {
      const isCompleted =
        r.status === "COMPLETED" ||
        (r.status === "ACTIVE" && Number(r.amount_due ?? r.amount ?? 0) <= 0);

      if (activeTab === "awaiting_disbursement" && r.status !== "APPROVED") {
        return false;
      }
      if (activeTab === "active" && (r.status !== "ACTIVE" || isCompleted)) {
        return false;
      }
      if (
        activeTab === "completed" &&
        !isCompleted &&
        r.status !== "COMPLETED"
      ) {
        return false;
      }

      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const fullName =
          `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase();
        const code = String(r.emp_code || r.employee_code || "").toLowerCase();
        const loanType = String(r.loan_type || "").toLowerCase();
        const voucher = String(r.disbursement_voucher_no || "").toLowerCase();
        return (
          fullName.includes(s) ||
          code.includes(s) ||
          loanType.includes(s) ||
          voucher.includes(s)
        );
      }
      return true;
    });
  }, [items, activeTab, searchTerm]);

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        {/* Header with Back button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm"
              title="Go back"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Loan Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Manage approved staff loans, disbursements with automated Payment Vouchers, direct repayments, and monthly skips
              </p>
            </div>
          </div>

        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            onClick={() => handleTabChange("awaiting_disbursement")}
            className={`p-3 bg-white dark:bg-slate-800 rounded-xl border cursor-pointer transition-all shadow-sm ${
              activeTab === "awaiting_disbursement"
                ? "border-black dark:border-white ring-1 ring-black/10 dark:ring-white/20"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-black dark:text-white block">
              Awaiting Disbursement
            </span>
            <span className="text-lg font-bold font-mono text-black dark:text-white">
              {stats.awaitingCount} loan{stats.awaitingCount === 1 ? "" : "s"}
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block font-mono">
              GHS{" "}
              {stats.awaitingAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          <div
            onClick={() => handleTabChange("active")}
            className={`p-3 bg-white dark:bg-slate-800 rounded-xl border cursor-pointer transition-all shadow-sm ${
              activeTab === "active"
                ? "border-black dark:border-white ring-1 ring-black/10 dark:ring-white/20"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-black dark:text-white block">
              Active Running Loans
            </span>
            <span className="text-lg font-bold font-mono text-black dark:text-white">
              {stats.activeCount}
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block font-mono">
              Out: GHS{" "}
              {stats.totalOutstanding.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black dark:text-white block">
              Total Disbursed (Principal)
            </span>
            <span className="text-lg font-bold font-mono text-black dark:text-white">
              GHS{" "}
              {stats.totalDisbursed.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block font-mono">
              Principal total
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black dark:text-white block">
              Skipped This Month
            </span>
            <span className="text-lg font-bold font-mono text-black dark:text-white">
              {stats.skippedThisMonth} loan
              {stats.skippedThisMonth === 1 ? "" : "s"}
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block font-mono">
              Deferred deductions
            </span>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => handleTabChange("awaiting_disbursement")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "awaiting_disbursement"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              Awaiting Disbursement
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === "awaiting_disbursement"
                    ? "bg-amber-800 text-amber-100"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                }`}
              >
                {stats.awaitingCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("active")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "active"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              Active Loans
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === "active"
                    ? "bg-emerald-800 text-emerald-100"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                }`}
              >
                {stats.activeCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("completed")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "completed"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              Completed ({stats.completedCount})
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "all"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              All Records ({stats.totalCount})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                className="input pl-8 py-1.5 text-xs w-full"
                placeholder="Search employee, voucher no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>

        {/* Table / Grid */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className={
                "min-w-full " + (viewMode === "grid" ? "table-grid-mode" : "")
              }
            >
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-left text-slate-500 uppercase font-bold text-[10px]">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3 text-right">Principal</th>
                  <th className="px-4 py-3 text-right">
                    {activeTab === "awaiting_disbursement"
                      ? "Duration"
                      : "Remaining Due"}
                  </th>
                  <th className="px-4 py-3 text-right">Installment</th>
                  <th className="px-4 py-3">Status / Voucher</th>
                  <th className="px-4 py-3 text-center">Payroll Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-xs sm:text-sm">
                {filteredItems.map((r) => {
                  const remaining = Number(r.amount_due ?? r.amount ?? 0);
                  const isCompleted =
                    r.status === "COMPLETED" || remaining <= 0;
                  const isApproved = r.status === "APPROVED";

                  return (
                    <tr
                      key={r.id}
                      onClick={() => {
                        if (isApproved) {
                          navigate(`/human-resources/loans/${r.id}/disburse`);
                        }
                      }}
                      className={`transition-colors ${
                        isApproved
                          ? "hover:bg-amber-50/60 dark:hover:bg-amber-950/20 cursor-pointer"
                          : "hover:bg-slate-50/80 dark:hover:bg-slate-700/40"
                      }`}
                    >
                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {r.first_name} {r.last_name}
                          {isApproved && (
                            <ExternalLink
                              size={12}
                              className="text-amber-600 opacity-60"
                            />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {r.emp_code || `Emp #${r.employee_id}`}
                        </div>
                      </td>

                      {/* Loan Type */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {r.loan_type}
                        </div>
                      </td>

                      {/* Principal */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                        GHS{" "}
                        {Number(r.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Remaining Due / Duration */}
                      <td className="px-4 py-3 text-right font-mono">
                        {isApproved ? (
                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                            {r.repayment_period_months || 12} Months
                          </span>
                        ) : (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            GHS{" "}
                            {remaining.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </td>

                      {/* Installment */}
                      <td className="px-4 py-3 text-right font-mono">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          GHS{" "}
                          {Number(r.monthly_installment).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          / month
                        </span>
                      </td>

                      {/* Status & Voucher Badge */}
                      <td className="px-4 py-3">
                        {isApproved ? (
                          <div>
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60 inline-flex items-center gap-1">
                              <CheckCircle2
                                size={12}
                                className="text-amber-600"
                              />
                              Approved
                            </span>
                            {r.approved_by_name && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                by {r.approved_by_name}
                              </div>
                            )}
                          </div>
                        ) : r.status === "ACTIVE" ? (
                          <div>
                            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60">
                              Active
                            </span>
                            {r.disbursement_voucher_no && (
                              <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                                PV #{r.disbursement_voucher_no}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {r.status}
                          </span>
                        )}
                      </td>

                      {/* Payroll Status */}
                      <td className="px-4 py-3 text-center">
                        {isApproved ? (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Ready for Fund Disbursement
                          </span>
                        ) : r.is_current_month_skipped ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLoan(r);
                              setShowSkipModal(true);
                            }}
                            className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-200 transition-colors"
                            title="Click to manage skip settings"
                          >
                            <SkipForward className="w-3 h-3" /> Skipped this
                            Month
                          </span>
                        ) : !r.affect_payslip ? (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Excluded from Payslip
                          </span>
                        ) : isCompleted ? (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                            Fully Settled
                          </span>
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLoan(r);
                              setShowSkipModal(true);
                            }}
                            className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                            title="Click to configure month skip"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />{" "}
                            Active Deduction
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="px-4 py-3 text-right font-medium whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {/* DISBURSE FUND BUTTON FOR APPROVED LOANS */}
                          {isApproved && (
                            <Link
                              to={`/human-resources/loans/${r.id}/disburse`}
                              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition-colors"
                              title="Disburse loan and generate Finance Payment Voucher"
                            >
                              <DollarSign size={13} />
                              Disburse Fund
                            </Link>
                          )}

                          {/* Manual Payment (Direct Receipt) */}
                          {!isApproved && !isCompleted && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLoan(r);
                                setShowManualPay(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1 transition-colors"
                              title="Pay loan manually via Direct Receipt voucher"
                            >
                              <Receipt className="w-3.5 h-3.5" /> Pay
                            </button>
                          )}

                          {/* Skip Month */}
                          {!isApproved && !isCompleted && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLoan(r);
                                setShowSkipModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 flex items-center gap-1 transition-colors"
                              title="Skip monthly deduction"
                            >
                              <SkipForward className="w-3.5 h-3.5" /> Skip
                              Month
                            </button>
                          )}

                          {/* Repayment History */}
                          {!isApproved && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLoan(r);
                                setShowHistoryModal(true);
                              }}
                              className="px-2 py-1 text-xs font-medium rounded text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-1"
                              title="View repayment ledger history"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit / View Link */}
                          <Link
                            to={`/human-resources/loans/${r.id}`}
                            className="px-2 py-1 text-xs font-medium text-brand hover:underline"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredItems.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      {activeTab === "awaiting_disbursement" ? (
                        <div className="space-y-2">
                          <p className="font-semibold text-slate-700 dark:text-slate-300">
                            No approved loans awaiting disbursement.
                          </p>
                          <p className="text-xs text-slate-400">
                            Check <strong>Staff Loan Requests</strong> to review
                            and approve incoming applications.
                          </p>
                          <Link
                            to="/human-resources/loan-requests"
                            className="btn-secondary inline-flex text-xs mt-2"
                          >
                            Go to Loan Requests
                          </Link>
                        </div>
                      ) : (
                        "No loans found for the selected filter."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Direct Receipt Manual Payment Modal */}
      {showManualPay && selectedLoan && (
        <ManualRepaymentModal
          open={showManualPay}
          onClose={() => {
            setShowManualPay(false);
            setSelectedLoan(null);
          }}
          loan={selectedLoan}
          onSuccess={loadData}
        />
      )}

      {/* Skip Month Modal */}
      {showSkipModal && selectedLoan && (
        <LoanSkipModal
          open={showSkipModal}
          onClose={() => {
            setShowSkipModal(false);
            setSelectedLoan(null);
          }}
          loan={selectedLoan}
          onSuccess={loadData}
        />
      )}

      {/* Repayments Ledger History Modal */}
      {showHistoryModal && selectedLoan && (
        <LoanRepaymentsModal
          open={showHistoryModal}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedLoan(null);
          }}
          loan={selectedLoan}
          onOpenManualPay={(l) => {
            setSelectedLoan(l);
            setShowManualPay(true);
          }}
          onSuccess={loadData}
        />
      )}
    </Guard>
  );
}
