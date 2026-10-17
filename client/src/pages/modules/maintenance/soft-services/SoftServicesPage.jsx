import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Sparkles, Shield, Bug, Trash2, Plus, 
  Calendar, CheckCircle2, AlertTriangle, Star, Building2, User, ArrowLeft
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function SoftServicesPage() {
  const [activeTab, setActiveTab] = useState("janitorial");
  const [properties, setProperties] = useState([]);

  // Data states
  const [janitorialLogs, setJanitorialLogs] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [pestLogs, setPestLogs] = useState([]);
  const [wasteLogs, setWasteLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form modals
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Janitorial form
  const [janForm, setJanForm] = useState({
    property_id: "",
    cleaner_name: "",
    log_date: new Date().toISOString().slice(0, 10),
    shift: "MORNING",
    restrooms_sanitized: 1,
    floors_mopped: 1,
    trash_emptied: 1,
    soap_paper_restocked: 1,
    supervisor_rating: 5,
    supervisor_name: "",
    notes: ""
  });

  // Security form
  const [secForm, setSecForm] = useState({
    property_id: "",
    guard_name: "",
    checkpoint_name: "",
    checkpoint_status: "SECURE",
    incident_description: "",
    action_taken: ""
  });

  // Pest form
  const [pestForm, setPestForm] = useState({
    property_id: "",
    treatment_date: new Date().toISOString().slice(0, 10),
    technician_name: "",
    target_pest: "RODENTS",
    chemicals_applied: "Bromadiolone 0.005% Blocks",
    dosage_and_method: "Tamper-resistant bait stations",
    bait_stations_checked: 10,
    bait_stations_activity_detected: 0,
    risk_level: "LOW",
    notes: ""
  });

  // Waste form
  const [wasteForm, setWasteForm] = useState({
    property_id: "",
    collection_date: new Date().toISOString().slice(0, 10),
    waste_type: "GENERAL_REFUSE",
    quantity_kg_or_bins: 5,
    unit: "BINS",
    contractor_carrier_name: "Municipal Waste Services",
    manifest_reference_no: ""
  });

  useEffect(() => {
    fetchProperties();
    fetchActiveData();
  }, [activeTab]);

  const fetchProperties = async () => {
    try {
      const res = await api.get("/facilities/properties");
      setProperties(res.data?.data || []);
    } catch {
      // Ignore
    }
  };

  const fetchActiveData = async () => {
    setLoading(true);
    try {
      if (activeTab === "janitorial") {
        const res = await api.get("/facilities/janitorial-logs");
        setJanitorialLogs(res.data?.data || []);
      } else if (activeTab === "security") {
        const res = await api.get("/facilities/security-patrol-logs");
        setSecurityLogs(res.data?.data || []);
      } else if (activeTab === "pest") {
        const res = await api.get("/facilities/pest-control-logs");
        setPestLogs(res.data?.data || []);
      } else if (activeTab === "waste") {
        const res = await api.get("/facilities/waste-disposal-logs");
        setWasteLogs(res.data?.data || []);
      }
    } catch {
      toast.error(`Failed to load ${activeTab} records`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (activeTab === "janitorial") {
        await api.post("/facilities/janitorial-logs", janForm);
        toast.success("Janitorial audit logged successfully");
      } else if (activeTab === "security") {
        await api.post("/facilities/security-patrol-logs", secForm);
        toast.success("Security patrol checkpoint logged");
      } else if (activeTab === "pest") {
        await api.post("/facilities/pest-control-logs", pestForm);
        toast.success("Pest control treatment logged");
      } else if (activeTab === "waste") {
        await api.post("/facilities/waste-disposal-logs", wasteForm);
        toast.success("Waste manifest recorded");
      }
      setShowModal(false);
      fetchActiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit record");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/maintenance?section=Inspections %26 Soft Services"
            className="btn btn-secondary inline-flex items-center gap-1.5"
            title="Back to Inspections & Soft Services"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Soft Facilities Services & Site Operations
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Track non-technical service lines: Janitorial hygiene audits, security patrol logs, pest management, and waste disposal.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} />
          Log {activeTab === "janitorial" ? "Hygiene Audit" : activeTab === "security" ? "Security Patrol" : activeTab === "pest" ? "Pest Treatment" : "Waste Manifest"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Janitorial Audits</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{janitorialLogs.length}</span>
            <span className="badge badge-sm badge-info">Cleaning</span>
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Security Rounds</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{securityLogs.length}</span>
            <span className="badge badge-sm badge-success">Patrols</span>
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pest Treatments</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{pestLogs.length}</span>
            <span className="badge badge-sm badge-ghost">Treatments</span>
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Waste Manifests</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{wasteLogs.length}</span>
            <span className="badge badge-sm badge-primary">Collections</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 space-x-2">
        <button
          onClick={() => setActiveTab("janitorial")}
          className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "janitorial"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Sparkles size={16} />
          Janitorial & Cleaning Audits
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "security"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Shield size={16} />
          Security Patrol Rounds
        </button>

        <button
          onClick={() => setActiveTab("pest")}
          className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "pest"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Bug size={16} />
          Pest Control & Traps
        </button>

        <button
          onClick={() => setActiveTab("waste")}
          className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "waste"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Trash2 size={16} />
          Waste Management
        </button>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="flex justify-center p-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === "janitorial" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="table w-full">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">Date / Shift</th>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Cleaner</th>
                <th className="py-3 px-4">Checkpoints Completed</th>
                <th className="py-3 px-4">Supervisor Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {janitorialLogs.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750">
                  <td className="py-3 px-4 font-mono">
                    {j.log_date?.slice(0, 10)} <span className="text-slate-400">({j.shift})</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {j.property_name || "Facility"}
                  </td>
                  <td className="py-3 px-4">{j.cleaner_name}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${j.restrooms_sanitized ? "bg-green-100 text-green-700" : "bg-slate-100"}`}>
                        Restrooms Sanitized
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] ${j.soap_paper_restocked ? "bg-green-100 text-green-700" : "bg-slate-100"}`}>
                        Restocked
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-amber-500">
                      {[...Array(j.supervisor_rating || 5)].map((_, i) => (
                        <Star key={i} size={14} fill="currentColor" />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === "security" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="table w-full">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">Patrol Time</th>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Guard Name</th>
                <th className="py-3 px-4">Checkpoint</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {securityLogs.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750">
                  <td className="py-3 px-4 font-mono">{s.patrol_time?.slice(0, 19).replace('T', ' ')}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{s.property_name}</td>
                  <td className="py-3 px-4">{s.guard_name}</td>
                  <td className="py-3 px-4 font-medium">{s.checkpoint_name}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      s.checkpoint_status === "SECURE"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {s.checkpoint_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === "pest" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="table w-full">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">Treatment Date</th>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Target Pest</th>
                <th className="py-3 px-4">Chemical Applied</th>
                <th className="py-3 px-4">Bait Stations Checked</th>
                <th className="py-3 px-4">Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {pestLogs.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750">
                  <td className="py-3 px-4 font-mono">{p.treatment_date?.slice(0, 10)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{p.property_name}</td>
                  <td className="py-3 px-4 font-medium">{p.target_pest}</td>
                  <td className="py-3 px-4 text-slate-500">{p.chemicals_applied || "Standard Block"}</td>
                  <td className="py-3 px-4 font-mono">{p.bait_stations_checked} Stations</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      p.risk_level === "LOW" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {p.risk_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="table w-full">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">Collection Date</th>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Waste Type</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">Disposal Contractor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {wasteLogs.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750">
                  <td className="py-3 px-4 font-mono">{w.collection_date?.slice(0, 10)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{w.property_name}</td>
                  <td className="py-3 px-4 font-medium">{w.waste_type?.replace(/_/g, " ")}</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-100">
                    {w.quantity_kg_or_bins} {w.unit}
                  </td>
                  <td className="py-3 px-4 text-slate-500">{w.contractor_carrier_name || "Eco Services"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dynamic Log Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                Log {activeTab === "janitorial" ? "Cleaning / Restroom Audit" : activeTab === "security" ? "Security Patrol Checkpoint" : activeTab === "pest" ? "Pest Control Treatment" : "Waste Disposal"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ×
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="p-6 space-y-4 text-xs">
              <div>
                <label className="label mb-1">Target Property <span className="text-red-500">*</span></label>
                <select
                  className="input w-full text-xs"
                  required
                  onChange={(e) => {
                    const id = e.target.value;
                    if (activeTab === "janitorial") setJanForm({ ...janForm, property_id: id });
                    if (activeTab === "security") setSecForm({ ...secForm, property_id: id });
                    if (activeTab === "pest") setPestForm({ ...pestForm, property_id: id });
                    if (activeTab === "waste") setWasteForm({ ...wasteForm, property_id: id });
                  }}
                >
                  <option value="">Select Facility / Site...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.property_name} ({p.property_code})</option>
                  ))}
                </select>
              </div>

              {activeTab === "janitorial" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label mb-1">Cleaner Name</label>
                      <input
                        type="text"
                        className="input w-full text-xs"
                        value={janForm.cleaner_name}
                        onChange={(e) => setJanForm({ ...janForm, cleaner_name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="label mb-1">Shift</label>
                      <select
                        className="input w-full text-xs"
                        value={janForm.shift}
                        onChange={(e) => setJanForm({ ...janForm, shift: e.target.value })}
                      >
                        <option value="MORNING">Morning</option>
                        <option value="AFTERNOON">Afternoon</option>
                        <option value="EVENING">Evening</option>
                        <option value="NIGHT">Night</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={janForm.restrooms_sanitized === 1}
                        onChange={(e) => setJanForm({ ...janForm, restrooms_sanitized: e.target.checked ? 1 : 0 })}
                        className="rounded text-emerald-600"
                      />
                      Restrooms cleaned and disinfected
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={janForm.soap_paper_restocked === 1}
                        onChange={(e) => setJanForm({ ...janForm, soap_paper_restocked: e.target.checked ? 1 : 0 })}
                        className="rounded text-emerald-600"
                      />
                      Hand soap and paper towels restocked
                    </label>
                  </div>
                </>
              )}

              {activeTab === "security" && (
                <>
                  <div>
                    <label className="label mb-1">Security Officer Name</label>
                    <input
                      type="text"
                      className="input w-full text-xs"
                      value={secForm.guard_name}
                      onChange={(e) => setSecForm({ ...secForm, guard_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label mb-1">Checkpoint / Sector Name</label>
                    <input
                      type="text"
                      className="input w-full text-xs"
                      placeholder="e.g. Main Server Room Door, Perimeter North"
                      value={secForm.checkpoint_name}
                      onChange={(e) => setSecForm({ ...secForm, checkpoint_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label mb-1">Status Result</label>
                    <select
                      className="input w-full text-xs"
                      value={secForm.checkpoint_status}
                      onChange={(e) => setSecForm({ ...secForm, checkpoint_status: e.target.value })}
                    >
                      <option value="SECURE">Secure (Normal)</option>
                      <option value="ANOMALY_FOUND">Anomaly Found</option>
                      <option value="DOOR_UNLOCKED">Door Unlocked</option>
                      <option value="LIGHT_DEFECTIVE">Lighting Defective</option>
                    </select>
                  </div>
                </>
              )}

              {activeTab === "pest" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label mb-1">Technician</label>
                      <input
                        type="text"
                        className="input w-full text-xs"
                        value={pestForm.technician_name}
                        onChange={(e) => setPestForm({ ...pestForm, technician_name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="label mb-1">Target Pest</label>
                      <select
                        className="input w-full text-xs"
                        value={pestForm.target_pest}
                        onChange={(e) => setPestForm({ ...pestForm, target_pest: e.target.value })}
                      >
                        <option value="RODENTS">Rodents</option>
                        <option value="INSECTS_COCKROACHES">Insects & Cockroaches</option>
                        <option value="TERMITES">Termites</option>
                        <option value="GENERAL">General Pest Control</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "waste" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label mb-1">Quantity</label>
                      <input
                        type="number"
                        className="input w-full text-xs"
                        value={wasteForm.quantity_kg_or_bins}
                        onChange={(e) => setWasteForm({ ...wasteForm, quantity_kg_or_bins: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="label mb-1">Unit</label>
                      <select
                        className="input w-full text-xs"
                        value={wasteForm.unit}
                        onChange={(e) => setWasteForm({ ...wasteForm, unit: e.target.value })}
                      >
                        <option value="BINS">Bins</option>
                        <option value="KG">Kilograms</option>
                        <option value="TONS">Tons</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary text-xs px-3 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-xs px-4 py-2 font-medium">
                  {submitting ? "Saving..." : "Save Log Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
