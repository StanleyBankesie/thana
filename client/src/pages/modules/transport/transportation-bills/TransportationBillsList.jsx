import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client";
import { renderHtmlToPdf } from "@/utils/pdfUtils.js";
import PrintPreviewModal from "@/components/PrintPreviewModal.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import { Search, Plus, ArrowLeft, Eye, Edit, Printer, CheckCircle, Clock, AlertCircle } from "lucide-react";

export default function TransportationBillsList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Print state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewBill, setPreviewBill] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get("/transport/transportation-bills")
      .then((res) => {
        setItems(Array.isArray(res?.data?.data?.items) ? res.data.data.items : []);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || "Failed to load transportation bills");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const base = statusFilter === "ALL" ? items.slice() : items.filter((r) => String(r.status || "").toUpperCase() === statusFilter);
    const q = String(searchTerm || "").trim();
    if (!q) return base;
    return filterAndSort(base, { query: q, getKeys: (r) => [r.bill_no, r.supplier_name, r.client_name] });
  }, [items, searchTerm, statusFilter]);

  const StatusIcon = ({ status }) => {
    const s = String(status || "").toUpperCase();
    if (s === "PAID" || s === "COMPLETED") return <CheckCircle className="w-3 h-3 mr-1" />;
    if (s === "OVERDUE") return <AlertCircle className="w-3 h-3 mr-1" />;
    return <Clock className="w-3 h-3 mr-1" />;
  };

  async function fetchBillHtml(billId) {
    const res = await api.post(
      `/documents/purchase-bill/${billId}/render`,
      { format: "html", feature_name: "purchase-bill" },
      { headers: { "Content-Type": "application/json" } },
    );
    return typeof res.data === "string" ? res.data : String(res.data || "");
  }

  async function openPreview(row, { autoDownload = false } = {}) {
    try {
      const html = await fetchBillHtml(row.id);
      setPreviewBill(row);
      setPreviewHtml(html);
      setPreviewOpen(true);
      if (autoDownload) {
        setDownloading(true);
        try {
          await renderHtmlToPdf(html, `Transport-Bill-${row.bill_no || row.id}.pdf`);
        } finally {
          setDownloading(false);
        }
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to render bill document");
    }
  }

  async function downloadFromPreview() {
    if (!previewBill) return;
    try {
      setDownloading(true);
      await renderHtmlToPdf(previewHtml, `Transport-Bill-${previewBill.bill_no || previewBill.id}.pdf`);
    } catch (e) {
      toast.error("Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-brand">
            Transportation Bills
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 font-medium">Manage and track your transportation bills in one place</p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <Link to="/transport" className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
          <Link to="/transport/transportation-bills/new" className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand-600 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
            <Plus className="w-4 h-4 mr-2" />
            New Bill
          </Link>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
          {error ? <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center"><AlertCircle className="w-5 h-5 mr-2" />{error}</div> : null}

          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search bills..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="w-full md:w-48 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all shadow-sm cursor-pointer"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="POSTED">Posted</option>
                <option value="COMPLETED">Completed</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-left border-collapse ${viewMode === 'grid' ? 'table-grid-mode' : ''}`}>
            <thead>
              <tr className="bg-brand text-white text-xs uppercase font-bold tracking-wider">
                <th className="px-6 py-4 w-[12%]">Bill No</th>
                <th className="px-6 py-4 w-[12%]">Date</th>
                <th className="px-6 py-4 w-[18%]">Supplier</th>
                <th className="px-6 py-4 w-[12%]">Payment</th>
                <th className="px-6 py-4 w-[12%] text-right">Total</th>
                <th className="px-6 py-4 w-[10%]">Status</th>
                <th className="px-6 py-4 w-[14%] text-center">Actions</th>
                <th className="px-6 py-4 w-[10%] text-center">Docs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="inline-flex items-center justify-center space-x-2 text-brand-600 font-medium">
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading bills...</span>
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <Search className="w-8 h-8" />
                      </div>
                      <p className="text-lg font-medium text-slate-900 dark:text-slate-200 mb-1">No bills found</p>
                      <p className="text-sm">Try adjusting your filters or create a new bill.</p>
                    </div>
                  </td>
                </tr>
              ) : null}

              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">{r.bill_no}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {r.bill_date ? new Date(r.bill_date).toLocaleDateString() : ""}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {r.supplier_name || r.client_name || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide border ${
                        String(r.payment_status || "").toUpperCase() === "PAID" || String(r.payment_status || "").toUpperCase() === "FULLY PAID"
                          ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50"
                          : String(r.payment_status || "").toUpperCase() === "PARTIAL PAYMENT"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50"
                      }`}
                    >
                      {String(r.payment_status || "UNPAID").toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-slate-100">
                    {Number(r.total_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide border ${
                        String(r.status || "").toUpperCase() === "POSTED"
                          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50"
                          : String(r.status || "").toUpperCase() === "COMPLETED" || String(r.status || "").toUpperCase() === "PAID"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50"
                            : String(r.status || "").toUpperCase() === "OVERDUE"
                              ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50"
                      }`}
                    >
                      <StatusIcon status={r.status} />
                      {String(r.status || "").toUpperCase() || "PENDING"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link
                        to={`/transport/transportation-bills/${r.id}?mode=view`}
                        className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {String(r.status || "").toUpperCase() !== "POSTED" && (
                        <Link
                          to={`/transport/transportation-bills/${r.id}`}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="Edit Bill"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                        title="Print Bill"
                        onClick={() => openPreview(r)}
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PrintPreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewHtml("");
          setPreviewBill(null);
        }}
        html={previewHtml}
        downloading={downloading}
        onDownload={downloadFromPreview}
      />
    </div>
  );
}
