import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, CheckCircle2, Clock, AlertCircle, RefreshCw, Eye, FileText } from "lucide-react";
import client from "../../../../api/client";

function formatCurrency(val) {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SentDocuments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const navigate = useNavigate();

  useEffect(() => {
    fetchSentDocuments();
  }, []);

  const fetchSentDocuments = async () => {
    try {
      setLoading(true);
      const res = await client.get("/workflows/approvals/sent");
      setItems(Array.isArray(res.data?.items) ? res.data.items : Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      // Fallback to notifications if instance search has no items
      try {
        const notifRes = await client.get("/workflows/notifications");
        const notifs = Array.isArray(notifRes.data?.items) ? notifRes.data.items : [];
        const fallbackItems = notifs.map(n => ({
          workflow_instance_id: n.id,
          document_type: n.reference || "Document",
          doc_ref: n.reference || `#${n.id}`,
          workflow_name: n.message || "Approval Request",
          status: String(n.message || "").toLowerCase().includes("approved") ? "APPROVED" : "PENDING",
          submitted_at: n.date || n.created_at,
          assigned_to_name: n.target_user || "Approver",
          amount: 0
        }));
        setItems(fallbackItems);
      } catch {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (statusFilter === "ALL") return items;
    if (statusFilter === "PENDING") {
      return items.filter((i) => i.status === "PENDING" || i.status === "YET_TO_BE_APPROVED" || !i.status);
    }
    if (statusFilter === "APPROVED") {
      return items.filter((i) => i.status === "APPROVED");
    }
    if (statusFilter === "REJECTED") {
      return items.filter((i) => i.status === "REJECTED" || i.status === "RETURNED");
    }
    return items;
  }, [items, statusFilter]);

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.status === "PENDING" || !i.status).length;
    const approved = items.filter((i) => i.status === "APPROVED").length;
    const rejected = items.filter((i) => i.status === "REJECTED" || i.status === "RETURNED").length;
    return { all: items.length, pending, approved, rejected };
  }, [items]);

  const renderStatusBadge = (status) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle size={12} /> Rejected
          </span>
        );
      case "RETURNED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock size={12} /> Returned
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Clock size={12} /> Yet to be Approved
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header & Actions with Back Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm"
            title="Go Back"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Send className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              Sent Documents
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Documents you have sent to other users in the approval workflow process.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchSentDocuments}
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
            title="Refresh List"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <Link to="/" className="btn btn-secondary text-xs">
            Return to Home
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === "ALL"
              ? "bg-brand-900 text-white shadow-apple-xs"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          All Sent ({counts.all})
        </button>
        <button
          onClick={() => setStatusFilter("PENDING")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === "PENDING"
              ? "bg-blue-600 text-white shadow-apple-xs"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Yet to be Approved ({counts.pending})
        </button>
        <button
          onClick={() => setStatusFilter("APPROVED")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === "APPROVED"
              ? "bg-emerald-600 text-white shadow-apple-xs"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Approved ({counts.approved})
        </button>
        <button
          onClick={() => setStatusFilter("REJECTED")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === "REJECTED"
              ? "bg-rose-600 text-white shadow-apple-xs"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Rejected / Returned ({counts.rejected})
        </button>
      </div>

      {/* Document List Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading sent documents...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Send className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No sent documents found</h3>
          <p className="text-slate-500 text-xs mt-1">
            {statusFilter === "ALL"
              ? "You have not submitted any documents for workflow approval yet."
              : `No documents matching status "${statusFilter}".`}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-erp border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 text-xs">
                <tr>
                  <th className="p-4">Document Type & Reference</th>
                  <th className="p-4">Workflow Name & Step</th>
                  <th className="p-4">Sent To (Approver)</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4">Date Submitted</th>
                  <th className="p-4 text-center">Approval Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {filteredItems.map((item) => (
                  <tr key={item.workflow_instance_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.document_type ? String(item.document_type).replace(/_/g, " ") : "Document"}
                      </div>
                      <div className="font-mono text-brand-600 dark:text-brand-400 mt-0.5 font-medium">
                        {item.doc_ref || `#${item.document_id}`}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {item.workflow_name || "Workflow Review"}
                      </div>
                      {item.step_name && (
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Step: {item.step_name}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">
                      <div className="font-medium">
                        {item.assigned_to_full_name || item.assigned_to_name || "Assigned Approver"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.status === "APPROVED" ? "Approved by user" : "Pending review"}
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {Number(item.amount) > 0 ? formatCurrency(item.amount) : "—"}
                    </td>
                    <td className="p-4 text-slate-500 whitespace-nowrap">
                      {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Just now"}
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      {renderStatusBadge(item.status)}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/administration/workflows/approvals/${item.workflow_instance_id}`)}
                        className="btn-secondary inline-flex items-center gap-1 px-3 py-1 text-xs"
                        title="View Workflow Progress"
                      >
                        <Eye size={12} /> View Progress
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
