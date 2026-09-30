import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import {
  fetchReportHeader,
  applyPdfHeader,
  applyPdfFooter,
  buildExcelHeaderRows,
} from "../../../../utils/pdfUtils.js";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : "—";

export default function SupplierOutstandingReportPage({ backPath = "/finance", backLabel = "Back to Finance" }) {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [asOf, setAsOf] = useState("");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("aging"); // "aging" | "detail"
  const [supplierQuery, setSupplierQuery] = useState("");
  const [asOfDate, setAsOfDate] = useState("");

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/supplier-outstanding", {
        params: { asOf: asOf || null },
      });
      setItems(res.data?.items || []);
      setSummary(res.data?.summary || []);
      setTotals(res.data?.totals || {});
      setAsOfDate(res.data?.as_of || asOf);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load supplier outstanding");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date();
    setAsOf(today.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOf, pollingCounter]);

  const filteredSummary = summary.filter((s) =>
    !supplierQuery || String(s.supplier_name || "").toLowerCase().includes(supplierQuery.toLowerCase())
  );
  const filteredDetail = items.filter((r) =>
    !supplierQuery || String(r.supplier_name || "").toLowerCase().includes(supplierQuery.toLowerCase())
  );

  async function exportExcel() {
    const headerInfo = await fetchReportHeader(api);
    const wb = XLSX.utils.book_new();

    // Aging Summary Sheet
    const headerRows = buildExcelHeaderRows(headerInfo, {
      title: "SUPPLIER OUTSTANDING ANALYSIS",
      period: `As at ${asOfDate || "Today"}`,
    });

    const agingData = [
      ...headerRows.map((r) => [r.Section, "", "", "", "", "", ""]),
      ["Supplier", `Current (${headerInfo.currCode})`, `1-30 Days (${headerInfo.currCode})`, `31-60 Days (${headerInfo.currCode})`, `61-90 Days (${headerInfo.currCode})`, `>90 Days (${headerInfo.currCode})`, `Total Outstanding (${headerInfo.currCode})`],
      ...filteredSummary.map((s) => [
        s.supplier_name, s.current, s["1_30"], s["31_60"], s["61_90"], s.over_90, s.total,
      ]),
      [],
      ["TOTALS", totals.current || 0, totals["1_30"] || 0, totals["31_60"] || 0, totals["61_90"] || 0, totals.over_90 || 0, totals.total || 0],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(agingData);
    ws1["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Aging Summary");

    // Detail Sheet
    const detailData = [
      ["Supplier", "Bill No", "Bill Date", "Due Date", `Total (${headerInfo.currCode})`, `Paid (${headerInfo.currCode})`, `Outstanding (${headerInfo.currCode})`, "Days Overdue", "Bucket"],
      ...filteredDetail.map((r) => [
        r.supplier_name, r.bill_no, fmtDate(r.bill_date), fmtDate(r.due_date),
        Number(r.total_amount || 0), Number(r.paid || 0), Number(r.outstanding || 0),
        r.days_overdue, r.aging_bucket,
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(detailData);
    ws2["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Bill Detail");

    XLSX.writeFile(wb, `supplier-outstanding-${headerInfo.currCode}-${asOfDate || "today"}.xlsx`);
  }

  async function exportPDF() {
    const headerInfo = await fetchReportHeader(api);
    const doc = new jsPDF("l", "mm", "a4"); // landscape for aging table
    const pageW = 297;
    const margin = 12;

    let y = applyPdfHeader(doc, headerInfo, {
      title: "SUPPLIER OUTSTANDING ANALYSIS",
      subtitle: `As at: ${asOfDate || "Today"}`,
      kpis: [
        { label: "TOTAL OUTSTANDING", value: `${headerInfo.currPrefix}${fmt(totals.total)}`, color: [239, 68, 68] },
        { label: "CURRENT", value: `${headerInfo.currPrefix}${fmt(totals.current)}`, color: [16, 185, 129] },
        { label: "1-30 DAYS", value: `${headerInfo.currPrefix}${fmt(totals["1_30"])}`, color: [59, 130, 246] },
        { label: "31-60 DAYS", value: `${headerInfo.currPrefix}${fmt(totals["31_60"])}`, color: [234, 88, 12] },
        { label: "61-90 DAYS", value: `${headerInfo.currPrefix}${fmt(totals["61_90"])}`, color: [234, 88, 12] },
        { label: ">90 DAYS", value: `${headerInfo.currPrefix}${fmt(totals.over_90)}`, color: [239, 68, 68] },
      ],
    });

    // Table header
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, pageW - margin * 2, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    const cols = [
      { label: "SUPPLIER", x: margin + 1, w: 60 },
      { label: `CURRENT (${headerInfo.currCode})`, x: margin + 63, w: 30, right: true },
      { label: `1-30 DAYS (${headerInfo.currCode})`, x: margin + 95, w: 30, right: true },
      { label: `31-60 DAYS (${headerInfo.currCode})`, x: margin + 127, w: 30, right: true },
      { label: `61-90 DAYS (${headerInfo.currCode})`, x: margin + 159, w: 30, right: true },
      { label: `>90 DAYS (${headerInfo.currCode})`, x: margin + 191, w: 30, right: true },
      { label: `TOTAL (${headerInfo.currCode})`, x: pageW - margin - 1, w: 30, right: true },
    ];
    cols.forEach((c) => {
      if (c.right) doc.text(c.label, c.x, y + 5, { align: "right" });
      else doc.text(c.label, c.x, y + 5);
    });
    y += 9;
    doc.setTextColor(15, 23, 42);

    filteredSummary.forEach((s, idx) => {
      if (y > 190) { doc.addPage(); y = margin; }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 3, pageW - margin * 2, 6, "F");
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(String(s.supplier_name || "").slice(0, 38), margin + 1, y);
      doc.text(fmt(s.current), margin + 93, y, { align: "right" });
      doc.text(fmt(s["1_30"]), margin + 125, y, { align: "right" });
      doc.text(fmt(s["31_60"]), margin + 157, y, { align: "right" });
      doc.text(fmt(s["61_90"]), margin + 189, y, { align: "right" });
      doc.text(fmt(s.over_90), margin + 221, y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(fmt(s.total), pageW - margin - 1, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 6;
    });

    // Totals row
    if (y > 190) { doc.addPage(); y = margin; }
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y - 1, pageW - margin * 2, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("TOTALS", margin + 1, y + 4);
    doc.text(fmt(totals.current), margin + 93, y + 4, { align: "right" });
    doc.text(fmt(totals["1_30"]), margin + 125, y + 4, { align: "right" });
    doc.text(fmt(totals["31_60"]), margin + 157, y + 4, { align: "right" });
    doc.text(fmt(totals["61_90"]), margin + 189, y + 4, { align: "right" });
    doc.text(fmt(totals.over_90), margin + 221, y + 4, { align: "right" });
    doc.text(fmt(totals.total), pageW - margin - 1, y + 4, { align: "right" });

    applyPdfFooter(doc);
    doc.save(`supplier-outstanding-${headerInfo.currCode}-${asOfDate || "today"}.pdf`);
  }

  const agingBadge = (bucket) => {
    const styles = {
      current: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      "1_30": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      "31_60": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      "61_90": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      over_90: "bg-rose-200 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 font-bold",
    };
    const labels = { current: "Current", "1_30": "1-30d", "31_60": "31-60d", "61_90": "61-90d", over_90: ">90d" };
    return <span className={`text-xs px-2 py-0.5 rounded-full ${styles[bucket] || ""}`}>{labels[bucket] || bucket}</span>;
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <Link to={backPath} className="text-xs font-bold text-brand uppercase tracking-wider hover:text-brand-600 transition-colors">
            ← {backLabel}
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">
            Supplier Outstanding Analysis
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Payables aging analysis by supplier as at {asOfDate}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨️ Print</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportExcel} disabled={!summary.length}>📊 Excel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={exportPDF} disabled={!summary.length}>📄 PDF</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "Total Outstanding", value: totals.total, color: "border-slate-500", text: "text-slate-800 dark:text-slate-100" },
          { label: "Current (≤0d)", value: totals.current, color: "border-emerald-500", text: "text-emerald-700" },
          { label: "1-30 Days", value: totals["1_30"], color: "border-yellow-400", text: "text-yellow-700" },
          { label: "31-60 Days", value: totals["31_60"], color: "border-orange-500", text: "text-orange-700" },
          { label: "61-90 Days", value: totals["61_90"], color: "border-red-500", text: "text-red-700" },
          { label: ">90 Days (Critical)", value: totals.over_90, color: "border-rose-600", text: "text-rose-700 font-black" },
        ].map((k, i) => (
          <div key={i} className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 ${k.color} border-y border-r border-slate-200 dark:border-slate-700`}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
            <h3 className={`text-lg font-black mt-1 ${k.text}`}>₵{fmt(k.value)}</h3>
          </div>
        ))}
      </div>

      {/* Filters + Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">As of Date:</span>
            <input className="input input-bordered input-sm" type="date" value={asOf}
              onChange={(e) => setAsOf(e.target.value)} />
          </div>
          <input className="input input-bordered input-sm w-52" placeholder="🔍 Search supplier..."
            value={supplierQuery} onChange={(e) => setSupplierQuery(e.target.value)} />
          <div className="flex gap-2 ml-auto">
            <button className={`btn btn-sm ${view === "aging" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setView("aging")}>Aging Summary</button>
            <button className={`btn btn-sm ${view === "detail" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setView("detail")}>Bill Detail</button>
          </div>
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>

        <div className="overflow-x-auto">
          {view === "aging" ? (
            <table className="table table-sm w-full text-sm">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="py-3 text-xs uppercase tracking-wider">Supplier</th>
                  <th className="text-right py-3 text-xs uppercase text-emerald-300">Current</th>
                  <th className="text-right py-3 text-xs uppercase text-yellow-300">1-30 Days</th>
                  <th className="text-right py-3 text-xs uppercase text-orange-300">31-60 Days</th>
                  <th className="text-right py-3 text-xs uppercase text-red-300">61-90 Days</th>
                  <th className="text-right py-3 text-xs uppercase text-rose-300">&gt;90 Days</th>
                  <th className="text-right py-3 text-xs uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummary.length === 0 && !loading && (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">No outstanding payables found</td></tr>
                )}
                {filteredSummary.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 border-b border-slate-100 dark:border-slate-700/50">
                    <td className="py-2.5">
                      <div className="font-semibold text-slate-700 dark:text-slate-200">{s.supplier_name}</div>
                      {s.supplier_code && <div className="text-xs text-slate-400">{s.supplier_code}</div>}
                    </td>
                    <td className="text-right font-mono text-emerald-700 dark:text-emerald-400">{s.current > 0 ? `₵${fmt(s.current)}` : "—"}</td>
                    <td className="text-right font-mono text-yellow-700 dark:text-yellow-400">{s["1_30"] > 0 ? `₵${fmt(s["1_30"])}` : "—"}</td>
                    <td className="text-right font-mono text-orange-700 dark:text-orange-400">{s["31_60"] > 0 ? `₵${fmt(s["31_60"])}` : "—"}</td>
                    <td className="text-right font-mono text-red-700 dark:text-red-400">{s["61_90"] > 0 ? `₵${fmt(s["61_90"])}` : "—"}</td>
                    <td className="text-right font-mono text-rose-700 dark:text-rose-400 font-bold">{s.over_90 > 0 ? `₵${fmt(s.over_90)}` : "—"}</td>
                    <td className="text-right font-black font-mono text-slate-900 dark:text-slate-100">₵{fmt(s.total)}</td>
                  </tr>
                ))}
              </tbody>
              {filteredSummary.length > 0 && (
                <tfoot className="bg-slate-800 text-white">
                  <tr>
                    <td className="font-black py-3 text-xs uppercase">Totals</td>
                    <td className="text-right font-black font-mono">₵{fmt(totals.current)}</td>
                    <td className="text-right font-black font-mono">₵{fmt(totals["1_30"])}</td>
                    <td className="text-right font-black font-mono">₵{fmt(totals["31_60"])}</td>
                    <td className="text-right font-black font-mono">₵{fmt(totals["61_90"])}</td>
                    <td className="text-right font-black font-mono">₵{fmt(totals.over_90)}</td>
                    <td className="text-right font-black font-mono">₵{fmt(totals.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            <table className="table table-sm w-full text-sm">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="py-3 text-xs uppercase">Supplier</th>
                  <th className="py-3 text-xs uppercase">Bill No</th>
                  <th className="py-3 text-xs uppercase">Bill Date</th>
                  <th className="py-3 text-xs uppercase">Due Date</th>
                  <th className="text-right py-3 text-xs uppercase">Total</th>
                  <th className="text-right py-3 text-xs uppercase">Paid</th>
                  <th className="text-right py-3 text-xs uppercase">Outstanding</th>
                  <th className="py-3 text-xs uppercase">Aging</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetail.length === 0 && !loading && (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">No records found</td></tr>
                )}
                {filteredDetail.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 border-b border-slate-100 dark:border-slate-700/50">
                    <td className="font-medium text-slate-700 dark:text-slate-200">{r.supplier_name || "—"}</td>
                    <td className="font-mono text-brand text-xs">{r.bill_no}</td>
                    <td className="text-xs text-slate-500">{fmtDate(r.bill_date)}</td>
                    <td className="text-xs text-slate-500">{fmtDate(r.due_date)}</td>
                    <td className="text-right font-mono">₵{fmt(r.total_amount)}</td>
                    <td className="text-right font-mono text-emerald-600">₵{fmt(r.paid)}</td>
                    <td className="text-right font-black font-mono text-slate-900 dark:text-slate-100">₵{fmt(r.outstanding)}</td>
                    <td>{agingBadge(r.aging_bucket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
