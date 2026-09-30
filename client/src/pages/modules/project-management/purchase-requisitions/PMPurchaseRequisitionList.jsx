/**
 * @fileoverview PMPurchaseRequisitionList component.
 * Provides functionality for PMPurchaseRequisitionList.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext";
import { Plus } from "lucide-react";
import { filterAndSort } from "../../../../utils/searchUtils.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const statuses = [
  { value: "DRAFT", label: "Draft", color: "bg-slate-100 text-slate-600" },
  { value: "PENDING_APPROVAL", label: "Pending Approval", color: "bg-amber-50 text-amber-600" },
  { value: "APPROVED", label: "Approved", color: "bg-emerald-50 text-emerald-600" },
  { value: "REJECTED", label: "Rejected", color: "bg-rose-50 text-rose-600" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-50 text-red-600" },
  { value: "FULFILLED", label: "Fulfilled", color: "bg-blue-50 text-blue-600" },
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PMPurchaseRequisitionList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/projects/purchase-requisitions");
      setItems(res.data?.items || []);
    } catch { toast.error("Failed to load"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const sorted = [...items].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === "total_estimated_cost") { va = Number(va||0); vb = Number(vb||0); }
    else { va = String(va||"").toLowerCase(); vb = String(vb||"").toLowerCase(); }
    return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  const filtered = filterAndSort(sorted, { query: search, getKeys: (r) => [r.requisition_no, r.project_name, r.department, r.requested_by, r.purpose] });

  const toggleSort = (k) => { setSortKey(k); setSortDir((d) => d === "asc" ? "desc" : "asc"); };

  const handleDelete = async (id) => {
    if (!window.confirm("Cancel this purchase requisition?")) return;
    try { await api.delete(`/projects/purchase-requisitions/${id}`); toast.success("Cancelled"); fetchList(); }
    catch (err) { toast.error(err?.response?.data?.message || "Failed"); }
  };

  const handleSubmit = async (id) => {
    try { await api.post(`/projects/purchase-requisitions/${id}/submit`); toast.success("Submitted"); fetchList(); }
    catch (err) { toast.error(err?.response?.data?.message || "Failed"); }
  };

  const badge = (s) => { const st = statuses.find((x) => x.value === s); return st ? <span className={`px-2 py-0.5 rounded text-xs font-semibold ${st.color}`}>{st.label}</span> : s; };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Purchase Requisitions</h1>
              <p className="text-sm mt-1">Request materials for project procurement</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn btn-secondary">Back</button>
              <Link to="/project-management/purchase-requisitions/new" className="btn-success flex items-center gap-2"><Plus size={16} />New Requisition</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input type="text" placeholder="Search..." className="input" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-secondary" onClick={fetchList}>Refresh</button>
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort("requisition_no")}>Requisition No</th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort("requisition_date")}>Date</th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort("project_name")}>Project</th>
                  <th>Department</th>
                  <th className="cursor-pointer select-none text-right" onClick={() => toggleSort("total_estimated_cost")}>Est. Cost</th>
                  <th className="text-center">Status</th>
                  <th>Created By</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading...</td></tr> :
                 filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">No requisitions found</td></tr> :
                 filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-brand-700">{r.requisition_no}</td>
                    <td className="text-sm whitespace-nowrap">{r.requisition_date ? new Date(r.requisition_date).toLocaleDateString() : "-"}</td>
                    <td className="text-sm">{r.project_name || "-"}</td>
                    <td className="text-sm">{r.department || "-"}</td>
                    <td className="text-right font-medium">{Number(r.total_estimated_cost||0).toFixed(2)}</td>
                    <td className="text-center">{badge(r.status)}</td>
                    <td className="text-sm text-slate-500">{r.created_by_name || "-"}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200"
                          onClick={() => navigate(`/project-management/purchase-requisitions/${r.id}`)}>View</button>
                        {["DRAFT","REJECTED"].includes(r.status) && (
                          <button className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                            onClick={() => navigate(`/project-management/purchase-requisitions/${r.id}?edit=1`)}>Edit</button>
                        )}
                        {["DRAFT","REJECTED"].includes(r.status) && (
                          <button className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100"
                            onClick={() => handleSubmit(r.id)}>Submit</button>
                        )}
                        {hasExceptional("PM.PR.CANCEL") && ["DRAFT","REJECTED","PENDING_APPROVAL"].includes(r.status) && (
                          <button className="px-2 py-1 text-xs font-medium text-white bg-red-700 rounded hover:bg-red-800"
                            onClick={() => handleDelete(r.id)}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
