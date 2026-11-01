import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from "api/client";
import { toast } from "react-toastify";
import { Mail } from "lucide-react";
import { usePermission } from '../../../../auth/PermissionContext.jsx';
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function PromotionList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canPerformAction } = usePermission();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hr/promotions');
      setPromotions(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendLetter = async (promo) => {
    try {
      setSendingId(promo.id);
      const res = await api.post(`/hr/promotions/${promo.id}/send-letter`);
      toast.success(res.data?.message || "Letter sent successfully");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send letter");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Promotions & Reassignments</h1>
            <p className="text-sm mt-1">Track employee promotions, role reassignments, and lateral transfers</p>
          </div>
          <div className="flex gap-2">
            <Link to="/human-resources?section=Employee%20Management" className="btn btn-secondary">Return to Menu</Link>
            {canPerformAction('human-resources:promotions', 'create') && (
              <Link to="/human-resources/promotions/new" className="btn-success">+ New</Link>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body overflow-x-auto">
          <div className="flex justify-end mb-4">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>

          {loading ? (
            <div className="text-center py-8">Loading promotions...</div>
          ) : (
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employee</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Action Type</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Effective Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">From</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">To</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created By</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.first_name ? `${r.first_name} ${r.last_name || ''}` : (r.employee || '-')}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        r.action_type === 'REASSIGNMENT' || r.action_type === 'DEMOTION'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          : r.action_type === 'TRANSFER'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}>
                        {r.action_type === 'DEMOTION' ? 'REASSIGNMENT' : (r.action_type || 'PROMOTION')}
                      </span>
                    </td>
                    <td>{r.promotion_date ? new Date(r.promotion_date).toLocaleDateString() : (r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : '-')}</td>
                    <td>{r.previous_pos || r.from || '-'}</td>
                    <td>{r.new_pos || r.to || '-'}</td>
                    <td>{r.created_by_username || r.created_by_name || "-"}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    <td className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSendLetter(r)}
                          disabled={sendingId === r.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm disabled:opacity-50"
                          title="Send official letter to employee email"
                        >
                          <Mail className="w-3.5 h-3.5 text-brand" />
                          <span>{sendingId === r.id ? "Sending..." : "Send Letter"}</span>
                        </button>
                        {canPerformAction('human-resources:promotions', 'edit') && (
                          <Link
                            to={`/human-resources/promotions/${r.id}`}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {promotions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500">No promotion records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
