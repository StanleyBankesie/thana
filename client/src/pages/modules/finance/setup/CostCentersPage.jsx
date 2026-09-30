/**
 * @fileoverview CostCentersPage component.
 * Standard Modern UI Cost Centers Setup for allocation and department tracking.
 */

import React, { useEffect, useState } from "react";
import { api } from "../../../../api/client";
import { Link } from "react-router-dom";
import { 
  Building2, 
  ArrowLeft, 
  Plus, 
  RefreshCw, 
  Edit3, 
  X, 
  Save, 
  CheckCircle2, 
  XCircle 
} from "lucide-react";

export default function CostCentersPage() {
  const [items, setItems] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [baseCurrencyId, setBaseCurrencyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    id: null,
    code: "",
    name: "",
    description: "",
    default_currency_id: baseCurrencyId,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [ccResp, curResp] = await Promise.all([
        api.get("/finance/cost-centers"),
        api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
      ]);
      const rows = Array.isArray(ccResp.data?.items) ? ccResp.data.items : [];
      setItems(rows);
      const c = Array.isArray(curResp.data?.items) ? curResp.data.items : [];
      setCurrencies(c);
      const base = c.find(cur => Number(cur.is_base) === 1 || cur.is_base === true);
      if (base) {
        setBaseCurrencyId(base.id);
        setForm(p => ({ ...p, default_currency_id: base.id }));
      }
    } catch (e) {
      setError("Cost center API not available");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generateCode = () => {
    const codes = items.map((it) => it.code).filter(Boolean);
    let next = 1;
    while (codes.includes(String(next).padStart(4, "0"))) next++;
    return String(next).padStart(4, "0");
  };

  const edit = (it) => {
    setForm({
      id: it.id,
      code: it.code || "",
      name: it.name || "",
      description: it.description || "",
      default_currency_id: it.default_currency_id || "",
    });
    setSuccess("");
    setError("");
    setShowCreateModal(true);
  };

  const cancelEdit = () => {
    setForm({
      id: null,
      code: "",
      name: "",
      description: "",
      default_currency_id: baseCurrencyId,
    });
    setSuccess("");
    setError("");
    setShowCreateModal(false);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        code: form.id ? form.code : generateCode(),
        name: form.name,
        description: form.description,
        default_currency_id: form.default_currency_id,
        isActive: 1,
      };

      if (form.id) {
        await api.put(`/finance/cost-centers/${form.id}`, payload);
        setSuccess("Cost center updated successfully");
      } else {
        await api.post("/finance/cost-centers", payload);
        setSuccess("Cost center saved successfully");
      }

      setForm({
        id: null,
        code: "",
        name: "",
        description: "",
        default_currency_id: baseCurrencyId,
      });
      setShowCreateModal(false);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save cost center");
    } finally {
      setSaving(false);
    }
  };

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
                <Building2 className="w-6 h-6" /> Cost Centers Setup
              </h1>
              <p className="text-sm mt-0.5 opacity-90">
                Departmental cost allocations, tracking tags & currency defaults
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-success text-xs px-3.5 py-2 flex items-center gap-1.5 font-bold"
                onClick={() => {
                  setForm({
                    id: null,
                    code: "",
                    name: "",
                    description: "",
                    default_currency_id: "",
                  });
                  setShowCreateModal(true);
                }}
              >
                <Plus size={15} /> Create Cost Center
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand" /> {form.id ? "Edit Cost Center" : "Create Cost Center"}
              </h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold"
                onClick={cancelEdit}
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-semibold">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg font-semibold">
                {success}
              </div>
            )}

            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Cost Center Name *</label>
                <input
                  className="input w-full text-sm"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Operations & Procurement"
                  required
                />
              </div>

              <div>
                <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Default Currency</label>
                <select
                  className="input w-full text-sm"
                  value={form.default_currency_id || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      default_currency_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Default (Base Currency)</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code || c.currency_code} - {c.name || c.currency_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Description</label>
                <textarea
                  className="input w-full text-sm"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Operational scope & responsibility details..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  className="btn btn-secondary text-xs px-4 py-2"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-success text-xs px-4 py-2 flex items-center gap-1">
                  <Save size={14} /> {saving ? "Saving..." : "Save Cost Center"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Table */}
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
                <th className="py-3 px-4 text-left">Cost Center Name</th>
                <th className="py-3 px-4 text-left">Description</th>
                <th className="py-3 px-4 text-left">Currency</th>
                <th className="py-3 px-4 text-left">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    <RefreshCw className="animate-spin w-6 h-6 mx-auto mb-2" />
                    Loading cost centers...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand dark:text-brand-300 truncate" title={it.code}>
                      {it.code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 truncate" title={it.name}>
                      {it.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs truncate" title={it.description || "—"}>
                      {it.description || "—"}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono font-semibold truncate">
                      {it.default_currency_id
                        ? currencies.find(
                            (c) =>
                              String(c.id) === String(it.default_currency_id),
                          )?.code || "Base"
                        : "Base"}
                    </td>
                    <td className="py-3 px-4 truncate">
                      {Number(it.is_active) === 1 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <XCircle size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => edit(it)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    No cost centers created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
