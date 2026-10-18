import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Download, RefreshCw, Sparkles, Shield, 
  Bug, Trash2, Building2, CheckCircle2, AlertTriangle, Star
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function FMSoftServicesReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState({
    propertyId: ""
  });

  useEffect(() => {
    fetchProperties();
    fetchReport();
  }, []);

  const fetchProperties = async () => {
    try {
      const res = await api.get("/facilities/properties");
      setProperties(res.data?.data || []);
    } catch {}
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get("/facilities/reports/soft-services-compliance", { params: filters });
      setReportData(res.data?.data || null);
    } catch {
      toast.error("Failed to load soft services compliance report");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData?.properties?.length) {
      toast.warn("No data to export");
      return;
    }
    const headers = ["Property Name", "Property Code", "Janitorial Audits", "Avg Hygiene Rating", "Security Patrols", "Security Anomalies", "Pest Treatments", "Waste Manifests"];
    const rows = reportData.properties.map(p => [
      `"${(p.property_name || "").replace(/"/g, '""')}"`,
      p.property_code || "",
      p.janitorial_count || 0,
      p.avg_janitorial_rating ? Number(p.avg_janitorial_rating).toFixed(1) : "—",
      p.patrol_count || 0,
      p.security_anomalies || 0,
      p.pest_treatments || 0,
      p.waste_manifests || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Soft_Services_Compliance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Soft Services Report exported successfully");
  };

  const jan = reportData?.janitorial || {};
  const sec = reportData?.security || {};
  const pest = reportData?.pest_control || {};
  const waste = reportData?.waste || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header with Back Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm"
            title="Go Back"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Soft Facilities Services & Site Operations Compliance Report
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Janitorial hygiene adherence, security patrol checkpoint anomalies, pest infestation control, and waste manifest audits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="btn btn-secondary inline-flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="btn btn-primary inline-flex items-center gap-1.5"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-slate-400" />
          <select
            value={filters.propertyId}
            onChange={(e) => setFilters({ ...filters, propertyId: e.target.value })}
            className="input py-1 px-2 text-xs"
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.property_name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchReport}
          className="btn-primary px-4 py-1.5 text-xs font-semibold rounded-lg ml-auto"
        >
          Apply Filters
        </button>
      </div>

      {loading ? (
        <div className="p-16 flex justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* 4 Pillars of Soft Services KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Janitorial Hygiene */}
            <div className="card p-5 space-y-2 border-t-4 border-t-emerald-500">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Janitorial Quality</span>
                <Sparkles size={16} className="text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {jan.avg_rating || 5.0}
                </span>
                <span className="text-xs text-amber-500 font-bold flex items-center">
                  <Star size={12} className="fill-amber-400 text-amber-400 mr-0.5" /> / 5.0
                </span>
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                <div>Restroom Sanitized: <span className="font-bold text-emerald-600">{jan.restroom_sanitization_rate}%</span></div>
                <div>Floors Mopped: <span className="font-bold text-slate-700 dark:text-slate-300">{jan.floor_mopping_rate}%</span></div>
                <div>Supplies Restocked: <span className="font-bold text-slate-700 dark:text-slate-300">{jan.supplies_restocked_rate}%</span></div>
              </div>
            </div>

            {/* Security Patrols */}
            <div className="card p-5 space-y-2 border-t-4 border-t-blue-500">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Security Rounds</span>
                <Shield size={16} className="text-blue-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-blue-600">
                  {sec.secure_count || 0}
                </span>
                <span className="text-xs text-slate-400">/ {sec.total_checkpoints || 0} secure</span>
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                <div>Anomalies Detected: <span className={`font-bold ${sec.anomaly_count > 0 ? "text-rose-600" : "text-emerald-600"}`}>{sec.anomaly_count} ({sec.anomaly_rate_pct}%)</span></div>
                <div>Doors Unlocked: <span className="font-bold text-slate-700 dark:text-slate-300">{sec.doors_unlocked}</span></div>
                <div>Breach Attempts: <span className="font-bold text-rose-600">{sec.breach_attempts}</span></div>
              </div>
            </div>

            {/* Pest Control */}
            <div className="card p-5 space-y-2 border-t-4 border-t-amber-500">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Pest Management</span>
                <Bug size={16} className="text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-600">
                  {pest.activity_rate_pct || 0}%
                </span>
                <span className="text-xs text-slate-400">bait activity</span>
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                <div>Treatments Done: <span className="font-bold text-slate-700 dark:text-slate-300">{pest.total_treatments}</span></div>
                <div>Bait Stations Checked: <span className="font-bold text-slate-700 dark:text-slate-300">{pest.total_bait_stations}</span></div>
                <div>High Risk Flags: <span className={`font-bold ${pest.high_risk_incidents > 0 ? "text-rose-600" : "text-emerald-600"}`}>{pest.high_risk_incidents}</span></div>
              </div>
            </div>

            {/* Waste Disposal */}
            <div className="card p-5 space-y-2 border-t-4 border-t-purple-500">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Waste & Sustainability</span>
                <Trash2 size={16} className="text-purple-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-purple-600">
                  {waste.total_manifests || 0}
                </span>
                <span className="text-xs text-slate-400">manifests</span>
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                <div>General Refuse: <span className="font-bold text-slate-700 dark:text-slate-300">{waste.general_waste_bins} bins</span></div>
                <div>Recyclable: <span className="font-bold text-emerald-600">{waste.recyclable_bins} bins</span></div>
                <div>Hazardous: <span className="font-bold text-rose-600">{waste.hazardous_bins} bins</span></div>
              </div>
            </div>
          </div>

          {/* Properties Soft Services Compliance Table */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Facility Properties Soft Services Audit Summary
            </h3>
            <div className="overflow-x-auto">
              <table className="table w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                    <th>Property Name</th>
                    <th>Code</th>
                    <th>Janitorial Audits</th>
                    <th>Hygiene Rating</th>
                    <th>Patrol Checkpoints</th>
                    <th>Security Anomalies</th>
                    <th>Pest Treatments</th>
                    <th>Waste Manifests</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.properties?.map((p) => (
                    <tr key={p.property_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="font-semibold text-slate-800 dark:text-slate-200">{p.property_name}</td>
                      <td className="font-mono text-slate-400">{p.property_code}</td>
                      <td>
                        <span className="font-semibold text-emerald-600">{p.janitorial_count || 0}</span>
                      </td>
                      <td>
                        {p.avg_janitorial_rating ? (
                          <div className="flex items-center gap-1 font-bold text-amber-500">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            <span>{Number(p.avg_janitorial_rating).toFixed(1)}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td>{p.patrol_count || 0}</td>
                      <td>
                        <span className={`font-bold ${p.security_anomalies > 0 ? "text-rose-600" : "text-slate-500"}`}>
                          {p.security_anomalies || 0}
                        </span>
                      </td>
                      <td>{p.pest_treatments || 0}</td>
                      <td>{p.waste_manifests || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
