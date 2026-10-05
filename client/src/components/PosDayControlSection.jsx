import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { toast } from "react-toastify";
import { CalendarCheck, Clock, CheckCircle2, AlertCircle, PlayCircle, ShieldAlert, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function PosDayControlSection() {
  const [enabled, setEnabled] = useState(true);
  const [salesAccountId, setSalesAccountId] = useState("");
  const [salesAccount, setSalesAccount] = useState(null);
  const [paymentModes, setPaymentModes] = useState([]);
  const [taxAccount, setTaxAccount] = useState(null);
  const [revenueAccounts, setRevenueAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [ctrlRes, accRes] = await Promise.all([
          api.get("/admin/settings/pos-day-control"),
          api.get("/finance/accounts", { params: { active: 1, postable: 1 } }).catch(() => ({ data: { items: [] } })),
        ]);

        if (!mounted) return;
        const d = ctrlRes?.data?.data || {};
        setEnabled(d.enable_day_open_close !== false);
        setSalesAccountId(d.sales_account_id ? String(d.sales_account_id) : "");
        setSalesAccount(d.sales_account || null);
        setPaymentModes(Array.isArray(d.payment_modes) ? d.payment_modes : []);
        setTaxAccount(d.tax_account || null);

        const items = Array.isArray(accRes?.data?.items) ? accRes.data.items : [];
        const rev = items.filter((a) => {
          const nat = String(a.nature || a.type || "").toUpperCase();
          const code = String(a.code || "");
          return nat === "INCOME" || nat === "REVENUE" || code.startsWith("4");
        });
        setRevenueAccounts(rev.length > 0 ? rev : items);
      } catch (err) {
        console.error("Failed to load POS day control settings", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      await api.post("/admin/settings/pos-day-control", {
        enable_day_open_close: enabled,
        sales_account_id: salesAccountId ? Number(salesAccountId) : null,
      });
      try {
        localStorage.setItem("pos_enable_day_open_close", String(enabled));
        window.dispatchEvent(
          new CustomEvent("pos-day-control-changed", { detail: { enabled } })
        );
      } catch {}
      toast.success("Day Open & Close settings saved successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunTest() {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await api.post("/admin/settings/pos-day-control/test-auto-post");
      setTestResult(res?.data?.data || null);
      toast.info("Auto-post test completed. Check details below.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Test auto-post failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-body space-y-4">
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-brand-600" />
              Day Open & Day Close Control (POS)
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              Control whether cashiers must perform Day Open & Day Close routines or bypass them with automated 11:59 PM finance posting.
            </div>
          </div>
          <span className={`badge ${enabled ? "badge-success" : "badge-warning"}`}>
            {enabled ? "Day Open/Close Required" : "Automated 11:59 PM Auto-Post"}
          </span>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500 py-3">Loading Day Management settings...</div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Main Activation Checkbox */}
            <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg mt-0.5 ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <label htmlFor="day-control-cb" className="font-semibold text-slate-800 cursor-pointer text-sm">
                    Activate Day Open and Day Close
                  </label>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    {enabled ? (
                      <span className="text-emerald-700 font-medium">
                        ✓ <strong>Active:</strong> Cashiers must open the day with an opening float before recording sales, and close the day with reconciliation.
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium">
                        ⚡ <strong>Inactive (Bypassed):</strong> Users can record sales immediately without opening or closing the day. Sales are automatically posted to Finance at <strong>11:59 PM</strong> of each day (only if sales were made that day).
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <input
                id="day-control-cb"
                type="checkbox"
                className="checkbox checkbox-primary mt-1"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
            </div>

            {/* When Deactivated (Bypassed): Show Finance Posting Accounts & Config */}
            {!enabled && (
              <div className="space-y-4 p-4 rounded-xl border border-amber-200 bg-amber-50/40">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-brand-600" />
                  Automated Finance Posting Settings (11:59 PM Daily)
                </div>
                <p className="text-xs text-slate-600">
                  When Day Open & Day Close is unchecked, the system automatically checks for sales at <strong>11:59 PM</strong>.
                  If sales occurred on that day, it creates a balanced Journal Voucher in Finance using the accounts configured below.
                  If no sales occurred, automatic posting is safely skipped.
                </p>

                {/* Sales Revenue Account Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Sales Revenue Account
                    </label>
                    <select
                      className="input input-sm w-full bg-white border-slate-300"
                      value={salesAccountId}
                      onChange={(e) => setSalesAccountId(e.target.value)}
                    >
                      <option value="">Default (4000 - Sales Revenue)</option>
                      {revenueAccounts.map((a) => (
                        <option key={a.id} value={String(a.id)}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      Credits sales income in the General Ledger.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Tax / VAT Output Account
                    </label>
                    <div className="text-xs p-2 rounded bg-white border border-slate-200 text-slate-700">
                      {taxAccount?.tax_account_code ? (
                        <span>{taxAccount.tax_account_code} - {taxAccount.tax_account_name || "VAT Output"}</span>
                      ) : (
                        <span className="text-slate-500">1310 - VAT Output (Default)</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Configured in POS Setup &gt; Tax Settings.
                    </p>
                  </div>
                </div>

                {/* Configured Payment Mode Accounts */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700">
                      Configured Payment Accounts (Debited per Payment Method):
                    </span>
                    <Link to="/pos/setup" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                      Manage in POS Setup <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {paymentModes.length > 0 ? (
                      paymentModes.map((pm) => (
                        <div key={pm.id} className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs">
                          <div className="font-semibold text-slate-800">{pm.name}</div>
                          <div className="text-[11px] text-slate-500 uppercase">{pm.type}</div>
                          <div className="text-[11px] text-brand-700 font-medium mt-1 truncate">
                            {pm.account_code ? `${pm.account_code} - ${pm.account_name}` : pm.account ? `Account #${pm.account}` : "Default (1000)"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-500">
                        Default Cash/Bank account (1000) will be used for all payment collections.
                      </div>
                    )}
                  </div>
                </div>

                {/* Test Action */}
                <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <PlayCircle className="w-4 h-4 text-brand-600" />
                    <span>Want to test today's sales posting without waiting for 11:59 PM?</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunTest}
                    disabled={testing}
                    className="btn btn-xs btn-outline border-brand-500 text-brand-700 hover:bg-brand-50"
                  >
                    {testing ? "Running Test..." : "Run Auto-Post Now (Test)"}
                  </button>
                </div>

                {/* Test Results Display */}
                {testResult && (
                  <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs space-y-1.5">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span>Test Result:</span>
                      <span className="badge badge-sm badge-info">{testResult.postedCount} Posted, {testResult.skippedNoSales} Skipped</span>
                    </div>
                    {testResult.details?.map((det, idx) => (
                      <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-100 text-slate-700">
                        <span className="font-medium">{det.branchName}: </span>
                        <span>{det.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary btn-sm"
              >
                {saving ? "Saving..." : "Save Day Management Settings"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
