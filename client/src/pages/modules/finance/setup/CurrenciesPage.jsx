/**
 * @fileoverview CurrenciesPage component.
 * Standard Modern UI Currencies & Exchange Rates Setup for finance module.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import { useExchangeRate } from "../../../../hooks/useExchangeRate";
import {
  DollarSign,
  ArrowLeft,
  Plus,
  RefreshCw,
  Save,
  Globe,
  TrendingUp,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";

export default function CurrenciesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [isBase, setIsBase] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { getAvailableCurrencies, loading: apiLoading } = useExchangeRate();

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/finance/currencies");
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load currencies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api.post("/finance/currencies", {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        symbol: symbol.trim() || null,
        isBase: Boolean(isBase),
        isActive: Boolean(isActive),
      });
      toast.success("Currency created successfully");
      setCode("");
      setName("");
      setSymbol("");
      setIsBase(false);
      setIsActive(true);
      setShowCreateModal(false);
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to create currency");
    }
  }

  async function saveRow(r) {
    try {
      await api.put(`/finance/currencies/${r.id}`, {
        name: (r._name ?? r.name ?? "").trim(),
        symbol: (r._symbol ?? r.symbol ?? "").trim() || null,
        isBase: Boolean(r.is_base),
        isActive: Boolean(r.is_active),
      });
      toast.success("Currency updated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update currency");
    }
  }

  async function setBase(id) {
    try {
      await api.post(`/finance/currencies/${id}/set-base`);
      toast.success("Base currency updated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to set base currency");
    }
  }

  async function toggleActive(r) {
    try {
      await api.put(`/finance/currencies/${r.id}`, {
        name: r.name,
        symbol: r.symbol,
        isBase: Boolean(r.is_base),
        isActive: !r.is_active,
      });
      toast.success("Status updated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to toggle status");
    }
  }

  async function fetchFromApi() {
    try {
      const liveCurrencies = await getAvailableCurrencies();
      if (!liveCurrencies || !liveCurrencies.length) {
        toast.error("No currencies returned from API");
        return;
      }
      const existingCodes = items.map((c) => c.code.toUpperCase());
      const toAdd = liveCurrencies.filter(
        (c) => !existingCodes.includes(c.code.toUpperCase()),
      );
      if (toAdd.length === 0) {
        toast.info("All available currencies are already added");
        return;
      }
      let added = 0;
      for (const c of toAdd) {
        try {
          await api.post("/finance/currencies", {
            code: c.code,
            name: c.name,
            isActive: true,
            isBase: false,
          });
          added++;
        } catch (err) {
          console.error(`Failed to add ${c.code}:`, err);
        }
      }
      toast.success(`Successfully added ${added} currencies`);
      load();
    } catch (e) {
      toast.error("Failed to fetch from API");
    }
  }

  function setRowDraft(id, field, value) {
    setItems((p) =>
      p.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <Link
                to="/finance?section=Accounting%20Setup"
                className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors mb-2"
              >
                <ArrowLeft size={14} /> Back to Accounting Setup
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Currencies Setup
              </h1>
              <p className="text-sm mt-0.5 opacity-90">
                Manage operational currencies, base reporting currency &
                exchange rate feeds
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="px-3.5 py-2 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                onClick={fetchFromApi}
                disabled={loading || apiLoading}
              >
                <Globe size={14} className={apiLoading ? "animate-spin" : ""} />
                {apiLoading ? "Fetching..." : "Fetch from Live API"}
              </button>
              <button
                type="button"
                className="btn-success text-xs px-3.5 py-2 flex items-center gap-1.5 font-bold"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={15} /> Create Currency
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand" /> Create New Currency
              </h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={create} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">
                    ISO Code *
                  </label>
                  <input
                    className="input w-full text-sm font-mono uppercase"
                    placeholder="e.g. USD"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">
                    Symbol
                  </label>
                  <input
                    className="input w-full text-sm font-mono"
                    placeholder="e.g. $"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">
                  Currency Name *
                </label>
                <input
                  className="input w-full text-sm"
                  placeholder="e.g. US Dollar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    className="checkbox rounded border-slate-300 text-brand"
                    checked={isBase}
                    onChange={(e) => setIsBase(e.target.checked)}
                  />
                  Set as Base Currency
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    className="checkbox rounded border-slate-300 text-brand"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Active Currency
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  className="btn btn-secondary text-xs px-4 py-2"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-success text-xs px-4 py-2 flex items-center gap-1"
                >
                  <Plus size={14} /> Create Currency
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Currencies Table */}
      <div className="card shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full table-fixed">
            <colgroup>
              <col style={{ width: "16.666%" }} />
              <col style={{ width: "16.666%" }} />
              <col style={{ width: "16.666%" }} />
              <col style={{ width: "16.666%" }} />
              <col style={{ width: "16.666%" }} />
              <col style={{ width: "16.666%" }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                <th className="py-3 px-4 text-left">Code</th>
                <th className="py-3 px-4 text-left">Currency Name</th>
                <th className="py-3 px-4 text-left">Symbol</th>
                <th className="py-3 px-4 text-left">Base Role</th>
                <th className="py-3 px-4 text-left">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    <RefreshCw className="animate-spin w-6 h-6 mx-auto mb-2" />
                    Loading currencies...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-brand dark:text-brand-300">
                      {r.code}
                    </td>
                    <td className="py-3 px-4">
                      <input
                        className="input text-xs w-full max-w-xs"
                        value={r._name ?? r.name ?? ""}
                        onChange={(e) =>
                          setRowDraft(r.id, "_name", e.target.value)
                        }
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        className="input text-xs font-mono w-20"
                        value={r._symbol ?? r.symbol ?? ""}
                        onChange={(e) =>
                          setRowDraft(r.id, "_symbol", e.target.value)
                        }
                      />
                    </td>
                    <td className="py-3 px-4">
                      {r.is_base ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          BASE CURRENCY
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded-lg transition-colors"
                          onClick={() => setBase(r.id)}
                        >
                          Set as Base
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <XCircle size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn-success text-xs px-2.5 py-1 flex items-center gap-1"
                          onClick={() => saveRow(r)}
                        >
                          <Save size={12} /> Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary text-xs px-2.5 py-1"
                          onClick={() => toggleActive(r)}
                        >
                          {r.is_active ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    No currencies configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Currency Rates Section */}
      <div className="card shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand" /> Historical Currency
            Exchange Rates
          </h2>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
            Historical records only. Live rates are fetched directly from the
            exchange API for all transactions.
          </p>
        </div>
        <div className="p-5">
          <RatesSection items={items} />
        </div>
      </div>
    </div>
  );
}

function RatesSection({ items }) {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fltFromId, setFltFromId] = useState("");
  const [fltToId, setFltToId] = useState("");
  const [fltFromDate, setFltFromDate] = useState("");
  const [fltToDate, setFltToDate] = useState("");
  const [newFromId, setNewFromId] = useState("");
  const [newToId, setNewToId] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newDate, setNewDate] = useState("");

  async function loadRates() {
    try {
      setLoading(true);
      const res = await api.get("/finance/currency-rates", {
        params: {
          fromCurrencyId: fltFromId || null,
          toCurrencyId: fltToId || null,
          from: fltFromDate || null,
          to: fltToDate || null,
        },
      });
      setRates(res.data?.items || []);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load currency rates",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRates();
  }, [fltFromId, fltToId, fltFromDate, fltToDate]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="label text-xs font-semibold">From Currency</label>
          <select
            className="input w-full text-xs"
            value={fltFromId}
            onChange={(e) => setFltFromId(e.target.value)}
          >
            <option value="">All</option>
            {items.map((c) => (
              <option key={`f-${c.id}`} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs font-semibold">To Currency</label>
          <select
            className="input w-full text-xs"
            value={fltToId}
            onChange={(e) => setFltToId(e.target.value)}
          >
            <option value="">All</option>
            {items.map((c) => (
              <option key={`t-${c.id}`} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs font-semibold">From Date</label>
          <input
            className="input w-full text-xs"
            type="date"
            value={fltFromDate}
            onChange={(e) => setFltFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label text-xs font-semibold">To Date</label>
          <input
            className="input w-full text-xs"
            type="date"
            value={fltToDate}
            onChange={(e) => setFltToDate(e.target.value)}
          />
        </div>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.post("/finance/currency-rates", {
              fromCurrencyId: Number(newFromId),
              toCurrencyId: Number(newToId),
              rate: Number(newRate),
              rateDate: newDate || undefined,
            });
            toast.success("Rate added");
            setNewFromId("");
            setNewToId("");
            setNewRate("");
            setNewDate("");
            loadRates();
          } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to add rate");
          }
        }}
        className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
      >
        <div>
          <label className="label text-xs font-semibold">From *</label>
          <select
            className="input w-full text-xs"
            value={newFromId}
            onChange={(e) => setNewFromId(e.target.value)}
            required
          >
            <option value="">Select</option>
            {items.map((c) => (
              <option key={`nf-${c.id}`} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs font-semibold">To *</label>
          <select
            className="input w-full text-xs"
            value={newToId}
            onChange={(e) => setNewToId(e.target.value)}
            required
          >
            <option value="">Select</option>
            {items.map((c) => (
              <option key={`nt-${c.id}`} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs font-semibold">Rate *</label>
          <input
            className="input w-full text-xs font-mono"
            type="number"
            step="0.0001"
            placeholder="1.0000"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label text-xs font-semibold">Rate Date</label>
          <input
            className="input w-full text-xs"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-success text-xs py-2 px-3">
          + Add Rate
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="table w-full table-fixed">
          <colgroup>
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
          </colgroup>
          <thead>
            <tr className="text-xs uppercase bg-slate-100 dark:bg-slate-800">
              <th className="py-2 px-3 text-left">From</th>
              <th className="py-2 px-3 text-left">To</th>
              <th className="py-2 px-3 text-right">Exchange Rate</th>
              <th className="py-2 px-3 text-left">Rate Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {loading ? (
              <tr>
                <td colSpan="4" className="text-center py-6 text-slate-400">
                  Loading rates...
                </td>
              </tr>
            ) : rates.length > 0 ? (
              rates.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 px-3 font-bold font-mono text-brand dark:text-brand-300">
                    {r.from_currency_code || r.from_code}
                  </td>
                  <td className="py-2.5 px-3 font-bold font-mono text-slate-800 dark:text-slate-200">
                    {r.to_currency_code || r.to_code}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    {Number(r.rate || 0).toFixed(4)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">
                    {r.rate_date
                      ? new Date(r.rate_date).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center py-6 text-slate-400">
                  No historical rate records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
