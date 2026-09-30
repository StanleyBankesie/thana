import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from "api/client";
import { usePermission } from '../../../../auth/PermissionContext.jsx';
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function PromotionList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canPerformAction } = usePermission();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Promotions</h1>
            <p className="text-sm mt-1">Track employee promotions</p>
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
          {loading ? (
            <div className="text-center py-8">Loading promotions...</div>
          ) : (
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employee</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Effective Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">From</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">To</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created By</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {promotions.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.first_name ? `${r.first_name} ${r.last_name || ''}` : (r.employee || '-')}</td>
                    <td>{r.promotion_date ? new Date(r.promotion_date).toLocaleDateString() : (r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : '-')}</td>
                    <td>{r.previous_pos || r.from || '-'}</td>
                    <td>{r.new_pos || r.to || '-'}</td>
                    <td>{r.created_by_username || r.created_by_name || "-"}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    <td>
                      {canPerformAction('human-resources:promotions', 'edit') && (
                        <Link to={`/human-resources/promotions/${r.id}`} className="text-brand hover:text-brand-600 text-sm font-medium">Edit</Link>
                      )}
                    </td>
                  </tr>
                ))}
                {promotions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">No promotion records found</td>
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







