import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap, Droplets, Fuel, Activity, Plus,
  Calendar, CheckCircle, ArrowLeft, RefreshCw, BarChart3, AlertCircle, Building2,
  Eye, FileText, Edit
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function UtilitiesEnergyPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("meters"); // "meters" | "generator" | "bills"
  const [properties, setProperties] = useState([]);

  const [meters, setMeters] = useState([]);
  const [genLogs, setGenLogs] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const [showMeterModal, setShowMeterModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [viewingMeter, setViewingMeter] = useState(null);
  const [viewingGen, setViewingGen] = useState(null);
  const [viewingBill, setViewingBill] = useState(null);
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Meter register form - clean initial state (no prefilled values)
  const getInitialMeterForm = () => ({
    property_id: "",
    meter_code: "",
    utility_type: "",
    location_description: "",
    meter_serial_number: "",
    unit_of_measure: "",
    tariff_rate_per_unit: "",
    status: "",
  });

  // Utility Bill form - clean initial state
  const getInitialBillForm = () => ({
    property_id: "",
    utility_type: "",
    service_provider: "",
    account_number: "",
    bill_reference: "",
    billing_month: "",
    total_consumption: "",
    bill_amount: "",
    due_date: "",
    payment_status: "",
    notes: "",
  });

  // Meter reading form - clean initial state
  const getInitialReadingForm = () => ({
    previous_reading: 0,
    current_reading: "",
    reading_date: "",
    tariff_rate: "",
    notes: "",
  });

  // Generator log form - clean initial state
  const getInitialGenForm = () => ({
    property_id: "",
    generator_name: "",
    log_date: "",
    start_run_hours: "",
    end_run_hours: "",
    fuel_added_liters: "",
    fuel_consumed_liters: "",
    current_fuel_level_percent: "",
    notes: "",
  });

  const [meterForm, setMeterForm] = useState(getInitialMeterForm());
  const [billForm, setBillForm] = useState(getInitialBillForm());
  const [readingForm, setReadingForm] = useState(getInitialReadingForm());
  const [genForm, setGenForm] = useState(getInitialGenForm());

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchProperties = async () => {
    try {
      const res = await api.get("/facilities/properties");
      const list = res.data?.data || [];
      setProperties(list);
      if (list.length > 0) {
        setGenForm((g) => ({ ...g, property_id: list[0].id }));
        setMeterForm((m) => ({ ...m, property_id: list[0].id }));
        setBillForm((b) => ({ ...b, property_id: list[0].id }));
      }
    } catch {}
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "meters") {
        const res = await api.get("/facilities/utilities/meters");
        setMeters(res.data?.data || []);
      } else if (activeTab === "generator") {
        const res = await api.get("/facilities/utilities/generator-logs");
        setGenLogs(res.data?.data || []);
      } else if (activeTab === "bills") {
        const res = await api.get("/facilities/utilities/bills");
        setBills(res.data?.data || []);
      }
    } catch {
      toast.error(`Failed to load ${activeTab} data`);
    } finally {
      setLoading(false);
    }
  };

  const openLogReading = (m) => {
    setSelectedMeter(m);
    setReadingForm({
      previous_reading: m.last_reading || 10250,
      current_reading: "",
      reading_date: new Date().toISOString().slice(0, 10),
      tariff_rate: m.tariff_rate_per_unit || 1.85,
      notes: "",
    });
    setShowReadingModal(true);
  };

  const handleSubmitReading = async (e) => {
    e.preventDefault();
    if (!readingForm.current_reading) {
      toast.warn("Please enter the current meter reading");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/facilities/utilities/readings", {
        meter_id: selectedMeter.id,
        ...readingForm,
      });
      toast.success("Utility meter reading recorded successfully!");
      setShowReadingModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to log meter reading");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGenLog = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/facilities/utilities/generator-logs", genForm);
      toast.success("Standby generator runtime and fuel logged successfully!");
      setShowGenModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to log generator run");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMeter = async (e) => {
    e.preventDefault();
    if (!meterForm.property_id || !meterForm.meter_code.trim()) {
      toast.warn("Property and Meter Code are required");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/facilities/utilities/meters", meterForm);
      toast.success("Utility meter added successfully!");
      setShowMeterModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add utility meter");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBill = async (e) => {
    e.preventDefault();
    if (!billForm.property_id || !billForm.bill_reference.trim() || !billForm.bill_amount) {
      toast.warn("Property, Bill Reference, and Bill Amount are required");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/facilities/utilities/bills", billForm);
      toast.success("Utility bill recorded successfully!");
      setShowBillModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record utility bill");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs"
            title="Go Back"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Utilities and Energy Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Monitoring electricity, water, fuel and generator consumption; analysing bills; identifying waste; managing energy efficiency and tracking utility costs by building or site.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "meters" && (
            <>
              <button
                onClick={() => {
                  setMeterForm(getInitialMeterForm());
                  setShowMeterModal(true);
                }}
                className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
              >
                <Plus size={15} /> Add Utility Meter
              </button>
              {meters.length > 0 && (
                <button
                  onClick={() => openLogReading(meters[0])}
                  className="btn btn-outline inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
                >
                  <Activity size={15} /> Log Reading
                </button>
              )}
            </>
          )}

          {activeTab === "generator" && (
            <button
              onClick={() => {
                setGenForm(getInitialGenForm());
                setShowGenModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Log Generator Runtime & Fuel
            </button>
          )}

          {activeTab === "bills" && (
            <button
              onClick={() => {
                setBillForm(getInitialBillForm());
                setShowBillModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Record Utility Bill
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("meters")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "meters"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Zap size={14} />
          Consumption Meters & Readings
        </button>

        <button
          onClick={() => setActiveTab("generator")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "generator"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Fuel size={14} />
          Generator & Fuel Operations
        </button>

        <button
          onClick={() => setActiveTab("bills")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "bills"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <BarChart3 size={14} />
          Utility Bills & Building Cost Breakdown
        </button>
      </div>

      {/* TAB 1: METERS */}
      {activeTab === "meters" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Active Utility Submeters
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Meter Code</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Utility Type</th>
                  <th className="px-3 py-3">Location / Tag</th>
                  <th className="px-3 py-3">Last Reading</th>
                  <th className="px-3 py-3">Tariff Rate</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {meters.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{m.meter_code}</td>
                    <td className="px-3 py-3">{m.property_name || "Primary Estate"}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                        {m.utility_type?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{m.location_description}</td>
                    <td className="px-3 py-3 font-mono font-bold text-slate-800 dark:text-white">
                      {m.last_reading != null ? `${m.last_reading} ${m.unit_of_measure}` : "10,250 kWh"}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      GHS {parseFloat(m.tariff_rate_per_unit || 1.85).toFixed(4)} / {m.unit_of_measure}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setViewingMeter(m)}
                          className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                          title="View Meter Details"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          onClick={() => openLogReading(m)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1"
                          title="Record Consumption Reading"
                        >
                          <Plus size={12} /> Log Reading
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GENERATOR & FUEL */}
      {activeTab === "generator" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Generator Runtime, Fuel Consumed & kWh Produced
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-3 py-3">Generator Unit</th>
                  <th className="px-3 py-3">Run Hours</th>
                  <th className="px-3 py-3">Fuel Consumed</th>
                  <th className="px-3 py-3">Fuel Added</th>
                  <th className="px-3 py-3">Tank Level</th>
                  <th className="px-3 py-3">Efficiency</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {genLogs.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono">{String(g.log_date).slice(0, 10)}</td>
                    <td className="px-3 py-3 font-bold text-slate-800 dark:text-white">{g.generator_name}</td>
                    <td className="px-3 py-3 font-mono font-bold text-amber-600">{g.total_hours_run} hrs</td>
                    <td className="px-3 py-3 font-mono">{g.fuel_consumed_liters} L</td>
                    <td className="px-3 py-3 font-mono text-emerald-600">{g.fuel_added_liters ? `+${g.fuel_added_liters} L` : "0 L"}</td>
                    <td className="px-3 py-3 font-bold">{g.current_fuel_level_percent}%</td>
                    <td className="px-3 py-3 font-mono text-blue-600 font-bold">{g.fuel_efficiency_kwh_per_liter} kWh/L</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewingGen(g)}
                        className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                        title="View Log Details"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: UTILITY BILLS */}
      {activeTab === "bills" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Utility Bills & Property Cost Allocations
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Bill Ref</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Provider / Utility</th>
                  <th className="px-3 py-3">Month</th>
                  <th className="px-3 py-3">Consumption</th>
                  <th className="px-3 py-3">Bill Amount (GHS)</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">{b.bill_reference}</td>
                    <td className="px-3 py-3">{b.property_name || "Primary Estate"}</td>
                    <td className="px-3 py-3 font-semibold">{b.service_provider} ({b.utility_type})</td>
                    <td className="px-3 py-3 font-mono">{b.billing_month}</td>
                    <td className="px-3 py-3 font-mono">{b.total_consumption}</td>
                    <td className="px-3 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      GHS {parseFloat(b.bill_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        b.payment_status === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {b.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewingBill(b)}
                        className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                        title="View Bill Breakdown"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: LOG READING */}
      {showReadingModal && selectedMeter && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap size={18} className="text-amber-500" />
                Log Meter Reading: {selectedMeter.meter_code}
              </h3>
              <button
                type="button"
                onClick={() => setShowReadingModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitReading} className="p-6 space-y-4 text-xs">
              <div className="bg-amber-50 dark:bg-amber-950/50 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50">
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold uppercase block">{selectedMeter.utility_type}</span>
                <span className="font-semibold text-slate-800 dark:text-white block">{selectedMeter.location_description}</span>
                <span className="text-slate-500 text-[11px] block mt-1">Previous: {readingForm.previous_reading} {selectedMeter.unit_of_measure}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Current Reading ({selectedMeter.unit_of_measure})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 10450"
                    value={readingForm.current_reading}
                    onChange={(e) => setReadingForm({ ...readingForm, current_reading: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-white font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Reading Date</label>
                  <input
                    type="date"
                    value={readingForm.reading_date}
                    onChange={(e) => setReadingForm({ ...readingForm, reading_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Tariff Rate Per Unit (GHS)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={readingForm.tariff_rate}
                  onChange={(e) => setReadingForm({ ...readingForm, tariff_rate: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowReadingModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {submitting ? "Saving..." : "Record Reading"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG GENERATOR */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Fuel size={18} className="text-amber-500" />
                Log Standby Generator Runtime & Diesel
              </h3>
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateGenLog} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Property</label>
                  <select
                    value={genForm.property_id}
                    onChange={(e) => setGenForm({ ...genForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Generator Unit</label>
                  <input
                    type="text"
                    value={genForm.generator_name}
                    onChange={(e) => setGenForm({ ...genForm, generator_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Start Run Hours</label>
                  <input
                    type="number"
                    step="0.1"
                    value={genForm.start_run_hours}
                    onChange={(e) => setGenForm({ ...genForm, start_run_hours: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">End Run Hours</label>
                  <input
                    type="number"
                    step="0.1"
                    value={genForm.end_run_hours}
                    onChange={(e) => setGenForm({ ...genForm, end_run_hours: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Fuel Consumed (Liters)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={genForm.fuel_consumed_liters}
                    onChange={(e) => setGenForm({ ...genForm, fuel_consumed_liters: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Current Tank Level (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={genForm.current_fuel_level_percent}
                    onChange={(e) => setGenForm({ ...genForm, current_fuel_level_percent: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {submitting ? "Saving..." : "Log Operation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTER UTILITY METER */}
      {/* ========================================================================= */}
      {showMeterModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap size={18} className="text-amber-500" />
                Register New Utility Submeter
              </h3>
              <button
                onClick={() => setShowMeterModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitMeter} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Property Site <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={meterForm.property_id}
                    onChange={(e) => setMeterForm({ ...meterForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  >
                    <option value="">-- Select Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.property_name} ({p.property_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Meter Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MTR-ELEC-02"
                    value={meterForm.meter_code}
                    onChange={(e) => setMeterForm({ ...meterForm, meter_code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Utility Type</label>
                  <select
                    value={meterForm.utility_type}
                    onChange={(e) => setMeterForm({ ...meterForm, utility_type: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold"
                  >
                    <option value="ELECTRICITY_GRID">⚡ Electricity Grid</option>
                    <option value="WATER_MUNICIPAL">💧 Municipal Water</option>
                    <option value="BOREHOLE_WATER">🌊 Borehole Water</option>
                    <option value="DIESEL_GENERATOR">⛽ Diesel Generator Fuel</option>
                    <option value="SOLAR_PV">☀️ Solar PV Inverter</option>
                    <option value="LPG_GAS">🔥 LPG Gas Tank</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Meter Serial Number</label>
                  <input
                    type="text"
                    placeholder="e.g. ECG-SN-99824"
                    value={meterForm.meter_serial_number}
                    onChange={(e) => setMeterForm({ ...meterForm, meter_serial_number: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    placeholder="e.g. kWh, m³, Liters"
                    value={meterForm.unit_of_measure}
                    onChange={(e) => setMeterForm({ ...meterForm, unit_of_measure: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Tariff Rate (GHS/Unit)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1.85"
                    value={meterForm.tariff_rate_per_unit}
                    onChange={(e) => setMeterForm({ ...meterForm, tariff_rate_per_unit: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Physical Location / Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. Main Power Substation, Block B Distribution Board"
                    value={meterForm.location_description}
                    onChange={(e) => setMeterForm({ ...meterForm, location_description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMeterModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {submitting ? "Saving..." : "Add Meter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD UTILITY BILL */}
      {/* ========================================================================= */}
      {showBillModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 size={18} className="text-amber-500" />
                Record Utility Provider Bill
              </h3>
              <button
                onClick={() => setShowBillModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitBill} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Property Site <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={billForm.property_id}
                    onChange={(e) => setBillForm({ ...billForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  >
                    <option value="">-- Select Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.property_name} ({p.property_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Utility Type</label>
                  <select
                    value={billForm.utility_type}
                    onChange={(e) => setBillForm({ ...billForm, utility_type: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold"
                  >
                    <option value="ELECTRICITY">⚡ Electricity (ECG)</option>
                    <option value="WATER">💧 Water (GWCL)</option>
                    <option value="FUEL_DIESEL">⛽ Diesel / Fuel</option>
                    <option value="WASTE_SEWAGE">🗑️ Waste & Sewage</option>
                    <option value="GAS">🔥 Gas Supply</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Service Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. Electricity Company of Ghana (ECG)"
                    value={billForm.service_provider}
                    onChange={(e) => setBillForm({ ...billForm, service_provider: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Bill Reference / Invoice # <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ECG-INV-2026-03"
                    value={billForm.bill_reference}
                    onChange={(e) => setBillForm({ ...billForm, bill_reference: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Billing Month</label>
                  <input
                    type="month"
                    value={billForm.billing_month}
                    onChange={(e) => setBillForm({ ...billForm, billing_month: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Bill Amount (GHS) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 18450.00"
                    value={billForm.bill_amount}
                    onChange={(e) => setBillForm({ ...billForm, bill_amount: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-bold font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Total Consumption</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 14200"
                    value={billForm.total_consumption}
                    onChange={(e) => setBillForm({ ...billForm, total_consumption: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Payment Status</label>
                  <select
                    value={billForm.payment_status}
                    onChange={(e) => setBillForm({ ...billForm, payment_status: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold"
                  >
                    <option value="PENDING">Pending Approval</option>
                    <option value="PAID">Paid</option>
                    <option value="OVERDUE">Overdue</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBillModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {submitting ? "Saving..." : "Record Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: VIEW METER */}
      {viewingMeter && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <span className="font-mono text-[10px] text-slate-400 block">{viewingMeter.meter_code}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap size={17} className="text-amber-500" />
                  Submeter Details
                </h3>
              </div>
              <button onClick={() => setViewingMeter(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Property</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingMeter.property_name || "Primary Estate"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Utility Type</span>
                  <span className="font-bold text-amber-600 text-xs">{viewingMeter.utility_type?.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Serial Number</span>
                  <span className="font-mono text-slate-800 dark:text-white text-xs">{viewingMeter.meter_serial_number || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Unit of Measure</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingMeter.unit_of_measure}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Tariff Rate</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">GHS {parseFloat(viewingMeter.tariff_rate_per_unit || 0).toFixed(4)} / {viewingMeter.unit_of_measure}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {viewingMeter.status}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Location / Tag:</span>
                <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                  {viewingMeter.location_description || "No specific location tag provided."}
                </p>
              </div>

              {viewingMeter.last_reading != null && (
                <div className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-center justify-between">
                  <div>
                    <span className="text-amber-800 dark:text-amber-300 text-[11px] font-semibold block">Latest Logged Meter Reading</span>
                    <span className="font-mono text-lg font-bold text-slate-900 dark:text-white">{viewingMeter.last_reading} {viewingMeter.unit_of_measure}</span>
                  </div>
                  <button
                    onClick={() => {
                      const m = viewingMeter;
                      setViewingMeter(null);
                      openLogReading(m);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    Log New Reading
                  </button>
                </div>
              )}
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingMeter(null)}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW GENERATOR LOG */}
      {viewingGen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Fuel size={17} className="text-amber-500" />
                Generator Operational Log
              </h3>
              <button onClick={() => setViewingGen(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Log Date</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">{String(viewingGen.log_date).slice(0, 10)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Generator Unit</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingGen.generator_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Runtime Hours</span>
                  <span className="font-mono font-bold text-amber-600 text-xs">{viewingGen.total_hours_run} hrs</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Fuel Consumed</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">{viewingGen.fuel_consumed_liters} Liters</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Fuel Added</span>
                  <span className="font-mono text-emerald-600 font-bold text-xs">{viewingGen.fuel_added_liters ? `+${viewingGen.fuel_added_liters} L` : "0 L"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Current Fuel Level</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingGen.current_fuel_level_percent}%</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Fuel Efficiency</span>
                  <span className="font-mono text-blue-600 font-bold text-xs">{viewingGen.fuel_efficiency_kwh_per_liter} kWh / Liter</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Recorded By</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">{viewingGen.logged_by || "Duty Technician"}</span>
                </div>
              </div>
              {viewingGen.notes && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Operational Notes:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                    {viewingGen.notes}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingGen(null)}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW UTILITY BILL */}
      {viewingBill && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <span className="font-mono text-[10px] text-slate-400 block">{viewingBill.bill_reference}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 size={17} className="text-amber-500" />
                  Utility Bill Breakdown
                </h3>
              </div>
              <button onClick={() => setViewingBill(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Property</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingBill.property_name || "Primary Estate"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Service Provider</span>
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{viewingBill.service_provider} ({viewingBill.utility_type})</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Billing Month</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">{viewingBill.billing_month}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Total Consumption</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white text-xs">{viewingBill.total_consumption}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Bill Amount</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                    GHS {parseFloat(viewingBill.bill_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Payment Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    viewingBill.payment_status === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {viewingBill.payment_status}
                  </span>
                </div>
                {viewingBill.account_number && (
                  <div>
                    <span className="text-slate-400 text-[11px] block">Account Number</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 text-xs">{viewingBill.account_number}</span>
                  </div>
                )}
                {viewingBill.due_date && (
                  <div>
                    <span className="text-slate-400 text-[11px] block">Due Date</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 text-xs">{String(viewingBill.due_date).slice(0, 10)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingBill(null)}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
